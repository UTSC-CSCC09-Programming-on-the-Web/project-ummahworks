const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { User } = require("../models/users");
const {
  authenticateToken,
  requireActiveSubscription,
} = require("../middleware/auth");

const router = express.Router();

router.post("/create-checkout", authenticateToken, async (req, res) => {
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
});

router.get(
  "/dashboard",
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

module.exports = router;
