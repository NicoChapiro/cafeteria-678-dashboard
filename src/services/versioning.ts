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

  const normalizedNewValidFrom = normalizeToUtcDay(newValidFrom);
  const normalizedPreviousValidFrom = normalizeToUtcDay(previous.validFrom);
  const closedAt = new Date(normalizedNewValidFrom);
  closedAt.setUTCDate(closedAt.getUTCDate() - 1);

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
  const normalizedNewValidFrom = normalizeToUtcDay(newValidFrom);

  const hasOverlap = existingVersions.some((version) => {
    const start = normalizeToUtcDay(version.validFrom);
    const end = version.validTo
      ? normalizeToUtcDay(version.validTo)
      : new Date(8640000000000000);

    return start <= normalizedNewValidFrom && end >= normalizedNewValidFrom;
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
  const normalizedNewVersion: VersionRecord = {
    ...newVersion,
    validFrom: normalizedNewValidFrom,
    validTo: null,
  };

  const sorted: VersionRecord[] = [...existingVersions]
    .map((version) => ({
      ...version,
      validFrom: normalizeToUtcDay(version.validFrom),
      validTo: version.validTo ? normalizeToUtcDay(version.validTo) : null,
    }))
    .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());

  const latest = sorted.at(-1);
  if (latest && normalizedNewValidFrom <= latest.validFrom) {
    throw new Error('newValidFrom must be strictly greater than latest validFrom');
  }

  const hasSameDayDuplicate = sorted.some((version) =>
    sameUtcDay(version.validFrom, normalizedNewValidFrom),
  );
  if (hasSameDayDuplicate) {
    throw new Error('Duplicate valid_from day is not allowed');
  }

  if (latest) {
    sorted[sorted.length - 1] = closePreviousVersion(latest, normalizedNewValidFrom);
  }

  validateNoOverlap(sorted, normalizedNewValidFrom);

  return [...sorted, normalizedNewVersion].sort(
    (a, b) => a.validFrom.getTime() - b.validFrom.getTime(),
  );
}
