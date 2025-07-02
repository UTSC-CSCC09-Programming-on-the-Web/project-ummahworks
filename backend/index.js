const express = require("express");
const cors = require("cors");
const { OAuth2Client } = require("google-auth-library");
const { google } = require("googleapis");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:80",
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json());

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.FRONTEND_URL || "http://localhost:80"}/auth/callback`
);

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }

    req.user = user;
    next();
  });
};

app.get("/api/health", (req, res) => {
  res.json({ status: "Backend is running!" });
});

app.post("/api/auth/token", async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: "Missing ID token" });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const userId = payload["sub"];

    if (!userId) {
      return res.status(401).json({ error: "Invalid ID token" });
    }

    const user = {
      id: userId,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };

    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "24h" });

    res.json({
      token,
      user,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(401).json({ error: "Invalid ID token" });
  }
});

app.get("/api/auth/user", authenticateToken, (req, res) => {
  res.json(req.user);
});

app.post("/api/auth/logout", authenticateToken, (req, res) => {
  res.json({ message: "Logged out successfully" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
