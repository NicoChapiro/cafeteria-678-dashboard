export type VersionRecord = {
  validFrom: Date;
  validTo: Date | null;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function closePreviousVersion<T extends VersionRecord>(
  previous: T,
  newValidFrom: Date,
): T {
  const closedAt = new Date(newValidFrom.getTime() - DAY_IN_MS);

  if (closedAt < previous.validFrom) {
    throw new Error('New valid_from must be after previous valid_from');
  }

  return {
    ...previous,
    validTo: closedAt,
  };
}

export function validateNoOverlap<T extends VersionRecord>(
  existingVersions: T[],
  newValidFrom: Date,
): void {
  const hasOverlap = existingVersions.some((version) => {
    const end = version.validTo ?? new Date(8640000000000000);
    return end >= newValidFrom;
  });

  if (hasOverlap) {
    throw new Error('Version overlap detected for entity/branch');
  }
}

export function applyNewVersion<T extends VersionRecord>(
  existingVersions: T[],
  newVersion: T,
): T[] {
  const sorted = [...existingVersions].sort(
    (a, b) => a.validFrom.getTime() - b.validFrom.getTime(),
  );

  const previousIndex = sorted
    .map((version, index) => ({ version, index }))
    .filter(({ version }) => version.validFrom < newVersion.validFrom)
    .map(({ index }) => index)
    .at(-1);

  if (previousIndex !== undefined) {
    sorted[previousIndex] = closePreviousVersion(
      sorted[previousIndex],
      newVersion.validFrom,
    );
  }

  validateNoOverlap(sorted, newVersion.validFrom);

  return [...sorted, newVersion].sort(
    (a, b) => a.validFrom.getTime() - b.validFrom.getTime(),
  );
}
