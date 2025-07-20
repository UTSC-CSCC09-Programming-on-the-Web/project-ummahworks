import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";

@Component({
  selector: "app-payment-success",
  templateUrl: "./success.component.html",
  styleUrls: ["./success.component.css"],
  standalone: true,
  imports: [CommonModule],
})
export class PaymentSuccessComponent implements OnInit {
  countdown = 5;

  constructor(private router: Router) {}

  ngOnInit(): void {
    const timer = setInterval(() => {
      this.countdown--;
      if (this.countdown === 0) {
        clearInterval(timer);
        this.router.navigate(["/dashboard"]);
      }
    }, 1000);
  }

  goToDashboard(): void {
    this.router.navigate(["/dashboard"]);
  }
}
