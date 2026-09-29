import { formatPaceFromSecondsPerKm } from './units';

describe('formatPaceFromSecondsPerKm', () => {
  it('returns an em dash for null', () => {
    expect(formatPaceFromSecondsPerKm(null, 'km')).toBe('—');
  });

  it('formats a km pace directly', () => {
    expect(formatPaceFromSecondsPerKm(300, 'km')).toBe('5:00 /km');
  });

  it('converts to a mile pace', () => {
    // 300 sec/km * 1.609344 km/mi = 482.8 sec/mi -> 8:03/mi
    expect(formatPaceFromSecondsPerKm(300, 'mi')).toBe('8:03 /mi');
  });
});
