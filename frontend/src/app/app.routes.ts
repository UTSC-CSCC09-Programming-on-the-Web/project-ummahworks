import { Routes } from "@angular/router";
import { LoginComponent } from "./pages/login/login.component";
import { DashboardComponent } from "./pages/dashboard/dashboard.component";
import { PaymentComponent } from "./pages/payment/payment.component";
import { PaymentSuccessComponent } from "./pages/payment/success/success.component";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { ApiService } from "./services/api.service";
import { map, catchError, of } from "rxjs";

const authGuard = () => {
  const router = inject(Router);
  const api = inject(ApiService);

  return api.getCurrentUser().pipe(
    map(() => true),
    catchError((err) => {
      if (err.status === 402) {
        router.navigate(["/payment"]);
        return of(false);
      }
      router.navigate(["/login"]);
      return of(false);
    }),
  );
};

export const routes: Routes = [
  {
    path: "",
    redirectTo: "/login",
    pathMatch: "full",
  },
  {
    path: "login",
    component: LoginComponent,
  },
  {
    path: "payment",
    component: PaymentComponent,
    canActivate: [authGuard],
  },
  {
    path: "payment/success",
    component: PaymentSuccessComponent,
    canActivate: [authGuard],
  },
  {
    path: "dashboard",
    component: DashboardComponent,
    canActivate: [authGuard],
  },
  {
    path: "**",
    redirectTo: "/login",
  },
];
