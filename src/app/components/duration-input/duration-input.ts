import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** A labeled H/M/S trio bound to a single totalSeconds value, e.g. for entering a race time. */
@Component({
  selector: 'app-duration-input',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './duration-input.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DurationInput {
  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly totalSeconds = model.required<number>();

  protected readonly hours = computed(() => Math.floor(this.totalSeconds() / 3600));
  protected readonly minutes = computed(() => Math.floor((this.totalSeconds() % 3600) / 60));
  protected readonly seconds = computed(() => this.totalSeconds() % 60);

  setHours(value: number): void {
    this.totalSeconds.set(clamp(value) * 3600 + this.minutes() * 60 + this.seconds());
  }

  setMinutes(value: number): void {
    this.totalSeconds.set(this.hours() * 3600 + clamp(value) * 60 + this.seconds());
  }

  setSeconds(value: number): void {
    this.totalSeconds.set(this.hours() * 3600 + this.minutes() * 60 + clamp(value));
  }
}

function clamp(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}
