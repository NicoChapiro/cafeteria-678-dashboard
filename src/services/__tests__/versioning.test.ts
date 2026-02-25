import { describe, expect, it } from 'vitest';

import {
  applyNewVersion,
  closePreviousVersion,
  validateNoOverlap,
} from '../versioning';

describe('versioning helpers', () => {
  it('creates first version when list is empty', () => {
    const next = applyNewVersion([], {
      validFrom: new Date('2026-01-01T10:30:00.000Z'),
      validTo: null,
    });

    expect(next).toHaveLength(1);
    expect(next[0].validFrom.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(next[0].validTo).toBeNull();
  });

  it('closes an open previous version with valid_to = newValidFrom - 1 calendar day', () => {
    const previous = {
      validFrom: new Date('2026-01-01T08:00:00.000Z'),
      validTo: null,
    };

    const closed = closePreviousVersion(
      previous,
      new Date('2026-03-01T22:45:00.000Z'),
    );

    expect(closed.validTo?.toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  it('does not modify a previous version that is already closed', () => {
    const previous = {
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      validTo: new Date('2026-01-31T00:00:00.000Z'),
    };

    const result = closePreviousVersion(
      previous,
      new Date('2026-03-01T00:00:00.000Z'),
    );

    expect(result).toEqual(previous);
  });

  it('does not modify a closed latest version when inserting a new one', () => {
    const existing = [
      {
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validTo: new Date('2026-01-31T00:00:00.000Z'),
      },
    ];

    const next = applyNewVersion(existing, {
      validFrom: new Date('2026-03-01T12:00:00.000Z'),
      validTo: null,
    });

    expect(next[0].validTo?.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    expect(next[1].validFrom.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('rejects newVersion with validTo != null', () => {
    expect(() =>
      applyNewVersion([], {
        validFrom: new Date('2026-03-01T00:00:00.000Z'),
        validTo: new Date('2026-03-05T00:00:00.000Z'),
      }),
    ).toThrow('newVersion must be open (validTo must be null)');
  });

  it('rejects existingVersions with overlap', () => {
    const existing = [
      {
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validTo: new Date('2026-02-15T00:00:00.000Z'),
      },
      {
        validFrom: new Date('2026-02-01T00:00:00.000Z'),
        validTo: null,
      },
    ];

    expect(() =>
      applyNewVersion(existing, {
        validFrom: new Date('2026-03-01T00:00:00.000Z'),
        validTo: null,
      }),
    ).toThrow('existingVersions is invalid: overlapping ranges detected');
  });

  it('rejects existingVersions with multiple open versions', () => {
    const existing = [
      {
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validTo: null,
      },
      {
        validFrom: new Date('2026-02-01T00:00:00.000Z'),
        validTo: null,
      },
    ];

    expect(() =>
      applyNewVersion(existing, {
        validFrom: new Date('2026-03-01T00:00:00.000Z'),
        validTo: null,
      }),
    ).toThrow('existingVersions is invalid: multiple open versions found');
  });

  it('rejects newValidFrom that is earlier or equal to latest validFrom', () => {
    const existing = [
      {
        validFrom: new Date('2026-03-01T00:00:00.000Z'),
        validTo: null,
      },
    ];

    expect(() =>
      applyNewVersion(existing, {
        validFrom: new Date('2026-03-01T12:00:00.000Z'),
        validTo: null,
      }),
    ).toThrow('newValidFrom must be strictly greater than latest validFrom');

    expect(() =>
      applyNewVersion(existing, {
        validFrom: new Date('2026-02-28T12:00:00.000Z'),
        validTo: null,
      }),
    ).toThrow('newValidFrom must be strictly greater than latest validFrom');
  });

  it('normalizes hours to UTC day when applying second version', () => {
    const existing = [
      {
        validFrom: new Date('2026-01-01T14:20:00.000Z'),
        validTo: null,
      },
    ];

    const next = applyNewVersion(existing, {
      validFrom: new Date('2026-03-01T23:59:59.000Z'),
      validTo: null,
    });

    expect(next[0].validFrom.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(next[0].validTo?.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(next[1].validFrom.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('detects overlap for an open existing version', () => {
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
});
