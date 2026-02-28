'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

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

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [lines, setLines] = useState<RecipeLine[]>([]);

  const [metaError, setMetaError] = useState<string | null>(null);
  const [lineError, setLineError] = useState<string | null>(null);

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
    const found = getRecipe(recipeId);
    setRecipe(found ?? null);

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

  if (!recipe) {
    return (
      <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <h1>Receta no encontrada</h1>
        <p>
          <Link href="/recipes">Volver a recetas</Link>
        </p>
      </main>
    );
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
    } catch (error) {
      setLineError(error instanceof Error ? error.message : 'Error al agregar sub-receta');
    }
  }

  function handleDeleteLine(id: string) {
    deleteRecipeLine(id);
    setLines(listRecipeLines(recipeId));
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
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1000 }}>
      <h1>Receta: {recipe.name}</h1>
      <p>
        <Link href="/recipes">Volver a recetas</Link>
      </p>

      <section style={{ border: '1px solid #ddd', padding: 16, marginBottom: 20 }}>
        <h2>Metadatos</h2>
        <form onSubmit={handleMetaSubmit} style={{ display: 'grid', gap: 12 }}>
          <label>
            Name *
            <br />
            <input name="name" defaultValue={recipe.name} required style={{ width: '100%' }} />
          </label>

          <label>
            Type *
            <br />
            <select name="type" defaultValue={recipe.type} style={{ width: '100%' }}>
              {RECIPE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label>
            Yield Qty *
            <br />
            <input
              name="yieldQty"
              type="number"
              min="0.0001"
              step="0.0001"
              defaultValue={recipe.yieldQty}
              required
            />
          </label>

          <label>
            Yield Unit *
            <br />
            <select name="yieldUnit" defaultValue={recipe.yieldUnit} style={{ width: '100%' }}>
              {YIELD_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>

          <label>
            <input name="active" type="checkbox" defaultChecked={recipe.active} /> Active
          </label>

          {metaError ? <p style={{ color: 'crimson' }}>{metaError}</p> : null}

          <button type="submit">Guardar cambios</button>
        </form>
      </section>

      <section style={{ border: '1px solid #ddd', padding: 16, marginBottom: 20 }}>
        <h2>Costeo teórico</h2>

        <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <label>
            Sucursal
            <br />
            <select value={costingBranch} onChange={(event) => setCostingBranch(event.target.value as Branch)}>
              {BRANCHES.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </label>

          <label>
            Fecha (as-of)
            <br />
            <input type="date" value={costingAsOfDate} onChange={(event) => setCostingAsOfDate(event.target.value)} />
          </label>

          <button type="button" onClick={handleCalculateCost}>Calcular costo</button>
        </div>

        {costingError ? <p style={{ color: 'crimson' }}>{costingError}</p> : null}

        {costingResult ? (
          <>
            <p>
              <strong>Costo total (CLP): </strong>
              {Math.round(costingResult.totalCostClp).toLocaleString('es-CL')}
            </p>
            <p>
              <strong>Costo por unidad de yield (CLP): </strong>
              {Math.round(costingResult.costPerYieldUnitClp).toLocaleString('es-CL')}
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>Tipo</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>Nombre</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>Cantidad</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>Unidad</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>Costo unitario efectivo</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #ccc' }}>Costo línea</th>
                </tr>
              </thead>
              <tbody>
                {costingResult.rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.type}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.name}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.qty.toLocaleString('es-CL')}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.unit}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{Math.round(row.effectiveUnitCostClp).toLocaleString('es-CL')}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{Math.round(row.lineCostClp).toLocaleString('es-CL')}</td>
                  </tr>
                ))}
                {costingResult.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 8 }}>Sin líneas para costear.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </>
        ) : null}
      </section>

      <section style={{ border: '1px solid #ddd', padding: 16 }}>
        <h2>Líneas de receta</h2>
        {lineError ? <p style={{ color: 'crimson' }}>{lineError}</p> : null}

        <article style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12 }}>
          <h3>Agregar línea ITEM</h3>
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
            <button type="button" onClick={handleAddItemLine}>
              Agregar línea item
            </button>
          </p>
        </article>

        <article style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12 }}>
          <h3>Agregar línea SUB-RECETA</h3>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '2fr 1fr' }}>
            <label>
              Sub-receta (solo activas)
              <br />
              <select
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
              Qty en yield de sub-receta
              <br />
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                value={subQty}
                onChange={(event) => setSubQty(event.target.value)}
              />
            </label>
          </div>

          <p>
            <button type="button" onClick={handleAddSubRecipeLine}>
              Agregar sub-receta
            </button>
          </p>
        </article>

        <article style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12 }}>
          <h3>Listado de líneas</h3>
          <ul>
            {lines.map((line) => {
              if (line.lineType === 'item') {
                const item = allItems.find((entry) => entry.id === line.itemId);
                return (
                  <li key={line.id}>
                    ITEM: {item?.name ?? line.itemId} | qtyInBase: {line.qtyInBase}
                    <button
                      type="button"
                      style={{ marginLeft: 8 }}
                      onClick={() => handleDeleteLine(line.id)}
                    >
                      Eliminar
                    </button>
                  </li>
                );
              }

              const sub = allRecipes.find((entry) => entry.id === line.subRecipeId);
              return (
                <li key={line.id}>
                  SUB-RECETA: {sub?.name ?? line.subRecipeId} | qtyInSubYield:{' '}
                  {line.qtyInSubYield}
                  <button
                    type="button"
                    style={{ marginLeft: 8 }}
                    onClick={() => handleDeleteLine(line.id)}
                  >
                    Eliminar
                  </button>
                </li>
              );
            })}
            {lines.length === 0 ? <li>Sin líneas aún.</li> : null}
          </ul>
        </article>
      </section>
    </main>
  );
}
