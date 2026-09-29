import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthState } from '../../services/auth-state';
import { GoalType, TrainingPlan, TrainingPlanPhase, TrainingPlanWeek } from '../../services/training-plan';
import { DistanceUnit, formatDistance, formatPaceFromSecondsPerKm, toMeters } from '../../utils/units';
import { DAY_LABELS, WORKOUT_LABELS, addDays, formatWeekLabel } from '../../utils/training-plan-view';
import { DurationInput } from '../../components/duration-input/duration-input';

const DEFAULT_MARATHON_TIME_SECONDS = 16_800; // 4:40:00
const DEFAULT_TEN_K_TIME_SECONDS = 3_600; // 1:00:00
const DEFAULT_FIVE_K_TIME_SECONDS = 1_800; // 30:00

interface PlanRow {
  id: number;
  dayIndex: number;
  dayLabel: string;
  dateLabel: string;
  workoutLabel: string;
  distanceLabel: string;
  paceLabel: string;
  done: boolean;
  isRest: boolean;
}

interface PlanWeekView {
  weekNumber: number;
  phaseLabel: string;
  dateRangeLabel: string;
  totalLabel: string;
  rows: PlanRow[];
}

interface GoalOption {
  value: GoalType;
  label: string;
  lengthLabel: string;
}

const GOAL_OPTIONS: GoalOption[] = [
  { value: 'MARATHON', label: 'Marathon', lengthLabel: '12- to 18-week plan' },
  { value: 'HALF_MARATHON', label: 'Half marathon', lengthLabel: '16-week plan' },
  { value: 'TEN_K', label: '10K', lengthLabel: '10-week plan' },
  { value: 'FIVE_K', label: '5K', lengthLabel: '6-week plan' },
  { value: 'FITNESS', label: 'Getting started / keep fit', lengthLabel: '4-week plan, no race needed' },
];

const GOAL_LABELS: Record<GoalType, string> = {
  MARATHON: 'Marathon',
  HALF_MARATHON: 'Half marathon',
  TEN_K: '10K',
  FIVE_K: '5K',
  FITNESS: 'Getting started / keep fit',
};

const PHASE_LABELS: Record<TrainingPlanPhase, string> = {
  BASE: 'Base',
  BUILD: 'Build',
  PEAK: 'Peak',
  TAPER: 'Taper',
};

const RUNS_PER_WEEK_OPTIONS = [3, 4, 5, 6];

@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [FormsModule, DurationInput],
  templateUrl: './planning.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Planning {
  protected readonly auth = inject(AuthState);
  protected readonly trainingPlan = inject(TrainingPlan);

  protected readonly goalOptions = GOAL_OPTIONS;
  protected readonly runsPerWeekOptions = RUNS_PER_WEEK_OPTIONS;

  protected readonly goalType = signal<GoalType | null>(null);
  protected readonly targetRaceDate = signal('');
  protected readonly weeklyMileage = signal<number | null>(null);
  protected readonly runsPerWeek = signal(4);
  protected readonly marathonTimeSeconds = signal(DEFAULT_MARATHON_TIME_SECONDS);
  protected readonly tenKTimeSeconds = signal(DEFAULT_TEN_K_TIME_SECONDS);
  protected readonly fiveKTimeSeconds = signal(DEFAULT_FIVE_K_TIME_SECONDS);
  protected readonly showForm = signal(false);

  protected readonly needsRaceDate = computed(() => this.goalType() !== 'FITNESS');

  protected readonly canSubmit = computed(() => {
    const goal = this.goalType();
    if (!goal) {
      return false;
    }
    return goal === 'FITNESS' || this.targetRaceDate().length > 0;
  });

  protected readonly planGoalLabel = computed(() => {
    const plan = this.trainingPlan.plan();
    return plan ? GOAL_LABELS[plan.goalType] : '';
  });

  protected readonly planWeeks = computed<PlanWeekView[]>(() => {
    const plan = this.trainingPlan.plan();
    const unit = this.auth.unit();
    return plan ? plan.weeks.map((week) => toWeekView(week, unit)) : [];
  });

  constructor() {
    this.trainingPlan.loadPlan();
    // Once a (re)generated plan lands, drop back from the questionnaire to the plan view.
    effect(() => {
      if (this.trainingPlan.plan()) {
        this.showForm.set(false);
      }
    });
  }

  selectGoal(goal: GoalType): void {
    this.goalType.set(goal);
  }

  startNewPlan(): void {
    const hasExistingPlan = this.trainingPlan.plan() !== null;
    if (!hasExistingPlan || confirm("Starting a new plan replaces your current one, including checked-off progress. Continue?")) {
      this.goalType.set(null);
      this.targetRaceDate.set('');
      this.weeklyMileage.set(null);
      this.runsPerWeek.set(4);
      this.marathonTimeSeconds.set(DEFAULT_MARATHON_TIME_SECONDS);
      this.tenKTimeSeconds.set(DEFAULT_TEN_K_TIME_SECONDS);
      this.fiveKTimeSeconds.set(DEFAULT_FIVE_K_TIME_SECONDS);
      this.showForm.set(true);
    }
  }

  cancelNewPlan(): void {
    this.showForm.set(false);
  }

  submit(): void {
    const goal = this.goalType();
    if (!goal || !this.canSubmit()) {
      return;
    }
    this.trainingPlan.submitPreferences({
      goalType: goal,
      targetRaceDate: goal === 'FITNESS' ? null : this.targetRaceDate(),
      weeklyMileageMeters: toMeters(this.weeklyMileage() ?? 0, this.auth.unit()),
      runsPerWeek: this.runsPerWeek(),
      marathonTimeSeconds: this.marathonTimeSeconds(),
      tenKTimeSeconds: this.tenKTimeSeconds(),
      fiveKTimeSeconds: this.fiveKTimeSeconds(),
    });
  }

  toggleDay(dayId: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.trainingPlan.setDone(dayId, checked);
  }
}

function toWeekView(week: TrainingPlanWeek, unit: DistanceUnit): PlanWeekView {
  return {
    weekNumber: week.weekNumber,
    phaseLabel: PHASE_LABELS[week.phase],
    dateRangeLabel: `${formatWeekLabel(week.weekStart)} – ${formatWeekLabel(addDays(week.weekStart, 6))}`,
    totalLabel: formatDistance(week.totalDistanceMeters, unit),
    rows: [...week.days]
      .sort((a, b) => a.dayIndex - b.dayIndex)
      .map((day) => ({
        id: day.id,
        dayIndex: day.dayIndex,
        dayLabel: DAY_LABELS[day.dayIndex],
        dateLabel: formatWeekLabel(addDays(week.weekStart, day.dayIndex)),
        workoutLabel: day.description ?? WORKOUT_LABELS[day.workoutType],
        distanceLabel: day.workoutType === 'REST' ? '—' : formatDistance(day.targetDistanceMeters, unit),
        paceLabel: formatPaceFromSecondsPerKm(day.targetPaceSecondsPerKm, unit),
        done: day.done,
        isRest: day.workoutType === 'REST',
      })),
  };
}
