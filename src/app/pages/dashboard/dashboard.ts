import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { AuthState } from '../../services/auth-state';
import { Runs } from '../../services/runs';
import { RunAnalytics, WeeklySummary } from '../../services/analytics';
import { formatDistance, formatPace, formatStreak, paceSecondsPerUnit } from '../../utils/units';

interface WeekRow {
  weekLabel: string;
  days: string[];
  total: string;
}

interface ChartBar {
  key: string;
  label: string;
  tooltip: string;
  heightPercent: number;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  protected readonly auth = inject(AuthState);
  protected readonly runs = inject(Runs);
  protected readonly analytics = inject(RunAnalytics);

  protected readonly dayLabels = DAY_LABELS;

  protected readonly displayStats = computed(() => {
    const stats = this.runs.stats();
    const unit = this.auth.unit();
    return {
      totalDistance: formatDistance(stats.totalDistanceMeters, unit),
      totalRuns: String(stats.totalRuns),
      avgPace:
        stats.totalDistanceMeters > 0
          ? formatPace(stats.totalMovingSeconds, stats.totalDistanceMeters, unit)
          : '--',
      streak: formatStreak(stats.streakDays),
    };
  });

  protected readonly weekRows = computed<WeekRow[]>(() => {
    const unit = this.auth.unit();
    return this.analytics.weeks().map((week) => ({
      weekLabel: formatWeekLabel(week.weekStart),
      days: week.dailyDistanceMeters.map((meters) => formatDistance(meters, unit)),
      total: formatDistance(week.totalDistanceMeters, unit),
    }));
  });

  protected readonly mileageChart = computed<ChartBar[]>(() => {
    const unit = this.auth.unit();
    const weeks = [...this.analytics.weeks()].reverse();
    const max = Math.max(1, ...weeks.map((week) => week.totalDistanceMeters));
    return weeks.map((week) => ({
      key: week.weekStart,
      label: formatWeekLabel(week.weekStart),
      tooltip: `Week of ${formatWeekLabel(week.weekStart)}: ${formatDistance(week.totalDistanceMeters, unit)} across ${week.totalRuns} run${week.totalRuns === 1 ? '' : 's'}`,
      heightPercent: (week.totalDistanceMeters / max) * 100,
    }));
  });

  protected readonly paceChart = computed<ChartBar[]>(() => {
    const unit = this.auth.unit();
    const weeks = [...this.analytics.weeks()].reverse();
    const paces = weeks.map((week) => paceSecondsPerUnit(week.totalMovingSeconds, week.totalDistanceMeters, unit));
    const values = paces.filter((pace): pace is number => pace !== null);
    const max = values.length ? Math.max(...values) : 1;
    const min = values.length ? Math.min(...values) : 0;
    const range = Math.max(1, max - min);
    return weeks.map((week, i) => {
      const pace = paces[i];
      return {
        key: week.weekStart,
        label: formatWeekLabel(week.weekStart),
        tooltip:
          pace === null
            ? `Week of ${formatWeekLabel(week.weekStart)}: no runs`
            : `Week of ${formatWeekLabel(week.weekStart)}: ${formatPace(week.totalMovingSeconds, week.totalDistanceMeters, unit)}`,
        heightPercent: pace === null ? 0 : ((pace - min) / range) * 80 + 20,
      };
    });
  });

  protected readonly dayOfWeekChart = computed<ChartBar[]>(() => {
    const unit = this.auth.unit();
    const weeks = this.analytics.weeks();
    const totals = [0, 0, 0, 0, 0, 0, 0];
    for (const week of weeks) {
      week.dailyDistanceMeters.forEach((meters, i) => (totals[i] += meters));
    }
    const averages = totals.map((total) => (weeks.length ? total / weeks.length : 0));
    const max = Math.max(1, ...averages);
    return averages.map((avg, i) => ({
      key: DAY_LABELS[i],
      label: DAY_LABELS[i],
      tooltip: `${DAY_LABELS[i]}: ${formatDistance(avg, unit)} average`,
      heightPercent: (avg / max) * 100,
    }));
  });

  protected readonly trend = computed(() => {
    const weeks = this.analytics.weeks();
    if (weeks.length < 8) {
      return null;
    }
    const recent = weeks.slice(0, 4).reduce((sum, week) => sum + week.totalDistanceMeters, 0);
    const prior = weeks.slice(4, 8).reduce((sum, week) => sum + week.totalDistanceMeters, 0);
    if (prior === 0) {
      return null;
    }
    const changePercent = Math.round(((recent - prior) / prior) * 100);
    return { changePercent, direction: changePercent >= 0 ? ('up' as const) : ('down' as const) };
  });

  protected readonly records = computed(() => {
    const record = this.analytics.records();
    if (!record) {
      return null;
    }
    const unit = this.auth.unit();
    return {
      longestRun: record.longestRun ? formatDistance(record.longestRun.distanceMeters, unit) : '--',
      longestRunDate: record.longestRun?.date ?? '',
      fastestPace: record.fastestPaceRun
        ? formatPace(record.fastestPaceRun.movingTimeSeconds, record.fastestPaceRun.distanceMeters, unit)
        : '--',
      fastestPaceDate: record.fastestPaceRun?.date ?? '',
      longestStreak: formatStreak(record.longestStreakDays),
    };
  });

  protected readonly coachingTips = computed<string[]>(() => {
    const tips: string[] = [];
    const weeks = this.analytics.weeks();
    const trend = this.trend();

    if (trend && trend.direction === 'down' && trend.changePercent <= -15) {
      tips.push(
        `Your weekly mileage is down ${Math.abs(trend.changePercent)}% over the last 4 weeks compared to the 4 weeks before. Consider an easy short run to rebuild momentum.`,
      );
    }

    if (weeks.length >= 4) {
      const recentWeeks = weeks.slice(0, 4);
      const avgRunsPerWeek = recentWeeks.reduce((sum, week) => sum + week.totalRuns, 0) / recentWeeks.length;
      if (avgRunsPerWeek < 3) {
        tips.push(
          `You're averaging ${avgRunsPerWeek.toFixed(1)} runs/week over the last 4 weeks. Adding one more easy run could help build consistency.`,
        );
      }
    }

    const lastRun = lastRunDate(weeks);
    if (lastRun) {
      const daysSince = Math.floor((Date.now() - lastRun.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 4) {
        tips.push(`It's been ${daysSince} days since your last run. A short easy run can help you get back into rhythm.`);
      }
    }

    if (tips.length === 0) {
      tips.push("You're on track — keep up the consistent training.");
    }
    return tips.slice(0, 4);
  });

  constructor() {
    this.auth.refreshStravaStatus();
    effect(() => {
      if (this.auth.stravaConnected()) {
        untracked(() => {
          this.runs.loadFromStrava();
          this.analytics.loadInitial();
        });
      }
    });
  }

  connectStrava(): void {
    this.auth.connectStrava();
  }

  sync(): void {
    this.runs.syncFromStrava(() => this.analytics.loadInitial());
  }

  loadMoreWeeks(): void {
    this.analytics.loadMoreWeeks();
  }
}

function formatWeekLabel(weekStart: string): string {
  const date = new Date(`${weekStart}T00:00:00Z`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function lastRunDate(weeks: WeeklySummary[]): Date | null {
  for (const week of weeks) {
    for (let i = 6; i >= 0; i--) {
      if (week.dailyDistanceMeters[i] > 0) {
        const date = new Date(`${week.weekStart}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + i);
        return date;
      }
    }
  }
  return null;
}
