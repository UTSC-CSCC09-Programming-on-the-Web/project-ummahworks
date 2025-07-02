import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: true,
  imports: [CommonModule],
})
export class DashboardComponent implements OnInit {
  user: any = null;
  loading = true;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      const userString = localStorage.getItem('user');
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
            localStorage.removeItem('authToken');
            this.router.navigate(['/login']);
          },
        });
      }
    } catch (error) {
      console.error('Error parsing user data', error);
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      this.router.navigate(['/login']);
    }
  }
}
