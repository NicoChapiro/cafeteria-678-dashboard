import { NextResponse } from 'next/server';

type CatalogService = typeof import('@/src/server/services/catalogService');

async function getCatalogService(): Promise<CatalogService> {
  return import('@/src/server/services/catalogService');
}

export async function POST(req: Request) {
  try {
    const { action, payload } = await req.json();
    const service = await getCatalogService();

    switch (action) {
      case 'listItems': return NextResponse.json(await service.listItems());
      case 'getItem': return NextResponse.json(await service.getItem(payload.id));
      case 'upsertItem': return NextResponse.json(await service.upsertItem(payload.item));
      case 'listItemCosts': return NextResponse.json(await service.listItemCosts(payload.itemId, payload.branch));
      case 'addItemCostVersion': return NextResponse.json(await service.addItemCostVersion(payload.itemId, payload.branch, { ...payload.version, validFrom: new Date(payload.version.validFrom) }));
      case 'listProducts': return NextResponse.json(await service.listProducts());
      case 'getProduct': return NextResponse.json(await service.getProduct(payload.id));
      case 'upsertProduct': return NextResponse.json(await service.upsertProduct(payload.product));
      case 'listProductPrices': return NextResponse.json(await service.listProductPrices(payload.productId, payload.branch));
      case 'addProductPriceVersion': return NextResponse.json(await service.addProductPriceVersion(payload.productId, payload.branch, { ...payload.version, validFrom: new Date(payload.version.validFrom) }));
      case 'listProductCosts': return NextResponse.json(await service.listProductCosts(payload.productId, payload.branch));
      case 'addProductCostVersion': return NextResponse.json(await service.addProductCostVersion(payload.productId, payload.branch, { ...payload.version, validFrom: new Date(payload.version.validFrom) }));
      case 'updateProductCostVersionValidFrom': return NextResponse.json(await service.updateProductCostVersionValidFrom(payload.id, new Date(payload.validFrom)));
      case 'listRecipes': return NextResponse.json(await service.listRecipes());
      case 'getRecipe': return NextResponse.json(await service.getRecipe(payload.id));
      case 'upsertRecipe': return NextResponse.json(await service.upsertRecipe(payload.recipe));
      case 'deleteRecipe': return NextResponse.json(await service.deleteRecipe(payload.id));
      case 'listRecipeLines': return NextResponse.json(await service.listRecipeLines(payload.recipeId));
      case 'upsertRecipeLine': return NextResponse.json(await service.upsertRecipeLine(payload.line));
      case 'deleteRecipeLine': return NextResponse.json(await service.deleteRecipeLine(payload.id));
      case 'listProductAliases': return NextResponse.json(await service.listProductAliases());
      case 'upsertProductAlias': return NextResponse.json(await service.upsertProductAlias(payload.alias));
      case 'deleteProductAlias': return NextResponse.json(await service.deleteProductAlias(payload.source, payload.externalName));
      case 'resolveProductAlias': return NextResponse.json(await service.resolveProductAlias(payload.source, payload.externalName));
      default: return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
