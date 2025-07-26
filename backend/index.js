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
          { where: { stripeCustomerId: customerId } },
        );
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  },
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
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
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

(async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection established successfully.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    process.exit(1);
  }
})();

const {
  authenticateToken,
  requireActiveSubscription,
} = require("./middleware/auth");

app.post("/api/ai/suggestions", authenticateToken, async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const response = await openai.completions.create({
      model: "gpt-3.5-turbo-instruct",
      prompt: `Analyze this resume and suggest keywords to add: ${prompt}`,
      max_tokens: 150,
    });

    res.json({ suggestions: response.choices[0].text.trim() });
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
          { where: { id: user.id } },
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
  },
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
          { where: { id: user.id } },
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
  },
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
  },
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
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});

app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  await sequelize.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down gracefully...");
  await sequelize.close();
  process.exit(0);
});
