const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const crypto = require("crypto");
const { User } = require("../models/users");
const { Session } = require("../models/sessions");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post(
  "/token",
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

router.get("/user", authenticateToken, async (req, res) => {
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

router.post("/logout", authenticateToken, async (req, res) => {
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

router.post("/logout-all", authenticateToken, async (req, res) => {
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

module.exports = router;
