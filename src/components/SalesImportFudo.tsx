'use client';

import { useMemo, useState } from 'react';

import { parseFudoProductsXlsx, type FudoParsedRow } from '@/src/services/fudoReport';
import {
  importSalesSantiago,
  importSalesTemuco,
  listProducts,
  upsertProduct,
} from '@/src/storage/local/store';

type BranchOption = 'Santiago' | 'Temuco';

type PreviewState = {
  rowsRead: number;
  validRows: FudoParsedRow[];
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

  return {
    rowsRead: parsed.rowsRead,
    validRows: parsed.rows,
    errors: parsed.errors,
    dateMin: parsed.dateMin,
    dateMax: parsed.dateMax,
    totalGross: parsed.totalGross,
    totalQty: parsed.totalQty,
  };
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

  const branch: BranchOption = mode === 'fixed' ? props.fixedBranch : selectedBranch;
  const previewRows = useMemo(() => preview?.validRows.slice(0, 40) ?? [], [preview]);
  const showKeepSales = branch === 'Temuco';

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
      if (branch === 'Santiago') {
        const summary = importSalesSantiago(preview.validRows, {
          createMissingProducts,
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
        createdProductsCount = ensureMissingProducts(preview.validRows);
      }

      const rowsForTemuco = preview.validRows.map((row) => ({
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

      const createdText = createMissingProducts ? ` Productos creados: ${createdProductsCount}.` : '';
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
            checked={createMissingProducts}
            onChange={(event) => setCreateMissingProducts(event.target.checked)}
          />
          Crear productos faltantes
        </label>

        <button className="btnSecondary" type="button" onClick={handleImport} disabled={!preview}>
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
