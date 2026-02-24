import { describe, expect, it } from 'vitest';

import {
  applyNewVersion,
  closePreviousVersion,
  validateNoOverlap,
} from '../versioning';

describe('versioning helpers', () => {
  it('closePreviousVersion sets valid_to to valid_from - 1 day', () => {
    const previous = {
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      validTo: null,
    };

    const closed = closePreviousVersion(
      previous,
      new Date('2026-02-01T00:00:00.000Z'),
    );

    expect(closed.validTo?.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  it('validateNoOverlap throws when there is an overlapping open version', () => {
    const existing = [
      {
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validTo: null,
      },
    ];

    expect(() =>
      validateNoOverlap(existing, new Date('2026-02-01T00:00:00.000Z')),
    ).toThrow('Version overlap detected for entity/branch');
  });

  it('applyNewVersion closes previous and appends the new version', () => {
    const existing = [
      {
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validTo: null,
      },
    ];

    const next = applyNewVersion(existing, {
      validFrom: new Date('2026-03-01T00:00:00.000Z'),
      validTo: null,
    });

    expect(next).toHaveLength(2);
    expect(next[0].validTo?.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(next[1].validFrom.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(next[1].validTo).toBeNull();
  });
});
