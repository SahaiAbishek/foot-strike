import { Injectable } from '@angular/core';
import { GOOGLE_CLIENT_ID } from '../config/api';

declare const google: {
  accounts: {
    id: {
      initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void;
      renderButton(container: HTMLElement, options: Record<string, unknown>): void;
    };
  };
};

const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

@Injectable({ providedIn: 'root' })
export class GoogleIdentity {
  private scriptPromise: Promise<void> | null = null;
  private initialized = false;

  /** Renders Google's own "Sign in with Google" button into `container` and reports the ID token on click. */
  async renderButton(container: HTMLElement, onCredential: (credential: string) => void): Promise<void> {
    await this.loadScript();

    if (!this.initialized) {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onCredential(response.credential),
      });
      this.initialized = true;
    }

    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      width: 320,
    });
  }

  private loadScript(): Promise<void> {
    if (!this.scriptPromise) {
      this.scriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
        document.head.appendChild(script);
      });
    }
    return this.scriptPromise;
  }
}
