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
    return this.http.get(
      `${this.endpoint}/payment/dashboard`,
      this.getHttpOptions()
    );
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
      `${this.endpoint}/payment/create-checkout`,
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

  uploadResume(file: File): Observable<any> {
    const formData = new FormData();
    formData.append("resume", file);

    return this.http.post(
      `${this.endpoint}/resumes/upload`,
      formData,
      this.getHttpOptions()
    );
  }

  getUploadedResumes(): Observable<any> {
    return this.http.get(`${this.endpoint}/resumes`, this.getHttpOptions());
  }

  getResumeMarkdown(resumeId: number): Observable<any> {
    return this.http.get(`${this.endpoint}/resumes/${resumeId}/markdown`, {
      headers: this.getAuthHeaders(),
    });
  }

  deleteResume(resumeId: number): Observable<any> {
    return this.http.delete(
      `${this.endpoint}/resumes/${resumeId}`,
      this.getHttpOptions()
    );
  }

  getAISuggestions(prompt: string, resumeId?: number): Observable<any> {
    const url = `${this.endpoint}/resumes/ai/suggestions`;
    const payload = resumeId ? { prompt, resumeId } : { prompt };
    return this.http.post(url, payload, this.getHttpOptions());
  }

  getUpdatedResume(resumeId: number): Observable<any> {
    return this.http.get(
      `${this.endpoint}/resumes/${resumeId}/updated`,
      this.getHttpOptions()
    );
  }

  downloadResumeAsDocx(resumeId: number): Observable<any> {
    return this.http.get(`${this.endpoint}/resumes/${resumeId}/download/docx`, {
      ...this.getHttpOptions(),
      responseType: "blob",
    });
  }

  sendResumeEmail(
    resumeId: number,
    emailData: { userEmail: string; format: string }
  ): Observable<any> {
    return this.http.post(
      `${this.endpoint}/resumes/${resumeId}/email`,
      emailData,
      this.getHttpOptions()
    );
  }
}
