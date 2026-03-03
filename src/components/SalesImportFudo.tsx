'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { parseFudoProductsXlsx, type FudoParsedRow } from '@/src/services/fudoReport';
import {
  importSalesSantiago,
  importSalesTemuco,
  listProducts,
  resolveProductIdByAlias,
  upsertProduct,
} from '@/src/storage/local/store';

type BranchOption = 'Santiago' | 'Temuco';

type PreviewState = {
  rowsRead: number;
  validRows: FudoParsedRow[];
  unknownProducts: Map<string, { displayName: string; count: number }>;
  errors: string[];
  dateMin: string | null;
  dateMax: string | null;
  totalGross: number;
  totalQty: number;
};

type Message = {
  type: 'success' | 'error';
  text: string;
};

type Props =
  | {
      mode: 'select';
      defaultKeepSales?: boolean;
      defaultCreateMissingProducts?: boolean;
    }
  | {
      mode: 'fixed';
      fixedBranch: BranchOption;
      defaultKeepSales?: boolean;
      defaultCreateMissingProducts?: boolean;
    };

const BRANCHES: BranchOption[] = ['Santiago', 'Temuco'];

function toPreview(buffer: ArrayBuffer): PreviewState {
  const parsed = parseFudoProductsXlsx(buffer);
  const products = listProducts();
  const productsById = new Map(products.map((product) => [product.id, product]));
  const productsByNormalizedName = new Map(
    products.map((product) => [product.name.trim().toLocaleLowerCase('es-CL'), product]),
  );
  const unknownProducts = new Map<string, { displayName: string; count: number }>();

  const validRows = parsed.rows.map((row) => {
    const externalName = row.productName.trim();
    const normalizedName = externalName.toLocaleLowerCase('es-CL');
    const aliasProductId = resolveProductIdByAlias('fudo', externalName);

    if (aliasProductId) {
      const aliasedProduct = productsById.get(aliasProductId);
      if (aliasedProduct) {
        return { ...row, productName: aliasedProduct.name };
      }
    }

    const matchedProduct = productsByNormalizedName.get(normalizedName);
    if (matchedProduct) {
      return { ...row, productName: matchedProduct.name };
    }

    if (normalizedName) {
      const current = unknownProducts.get(normalizedName);
      if (current) {
        current.count += 1;
      } else {
        unknownProducts.set(normalizedName, { displayName: externalName, count: 1 });
      }
    }

    return row;
  });

  return {
    rowsRead: parsed.rowsRead,
    validRows,
    unknownProducts,
    errors: parsed.errors,
    dateMin: parsed.dateMin,
    dateMax: parsed.dateMax,
    totalGross: parsed.totalGross,
    totalQty: parsed.totalQty,
  };
}


function canonicalizeRowsByAlias(rows: FudoParsedRow[]): FudoParsedRow[] {
  const productsById = new Map(listProducts().map((product) => [product.id, product]));

  return rows.map((row) => {
    const productId = resolveProductIdByAlias('fudo', row.productName);
    if (!productId) {
      return row;
    }

    const canonicalProduct = productsById.get(productId);
    if (!canonicalProduct) {
      return row;
    }

    return {
      ...row,
      productName: canonicalProduct.name,
    };
  });
}

