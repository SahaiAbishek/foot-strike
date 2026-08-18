import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthState } from '../../services/auth-state';

@Component({
  selector: 'app-settings',
  standalone: true,
  templateUrl: './settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  protected readonly auth = inject(AuthState);

  get roleLabel(): string {
    return this.auth.role() === 'coach' ? 'Coach' : 'Athlete';
  }

  toggleStrava(): void {
    this.auth.toggleStrava();
  }

  toggleWeeklyEmail(): void {
    this.auth.toggleWeeklyEmail();
  }

  toggleGroupReminders(): void {
    this.auth.toggleGroupReminders();
  }

  toggleUnit(): void {
    this.auth.toggleUnit();
  }
}
