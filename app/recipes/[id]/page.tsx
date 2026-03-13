'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import FieldHint from '@/src/components/feedback/FieldHint';
import InlineAlert from '@/src/components/feedback/InlineAlert';
import Toast from '@/src/components/feedback/Toast';
import { ReturnToLink } from '@/src/components/navigation/ReturnToLink';
import type {
  Branch,
  Item,
  Recipe,
  RecipeLine,
  RecipeType,
  YieldUnit,
} from '@/src/domain/types';
import { costRecipe, getEffectiveItemUnitCostClp } from '@/src/services/costing';
import {
  deleteRecipeLine,
  getRecipe,
  listItemCosts,
  listItems,
  listRecipeLines,
  listRecipes,
  upsertRecipe,
  upsertRecipeLine,
} from '@/src/storage/local/store';

const RECIPE_TYPES: RecipeType[] = [
  'fria',
  'caliente',
  'sin_cafeina',
  'pan',
  'sandwich',
  'intermedia',
];
const YIELD_UNITS: YieldUnit[] = ['portion', 'g', 'ml', 'unit'];

const BRANCHES: Branch[] = ['Santiago', 'Temuco'];
type RecipePageState = 'loading' | 'ready' | 'missing';

type CostBreakdownRow = {
  id: string;
  type: 'item' | 'sub';
  name: string;
  qty: number;
  unit: string;
  effectiveUnitCostClp: number;
  lineCostClp: number;
};

type RecipeCostResult = {
  totalCostClp: number;
  costPerYieldUnitClp: number;
  rows: CostBreakdownRow[];
};

type ItemInputUnit = 'g' | 'kg' | 'mg' | 'ml' | 'l' | 'unit';

function itemUnits(baseUnit: Item['baseUnit']): ItemInputUnit[] {
  if (baseUnit === 'g') {
    return ['g', 'kg', 'mg'];
  }

  if (baseUnit === 'ml') {
    return ['ml', 'l'];
  }

  return ['unit'];
}

function convertToBaseQty(baseUnit: Item['baseUnit'], inputUnit: ItemInputUnit, qty: number): number {
  if (baseUnit === 'g') {
    if (inputUnit === 'g') return qty;
    if (inputUnit === 'kg') return qty * 1000;
    if (inputUnit === 'mg') return qty / 1000;
    throw new Error('Unidad incompatible con baseUnit g');
  }

  if (baseUnit === 'ml') {
    if (inputUnit === 'ml') return qty;
    if (inputUnit === 'l') return qty * 1000;
    throw new Error('Unidad incompatible con baseUnit ml');
  }

  if (baseUnit === 'unit') {
    if (inputUnit === 'unit') return qty;
    throw new Error('Unidad incompatible con baseUnit unit');
  }

  throw new Error('baseUnit inválida');
}


function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function toUtcDay(dateValue: string): Date {
  return new Date(`${dateValue}T00:00:00.000Z`);
}

