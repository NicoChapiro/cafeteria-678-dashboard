import * as XLSX from 'xlsx';

export type FudoParsedRow = {
  date: string;
  productName: string;
  qty: number;
  grossSalesClp: number;
  category?: string;
  subCategory?: string;
};

export type FudoParseResult = {
  rows: FudoParsedRow[];
  errors: string[];
  rowsRead: number;
  dateMin: string | null;
  dateMax: string | null;
  totalQty: number;
  totalGross: number;
  sheetUsed: string;
};

type RawRow = Record<string, unknown>;

type RequiredColumnKeys = {
  dateKey: string;
  productKey: string;
  qtyKey: string;
  grossKey: string;
  categoryKey?: string;
  subCategoryKey?: string;
};

export function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('es-CL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function findHeaderKey(headers: string[], candidates: string[]): string | undefined {
  const normalized = headers.map((header) => ({ raw: header, normalized: normalizeHeader(header) }));

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeHeader(candidate);
    const exact = normalized.find((entry) => entry.normalized === normalizedCandidate);
    if (exact) return exact.raw;
  }

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeHeader(candidate);
    const included = normalized.find((entry) => entry.normalized.includes(normalizedCandidate));
    if (included) return included.raw;
  }

  return undefined;
}

export function detectRequiredColumns(headers: string[]): RequiredColumnKeys {
  const dateKey = findHeaderKey(headers, ['fecha', 'date', 'fecha venta']);
  const productKey = findHeaderKey(headers, ['producto', 'product', 'item', 'articulo']);
  const qtyKey = findHeaderKey(headers, [
    'cantidades vendidas',
    'cantidad vendida',
    'cantidad',
    'qty',
    'unidades',
  ]);
  const grossKey = findHeaderKey(headers, ['monto total', 'ventas totales', 'monto', 'total', 'gross']);

  if (!dateKey || !productKey || !qtyKey || !grossKey) {
    throw new Error(
      `No se encontraron columnas obligatorias (Fecha/Producto/Cantidad/Monto). dateKey=${dateKey ?? '-'} productKey=${productKey ?? '-'} qtyKey=${qtyKey ?? '-'} grossKey=${grossKey ?? '-'}. Headers disponibles: ${headers.join(' | ')}`,
    );
  }

  return {
    dateKey,
    productKey,
    qtyKey,
    grossKey,
    categoryKey: findHeaderKey(headers, ['categoria', 'category']),
    subCategoryKey: findHeaderKey(headers, ['sub categoria', 'subcategoria', 'sub category']),
  };
}

export function parseIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
  }

  const text = String(value ?? '').trim();
  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const slashDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashDate) {
    const dd = slashDate[1].padStart(2, '0');
    const mm = slashDate[2].padStart(2, '0');
    const yyyy = slashDate[3].length === 2 ? `20${slashDate[3]}` : slashDate[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export function parseFudoNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const text = String(value ?? '').trim();
  if (!text) {
    return 0;
  }

  const compact = text.replace(/[$\s]/g, '');

  let normalized = compact;
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  } else if (/^[-+]?\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '');
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function parseQty(value: unknown): number | null {
  const parsed = parseFudoNumber(value);
  if (parsed === null || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 1000) / 1000;
}

export function parseGross(value: unknown): number | null {
  const parsed = parseFudoNumber(value);
  if (parsed === null || parsed < 0) {
    return null;
  }
  return Math.round(parsed);
}

function pickSheetName(sheetNames: string[]): string {
  return (
    sheetNames.find((name) => name === 'Detalle') ??
    sheetNames.find((name) => name.toLocaleLowerCase('es-CL').includes('detalle')) ??
    sheetNames[0] ??
    ''
  );
}

function parseRows(rawRows: RawRow[], headers: string[]): FudoParseResult {
  const errors: string[] = [];
  const rows: FudoParsedRow[] = [];

  const keys = detectRequiredColumns(headers);

  let dateMin: string | null = null;
  let dateMax: string | null = null;
  let totalQty = 0;
  let totalGross = 0;

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;

    const date = parseIsoDate(rawRow[keys.dateKey]);
    const productName = String(rawRow[keys.productKey] ?? '').trim();
    const qty = parseQty(rawRow[keys.qtyKey]);
    const grossSalesClp = parseGross(rawRow[keys.grossKey]);

    if (!date) {
      errors.push(`Fila ${rowNumber}: fecha inválida.`);
      return;
    }

    if (!productName) {
      errors.push(`Fila ${rowNumber}: producto vacío.`);
      return;
    }

    if (qty === null) {
      errors.push(`Fila ${rowNumber}: cantidad inválida.`);
      return;
    }

    if (grossSalesClp === null) {
      errors.push(`Fila ${rowNumber}: monto inválido.`);
      return;
    }

    const categoryRaw = keys.categoryKey ? rawRow[keys.categoryKey] : undefined;
    const subCategoryRaw = keys.subCategoryKey ? rawRow[keys.subCategoryKey] : undefined;

    const row: FudoParsedRow = {
      date,
      productName,
      qty,
      grossSalesClp,
      category: String(categoryRaw ?? '').trim() || undefined,
      subCategory: String(subCategoryRaw ?? '').trim() || undefined,
    };

    rows.push(row);
    totalQty += row.qty;
    totalGross += row.grossSalesClp;
    dateMin = dateMin === null || row.date < dateMin ? row.date : dateMin;
    dateMax = dateMax === null || row.date > dateMax ? row.date : dateMax;
  });

  return {
    rows,
    errors,
    rowsRead: rawRows.length,
    dateMin,
    dateMax,
    totalQty: Math.round(totalQty * 1000) / 1000,
    totalGross,
    sheetUsed: '',
  };
}

export function parseFudoProductsXlsx(buffer: ArrayBuffer): FudoParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetUsed = pickSheetName(workbook.SheetNames);

  if (!sheetUsed) {
    return {
      rows: [],
      errors: ['El archivo XLSX no contiene hojas.'],
      rowsRead: 0,
      dateMin: null,
      dateMax: null,
      totalQty: 0,
      totalGross: 0,
      sheetUsed: '',
    };
  }

  const sheet = workbook.Sheets[sheetUsed];
  const rawRows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' });

  if (!rawRows.length) {
    return {
      rows: [],
      errors: ['La hoja seleccionada está vacía.'],
      rowsRead: 0,
      dateMin: null,
      dateMax: null,
      totalQty: 0,
      totalGross: 0,
      sheetUsed,
    };
  }

  const headers = Object.keys(rawRows[0] ?? {});
  const parsed = parseRows(rawRows, headers);
  return { ...parsed, sheetUsed };
}
