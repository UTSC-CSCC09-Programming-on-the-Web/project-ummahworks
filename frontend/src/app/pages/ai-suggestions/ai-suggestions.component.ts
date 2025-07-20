import { Component } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-ai-suggestions',
  templateUrl: './ai-suggestions.component.html',
  styleUrls: ['./ai-suggestions.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class AiSuggestionsComponent {
  prompt: string = '';
  suggestions: string = '';
  loading: boolean = false;
  error: string = '';

  constructor(private api: ApiService) {}

  getSuggestions() {
    this.suggestions = '';
    this.error = '';
    this.loading = true;
    const token = localStorage.getItem('authToken') || '';
    this.api.getAISuggestions(this.prompt, token).subscribe({
      next: (res) => {
        this.suggestions = res.suggestions || JSON.stringify(res);
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to get suggestions.';
        this.loading = false;
      }
    });
  }
} 