import { TestBed } from '@angular/core/testing';
import { DurationInput } from './duration-input';

describe('DurationInput', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DurationInput] }).compileComponents();
  });

  it('derives hours/minutes/seconds from totalSeconds', () => {
    const fixture = TestBed.createComponent(DurationInput);
    fixture.componentRef.setInput('label', 'Goal marathon time');
    fixture.componentRef.setInput('totalSeconds', 16_800); // 4:40:00
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      hours: () => number;
      minutes: () => number;
      seconds: () => number;
    };

    expect(component.hours()).toBe(4);
    expect(component.minutes()).toBe(40);
    expect(component.seconds()).toBe(0);
  });

  it('recomposes totalSeconds when a sub-field changes', () => {
    const fixture = TestBed.createComponent(DurationInput);
    fixture.componentRef.setInput('label', 'Recent 10K time');
    fixture.componentRef.setInput('totalSeconds', 3_600); // 1:00:00
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.setMinutes(45);

    // hours stays 1 (unchanged), minutes becomes 45, seconds stays 0 -> 1h45m
    expect(component.totalSeconds()).toBe(3_600 + 45 * 60);
  });

  it('clamps invalid sub-field input to zero', () => {
    const fixture = TestBed.createComponent(DurationInput);
    fixture.componentRef.setInput('label', 'Recent 5K time');
    fixture.componentRef.setInput('totalSeconds', 1_845); // 30:45
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.setSeconds(Number.NaN);

    expect(component.totalSeconds()).toBe(1_800); // seconds part clamped to 0
  });
});
