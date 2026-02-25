import type {
  Branch,
  Item,
  ItemCostVersion,
  Recipe,
  RecipeLine,
} from '@/src/domain/types';

export type CostingContext = {
  items: Item[];
  recipes: Recipe[];
  recipeLines: RecipeLine[];
  itemCostVersions: ItemCostVersion[];
};

function normalizeUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function isVersionEffective(version: ItemCostVersion, asOfDate: Date): boolean {
  const target = normalizeUtcDay(asOfDate).getTime();
  const from = normalizeUtcDay(version.validFrom).getTime();
  const to = version.validTo
    ? normalizeUtcDay(version.validTo).getTime()
    : Number.POSITIVE_INFINITY;

  return from <= target && target <= to;
}

export function getEffectiveItemUnitCostClp(
  item: Item,
  itemCostVersionsForBranch: ItemCostVersion[],
  asOfDate: Date,
): number {
  const effective = itemCostVersionsForBranch
    .filter((version) => version.itemId === item.id)
    .filter((version) => isVersionEffective(version, asOfDate))
    .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())[0];

  if (!effective) {
    throw new Error(`No effective item cost version for item ${item.id}`);
  }

  if (effective.packQtyInBase <= 0) {
    throw new Error(`Invalid packQtyInBase for item ${item.id}`);
  }

  const baseUnitCost = effective.packCostGrossClp / effective.packQtyInBase;
  const yieldRate = effective.yieldRateOverride ?? item.yieldRateDefault ?? 1;

  if (yieldRate <= 0) {
    throw new Error(`Invalid yield rate for item ${item.id}`);
  }

  return baseUnitCost / yieldRate;
}

export function costRecipe(
  recipe: Recipe,
  lines: RecipeLine[],
  context: CostingContext,
  asOfDate: Date,
  branch: Branch,
  stack: Set<string> = new Set(),
): { totalCostClp: number; costPerYieldUnitClp: number } {
  if (recipe.yieldQty <= 0) {
    throw new Error(`Invalid yieldQty for recipe ${recipe.id}`);
  }

  if (stack.has(recipe.id)) {
    throw new Error(`Cycle detected in recipe graph at ${recipe.id}`);
  }

  const nextStack = new Set(stack);
  nextStack.add(recipe.id);

  const totalCostClp = lines.reduce((acc, line) => {
    if (line.lineType === 'item') {
      const item = context.items.find((entry) => entry.id === line.itemId);
      if (!item) {
        throw new Error(`Item not found: ${line.itemId}`);
      }

      const branchVersions = context.itemCostVersions.filter(
        (version) => version.branch === branch,
      );

      const effectiveUnitCost = getEffectiveItemUnitCostClp(
        item,
        branchVersions,
        asOfDate,
      );

      return acc + line.qtyInBase * effectiveUnitCost;
    }

    const subRecipe = context.recipes.find((entry) => entry.id === line.subRecipeId);
    if (!subRecipe) {
      throw new Error(`Sub-recipe not found: ${line.subRecipeId}`);
    }

    const subLines = context.recipeLines.filter(
      (entry) => entry.recipeId === subRecipe.id,
    );

    const subCost = costRecipe(
      subRecipe,
      subLines,
      context,
      asOfDate,
      branch,
      nextStack,
    );

    return acc + line.qtyInSubYield * subCost.costPerYieldUnitClp;
  }, 0);

  return {
    totalCostClp,
    costPerYieldUnitClp: totalCostClp / recipe.yieldQty,
  };
}
