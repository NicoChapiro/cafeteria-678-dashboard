'use client';

import * as XLSX from 'xlsx';
import { useState, type ChangeEventHandler } from 'react';

import { importSalesTemuco, type TemucoSalesImportRow } from '@/src/storage/local/store';


type DetectedKeys = {
  dateKey: string;
  productKey: string;
  qtyKey: string;
  grossKey: string;
};

function detectRequiredColumns(headers: string[]): DetectedKeys {
  const normHeader = (value: unknown) =>
    String(value ?? '')
      .trim()
      .toLocaleLowerCase('es-CL')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

  const byNorm = new Map(headers.map((h) => [normHeader(h), h]));

  const findFirst = (candidates: string[]): string | undefined => {
    for (const candidate of candidates) {
      const found = byNorm.get(normHeader(candidate));
      if (found) return found;
    }
    return undefined;
  };

  const dateKey = findFirst(['Fecha', 'date']);
  const productKey = findFirst(['Producto', 'product', 'Producto/Item', 'Item']);

  const qtyKey = findFirst([
    'Cantidad',
    'Cantidades',
    'Cantidades vendidas',
    'Cantidad vendida',
    'Qty',
    'Unidades',
    'Units',
  ]);

  const grossKey = findFirst([
    'Monto total',
    'Monto Total',
    'Monto',
    'Total',
    'Total venta',
    'Venta bruta',
    'Ventas brutas',
    'Importe',
    'Gross',
    'Bruto',
  ]);

  if (!dateKey || !productKey || !qtyKey || !grossKey) {
    throw new Error(
      `No pude detectar columnas obligatorias. dateKey=${dateKey} productKey=${productKey} qtyKey=${qtyKey} grossKey=${grossKey}`,
    );
  }

  return { dateKey, productKey, qtyKey, grossKey };
}

type PreviewState = {
  rowsRead: number;
  validRows: TemucoSalesImportRow[];
  errors: string[];
  dateMin: string | null;
  dateMax: string | null;
  totalGross: number;
  totalQty: number;
};

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('es-CL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  // Excel serial date (si viene como número)
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      return date.toISOString().slice(0, 10);
    }
  }

  const text = String(value ?? '').trim();
  if (!text) return null;

  const normalized = text.replace(/\//g, '-');

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  // dd-mm-yyyy o dd-mm-yy
  const dmy = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (dmy) {
    const dd = String(dmy[1]).padStart(2, '0');
    const mm = String(dmy[2]).padStart(2, '0');
    let yyyy = dmy[3];
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString().slice(0, 10);
}

function parseQty(value: unknown): number | null {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) return 0;

  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return Math.round(parsed * 1000) / 1000;
}

function parseGross(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value < 0) return null;
    return Math.round(value);
  }

  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  // "$ 12.345", "12.345", "12345"
  const cleaned = raw
    .replace(/[$\s]/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '');
  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return Math.round(parsed);
}

function parseWorkbook(fileBuffer: ArrayBuffer): PreviewState {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });

  const preferred =
    workbook.SheetNames.find((name) => name === 'Detalle') ??
    workbook.SheetNames.find((name) => name.toLocaleLowerCase('es-CL').includes('detalle')) ??
    workbook.SheetNames[0];

  const sheet = workbook.Sheets[preferred];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const errors: string[] = [];
  const validRows: TemucoSalesImportRow[] = [];

  let dateMin: string | null = null;
  let dateMax: string | null = null;
  let totalGross = 0;
  let totalQty = 0;

  // Chequeo global de columnas (evita crash y da diagnóstico)
  const headerSet = new Set<string>();
  rows.slice(0, 25).forEach((r) => {
    Object.keys(r).forEach((k) => headerSet.add(normalizeHeader(k)));
  });

  const detectedHeaders = Array.from(headerSet);
  let keys: DetectedKeys;
  try {
    keys = detectRequiredColumns(detectedHeaders);
  } catch (err) {
    return {
      rowsRead: rows.length,
      validRows: [],
      errors: [
        err instanceof Error ? err.message : String(err),
        `Columnas detectadas (normalizadas): ${detectedHeaders.slice(0, 60).join(', ')}`,
      ],
      dateMin: null,
      dateMax: null,
      totalGross: 0,
      totalQty: 0,
    };
  }

  const { dateKey, productKey, qtyKey, grossKey } = keys;

  rows.forEach((rawRow, index) => {
    const rowIndex = index + 2;

    const byHeader = new Map<string, unknown>();
    Object.entries(rawRow).forEach(([key, value]) => {
      byHeader.set(normalizeHeader(key), value);
    });

    const date = toIsoDate(byHeader.get(dateKey));
    const product = String(byHeader.get(productKey) ?? '').trim();

    const qty = parseQty(byHeader.get(qtyKey));

    const gross = parseGross(byHeader.get(grossKey));

    if (!date) {
      errors.push(`fila ${rowIndex} sin fecha válida`);
      return;
    }
    if (!product) {
      errors.push(`fila ${rowIndex} sin producto`);
      return;
    }
    if (qty === null) {
      errors.push(`fila ${rowIndex} cantidad inválida`);
      return;
    }
    if (gross === null) {
      errors.push(`fila ${rowIndex} monto inválido`);
      return;
    }

    validRows.push({ date, product, qty, gross });

    totalGross += gross;
    totalQty += qty;
    dateMin = dateMin === null || date < dateMin ? date : dateMin;
    dateMax = dateMax === null || date > dateMax ? date : dateMax;
  });

  return {
    rowsRead: rows.length,
    validRows,
    errors,
    dateMin,
    dateMax,
    totalGross,
    totalQty: Math.round(totalQty * 1000) / 1000,
  };
}

