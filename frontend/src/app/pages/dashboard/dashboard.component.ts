import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { CommonModule } from "@angular/common";
import { ApiService } from "../../services/api.service";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
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
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.api.getCurrentUser().subscribe({
      next: (user: any) => {
        this.user = user;
        localStorage.setItem("user", JSON.stringify(user));
        this.loading = false;
        this.loadResumes(); // Load resumes after user is authenticated
      },
      error: (err: any) => {
        console.error("Failed to get dashboard data:", err);
        localStorage.removeItem("user");
        localStorage.removeItem("authToken");
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
        // Set the most recent resume as the current one
        if (resumes.length > 0) {
          const latestResume = resumes[resumes.length - 1];
          this.uploadedFile = new File([], latestResume.originalName, {
            type: latestResume.fileType,
          });
          // Create a URL for the resume from the backend
          this.resumeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
            `/uploads/${latestResume.fileName}`,
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
    fileInput.accept = ".pdf";
    fileInput.addEventListener("change", (event: any) => {
      const file = event.target.files[0];
      if (file) {
        this.handleFileUpload(file);
      }
    });
    fileInput.click();
  }

  private handleFileUpload(file: File): void {
    const allowedTypes = ["application/pdf"];

    if (!allowedTypes.includes(file.type)) {
      this.uploadStatus = "Invalid file type. Please upload PDF files only.";
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
        const url = URL.createObjectURL(file);
        this.resumeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        console.log("Resume URL:", this.resumeUrl);
        this.loadResumes(); // Reload resumes from database after upload
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
    // Set this resume as the current one for viewing
    this.uploadedFile = new File([], resume.originalName, {
      type: resume.fileType,
    });
    this.resumeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `/uploads/${resume.fileName}`,
    );
  }

  deleteResume(resumeId: number): void {
    if (confirm("Are you sure you want to delete this resume?")) {
      this.api.deleteResume(resumeId).subscribe({
        next: () => {
          // Remove from local array
          this.resumes = this.resumes.filter((r) => r.id !== resumeId);
          this.hasActivity = this.resumes.length > 0;

          // If this was the currently viewed resume, clear the viewer
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
