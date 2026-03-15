import { randomUUID } from 'node:crypto';

import type { Recipe, RecipeLine } from '@/src/domain/types';
import type { RecipeRepository } from '@/src/server/repositories/contracts/recipes';
import { prisma } from '@/src/server/db/prisma';

function mapRecipe(row: {
  id: string;
  name: string;
  type: string;
  yieldQty: { toNumber(): number };
  yieldUnit: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Recipe {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Recipe['type'],
    yieldQty: row.yieldQty.toNumber(),
    yieldUnit: row.yieldUnit as Recipe['yieldUnit'],
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapLine(row: {
  id: string;
  recipeId: string;
  lineType: string;
  itemId: string | null;
  subRecipeId: string | null;
  qtyInBase: { toNumber(): number } | null;
  qtyInSubYield: { toNumber(): number } | null;
}): RecipeLine {
  if (row.lineType === 'item' && row.itemId && row.qtyInBase) {
    return {
      id: row.id,
      recipeId: row.recipeId,
      lineType: 'item',
      itemId: row.itemId,
      qtyInBase: row.qtyInBase.toNumber(),
    };
  }

  if (row.lineType === 'recipe' && row.subRecipeId && row.qtyInSubYield) {
    return {
      id: row.id,
      recipeId: row.recipeId,
      lineType: 'recipe',
      subRecipeId: row.subRecipeId,
      qtyInSubYield: row.qtyInSubYield.toNumber(),
    };
  }

  throw new Error(`Invalid recipe line ${row.id}`);
}

export const prismaRecipeRepository: RecipeRepository = {
  async list() {
    const rows = await prisma.recipe.findMany({ orderBy: { name: 'asc' } });
    return rows.map(mapRecipe);
  },
  async getById(id) {
    const row = await prisma.recipe.findUnique({ where: { id } });
    return row ? mapRecipe(row) : null;
  },
  async upsert(recipe) {
    const row = await prisma.recipe.upsert({
      where: { id: recipe.id },
      update: {
        name: recipe.name,
        type: recipe.type,
        yieldQty: recipe.yieldQty,
        yieldUnit: recipe.yieldUnit,
        active: recipe.active,
      },
      create: {
        id: recipe.id,
        name: recipe.name,
        type: recipe.type,
        yieldQty: recipe.yieldQty,
        yieldUnit: recipe.yieldUnit,
        active: recipe.active,
      },
    });
    return mapRecipe(row);
  },
  async delete(id) {
    await prisma.recipe.delete({ where: { id } });
  },
  async listLines(recipeId) {
    const rows = await prisma.recipeLine.findMany({ where: { recipeId }, orderBy: { id: 'asc' } });
    return rows.map(mapLine);
  },
  async upsertLine(line) {
    const row = await prisma.recipeLine.upsert({
      where: { id: line.id },
      update:
        line.lineType === 'item'
          ? {
              recipeId: line.recipeId,
              lineType: 'item',
              itemId: line.itemId,
              subRecipeId: null,
              qtyInBase: line.qtyInBase,
              qtyInSubYield: null,
            }
          : {
              recipeId: line.recipeId,
              lineType: 'recipe',
              itemId: null,
              subRecipeId: line.subRecipeId,
              qtyInBase: null,
              qtyInSubYield: line.qtyInSubYield,
            },
      create:
        line.lineType === 'item'
          ? {
              id: line.id || randomUUID(),
              recipeId: line.recipeId,
              lineType: 'item',
              itemId: line.itemId,
              subRecipeId: null,
              qtyInBase: line.qtyInBase,
              qtyInSubYield: null,
            }
          : {
              id: line.id || randomUUID(),
              recipeId: line.recipeId,
              lineType: 'recipe',
              itemId: null,
              subRecipeId: line.subRecipeId,
              qtyInBase: null,
              qtyInSubYield: line.qtyInSubYield,
            },
    });

    return mapLine(row);
  },
  async deleteLine(id) {
    await prisma.recipeLine.delete({ where: { id } });
  },
};
