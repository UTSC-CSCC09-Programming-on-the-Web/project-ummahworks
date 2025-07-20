const { DataTypes } = require("sequelize");
const { sequelize } = require("../datasource");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    googleId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: "google_id",
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    picture: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    jobDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "job_description",
    },
    masterResumeUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "master_resume_url",
    },
    masterResumeFilename: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "master_resume_filename",
    },
    stripeCustomerId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      field: "stripe_customer_id",
    },
    lastPaid: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "last_paid",
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "last_login",
    },
  },
  {
    tableName: "users",
    timestamps: true,
  }
);

module.exports = { User };
