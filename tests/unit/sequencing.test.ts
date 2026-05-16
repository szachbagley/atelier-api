import { describe, expect, it } from 'vitest';
import {
  SEQUENCE_GAP,
  getInsertBetweenSequence,
  renumber,
} from '../../src/utils/sequencing.js';

describe('SEQUENCE_GAP', () => {
  it('is 1000', () => {
    expect(SEQUENCE_GAP).toBe(1000);
  });
});

describe('renumber', () => {
  it('returns an empty array for an empty input', () => {
    expect(renumber([])).toEqual([]);
  });

  it('assigns GAP to a single item', () => {
    const result = renumber([{ id: 'a', sequence_number: 5 }]);
    expect(result).toEqual([{ id: 'a', sequence_number: 1000 }]);
  });

  it('spaces multiple items by GAP', () => {
    const items = [
      { id: 'a', sequence_number: 100 },
      { id: 'b', sequence_number: 200 },
      { id: 'c', sequence_number: 300 },
    ];
    expect(renumber(items)).toEqual([
      { id: 'a', sequence_number: 1000 },
      { id: 'b', sequence_number: 2000 },
      { id: 'c', sequence_number: 3000 },
    ]);
  });

  it('preserves order and other fields', () => {
    const items = [
      { id: 'b', sequence_number: 999, name: 'Bravo' },
      { id: 'a', sequence_number: 1, name: 'Alpha' },
    ];
    const result = renumber(items);
    expect(result[0]).toMatchObject({ id: 'b', name: 'Bravo', sequence_number: 1000 });
    expect(result[1]).toMatchObject({ id: 'a', name: 'Alpha', sequence_number: 2000 });
  });

  it('does not mutate the original array', () => {
    const items = [{ id: 'a', sequence_number: 42 }];
    renumber(items);
    expect(items[0].sequence_number).toBe(42);
  });
});

describe('getInsertBetweenSequence', () => {
  it('returns GAP when the list is empty (both null)', () => {
    expect(getInsertBetweenSequence(null, null)).toBe(1000);
  });

  it('returns half of after when inserting before the first item', () => {
    expect(getInsertBetweenSequence(null, 1000)).toBe(500);
    expect(getInsertBetweenSequence(null, 2000)).toBe(1000);
  });

  it('returns before + GAP when appending to the end', () => {
    expect(getInsertBetweenSequence(5000, null)).toBe(6000);
    expect(getInsertBetweenSequence(1000, null)).toBe(2000);
  });

  it('returns the midpoint between two values', () => {
    expect(getInsertBetweenSequence(1000, 2000)).toBe(1500);
    expect(getInsertBetweenSequence(1000, 3000)).toBe(2000);
  });

  it('floors the midpoint when the average is fractional', () => {
    expect(getInsertBetweenSequence(1000, 1001)).toBe(1000);
    expect(getInsertBetweenSequence(1001, 1004)).toBe(1002);
  });

  it('collides with `before` when there is no room (signals renumber needed)', () => {
    expect(getInsertBetweenSequence(1000, 1001)).toBe(1000);
  });
});
