import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthState } from '../../services/auth-state';
import { GoogleIdentity } from '../../services/google-identity';
import { Role } from '../../models/auth.model';

@Component({
  selector: 'app-signin',
  standalone: true,
  templateUrl: './signin.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Signin implements AfterViewInit {
  private readonly router = inject(Router);
  private readonly googleIdentity = inject(GoogleIdentity);
  protected readonly auth = inject(AuthState);

  private readonly googleButton = viewChild.required<ElementRef<HTMLDivElement>>('googleButton');
  protected readonly errorMessage = signal<string | null>(null);

  /**
   * The picker only ever registers a brand-new user - it's sent on every login, but the
   * backend ignores it once a user already has a role, so this default doesn't affect
   * returning users.
   */
  protected readonly selectedRole = signal<Exclude<Role, null>>('athlete');

  ngAfterViewInit(): void {
    this.googleIdentity.renderButton(this.googleButton().nativeElement, (credential) => {
      this.errorMessage.set(null);
      this.auth.loginWithGoogle(credential, this.selectedRole()).subscribe({
        next: () => this.router.navigateByUrl('/dashboard'),
        error: () => this.errorMessage.set("That Google account isn't authorized for Foot Strike."),
      });
    });
  }

  selectAthlete(): void {
    this.selectedRole.set('athlete');
  }

  selectCoach(): void {
    this.selectedRole.set('coach');
  }
}
