const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const { authenticateToken } = require("../middleware/auth");
const { Resume } = require("../models/Resume");
const mammoth = require("mammoth");
const TurndownService = require("turndown");

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only DOCX files are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const uploadsDir = path.join(__dirname, "../uploads");
if (!require("fs").existsSync(uploadsDir)) {
  require("fs").mkdirSync(uploadsDir, { recursive: true });
}

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  bulletListMarker: "-",
  strongDelimiter: "**",
});

turndownService.addRule("preserveLineBreaks", {
  filter: function (node) {
    return node.nodeName === "BR";
  },
  replacement: function () {
    return "\n";
  },
});

turndownService.addRule("cleanupHeaders", {
  filter: function (node) {
    return node.nodeName.match(/^H[1-6]$/);
  },
  replacement: function (content, node) {
    const level = node.nodeName.charAt(1);
    const cleanContent = content.trim();
    return "\n" + "#".repeat(level) + " " + cleanContent + "\n";
  },
});

router.post(
  "/upload",
  authenticateToken,
  upload.single("resume"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      let htmlContent = null;
      try {
        const result = await mammoth.convertToHtml({
          path: req.file.path,
          styleMap: [
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Title'] => h1:fresh",
            "p[style-name='Subtitle'] => h2:fresh",
            "b => strong",
            "i => em",
            "u => em",
          ],
        });
        htmlContent = result.value;

        if (result.messages.length > 0) {
          console.log("Mammoth conversion warnings:", result.messages);
        }

        console.log("Converted HTML:", htmlContent);
      } catch (conversionError) {
        console.error("Error converting DOCX to HTML:", conversionError);
        await fs.unlink(req.file.path);
        return res.status(500).json({
          error:
            "Failed to convert DOCX file to HTML. Please ensure the file is a valid DOCX document.",
        });
      }

      let markdownContent = null;
      try {
        markdownContent = turndownService.turndown(htmlContent);

        markdownContent = markdownContent
          .replace(/\n\s*\n\s*\n/g, "\n\n")
          .replace(/\n\s*\n/g, "\n\n")
          .replace(/^(#{1,6})\s+/gm, "$1 ")
          .replace(/^[-*]\s+/gm, "- ")
          .replace(/^\s+|\s+$/gm, "")
          .replace(/\*\*([^*]+)\*\*/g, "**$1**")
          .replace(/\*([^*]+)\*/g, "*$1*")
          .replace(
            /(\*\*[^*]+\*\*)\s*\*\s*-\s*([^*]+)\*\s*(\d{4})/g,
            "$1 - $2\n$3"
          )
          .replace(/(\*\*[^*]+\*\*)\s*-\s*([^*]+)\s*(\d{4})/g, "$1 - $2\n$3")
          .replace(/(\n)(#{1,3}\s+)/g, "\n\n$2")
          .replace(/(#{1,3}.*?)(\n)/g, "$1\n\n")
          .replace(/^(\*\*[^*]+\*\*)([^*]+)$/gm, "$1\n$2")
          .trim();

        const lines = markdownContent.split("\n");
        const processedLines = lines.map((line, index) => {
          const trimmedLine = line.trim();

          if (!trimmedLine) return "";

          if (
            index === 0 &&
            trimmedLine.includes("**") &&
            trimmedLine.includes("@")
          ) {
            const nameMatch = trimmedLine.match(/\*\*([^*]+)\*\*/);
            if (nameMatch) {
              const name = nameMatch[1].trim();
              const contactInfo = trimmedLine
                .replace(/\*\*[^*]+\*\*/, "")
                .trim();
              return `# ${name}\n\n${contactInfo}`;
            }
          }

          if (
            trimmedLine.match(/^\*\*[A-Z\s]+\*\*$/) &&
            trimmedLine.length > 5
          ) {
            const headerText = trimmedLine.replace(/\*\*/g, "").trim();
            return `\n## ${headerText}\n`;
          }

          if (
            trimmedLine.includes("**") &&
            trimmedLine.includes(" - ") &&
            trimmedLine.match(/\d{4}/)
          ) {
            const dateMatch = trimmedLine.match(/(\d{4})/);
            const dateStr = dateMatch ? dateMatch[1] : "";

            let titlePart = trimmedLine.replace(/\d{4}.*$/, "").trim();

            titlePart = titlePart
              .replace(/\*\*([^*]+)\*\*/g, "$1")
              .replace(/\*([^*]+)\*/g, "$1");

            return `\n### ${titlePart}\n${dateStr}\n`;
          }

          if (
            trimmedLine.includes("**") &&
            trimmedLine.includes("Sept") &&
            trimmedLine.includes("Dec")
          ) {
            const titleMatch = trimmedLine.match(/\*\*([^*]+)\*\*/);
            if (titleMatch) {
              const title = titleMatch[1].trim();
              const details = trimmedLine.replace(/\*\*[^*]+\*\*/, "").trim();
              return `\n### ${title}\n${details}\n`;
            }
          }

          return line;
        });

        markdownContent = processedLines.join("\n");

        markdownContent = markdownContent
          .replace(/(\*\*[A-Z\s]+\*\*)/g, "\n$1\n")
          .replace(/(\*\*[^*]+\*\*)\s*\*\s*-\s*([^*]+)\*/g, "\n$1 - $2\n")
          .replace(
            /(\*\*[^*]+\*\*)\s*-\s*([^*]+)\s*(\d{4})/g,
            "\n$1 - $2\n$3\n"
          )
          .replace(/(\*\*[^*]+\*\*)\s*(\d{4})/g, "\n$1\n$2\n")
          .replace(/(-\s*[^-]+?)\*\*([^*]+\*\*)/g, "$1\n\n**$2")
          .replace(
            /(-\s*[^-]+?)\*\*([^*]+\*\*)\s*\*\s*-\s*([^*]+)\*/g,
            "$1\n\n**$2** - $3"
          )
          .replace(
            /(-\s*[^-]+?)\*\*([^*]+\*\*)\s*-\s*([^*]+)\s*(\d{4})/g,
            "$1\n\n**$2** - $3\n$4"
          )
          .replace(/^###\s*-\s*/gm, "- ")
          .replace(/^###\s*([^*]+)\*\*([^*]+)\*\*/gm, "### $1**$2**")
          .replace(/\n\s*\n\s*\n/g, "\n\n")
          .replace(/\n\s*\n/g, "\n\n")
          .trim();

        console.log("Converted markdown:", markdownContent);
      } catch (turndownError) {
        console.error("Error converting HTML to Markdown:", turndownError);
        await fs.unlink(req.file.path);
        return res.status(500).json({
          error: "Failed to convert HTML to Markdown.",
        });
      }

      const resume = await Resume.create({
        userId: req.user.id,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        filePath: req.file.path,
        content: markdownContent,
      });

      await fs.unlink(req.file.path);

      res.json({
        message: "Resume uploaded successfully",
        resume: {
          id: resume.id,
          fileName: resume.fileName,
          originalName: resume.originalName,
          content: resume.content,
        },
      });
    } catch (error) {
      console.error("Upload error:", error);

      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error("Error deleting file:", unlinkError);
        }
      }

      res.status(500).json({ error: "Failed to upload resume" });
    }
  }
);

router.get("/", authenticateToken, async (req, res) => {
  try {
    const resumes = await Resume.findAll({
      where: { userId: req.user.id },
      order: [["createdAt", "DESC"]],
    });
    res.json(resumes);
  } catch (error) {
    console.error("Error fetching resumes:", error);
    res.status(500).json({ error: "Failed to fetch resumes" });
  }
});

router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const resume = await Resume.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    try {
      await fs.access(resume.filePath);
      await fs.unlink(resume.filePath);
    } catch (fileError) {
      console.log("File not found or already deleted:", fileError.message);
    }

    await resume.destroy();
    res.json({ message: "Resume deleted successfully" });
  } catch (error) {
    console.error("Error deleting resume:", error);
    res.status(500).json({ error: "Failed to delete resume" });
  }
});

router.get("/:id/markdown", authenticateToken, async (req, res) => {
  try {
    const resume = await Resume.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    res.json({ content: resume.content });
  } catch (error) {
    console.error("Error fetching resume markdown:", error);
    res.status(500).json({ error: "Failed to fetch resume markdown" });
  }
});

module.exports = router;