export default function TemucoImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const canPreview = Boolean(file);
  const canImport = Boolean(preview?.validRows.length);

  const onPickFile: ChangeEventHandler<HTMLInputElement> = (event) => {
    setNotice(null);
    setPreview(null);
    setFile(event.target.files?.[0] ?? null);
  };

  const onPreview = async (): Promise<void> => {
    setNotice(null);

    if (!file) {
      setNotice('Selecciona un archivo .xlsx primero.');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseWorkbook(buffer);
      setPreview(parsed);

      if (parsed.errors.length) {
        setNotice(`Previsualización con ${parsed.errors.length} advertencias/errores.`);
      }
    } catch (error) {
      setPreview(null);
      setNotice(error instanceof Error ? error.message : 'Error desconocido al leer el XLSX.');
    }
  };

  const onImport = async (): Promise<void> => {
    setNotice(null);

    if (!preview?.validRows.length) {
      setNotice('Primero genera una previsualización válida.');
      return;
    }

    try {
      setIsImporting(true);
      importSalesTemuco(preview.validRows);
      setNotice(`Importación OK: ${preview.validRows.length} filas.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Error desconocido al importar.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="page">
      <h1 className="h1">Importar Ventas Temuco (XLSX)</h1>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div>
            <label className="label" htmlFor="file">
              Archivo XLSX
            </label>
            <input id="file" className="input" type="file" accept=".xlsx" onChange={onPickFile} />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btnSecondary" disabled={!canPreview} type="button" onClick={onPreview}>
              Previsualizar
            </button>

            <button className="btn" disabled={!canImport || isImporting} type="button" onClick={onImport}>
              {isImporting ? 'Importando…' : 'Importar'}
            </button>
          </div>

          {notice ? <div className="muted">{notice}</div> : null}
        </div>
      </div>

      {preview ? (
        <div className="card">
          <div className="muted" style={{ marginBottom: 10 }}>
            <div>Filas leídas: {preview.rowsRead}</div>
            <div>Filas válidas: {preview.validRows.length}</div>
            <div>
              Rango fechas: {preview.dateMin ?? '—'} → {preview.dateMax ?? '—'}
            </div>
            <div>Total qty: {preview.totalQty}</div>
            <div>Total gross: {preview.totalGross.toLocaleString('es-CL')}</div>
          </div>

          {preview.errors.length ? (
            <div style={{ marginBottom: 12 }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                Errores/advertencias (primeros 20):
              </div>
              <ul className="muted" style={{ paddingLeft: 18 }}>
                {preview.errors.slice(0, 20).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {preview.validRows.slice(0, 50).map((row, idx) => (
                  <tr key={`${row.date}-${row.product}-${idx}`}>
                    <td>{row.date}</td>
                    <td>{row.product}</td>
                    <td>{row.qty}</td>
                    <td>{row.gross.toLocaleString('es-CL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.validRows.length > 50 ? (
            <div className="muted" style={{ marginTop: 8 }}>
              Mostrando 50 de {preview.validRows.length} filas válidas.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
