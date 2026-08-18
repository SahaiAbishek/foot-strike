export type DistanceUnit = 'km' | 'mi';

const METERS_PER_KM = 1000;
const METERS_PER_MILE = 1609.344;

function metersPerUnit(unit: DistanceUnit): number {
  return unit === 'mi' ? METERS_PER_MILE : METERS_PER_KM;
}

export function formatDistance(meters: number, unit: DistanceUnit): string {
  const value = meters / metersPerUnit(unit);
  return `${value.toFixed(1)} ${unit}`;
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function paceSecondsPerUnit(movingSeconds: number, meters: number, unit: DistanceUnit): number | null {
  if (meters <= 0) {
    return null;
  }
  return movingSeconds / (meters / metersPerUnit(unit));
}

export function formatPace(movingSeconds: number, meters: number, unit: DistanceUnit): string {
  const secondsPerUnit = paceSecondsPerUnit(movingSeconds, meters, unit);
  if (secondsPerUnit === null) {
    return '--';
  }
  const minutes = Math.floor(secondsPerUnit / 60);
  const seconds = Math.round(secondsPerUnit % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} /${unit}`;
}

export function formatStreak(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}
