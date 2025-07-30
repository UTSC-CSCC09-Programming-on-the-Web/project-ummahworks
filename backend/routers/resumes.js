const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const { authenticateToken } = require("../middleware/auth");
const { Resume } = require("../models/Resume");
const mammoth = require("mammoth");
const TurndownService = require("turndown");
const TaskQueue = require("../services/taskQueue");
const DocumentGenerator = require("../services/documentGenerator");
const OpenAI = require("openai");

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post("/ai/suggestions", authenticateToken, async (req, res) => {
  const { prompt, resumeId } = req.body;

  console.log(
    "AI suggestions request - resumeId:",
    resumeId,
    "prompt:",
    prompt
  );

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    let resume = null;
    if (resumeId) {
      resume = await Resume.findOne({
        where: { id: resumeId, userId: req.user.id },
      });
    }

    if (!resume) {
      resume = await Resume.findOne({
        where: { userId: req.user.id },
        order: [["createdAt", "DESC"]],
      });
    }

    if (!resume || !resume.content) {
      return res.status(400).json({
        error: "No resume found. Please upload a resume first.",
      });
    }

    const isFirstPrompt = !resume.jobDescription;

    let resumeContent = resume.content;
    let jobDescription = prompt;

    if (!isFirstPrompt) {
      resumeContent = resume.updatedContent || resume.content;
      jobDescription = resume.jobDescription;
    }

    const enhancedPrompt = `As a professional resume consultant, I need you to analyze and improve the following resume based on the job description provided in the prompt.

RESUME CONTENT:
${resumeContent}

JOB DESCRIPTION/REQUIREMENTS:
${jobDescription}

${
  !isFirstPrompt
    ? `ADDITIONAL REFINEMENT REQUEST:
${prompt}

Note: Please consider the original job description above and make changes to the resume.`
    : ""
}

Your task is to:
1. Analyze the resume referencing the job description
2. Make specific improvements to align the resume with the job requirements
3. Return an updated version of the resume with the improvements applied
4. Also Provide a summary of the changes made with a brief explanation of each change

CRITICAL INSTRUCTIONS:
- The updated resume should look like a normal resume, not include any analysis text

Use the following guidelines to enhance the resume:

Content Enhancements
1. Add Relevant Keywords:
   - Identify important keywords from the job description (e.g., skills, tools, certifications) and incorporate them into the resume.

2. Highlight Missing Skills or Experiences:
   - Compare the resume with the job description and suggest adding missing skills, certifications, or experiences.

3. Tailor Achievements:
   - Rewrite achievements to align with the job description, emphasizing relevant metrics (e.g., "Increased sales by 20% using [specific tool]").

4. Improve Clarity:
   - Simplify complex sentences and remove redundant information for better readability.

---

Structural Improvements
1. Reorganize Sections:
   - Adjust the order of sections (e.g., move "Skills" or "Certifications" higher if they are critical for the job).

2. Add a Summary Section:
   - Create a professional summary tailored to the job description, highlighting key qualifications and career goals.

3. Optimize Formatting:
   - Ensure consistent formatting (e.g., bullet points, font size, spacing) for a polished look.

---

Language Enhancements
1. Use Action-Oriented Language:
   - Replace passive phrases with action verbs (e.g., "Managed," "Led," "Developed").

2. Quantify Achievements:
   - Add measurable results to accomplishments (e.g., "Reduced costs by 15%").

3. Align Tone:
   - Match the tone of the resume to the job description (e.g., formal for corporate roles, creative for design roles).

---

Job-Specific Customizations
1. Focus on Relevant Experience:
   - Highlight experiences and projects that directly relate to the job description.

2. Add Industry-Specific Skills:
   - Include skills or tools mentioned in the job description that are relevant to the industry.

3. Include Certifications:
   - Add certifications or training programs that match the job requirements.

---

Additional Suggestions
1. Remove Irrelevant Information:
   - Suggest removing experiences or skills that are not relevant to the job description.

2. Add Soft Skills:
   - Incorporate soft skills (e.g., teamwork, communication) if they are emphasized in the job description.

3. Tailor for ATS (Applicant Tracking Systems):
   - Ensure the resume includes keywords and formatting that optimize it for ATS scanning.

---

You need to return the updated resume with all changes implemented in markdown format and then a list of every change made with a brief description of how the change makes the resume better.
(for example: changed "managed" to "led" because "led" is a more action-oriented verb and is more relevant to the leadership role)

CRITICAL FORMATTING REQUIREMENTS:
1. Start your response with the updated resume in markdown format
2. Do NOT add any introductory text like "Here is the improved resume" or "Do NOT forget this"
3. Do NOT include any explanatory text or headers before the resume content
4. The updated resume should start directly with the resume content (e.g., "# Name" or "## Experience")
5. After the complete updated resume, add the word "SPLIT" on its own line
6. After "SPLIT", provide the list of changes made

IMPORTANT: You MUST include both the updated resume AND the "SPLIT" keyword followed by the list of changes in your response.`;

    const response = await openai.completions.create({
      model: "gpt-4o-mini",
      prompt: enhancedPrompt,
      max_tokens: 16384,
      temperature: 0.7,
    });

    const responseText = response.choices[0].text.trim();

    const parts = responseText.split("SPLIT");

    let updatedResume = "";
    let suggestions = "";

    if (parts.length >= 2) {
      updatedResume = parts[0].trim();
      suggestions = parts[1].trim();
    } else {
      suggestions = responseText.trim();
      updatedResume = "";
    }

    if (updatedResume) {
      let cleanedUpdatedResume = updatedResume;

      cleanedUpdatedResume = cleanedUpdatedResume
        .replace(/^.*?(?=^#\s+[A-Z]|^##\s+[A-Z]|^\*\*[A-Z])/ms, "")
        .replace(/^Do NOT forget this\.?\s*$/gm, "")
        .replace(/^Now, here is the improved resume for .*?:?\s*$/gm, "")
        .replace(/^Here is the improved resume:?\s*$/gm, "")
        .replace(/^Here is the updated resume:?\s*$/gm, "")
        .replace(/^Here is your improved resume:?\s*$/gm, "")
        .replace(/^Below is the improved resume:?\s*$/gm, "")
        .replace(/^The improved resume is as follows:?\s*$/gm, "")
        .replace(/^---\s*$/gm, "")
        .replace(/^\s*---\s*$/gm, "")
        .trim();

      const jobDescriptionLines = jobDescription
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      jobDescriptionLines.forEach((line) => {
        const escapedLine = line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`^\\s*${escapedLine}\\s*$`, "gm");
        cleanedUpdatedResume = cleanedUpdatedResume.replace(regex, "");
      });

      cleanedUpdatedResume = cleanedUpdatedResume
        .replace(/^JOB DESCRIPTION\/REQUIREMENTS:\s*$/gm, "")
        .replace(/^Job Description:\s*$/gm, "")
        .replace(/^Requirements:\s*$/gm, "")
        .replace(/^Job Requirements:\s*$/gm, "")
        .trim();

      updatedResume = cleanedUpdatedResume;
    }

    const updateData = {
      updatedContent: updatedResume,
      suggestions: suggestions,
      updatedAt: new Date(),
    };

    if (isFirstPrompt) {
      updateData.jobDescription = prompt;
    }

    console.log("Updating resume with ID:", resume.id);
    await Resume.update(updateData, {
      where: { id: resume.id },
    });

    res.json({
      suggestions: suggestions,
      updatedResume: updatedResume,
      originalResume: resume.content,
      resumeId: resume.id,
      isFirstPrompt: isFirstPrompt,
    });
  } catch (error) {
    console.error("OpenAI API error:", error);
    res.status(500).json({ error: "Failed to generate suggestions" });
  }
});

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

