const express = require("express");
const router = express.Router();
const fs = require("fs").promises;
const { Resume } = require("../models/Resume");
const { authenticateToken } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");

// Set up multer storage (same as in index.js)
const uploadsDir = path.join(__dirname, "../uploads");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "resume-" + uniqueSuffix + path.extname(file.originalname));
  },
});
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.",
      ),
      false,
    );
  }
};
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Get all resumes for the authenticated user
router.get("/", authenticateToken, async (req, res) => {
  try {
    const resumes = await Resume.findAll({ where: { userId: req.user.id } });
    res.json(resumes);
  } catch (error) {
    console.error("Error fetching resumes:", error);
    res.status(500).json({ error: "Failed to fetch resumes" });
  }
});

// Upload a new resume
router.post(
  "/upload",
  authenticateToken,
  upload.single("resume"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      let extractedText = null;
      if (req.file.mimetype === "text/plain") {
        extractedText = await fs.readFile(req.file.path, "utf8");
      }
      const resumeData = {
        userId: req.user.id,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        filePath: req.file.path,
        content: extractedText,
      };
      const newResume = await Resume.create(resumeData);
      res.status(201).json({
        message: "Resume uploaded successfully",
        resume: {
          id: newResume.id,
          fileName: newResume.fileName,
          originalName: newResume.originalName,
          fileSize: newResume.fileSize,
          fileType: newResume.fileType,
          filePath: newResume.filePath,
          createdAt: newResume.createdAt,
        },
      });
    } catch (error) {
      console.error("Error uploading resume:", error);
      // Clean up uploaded file if database save failed
      if (req.file && req.file.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.error("Error cleaning up file:", cleanupError);
        }
      }
      res.status(500).json({ error: "Failed to upload resume" });
    }
  },
);

// Delete a resume
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const resume = await Resume.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }
    // Delete the file from filesystem
    try {
      await fs.unlink(resume.filePath);
    } catch (fileError) {
      console.error("Error deleting file:", fileError);
    }
    // Delete from database
    await Resume.destroy({ where: { id: req.params.id, userId: req.user.id } });
    res.json({ message: "Resume deleted successfully" });
  } catch (error) {
    console.error("Error deleting resume:", error);
    res.status(500).json({ error: "Failed to delete resume" });
  }
});

module.exports = router;
