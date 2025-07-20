import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class ApiService {
  private endpoint = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getHttpOptions() {
    return {
      withCredentials: true,
    };
  }

  checkHealth(): Observable<any> {
    return this.http.get(`${this.endpoint}/health`);
  }

  exchangeGoogleToken(idToken: string): Observable<any> {
    return this.http.post(
      `${this.endpoint}/auth/token`,
      { idToken },
      this.getHttpOptions()
    );
  }

  getCurrentUser(): Observable<any> {
    return this.http.get(`${this.endpoint}/auth/user`, this.getHttpOptions());
  }

  getDashboardData(): Observable<any> {
    return this.http.get(`${this.endpoint}/dashboard`, this.getHttpOptions());
  }

  logout(): Observable<any> {
    return this.http.post(
      `${this.endpoint}/auth/logout`,
      {},
      this.getHttpOptions()
    );
  }

  logoutAll(): Observable<any> {
    return this.http.post(
      `${this.endpoint}/auth/logout-all`,
      {},
      this.getHttpOptions()
    );
  }

  createCheckoutSession(): Observable<any> {
    return this.http.post(
      `${this.endpoint}/subscription/create-checkout`,
      {},
      this.getHttpOptions()
    );
  }
  syncSubscription(): Observable<any> {
    return this.http.post(
      `${this.endpoint}/test/sync-subscription`,
      {},
      this.getHttpOptions()
    );
  }

  // Simple file upload without database storage
  uploadResume(file: File): Observable<any> {
    const formData = new FormData();
    formData.append("resume", file);

    return this.http.post(`${this.endpoint}/resumes/upload`, formData, {
      headers: this.getAuthHeaders(),
    });
  }

  // Get uploaded file info (just returns file metadata)
  getUploadedResumes(): Observable<any> {
    return this.http.get(`${this.endpoint}/resumes`, {
      headers: this.getAuthHeaders(),
    });
  }

  getAISuggestions(prompt: string, token: string): Observable<any> {
    const url = `${this.endpoint}/ai/suggestions`;
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
    return this.http.post(url, { prompt }, { headers });
  }
}
