const Queue = require("bull");
const DocumentGenerator = require("./documentGenerator");
const EmailService = require("./emailService");
const { Resume } = require("../models/Resume");
const { User } = require("../models/users");

class TaskQueue {
  constructor() {
    this.emailQueue = new Queue("email-queue", {
      redis: {
        host: process.env.REDIS_HOST || "redis",
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
      },
    });

    this.documentQueue = new Queue("document-queue", {
      redis: {
        host: process.env.REDIS_HOST || "redis",
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
      },
    });

    this.documentGenerator = new DocumentGenerator();

    try {
      this.emailService = new EmailService();
    } catch (error) {
      console.error("Failed to initialize EmailService:", error.message);
      this.emailService = null;
    }

    this.setupQueueHandlers();
  }

  async checkRedisConnection() {
    try {
      await this.emailQueue.isReady();

      return true;
    } catch (error) {
      console.error("Redis connection failed:", error.message);
      return false;
    }
  }

  setupQueueHandlers() {
    this.documentQueue.process("generate-documents", async (job) => {
      try {
        const { resumeId, format } = job.data;

        const resume = await Resume.findByPk(resumeId);
        if (!resume) {
          throw new Error("Resume not found");
        }

        const content = resume.updatedContent || resume.content;
        const baseFilename = resume.originalName.replace(".docx", "");

        let filePath;
        if (format === "pdf") {
          filePath = await this.documentGenerator.generatePDF(
            content,
            `${baseFilename}.pdf`
          );
        } else if (format === "docx") {
          filePath = await this.documentGenerator.generateDOCX(
            content,
            `${baseFilename}.docx`
          );
        } else {
          throw new Error("Unsupported format");
        }

        return { filePath, filename: filePath.split("/").pop() };
      } catch (error) {
        console.error("Document generation error:", error);
        throw error;
      }
    });

    this.emailQueue.process("send-resume-email", async (job) => {
      try {
        const { resumeId, userEmail, format } = job.data;

        const resume = await Resume.findByPk(resumeId);
        if (!resume) {
          throw new Error("Resume not found");
        }

        const user = await User.findByPk(resume.userId);
        if (!user) {
          throw new Error("User not found");
        }

        const content = resume.updatedContent || resume.content;
        const baseFilename = resume.originalName.replace(".docx", "");

        const documentPath = await this.documentGenerator.generateDOCX(
          content,
          `${baseFilename}.docx`
        );

        const attachments = await this.emailService.createAttachments([
          documentPath,
        ]);

        const emailData = {
          jobDescription:
            resume.jobDescription || "No job description provided",
          aiFeedback: resume.suggestions || "No AI feedback available",
          resumeContent: content,
        };

        if (!this.emailService) {
          throw new Error(
            "Email service not available - SendGrid API key may not be configured"
          );
        }

        const result = await this.emailService.sendResumeEmail(
          userEmail,
          emailData,
          attachments
        );

        try {
          await require("fs").promises.unlink(documentPath);
        } catch (cleanupError) {
          console.error("Error cleaning up file:", cleanupError);
        }

        return result;
      } catch (error) {
        console.error("Email sending error:", error);
        throw error;
      }
    });

    this.documentQueue.on("error", (error) => {
      console.error("Document queue error:", error);
    });

    this.emailQueue.on("error", (error) => {
      console.error("Email queue error:", error);
    });

    this.documentQueue.on("completed", (job, result) => {});

    this.emailQueue.on("completed", (job, result) => {});

    this.documentQueue.on("failed", (job, error) => {
      console.error(`Document generation failed for job ${job.id}:`, error);
    });

    this.emailQueue.on("failed", (job, error) => {
      console.error(`Email sending failed for job ${job.id}:`, error);
    });
  }

  async addDocumentGenerationTask(resumeId, format) {
    try {
      const job = await this.documentQueue.add(
        "generate-documents",
        {
          resumeId,
          format,
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        }
      );

      return job.id;
    } catch (error) {
      console.error("Error adding document generation task:", error);
      throw error;
    }
  }

  async addEmailTask(resumeId, userEmail, format) {
    try {
      const job = await this.emailQueue.add(
        "send-resume-email",
        {
          resumeId,
          userEmail,
          format,
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        }
      );

      return job.id;
    } catch (error) {
      console.error("Error adding email task:", error);
      throw error;
    }
  }

  async getJobStatus(queueName, jobId) {
    try {
      const queue =
        queueName === "document" ? this.documentQueue : this.emailQueue;
      const job = await queue.getJob(jobId);

      if (!job) {
        return { status: "not_found" };
      }

      const state = await job.getState();
      const progress = job._progress;
      const result = job.returnvalue;
      const failedReason = job.failedReason;

      return {
        status: state,
        progress,
        result,
        failedReason,
      };
    } catch (error) {
      console.error("Error getting job status:", error);
      throw error;
    }
  }

  async getQueueStats() {
    try {
      const [documentStats, emailStats] = await Promise.all([
        this.documentQueue.getJobCounts(),
        this.emailQueue.getJobCounts(),
      ]);

      return {
        document: documentStats,
        email: emailStats,
      };
    } catch (error) {
      console.error("Error getting queue stats:", error);
      throw error;
    }
  }
}

module.exports = TaskQueue;