export default function SalesImportFudo(props: Props) {
  const { mode, defaultKeepSales = true, defaultCreateMissingProducts = true } = props;

  const [selectedBranch, setSelectedBranch] = useState<BranchOption>(
    mode === 'fixed' ? props.fixedBranch : 'Santiago',
  );
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [keepSales, setKeepSales] = useState(defaultKeepSales);
  const [createMissingProducts, setCreateMissingProducts] = useState(defaultCreateMissingProducts);
  const [strictMode, setStrictMode] = useState(false);

  const branch: BranchOption = mode === 'fixed' ? props.fixedBranch : selectedBranch;
  const previewRows = useMemo(() => preview?.validRows.slice(0, 40) ?? [], [preview]);
  const unknownProductsTop = useMemo(
    () =>
      [...(preview?.unknownProducts.entries() ?? [])]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 20),
    [preview],
  );
  const showKeepSales = branch === 'Temuco';
  const hasUnknownProducts = (preview?.unknownProducts.size ?? 0) > 0;

  async function handlePreview(): Promise<void> {
    if (!file) {
      setMessage({ type: 'error', text: 'Selecciona un archivo .xlsx para previsualizar.' });
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      setPreview(toPreview(buffer));
      setMessage({ type: 'success', text: 'Previsualización lista.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo procesar el archivo.',
      });
    }
  }

  function ensureMissingProducts(rows: FudoParsedRow[]): number {
    const existing = new Set(
      listProducts().map((product) => product.name.trim().toLocaleLowerCase('es-CL')),
    );

    let createdProductsCount = 0;

    rows.forEach((row) => {
      const productName = row.productName.trim();
      const normalizedName = productName.toLocaleLowerCase('es-CL');
      if (!normalizedName || existing.has(normalizedName)) {
        return;
      }

      upsertProduct({
        id: `product-fudo-${crypto.randomUUID()}`,
        name: productName,
        category: row.category ?? row.subCategory,
        recipeId: null,
        active: true,
      });
      existing.add(normalizedName);
      createdProductsCount += 1;
    });

    return createdProductsCount;
  }

  function handleImport(): void {
    if (!preview) {
      setMessage({ type: 'error', text: 'Primero genera una previsualización.' });
      return;
    }

    try {
      const rowsToImport = canonicalizeRowsByAlias(preview.validRows);

      if (branch === 'Santiago') {
        const summary = importSalesSantiago(rowsToImport, {
          createMissingProducts,
      if (strictMode && hasUnknownProducts) {
        setMessage({
          type: 'error',
          text: 'Hay productos no mapeados; crea alias o corrige nombres.',
        });
        return;
      }

      const canCreateMissingProducts = strictMode ? false : createMissingProducts;

      if (branch === 'Santiago') {
        const summary = importSalesSantiago(preview.validRows, {
          createMissingProducts: canCreateMissingProducts,
          rowsRead: preview.rowsRead,
        });

        setMessage({
          type: 'success',
          text: `Importación OK (${branch}). Filas válidas: ${summary.rowsValid}. Productos creados: ${summary.createdProductsCount}.`,
        });
        return;
      }

      let createdProductsCount = 0;
      if (createMissingProducts) {
        createdProductsCount = ensureMissingProducts(rowsToImport);
      if (canCreateMissingProducts) {
        createdProductsCount = ensureMissingProducts(preview.validRows);
      }

      const rowsForTemuco = rowsToImport.map((row) => ({
        date: row.date,
        product: row.productName,
        qty: row.qty,
        gross: row.grossSalesClp,
      }));

      const result = importSalesTemuco(rowsForTemuco, { keepSales });
      const baseText = `Importación OK (${branch}). Importadas: ${result.imported}, actualizadas: ${result.updated}, omitidas: ${result.skipped}.`;

      if (result.errors.length > 0) {
        setMessage({
          type: 'error',
          text: `${baseText} Errores: ${result.errors.slice(0, 3).join(' | ')}`,
        });
        return;
      }

      const createdText = canCreateMissingProducts ? ` Productos creados: ${createdProductsCount}.` : '';
      setMessage({ type: 'success', text: `${baseText}${createdText}` });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo importar el archivo.',
      });
    }
  }

  return (
    <section className="card" style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        {mode === 'select' ? (
          <label>
            Sucursal
            <br />
            <select
              className="select"
              value={selectedBranch}
              onChange={(event) => {
                setSelectedBranch(event.target.value as BranchOption);
                setPreview(null);
                setMessage(null);
              }}
            >
              {BRANCHES.map((branchOption) => (
                <option key={branchOption} value={branchOption}>
                  {branchOption}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Sucursal: <strong>{branch}</strong>
          </p>
        )}

        <label>
          Archivo Reporte-Productos
          <br />
          <input
            className="input"
            type="file"
            accept=".xlsx"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
              setMessage(null);
            }}
          />
        </label>

        <button className="btn" type="button" onClick={() => void handlePreview()}>
          Previsualizar
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {showKeepSales ? (
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={keepSales}
              onChange={(event) => setKeepSales(event.target.checked)}
            />
            Mantener ventas existentes fuera del rango importado
          </label>
        ) : null}

        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={strictMode}
            onChange={(event) => {
              const checked = event.target.checked;
              setStrictMode(checked);
              if (checked) {
                setCreateMissingProducts(false);
              }
            }}
          />
          Modo estricto (no crear productos faltantes)
        </label>

        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={createMissingProducts}
            onChange={(event) => setCreateMissingProducts(event.target.checked)}
            disabled={strictMode}
          />
          Crear productos faltantes
        </label>

        <button
          className="btnSecondary"
          type="button"
          onClick={handleImport}
          disabled={!preview || (strictMode && hasUnknownProducts)}
        >
          Importar
        </button>
      </div>

      {message ? (
        <p style={{ color: message.type === 'error' ? '#b00020' : '#0f5132' }}>{message.text}</p>
      ) : null}

      {preview ? (
        <section style={{ marginBottom: 16 }}>
          <h2>Resumen</h2>
          <ul>
            <li>Filas leídas: {preview.rowsRead}</li>
            <li>Filas válidas: {preview.validRows.length}</li>
            <li>Rango fechas: {preview.dateMin ?? '-'} a {preview.dateMax ?? '-'}</li>
            <li>Total ventas (CLP): {preview.totalGross}</li>
            <li>Total qty: {preview.totalQty}</li>
            <li>Warnings/errores: {preview.errors.length}</li>
          </ul>

          {preview.errors.length > 0 ? (
            <details>
              <summary>Ver warnings/errores</summary>
              <ul>
                {preview.errors.slice(0, 100).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </details>
          ) : null}

          {hasUnknownProducts ? (
            <section>
              <h3>Productos no mapeados ({preview?.unknownProducts.size ?? 0})</h3>
              <p style={{ marginTop: 0 }}>
                Crea alias FU.DO o corrige nombres para continuar.
                {' '}
                <Link href="/products/aliases">Ir a aliases</Link>
              </p>
              <ul>
                {unknownProductsTop.map(([normalizedName, value]) => (
                  <li key={normalizedName}>
                    {value.displayName}: {value.count}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>
      ) : null}

      {previewRows.length > 0 ? (
        <section>
          <h2>Preview (primeras {previewRows.length} filas)</h2>
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>date</th>
                  <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>productName</th>
                  <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>qty</th>
                  <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: 8 }}>
                    grossSalesClp
                  </th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={`${row.date}-${row.productName}-${index}`}>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{row.date}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{row.productName}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{row.qty}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{row.grossSalesClp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  );
}
