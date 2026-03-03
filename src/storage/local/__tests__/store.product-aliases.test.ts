// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import {
  deleteProductAlias,
  exportData,
  importData,
  listAuditLogs,
  listProductAliases,
  resolveProductIdByAlias,
  upsertProduct,
  upsertProductAlias,
} from '../store';

beforeEach(() => {
  window.localStorage.clear();
});

describe('store product aliases', () => {
  it('upserts, resolves and deletes aliases with audit log', () => {
    upsertProduct({
      id: 'product-1',
      name: 'Café Latte',
      recipeId: null,
      active: true,
    });

    const alias = upsertProductAlias({
      source: 'fudo',
      externalName: ' Cafe LÁTTE ',
      productId: 'product-1',
    });

    expect(alias.externalNameNormalized).toBe('cafe latte');
    expect(resolveProductIdByAlias('fudo', 'cafe latte')).toBe('product-1');

    deleteProductAlias(alias.id);
    expect(resolveProductIdByAlias('fudo', 'cafe latte')).toBeNull();

    const actions = listAuditLogs()
      .filter((log) => log.entityType === 'product_alias')
      .map((log) => log.action);

    expect(actions).toContain('create');
    expect(actions).toContain('delete');
  });

  it('keeps aliases on import/export payload', async () => {
    upsertProduct({
      id: 'product-2',
      name: 'Mocha',
      recipeId: null,
      active: true,
    });

    upsertProductAlias({
      source: 'fudo',
      externalName: 'Moccha',
      productId: 'product-2',
    });

    const captured: string[] = [];
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);

    URL.createObjectURL = ((blob: Blob) => {
      void blob.text().then((text) => captured.push(text));
      return 'blob:test';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;

    document.createElement = ((tagName: string): HTMLElement => {
      const element = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        (element as HTMLAnchorElement).click = () => undefined;
      }
      return element;
    }) as typeof document.createElement;

    exportData();
    await new Promise((resolve) => setTimeout(resolve, 0));

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    document.createElement = originalCreateElement;

    const payload = JSON.parse(captured[0] ?? '{}') as { productAliases?: unknown[] };
    expect(payload.productAliases?.length ?? 0).toBe(1);

    window.localStorage.clear();
    importData(
      JSON.stringify({
        items: [],
        itemCostVersions: [],
        products: [
          {
            id: 'product-2',
            name: 'Mocha',
            recipeId: null,
            active: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        productAliases: [
          {
            id: 'alias-1',
            source: 'fudo',
            externalName: 'Moccha',
            externalNameNormalized: 'moccha',
            productId: 'product-2',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    );

    expect(listProductAliases('fudo').length).toBe(1);
  });
});
