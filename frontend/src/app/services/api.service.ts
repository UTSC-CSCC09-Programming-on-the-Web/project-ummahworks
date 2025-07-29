import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class ApiService {
  public endpoint = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getHttpOptions() {
    return {
      withCredentials: true,
    };
  }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem("authToken");
    return new HttpHeaders().set("Authorization", `Bearer ${token}`);
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

    return this.http.post(`${this.endpoint}/resumes/upload`, formData, this.getHttpOptions());
  }

  // Get uploaded file info (just returns file metadata)
  getUploadedResumes(): Observable<any> {
    return this.http.get(`${this.endpoint}/resumes`, this.getHttpOptions());
  }

  // Get markdown content for a specific resume
  getResumeMarkdown(resumeId: number): Observable<any> {
    return this.http.get(`${this.endpoint}/resumes/${resumeId}/markdown`, {
      headers: this.getAuthHeaders(),
    });
  }

  // Delete a resume
  deleteResume(resumeId: number): Observable<any> {
    return this.http.delete(`${this.endpoint}/resumes/${resumeId}`, this.getHttpOptions());
  }

  getAISuggestions(prompt: string, token: string): Observable<any> {
    const url = `${this.endpoint}/ai/suggestions`;
    return this.http.post(url, { prompt }, this.getHttpOptions());
  }
}
