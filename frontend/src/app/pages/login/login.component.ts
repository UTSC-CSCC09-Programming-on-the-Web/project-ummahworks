import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { Router } from "@angular/router";
import { ApiService } from "../../services/api.service";
import { environment } from "../../../environments/environment";

declare const google: any;

@Component({
  selector: "app-login",
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.css"],
  standalone: true,
  imports: [CommonModule, RouterModule],
})
export class LoginComponent implements OnInit {
  errorMessage: string = "";
  loading: boolean = false;

  constructor(
    private api: ApiService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.api.getCurrentUser().subscribe({
      next: (user) => {
        this.router.navigate(["/dashboard"]);
      },
      error: (error) => {
        this.initializeGoogleSignIn();
      },
    });
  }

  private initializeGoogleSignIn(): void {
    if (typeof google !== "undefined") {
      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: this.handleGoogleResponse.bind(this),
      });

      google.accounts.id.renderButton(
        document.getElementById("google-signin-button"),
        {
          theme: "outline",
          size: "large",
          width: 300,
          text: "signin_with",
        },
      );
    } else {
      setTimeout(() => this.initializeGoogleSignIn(), 100);
    }
  }

  private handleGoogleResponse(response: any): void {
    this.loading = true;
    this.errorMessage = "";

    this.api.exchangeGoogleToken(response.credential).subscribe({
      next: (authResponse) => {
        localStorage.setItem("user", JSON.stringify(authResponse.user));

        if (authResponse.subscription) {
          if (authResponse.subscription.isActive) {
            this.router.navigate(["/dashboard"]);
          } else {
            this.router.navigate(["/payment"]);
          }
        } else {
          this.router.navigate(["/payment"]);
        }
      },
      error: (err) => {
        if (err.status === 429) {
          this.errorMessage =
            "Too many login attempts. Please try again later.";
        } else if (err.status === 401) {
          this.errorMessage = "Authentication failed. Please try again.";
        } else if (err.status === 0) {
          this.errorMessage =
            "Unable to connect to server. Please check your internet connection.";
        } else {
          this.errorMessage =
            err.error?.error || "Login failed. Please try again.";
        }

        this.loading = false;
      },
    });
  }
}
