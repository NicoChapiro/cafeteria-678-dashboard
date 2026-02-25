// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import { deleteRecipe, getProduct, importData } from '../store';

beforeEach(() => {
  window.localStorage.clear();
});

describe('store recipe referential integrity', () => {
  it('nulls product.recipeId when deleting a referenced recipe', () => {
    const recipeId = 'recipe-1';
    const productId = 'product-1';

    importData(
      JSON.stringify({
        items: [],
        itemCostVersions: [],
        products: [
          {
            id: productId,
            name: 'Producto A',
            category: 'Cafe',
            recipeId,
            active: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        productPriceVersions: [],
        productCostVersions: [],
        recipes: [
          {
            id: recipeId,
            name: 'Receta A',
            type: 'caliente',
            yieldQty: 1,
            yieldUnit: 'portion',
            active: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        recipeLines: [],
      }),
    );

    deleteRecipe(recipeId);

    const product = getProduct(productId);
    expect(product).toBeDefined();
    expect(product?.recipeId ?? null).toBeNull();
  });

  it('nulls missing recipeId during import sanitization', () => {
    const productId = 'product-missing';

    importData(
      JSON.stringify({
        items: [],
        itemCostVersions: [],
        products: [
          {
            id: productId,
            name: 'Producto sin receta válida',
            recipeId: 'missing',
            active: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        productPriceVersions: [],
        productCostVersions: [],
        recipes: [],
        recipeLines: [],
      }),
    );

    const product = getProduct(productId);
    expect(product).toBeDefined();
    expect(product?.recipeId ?? null).toBeNull();
  });
});
