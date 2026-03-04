import { useMemo } from 'react';

import type { VersionRecord } from '@/src/services/versioning';

import { computeVersionPlan } from './VersionPlan';

type Props<T extends VersionRecord> = {
  title: string;
  branchLabel: string;
  existingVersions: T[];
  newValidFrom: string;
  onValidFromChange: (value: string) => void;
  onSave: () => void;
  disabledSaveReason: string | null;
  saveLabel: string;
};

function formatDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : 'abierta';
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default function VersionTimelinePreview<T extends VersionRecord>({
  title,
  branchLabel,
  existingVersions,
  newValidFrom,
  onValidFromChange,
  onSave,
  disabledSaveReason,
  saveLabel,
}: Props<T>) {
  const plan = useMemo(
    () => computeVersionPlan(existingVersions, newValidFrom),
    [existingVersions, newValidFrom],
  );

  const changedValidToKeys = useMemo(() => {
    const previousMap = new Map(existingVersions.map((version) => [dayKey(version.validFrom), version]));

    return new Set(
      plan.plannedVersions
        .filter((version) => {
          const original = previousMap.get(dayKey(version.validFrom));
          return !!original && formatDate(original.validTo) !== formatDate(version.validTo);
        })
        .map((version) => dayKey(version.validFrom)),
    );
  }, [existingVersions, plan.plannedVersions]);

  const planError = plan.error;
  const canCompute = !!newValidFrom;
  const insertedKey = plan.summary.insertedValidFrom;
  const isSaveDisabled = !!disabledSaveReason || !!planError || !newValidFrom;

  return (
    <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginTop: 10 }}>
      <h4 style={{ marginTop: 0, marginBottom: 8 }}>{title} · {branchLabel}</h4>

      <label>
        Vigencia desde
        <br />
        <input className="input" type="date" value={newValidFrom} onChange={(event) => onValidFromChange(event.target.value)} />
      </label>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr', marginTop: 10 }}>
        <div>
          <strong>Timeline actual</strong>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>validFrom</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>validTo</th>
              </tr>
            </thead>
            <tbody>
              {existingVersions.map((version) => (
                <tr key={`actual-${dayKey(version.validFrom)}`}>
                  <td>{formatDate(version.validFrom)}</td>
                  <td>{formatDate(version.validTo)}</td>
                </tr>
              ))}
              {existingVersions.length === 0 ? (
                <tr>
                  <td colSpan={2}>Sin versiones aún.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div>
          <strong>Timeline resultante</strong>
          {canCompute ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>validFrom</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>validTo</th>
                </tr>
              </thead>
              <tbody>
                {plan.plannedVersions.map((version) => {
                  const key = dayKey(version.validFrom);
                  const isInserted = key === insertedKey;
                  const isAdjusted = changedValidToKeys.has(key);
                  const background = isInserted ? '#e7f7ed' : isAdjusted ? '#fff5dd' : 'transparent';

                  return (
                    <tr key={`planned-${key}`} style={{ background }}>
                      <td>{formatDate(version.validFrom)}{isInserted ? ' (nueva)' : ''}</td>
                      <td>{formatDate(version.validTo)}{isAdjusted ? ' (ajustada)' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p style={{ marginTop: 6 }}>Ingresa una fecha para ver el resultado.</p>
          )}
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <strong>Impacto</strong>
        {canCompute ? (
          <ul style={{ marginTop: 6 }}>
            {plan.summary.previousAdjusted ? (
              <li>Se ajustará la versión anterior: {plan.summary.previousAdjusted.oldValidTo} → {plan.summary.previousAdjusted.newValidTo}</li>
            ) : (
              <li>No se ajustará una versión anterior.</li>
            )}
            <li>
              Nueva versión quedará vigente hasta:{' '}
              {plan.summary.insertedValidTo === 'open' ? 'Abierta' : plan.summary.insertedValidTo}
            </li>
            {plan.summary.replacesSameDay ? <li>Reemplaza versión del mismo día.</li> : null}
            {plan.summary.nextVersionValidFrom ? (
              <li>Siguiente versión existente desde: {plan.summary.nextVersionValidFrom}</li>
            ) : null}
          </ul>
        ) : (
          <p style={{ marginTop: 6 }}>Sin impacto calculado todavía.</p>
        )}
      </div>

      {planError ? <p style={{ color: 'darkorange', marginBottom: 8 }}>⚠️ {planError}</p> : null}
      {disabledSaveReason ? <p style={{ color: 'darkorange', marginBottom: 8 }}>⚠️ {disabledSaveReason}</p> : null}

      <button className="btnSecondary" type="button" onClick={onSave} disabled={isSaveDisabled}>
        {saveLabel}
      </button>
    </div>
  );
}
