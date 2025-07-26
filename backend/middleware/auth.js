const jwt = require("jsonwebtoken");
const { User } = require("../models/users");
const { Session } = require("../models/sessions");

const authenticateToken = async (req, res, next) => {
  let token = req.cookies?.authToken;

  if (!token) {
    const authHeader = req.headers["authorization"];
    token = authHeader && authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const session = await Session.findOne({
      where: { token },
      include: [{ model: User }],
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) await Session.destroy({ where: { id: session.id } });
      return res.status(403).json({ error: "Session expired" });
    }

    req.user = {
      id: session.User.id,
      googleId: session.User.googleId,
      email: session.User.email,
      name: session.User.name,
      picture: session.User.picture,
    };
    req.sessionId = session.id;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

const requireActiveSubscription = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user.lastPaid) {
      return res.status(402).json({
        error: "Subscription required",
        needsSubscription: true,
      });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (user.lastPaid < thirtyDaysAgo) {
      return res.status(402).json({
        error: "Subscription expired",
        needsSubscription: true,
      });
    }

    next();
  } catch (error) {
    console.error("Subscription check error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { authenticateToken, requireActiveSubscription };
