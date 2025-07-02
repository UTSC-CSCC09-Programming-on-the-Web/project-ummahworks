import { Routes } from "@angular/router";
import { LoginComponent } from "./pages/login/login.component";
import { DashboardComponent } from "./pages/dashboard/dashboard.component";
import { inject } from "@angular/core";
import { Router } from "@angular/router";

const authGuard = () => {
  const router = inject(Router);
  const isAuthenticated = !!localStorage.getItem("authToken");

  if (!isAuthenticated) {
    router.navigate(["/login"]);
    return false;
  }
  return true;
};

export const routes: Routes = [
  {
    path: "",
    redirectTo: "/dashboard",
    pathMatch: "full",
  },
  {
    path: "login",
    component: LoginComponent,
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
