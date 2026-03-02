import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import {
  detectRequiredColumns,
  normalizeHeader,
  parseFudoNumber,
  parseIsoDate,
} from '../fudoReport';

describe('fudoReport helpers', () => {
  it('normaliza headers y detecta sub categoría sin tildes', () => {
    expect(normalizeHeader(' Sub categoría ')).toBe('sub categoria');

    const columns = detectRequiredColumns([
      'Fecha',
      'Producto',
      'Cantidades vendidas',
      'Monto total',
      'Sub categoría',
    ]);

    expect(columns.subCategoryKey).toBe('Sub categoría');
  });

  it('parsea fechas desde serial excel y strings', () => {
    const excelDate = XLSX.SSF.parse_date_code(46082);
    expect(excelDate).toBeTruthy();

    expect(parseIsoDate(46082)).toBe('2026-03-01');
    expect(parseIsoDate('01/03/2026')).toBe('2026-03-01');
    expect(parseIsoDate('2026-03-01')).toBe('2026-03-01');
  });

  it('parsea montos y números con formato local', () => {
    expect(parseFudoNumber('$ 1.234')).toBe(1234);
    expect(parseFudoNumber('1.234')).toBe(1234);
    expect(parseFudoNumber('1,5')).toBe(1.5);
    expect(parseFudoNumber(' 2.000 ')).toBe(2000);
  });
});
