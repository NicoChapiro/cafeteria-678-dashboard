'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

import { listProducts, upsertSalesDaily } from '@/src/storage/local/store';

type SalesDailyImportRow = {
  day: string;
  productName: string;
  qty: number;
  grossSalesClp: number;
};

function safeParseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const normalized = value.replace(/\./g, '').replace(',', '.');
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function safeParseDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const dt = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return trimmed;
    const latam = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (latam) {
      const dd = latam[1].padStart(2, '0');
      const mm = latam[2].padStart(2, '0');
      const yyyy = latam[3].length === 2 ? `20${latam[3]}` : latam[3];
      return `${yyyy}-${mm}-${dd}`;
    }
    const dt = new Date(trimmed);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
  }
  return null;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseSalesImportSheet(sheet: XLSX.WorkSheet): {
  rows: SalesDailyImportRow[];
  errors: string[];
} {
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  if (!raw.length) return { rows: [], errors: ['La hoja "Ventas" está vacía.'] };

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

  const errors: string[] = [];
  if (!dateKey) errors.push('No encontré la columna "Fecha" en la hoja "Ventas".');
  if (!productKey) errors.push('No encontré la columna "Producto" en la hoja "Ventas".');
  if (!qtyKey) errors.push('No encontré la columna "Cantidad" en la hoja "Ventas".');
  if (!grossKey) errors.push('No encontré la columna "Venta Bruta" (o similar) en la hoja "Ventas".');
  if (errors.length) return { rows: [], errors };

  // Si dateKey/productKey/etc vienen de una detección, pueden ser undefined.
  // Validamos acá para que TS y el runtime estén seguros.
  if (!dateKey || !productKey || !qtyKey || !grossKey) {
    throw new Error(
      `No se detectaron columnas requeridas. Detectado: dateKey=${String(dateKey)}, productKey=${String(productKey)}, qtyKey=${String(qtyKey)}, grossKey=${String(grossKey)}`,
    );
  }

  const out: SalesDailyImportRow[] = [];
  raw.forEach((row, idx) => {
    const date = safeParseDate(row[dateKey]);
    const productName = String(row[productKey] ?? '').trim();
    const qty = safeParseNumber(row[qtyKey]);
    const gross = safeParseNumber(row[grossKey]);

    const rowLabel = `Fila ${idx + 2}`;
    if (!date) errors.push(`${rowLabel}: Fecha inválida.`);
    if (!productName) errors.push(`${rowLabel}: Producto vacío.`);
    if (qty === null || qty <= 0) errors.push(`${rowLabel}: Cantidad inválida.`);
    if (gross === null || gross < 0) errors.push(`${rowLabel}: Venta bruta inválida.`);

    if (date && productName && qty !== null && qty > 0 && gross !== null && gross >= 0) {
      out.push({
        day: date,
        productName,
        qty,
        grossSalesClp: gross,
      });
    }
  });

  return { rows: out, errors };
}

export default function ImportTemucoSalesPage() {
  const [fileName, setFileName] = useState<string>('');
  const [importRows, setImportRows] = useState<SalesDailyImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [applied, setApplied] = useState<boolean>(false);

  const [productsByName, setProductsByName] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const map = new Map(
      listProducts().map((product) => [product.name.trim().toLocaleLowerCase('es-CL'), product.id]),
    );
    setProductsByName(map);
  }, []);

  const preview = useMemo(() => {
    const mapped = importRows.map((r) => {
      const productId = productsByName.get(r.productName.trim().toLocaleLowerCase('es-CL')) ?? null;
      return { ...r, productId };
    });
    const missing = mapped.filter((r) => !r.productId);
    return { mapped, missingCount: missing.length };
  }, [importRows, productsByName]);

  async function onPickFile(file: File): Promise<void> {
    setApplied(false);
    setErrors([]);
    setImportRows([]);
    setFileName(file.name);

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets.Ventas;
    if (!ws) {
      setErrors(['No encontré la hoja "Ventas" dentro del archivo.']);
      return;
    }
    const { rows, errors: parseErrors } = parseSalesImportSheet(ws);
    setImportRows(rows);
    setErrors(parseErrors);
  }

  function applyImport(): void {
    const toApply = preview.mapped.filter((r) => r.productId);
    const rowsByDay = new Map<string, typeof toApply>();

    toApply.forEach((row) => {
      const current = rowsByDay.get(row.day);
      if (current) {
        current.push(row);
      } else {
        rowsByDay.set(row.day, [row]);
      }
    });

    rowsByDay.forEach((rows, day) => {
      upsertSalesDaily(
        day,
        'Temuco',
        rows.map((row) => ({
          productId: row.productId ?? '',
          qty: row.qty,
          grossSalesClp: row.grossSalesClp,
        })),
      );
    });

    setApplied(true);
  }

  return (
    <main>
      <header className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <h1 style={{ marginBottom: 8 }}>Importar Ventas Temuco</h1>
            <p className="muted">
              Sube un XLSX con hoja <strong>Ventas</strong> y columnas Fecha, Producto, Cantidad y Venta Bruta.
            </p>
          </div>
          <Link className="btnSecondary" href="/sales/temuco">Volver</Link>
        </div>
      </header>

      <section className="card">
        <label className="muted" htmlFor="file">Archivo XLSX</label>
        <input
          id="file"
          type="file"
          accept=".xlsx"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPickFile(f);
          }}
        />
        {fileName ? <p className="muted" style={{ marginTop: 8 }}>Seleccionado: <strong>{fileName}</strong></p> : null}
      </section>

      {errors.length ? (
        <section className="card" style={{ borderColor: 'var(--danger)' }}>
          <h2 className="cardTitle">Errores / advertencias</h2>
          <ul className="muted" style={{ marginTop: 8 }}>
            {errors.slice(0, 15).map((err) => <li key={err}>{err}</li>)}
          </ul>
          {errors.length > 15 ? <p className="muted">…y {errors.length - 15} más</p> : null}
        </section>
      ) : null}

      {importRows.length ? (
        <section className="card">
          <h2 className="cardTitle">Previa</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            Filas válidas: <strong>{importRows.length}</strong> · Productos sin match: <strong>{preview.missingCount}</strong>
          </p>

          <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
            <button
              className="btn"
              type="button"
              disabled={preview.mapped.length === 0}
              onClick={applyImport}
            >
              Aplicar Importación
            </button>
            {applied ? <span className="badge">Aplicado ✅</span> : null}
            <Link className="btnSecondary" href="/dashboard">Ir a Dashboard</Link>
          </div>

          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Qty</th>
                  <th>Venta bruta</th>
                  <th>Match producto</th>
                </tr>
              </thead>
              <tbody>
                {preview.mapped.slice(0, 20).map((r, i) => (
                  <tr key={`${r.day}-${r.productName}-${i}`}>
                    <td>{r.day}</td>
                    <td>{r.productName}</td>
                    <td>{r.qty}</td>
                    <td>{Math.round(r.grossSalesClp).toLocaleString('es-CL')}</td>
                    <td>{r.productId ? 'OK' : 'NO'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.mapped.length > 20 ? (
            <p className="muted" style={{ marginTop: 10 }}>
              Mostrando 20 de {preview.mapped.length} filas.
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
