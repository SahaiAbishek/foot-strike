import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthState } from '../../services/auth-state';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthState);

  get roleLabel(): string {
    return this.auth.role() === 'coach' ? 'Coach' : 'Athlete';
  }

  signOut(): void {
    this.auth.signOut().subscribe(() => this.router.navigateByUrl('/signin'));
  }
}