router.get("/:id/updated", authenticateToken, async (req, res) => {
  try {
    const resume = await Resume.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    res.json({
      updatedContent: resume.updatedContent,
      jobDescription: resume.jobDescription,
      originalContent: resume.content,
      suggestions: resume.suggestions,
    });
  } catch (error) {
    console.error("Error fetching updated resume:", error);
    res.status(500).json({ error: "Failed to fetch updated resume" });
  }
});

router.get("/:id/download/docx", authenticateToken, async (req, res) => {
  try {
    const resume = await Resume.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const content = resume.updatedContent || resume.content;
    const baseFilename = resume.originalName.replace(".docx", "");

    const documentGenerator = new DocumentGenerator();
    const filePath = await documentGenerator.generateDOCX(
      content,
      `${baseFilename}.docx`
    );

    res.download(filePath, `${baseFilename}.docx`, async (err) => {
      if (err) {
        console.error("Download error:", err);
      }
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        console.error("Error cleaning up file:", cleanupError);
      }
    });
  } catch (error) {
    console.error("Error generating DOCX:", error);
    res.status(500).json({ error: "Failed to generate DOCX" });
  }
});

router.post("/:id/email", authenticateToken, async (req, res) => {
  try {
    const { userEmail, format } = req.body;

    if (!userEmail) {
      return res.status(400).json({ error: "Email address is required" });
    }

    if (!process.env.SENDGRID_API_KEY) {
      return res.status(500).json({
        error: "Email service not configured. Please contact administrator.",
      });
    }

    const resume = await Resume.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!resume) {
      return res.status(404).json({ error: "Resume not found" });
    }

    const taskQueue = new TaskQueue();

    const redisAvailable = await taskQueue.checkRedisConnection();
    if (!redisAvailable) {
      return res.status(500).json({
        error: "Task queue service unavailable. Please try again later.",
      });
    }

    const jobId = await taskQueue.addEmailTask(resume.id, userEmail, format);

    res.json({
      message: "Email task queued successfully",
      jobId,
      status: "queued",
    });
  } catch (error) {
    console.error("Error queuing email task:", error);
    res.status(500).json({ error: "Failed to queue email task" });
  }
});

router.get(
  "/job/:queueName/:jobId/status",
  authenticateToken,
  async (req, res) => {
    try {
      const { queueName, jobId } = req.params;

      const taskQueue = new TaskQueue();
      const status = await taskQueue.getJobStatus(queueName, jobId);

      res.json(status);
    } catch (error) {
      console.error("Error getting job status:", error);
      res.status(500).json({ error: "Failed to get job status" });
    }
  }
);

module.exports = router;
