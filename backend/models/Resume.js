const { DataTypes } = require("sequelize");
const { sequelize } = require("../datasource");

const Resume = sequelize.define(
  "Resume",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: "user_id" },
    fileName: { type: DataTypes.STRING, allowNull: false, field: "file_name" },
    originalName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "original_name",
    },
    fileSize: { type: DataTypes.INTEGER, allowNull: false, field: "file_size" },
    fileType: { type: DataTypes.STRING, allowNull: false, field: "file_type" },
    filePath: { type: DataTypes.TEXT, allowNull: false, field: "file_path" },
    content: { type: DataTypes.TEXT, allowNull: true, field: "content" },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: "updated_at",
    },
  },
  {
    tableName: "resumes",
    timestamps: false,
  },
);

module.exports = { Resume };
