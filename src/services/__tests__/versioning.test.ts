import { describe, expect, it } from 'vitest';

import { applyNewVersion } from '../versioning';

describe('applyNewVersion', () => {
  it('insert after last keeps inserted validTo null and closes previous', () => {
    const existing = [
      {
        validFrom: new Date('2026-01-01T10:00:00.000Z'),
        validTo: null,
      },
    ];

    const next = applyNewVersion(existing, {
      validFrom: new Date('2026-03-01T23:59:00.000Z'),
      validTo: null,
    });

    expect(next).toHaveLength(2);
    expect(next[0].validFrom.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(next[0].validTo?.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(next[1].validFrom.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(next[1].validTo).toBeNull();
  });

  it('insert before first sets inserted validTo to first.validFrom - 1', () => {
    const existing = [
      {
        validFrom: new Date('2026-03-10T00:00:00.000Z'),
        validTo: null,
      },
    ];

    const next = applyNewVersion(existing, {
      validFrom: new Date('2026-02-01T00:00:00.000Z'),
      validTo: null,
    });

    expect(next).toHaveLength(2);
    expect(next[0].validFrom.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(next[0].validTo?.toISOString()).toBe('2026-03-09T00:00:00.000Z');
    expect(next[1].validFrom.toISOString()).toBe('2026-03-10T00:00:00.000Z');
    expect(next[1].validTo).toBeNull();
  });

  it('insert between two versions updates both adjacent boundaries', () => {
    const existing = [
      {
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validTo: new Date('2026-02-28T00:00:00.000Z'),
      },
      {
        validFrom: new Date('2026-04-01T00:00:00.000Z'),
        validTo: null,
      },
    ];

    const next = applyNewVersion(existing, {
      validFrom: new Date('2026-03-15T11:00:00.000Z'),
      validTo: null,
    });

    expect(next).toHaveLength(3);
    expect(next[0].validTo?.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(next[1].validFrom.toISOString()).toBe('2026-03-15T00:00:00.000Z');
    expect(next[1].validTo?.toISOString()).toBe('2026-03-31T00:00:00.000Z');
    expect(next[2].validFrom.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('insert inside an existing version splits by shortening previous and adding new', () => {
    const existing = [
      {
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validTo: new Date('2026-06-30T00:00:00.000Z'),
      },
      {
        validFrom: new Date('2026-07-01T00:00:00.000Z'),
        validTo: null,
      },
    ];

    const next = applyNewVersion(existing, {
      validFrom: new Date('2026-03-10T00:00:00.000Z'),
      validTo: null,
    });

    expect(next).toHaveLength(3);
    expect(next[0].validFrom.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(next[0].validTo?.toISOString()).toBe('2026-03-09T00:00:00.000Z');
    expect(next[1].validFrom.toISOString()).toBe('2026-03-10T00:00:00.000Z');
    expect(next[1].validTo?.toISOString()).toBe('2026-06-30T00:00:00.000Z');
  });

  it('insert with same validFrom replaces existing version day and keeps timeline valid', () => {
    const existing = [
      {
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validTo: new Date('2026-02-28T00:00:00.000Z'),
      },
      {
        validFrom: new Date('2026-03-01T00:00:00.000Z'),
        validTo: null,
      },
    ];

    const next = applyNewVersion(existing, {
      validFrom: new Date('2026-03-01T18:10:00.000Z'),
      validTo: null,
    });

    expect(next).toHaveLength(2);
    expect(next[0].validFrom.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(next[0].validTo?.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(next[1].validFrom.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(next[1].validTo).toBeNull();
  });

  it('throws when computed interval is negative', () => {
    const existing = [
      {
        validFrom: new Date('2026-01-10T00:00:00.000Z'),
        validTo: new Date('2026-01-05T00:00:00.000Z'),
      },
    ];

    expect(() =>
      applyNewVersion(existing, {
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validTo: null,
      }),
    ).toThrow('existingVersions is invalid: validTo before validFrom');
  });
});