export default function RecipeDetailPage() {
  const params = useParams<{ id: string }>();
  const recipeId = useMemo(() => String(params.id), [params.id]);

  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [pageState, setPageState] = useState<RecipePageState>('loading');
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [lines, setLines] = useState<RecipeLine[]>([]);

  const [metaError, setMetaError] = useState<string | null>(null);
  const [lineError, setLineError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [itemId, setItemId] = useState('');
  const [itemQty, setItemQty] = useState('');
  const [itemUnit, setItemUnit] = useState<ItemInputUnit>('g');

  const [subRecipeId, setSubRecipeId] = useState('');
  const [subQty, setSubQty] = useState('');

  const [costingBranch, setCostingBranch] = useState<Branch>('Santiago');
  const [costingAsOfDate, setCostingAsOfDate] = useState<string>(todayInputValue());
  const [costingResult, setCostingResult] = useState<RecipeCostResult | null>(null);
  const [costingError, setCostingError] = useState<string | null>(null);

  useEffect(() => {
    setPageState('loading');
    const found = getRecipe(recipeId);
    setRecipe(found ?? null);
    setPageState(found ? 'ready' : 'missing');

    const items = listItems();
    const recipes = listRecipes();

    setAllItems(items);
    setAllRecipes(recipes);
    setLines(listRecipeLines(recipeId));

    if (items[0]) {
      setItemId(items[0].id);
      setItemUnit(itemUnits(items[0].baseUnit)[0]);
    }

    const activeSubs = recipes.filter((entry) => entry.active && entry.id !== recipeId);
    if (activeSubs[0]) {
      setSubRecipeId(activeSubs[0].id);
    }
  }, [recipeId]);

  const selectedItem = useMemo(
    () => allItems.find((item) => item.id === itemId),
    [allItems, itemId],
  );

  const selectableSubRecipes = useMemo(
    () => allRecipes.filter((entry) => entry.active && entry.id !== recipeId),
    [allRecipes, recipeId],
  );

  if (pageState === 'loading') {
    return (
      <main className="pageStack" style={{ maxWidth: 1040 }}>
        <section className="card" style={{ marginBottom: 0 }}>
          <h1 style={{ marginTop: 0, marginBottom: 8 }}>Cargando receta…</h1>
          <p className="muted" style={{ margin: 0 }}>Estamos preparando la información para edición.</p>
        </section>
      </main>
    );
  }

  if (pageState === 'missing') {
    return (
      <main className="pageStack" style={{ maxWidth: 1040 }}>
        <section className="card" style={{ marginBottom: 0, display: 'grid', gap: 10 }}>
          <h1 style={{ margin: 0 }}>No encontramos esta receta</h1>
          <p className="muted" style={{ margin: 0 }}>Puede que haya sido eliminada o que el enlace esté incompleto.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/recipes" className="btnSecondary">Volver a recetas</Link>
            <ReturnToLink returnTo={returnTo} />
          </div>
        </section>
      </main>
    );
  }

  if (!recipe) {
    return null;
  }

  function handleMetaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMetaError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const name = String(formData.get('name') ?? '').trim();
      const yieldQty = Number(formData.get('yieldQty'));

      if (!name) {
        throw new Error('name es obligatorio');
      }

      if (!Number.isFinite(yieldQty) || yieldQty <= 0) {
        throw new Error('yieldQty debe ser > 0');
      }

      if (!recipe) {
        throw new Error('receta no encontrada');
      }

      const updated = upsertRecipe({
        id: recipe.id,
        name,
        type: String(formData.get('type') ?? recipe.type) as RecipeType,
        yieldQty,
        yieldUnit: String(formData.get('yieldUnit') ?? recipe.yieldUnit) as YieldUnit,
        active: String(formData.get('active') ?? '') === 'on',
      });

      setRecipe(updated);
      setAllRecipes(listRecipes());
      setSuccessMessage('Metadatos guardados correctamente.');
    } catch (error) {
      setMetaError(error instanceof Error ? error.message : 'Error al guardar metadatos');
    }
  }

  function handleAddItemLine() {
    setLineError(null);

    try {
      if (!selectedItem) {
        throw new Error('Debes seleccionar un item');
      }

      const qty = Number(itemQty);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error('Cantidad de item debe ser > 0');
      }

      const allowedUnits = itemUnits(selectedItem.baseUnit);
      if (!allowedUnits.includes(itemUnit)) {
        throw new Error('Unidad incompatible con baseUnit del item');
      }

      const qtyInBase = convertToBaseQty(selectedItem.baseUnit, itemUnit, qty);
      upsertRecipeLine({
        id: crypto.randomUUID(),
        recipeId,
        lineType: 'item',
        itemId: selectedItem.id,
        qtyInBase,
      });

      setLines(listRecipeLines(recipeId));
      setItemQty('');
      setSuccessMessage('Línea de item agregada correctamente.');
    } catch (error) {
      setLineError(error instanceof Error ? error.message : 'Error al agregar línea item');
    }
  }

  function handleAddSubRecipeLine() {
    setLineError(null);

    try {
      if (!subRecipeId) {
        throw new Error('Debes seleccionar sub-receta');
      }

      if (subRecipeId === recipeId) {
        throw new Error('No se permite usar la misma receta como sub-receta');
      }

      const qty = Number(subQty);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error('qtyInSubYield debe ser > 0');
      }

      upsertRecipeLine({
        id: crypto.randomUUID(),
        recipeId,
        lineType: 'recipe',
        subRecipeId,
        qtyInSubYield: qty,
      });

      setLines(listRecipeLines(recipeId));
      setSubQty('');
      setSuccessMessage('Línea de sub-receta agregada correctamente.');
    } catch (error) {
      setLineError(error instanceof Error ? error.message : 'Error al agregar sub-receta');
    }
  }

  function handleDeleteLine(id: string) {
    deleteRecipeLine(id);
    setLines(listRecipeLines(recipeId));
    setSuccessMessage('Línea eliminada correctamente.');
  }

  function handleCalculateCost() {
    setCostingError(null);

    try {
      if (!recipe) {
        throw new Error('receta no encontrada');
      }

      const asOfDate = toUtcDay(costingAsOfDate);
      if (Number.isNaN(asOfDate.getTime())) {
        throw new Error('Fecha inválida para costeo');
      }

      const items = listItems();
      const recipes = listRecipes();
      const recipeLines = recipes.flatMap((entry) => listRecipeLines(entry.id));
      const itemCostVersions = items.flatMap((item) => listItemCosts(item.id, costingBranch));

      const context = {
        items,
        recipes,
        recipeLines,
        itemCostVersions,
      };

      const recipeLinesCurrent = listRecipeLines(recipe.id);
      const totals = costRecipe(recipe, recipeLinesCurrent, context, asOfDate, costingBranch);

      const rows: CostBreakdownRow[] = recipeLinesCurrent.map((line) => {
        if (line.lineType === 'item') {
          const item = items.find((entry) => entry.id === line.itemId);
          if (!item) {
            throw new Error(`Item no encontrado: ${line.itemId}`);
          }

          const effectiveUnitCostClp = getEffectiveItemUnitCostClp(item, itemCostVersions, asOfDate);
          return {
            id: line.id,
            type: 'item',
            name: item.name,
            qty: line.qtyInBase,
            unit: item.baseUnit,
            effectiveUnitCostClp,
            lineCostClp: line.qtyInBase * effectiveUnitCostClp,
          };
        }

        const subRecipe = recipes.find((entry) => entry.id === line.subRecipeId);
        if (!subRecipe) {
          throw new Error(`Sub-receta no encontrada: ${line.subRecipeId}`);
        }

        const subLines = recipeLines.filter((entry) => entry.recipeId === subRecipe.id);
        const subCost = costRecipe(subRecipe, subLines, context, asOfDate, costingBranch);

        return {
          id: line.id,
          type: 'sub',
          name: subRecipe.name,
          qty: line.qtyInSubYield,
          unit: subRecipe.yieldUnit,
          effectiveUnitCostClp: subCost.costPerYieldUnitClp,
          lineCostClp: line.qtyInSubYield * subCost.costPerYieldUnitClp,
        };
      });

      setCostingResult({
        totalCostClp: totals.totalCostClp,
        costPerYieldUnitClp: totals.costPerYieldUnitClp,
        rows,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al calcular costo';
      if (message.includes('No effective item cost version for item')) {
        const itemId = message.split('item ')[1] ?? '';
        const itemName = allItems.find((entry) => entry.id === itemId)?.name ?? itemId;
        setCostingError(`Falta costo vigente para el item: ${itemName}.`);
      } else {
        setCostingError(message);
      }
      setCostingResult(null);
    }
  }

  return (
    <main className="pageStack" style={{ maxWidth: 1040 }}>
      {successMessage ? <Toast message={successMessage} onClose={() => setSuccessMessage(null)} /> : null}
      <section className="card" style={{ marginBottom: 0, display: 'grid', gap: 10 }}>
        <div className="listPageHeader" style={{ marginBottom: 0 }}>
          <div>
            <h1 style={{ margin: 0 }}>Receta: {recipe.name}</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              Actualiza metadatos, líneas y costeo en una sola vista.
            </p>
          </div>
          <span className={`badge ${recipe.active ? 'badge--success' : 'badge--warn'}`}>
            {recipe.active ? 'Activa' : 'Inactiva'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/recipes" className="btnSecondary">Volver a recetas</Link>
          <ReturnToLink returnTo={returnTo} />
        </div>
      </section>

      <section className="card" style={{ marginBottom: 0, display: 'grid', gap: 14 }}>
        <h2 className="cardTitle">Metadatos</h2>
        <FieldHint>Define los datos base de la receta antes de editar sus líneas y costos.</FieldHint>
        <form onSubmit={handleMetaSubmit} style={{ display: 'grid', gap: 12 }}>
          <label>
            Nombre *
            <br />
            <input className="input" name="name" defaultValue={recipe.name} required style={{ width: '100%' }} />
          </label>

          <label>
            Tipo *
            <br />
            <select className="input" name="type" defaultValue={recipe.type} style={{ width: '100%' }}>
              {RECIPE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label>
            Cantidad de yield *
            <br />
            <input
              className="input"
              name="yieldQty"
              type="number"
              min="0.0001"
              step="0.0001"
              defaultValue={recipe.yieldQty}
              required
            />
          </label>

          <label>
            Unidad de yield *
            <br />
            <select className="input" name="yieldUnit" defaultValue={recipe.yieldUnit} style={{ width: '100%' }}>
              {YIELD_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>

          <label>
            <input name="active" type="checkbox" defaultChecked={recipe.active} /> Activa
          </label>

          {metaError ? <InlineAlert tone="error">{metaError}</InlineAlert> : null}

          <button className="btn" type="submit">Guardar cambios</button>
        </form>
      </section>

      <section className="card" style={{ marginBottom: 0, display: 'grid', gap: 14 }}>
        <h2 className="cardTitle">Costeo teórico</h2>
        <FieldHint>Calcula una vista rápida del costo total y por unidad de yield según sucursal y fecha.</FieldHint>

        <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <label>
            Sucursal
            <br />
            <select className="input" value={costingBranch} onChange={(event) => setCostingBranch(event.target.value as Branch)}>
              {BRANCHES.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </label>

          <label>
            Fecha (as-of)
            <br />
            <input className="input" type="date" value={costingAsOfDate} onChange={(event) => setCostingAsOfDate(event.target.value)} />
          </label>

          <button className="btn" type="button" onClick={handleCalculateCost}>Calcular costo</button>
        </div>

        {costingError ? (
          <div style={{ marginTop: 12 }}>
            <InlineAlert tone="warning">{costingError}</InlineAlert>
          </div>
        ) : null}

        {costingResult ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 14, marginBottom: 14 }}>
              <article style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#f9fafb' }}>
                <small style={{ color: '#6b7280' }}>Costo total (CLP)</small>
                <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 700 }}>
                  {Math.round(costingResult.totalCostClp).toLocaleString('es-CL')}
                </p>
              </article>
              <article style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#f9fafb' }}>
                <small style={{ color: '#6b7280' }}>Costo por unidad de yield (CLP)</small>
                <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 700 }}>
                  {Math.round(costingResult.costPerYieldUnitClp).toLocaleString('es-CL')}
                </p>
              </article>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #ddd' }}>Tipo</th>
                    <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #ddd' }}>Nombre</th>
                    <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #ddd' }}>Cantidad</th>
                    <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #ddd' }}>Unidad</th>
                    <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #ddd' }}>Costo unitario efectivo</th>
                    <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid #ddd' }}>Costo línea</th>
                  </tr>
                </thead>
                <tbody>
                  {costingResult.rows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>{row.type === 'item' ? 'Item' : 'Sub-receta'}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>{row.name}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee', textAlign: 'right' }}>{row.qty.toLocaleString('es-CL')}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>{row.unit}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee', textAlign: 'right' }}>{Math.round(row.effectiveUnitCostClp).toLocaleString('es-CL')}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 600 }}>{Math.round(row.lineCostClp).toLocaleString('es-CL')}</td>
                    </tr>
                  ))}
                  {costingResult.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 10 }}>Sin líneas para costear.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <section className="card" style={{ marginBottom: 0, display: 'grid', gap: 14 }}>
        <h2 className="cardTitle">Líneas de receta</h2>
        <FieldHint>Primero agrega ingredientes (items) y luego sub-recetas según corresponda.</FieldHint>
        {lineError ? <InlineAlert tone="error">{lineError}</InlineAlert> : null}

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: 12 }}>
          <article style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, background: '#fcfdfd' }}>
            <h3 style={{ marginTop: 0 }}>Agregar línea de item</h3>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '2fr 1fr 1fr' }}>
              <label>
                Item
                <br />
                <select
                  value={itemId}
                  onChange={(event) => {
                    const nextItemId = event.target.value;
                    setItemId(nextItemId);
                    const nextItem = allItems.find((entry) => entry.id === nextItemId);
                    if (nextItem) {
                      setItemUnit(itemUnits(nextItem.baseUnit)[0]);
                    }
                  }}
                  className="input"
                  style={{ width: '100%' }}
                >
                  <option value="">Selecciona item</option>
                  {allItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.baseUnit})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Cantidad
                <br />
                <input
                  className="input"
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={itemQty}
                  onChange={(event) => setItemQty(event.target.value)}
                />
              </label>

              <label>
                Unidad
                <br />
                <select
                  className="input"
                  value={itemUnit}
                  onChange={(event) => setItemUnit(event.target.value as ItemInputUnit)}
                >
                  {(selectedItem ? itemUnits(selectedItem.baseUnit) : ['g']).map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p>
              <button className="btn" type="button" onClick={handleAddItemLine}>
                Agregar línea item
              </button>
            </p>
          </article>

          <article style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, background: '#fcfdfd' }}>
            <h3 style={{ marginTop: 0 }}>Agregar línea de sub-receta</h3>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '2fr 1fr' }}>
              <label>
                Sub-receta (solo activas)
                <br />
                <select
                  className="input"
                  value={subRecipeId}
                  onChange={(event) => setSubRecipeId(event.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">Selecciona sub-receta</option>
                  {selectableSubRecipes.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} ({entry.yieldUnit})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Cantidad en yield de sub-receta
                <br />
                <input
                  className="input"
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={subQty}
                  onChange={(event) => setSubQty(event.target.value)}
                />
              </label>
            </div>

            <p>
              <button className="btn" type="button" onClick={handleAddSubRecipeLine}>
                Agregar sub-receta
              </button>
            </p>
          </article>
        </div>

        <article style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 4 }}>
          <h3>Listado de líneas</h3>
          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #ddd' }}>Tipo</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #ddd' }}>Nombre</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #ddd' }}>Cantidad</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #ddd' }}>Referencia</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #ddd' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  if (line.lineType === 'item') {
                    const item = allItems.find((entry) => entry.id === line.itemId);
                    return (
                      <tr key={line.id}>
                        <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>Item</td>
                        <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>{item?.name ?? line.itemId}</td>
                        <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>{line.qtyInBase.toLocaleString('es-CL')}</td>
                        <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>qtyInBase</td>
                        <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>
                          <button
                            className="btnSecondary"
                            type="button"
                            onClick={() => handleDeleteLine(line.id)}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  const sub = allRecipes.find((entry) => entry.id === line.subRecipeId);
                  return (
                    <tr key={line.id}>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>Sub-receta</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>{sub?.name ?? line.subRecipeId}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>{line.qtyInSubYield.toLocaleString('es-CL')}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>qtyInSubYield</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #eee' }}>
                        <button
                          className="btnSecondary"
                          type="button"
                          onClick={() => handleDeleteLine(line.id)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 10 }}>Sin líneas aún.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </main>
  );
}
