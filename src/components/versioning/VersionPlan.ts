import { applyNewVersion, type VersionRecord } from '@/src/services/versioning';

type PlanChange = {
  oldValidTo: string;
  newValidTo: string;
};

export type VersionPlanSummary = {
  insertedValidFrom: string;
  insertedValidTo: string;
  previousAdjusted: PlanChange | null;
  nextVersionValidFrom: string | null;
  replacesSameDay: boolean;
};

export type VersionPlanResult<T extends VersionRecord> = {
  plannedVersions: T[];
  summary: VersionPlanSummary;
  error: string | null;
};

function normalizeIsoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toLabel(value: Date | null): string {
  return value ? normalizeIsoDay(value) : 'open';
}

export function computeVersionPlan<T extends VersionRecord>(
  existingVersions: T[],
  newValidFrom: string,
): VersionPlanResult<T> {
  const sortedExisting = [...existingVersions].sort(
    (a, b) => a.validFrom.getTime() - b.validFrom.getTime(),
  );

  if (!newValidFrom) {
    return {
      plannedVersions: sortedExisting,
      summary: {
        insertedValidFrom: '',
        insertedValidTo: 'open',
        previousAdjusted: null,
        nextVersionValidFrom: null,
        replacesSameDay: false,
      },
      error: null,
    };
  }

  const normalizedDate = new Date(`${newValidFrom}T00:00:00.000Z`);
  if (Number.isNaN(normalizedDate.getTime())) {
    return {
      plannedVersions: sortedExisting,
      summary: {
        insertedValidFrom: newValidFrom,
        insertedValidTo: 'open',
        previousAdjusted: null,
        nextVersionValidFrom: null,
        replacesSameDay: false,
      },
      error: 'Fecha inválida',
    };
  }

  try {
    const plannedVersions = applyNewVersion(existingVersions, {
      validFrom: normalizedDate,
      validTo: null,
    }) as T[];

    const sortedPlanned = [...plannedVersions].sort(
      (a, b) => a.validFrom.getTime() - b.validFrom.getTime(),
    );

    const previousAdjusted = sortedPlanned.reduce<PlanChange | null>((found, plannedVersion) => {
      if (found) {
        return found;
      }

      const existingMatch = sortedExisting.find(
        (existingVersion) =>
          normalizeIsoDay(existingVersion.validFrom) === normalizeIsoDay(plannedVersion.validFrom),
      );

      if (!existingMatch) {
        return null;
      }

      const oldValidTo = toLabel(existingMatch.validTo);
      const newValidTo = toLabel(plannedVersion.validTo);
      if (oldValidTo !== newValidTo) {
        return { oldValidTo, newValidTo };
      }

      return null;
    }, null);

    const inserted = sortedPlanned.find(
      (version) => normalizeIsoDay(version.validFrom) === normalizeIsoDay(normalizedDate),
    );

    const nextVersion = sortedPlanned.find(
      (version) => version.validFrom.getTime() > normalizedDate.getTime(),
    );

    return {
      plannedVersions: sortedPlanned,
      summary: {
        insertedValidFrom: normalizeIsoDay(normalizedDate),
        insertedValidTo: inserted ? toLabel(inserted.validTo) : 'open',
        previousAdjusted,
        nextVersionValidFrom: nextVersion ? normalizeIsoDay(nextVersion.validFrom) : null,
        replacesSameDay: sortedExisting.some(
          (version) => normalizeIsoDay(version.validFrom) === normalizeIsoDay(normalizedDate),
        ),
      },
      error: null,
    };
  } catch (error) {
    return {
      plannedVersions: sortedExisting,
      summary: {
        insertedValidFrom: normalizeIsoDay(normalizedDate),
        insertedValidTo: 'open',
        previousAdjusted: null,
        nextVersionValidFrom: null,
        replacesSameDay: false,
      },
      error: error instanceof Error ? error.message : 'No se pudo calcular el impacto',
    };
  }
}
