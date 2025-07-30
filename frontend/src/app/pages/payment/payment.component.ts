import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { ApiService } from "../../services/api.service";

@Component({
  selector: "app-payment",
  templateUrl: "./payment.component.html",
  styleUrls: ["./payment.component.css"],
  standalone: true,
  imports: [CommonModule],
})
export class PaymentComponent implements OnInit {
  loading = false;
  errorMessage = "";

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.api.getCurrentUser().subscribe({
      next: (user: any) => {
        if (user.subscription && user.subscription.isActive) {
          this.router.navigate(["/dashboard"]);
        }
      },
      error: (err: any) => {
        console.error("Error checking user status:", err);
        if (err.status !== 402) {
          this.router.navigate(["/login"]);
        }
      },
    });
  }

  startCheckout(): void {
    this.loading = true;
    this.errorMessage = "";

    this.api.createCheckoutSession().subscribe({
      next: (response) => {
        window.location.href = response.url;
      },
      error: (err) => {
        console.error("Checkout error:", err);
        this.errorMessage =
          err.error?.error || "Failed to start checkout process";
        this.loading = false;
      },
    });
  }

  logout(): void {
    this.api.logout().subscribe({
      next: () => {
        this.clearAuthData();
      },
      error: () => {
        this.clearAuthData();
      },
    });
  }

  private clearAuthData(): void {
    localStorage.removeItem("user");
    localStorage.removeItem("authToken");
    this.router.navigate(["/login"]);
  }
}
