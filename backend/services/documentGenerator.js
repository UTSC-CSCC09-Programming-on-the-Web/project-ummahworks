const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} = require("docx");
const fs = require("fs").promises;
const path = require("path");

class DocumentGenerator {
  constructor() {
    this.uploadsDir = path.join(__dirname, "../uploads");
  }

  // Convert markdown to DOCX structure
  markdownToDocxStructure(markdown) {
    if (!markdown) return [];

    const lines = markdown.split("\n");
    const children = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) continue;

      // Headers
      if (line.startsWith("# ")) {
        children.push(
          new Paragraph({
            text: line.substring(2),
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
          })
        );
      } else if (line.startsWith("## ")) {
        children.push(
          new Paragraph({
            text: line.substring(3),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          })
        );
      } else if (line.startsWith("### ")) {
        children.push(
          new Paragraph({
            text: line.substring(4),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
          })
        );
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        // List items
        const text = line.substring(2);
        children.push(
          new Paragraph({
            text: text,
            bullet: { level: 0 },
            spacing: { before: 100, after: 100 },
          })
        );
      } else {
        // Regular paragraph
        children.push(
          new Paragraph({
            text: line,
            spacing: { before: 100, after: 100 },
          })
        );
      }
    }

    return children;
  }

  // Generate DOCX from markdown content
  async generateDOCX(markdown, filename) {
    try {
      const children = this.markdownToDocxStructure(markdown);

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: children,
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);

      const filePath = path.join(this.uploadsDir, filename);
      await fs.writeFile(filePath, buffer);

      return filePath;
    } catch (error) {
      console.error("Error generating DOCX:", error);
      throw new Error("Failed to generate DOCX");
    }
  }

  // Generate DOCX file
  async generateDocument(markdown, baseFilename) {
    const timestamp = Date.now();
    const docxFilename = `${baseFilename}_${timestamp}.docx`;

    try {
      const docxPath = await this.generateDOCX(markdown, docxFilename);
      return {
        docx: { path: docxPath, filename: docxFilename },
      };
    } catch (error) {
      console.error("Error generating document:", error);
      throw error;
    }
  }
}

module.exports = DocumentGenerator;
