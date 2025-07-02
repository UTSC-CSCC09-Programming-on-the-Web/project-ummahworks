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

  ngOnInit(): void {
    const authToken = localStorage.getItem("authToken");
    if (!authToken) {
      this.router.navigate(["/login"]);
      return;
    }

    this.loadUserData();
    this.loadStats();
  }

  private loadUserData(): void {
    try {
      const userString = localStorage.getItem("user");
      if (userString) {
        this.user = JSON.parse(userString);
        this.loading = false;
      } else {
        this.api.getCurrentUser().subscribe({
          next: (user) => {
            this.user = user;
            this.loading = false;
          },
          error: () => {
            localStorage.removeItem("authToken");
            this.router.navigate(["/login"]);
          },
        });
      }
    } catch (error) {
      console.error("Error parsing user data", error);
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      this.router.navigate(["/login"]);
    }
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
        // Set up PDF preview
        const url = URL.createObjectURL(file);
        this.resumeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        console.log("Resume URL:", this.resumeUrl);
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
}
