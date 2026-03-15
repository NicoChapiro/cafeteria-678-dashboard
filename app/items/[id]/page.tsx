'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import FieldHint from '@/src/components/feedback/FieldHint';
import InlineAlert from '@/src/components/feedback/InlineAlert';
import Toast from '@/src/components/feedback/Toast';
import { ReturnToLink } from '@/src/components/navigation/ReturnToLink';
import VersionTimelinePreview from '@/src/components/versioning/VersionTimelinePreview';
import type { Branch, Item, ItemCostVersion } from '@/src/domain/types';
import {
  addItemCostVersion,
  getItem,
  listItemCosts,
  upsertItem,
} from '@/src/services/catalog/clientCatalog';

const BRANCHES: Branch[] = ['Santiago', 'Temuco'];
type ItemPageState = 'loading' | 'ready' | 'missing';

type CostFormState = {
  packQtyInBase: string;
  packCostGrossClp: string;
  validFrom: string;
  yieldRateOverride: string;
};

const EMPTY_COST_FORM: CostFormState = {
  packQtyInBase: '',
  packCostGrossClp: '',
  validFrom: '',
  yieldRateOverride: '',
};

type ItemFocusTarget = 'base' | 'cost';

const FOCUS_META: Record<ItemFocusTarget, { label: string; id: string }> = {
  base: { label: 'Datos del ítem', id: 'section-item-base' },
  cost: { label: 'Costos por sucursal', id: 'section-item-costs' },
};

function isItemFocusTarget(value: string | null): value is ItemFocusTarget {
  return value === 'base' || value === 'cost';
}

function toUtcDay(dateValue: string): Date {
  return new Date(`${dateValue}T00:00:00.000Z`);
}

function formatDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : 'abierta';
}

function parseYield(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    throw new Error('yieldRate debe estar entre (0,1]');
  }

  return parsed;
}

