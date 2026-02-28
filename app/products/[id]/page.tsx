'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import type {
  Branch,
  Product,
  ProductCostVersion,
  ProductPriceVersion,
  Recipe,
} from '@/src/domain/types';
import { costRecipe } from '@/src/services/costing';
import { getProductWasteRate } from '@/src/services/product-waste';
import {
  addProductCostVersion,
  addProductPriceVersion,
  getProduct,
  listItemCosts,
  listItems,
  listProductCosts,
  listProductPrices,
  listRecipeLines,
  listRecipes,
  updateProductCostVersionValidFrom,
  upsertProduct,
} from '@/src/storage/local/store';

const BRANCHES: Branch[] = ['Santiago', 'Temuco'];

type MoneyVersionForm = {
  validFrom: string;
  amount: string;
};

const EMPTY_FORM: MoneyVersionForm = {
  validFrom: '',
  amount: '',
};

function formatDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : 'abierta';
}

function toUtcDay(dateValue: string): Date {
  return new Date(`${dateValue}T00:00:00.000Z`);
}

function parseMoneyVersion(form: MoneyVersionForm, label: string): {
  validFrom: Date;
  amount: number;
} {
  if (!form.validFrom) {
    throw new Error('validFrom es obligatorio');
  }

  const validFrom = toUtcDay(form.validFrom);
  if (Number.isNaN(validFrom.getTime())) {
    throw new Error('validFrom inválido');
  }

  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${label} debe ser >= 0`);
  }

  return { validFrom, amount };
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function selectEffectiveManualCost(
  versions: ProductCostVersion[],
  asOfDate: Date,
): number | null {
  const target = asOfDate.getTime();
  const effective = versions
    .filter((version) => {
      const from = version.validFrom.getTime();
      const to = version.validTo ? version.validTo.getTime() : Number.POSITIVE_INFINITY;
      return from <= target && target <= to;
    })
    .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0];

  return effective ? effective.costGrossClp : null;
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = useMemo(() => String(params.id), [params.id]);

  const [product, setProduct] = useState<Product | null>(null);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);

  const [baseError, setBaseError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [costError, setCostError] = useState<string | null>(null);

  const [priceForms, setPriceForms] = useState<Record<Branch, MoneyVersionForm>>({
    Santiago: EMPTY_FORM,
    Temuco: EMPTY_FORM,
  });
  const [costForms, setCostForms] = useState<Record<Branch, MoneyVersionForm>>({
    Santiago: EMPTY_FORM,
    Temuco: EMPTY_FORM,
  });
  const [costValidFromEdit, setCostValidFromEdit] = useState<Record<Branch, string>>({
    Santiago: '',
    Temuco: '',
  });

  const [pricesByBranch, setPricesByBranch] = useState<
    Record<Branch, ProductPriceVersion[]>
  >({
    Santiago: [],
    Temuco: [],
  });
  const [costsByBranch, setCostsByBranch] = useState<Record<Branch, ProductCostVersion[]>>({
    Santiago: [],
    Temuco: [],
  });

  const [marginAsOfDate, setMarginAsOfDate] = useState<string>(todayInputValue());

  useEffect(() => {
    const found = getProduct(productId);
    setProduct(found ?? null);
    setAllRecipes(listRecipes());
    setPricesByBranch({
      Santiago: listProductPrices(productId, 'Santiago'),
      Temuco: listProductPrices(productId, 'Temuco'),
    });
    const initialCosts = {
      Santiago: listProductCosts(productId, 'Santiago'),
      Temuco: listProductCosts(productId, 'Temuco'),
    };
    setCostsByBranch(initialCosts);
    setCostValidFromEdit({
      Santiago: initialCosts.Santiago[0]?.validFrom.toISOString().slice(0, 10) ?? '',
      Temuco: initialCosts.Temuco[0]?.validFrom.toISOString().slice(0, 10) ?? '',
    });
  }, [productId]);

  const costingPreviewByBranch = useMemo(() => {
    if (!product) {
      return {
        Santiago: { cost: null, margin: null, warning: 'Producto no encontrado' },
        Temuco: { cost: null, margin: null, warning: 'Producto no encontrado' },
      };
    }

    const asOfDate = toUtcDay(marginAsOfDate);
    if (Number.isNaN(asOfDate.getTime())) {
      return {
        Santiago: { cost: null, margin: null, warning: 'Fecha inválida' },
        Temuco: { cost: null, margin: null, warning: 'Fecha inválida' },
      };
    }

    const allItems = listItems();
    const recipes = listRecipes();

    const result: Record<
      Branch,
      { cost: number | null; margin: number | null; warning: string | null }
    > = {
      Santiago: { cost: null, margin: null, warning: null },
      Temuco: { cost: null, margin: null, warning: null },
    };

    BRANCHES.forEach((branch) => {
      const currentPrice = pricesByBranch[branch]
        .filter((version) => {
          const from = version.validFrom.getTime();
          const to = version.validTo
            ? version.validTo.getTime()
            : Number.POSITIVE_INFINITY;
          return from <= asOfDate.getTime() && asOfDate.getTime() <= to;
        })
        .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0];

      try {
        let cost: number | null = null;

        if (product.recipeId) {
          const recipe = recipes.find((entry) => entry.id === product.recipeId);
          if (!recipe) {
            throw new Error('Receta asociada no encontrada');
          }

          const context = {
            items: allItems,
            recipes,
            recipeLines: recipes.flatMap((entry) => listRecipeLines(entry.id)),
            itemCostVersions: allItems.flatMap((item) => listItemCosts(item.id, branch)),
          };

          const lines = listRecipeLines(recipe.id);
          const recipeCost = costRecipe(recipe, lines, context, asOfDate, branch);
          cost = recipeCost.costPerYieldUnitClp;
        } else {
          cost = selectEffectiveManualCost(costsByBranch[branch], asOfDate);
        }

        if (cost === null) {
          result[branch] = {
            cost: null,
            margin: null,
            warning: 'No hay costo vigente para la fecha seleccionada',
          };
          return;
        }

        const price = currentPrice?.priceGrossClp ?? null;
        const costWithWaste = cost * (1 + getProductWasteRate(product));
        const margin = price !== null ? price - costWithWaste : null;

        result[branch] = {
          cost: costWithWaste,
          margin,
          warning: price === null ? 'No hay precio vigente para la fecha seleccionada' : null,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error de costeo';

        if (message.includes('Cycle detected')) {
          result[branch] = { cost: null, margin: null, warning: 'Receta con ciclo' };
          return;
        }

        if (message.includes('No effective item cost version')) {
          result[branch] = {
            cost: null,
            margin: null,
            warning: 'Faltan costos vigentes de algún item',
          };
          return;
        }

        result[branch] = { cost: null, margin: null, warning: message };
      }
    });

    return result;
  }, [costsByBranch, marginAsOfDate, pricesByBranch, product]);

  if (!product) {
    return (
      <main>
        <h1>Producto no encontrado</h1>
        <p>
          <Link href="/products">Volver a productos</Link>
        </p>
      </main>
    );
  }

  function onProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBaseError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const name = String(formData.get('name') ?? '').trim();
      if (!name) {
        throw new Error('name es obligatorio');
      }

      const recipeIdRaw = String(formData.get('recipeId') ?? '').trim();

      if (!product) {
        throw new Error('producto no encontrado');
      }

      const wasteRatePct = Number(formData.get('wasteRatePct') ?? String(product.wasteRatePct ?? 3));
      if (!Number.isFinite(wasteRatePct) || wasteRatePct < 0 || wasteRatePct > 30) {
        throw new Error('merma debe estar entre 0 y 30');
      }

      const updated = upsertProduct({
        id: product.id,
        name,
        category: String(formData.get('category') ?? '').trim() || undefined,
        active: String(formData.get('active') ?? '') === 'on',
        recipeId: recipeIdRaw || null,
        wasteRatePct,
      });

      setProduct(updated);
    } catch (submitError) {
      setBaseError(
        submitError instanceof Error ? submitError.message : 'Error al actualizar producto',
      );
    }
  }

  function onPriceInput(branch: Branch, field: keyof MoneyVersionForm, value: string) {
    setPriceForms((prev) => ({
      ...prev,
      [branch]: {
        ...prev[branch],
        [field]: value,
      },
    }));
  }

  function onCostInput(branch: Branch, field: keyof MoneyVersionForm, value: string) {
    setCostForms((prev) => ({
      ...prev,
      [branch]: {
        ...prev[branch],
        [field]: value,
      },
    }));
  }

  function onAddPrice(branch: Branch) {
    setPriceError(null);

    try {
      if (!product) {
        throw new Error('producto no encontrado');
      }

      const parsed = parseMoneyVersion(priceForms[branch], 'priceGrossClp');
      const updated = addProductPriceVersion(product.id, branch, {
        validFrom: parsed.validFrom,
        priceGrossClp: parsed.amount,
      });

      setPricesByBranch((prev) => ({ ...prev, [branch]: updated }));
      setPriceForms((prev) => ({
        ...prev,
        [branch]: { ...EMPTY_FORM },
      }));
    } catch (submitError) {
      setPriceError(
        submitError instanceof Error ? `${branch}: ${submitError.message}` : `${branch}: error`,
      );
    }
  }

  function onAddCost(branch: Branch) {
    setCostError(null);

    try {
      if (!product) {
        throw new Error('producto no encontrado');
      }

      const parsed = parseMoneyVersion(costForms[branch], 'costGrossClp');
      const updated = addProductCostVersion(product.id, branch, {
        validFrom: parsed.validFrom,
        costGrossClp: parsed.amount,
      });

      setCostsByBranch((prev) => ({ ...prev, [branch]: updated }));
      setCostValidFromEdit((prev) => ({
        ...prev,
        [branch]: updated[0]?.validFrom.toISOString().slice(0, 10) ?? '',
      }));
      setCostForms((prev) => ({
        ...prev,
        [branch]: { ...EMPTY_FORM },
      }));
    } catch (submitError) {
      setCostError(
        submitError instanceof Error ? `${branch}: ${submitError.message}` : `${branch}: error`,
      );
    }
  }

  function onChangeFirstCostValidFrom(branch: Branch) {
    setCostError(null);

    try {
      const firstVersion = costsByBranch[branch][0];
      if (!firstVersion) {
        throw new Error('No hay costos para editar');
      }

      const dateValue = costValidFromEdit[branch];
      if (!dateValue) {
        throw new Error('Debes ingresar una fecha');
      }

      const validFrom = toUtcDay(dateValue);
      if (Number.isNaN(validFrom.getTime())) {
        throw new Error('Fecha inválida');
      }

      const nextVersion = costsByBranch[branch][1];
      if (nextVersion && validFrom.getTime() >= nextVersion.validFrom.getTime()) {
        throw new Error('La nueva fecha debe ser menor al siguiente validFrom');
      }

      const updated = updateProductCostVersionValidFrom(firstVersion.id, validFrom);
      setCostsByBranch((prev) => ({ ...prev, [branch]: updated }));
      setCostValidFromEdit((prev) => ({
        ...prev,
        [branch]: updated[0]?.validFrom.toISOString().slice(0, 10) ?? '',
      }));
    } catch (submitError) {
      setCostError(
        submitError instanceof Error ? `${branch}: ${submitError.message}` : `${branch}: error`,
      );
    }
  }

  return (
    <main>
      <h1>Producto: {product.name}</h1>
      <p>
        <Link href="/products">Volver a productos</Link>
      </p>

      <section style={{ border: '1px solid #ddd', padding: 16, marginBottom: 20 }}>
        <h2>Datos base</h2>
        <form onSubmit={onProductSubmit} style={{ display: 'grid', gap: 12 }}>
          <label>
            Name *
            <br />
            <input name="name" defaultValue={product.name} required style={{ width: '100%' }} />
          </label>

          <label>
            Category
            <br />
            <input
              name="category"
              defaultValue={product.category ?? ''}
              style={{ width: '100%' }}
            />
          </label>

          <label>
            Receta (opcional)
            <br />
            <select name="recipeId" defaultValue={product.recipeId ?? ''} style={{ width: '100%' }}>
              <option value="">Sin receta (usa costo manual)</option>
              {allRecipes.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Merma (%)
            <br />
            <input
              name="wasteRatePct"
              type="number"
              min="0"
              max="30"
              step="0.1"
              defaultValue={product.wasteRatePct ?? 3}
              style={{ width: '100%' }}
            />
          </label>

          <label>
            <input name="active" type="checkbox" defaultChecked={product.active} /> Active
          </label>

          {baseError ? <p style={{ color: 'crimson' }}>{baseError}</p> : null}

          <button className="btn" type="submit">Guardar cambios</button>
        </form>
      </section>

      <section style={{ border: '1px solid #ddd', padding: 16, marginBottom: 20 }}>
        <h2>Preview teórico de margen</h2>
        <label>
          Fecha (asOf)
          <br />
          <input
            type="date"
            value={marginAsOfDate}
            onChange={(event) => setMarginAsOfDate(event.target.value)}
          />
        </label>

        <div style={{ marginTop: 12 }}>
          {BRANCHES.map((branch) => {
            const preview = costingPreviewByBranch[branch];
            return (
              <article key={branch} style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12 }}>
                <h3>{branch}</h3>
                <p>
                  Costo teórico:{' '}
                  {preview.cost !== null ? `CLP ${preview.cost.toFixed(2)}` : 'N/D'}
                </p>
                <p>
                  Margen teórico:{' '}
                  {preview.margin !== null ? `CLP ${preview.margin.toFixed(2)}` : 'N/D'}
                </p>
                {preview.warning ? <p style={{ color: 'darkorange' }}>{preview.warning}</p> : null}
              </article>
            );
          })}
        </div>
      </section>

      <section style={{ border: '1px solid #ddd', padding: 16, marginBottom: 20 }}>
        <h2>Precios por sucursal</h2>
        {priceError ? <p style={{ color: 'crimson' }}>{priceError}</p> : null}

        {BRANCHES.map((branch) => (
          <article key={branch} style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12 }}>
            <h3>{branch}</h3>

            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
              <label>
                validFrom
                <br />
                <input
                  type="date"
                  value={priceForms[branch].validFrom}
                  onChange={(event) => onPriceInput(branch, 'validFrom', event.target.value)}
                />
              </label>

              <label>
                priceGrossClp
                <br />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={priceForms[branch].amount}
                  onChange={(event) => onPriceInput(branch, 'amount', event.target.value)}
                />
              </label>
            </div>

            <p>
              <button className="btnSecondary" type="button" onClick={() => onAddPrice(branch)}>
                Agregar precio
              </button>
            </p>

            <h4>Historial</h4>
            <ul>
              {pricesByBranch[branch].map((version) => (
                <li key={version.id}>
                  {formatDate(version.validFrom)} → {formatDate(version.validTo)} | CLP{' '}
                  {version.priceGrossClp}
                </li>
              ))}
              {pricesByBranch[branch].length === 0 ? <li>Sin precios aún.</li> : null}
            </ul>
          </article>
        ))}
      </section>

      <section style={{ border: '1px solid #ddd', padding: 16 }}>
        <h2>Costo manual por sucursal</h2>
        {costError ? <p style={{ color: 'crimson' }}>{costError}</p> : null}

        {BRANCHES.map((branch) => (
          <article key={branch} style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12 }}>
            <h3>{branch}</h3>

            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
              <label>
                validFrom
                <br />
                <input
                  type="date"
                  value={costForms[branch].validFrom}
                  onChange={(event) => onCostInput(branch, 'validFrom', event.target.value)}
                />
              </label>

              <label>
                costGrossClp
                <br />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={costForms[branch].amount}
                  onChange={(event) => onCostInput(branch, 'amount', event.target.value)}
                />
              </label>
            </div>

            <p>
              <button className="btnSecondary" type="button" onClick={() => onAddCost(branch)}>
                Agregar costo
              </button>
            </p>

            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr auto', alignItems: 'end', maxWidth: 420 }}>
              <label>
                Cambiar fecha inicio (primera versión)
                <br />
                <input
                  type="date"
                  value={costValidFromEdit[branch]}
                  onChange={(event) =>
                    setCostValidFromEdit((prev) => ({ ...prev, [branch]: event.target.value }))
                  }
                  disabled={costsByBranch[branch].length === 0}
                />
              </label>
              <button
                type="button"
                onClick={() => onChangeFirstCostValidFrom(branch)}
                disabled={costsByBranch[branch].length === 0}
              >
                Cambiar fecha inicio
              </button>
            </div>

            <h4>Historial</h4>
            <ul>
              {costsByBranch[branch].map((version) => (
                <li key={version.id}>
                  {formatDate(version.validFrom)} → {formatDate(version.validTo)} | CLP{' '}
                  {version.costGrossClp}
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
