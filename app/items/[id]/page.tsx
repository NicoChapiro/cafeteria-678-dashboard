'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import type { Branch, Item, ItemCostVersion } from '@/src/domain/types';
import {
  addItemCostVersion,
  getItem,
  listItemCosts,
  upsertItem,
} from '@/src/storage/local/store';

const BRANCHES: Branch[] = ['Santiago', 'Temuco'];

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

  const [item, setItem] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [costError, setCostError] = useState<string | null>(null);
  const [costForms, setCostForms] = useState<Record<Branch, CostFormState>>({
    Santiago: EMPTY_COST_FORM,
    Temuco: EMPTY_COST_FORM,
  });
  const [costsByBranch, setCostsByBranch] = useState<Record<Branch, ItemCostVersion[]>>({
    Santiago: [],
    Temuco: [],
  });

  useEffect(() => {
    const found = getItem(itemId);
    setItem(found ?? null);
    setCostsByBranch({
      Santiago: listItemCosts(itemId, 'Santiago'),
      Temuco: listItemCosts(itemId, 'Temuco'),
    });
  }, [itemId]);

  if (!item) {
    return (
      <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <h1>Item no encontrado</h1>
        <p>
          <Link href="/items">Volver a items</Link>
        </p>
      </main>
    );
  }

  function onItemSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const name = String(formData.get('name') ?? '').trim();
      if (!name) {
        throw new Error('name es obligatorio');
      }

      if (!item) {
        throw new Error('item no encontrado');
      }

      const updated = upsertItem({
        id: item.id,
        name,
        category: String(formData.get('category') ?? '').trim() || undefined,
        baseUnit: String(formData.get('baseUnit') ?? item.baseUnit) as Item['baseUnit'],
        yieldRateDefault: parseYield(String(formData.get('yieldRateDefault') ?? '')),
      });

      setItem(updated);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Error al actualizar item');
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

  function onAddCost(branch: Branch) {
    setCostError(null);

    try {
      if (!item) {
        throw new Error('item no encontrado');
      }

      const parsed = parseCostForm(costForms[branch]);
      const updated = addItemCostVersion(item.id, branch, parsed);

      setCostsByBranch((prev) => ({ ...prev, [branch]: updated }));
      setCostForms((prev) => ({
        ...prev,
        [branch]: { ...EMPTY_COST_FORM },
      }));
    } catch (submitError) {
      setCostError(submitError instanceof Error ? `${branch}: ${submitError.message}` : `${branch}: error al agregar costo`);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 900 }}>
      <h1>Item: {item.name}</h1>
      <p>
        <Link href="/items">Volver a items</Link>
      </p>

      <section style={{ border: '1px solid #ddd', padding: 16, marginBottom: 20 }}>
        <h2>Datos del item</h2>
        <form onSubmit={onItemSubmit} style={{ display: 'grid', gap: 12 }}>
          <label>
            Name *
            <br />
            <input name="name" defaultValue={item.name} required style={{ width: '100%' }} />
          </label>

          <label>
            Category
            <br />
            <input name="category" defaultValue={item.category ?? ''} style={{ width: '100%' }} />
          </label>

          <label>
            Base Unit *
            <br />
            <select name="baseUnit" defaultValue={item.baseUnit} style={{ width: '100%' }}>
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="unit">unit</option>
            </select>
          </label>

          <label>
            Yield Rate Default (0-1)
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

          {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}

          <button type="submit">Guardar cambios</button>
        </form>
      </section>

      <section>
        <h2>Costos por sucursal</h2>
        {costError ? <p style={{ color: 'crimson' }}>{costError}</p> : null}

        {BRANCHES.map((branch) => (
          <article
            key={branch}
            style={{ border: '1px solid #ddd', padding: 16, marginBottom: 16 }}
          >
            <h3>{branch}</h3>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
              <label>
                packQtyInBase
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
                packCostGrossClp
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
                validFrom
                <br />
                <input
                  value={costForms[branch].validFrom}
                  onChange={(event) => onCostInputChange(branch, 'validFrom', event.target.value)}
                  type="date"
                />
              </label>

              <label>
                yieldRateOverride (0-1)
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

            <p>
              <button type="button" onClick={() => onAddCost(branch)}>
                Agregar costo
              </button>
            </p>

            <h4>Historial</h4>
            <ul>
              {costsByBranch[branch].map((version) => (
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
