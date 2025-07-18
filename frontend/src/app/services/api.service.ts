import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class ApiService {
  private endpoint = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem("authToken");
    return new HttpHeaders().set("Authorization", `Bearer ${token}`);
  }

  checkHealth(): Observable<any> {
    return this.http.get(`${this.endpoint}/health`);
  }

  getGoogleAuthUrl(): Observable<any> {
    return this.http.get(`${this.endpoint}/auth/google`);
  }

  handleGoogleCallback(code: string): Observable<any> {
    return this.http.post(`${this.endpoint}/auth/google/callback`, { code });
  }

  exchangeGoogleToken(idToken: string): Observable<any> {
    return this.http.post(`${this.endpoint}/auth/token`, { idToken });
  }

  getCurrentUser(): Observable<any> {
    return this.http.get(`${this.endpoint}/auth/user`, {
      headers: this.getAuthHeaders(),
    });
  }

  logout(): Observable<any> {
    return this.http.post(
      `${this.endpoint}/auth/logout`,
      {},
      {
        headers: this.getAuthHeaders(),
      }
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
