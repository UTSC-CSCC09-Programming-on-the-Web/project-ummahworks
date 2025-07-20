import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { CommonModule } from "@angular/common";
import { ApiService } from "../../services/api.service";

@Component({
  selector: "app-dashboard",
  templateUrl: "./dashboard.component.html",
  styleUrls: ["./dashboard.component.css"],
  standalone: true,
  imports: [CommonModule],
})
export class DashboardComponent implements OnInit {
  user: any = null;
  loading = true;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.loading = true;

    this.api.getDashboardData().subscribe({
      next: (user) => {
        this.user = user;
        localStorage.setItem("user", JSON.stringify(user));
        this.loading = false;
      },
      error: (err) => {
        console.error("Failed to get dashboard data:", err);
        localStorage.removeItem("user");
        if (err.status === 402) {
          this.router.navigate(["/payment"]);
        } else {
          this.router.navigate(["/login"]);
        }
      },
    });
  }

  syncSubscription(): void {
    this.api.syncSubscription().subscribe({
      next: (result) => {
        console.log("Sync result:", result);
        alert("Sync completed! Check console for details.");
        window.location.reload();
      },
      error: (err) => {
        console.error("Sync failed:", err);
        alert("Sync failed! Check console for details.");
      },
    });
  }
}
