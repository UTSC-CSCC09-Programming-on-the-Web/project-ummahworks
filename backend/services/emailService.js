const nodemailer = require("nodemailer");
const fs = require("fs").promises;

class EmailService {
  constructor() {
    // Check if SendGrid API key is configured
    if (!process.env.SENDGRID_API_KEY) {
      console.error("SENDGRID_API_KEY environment variable is not set");
      throw new Error("SendGrid API key not configured");
    }

    // Configure email transporter using SendGrid
    this.transporter = nodemailer.createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: "apikey", // This is the literal string 'apikey'
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  }

  // Send resume via email with attachments
  async sendResumeEmail(userEmail, resumeData, attachments = []) {
    try {
      const { jobDescription, aiFeedback, resumeContent } = resumeData;

      const mailOptions = {
        from: process.env.FROM_EMAIL || "noreply@tailorme.com",
        to: userEmail,
        subject: "Your Tailored Resume - TailorMe",
        html: this.generateEmailTemplate(jobDescription, aiFeedback),
        attachments: attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);

      return result;
    } catch (error) {
      console.error("Error sending email:", error);
      throw new Error("Failed to send email");
    }
  }

  // Generate HTML email template
  generateEmailTemplate(jobDescription, aiFeedback) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Tailored Resume</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #2d3748;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f7fafc;
            }
            .container {
              background: white;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #667eea;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              color: #667eea;
              margin-bottom: 10px;
            }
            .section {
              margin-bottom: 25px;
            }
            .section-title {
              font-size: 18px;
              font-weight: 600;
              color: #1a202c;
              margin-bottom: 10px;
            }
            .content {
              background: #f7fafc;
              padding: 15px;
              border-radius: 6px;
              border-left: 4px solid #667eea;
            }
            .attachments {
              background: #e6fffa;
              padding: 15px;
              border-radius: 6px;
              border-left: 4px solid #38b2ac;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e2e8f0;
              color: #718096;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">TailorMe</div>
              <h1>Your Tailored Resume is Ready!</h1>
            </div>

            <div class="section">
              <div class="section-title">Job Description</div>
              <div class="content">
                ${
                  jobDescription
                    ? jobDescription.replace(/\n/g, "<br>")
                    : "No job description provided"
                }
              </div>
            </div>

            ${
              aiFeedback
                ? `
            <div class="section">
              <div class="section-title">AI Feedback & Suggestions</div>
              <div class="content">
                ${aiFeedback.replace(/\n/g, "<br>")}
              </div>
            </div>
            `
                : ""
            }

            <div class="section">
              <div class="section-title">Attachments</div>
              <div class="attachments">
                <p>Your resume has been generated in DOCX format and is attached to this email.</p>
                <p><strong>Files included:</strong></p>
                <ul>
                  <li>Resume (DOCX format)</li>
                </ul>
              </div>
            </div>

            <div class="footer">
              <p>Thank you for using TailorMe!</p>
              <p>This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  // Create email attachments from file paths
  async createAttachments(filePaths) {
    const attachments = [];

    for (const filePath of filePaths) {
      try {
        const content = await fs.readFile(filePath);
        const filename = filePath.split("/").pop();

        attachments.push({
          filename: filename,
          content: content,
          contentType: this.getContentType(filename),
        });
      } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
      }
    }

    return attachments;
  }

  // Get content type based on file extension
  getContentType(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    const contentTypes = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword",
    };
    return contentTypes[ext] || "application/octet-stream";
  }
}

module.exports = EmailService;
