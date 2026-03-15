'use client';

import Link from 'next/link';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { ReturnToLink } from '@/src/components/navigation/ReturnToLink';
import FieldHint from '@/src/components/feedback/FieldHint';
import InlineAlert from '@/src/components/feedback/InlineAlert';
import Toast from '@/src/components/feedback/Toast';
import VersionTimelinePreview from '@/src/components/versioning/VersionTimelinePreview';
import type {
  Branch,
  Item,
  ItemCostVersion,
  Product,
  ProductCostVersion,
  ProductPriceVersion,
  Recipe,
  RecipeLine,
} from '@/src/domain/types';
import { costRecipe } from '@/src/services/costing';
import { buildEditorHref } from '@/src/lib/navigation/buildReturnTo';
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
} from '@/src/services/catalog/clientCatalog';

const BRANCHES: Branch[] = ['Santiago', 'Temuco'];

type MoneyVersionForm = {
  validFrom: string;
  amount: string;
};

const EMPTY_FORM: MoneyVersionForm = {
  validFrom: '',
  amount: '',
};

type ProductFocusTarget = 'base' | 'price' | 'manualCost' | 'recipePreview';
type ProductPageState = 'loading' | 'ready' | 'missing';

const FOCUS_META: Record<ProductFocusTarget, { label: string; id: string }> = {
  base: { label: 'Datos base', id: 'section-base' },
  recipePreview: { label: 'Vista teórica', id: 'section-recipe-preview' },
  price: { label: 'Precios', id: 'section-price' },
  manualCost: { label: 'Costos manuales', id: 'section-manual-cost' },
};

