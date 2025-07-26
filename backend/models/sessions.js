const { sequelize } = require("../datasource.js");
const { DataTypes } = require("sequelize");

const Session = sequelize.define(
  "Session",
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "expires_at",
    },
  },
  {
    tableName: "sessions",
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
);

module.exports = { Session };
