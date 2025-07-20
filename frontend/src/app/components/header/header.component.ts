import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { ApiService } from "../../services/api.service";

@Component({
  selector: "app-header",
  templateUrl: "./header.component.html",
  styleUrls: ["./header.component.css"],
  standalone: true,
  imports: [CommonModule, RouterModule],
})
export class HeaderComponent implements OnInit {
  isAuthenticated = false;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.api.getCurrentUser().subscribe({
      next: () => {
        this.isAuthenticated = true;
      },
      error: () => {
        this.isAuthenticated = false;
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
    this.isAuthenticated = false;
    this.router.navigate(["/login"]);
  }
}