function isProductFocusTarget(value: string | null): value is ProductFocusTarget {
  return value === 'base' || value === 'price' || value === 'manualCost' || value === 'recipePreview';
}

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
  const pathname = usePathname();

  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const focus = searchParams.get('focus');
  const branchParam = searchParams.get('branch');

  const baseSectionRef = useRef<HTMLElement | null>(null);
  const priceSectionRef = useRef<HTMLElement | null>(null);
  const manualCostSectionRef = useRef<HTMLElement | null>(null);
  const recipePreviewSectionRef = useRef<HTMLElement | null>(null);
  const [activeFocus, setActiveFocus] = useState<ProductFocusTarget | null>(null);

  const [product, setProduct] = useState<Product | null>(null);
  const [pageState, setPageState] = useState<ProductPageState>('loading');
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [cachedItems, setCachedItems] = useState<Item[]>([]);
  const [cachedRecipeLines, setCachedRecipeLines] = useState<RecipeLine[]>([]);
  const [cachedItemCosts, setCachedItemCosts] = useState<Record<Branch, ItemCostVersion[]>>({ Santiago: [], Temuco: [] });

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const focusedSectionLabel = useMemo(
    () => (isProductFocusTarget(focus) ? FOCUS_META[focus].label : null),
    [focus],
  );

  const recipeHref = useMemo(() => {
    if (!product?.recipeId) {
      return null;
    }

    const serializedSearch = searchParams.toString();
    const contextualReturnTo = serializedSearch ? `${pathname}?${serializedSearch}` : pathname;

    return buildEditorHref(`/recipes/${product.recipeId}`, {
      branch: branchParam ?? undefined,
      returnTo: contextualReturnTo,
    });
  }, [branchParam, pathname, product?.recipeId, searchParams]);


  useEffect(() => {
    void (async () => {
      setPageState('loading');
      const found = await getProduct(productId);
      setProduct(found ?? null);
      setPageState(found ? 'ready' : 'missing');
      const recipes = await listRecipes();
      setAllRecipes(recipes);
      const items = await listItems();
      setCachedItems(items);
      setCachedRecipeLines((await Promise.all(recipes.map((entry) => listRecipeLines(entry.id)))).flat());
      setCachedItemCosts({
        Santiago: (await Promise.all(items.map((item) => listItemCosts(item.id, 'Santiago')))).flat(),
        Temuco: (await Promise.all(items.map((item) => listItemCosts(item.id, 'Temuco')))).flat(),
      });
      setPricesByBranch({
        Santiago: await listProductPrices(productId, 'Santiago'),
        Temuco: await listProductPrices(productId, 'Temuco'),
      });
      const initialCosts = {
        Santiago: await listProductCosts(productId, 'Santiago'),
        Temuco: await listProductCosts(productId, 'Temuco'),
      };
      setCostsByBranch(initialCosts);
      setCostValidFromEdit({
        Santiago: initialCosts.Santiago[0]?.validFrom.toISOString().slice(0, 10) ?? '',
        Temuco: initialCosts.Temuco[0]?.validFrom.toISOString().slice(0, 10) ?? '',
      });
    })();
  }, [productId]);


  useEffect(() => {
    if (!isProductFocusTarget(focus)) {
      setActiveFocus(null);
      return;
    }

    setActiveFocus(focus);
    const timer = window.setTimeout(() => setActiveFocus(null), 2400);

    const targetRef =
      focus === 'base'
        ? baseSectionRef
        : focus === 'price'
          ? priceSectionRef
          : focus === 'manualCost'
            ? manualCostSectionRef
            : recipePreviewSectionRef;

    targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    return () => window.clearTimeout(timer);
  }, [focus]);

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

    const allItems = cachedItems;
    const recipes = allRecipes;

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
            recipeLines: cachedRecipeLines,
            itemCostVersions: cachedItemCosts[branch],
          };

          const lines = cachedRecipeLines.filter((entry) => entry.recipeId === recipe.id);
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
            warning: 'Faltan costos vigentes de algún ítem',
          };
          return;
        }

        result[branch] = { cost: null, margin: null, warning: message };
      }
    });

    return result;
  }, [allRecipes, cachedItemCosts, cachedItems, cachedRecipeLines, costsByBranch, marginAsOfDate, pricesByBranch, product]);

  if (pageState === 'loading') {
    return (
      <main>
        <h1>Cargando producto…</h1>
        <p>Estamos preparando la información para edición.</p>
      </main>
    );
  }

  if (pageState === 'missing') {
    return (
      <main>
        <h1>No encontramos este producto</h1>
        <p>Puede que haya sido eliminado o que el enlace esté incompleto.</p>
        <p>
          <Link href="/products">Volver a productos</Link>
        </p>
      </main>
    );
  }


  if (!product) {
    return null;
  }

  async function onProductSubmit(event: FormEvent<HTMLFormElement>) {
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

      const updated = await upsertProduct({
        id: product.id,
        name,
        category: String(formData.get('category') ?? '').trim() || undefined,
        active: String(formData.get('active') ?? '') === 'on',
        recipeId: recipeIdRaw || null,
        wasteRatePct,
      });

      setProduct(updated);
      setSuccessMessage('Datos base guardados correctamente.');
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



  function getDisabledPriceReason(branch: Branch): string | null {
    const form = priceForms[branch];

    if (!form.validFrom) {
      return 'Debes elegir Vigencia desde.';
    }

    const amount = Number(form.amount);
    if (!form.amount.trim() || !Number.isFinite(amount) || amount < 0) {
      return 'Ingresa un precio bruto válido.';
    }

    return null;
  }

  function getDisabledManualCostReason(branch: Branch): string | null {
    const form = costForms[branch];

    if (!form.validFrom) {
      return 'Debes elegir Vigencia desde.';
    }

    const amount = Number(form.amount);
    if (!form.amount.trim() || !Number.isFinite(amount) || amount < 0) {
      return 'Ingresa un costo bruto válido.';
    }

    return null;
  }

  async function onAddPrice(branch: Branch) {
    setPriceError(null);

    try {
      if (!product) {
        throw new Error('producto no encontrado');
      }

      const parsed = parseMoneyVersion(priceForms[branch], 'precio');
      const updated = await addProductPriceVersion(product.id, branch, {
        validFrom: parsed.validFrom,
        priceGrossClp: parsed.amount,
      });

      setPricesByBranch((prev) => ({ ...prev, [branch]: updated }));
      setPriceForms((prev) => ({
        ...prev,
        [branch]: { ...EMPTY_FORM },
      }));
      setSuccessMessage(`Precio agregado en ${branch}.`);
    } catch (submitError) {
      setPriceError(
        submitError instanceof Error ? `${branch}: ${submitError.message}` : `${branch}: error`,
      );
    }
  }

  async function onAddCost(branch: Branch) {
    setCostError(null);

    try {
      if (!product) {
        throw new Error('producto no encontrado');
      }

      const parsed = parseMoneyVersion(costForms[branch], 'costo');
      const updated = await addProductCostVersion(product.id, branch, {
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
      setSuccessMessage(`Costo manual agregado en ${branch}.`);
    } catch (submitError) {
      setCostError(
        submitError instanceof Error ? `${branch}: ${submitError.message}` : `${branch}: error`,
      );
    }
  }

  async function onChangeFirstCostValidFrom(branch: Branch) {
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

      const updated = await updateProductCostVersionValidFrom(firstVersion.id, validFrom);
      setCostsByBranch((prev) => ({ ...prev, [branch]: updated }));
      setCostValidFromEdit((prev) => ({
        ...prev,
        [branch]: updated[0]?.validFrom.toISOString().slice(0, 10) ?? '',
      }));
      setSuccessMessage(`Fecha de inicio del costo actualizada en ${branch}.`);
    } catch (submitError) {
      setCostError(
        submitError instanceof Error ? `${branch}: ${submitError.message}` : `${branch}: error`,
      );
    }
  }

  return (
    <main>
      {successMessage ? <Toast message={successMessage} onClose={() => setSuccessMessage(null)} /> : null}
      <header style={{ marginBottom: 20 }}>
        {returnTo ? <ReturnToLink returnTo={returnTo} /> : null}
        <h1 style={{ marginBottom: 8 }}>Producto: {product.name}</h1>
        <p style={{ marginTop: 0, marginBottom: 12 }}>
          <Link href="/products">← Volver a productos</Link>
        </p>
        {recipeHref ? (
          <p style={{ marginTop: 0, marginBottom: 12 }}>
            <Link href={recipeHref}>Ver receta asociada →</Link>
          </p>
        ) : null}
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
        aria-label="Navegación interna de ficha de producto"
        style={{ border: '1px solid #ddd', padding: 12, marginBottom: 20, background: '#fafafa' }}
      >
        <strong style={{ display: 'block', marginBottom: 8 }}>Ir a sección</strong>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
          {(
            [
              'base',
              'recipePreview',
              'price',
              'manualCost',
            ] as ProductFocusTarget[]
          ).map((target) => (
            <li key={target}>
              <a href={`#${FOCUS_META[target].id}`}>{FOCUS_META[target].label}</a>
            </li>
          ))}
        </ul>
      </nav>

      <section id={FOCUS_META.base.id} ref={baseSectionRef} style={{ border: activeFocus === 'base' ? '2px solid #6d4c8f' : '1px solid #ddd', borderLeft: activeFocus === 'base' ? '6px solid #6d4c8f' : '1px solid #ddd', padding: 16, marginBottom: 20, borderRadius: 8, background: activeFocus === 'base' ? 'rgba(214, 186, 232, 0.2)' : '#fff' }}>
        <h2>Datos base</h2>
        <form onSubmit={onProductSubmit} style={{ display: 'grid', gap: 12 }}>
          <label>
            Nombre del producto *
            <br />
            <input name="name" defaultValue={product.name} required style={{ width: '100%' }} />
          </label>

          <label>
            Categoría
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
            <FieldHint>Si eliges receta, el costo manual se ignora para la proyección teórica.</FieldHint>
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
            <input name="active" type="checkbox" defaultChecked={product.active} /> Producto activo
          </label>

          {baseError ? <InlineAlert tone="error">{baseError}</InlineAlert> : null}

          <button className="btn" type="submit">Guardar cambios</button>
        </form>
      </section>

      <section id={FOCUS_META.recipePreview.id} ref={recipePreviewSectionRef} style={{ border: activeFocus === 'recipePreview' ? '2px solid #6d4c8f' : '1px solid #ddd', borderLeft: activeFocus === 'recipePreview' ? '6px solid #6d4c8f' : '1px solid #ddd', padding: 16, marginBottom: 20, borderRadius: 8, background: activeFocus === 'recipePreview' ? 'rgba(214, 186, 232, 0.2)' : '#fff' }}>
        <h2>Vista teórica de margen</h2>
        <label>
          Fecha de análisis
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
              <article key={branch} style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12, background: branchParam === branch && activeFocus === 'recipePreview' ? 'rgba(72, 102, 48, 0.08)' : undefined }}>
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

      <section id={FOCUS_META.price.id} ref={priceSectionRef} style={{ border: activeFocus === 'price' ? '2px solid #6d4c8f' : '1px solid #ddd', borderLeft: activeFocus === 'price' ? '6px solid #6d4c8f' : '1px solid #ddd', padding: 16, marginBottom: 20, borderRadius: 8, background: activeFocus === 'price' ? 'rgba(214, 186, 232, 0.2)' : '#fff' }}>
        <h2>Precios por sucursal</h2>
        <FieldHint>Registra el precio bruto vigente para cada sucursal.</FieldHint>
        {priceError ? <InlineAlert tone="error">{priceError}</InlineAlert> : null}

        {BRANCHES.map((branch) => (
          <article key={branch} style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12, background: branchParam === branch && activeFocus === 'price' ? 'rgba(72, 102, 48, 0.08)' : undefined }}>
            <h3>{branch}</h3>

            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
              <label>
                Precio bruto (CLP)
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

            <VersionTimelinePreview
              title="Nueva vigencia de precio"
              branchLabel={branch}
              existingVersions={pricesByBranch[branch]}
              newValidFrom={priceForms[branch].validFrom}
              onValidFromChange={(value) => onPriceInput(branch, 'validFrom', value)}
              onSave={() => void onAddPrice(branch)}
              disabledSaveReason={getDisabledPriceReason(branch)}
              saveLabel="Agregar precio"
            />

            <h4>Historial</h4>
            <ul>
              {[...pricesByBranch[branch]]
                .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime())
                .map((version) => (
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

      <section id={FOCUS_META.manualCost.id} ref={manualCostSectionRef} style={{ border: activeFocus === 'manualCost' ? '2px solid #6d4c8f' : '1px solid #ddd', borderLeft: activeFocus === 'manualCost' ? '6px solid #6d4c8f' : '1px solid #ddd', padding: 16, borderRadius: 8, background: activeFocus === 'manualCost' ? 'rgba(214, 186, 232, 0.2)' : '#fff' }}>
        <h2>Costos manuales por sucursal</h2>
        <FieldHint>Usa esta sección cuando el producto no tenga receta asociada.</FieldHint>
        {costError ? <InlineAlert tone="error">{costError}</InlineAlert> : null}

        {BRANCHES.map((branch) => (
          <article key={branch} style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12, background: branchParam === branch && activeFocus === 'manualCost' ? 'rgba(72, 102, 48, 0.08)' : undefined }}>
            <h3>{branch}</h3>

            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
              <label>
                Costo bruto (CLP)
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

            <VersionTimelinePreview
              title="Nueva vigencia de costo manual"
              branchLabel={branch}
              existingVersions={costsByBranch[branch]}
              newValidFrom={costForms[branch].validFrom}
              onValidFromChange={(value) => onCostInput(branch, 'validFrom', value)}
              onSave={() => void onAddCost(branch)}
              disabledSaveReason={getDisabledManualCostReason(branch)}
              saveLabel="Agregar costo"
            />

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
              {[...costsByBranch[branch]]
                .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime())
                .map((version) => (
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
