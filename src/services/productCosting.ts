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

import { getProductWasteRate } from '@/src/services/product-waste';

type VersionWindow = {
  validFrom: Date;
  validTo: Date | null;
};

export type ProductCostingBadge =
  | 'Sin receta'
  | 'Sin costo'
  | 'Sin precio'
  | 'Desactivado'
  | `Faltan costos (${number})`;

export type ProductCostDriver = {
  itemId: string;
  itemName: string;
  lineCostClp: number;
};

export type ProductCostBreakdownLine = {
  itemId: string;
  itemName: string;
  qtyInBase: number;
  unit: Item['baseUnit'];
  effectiveUnitCostClp: number | null;
  lineCostBatchClp: number | null;
  lineCostClp: number | null;
  status: 'OK' | 'Falta costo';
};

export type ProductAsOfResult = {
  priceClp: number | null;
  costClp: number | null;
  marginClp: number | null;
  marginPct: number | null;
  badges: ProductCostingBadge[];
  drivers: ProductCostDriver[];
  missingItems: { id: string; name: string }[];
  breakdown: ProductCostBreakdownLine[];
  unsupportedLineTypesFound: boolean;
};

export type ProductCostingContext = {
  branch: Branch;
  asOfDate: Date;
  product: Product;
  recipe: Recipe | null;
  recipeLines: RecipeLine[];
  itemsById: Map<string, Item>;
  itemCostVersionsByItemId: Map<string, ItemCostVersion[]>;
  productPriceVersions: ProductPriceVersion[];
  productCostVersions: ProductCostVersion[];
};

function normalizeUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function findEffectiveVersion<T extends VersionWindow>(
  versions: T[],
  asOfDate: Date,
): T | null {
  const asOf = normalizeUtcDay(asOfDate);
  const candidates = versions
    .filter((version) => {
      const from = normalizeUtcDay(version.validFrom);
      const to = version.validTo
        ? normalizeUtcDay(version.validTo)
        : Number.POSITIVE_INFINITY;

      return from <= asOf && asOf <= to;
    })
    .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime());

  return candidates[0] ?? null;
}

function computeEffectiveItemUnitCost(
  item: Item,
  version: ItemCostVersion,
): number | null {
  if (version.packQtyInBase <= 0) {
    return null;
  }

  const baseUnitCost = version.packCostGrossClp / version.packQtyInBase;
  const yieldRate = version.yieldRateOverride ?? item.yieldRateDefault ?? 1;

  if (yieldRate <= 0) {
    return null;
  }

  return baseUnitCost / yieldRate;
}

export function computeProductAsOf(context: ProductCostingContext): ProductAsOfResult {
  const {
    product,
    recipe,
    recipeLines,
    itemsById,
    itemCostVersionsByItemId,
    productPriceVersions,
    productCostVersions,
    asOfDate,
  } = context;

  const priceVersion = findEffectiveVersion(productPriceVersions, asOfDate);
  const priceClp = priceVersion?.priceGrossClp ?? null;

  let costClp: number | null = null;
  const missingItems: { id: string; name: string }[] = [];
  const breakdown: ProductCostBreakdownLine[] = [];
  let unsupportedLineTypesFound = false;

  if (product.recipeId) {
    if (!recipe || recipe.yieldQty <= 0) {
      costClp = null;
    } else {
      const itemLines = recipeLines.filter((line) => line.lineType === 'item');
      unsupportedLineTypesFound = recipeLines.some((line) => line.lineType === 'recipe');

      for (const line of itemLines) {
        const item = itemsById.get(line.itemId);

        if (!item) {
          missingItems.push({ id: line.itemId, name: `Item ${line.itemId}` });
          breakdown.push({
            itemId: line.itemId,
            itemName: `Item ${line.itemId}`,
            qtyInBase: line.qtyInBase,
            unit: 'unit',
            effectiveUnitCostClp: null,
            lineCostBatchClp: null,
            lineCostClp: null,
            status: 'Falta costo',
          });
          continue;
        }

        const effectiveVersion = findEffectiveVersion(
          itemCostVersionsByItemId.get(item.id) ?? [],
          asOfDate,
        );

        if (!effectiveVersion) {
          missingItems.push({ id: item.id, name: item.name });
          breakdown.push({
            itemId: item.id,
            itemName: item.name,
            qtyInBase: line.qtyInBase,
            unit: item.baseUnit,
            effectiveUnitCostClp: null,
            lineCostBatchClp: null,
            lineCostClp: null,
            status: 'Falta costo',
          });
          continue;
        }

        const effectiveUnitCostClp = computeEffectiveItemUnitCost(item, effectiveVersion);

        if (effectiveUnitCostClp === null) {
          missingItems.push({ id: item.id, name: item.name });
          breakdown.push({
            itemId: item.id,
            itemName: item.name,
            qtyInBase: line.qtyInBase,
            unit: item.baseUnit,
            effectiveUnitCostClp: null,
            lineCostBatchClp: null,
            lineCostClp: null,
            status: 'Falta costo',
          });
          continue;
        }

        const lineCostBatchClp = effectiveUnitCostClp * line.qtyInBase;
        const lineCostClp = lineCostBatchClp / recipe.yieldQty;
        breakdown.push({
          itemId: item.id,
          itemName: item.name,
          qtyInBase: line.qtyInBase,
          unit: item.baseUnit,
          effectiveUnitCostClp,
          lineCostBatchClp,
          lineCostClp,
          status: 'OK',
        });
      }

      if (missingItems.length > 0 || unsupportedLineTypesFound) {
        costClp = null;
      } else {
        const totalCostClp = breakdown.reduce(
          (acc, line) => acc + (line.lineCostClp ?? 0),
          0,
        );
        costClp = totalCostClp * (1 + getProductWasteRate(product));
      }
    }
  } else {
    const manualCostVersion = findEffectiveVersion(productCostVersions, asOfDate);
    if (manualCostVersion) {
      costClp = manualCostVersion.costGrossClp * (1 + getProductWasteRate(product));
    }
  }

  const marginClp = priceClp !== null && costClp !== null ? priceClp - costClp : null;
  const marginPct =
    marginClp !== null && priceClp !== null && priceClp > 0
      ? (marginClp / priceClp) * 100
      : null;

  const badges: ProductCostingBadge[] = [];
  if (!product.recipeId) {
    badges.push('Sin receta');
  }
  if (costClp === null) {
    badges.push('Sin costo');
  }
  if (priceClp === null) {
    badges.push('Sin precio');
  }
  if (product.recipeId && missingItems.length > 0) {
    badges.push(`Faltan costos (${missingItems.length})`);
  }
  if (!product.active) {
    badges.push('Desactivado');
  }

  const drivers =
    product.recipeId && costClp !== null
      ? breakdown
          .filter((line) => line.lineCostClp !== null)
          .sort((a, b) => (b.lineCostClp ?? 0) - (a.lineCostClp ?? 0))
          .slice(0, 5)
          .map((line) => ({
            itemId: line.itemId,
            itemName: line.itemName,
            lineCostClp: line.lineCostClp ?? 0,
          }))
      : [];

  return {
    priceClp,
    costClp,
    marginClp,
    marginPct,
    badges,
    drivers,
    missingItems,
    breakdown,
    unsupportedLineTypesFound,
  };
}
