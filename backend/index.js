const express = require("express");
const cors = require("cors");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const { sequelize } = require("./datasource");
const { User } = require("./models/users");
const { Session } = require("./models/sessions");
const { Resume } = require("./models/Resume");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const { body, validationResult } = require("express-validator");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const OpenAI = require("openai");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === "invoice.paid") {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const [updated] = await User.update(
          { lastPaid: new Date() },
          { where: { stripeCustomerId: customerId } }
        );
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

app.use(express.json());
app.use(cookieParser());

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

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
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only DOCX files are allowed."), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || "http://localhost:80",
    "http://localhost",
    "http://localhost:80",
    "http://127.0.0.1:80",
    "http://127.0.0.1",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  exposedHeaders: ["Set-Cookie"],
};
app.use(cors(corsOptions));

User.hasMany(Session, { foreignKey: "userId" });
Session.belongsTo(User, { foreignKey: "userId", onDelete: "CASCADE" });
User.hasMany(Resume, { foreignKey: "userId" });
Resume.belongsTo(User, { foreignKey: "userId" });

const connectWithRetry = async (maxRetries = 10, delay = 2000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await sequelize.authenticate();

      return;
    } catch (error) {
      console.error(
        `Database connection attempt ${i + 1} failed:`,
        error.message
      );
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          "Unable to connect to the database after all retries:",
          error
        );
        process.exit(1);
      }
    }
  }
};

(async () => {
  await connectWithRetry();
})();

const {
  authenticateToken,
  requireActiveSubscription,
} = require("./middleware/auth");

app.post("/api/ai/suggestions", authenticateToken, async (req, res) => {
  const { prompt, resumeId } = req.body;

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

app.get("/api/health", (req, res) => {
  res.json({ status: "Backend is running!" });
});

app.post(
  "/api/auth/token",
  body("idToken").isLength({ min: 1 }).withMessage("ID token is required"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Invalid request",
        details: errors.array(),
      });
    }

    const { idToken } = req.body;

    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      const googleId = payload["sub"];

      if (!googleId) {
        return res.status(401).json({ error: "Invalid ID token" });
      }

      const userData = {
        googleId,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      };

      let user = await User.findOne({ where: { googleId } });
      const now = new Date();

      if (!user) {
        user = await User.create({
          ...userData,
          lastLogin: now,
        });
      } else {
        await User.update(
          {
            lastLogin: now,
            name: userData.name,
            picture: userData.picture,
          },
          { where: { id: user.id } }
        );
        user = await User.findByPk(user.id);
      }

      const hasActiveSubscription =
        user.lastPaid &&
        user.lastPaid > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const tokenPayload = {
        userId: user.id,
        googleId: user.googleId,
        email: user.email,
        sessionId: crypto.randomUUID(),
      };

      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
        expiresIn: "24h",
      });

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await Session.create({
        id: crypto.randomUUID(),
        token,
        userId: user.id,
        expiresAt,
      });

      res.cookie("authToken", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
        path: "/",
        domain: "localhost",
      });

      const userSessions = await Session.findAll({
        where: { userId: user.id },
        order: [["createdAt", "DESC"]],
        offset: 5,
      });

      if (userSessions.length > 0) {
        await Session.destroy({
          where: { id: userSessions.map((s) => s.id) },
        });
      }

      const responseUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      };

      res.json({
        user: responseUser,
        expiresAt: expiresAt.getTime(),
        subscription: {
          hasSubscription: hasActiveSubscription,
          isActive: hasActiveSubscription,
          needsSubscription: !hasActiveSubscription,
          lastPaid: user.lastPaid,
        },
      });
    } catch (error) {
      console.error("Authentication error:", error);
      res.status(401).json({ error: "Authentication failed" });
    }
  }
);

app.get("/api/auth/user", authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: [
        "id",
        "email",
        "name",
        "picture",
        "jobDescription",
        "masterResumeUrl",
        "masterResumeFilename",
        "lastPaid",
        "createdAt",
        "lastLogin",
      ],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const hasActiveSubscription =
      user.lastPaid &&
      user.lastPaid > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    res.json({
      ...user.toJSON(),
      subscription: {
        hasSubscription: hasActiveSubscription,
        isActive: hasActiveSubscription,
        needsSubscription: !hasActiveSubscription,
        lastPaid: user.lastPaid,
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post(
  "/api/subscription/create-checkout",
  authenticateToken,
  async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id);

      let customer;
      if (user.stripeCustomerId) {
        customer = await stripe.customers.retrieve(user.stripeCustomerId);
      } else {
        customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
        });

        await User.update(
          { stripeCustomerId: customer.id },
          { where: { id: user.id } }
        );
      }

      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ["card"],
        line_items: [
          {
            price: process.env.STRIPE_PRICE_ID,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${process.env.FRONTEND_URL}/payment/success`,
        cancel_url: `${process.env.FRONTEND_URL}/payment`,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Checkout session creation error:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  }
);

app.get(
  "/api/dashboard",
  authenticateToken,
  requireActiveSubscription,
  async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: [
          "id",
          "email",
          "name",
          "picture",
          "jobDescription",
          "masterResumeUrl",
          "masterResumeFilename",
          "createdAt",
          "lastLogin",
        ],
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.post("/api/auth/logout", authenticateToken, async (req, res) => {
  try {
    await Session.destroy({ where: { id: req.sessionId } });

    res.clearCookie("authToken", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      domain: "localhost",
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

app.post("/api/auth/logout-all", authenticateToken, async (req, res) => {
  try {
    await Session.destroy({
      where: { userId: req.user.id },
    });

    res.clearCookie("authToken", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      domain: "localhost",
    });

    res.json({ message: "Logged out from all devices successfully" });
  } catch (error) {
    console.error("Logout all error:", error);
    res.status(500).json({ error: "Logout from all devices failed" });
  }
});

app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON in request body" });
  }

  res.status(500).json({ error: "Internal server error" });
});

const resumesRouter = require("./routers/resumes");
app.use("/api/resumes", resumesRouter);

app.use("/uploads", express.static(uploadsDir));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {});

app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

process.on("SIGINT", async () => {
  await sequelize.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await sequelize.close();
  process.exit(0);
});
