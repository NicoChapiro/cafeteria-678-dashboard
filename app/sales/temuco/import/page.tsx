'use client';

import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

import {
  importSalesTemuco,
  type TemucoSalesImportRow,
} from '@/src/storage/local/store';

type RawRow = Record<string, unknown>;

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
    .replace(/[\u0300-\u036f]/g, '');
}

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    }
  }

  const s = String(value ?? '').trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);

  return null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value ?? '').trim();
  if (!s) return 0;
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function parseSheet(sheet: XLSX.WorkSheet): { rows: TemucoSalesImportRow[]; errors: string[]; rowsRead: number } {
  const raw = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null });
  const rawRows = raw as RawRow[];
  if (!raw.length) return { rows: [], errors: ['La hoja seleccionada está vacía.'], rowsRead: 0 };

  const first = raw[0] ?? {};
  const headerMap = new Map<string, string>();
  Object.keys(first).forEach((key) => headerMap.set(normalizeHeader(key), key));

  const dateKey = headerMap.get('fecha') ?? headerMap.get('date');
  const productKey =
    headerMap.get('producto') ??
    headerMap.get('product') ??
    headerMap.get('nombre producto') ??
    headerMap.get('product name');
  const qtyKey =
    headerMap.get('cantidad') ??
    headerMap.get('qty') ??
    headerMap.get('cantidad vendida') ??
    headerMap.get('quantity');
  const grossKey =
    headerMap.get('venta bruta') ??
    headerMap.get('gross') ??
    headerMap.get('gross sales') ??
    headerMap.get('ventas brutas') ??
    headerMap.get('ventas') ??
    headerMap.get('monto');

  // Guard clause: si falta una key obligatoria, abortamos antes de iterar filas.
  if (!dateKey || !productKey || !qtyKey || !grossKey) {
    throw new Error(
      `No pude detectar columnas obligatorias. dateKey=${String(dateKey)} productKey=${String(productKey)} qtyKey=${String(qtyKey)} grossKey=${String(grossKey)}`,
    );
  }

  const out: TemucoSalesImportRow[] = [];
  const errors: string[] = [];

  rawRows.forEach((row, idx) => {
    const date = toIsoDate(row[dateKey]);
    const product = String(row[productKey] ?? '').trim();
    const qty = toNumber(row[qtyKey]);
    const gross = toNumber(row[grossKey]);

    if (!date || !product) {
      errors.push(`Fila ${idx + 2}: fecha o producto inválido.`);
      return;
    }

    out.push({ date, product, qty, gross });
  });

  return { rows: out, errors, rowsRead: rawRows.length };
}

export default function TemucoSalesImportPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [busy, setBusy] = useState(false);
  const [keepSales, setKeepSales] = useState(true);
  const [importResult, setImportResult] = useState<{
    imported: number;
    updated?: number;
    skipped?: number;
    errors?: string[];
  } | null>(null);

  const computed = useMemo(() => {
    if (!workbook || !selectedSheet) return null;
    const sheet = workbook.Sheets[selectedSheet];
    if (!sheet) return null;
    const parsed = parseSheet(sheet);
    const validRows = parsed.rows;
    const dates = validRows.map((r) => r.date).sort();
    const dateMin = dates[0] ?? null;
    const dateMax = dates[dates.length - 1] ?? null;
    const totalGross = validRows.reduce((acc, r) => acc + (r.gross ?? 0), 0);
    const totalQty = validRows.reduce((acc, r) => acc + (r.qty ?? 0), 0);
    const errors = parsed.errors;
    return { validRows, dateMin, dateMax, totalGross, totalQty, errors, rowsRead: parsed.rowsRead };
  }, [workbook, selectedSheet]);

  async function onPickFile(file: File): Promise<void> {
    setImportResult(null);
    setPreview(null);
    setFileName(file.name);

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    setWorkbook(wb);
    setSheetNames(wb.SheetNames);
    setSelectedSheet(wb.SheetNames[0] ?? '');
  }

  function onPreview(): void {
    if (!computed) return;
    setPreview({
      rowsRead: computed.rowsRead,
      validRows: computed.validRows,
      errors: computed.errors,
      dateMin: computed.dateMin,
      dateMax: computed.dateMax,
      totalGross: computed.totalGross,
      totalQty: computed.totalQty,
    });
  }

  async function onImport(): Promise<void> {
    if (!preview) return;
    setBusy(true);
    try {
      const res = importSalesTemuco(preview.validRows, { keepSales });
      setImportResult(res);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header className="card">
        <h1 style={{ marginBottom: 8 }}>Importar Ventas Temuco (XLSX)</h1>
        <p className="muted">
          Este import es igual al de Santiago: mismo reporte, misma validación y mismo flujo.
        </p>
      </header>

      <section className="card" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <label>Archivo XLSX</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPickFile(f);
            }}
          />
          {fileName ? <div className="muted">{fileName}</div> : null}
        </div>

        {sheetNames.length ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <label>Hoja</label>
            <select
              className="select"
              value={selectedSheet}
              onChange={(e) => setSelectedSheet(e.target.value)}
            >
              {sheetNames.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            id="keepSales"
            type="checkbox"
            checked={keepSales}
            onChange={(e) => setKeepSales(e.target.checked)}
          />
          <span>Mantener ventas existentes fuera del rango importado</span>
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btnSecondary"
            disabled={!computed}
            type="button"
            onClick={onPreview}
          >
            Previsualizar
          </button>

          <button
            className="btn"
            disabled={!preview || busy}
            type="button"
            onClick={() => void onImport()}
          >
            {busy ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </section>

      {preview ? (
        <section className="card" style={{ display: 'grid', gap: 8 }}>
          <div>
            <strong>Filas leídas:</strong> {preview.rowsRead}
          </div>
          <div>
            <strong>Filas válidas:</strong> {preview.validRows.length}
          </div>
          <div>
            <strong>Rango fechas:</strong> {preview.dateMin ?? '-'} → {preview.dateMax ?? '-'}
          </div>
          <div>
            <strong>Total Qty:</strong> {preview.totalQty}
          </div>
          <div>
            <strong>Total Gross:</strong> {Math.round(preview.totalGross)}
          </div>

          {preview.errors.length ? (
            <div style={{ marginTop: 8 }}>
              <div><strong>Warnings</strong></div>
              <ul className="muted" style={{ marginTop: 6 }}>
                {preview.errors.slice(0, 20).map((e, i) => (
                  <li key={`${e}-${i}`}>{e}</li>
                ))}
              </ul>
              {preview.errors.length > 20 ? (
                <div className="muted" style={{ marginTop: 4 }}>
                  Mostrando 20 de {preview.errors.length}.
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {importResult ? (
        <section className="card" style={{ display: 'grid', gap: 8 }}>
          <div>
            <strong>Importadas:</strong> {importResult.imported}
          </div>
          {'updated' in importResult ? (
            <div>
              <strong>Actualizadas:</strong> {importResult.updated ?? 0}
            </div>
          ) : null}
          {'skipped' in importResult ? (
            <div>
              <strong>Omitidas:</strong> {importResult.skipped ?? 0}
            </div>
          ) : null}
          {importResult.errors?.length ? (
            <div style={{ color: '#b00020' }}>
              Errores: {importResult.errors.join(' | ')}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
