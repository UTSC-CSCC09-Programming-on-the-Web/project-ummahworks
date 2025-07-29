import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { CommonModule } from "@angular/common";
import { ApiService } from "../../services/api.service";
import {
  DomSanitizer,
  SafeResourceUrl,
  SafeHtml,
} from "@angular/platform-browser";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-dashboard",
  templateUrl: "./dashboard.component.html",
  styleUrls: ["./dashboard.component.css"],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class DashboardComponent implements OnInit {
  user: any = null;
  loading = true;
  hasActivity = false;
  uploadedFile: File | null = null;
  uploadStatus: string = "";
  uploadProgress = false;
  resumes: any[] = [];
  currentResumeMarkdown: string = "";
  currentResumeHtml: SafeHtml = "";
  stats = {
    resumesCreated: 0,
    applicationsSubmitted: 0,
    interviewsScheduled: 0,
    successRate: 0,
  };
  resumeUrl: SafeResourceUrl | null = null;
  promptText: string = "";
  aiSuggestions: string = "";
  aiLoading: boolean = false;
  aiError: string = "";

  constructor(
    private api: ApiService,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  private convertMarkdownToHtml(markdown: string): string {
    if (!markdown) return "";

    let html = markdown
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\-/g, "-")
      .replace(/\\\./g, ".")
      .replace(/\\\|/g, "|")

      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")

      .replace(/^### (.*$)/gim, "<h3>$1</h3>")
      .replace(/^## (.*$)/gim, "<h2>$1</h2>")
      .replace(/^# (.*$)/gim, "<h1>$1</h1>")

      .replace(/^\* (.*$)/gim, "<li>$1</li>")
      .replace(/^- (.*$)/gim, "<li>$1</li>")

      .replace(/\n/g, "<br>");

    html = html.replace(
      /(<li>.*?<\/li>)(?:\s*<br>\s*<li>.*?<\/li>)*/gs,
      function (match) {
        return "<ul>" + match.replace(/<br>/g, "") + "</ul>";
      }
    );

    html = html.replace(/(?<!<[^>]*)_(?!<[^>]*>)/g, "");

    return html;
  }

  private formatResumeText(text: string): string {
    if (!text) return "";

    console.log("Raw markdown content:", text);

    let cleanedText = text;

    if (!text.includes("# ")) {
      const sections = text.split(/(\*\*[A-Z\s]+\*\*)/);
      const processedSections = sections.map((section, index) => {
        const trimmedSection = section.trim();

        if (
          index === 0 &&
          trimmedSection.includes("**") &&
          trimmedSection.includes("@")
        ) {
          const nameMatch = trimmedSection.match(/\*\*([^*]+)\*\*/);
          if (nameMatch) {
            const name = nameMatch[1].trim();
            const contactInfo = trimmedSection
              .replace(/\*\*[^*]+\*\*/, "")
              .trim();
            return `# ${name}\n\n${contactInfo}`;
          }
        }

        if (trimmedSection.match(/^\*\*[A-Z\s]+\*\*$/)) {
          const headerText = trimmedSection.replace(/\*\*/g, "").trim();
          return `\n## ${headerText}\n`;
        }

        if (
          trimmedSection.includes("**") &&
          trimmedSection.includes(" - ") &&
          trimmedSection.match(/\d{4}/)
        ) {
          const dateMatch = trimmedSection.match(/(\d{4})/);
          const dateStr = dateMatch ? dateMatch[1] : "";

          let titlePart = trimmedSection.replace(/\d{4}.*$/, "").trim();

          titlePart = titlePart
            .replace(/\*\*([^*]+)\*\*/g, "$1")
            .replace(/\*([^*]+)\*/g, "$1");

          return `\n### ${titlePart}\n${dateStr}\n`;
        }

        if (
          trimmedSection.includes("**") &&
          trimmedSection.includes("Sept") &&
          trimmedSection.includes("Dec")
        ) {
          const titleMatch = trimmedSection.match(/\*\*([^*]+)\*\*/);
          if (titleMatch) {
            const title = titleMatch[1].trim();
            const details = trimmedSection.replace(/\*\*[^*]+\*\*/, "").trim();
            return `\n### ${title}\n${details}\n`;
          }
        }

        return section;
      });

      cleanedText = processedSections.join("");
    }

    cleanedText = cleanedText
      .replace(/(\*\*[A-Z\s]+\*\*)/g, "\n$1\n")
      .replace(/(\*\*[^*]+\*\*)\s*\*\s*-\s*([^*]+)\*/g, "\n$1 - $2\n")
      .replace(/(\*\*[^*]+\*\*)\s*-\s*([^*]+)\s*(\d{4})/g, "\n$1 - $2\n$3\n")
      .replace(/(\*\*[^*]+\*\*)\s*(\d{4})/g, "\n$1\n$2\n")

      .replace(/(-\s*[^-]+?)\*\*([^*]+\*\*)/g, "$1\n\n**$2")
      .replace(
        /(-\s*[^-]+?)\*\*([^*]+\*\*)\s*\*\s*-\s*([^*]+)\*/g,
        "$1\n\n**$2** - $3"
      )
      .replace(
        /(-\s*[^-]+?)\*\*([^*]+\*\*)\s*-\s*([^*]+)\s*(\d{4})/g,
        "$1\n\n**$2** - $3\n$4"
      )
      .replace(/^###\s*-\s*/gm, "- ")
      .replace(/^###\s*([^*]+)\*\*([^*]+)\*\*/gm, "### $1**$2**")
      .replace(/\n\s*\n\s*\n/g, "\n\n")
      .replace(/\n\s*\n/g, "\n\n")
      .trim();

    const lines = cleanedText.split("\n");
    const processedLines = lines.map((line) => {
      let processedLine = line.trim();

      if (!processedLine) return "";

      if (processedLine.startsWith("# ")) {
        const headerText = processedLine.substring(2).trim();
        return `<h1 class="resume-name text-3xl font-bold text-gray-900 mb-4">${headerText}</h1>`;
      }

      if (processedLine.startsWith("## ")) {
        const headerText = processedLine.substring(3).trim();
        return `<h2 class="section-header text-2xl font-semibold text-gray-800 mt-6 mb-4 border-b-2 border-gray-300 pb-2">${headerText}</h2>`;
      }

      if (processedLine.startsWith("### ")) {
        const headerText = processedLine.substring(4).trim();
        return `<h3 class="job-title text-xl font-medium text-gray-700 mt-4 mb-2">${headerText}</h3>`;
      }

      if (
        processedLine.match(/^\*\*[A-Z\s]+\*\*$/) &&
        processedLine.length > 5
      ) {
        const headerText = processedLine.replace(/\*\*/g, "").trim();
        return `<h2 class="section-header text-2xl font-semibold text-gray-800 mt-6 mb-4 border-b-2 border-gray-300 pb-2">${headerText}</h2>`;
      }

      if (
        processedLine.includes("**") &&
        processedLine.includes(" - ") &&
        processedLine.match(/\d{4}/)
      ) {
        const dateMatch = processedLine.match(/(\d{4})/);
        const dateStr = dateMatch ? dateMatch[1] : "";

        let titlePart = processedLine.replace(/\d{4}.*$/, "").trim();

        titlePart = titlePart
          .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
          .replace(/\*([^*]+)\*/g, "<em>$1</em>");

        return `<h3 class="job-title text-xl font-medium text-gray-700 mt-4 mb-2">${titlePart}</h3><p class="dates text-sm text-gray-600 mb-2">${dateStr}</p>`;
      }

      if (processedLine.startsWith("- ")) {
        let content = processedLine.substring(2).trim();

        content = content
          .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
          .replace(/\*([^*]+)\*/g, "<em>$1</em>");

        return `<li class="mb-1 text-gray-700">${content}</li>`;
      }

      if (processedLine) {
        processedLine = processedLine
          .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
          .replace(/\*([^*]+)\*/g, "<em>$1</em>");

        return `<p class="mb-2 text-gray-700">${processedLine}</p>`;
      }

      return "";
    });

    let html = processedLines.join("");

    html = html.replace(
      /(<li class="mb-1 text-gray-700">.*?<\/li>)(?:\s*<li class="mb-1 text-gray-700">.*?<\/li>)*/gs,
      function (match) {
        return '<ul class="list-disc list-inside mb-4 ml-4">' + match + "</ul>";
      }
    );

    console.log("Generated HTML:", html);
    return html;
  }

  private updateResumeDisplay(markdown: string): void {
    this.currentResumeMarkdown = markdown;
    const html = this.formatResumeText(markdown);
    this.currentResumeHtml = this.sanitizer.bypassSecurityTrustHtml(html);
  }

  ngOnInit(): void {
    const authToken = localStorage.getItem("authToken");
    if (!authToken) {
      this.router.navigate(["/login"]);
      return;
    }
    this.loading = true;
    this.api.getCurrentUser().subscribe({
      next: (user: any) => {
        this.user = user;
        localStorage.setItem("user", JSON.stringify(user));
        this.loading = false;
        this.loadResumes();
      },
      error: (err: any) => {
        console.error("Failed to get dashboard data:", err);
        localStorage.removeItem("user");
        if (err.status === 402) {
          this.router.navigate(["/payment"]);
        } else {
          this.router.navigate(["/login"]);
        }
      },
    });
    this.loadStats();
  }

  private loadStats(): void {
    setTimeout(() => {
      this.stats = {
        resumesCreated: 5,
        applicationsSubmitted: 12,
        interviewsScheduled: 3,
        successRate: 25,
      };
    }, 1000);
  }

  private loadResumes(): void {
    this.api.getUploadedResumes().subscribe({
      next: (resumes: any[]) => {
        this.resumes = resumes;
        this.hasActivity = resumes.length > 0;
        if (resumes.length > 0) {
          const latestResume = resumes[resumes.length - 1];
          this.uploadedFile = new File([], latestResume.originalName, {
            type: latestResume.fileType,
          });
          this.resumeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
            `${this.api.endpoint}/uploads/${latestResume.fileName}`
          );
        }
      },
      error: (error) => {
        console.error("Failed to load resumes:", error);
      },
    });
  }

  onUploadResume(): void {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".docx";
    fileInput.addEventListener("change", (event: any) => {
      const file = event.target.files[0];
      if (file) {
        this.handleFileUpload(file);
      }
    });
    fileInput.click();
  }

  private handleFileUpload(file: File): void {
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      this.uploadStatus = "Invalid file type. Please upload DOCX files only.";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.uploadStatus =
        "File too large. Please upload files smaller than 5MB.";
      return;
    }

    this.uploadProgress = true;
    this.uploadStatus = "Uploading...";

    this.api.uploadResume(file).subscribe({
      next: (response) => {
        this.uploadedFile = file;
        this.uploadStatus = "File uploaded successfully!";
        this.uploadProgress = false;
        this.hasActivity = true;

        if (response.resume && response.resume.content) {
          this.currentResumeMarkdown = response.resume.content;
          this.updateResumeDisplay(this.currentResumeMarkdown);
        }

        const url = URL.createObjectURL(file);
        this.resumeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        console.log("Resume URL:", this.resumeUrl);
        this.loadResumes();
      },
      error: (error) => {
        this.uploadStatus = `Upload failed: ${
          error.error?.message || "Unknown error"
        }`;
        this.uploadProgress = false;
        console.error("Upload error:", error);
      },
    });
  }

  onViewFile(): void {
    if (this.uploadedFile) {
      const url = URL.createObjectURL(this.uploadedFile);
      window.open(url, "_blank");

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    }
  }

  onCreateNew(): void {
    console.log("Create new resume clicked");
  }

  onViewTemplates(): void {
    console.log("View templates clicked");
  }

  onViewAllActivity(): void {
    console.log("View all activity clicked");
  }

  getAISuggestions() {
    this.aiSuggestions = "";
    this.aiError = "";
    this.aiLoading = true;
    const token = localStorage.getItem("authToken") || "";
    this.api.getAISuggestions(this.promptText, token).subscribe({
      next: (res) => {
        this.aiSuggestions = res.suggestions || JSON.stringify(res);
        this.aiLoading = false;
      },
      error: (err) => {
        this.aiError = err.error?.message || "Failed to get suggestions.";
        this.aiLoading = false;
      },
    });
  }

  viewResume(resume: any): void {
    this.uploadedFile = new File([], resume.originalName, {
      type: resume.fileType,
    });
    this.resumeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `${this.api.endpoint}/uploads/${resume.fileName}`
    );

    this.api.getResumeMarkdown(resume.id).subscribe({
      next: (response) => {
        this.currentResumeMarkdown = response.content || "";
        this.updateResumeDisplay(this.currentResumeMarkdown);
      },
      error: (error) => {
        console.error("Failed to fetch resume markdown:", error);
        this.currentResumeMarkdown = "";
      },
    });
  }

  deleteResume(resumeId: number): void {
    if (confirm("Are you sure you want to delete this resume?")) {
      this.api.deleteResume(resumeId).subscribe({
        next: () => {
          this.resumes = this.resumes.filter((r) => r.id !== resumeId);
          this.hasActivity = this.resumes.length > 0;

          if (this.uploadedFile && this.resumes.length === 0) {
            this.uploadedFile = null;
            this.resumeUrl = null;
          }
        },
        error: (error) => {
          console.error("Failed to delete resume:", error);
          alert("Failed to delete resume. Please try again.");
        },
      });
    }
  }
}
