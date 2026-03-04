export type VersionRecord = {
  validFrom: Date;
  validTo: Date | null;
};

function normalizeToUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function sameUtcDay(a: Date, b: Date): boolean {
  return normalizeToUtcDay(a).getTime() === normalizeToUtcDay(b).getTime();
}

function subtractUtcDays(date: Date, days: number): Date {
  const shifted = new Date(normalizeToUtcDay(date));
  shifted.setUTCDate(shifted.getUTCDate() - days);
  return shifted;
}

function validateExistingConsistency(existingVersions: VersionRecord[]): void {
  const sorted = [...existingVersions]
    .map((version) => ({
      ...version,
      validFrom: normalizeToUtcDay(version.validFrom),
      validTo: version.validTo ? normalizeToUtcDay(version.validTo) : null,
    }))
    .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());

  const openIndexes = sorted
    .map((version, index) => ({ version, index }))
    .filter(({ version }) => version.validTo === null)
    .map(({ index }) => index);

  if (openIndexes.length > 1) {
    throw new Error('existingVersions is invalid: multiple open versions found');
  }

  if (openIndexes.length === 1 && openIndexes[0] !== sorted.length - 1) {
    throw new Error(
      'existingVersions is invalid: open version must be the latest by validFrom',
    );
  }

  for (const version of sorted) {
    if (version.validTo && version.validTo < version.validFrom) {
      throw new Error('existingVersions is invalid: validTo before validFrom');
    }
  }

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    const previousEnd = previous.validTo ?? new Date(8640000000000000);

    if (previousEnd >= current.validFrom) {
      throw new Error('existingVersions is invalid: overlapping ranges detected');
    }
  }
}


export function closePreviousVersion(
  previous: VersionRecord,
  newValidFrom: Date,
): VersionRecord {
  if (previous.validTo !== null) {
    return previous;
  }

  const normalizedPreviousValidFrom = normalizeToUtcDay(previous.validFrom);
  const closedAt = subtractUtcDays(newValidFrom, 1);

  if (closedAt < normalizedPreviousValidFrom) {
    throw new Error('New valid_from must be after previous valid_from');
  }

  return {
    ...previous,
    validTo: closedAt,
  };
}

export function validateNoOverlap(
  existingVersions: VersionRecord[],
  newValidFrom: Date,
): void {
  validateExistingConsistency(existingVersions);

  const normalizedNewValidFrom = normalizeToUtcDay(newValidFrom);

  const hasOverlap = existingVersions.some((version) => {
    const start = normalizeToUtcDay(version.validFrom);
    const end = version.validTo
      ? normalizeToUtcDay(version.validTo)
      : new Date(8640000000000000);

    return start <= normalizedNewValidFrom && normalizedNewValidFrom <= end;
  });

  if (hasOverlap) {
    throw new Error('Version overlap detected for entity/branch');
  }
}

export function applyNewVersion(
  existingVersions: VersionRecord[],
  newVersion: VersionRecord,
): VersionRecord[] {
  if (newVersion.validTo !== null) {
    throw new Error('newVersion must be open (validTo must be null)');
  }

  validateExistingConsistency(existingVersions);

  const normalizedNewValidFrom = normalizeToUtcDay(newVersion.validFrom);
  const normalizedExisting: VersionRecord[] = [...existingVersions]
    .map((version) => ({
      ...version,
      validFrom: normalizeToUtcDay(version.validFrom),
      validTo: version.validTo ? normalizeToUtcDay(version.validTo) : null,
    }))
    .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());

  const withoutSameDay = normalizedExisting.filter(
    (version) => !sameUtcDay(version.validFrom, normalizedNewValidFrom),
  );

  const insertionIndex = withoutSameDay.findIndex(
    (version) => version.validFrom > normalizedNewValidFrom,
  );

  const nextIndex = insertionIndex >= 0 ? insertionIndex : withoutSameDay.length;
  const previousIndex = nextIndex - 1;

  const next = withoutSameDay[nextIndex] ?? null;
  const previous = previousIndex >= 0 ? withoutSameDay[previousIndex] : null;

  const insertedValidTo = next ? subtractUtcDays(next.validFrom, 1) : null;
  if (insertedValidTo && insertedValidTo < normalizedNewValidFrom) {
    throw new Error('Invalid interval: computed validTo is before validFrom');
  }

  if (previous) {
    const previousNextValidTo = subtractUtcDays(normalizedNewValidFrom, 1);
    if (previousNextValidTo < previous.validFrom) {
      throw new Error('Invalid interval: previous version would end before it starts');
    }

    const canShorten = previous.validTo === null || previous.validTo > previousNextValidTo;
    if (canShorten) {
      withoutSameDay[previousIndex] = {
        ...previous,
        validTo: previousNextValidTo,
      };
    }
  }

  const inserted: VersionRecord = {
    ...newVersion,
    validFrom: normalizedNewValidFrom,
    validTo: insertedValidTo,
  };

  withoutSameDay.splice(nextIndex, 0, inserted);
  validateExistingConsistency(withoutSameDay);
  return withoutSameDay;
}
