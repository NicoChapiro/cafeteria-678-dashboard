import { describe, expect, it } from 'vitest';

import type { Item, ItemCostVersion, Recipe, RecipeLine } from '@/src/domain/types';
import { costRecipe, getEffectiveItemUnitCostClp } from '../costing';

const itemCafe: Item = {
  id: 'item-cafe',
  name: 'Cafe',
  baseUnit: 'g',
  yieldRateDefault: 0.9,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const itemLeche: Item = {
  id: 'item-leche',
  name: 'Leche',
  baseUnit: 'ml',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function itemCostVersion(data: Partial<ItemCostVersion> & { id: string; itemId: string }): ItemCostVersion {
  return {
    id: data.id,
    itemId: data.itemId,
    branch: data.branch ?? 'Santiago',
    packQtyInBase: data.packQtyInBase ?? 1000,
    packCostGrossClp: data.packCostGrossClp ?? 10000,
    yieldRateOverride: data.yieldRateOverride ?? null,
    validFrom: data.validFrom ?? new Date('2026-01-01T00:00:00.000Z'),
    validTo: data.validTo ?? null,
    createdAt: data.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
  };
}

function recipe(data: Partial<Recipe> & { id: string; name: string }): Recipe {
  return {
    id: data.id,
    name: data.name,
    type: data.type ?? 'caliente',
    yieldQty: data.yieldQty ?? 1,
    yieldUnit: data.yieldUnit ?? 'portion',
    active: data.active ?? true,
    createdAt: data.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: data.updatedAt ?? new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('costing engine', () => {
  it('computes effective item unit cost with pack conversion and yield', () => {
    const versions = [
      itemCostVersion({
        id: 'v1',
        itemId: itemCafe.id,
        packQtyInBase: 1000,
        packCostGrossClp: 10000,
        yieldRateOverride: 0.8,
      }),
    ];

    const result = getEffectiveItemUnitCostClp(
      itemCafe,
      versions,
      new Date('2026-02-15T00:00:00.000Z'),
    );

    expect(result).toBeCloseTo(12.5, 5);
  });

  it('costs simple recipe with item lines', () => {
    const latte = recipe({ id: 'recipe-latte', name: 'Latte', yieldQty: 1 });
    const lines: RecipeLine[] = [
      {
        id: 'l1',
        recipeId: latte.id,
        lineType: 'item',
        itemId: itemCafe.id,
        qtyInBase: 18,
      },
      {
        id: 'l2',
        recipeId: latte.id,
        lineType: 'item',
        itemId: itemLeche.id,
        qtyInBase: 200,
      },
    ];

    const context = {
      items: [itemCafe, itemLeche],
      recipes: [latte],
      recipeLines: lines,
      itemCostVersions: [
        itemCostVersion({
          id: 'vcafe',
          itemId: itemCafe.id,
          packQtyInBase: 1000,
          packCostGrossClp: 10000,
          yieldRateOverride: 1,
        }),
        itemCostVersion({
          id: 'vleche',
          itemId: itemLeche.id,
          packQtyInBase: 1000,
          packCostGrossClp: 1500,
          yieldRateOverride: 1,
        }),
      ],
    };

    const result = costRecipe(
      latte,
      lines,
      context,
      new Date('2026-03-01T00:00:00.000Z'),
      'Santiago',
    );

    expect(result.totalCostClp).toBeCloseTo(480, 5);
    expect(result.costPerYieldUnitClp).toBeCloseTo(480, 5);
  });

  it('costs recipe with sub-recipe line', () => {
    const syrup = recipe({ id: 'recipe-syrup', name: 'Syrup', yieldQty: 1000, yieldUnit: 'ml' });
    const latte = recipe({ id: 'recipe-latte2', name: 'Latte Vainilla', yieldQty: 1 });

    const allLines: RecipeLine[] = [
      {
        id: 's1',
        recipeId: syrup.id,
        lineType: 'item',
        itemId: itemLeche.id,
        qtyInBase: 300,
      },
      {
        id: 'l1',
        recipeId: latte.id,
        lineType: 'item',
        itemId: itemCafe.id,
        qtyInBase: 18,
      },
      {
        id: 'l2',
        recipeId: latte.id,
        lineType: 'recipe',
        subRecipeId: syrup.id,
        qtyInSubYield: 30,
      },
    ];

    const context = {
      items: [itemCafe, itemLeche],
      recipes: [latte, syrup],
      recipeLines: allLines,
      itemCostVersions: [
        itemCostVersion({
          id: 'vcafe',
          itemId: itemCafe.id,
          packQtyInBase: 1000,
          packCostGrossClp: 10000,
          yieldRateOverride: 1,
        }),
        itemCostVersion({
          id: 'vleche',
          itemId: itemLeche.id,
          packQtyInBase: 1000,
          packCostGrossClp: 2000,
          yieldRateOverride: 1,
        }),
      ],
    };

    const result = costRecipe(
      latte,
      allLines.filter((line) => line.recipeId === latte.id),
      context,
      new Date('2026-03-01T00:00:00.000Z'),
      'Santiago',
    );

    // Cafe: 18*10=180. Syrup cost per ml: (300*2)/1000=0.6. 30ml => 18. Total 198.
    expect(result.totalCostClp).toBeCloseTo(198, 5);
    expect(result.costPerYieldUnitClp).toBeCloseTo(198, 5);
  });

  it('throws on cycle A -> B -> A', () => {
    const a = recipe({ id: 'a', name: 'A', yieldQty: 1 });
    const b = recipe({ id: 'b', name: 'B', yieldQty: 1 });

    const allLines: RecipeLine[] = [
      {
        id: 'a1',
        recipeId: 'a',
        lineType: 'recipe',
        subRecipeId: 'b',
        qtyInSubYield: 1,
      },
      {
        id: 'b1',
        recipeId: 'b',
        lineType: 'recipe',
        subRecipeId: 'a',
        qtyInSubYield: 1,
      },
    ];

    const context = {
      items: [itemCafe],
      recipes: [a, b],
      recipeLines: allLines,
      itemCostVersions: [itemCostVersion({ id: 'v', itemId: itemCafe.id })],
    };

    expect(() =>
      costRecipe(
        a,
        allLines.filter((line) => line.recipeId === a.id),
        context,
        new Date('2026-03-01T00:00:00.000Z'),
        'Santiago',
      ),
    ).toThrow('Cycle detected in recipe graph');
  });

  it('selects the effective version by validFrom/validTo for asOfDate', () => {
    const versions = [
      itemCostVersion({
        id: 'old',
        itemId: itemCafe.id,
        packQtyInBase: 1000,
        packCostGrossClp: 10000,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validTo: new Date('2026-02-28T00:00:00.000Z'),
      }),
      itemCostVersion({
        id: 'new',
        itemId: itemCafe.id,
        packQtyInBase: 1000,
        packCostGrossClp: 12000,
        validFrom: new Date('2026-03-01T00:00:00.000Z'),
        validTo: null,
      }),
    ];

    const feb = getEffectiveItemUnitCostClp(
      itemCafe,
      versions,
      new Date('2026-02-15T00:00:00.000Z'),
    );

    const mar = getEffectiveItemUnitCostClp(
      itemCafe,
      versions,
      new Date('2026-03-10T00:00:00.000Z'),
    );

    expect(feb).toBeCloseTo(10000 / 1000 / 0.9, 5);
    expect(mar).toBeCloseTo(12000 / 1000 / 0.9, 5);
  });
});
