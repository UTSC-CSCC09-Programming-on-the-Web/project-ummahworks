const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const authenticateToken = require('../middleware/auth');
const upload = require('../middleware/upload');
const { Resume } = require('../models/Resume');

// Get all resumes for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const resumes = await Resume.findByUserId(req.user.id);
    res.json(resumes);
  } catch (error) {
    console.error('Error fetching resumes:', error);
    res.status(500).json({ error: 'Failed to fetch resumes' });
  }
});

// Upload a new resume
router.post('/upload', authenticateToken, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { isMasterResume } = req.body;
    let extractedText = '';

    // Extract text based on file type (simplified - you'd want proper text extraction)
    if (req.file.mimetype === 'text/plain') {
      extractedText = await fs.readFile(req.file.path, 'utf8');
    }

    const resumeData = {
      userId: req.user.id,
      originalFilename: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      extractedText: extractedText,
      isMasterResume: isMasterResume === 'true'
    };

    const newResume = await Resume.create(resumeData);
    
    res.status(201).json({
      message: 'Resume uploaded successfully',
      resume: {
        id: newResume.id,
        originalFilename: newResume.original_filename,
        fileSize: newResume.file_size,
        mimeType: newResume.mime_type,
        isMasterResume: newResume.is_master_resume,
        createdAt: newResume.created_at
      }
    });
  } catch (error) {
    console.error('Error uploading resume:', error);
    
    // Clean up uploaded file if database save failed
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }
    
    res.status(500).json({ error: 'Failed to upload resume' });
  }
});

// Delete a resume
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const resume = await Resume.findByIdAndUserId(req.params.id, req.user.id);
    
    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    // Delete the file from filesystem
    try {
      await fs.unlink(resume.file_path);
    } catch (fileError) {
      console.error('Error deleting file:', fileError);
    }

    // Delete from database
    await Resume.delete(req.params.id, req.user.id);

    res.json({ message: 'Resume deleted successfully' });
  } catch (error) {
    console.error('Error deleting resume:', error);
    res.status(500).json({ error: 'Failed to delete resume' });
  }
});

module.exports = router;
