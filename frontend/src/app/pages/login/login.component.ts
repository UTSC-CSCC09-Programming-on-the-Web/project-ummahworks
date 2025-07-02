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

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    if (localStorage.getItem("authToken")) {
      this.router.navigate(["/dashboard"]);
      return;
    }

    this.initializeGoogleSignIn();
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
          width: "100%",
          text: "signin_with",
        }
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
        localStorage.setItem("authToken", authResponse.token);
        localStorage.setItem("user", JSON.stringify(authResponse.user));
        this.router.navigate(["/dashboard"]);
      },
      error: (err) => {
        this.errorMessage =
          err.error?.message || "Authentication failed. Please try again.";
        this.loading = false;
      },
    });
  }
}