function parseCostForm(form: CostFormState): {
  packQtyInBase: number;
  packCostGrossClp: number;
  validFrom: Date;
  yieldRateOverride?: number;
} {
  const packQtyInBase = Number(form.packQtyInBase);
  if (!Number.isFinite(packQtyInBase) || packQtyInBase <= 0) {
    throw new Error('packQtyInBase debe ser > 0');
  }

  const packCostGrossClp = Number(form.packCostGrossClp);
  if (!Number.isFinite(packCostGrossClp) || packCostGrossClp < 0) {
    throw new Error('packCostGrossClp debe ser >= 0');
  }

  if (!form.validFrom) {
    throw new Error('validFrom es obligatorio');
  }

  const validFrom = toUtcDay(form.validFrom);
  if (Number.isNaN(validFrom.getTime())) {
    throw new Error('validFrom inválido');
  }

  const yieldRateOverride = parseYield(form.yieldRateOverride);

  return {
    packQtyInBase,
    packCostGrossClp,
    validFrom,
    yieldRateOverride,
  };
}

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const itemId = useMemo(() => String(params.id), [params.id]);

  const searchParams = useSearchParams();
  const focus = searchParams.get('focus');
  const branchParam = searchParams.get('branch');
  const returnTo = searchParams.get('returnTo');

  const baseSectionRef = useRef<HTMLElement | null>(null);
  const costSectionRef = useRef<HTMLElement | null>(null);
  const [activeFocus, setActiveFocus] = useState<ItemFocusTarget | null>(null);

  const [item, setItem] = useState<Item | null>(null);
  const [pageState, setPageState] = useState<ItemPageState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [costError, setCostError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [costForms, setCostForms] = useState<Record<Branch, CostFormState>>({
    Santiago: EMPTY_COST_FORM,
    Temuco: EMPTY_COST_FORM,
  });
  const [costsByBranch, setCostsByBranch] = useState<Record<Branch, ItemCostVersion[]>>({
    Santiago: [],
    Temuco: [],
  });

  const focusedSectionLabel = useMemo(
    () => (isItemFocusTarget(focus) ? FOCUS_META[focus].label : null),
    [focus],
  );

  useEffect(() => {
    void (async () => {
      setPageState('loading');
      const found = await getItem(itemId);
      setItem(found ?? null);
      setPageState(found ? 'ready' : 'missing');
      setCostsByBranch({
        Santiago: await listItemCosts(itemId, 'Santiago'),
        Temuco: await listItemCosts(itemId, 'Temuco'),
      });
    })();
  }, [itemId]);


  useEffect(() => {
    if (!isItemFocusTarget(focus)) {
      setActiveFocus(null);
      return;
    }

    setActiveFocus(focus);
    const timer = window.setTimeout(() => setActiveFocus(null), 2400);

    const targetRef = focus === 'base' ? baseSectionRef : costSectionRef;
    targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    return () => window.clearTimeout(timer);
  }, [focus]);

  if (pageState === 'loading') {
    return (
      <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <h1>Cargando ítem…</h1>
        <p>Estamos preparando la información para edición.</p>
      </main>
    );
  }

  if (pageState === 'missing') {
    return (
      <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>No encontramos este ítem</h1>
      <p>Puede que haya sido eliminado o que el enlace esté incompleto.</p>
      {returnTo ? <ReturnToLink returnTo={returnTo} /> : null}
      <p>
        <Link href="/items">Volver a ítems</Link>
      </p>
      </main>
    );
  }

  if (!item) {
    return null;
  }

  async function onItemSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const name = String(formData.get('name') ?? '').trim();
      if (!name) {
        throw new Error('name es obligatorio');
      }

      if (!item) {
        throw new Error('ítem no encontrado');
      }

      const updated = await upsertItem({
        id: item.id,
        name,
        category: String(formData.get('category') ?? '').trim() || undefined,
        baseUnit: String(formData.get('baseUnit') ?? item.baseUnit) as Item['baseUnit'],
        yieldRateDefault: parseYield(String(formData.get('yieldRateDefault') ?? '')),
      });

      setItem(updated);
      setSuccessMessage('Datos base guardados correctamente.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Error al actualizar ítem');
    }
  }

  function onCostInputChange(branch: Branch, field: keyof CostFormState, value: string) {
    setCostForms((prev) => ({
      ...prev,
      [branch]: {
        ...prev[branch],
        [field]: value,
      },
    }));
  }



  function getDisabledSaveReason(branch: Branch): string | null {
    const form = costForms[branch];

    if (!form.validFrom) {
      return 'Debes elegir Vigencia desde.';
    }

    const packQtyInBase = Number(form.packQtyInBase);
    if (!form.packQtyInBase.trim() || !Number.isFinite(packQtyInBase) || packQtyInBase <= 0) {
      return 'Falta packQtyInBase.';
    }

    const packCostGrossClp = Number(form.packCostGrossClp);
    if (
      !form.packCostGrossClp.trim()
      || !Number.isFinite(packCostGrossClp)
      || packCostGrossClp < 0
    ) {
      return 'Falta packCostGrossClp.';
    }

    return null;
  }

  async function onAddCost(branch: Branch) {
    setCostError(null);

    try {
      if (!item) {
        throw new Error('ítem no encontrado');
      }

      const parsed = parseCostForm(costForms[branch]);
      const updated = await addItemCostVersion(item.id, branch, parsed);

      setCostsByBranch((prev) => ({ ...prev, [branch]: updated }));
      setCostForms((prev) => ({
        ...prev,
        [branch]: { ...EMPTY_COST_FORM },
      }));
      setSuccessMessage(`Costo agregado en ${branch}.`);
    } catch (submitError) {
      setCostError(submitError instanceof Error ? `${branch}: ${submitError.message}` : `${branch}: error al agregar costo`);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900 }}>
      {successMessage ? <Toast message={successMessage} onClose={() => setSuccessMessage(null)} /> : null}
      <header style={{ marginBottom: 20 }}>
        {returnTo ? <ReturnToLink returnTo={returnTo} /> : null}
        <h1 style={{ marginBottom: 6 }}>Ítem: {item.name}</h1>
        <p style={{ marginTop: 0, color: '#4b5563' }}>
          Edita datos base y costos por sucursal sin salir de la ficha.
        </p>
        <p style={{ marginTop: 0, marginBottom: 12 }}>
          <Link href="/items">← Volver a ítems</Link>
        </p>
        {focusedSectionLabel ? (
          <p
            style={{
              display: 'inline-flex',
              padding: '6px 10px',
              borderRadius: 999,
              border: '1px solid rgba(72, 102, 48, 0.3)',
              background: 'rgba(72, 102, 48, 0.12)',
              fontWeight: 600,
              marginTop: 0,
            }}
          >
            Edición enfocada: {focusedSectionLabel}
          </p>
        ) : null}
      </header>

      <nav
        aria-label="Navegación interna de ficha de ítem"
        style={{ border: '1px solid #ddd', padding: 12, marginBottom: 20, background: '#fafafa', borderRadius: 8 }}
      >
        <strong style={{ display: 'block', marginBottom: 8 }}>Ir a sección</strong>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
          {(['base', 'cost'] as ItemFocusTarget[]).map((target) => (
            <li key={target}>
              <a href={`#${FOCUS_META[target].id}`}>{FOCUS_META[target].label}</a>
            </li>
          ))}
        </ul>
      </nav>

      <section
        id={FOCUS_META.base.id}
        ref={baseSectionRef}
        style={{
          border: activeFocus === 'base' ? '2px solid #6d4c8f' : '1px solid #ddd',
          borderLeft: activeFocus === 'base' ? '6px solid #6d4c8f' : '1px solid #ddd',
          padding: 16,
          marginBottom: 20,
          borderRadius: 8,
          background: activeFocus === 'base' ? 'rgba(214, 186, 232, 0.2)' : '#fff',
        }}
      >
        <h2>Datos del ítem</h2>
        <FieldHint>Actualiza la información base del ítem para mantener consistencia de costeo.</FieldHint>
        <form onSubmit={onItemSubmit} style={{ display: 'grid', gap: 12 }}>
          <label>
            Nombre *
            <br />
            <input name="name" defaultValue={item.name} required style={{ width: '100%' }} />
          </label>

          <label>
            Categoría
            <br />
            <input name="category" defaultValue={item.category ?? ''} style={{ width: '100%' }} />
          </label>

          <label>
            Unidad base *
            <br />
            <select name="baseUnit" defaultValue={item.baseUnit} style={{ width: '100%' }}>
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="unit">unidad</option>
            </select>
          </label>

          <label>
            Rendimiento por defecto (0-1)
            <br />
            <input
              name="yieldRateDefault"
              type="number"
              min="0.0001"
              max="1"
              step="0.0001"
              defaultValue={item.yieldRateDefault ?? ''}
            />
          </label>

          {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

          <button type="submit">Guardar cambios</button>
        </form>
      </section>

      <section
        id={FOCUS_META.cost.id}
        ref={costSectionRef}
        style={{
          border: activeFocus === 'cost' ? '2px solid #6d4c8f' : '1px solid #ddd',
          borderLeft: activeFocus === 'cost' ? '6px solid #6d4c8f' : '1px solid #ddd',
          borderRadius: 8,
          padding: 16,
          background: activeFocus === 'cost' ? 'rgba(214, 186, 232, 0.2)' : '#fff',
        }}
      >
        <h2>Costos por sucursal</h2>
        <FieldHint>Registra costos brutos por pack y su vigencia para cada sucursal.</FieldHint>
        {costError ? <InlineAlert tone="error">{costError}</InlineAlert> : null}

        {BRANCHES.map((branch) => (
          <article
            key={branch}
            style={{ border: branchParam === branch ? '2px solid var(--brand-green)' : '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16, background: branchParam === branch ? 'rgba(72, 102, 48, 0.08)' : undefined }}
          >
            <h3>{branch}</h3>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
              <label>
                Cantidad del pack en unidad base
                <br />
                <input
                  value={costForms[branch].packQtyInBase}
                  onChange={(event) =>
                    onCostInputChange(branch, 'packQtyInBase', event.target.value)
                  }
                  type="number"
                  min="0.0001"
                  step="0.0001"
                />
              </label>

              <label>
                Costo bruto del pack (CLP)
                <br />
                <input
                  value={costForms[branch].packCostGrossClp}
                  onChange={(event) =>
                    onCostInputChange(branch, 'packCostGrossClp', event.target.value)
                  }
                  type="number"
                  min="0"
                  step="1"
                />
              </label>

              <label>
                Rendimiento override (0-1)
                <br />
                <input
                  value={costForms[branch].yieldRateOverride}
                  onChange={(event) =>
                    onCostInputChange(branch, 'yieldRateOverride', event.target.value)
                  }
                  type="number"
                  min="0.0001"
                  max="1"
                  step="0.0001"
                />
              </label>
            </div>

            <VersionTimelinePreview
              title="Nueva versión de costo"
              branchLabel={branch}
              existingVersions={costsByBranch[branch]}
              newValidFrom={costForms[branch].validFrom}
              onValidFromChange={(value) => onCostInputChange(branch, 'validFrom', value)}
              onSave={() => void onAddCost(branch)}
              disabledSaveReason={getDisabledSaveReason(branch)}
              saveLabel="Agregar costo"
            />

            <h4>Historial</h4>
            <ul style={{ display: 'grid', gap: 6, paddingLeft: 18 }}>
              {[...costsByBranch[branch]]
                .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime())
                .map((version) => (
                <li key={version.id}>
                  {formatDate(version.validFrom)} → {formatDate(version.validTo)} | CLP{' '}
                  {version.packCostGrossClp}
                </li>
              ))}
              {costsByBranch[branch].length === 0 ? <li>Sin costos aún.</li> : null}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}
