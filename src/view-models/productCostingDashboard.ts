import type { Product } from '@/src/domain/types';
import type { ProductAsOfResult } from '@/src/services/productCosting';

export type ProductWithCosting = {
  product: Product;
  costing: ProductAsOfResult;
};

export type SortKey = 'name' | 'marginPctAsc' | 'marginClpAsc' | 'costClpDesc';
export type IssueType = 'any' | 'missingPrice' | 'missingCosts' | 'missingCostItems' | 'unsupportedRecipe';
export type ViewMode = 'cards' | 'kanban' | 'table';
export type DrawerQuickNavSection = 'actions' | 'breakdown' | 'missingItems';
export type MarginStatusTone = 'ok' | 'attention' | 'critical' | 'na';
export type ProductCardHealth = 'healthy' | 'missingPrice' | 'missingCosts' | 'missingItemCosts' | 'unsupportedRecipe';

export const DRAWER_QUICK_NAV_LABELS: Record<DrawerQuickNavSection, string> = {
  actions: 'Acciones',
  breakdown: 'Desglose',
  missingItems: 'Faltantes',
};

export function formatClp(value: number | null): string {
  if (value === null) return 'N/D';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
}

export function formatPct(value: number | null): string {
  if (value === null) return 'N/D';
  return `${value.toFixed(1)}%`;
}

export function getMarginStatus(marginPct: number | null): { tone: MarginStatusTone; display: string } {
  if (marginPct === null) return { tone: 'na', display: 'N/D' };
  if (marginPct < 20) return { tone: 'critical', display: `Crítico · ${Math.round(marginPct)}%` };
  if (marginPct < 35) return { tone: 'attention', display: `Atención · ${Math.round(marginPct)}%` };
  return { tone: 'ok', display: `OK · ${Math.round(marginPct)}%` };
}

function badgeIncludes(costing: ProductAsOfResult, fragment: string): boolean {
  const normalizedFragment = fragment.toLocaleLowerCase('es-CL');
  return costing.badges.some((badge) => badge.toLocaleLowerCase('es-CL').includes(normalizedFragment));
}

export function hasMissingPrice(costing: ProductAsOfResult): boolean {
  return costing.priceClp === null || badgeIncludes(costing, 'sin precio');
}

export function hasUnsupportedRecipe(costing: ProductAsOfResult): boolean {
  return costing.unsupportedLineTypesFound || badgeIncludes(costing, 'sub-receta');
}

export function hasMissingCosts(costing: ProductAsOfResult): boolean {
  return costing.costClp === null && !hasUnsupportedRecipe(costing);
}

export function hasMissingCostItems(costing: ProductAsOfResult): boolean {
  return costing.missingItems.length > 0;
}

export function hasIssuesCosting(costing: ProductAsOfResult): boolean {
  return hasMissingPrice(costing) || hasMissingCosts(costing) || hasMissingCostItems(costing) || hasUnsupportedRecipe(costing);
}

export function getProductCardHealth(costing: ProductAsOfResult): ProductCardHealth {
  if (hasUnsupportedRecipe(costing)) return 'unsupportedRecipe';
  if (hasMissingCostItems(costing)) return 'missingItemCosts';
  if (hasMissingPrice(costing)) return 'missingPrice';
  if (hasMissingCosts(costing)) return 'missingCosts';
  return 'healthy';
}

export function getProductCardHealthLabel(health: ProductCardHealth): string {
  if (health === 'unsupportedRecipe') return 'Receta no soportada';
  if (health === 'missingItemCosts') return 'Faltan costos de ítems';
  if (health === 'missingPrice') return 'Falta precio';
  if (health === 'missingCosts') return 'Falta costo';
  return 'Saludable';
}

export function getCardActionLabel(costing: ProductAsOfResult): string {
  if (costing.unsupportedLineTypesFound) return 'Revisar receta';
  if (costing.missingItems.length > 0) return 'Completar costos';
  if (costing.priceClp === null) return 'Definir precio';
  if (costing.costClp === null) return 'Definir costo';
  return 'Editar';
}

export function getBadgeTone(badge: string): 'warn' | 'info' {
  const normalized = badge.toLocaleLowerCase('es-CL');
  return normalized.includes('sin costo') || normalized.includes('sin precio') || normalized.startsWith('faltan costos') ? 'warn' : 'info';
}

export function sortProducts(items: ProductWithCosting[], sort: SortKey): ProductWithCosting[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    if (sort === 'name') return a.product.name.localeCompare(b.product.name, 'es-CL');
    if (sort === 'marginPctAsc') {
      const left = a.costing.marginPct;
      const right = b.costing.marginPct;
      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      return left - right;
    }
    if (sort === 'marginClpAsc') {
      const left = a.costing.marginClp;
      const right = b.costing.marginClp;
      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      return left - right;
    }
    const left = a.costing.costClp;
    const right = b.costing.costClp;
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return right - left;
  });
  return sorted;
}

export function buildKanbanColumns(products: ProductWithCosting[]) {
  return {
    healthy: products.filter((entry) => !hasIssuesCosting(entry.costing)),
    missingPrice: products.filter((entry) => hasMissingPrice(entry.costing)),
    missingCosts: products.filter((entry) => hasMissingCosts(entry.costing) || hasMissingCostItems(entry.costing)),
    unsupported: products.filter((entry) => hasUnsupportedRecipe(entry.costing)),
  };
}
