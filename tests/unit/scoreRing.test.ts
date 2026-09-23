import { describe, expect, it } from 'vitest';
import { scoreRingValue } from '@/components/ScoreRing';

describe('score ring distinguishes missing from zero', () => {
  it.each([undefined, null, NaN, Infinity, -1, 101])('withholds invalid value %s', value => {
    expect(scoreRingValue(value)).toBeNull();
  });
  it.each([0, 72, 100])('preserves real score %s', value => {
    expect(scoreRingValue(value)).toBe(value);
  });
});
