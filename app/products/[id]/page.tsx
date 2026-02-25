'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import type {
  Branch,
  Product,
  ProductCostVersion,
  ProductPriceVersion,
} from '@/src/domain/types';
import {
  addProductCostVersion,
  addProductPriceVersion,
  getProduct,
  listProductCosts,
  listProductPrices,
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

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = useMemo(() => String(params.id), [params.id]);

  const [product, setProduct] = useState<Product | null>(null);
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

  useEffect(() => {
    const found = getProduct(productId);
    setProduct(found ?? null);
    setPricesByBranch({
      Santiago: listProductPrices(productId, 'Santiago'),
      Temuco: listProductPrices(productId, 'Temuco'),
    });
    setCostsByBranch({
      Santiago: listProductCosts(productId, 'Santiago'),
      Temuco: listProductCosts(productId, 'Temuco'),
    });
  }, [productId]);

  if (!product) {
    return (
      <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
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

      if (!product) {
        throw new Error('producto no encontrado');
      }

      const updated = upsertProduct({
        id: product.id,
        name,
        category: String(formData.get('category') ?? '').trim() || undefined,
        active: String(formData.get('active') ?? '') === 'on',
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

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1000 }}>
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
            <input name="active" type="checkbox" defaultChecked={product.active} /> Active
          </label>

          {baseError ? <p style={{ color: 'crimson' }}>{baseError}</p> : null}

          <button type="submit">Guardar cambios</button>
        </form>
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
              <button type="button" onClick={() => onAddPrice(branch)}>
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
              <button type="button" onClick={() => onAddCost(branch)}>
                Agregar costo
              </button>
            </p>

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
