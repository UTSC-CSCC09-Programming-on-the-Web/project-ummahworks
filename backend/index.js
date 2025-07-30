const express = require("express");
const cors = require("cors");
const { sequelize } = require("./datasource");
const cookieParser = require("cookie-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const path = require("path");
const fs = require("fs");

require("dotenv").config();

const authRoutes = require("./routers/auth");
const paymentRoutes = require("./routers/payment");
const resumeRoutes = require("./routers/resumes");

const app = express();

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

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use("/api/auth", authRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/uploads", express.static(uploadsDir));

const { User } = require("./models/users");
const { Session } = require("./models/sessions");
const { Resume } = require("./models/Resume");

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

app.get("/api/health", (req, res) => {
  res.json({ status: "Backend is running!" });
});

app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON in request body" });
  }

  res.status(500).json({ error: "Internal server error" });
});

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
