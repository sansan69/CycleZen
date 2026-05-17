import { describe, it, expect } from 'vitest';
import { formatDuration, estimateCalories, classifyDifficulty, cn } from '@/shared/lib/utils';

describe('formatDuration', () => {
  it('formats 0 seconds as 00:00', () => {
    expect(formatDuration(0)).toBe('00:00');
  });

  it('formats 65 seconds as 01:05', () => {
    expect(formatDuration(65)).toBe('01:05');
  });

  it('formats 3661 seconds as 01:01:01', () => {
    expect(formatDuration(3661)).toBe('01:01:01');
  });

  it('formats 3600 seconds as 01:00:00', () => {
    expect(formatDuration(3600)).toBe('01:00:00');
  });
});

describe('estimateCalories', () => {
  it('returns 0 for 0 distance', () => {
    expect(estimateCalories(0)).toBe(0);
  });

  it('returns 0 for negative distance', () => {
    expect(estimateCalories(-5)).toBe(0);
  });

  it('estimates calories for 20km with default weight', () => {
    // 70kg * 8.0 MET * 1h = 560
    expect(estimateCalories(20)).toBe(560);
  });

  it('estimates calories with custom weight', () => {
    // 80kg * 8.0 MET * 0.5h = 320
    expect(estimateCalories(10, 80)).toBe(320);
  });
});

describe('classifyDifficulty', () => {
  it('returns Moderate when distance is 0', () => {
    expect(classifyDifficulty(100, 0)).toBe('Moderate');
  });

  it('classifies Easy for low elevation', () => {
    expect(classifyDifficulty(100, 10)).toBe('Easy');
  });

  it('classifies Moderate for medium elevation', () => {
    expect(classifyDifficulty(200, 10)).toBe('Moderate');
  });

  it('classifies Hard for high elevation', () => {
    expect(classifyDifficulty(400, 10)).toBe('Hard');
  });

  it('classifies Expert for extreme elevation', () => {
    expect(classifyDifficulty(600, 10)).toBe('Expert');
  });
});

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });
});
