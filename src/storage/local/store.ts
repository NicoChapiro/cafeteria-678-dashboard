import { applyNewVersion } from '../../services/versioning';
import type {
  AuditLog,
  Branch,
  Item,
  ItemCostVersion,
  NewItemCostVersion,
  NewProductCostVersion,
  NewProductPriceVersion,
  Product,
  ProductCostVersion,
  ProductPriceVersion,
  Recipe,
  RecipeLine,
  SalesAdjustment,
  SalesDaily,
  YieldUnit,
} from '../../domain/types';

type SerializedItem = Omit<Item, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

type SerializedItemCostVersion = Omit<
  ItemCostVersion,
  'validFrom' | 'validTo' | 'createdAt'
> & {
  validFrom: string;
  validTo: string | null;
  createdAt: string;
};

type SerializedProduct = Omit<Product, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

type SerializedProductPriceVersion = Omit<
  ProductPriceVersion,
  'validFrom' | 'validTo' | 'createdAt'
> & {
  validFrom: string;
  validTo: string | null;
  createdAt: string;
};

type SerializedProductCostVersion = Omit<
  ProductCostVersion,
  'validFrom' | 'validTo' | 'createdAt'
> & {
  validFrom: string;
  validTo: string | null;
  createdAt: string;
};

type SerializedRecipe = Omit<Recipe, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

type SerializedRecipeLine = RecipeLine;

type SerializedAuditLog = Omit<AuditLog, 'createdAt'> & {
  createdAt: string;
};

type SerializedSalesDaily = SalesDaily;

type SerializedSalesAdjustment = Omit<SalesAdjustment, 'createdAt'> & {
  createdAt: string;
};

type LocalData = {
  items: Item[];
  itemCostVersions: ItemCostVersion[];
  products: Product[];
  productPriceVersions: ProductPriceVersion[];
  productCostVersions: ProductCostVersion[];
  recipes: Recipe[];
  recipeLines: RecipeLine[];
  auditLogs: AuditLog[];
  salesDaily: SalesDaily[];
  salesAdjustments: SalesAdjustment[];
};

type SerializedLocalData = {
  items: SerializedItem[];
  itemCostVersions: SerializedItemCostVersion[];
  products: SerializedProduct[];
  productPriceVersions: SerializedProductPriceVersion[];
  productCostVersions: SerializedProductCostVersion[];
  recipes: SerializedRecipe[];
  recipeLines: SerializedRecipeLine[];
  auditLogs: SerializedAuditLog[];
  salesDaily: SerializedSalesDaily[];
  salesAdjustments: SerializedSalesAdjustment[];
};

const STORAGE_KEY = 'cafe678:data:v1';

function ensureBrowserStorage(): Storage {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('localStorage is only available in the browser');
  }

  return window.localStorage;
}

function toDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }

  return date;
}

function emptyData(): LocalData {
  return {
    items: [],
    itemCostVersions: [],
    products: [],
    productPriceVersions: [],
    productCostVersions: [],  
    recipes: [],
    recipeLines: [],
    auditLogs: [],
    salesDaily: [],
    salesAdjustments: [],
  };
}

function isBranch(value: unknown): value is Branch {
  return value === 'Santiago' || value === 'Temuco';
}

function isYieldUnit(value: unknown): value is YieldUnit {
  return value === 'portion' || value === 'g' || value === 'ml' || value === 'unit';
}

function isRecipeLine(value: unknown): value is RecipeLine {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<RecipeLine>;

  if (candidate.lineType === 'item') {
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.recipeId === 'string' &&
      typeof candidate.itemId === 'string' &&
      typeof candidate.qtyInBase === 'number'
    );
  }

  if (candidate.lineType === 'recipe') {
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.recipeId === 'string' &&
      typeof candidate.subRecipeId === 'string' &&
      typeof candidate.qtyInSubYield === 'number'
    );
  }

  return false;
}

function assertPositive(value: number, message: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(message);
  }
}

function assertValidFrom(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error('validFrom es obligatorio');
  }
}

function assertBranch(branch: Branch): void {
  if (!isBranch(branch)) {
    throw new Error('branch es obligatorio');
  }
}

function normalizeToUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function serializeData(data: LocalData): SerializedLocalData {
  return {
    items: data.items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    itemCostVersions: (data.itemCostVersions ?? []).map((version) => ({
      ...version,
      validFrom: version.validFrom.toISOString(),
      validTo: version.validTo ? version.validTo.toISOString() : null,
      createdAt: version.createdAt.toISOString(),
    })),
    products: (data.products ?? []).map((product) => ({
      ...product,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    })),
    productPriceVersions: (data.productPriceVersions ?? []).map((version) => ({
      ...version,
      validFrom: version.validFrom.toISOString(),
      validTo: version.validTo ? version.validTo.toISOString() : null,
      createdAt: version.createdAt.toISOString(),
    })),
    productCostVersions: (data.productCostVersions ?? []).map((version) => ({
      ...version,
      validFrom: version.validFrom.toISOString(),
      validTo: version.validTo ? version.validTo.toISOString() : null,
      createdAt: version.createdAt.toISOString(),
    })),
    recipes: (data.recipes ?? []).map((recipe) => ({
      ...recipe,
      createdAt: recipe.createdAt.toISOString(),
      updatedAt: recipe.updatedAt.toISOString(),
    })),
    recipeLines: data.recipeLines ?? [],
    auditLogs: (data.auditLogs ?? []).map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString(),
    })),
    salesDaily: data.salesDaily ?? [],
    salesAdjustments: (data.salesAdjustments ?? []).map((adjustment) => ({
      ...adjustment,
      createdAt: adjustment.createdAt.toISOString(),
    })),
  };
}

function deserializeData(data: SerializedLocalData | Partial<SerializedLocalData>): LocalData {
  return {
    items: (data.items ?? []).map((item) => ({
      ...item,
      createdAt: toDate(item.createdAt),
      updatedAt: toDate(item.updatedAt),
    })),
    itemCostVersions: (data.itemCostVersions ?? []).map((version) => ({
      ...version,
      validFrom: toDate(version.validFrom),
      validTo: version.validTo ? toDate(version.validTo) : null,
      createdAt: toDate(version.createdAt),
    })),
    products: (data.products ?? []).map((product) => ({
      ...product,
      createdAt: toDate(product.createdAt),
      updatedAt: toDate(product.updatedAt),
    })),
    productPriceVersions: (data.productPriceVersions ?? []).map((version) => ({
      ...version,
      validFrom: toDate(version.validFrom),
      validTo: version.validTo ? toDate(version.validTo) : null,
      createdAt: toDate(version.createdAt),
    })),
    productCostVersions: (data.productCostVersions ?? []).map((version) => ({
      ...version,
      validFrom: toDate(version.validFrom),
      validTo: version.validTo ? toDate(version.validTo) : null,
      createdAt: toDate(version.createdAt),
    })),
    recipes: (data.recipes ?? []).map((recipe) => ({
      ...recipe,
      createdAt: toDate(recipe.createdAt),
      updatedAt: toDate(recipe.updatedAt),
    })),
    recipeLines: (data.recipeLines ?? []).filter(isRecipeLine),
    auditLogs: (data.auditLogs ?? []).map((log) => ({
      ...log,
      createdAt: toDate(log.createdAt),
    })),
    salesDaily: (data.salesDaily ?? []) as SalesDaily[],
    salesAdjustments: (data.salesAdjustments ?? []).map((adjustment) => ({
      ...adjustment,
      createdAt: toDate(adjustment.createdAt),
    })) as SalesAdjustment[],
  };
}

function isSerializedData(value: unknown): value is Partial<SerializedLocalData> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<SerializedLocalData>;
  const hasRequiredLegacyArrays =
    Array.isArray(candidate.items) && Array.isArray(candidate.itemCostVersions);

  const hasOptionalProductArrays =
    (candidate.products === undefined || Array.isArray(candidate.products)) &&
    (candidate.productPriceVersions === undefined ||
      Array.isArray(candidate.productPriceVersions)) &&
    (candidate.productCostVersions === undefined ||
      Array.isArray(candidate.productCostVersions));

  const hasOptionalRecipeArrays =
    (candidate.recipes === undefined || Array.isArray(candidate.recipes)) &&
    (candidate.recipeLines === undefined || Array.isArray(candidate.recipeLines));

  const hasOptionalAuditLogs =
    candidate.auditLogs === undefined || Array.isArray(candidate.auditLogs);

  const hasOptionalSalesDaily =
    candidate.salesDaily === undefined || Array.isArray(candidate.salesDaily);

  const hasOptionalSalesAdjustments =
    candidate.salesAdjustments === undefined || Array.isArray(candidate.salesAdjustments);

  return (
    hasRequiredLegacyArrays &&
    hasOptionalProductArrays &&
    hasOptionalRecipeArrays &&
    hasOptionalAuditLogs &&
    hasOptionalSalesDaily &&
    hasOptionalSalesAdjustments
  );
}

function readData(): LocalData {
  const storage = ensureBrowserStorage();
  const raw = storage.getItem(STORAGE_KEY);

  if (!raw) {
    return emptyData();
  }

  const parsed: unknown = JSON.parse(raw);
  if (!isSerializedData(parsed)) {
    throw new Error('Stored data is invalid');
  }

  return deserializeData(parsed);
}

function writeData(data: LocalData): void {
  const storage = ensureBrowserStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify(serializeData(data)));
}

function buildId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function assertIsoDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('date debe tener formato YYYY-MM-DD');
  }
}

function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundMoney(value: number): number {
  return Math.round(value);
}


function logAudit(params: {
  entityType: string;
  entityId: string;
  action: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  diffJson: any;
  actor?: string;
}): void {
  const data = readData();
  const entry: AuditLog = {
    id: buildId('audit'),
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    diffJson: params.diffJson,
    actor: params.actor ?? 'local',
    createdAt: new Date(),
  };

  writeData({
    ...data,
    auditLogs: [...data.auditLogs, entry],
  });
}

export function listAuditLogs(): AuditLog[] {
  return [...readData().auditLogs].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export function clearAuditLogs(actor = 'local'): void {
  const data = readData();
  const clearedCount = data.auditLogs.length;
  const entry: AuditLog = {
    id: buildId('audit'),
    entityType: 'audit',
    entityId: 'all',
    action: 'clear_audit',
    diffJson: { clearedCount },
    actor,
    createdAt: new Date(),
  };

  writeData({
    ...data,
    auditLogs: [entry],
  });
}


export function addAuditEvent(params: {
  entityType: string;
  entityId: string;
  action: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  diffJson: any;
  actor?: string;
}): void {
  logAudit({
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    diffJson: params.diffJson,
    actor: params.actor ?? 'local',
  });
}

export function listItems(): Item[] {
  const data = readData();
  return [...data.items].sort((a, b) => a.name.localeCompare(b.name, 'es-CL'));
}

export function getItem(id: string): Item | undefined {
  return readData().items.find((item) => item.id === id);
}

export function upsertItem(
  item: Omit<Item, 'createdAt' | 'updatedAt'> &
    Partial<Pick<Item, 'createdAt' | 'updatedAt'>>,
): Item {
  const data = readData();
  const now = new Date();
  const current = data.items.find((entry) => entry.id === item.id);

  const nextItem: Item = {
    ...item,
    createdAt: current?.createdAt ?? item.createdAt ?? now,
    updatedAt: now,
  };

  const nextItems = current
    ? data.items.map((entry) => (entry.id === nextItem.id ? nextItem : entry))
    : [...data.items, nextItem];

  writeData({ ...data, items: nextItems });

  logAudit({
    entityType: 'item',
    entityId: nextItem.id,
    action: current ? 'update' : 'create',
    diffJson: { before: current ?? null, after: nextItem },
  });

  return nextItem;
}

export function deleteItem(id: string): void {
  const data = readData();
  const removed = data.items.find((item) => item.id === id) ?? null;

  writeData({
    ...data,
    items: data.items.filter((item) => item.id !== id),
    itemCostVersions: data.itemCostVersions.filter((version) => version.itemId !== id),
  });

  logAudit({
    entityType: 'item',
    entityId: id,
    action: 'delete',
    diffJson: { removed },
  });
}

export function listItemCosts(itemId: string, branch: Branch): ItemCostVersion[] {
  assertBranch(branch);
  return readData()
    .itemCostVersions
    .filter((version) => version.itemId === itemId && version.branch === branch)
    .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());
}

export function addItemCostVersion(
  itemId: string,
  branch: Branch,
  newVersion: NewItemCostVersion,
): ItemCostVersion[] {
  assertBranch(branch);
  assertValidFrom(newVersion.validFrom);

  if (newVersion.packQtyInBase <= 0) {
    throw new Error('packQtyInBase debe ser > 0');
  }

  if (newVersion.packCostGrossClp < 0) {
    throw new Error('packCostGrossClp debe ser >= 0');
  }

  const data = readData();
  const existingForKey = data.itemCostVersions
    .filter((version) => version.itemId === itemId && version.branch === branch)
    .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());

  const timeline = applyNewVersion(
    existingForKey.map((version) => ({
      validFrom: version.validFrom,
      validTo: version.validTo,
    })),
    {
      validFrom: newVersion.validFrom,
      validTo: newVersion.validTo ?? null,
    },
  );

  const updatedExisting = existingForKey.map((version) => {
    const match = timeline.find(
      (timelineVersion) =>
        timelineVersion.validFrom.getTime() === version.validFrom.getTime(),
    );

    return match ? { ...version, validTo: match.validTo } : version;
  });

  const insertedTimeline = timeline.at(-1);
  if (!insertedTimeline) {
    throw new Error('Failed to insert new item cost version');
  }

  const insertedVersion: ItemCostVersion = {
    id: buildId('item_cost'),
    itemId,
    branch,
    packQtyInBase: newVersion.packQtyInBase,
    packCostGrossClp: newVersion.packCostGrossClp,
    yieldRateOverride: newVersion.yieldRateOverride ?? null,
    validFrom: insertedTimeline.validFrom,
    validTo: insertedTimeline.validTo,
    createdAt: new Date(),
  };

  const untouched = data.itemCostVersions.filter(
    (version) => !(version.itemId === itemId && version.branch === branch),
  );

  const nextVersions = [...untouched, ...updatedExisting, insertedVersion];
  writeData({ ...data, itemCostVersions: nextVersions });

  logAudit({
    entityType: 'item_cost_version',
    entityId: insertedVersion.id,
    action: 'add_version',
    diffJson: { itemId, branch, version: insertedVersion },
  });

  return [...updatedExisting, insertedVersion].sort(
    (a, b) => a.validFrom.getTime() - b.validFrom.getTime(),
  );
}

export function listProducts(): Product[] {
  const data = readData();
  return [...data.products].sort((a, b) => a.name.localeCompare(b.name, 'es-CL'));
}

export function getProduct(id: string): Product | undefined {
  return readData().products.find((product) => product.id === id);
}

export function upsertProduct(
  product: Omit<Product, 'createdAt' | 'updatedAt'> &
    Partial<Pick<Product, 'createdAt' | 'updatedAt'>>,
): Product {
  const data = readData();
  const now = new Date();
  const current = data.products.find((entry) => entry.id === product.id);

  const nextProduct: Product = {
    ...product,
    createdAt: current?.createdAt ?? product.createdAt ?? now,
    updatedAt: now,
  };

  const nextProducts = current
    ? data.products.map((entry) => (entry.id === nextProduct.id ? nextProduct : entry))
    : [...data.products, nextProduct];

  writeData({ ...data, products: nextProducts });

  logAudit({
    entityType: 'product',
    entityId: nextProduct.id,
    action: current ? 'update' : 'create',
    diffJson: { before: current ?? null, after: nextProduct },
  });

  return nextProduct;
}

export function deleteProduct(id: string): void {
  const data = readData();
  const removed = data.products.find((product) => product.id === id) ?? null;

  writeData({
    ...data,
    products: data.products.filter((product) => product.id !== id),
    productPriceVersions: data.productPriceVersions.filter(
      (version) => version.productId !== id,
    ),
    productCostVersions: data.productCostVersions.filter(
      (version) => version.productId !== id,
    ),
  });

  logAudit({
    entityType: 'product',
    entityId: id,
    action: 'delete',
    diffJson: { removed },
  });
}

export function listProductPrices(
  productId: string,
  branch: Branch,
): ProductPriceVersion[] {
  assertBranch(branch);
  return readData()
    .productPriceVersions
    .filter((version) => version.productId === productId && version.branch === branch)
    .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());
}

export function addProductPriceVersion(
  productId: string,
  branch: Branch,
  newVersion: NewProductPriceVersion,
): ProductPriceVersion[] {
  assertBranch(branch);
  assertValidFrom(newVersion.validFrom);

  if (newVersion.priceGrossClp < 0) {
    throw new Error('priceGrossClp debe ser >= 0');
  }

  const data = readData();
  const existingForKey = data.productPriceVersions
    .filter((version) => version.productId === productId && version.branch === branch)
    .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());

  const timeline = applyNewVersion(
    existingForKey.map((version) => ({
      validFrom: version.validFrom,
      validTo: version.validTo,
    })),
    {
      validFrom: newVersion.validFrom,
      validTo: newVersion.validTo ?? null,
    },
  );

  const updatedExisting = existingForKey.map((version) => {
    const match = timeline.find(
      (timelineVersion) =>
        timelineVersion.validFrom.getTime() === version.validFrom.getTime(),
    );

    return match ? { ...version, validTo: match.validTo } : version;
  });

  const insertedTimeline = timeline.at(-1);
  if (!insertedTimeline) {
    throw new Error('Failed to insert new product price version');
  }

  const insertedVersion: ProductPriceVersion = {
    id: buildId('product_price'),
    productId,
    branch,
    priceGrossClp: newVersion.priceGrossClp,
    validFrom: insertedTimeline.validFrom,
    validTo: insertedTimeline.validTo,
    createdAt: new Date(),
  };

  const untouched = data.productPriceVersions.filter(
    (version) => !(version.productId === productId && version.branch === branch),
  );

  const nextVersions = [...untouched, ...updatedExisting, insertedVersion];
  writeData({ ...data, productPriceVersions: nextVersions });

  logAudit({
    entityType: 'product_price_version',
    entityId: insertedVersion.id,
    action: 'add_version',
    diffJson: { productId, branch, version: insertedVersion },
  });

  return [...updatedExisting, insertedVersion].sort(
    (a, b) => a.validFrom.getTime() - b.validFrom.getTime(),
  );
}

export function listProductCosts(
  productId: string,
  branch: Branch,
): ProductCostVersion[] {
  assertBranch(branch);
  return readData()
    .productCostVersions
    .filter((version) => version.productId === productId && version.branch === branch)
    .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());
}

export function addProductCostVersion(
  productId: string,
  branch: Branch,
  newVersion: NewProductCostVersion,
): ProductCostVersion[] {
  assertBranch(branch);
  assertValidFrom(newVersion.validFrom);

  if (newVersion.costGrossClp < 0) {
    throw new Error('costGrossClp debe ser >= 0');
  }

  const data = readData();
  const existingForKey = data.productCostVersions
    .filter((version) => version.productId === productId && version.branch === branch)
    .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());

  const timeline = applyNewVersion(
    existingForKey.map((version) => ({
      validFrom: version.validFrom,
      validTo: version.validTo,
    })),
    {
      validFrom: newVersion.validFrom,
      validTo: newVersion.validTo ?? null,
    },
  );

  const updatedExisting = existingForKey.map((version) => {
    const match = timeline.find(
      (timelineVersion) =>
        timelineVersion.validFrom.getTime() === version.validFrom.getTime(),
    );

    return match ? { ...version, validTo: match.validTo } : version;
  });

  const insertedTimeline = timeline.at(-1);
  if (!insertedTimeline) {
    throw new Error('Failed to insert new product cost version');
  }

  const insertedVersion: ProductCostVersion = {
    id: buildId('product_cost'),
    productId,
    branch,
    costGrossClp: newVersion.costGrossClp,
    validFrom: insertedTimeline.validFrom,
    validTo: insertedTimeline.validTo,
    createdAt: new Date(),
  };

  const untouched = data.productCostVersions.filter(
    (version) => !(version.productId === productId && version.branch === branch),
  );

  const nextVersions = [...untouched, ...updatedExisting, insertedVersion];
  writeData({ ...data, productCostVersions: nextVersions });

  logAudit({
    entityType: 'product_cost_version',
    entityId: insertedVersion.id,
    action: 'add_version',
    diffJson: { productId, branch, version: insertedVersion },
  });

  return [...updatedExisting, insertedVersion].sort(
    (a, b) => a.validFrom.getTime() - b.validFrom.getTime(),
  );
}


export function updateProductCostVersionValidFrom(
  versionId: string,
  newValidFrom: Date,
): ProductCostVersion[] {
  assertValidFrom(newValidFrom);

  const normalizedNewValidFrom = normalizeToUtcDay(newValidFrom);
  const data = readData();
  const target = data.productCostVersions.find((version) => version.id === versionId);

  if (!target) {
    throw new Error('Versión de costo no encontrada');
  }

  const versionsForKey = data.productCostVersions
    .filter(
      (version) =>
        version.productId === target.productId && version.branch === target.branch,
    )
    .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());

  const targetIndex = versionsForKey.findIndex((version) => version.id === versionId);
  if (targetIndex === -1) {
    throw new Error('Versión de costo no encontrada para producto/sucursal');
  }

  const previous = versionsForKey[targetIndex - 1] ?? null;
  const next = versionsForKey[targetIndex + 1] ?? null;

  if (previous && normalizedNewValidFrom <= normalizeToUtcDay(previous.validFrom)) {
    throw new Error('validFrom debe ser mayor al validFrom anterior');
  }

  if (next && normalizedNewValidFrom >= normalizeToUtcDay(next.validFrom)) {
    throw new Error('validFrom debe ser menor al siguiente validFrom');
  }

  const updated = versionsForKey.map((version) => {
    if (version.id === versionId) {
      return {
        ...version,
        validFrom: normalizedNewValidFrom,
      };
    }

    if (previous && version.id === previous.id) {
      const previousValidTo = new Date(normalizedNewValidFrom);
      previousValidTo.setUTCDate(previousValidTo.getUTCDate() - 1);
      return {
        ...version,
        validTo: previousValidTo,
      };
    }

    return version;
  });

  const untouched = data.productCostVersions.filter(
    (version) =>
      !(version.productId === target.productId && version.branch === target.branch),
  );

  const nextVersions = [...untouched, ...updated];
  writeData({ ...data, productCostVersions: nextVersions });

  logAudit({
    entityType: 'product_cost_version',
    entityId: target.id,
    action: 'product_cost_validfrom_changed',
    diffJson: {
      productId: target.productId,
      branch: target.branch,
      versionId: target.id,
      previousValidFrom: target.validFrom,
      newValidFrom: normalizedNewValidFrom,
    },
  });

  return updated.sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());
}

export function listRecipes(): Recipe[] {
  return [...readData().recipes].sort((a, b) => a.name.localeCompare(b.name, 'es-CL'));
}

export function getRecipe(id: string): Recipe | undefined {
  return readData().recipes.find((recipe) => recipe.id === id);
}

export function upsertRecipe(
  recipe: Omit<Recipe, 'createdAt' | 'updatedAt'> &
    Partial<Pick<Recipe, 'createdAt' | 'updatedAt'>>,
): Recipe {
  if (!isYieldUnit(recipe.yieldUnit)) {
    throw new Error('yieldUnit inválido');
  }

  assertPositive(recipe.yieldQty, 'yieldQty debe ser > 0');

  const data = readData();
  const now = new Date();
  const current = data.recipes.find((entry) => entry.id === recipe.id);

  const nextRecipe: Recipe = {
    ...recipe,
    createdAt: current?.createdAt ?? recipe.createdAt ?? now,
    updatedAt: now,
  };

  const nextRecipes = current
    ? data.recipes.map((entry) => (entry.id === nextRecipe.id ? nextRecipe : entry))
    : [...data.recipes, nextRecipe];

  writeData({ ...data, recipes: nextRecipes });

  logAudit({
    entityType: 'recipe',
    entityId: nextRecipe.id,
    action: current ? 'update' : 'create',
    diffJson: { before: current ?? null, after: nextRecipe },
  });

  return nextRecipe;
}

export function deleteRecipe(id: string): void {
  const data = readData();
  const now = new Date();

  const removed = data.recipes.find((recipe) => recipe.id === id) ?? null;
  const affectedProducts = data.products
    .filter((product) => (product.recipeId ?? null) === id)
    .map((product) => product.id);

  writeData({
    ...data,
    products: data.products.map((product) =>
      (product.recipeId ?? null) === id
        ? {
            ...product,
            recipeId: null,
            updatedAt: now,
          }
        : product,
    ),
    recipes: data.recipes.filter((recipe) => recipe.id !== id),
    recipeLines: data.recipeLines.filter(
      (line) => line.recipeId !== id && !(line.lineType === 'recipe' && line.subRecipeId === id),
    ),
  });

  logAudit({
    entityType: 'recipe',
    entityId: id,
    action: 'delete',
    diffJson: { removed, affectedProducts },
  });
}

export function listRecipeLines(recipeId: string): RecipeLine[] {
  return readData().recipeLines.filter((line) => line.recipeId === recipeId);
}

export function upsertRecipeLine(line: RecipeLine): RecipeLine {
  if (line.lineType === 'item') {
    assertPositive(line.qtyInBase, 'qtyInBase debe ser > 0');
  } else {
    assertPositive(line.qtyInSubYield, 'qtyInSubYield debe ser > 0');

    if (line.recipeId === line.subRecipeId) {
      throw new Error('No se permite self-reference en receta');
    }
  }

  const data = readData();
  const before = data.recipeLines.find((entry) => entry.id === line.id) ?? null;
  const exists = data.recipeLines.some((entry) => entry.id === line.id);
  const nextRecipeLines = exists
    ? data.recipeLines.map((entry) => (entry.id === line.id ? line : entry))
    : [...data.recipeLines, line];

  writeData({ ...data, recipeLines: nextRecipeLines });

  logAudit({
    entityType: 'recipe_line',
    entityId: line.id,
    action: exists ? 'update' : 'create',
    diffJson: { before, after: line },
  });

  return line;
}

export function deleteRecipeLine(id: string): void {
  const data = readData();
  const removed = data.recipeLines.find((line) => line.id === id) ?? null;

  writeData({
    ...data,
    recipeLines: data.recipeLines.filter((line) => line.id !== id),
  });

  logAudit({
    entityType: 'recipe_line',
    entityId: id,
    action: 'delete',
    diffJson: { removed },
  });
}

export type SantiagoSalesImportRow = {
  date: string;
  productName: string;
  qty: number;
  grossSalesClp: number;
  category?: string;
  subCategory?: string;
};

export type SantiagoSalesImportSummary = {
  rowsRead: number;
  rowsValid: number;
  dateMin: string | null;
  dateMax: string | null;
  totalGross: number;
  createdProductsCount: number;
};

export type TemucoSalesImportRow = {
  date: string;
  product: string;
  qty: number;
  gross: number;
};

export type ImportSalesResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
};

type SalesDailyEntryInput = Omit<SalesDaily, 'id' | 'date' | 'branch'> &
  Partial<Pick<SalesDaily, 'id'>>;

export type SalesAdjustmentInput = {
  date: string;
  branch: Branch;
  productId: string;
  qty: number;
  grossSalesClp: number;
  note?: string;
};

export function listSalesDaily(params: { date: string; branch: Branch }): SalesDaily[] {
  assertIsoDate(params.date);
  assertBranch(params.branch);

  return readData().salesDaily.filter(
    (entry) => entry.date === params.date && entry.branch === params.branch,
  );
}

export function setSalesDaily(
  date: string,
  branch: Branch,
  entries: SalesDailyEntryInput[],
): SalesDaily[] {
  assertIsoDate(date);
  assertBranch(branch);

  const data = readData();
  const existing = data.salesDaily.filter((entry) => entry.date === date && entry.branch === branch);

  const normalized: SalesDaily[] = entries.map((entry) => {
    const qty = roundQty(Number(entry.qty));
    const grossSalesClp = roundMoney(Number(entry.grossSalesClp));

    if (!Number.isFinite(qty) || qty < 0) {
      throw new Error('qty debe ser >= 0');
    }

    if (!Number.isFinite(grossSalesClp) || grossSalesClp < 0) {
      throw new Error('grossSalesClp debe ser >= 0');
    }

    return {
      id: entry.id ?? buildId('sales'),
      date,
      branch,
      productId: entry.productId,
      qty,
      grossSalesClp,
    };
  });

  const previousByProduct = new Map(existing.map((entry) => [entry.productId, entry]));
  const changedCount = normalized.filter((entry) => {
    const prev = previousByProduct.get(entry.productId);
    return !prev || prev.qty !== entry.qty || prev.grossSalesClp !== entry.grossSalesClp;
  }).length;

  const keepOthers = data.salesDaily.filter((entry) => !(entry.date === date && entry.branch === branch));
  writeData({
    ...data,
    salesDaily: [...keepOthers, ...normalized],
  });

  logAudit({
    entityType: 'sales_daily',
    entityId: `${branch}:${date}`,
    action: 'sales_upsert',
    diffJson: { date, branch, changedCount },
  });

  return normalized;
}

export function upsertSalesDaily(
  date: string,
  branch: Branch,
  entries: SalesDailyEntryInput[],
): SalesDaily[] {
  return setSalesDaily(date, branch, entries);
}

export function getSalesForProduct(
  date: string,
  branch: Branch,
  productId: string,
): SalesDaily | undefined {
  return listSalesDaily({ date, branch }).find((entry) => entry.productId === productId);
}

export function listSalesAdjustments(params: { date: string; branch: Branch }): SalesAdjustment[] {
  assertIsoDate(params.date);
  assertBranch(params.branch);

  return readData().salesAdjustments
    .filter((entry) => entry.date === params.date && entry.branch === params.branch)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export function addSalesAdjustment(input: SalesAdjustmentInput): SalesAdjustment {
  assertIsoDate(input.date);
  assertBranch(input.branch);

  const qty = roundQty(Number(input.qty));
  const grossSalesClp = roundMoney(Number(input.grossSalesClp));

  if (!Number.isFinite(qty) || qty < 0) {
    throw new Error('qty debe ser >= 0');
  }

  if (!Number.isFinite(grossSalesClp) || grossSalesClp < 0) {
    throw new Error('grossSalesClp debe ser >= 0');
  }

  const adjustment: SalesAdjustment = {
    id: buildId('sales_adjustment'),
    date: input.date,
    branch: input.branch,
    productId: input.productId,
    qty,
    grossSalesClp,
    note: input.note?.trim() ? input.note.trim() : undefined,
    createdAt: new Date(),
  };

  const data = readData();
  writeData({
    ...data,
    salesAdjustments: [...data.salesAdjustments, adjustment],
  });

  logAudit({
    entityType: 'sales_adjustment',
    entityId: adjustment.id,
    action: 'create',
    diffJson: adjustment,
  });

  return adjustment;
}

export function deleteSalesAdjustment(id: string): void {
  if (!id) {
    throw new Error('id es obligatorio');
  }

  const data = readData();
  const target = data.salesAdjustments.find((entry) => entry.id === id);

  if (!target) {
    throw new Error('Ajuste no encontrado');
  }

  writeData({
    ...data,
    salesAdjustments: data.salesAdjustments.filter((entry) => entry.id !== id),
  });

  logAudit({
    entityType: 'sales_adjustment',
    entityId: id,
    action: 'delete',
    diffJson: { removed: target },
  });
}

export function listSalesEffective(params: { date: string; branch: Branch }): SalesDaily[] {
  const baseRows = listSalesDaily(params);
  const adjustments = listSalesAdjustments(params);

  const byProduct = new Map<string, SalesDaily>();

  baseRows.forEach((row) => {
    byProduct.set(row.productId, { ...row });
  });

  adjustments.forEach((adjustment) => {
    const existing = byProduct.get(adjustment.productId);
    if (existing) {
      existing.qty = roundQty(existing.qty + adjustment.qty);
      existing.grossSalesClp = roundMoney(existing.grossSalesClp + adjustment.grossSalesClp);
      return;
    }

    byProduct.set(adjustment.productId, {
      id: `sales_effective:${adjustment.date}:${adjustment.branch}:${adjustment.productId}`,
      date: adjustment.date,
      branch: adjustment.branch,
      productId: adjustment.productId,
      qty: adjustment.qty,
      grossSalesClp: adjustment.grossSalesClp,
    });
  });

  return [...byProduct.values()];
}

export function importSalesSantiago(
  rows: SantiagoSalesImportRow[],
  options?: { createMissingProducts?: boolean; rowsRead?: number },
): SantiagoSalesImportSummary {
  const createMissingProducts = options?.createMissingProducts ?? true;
  const rowsRead = options?.rowsRead ?? rows.length;
  const data = readData();
  const now = new Date();

  const productsByName = new Map(
    data.products.map((product) => [product.name.trim().toLocaleLowerCase('es-CL'), product]),
  );

  const aggregatedByDateProduct = new Map<
    string,
    {
      date: string;
      productName: string;
      qty: number;
      grossSalesClp: number;
      category?: string;
    }
  >();

  let totalGross = 0;
  let rowsValid = 0;
  let dateMin: string | null = null;
  let dateMax: string | null = null;
  const nextProducts = [...data.products];
  let createdProductsCount = 0;

  for (const row of rows) {
    assertIsoDate(row.date);

    const productName = row.productName.trim();
    const qty = roundQty(Number(row.qty));
    const grossSalesClp = roundMoney(Number(row.grossSalesClp));

    if (!productName) {
      continue;
    }

    if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(grossSalesClp) || grossSalesClp < 0) {
      continue;
    }

    const key = `${row.date}|${productName.toLocaleLowerCase('es-CL')}`;
    const existing = aggregatedByDateProduct.get(key);

    if (existing) {
      existing.qty = roundQty(existing.qty + qty);
      existing.grossSalesClp = roundMoney(existing.grossSalesClp + grossSalesClp);
    } else {
      aggregatedByDateProduct.set(key, {
        date: row.date,
        productName,
        qty,
        grossSalesClp,
        category: row.category?.trim() || row.subCategory?.trim() || undefined,
      });
    }

    rowsValid += 1;
    totalGross += grossSalesClp;
    if (dateMin === null || row.date.localeCompare(dateMin) < 0) {
      dateMin = row.date;
    }

    if (dateMax === null || row.date.localeCompare(dateMax) > 0) {
      dateMax = row.date;
    }
  }

  const importedEntries: SalesDaily[] = [];

  for (const item of aggregatedByDateProduct.values()) {
    const productKey = item.productName.toLocaleLowerCase('es-CL');
    let product = productsByName.get(productKey);

    if (!product && createMissingProducts) {
      product = {
        id: buildId('product'),
        name: item.productName,
        category: item.category,
        recipeId: null,
        active: true,
        createdAt: now,
        updatedAt: now,
      };

      productsByName.set(productKey, product);
      nextProducts.push(product);
      createdProductsCount += 1;
    }

    if (!product) {
      continue;
    }

    importedEntries.push({
      id: buildId('sales'),
      date: item.date,
      branch: 'Santiago',
      productId: product.id,
      qty: item.qty,
      grossSalesClp: item.grossSalesClp,
    });
  }

  const importedKeys = new Set(
    importedEntries.map((entry) => `${entry.date}|${entry.productId}`),
  );

  const keepSales = data.salesDaily.filter(
    (entry) =>
      !(
        entry.branch === 'Santiago' &&
        importedKeys.has(`${entry.date}|${entry.productId}`)
      ),
  );

  writeData({
    ...data,
    products: nextProducts,
    salesDaily: [...keepSales, ...importedEntries],
  });

  logAudit({
    entityType: 'sales_daily',
    entityId: 'Santiago:import',
    action: 'sales_import_santiago',
    diffJson: {
      rowsRead,
      rowsValid,
      dateMin,
      dateMax,
      totalGross,
      createdProductsCount,
    },
    actor: 'local',
  });

  return {
    rowsRead,
    rowsValid,
    dateMin,
    dateMax,
    totalGross,
    createdProductsCount,
  };
}

export function importSalesTemuco(
  rows: TemucoSalesImportRow[],
  options?: { keepSales?: boolean },
): ImportSalesResult {
  const keepSales = options?.keepSales ?? true;
  const data = readData();
  const productsByName = new Map(
    data.products.map((product) => [product.name.trim().toLocaleLowerCase('es-CL'), product]),
  );

  const aggregatedByDateProduct = new Map<
    string,
    {
      date: string;
      productId: string;
      qty: number;
      grossSalesClp: number;
    }
  >();

  const errors: string[] = [];

  rows.forEach((row, index) => {
    const rowLabel = `fila ${index + 1}`;
    try {
      assertIsoDate(row.date);
    } catch {
      errors.push(`${rowLabel}: fecha inválida`);
      return;
    }

    const productName = String(row.product ?? '').trim();
    if (!productName) {
      errors.push(`${rowLabel}: producto vacío`);
      return;
    }

    const product = productsByName.get(productName.toLocaleLowerCase('es-CL'));
    if (!product) {
      errors.push(`${rowLabel}: producto no encontrado (${productName})`);
      return;
    }

    const qty = roundQty(Number(row.qty));
    const grossSalesClp = roundMoney(Number(row.gross));
    if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(grossSalesClp) || grossSalesClp < 0) {
      errors.push(`${rowLabel}: qty/monto inválido`);
      return;
    }

    const key = `${row.date}|${product.id}`;
    const existing = aggregatedByDateProduct.get(key);
    if (existing) {
      existing.qty = roundQty(existing.qty + qty);
      existing.grossSalesClp = roundMoney(existing.grossSalesClp + grossSalesClp);
    } else {
      aggregatedByDateProduct.set(key, {
        date: row.date,
        productId: product.id,
        qty,
        grossSalesClp,
      });
    }
  });

  if (aggregatedByDateProduct.size === 0) {
    return {
      imported: 0,
      updated: 0,
      skipped: rows.length,
      errors: errors.length ? errors : ['No valid rows to import.'],
    };
  }

  const existingByKey = new Map(
    data.salesDaily
      .filter((entry) => entry.branch === 'Temuco')
      .map((entry) => [`${entry.date}|${entry.productId}`, entry]),
  );

  let imported = 0;
  let updated = 0;

  const rowsByDay = new Map<string, SalesDailyEntryInput[]>();
  const importedDates = new Set<string>();

  aggregatedByDateProduct.forEach((entry) => {
    importedDates.add(entry.date);

    const prev = existingByKey.get(`${entry.date}|${entry.productId}`);
    if (!prev) {
      imported += 1;
    } else if (prev.qty !== entry.qty || prev.grossSalesClp !== entry.grossSalesClp) {
      updated += 1;
    }

    const current = rowsByDay.get(entry.date);
    const payload = {
      productId: entry.productId,
      qty: entry.qty,
      grossSalesClp: entry.grossSalesClp,
    };

    if (current) {
      current.push(payload);
    } else {
      rowsByDay.set(entry.date, [payload]);
    }
  });

  if (!keepSales) {
    const current = readData();
    writeData({
      ...current,
      salesDaily: current.salesDaily.filter(
        (entry) => entry.branch !== 'Temuco' || importedDates.has(entry.date),
      ),
    });
  }

  rowsByDay.forEach((entries, date) => {
    setSalesDaily(date, 'Temuco', entries);
  });

  logAudit({
    entityType: 'sales_daily',
    entityId: 'Temuco:import',
    action: 'sales_import_temuco',
    diffJson: {
      rowsRead: rows.length,
      rowsValid: aggregatedByDateProduct.size,
      imported,
      updated,
      skipped: rows.length - aggregatedByDateProduct.size,
      keepSales,
    },
    actor: 'local',
  });

  return {
    imported,
    updated,
    skipped: rows.length - aggregatedByDateProduct.size,
    errors,
  };
}

export function duplicateSalesFromPreviousDay(date: string, branch: Branch): SalesDaily[] {
  assertIsoDate(date);
  assertBranch(branch);

  const currentDate = new Date(`${date}T00:00:00.000Z`);
  currentDate.setUTCDate(currentDate.getUTCDate() - 1);
  const previousDate = currentDate.toISOString().slice(0, 10);

  const previousEntries = listSalesDaily({ date: previousDate, branch });
  const duplicated = setSalesDaily(
    date,
    branch,
    previousEntries.map((entry) => ({
      productId: entry.productId,
      qty: entry.qty,
      grossSalesClp: entry.grossSalesClp,
    })),
  );

  logAudit({
    entityType: 'sales_daily',
    entityId: `${branch}:${date}`,
    action: 'sales_duplicate_previous',
    diffJson: { date, branch, fromDate: previousDate, copiedCount: previousEntries.length },
  });

  return duplicated;
}

export function exportData(): void {
  const data = readData();
  const payload = JSON.stringify(serializeData(data), null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `cafe678-export-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();

  URL.revokeObjectURL(url);

  logAudit({
    entityType: 'dataset',
    entityId: 'local',
    action: 'export',
    diffJson: {
      items: data.items.length,
      products: data.products.length,
      recipes: data.recipes.length,
      recipeLines: data.recipeLines.length,
      auditLogs: data.auditLogs.length,
      salesDaily: data.salesDaily.length,
      salesAdjustments: data.salesAdjustments.length,
    },
  });
}

export function importData(json: string): void {
  const parsed: unknown = JSON.parse(json);
  if (!isSerializedData(parsed)) {
    throw new Error('Invalid import payload: items and itemCostVersions are required');
  }

  const existing = readData();
  const data = deserializeData(parsed);
  const now = new Date();
  const recipeIds = new Set(data.recipes.map((recipe) => recipe.id));

  const hasAuditLogsInImport =
    typeof parsed === 'object' &&
    parsed !== null &&
    Object.prototype.hasOwnProperty.call(parsed, 'auditLogs');

  const hasSalesAdjustmentsInImport =
    typeof parsed === 'object' &&
    parsed !== null &&
    Object.prototype.hasOwnProperty.call(parsed, 'salesAdjustments');

  const dataSanitized: LocalData = {
    ...data,
    products: data.products.map((product) => {
      if (product.recipeId && !recipeIds.has(product.recipeId)) {
        return {
          ...product,
          recipeId: null,
          updatedAt: now,
        };
      }

      return product;
    }),
    auditLogs: hasAuditLogsInImport ? data.auditLogs : existing.auditLogs,
    salesAdjustments: hasSalesAdjustmentsInImport ? data.salesAdjustments : existing.salesAdjustments,
  };

  writeData(dataSanitized);

  logAudit({
    entityType: 'dataset',
    entityId: 'local',
    action: 'import',
    diffJson: {
      items: dataSanitized.items.length,
      itemCostVersions: dataSanitized.itemCostVersions.length,
      products: dataSanitized.products.length,
      productPriceVersions: dataSanitized.productPriceVersions.length,
      productCostVersions: dataSanitized.productCostVersions.length,
      recipes: dataSanitized.recipes.length,
      recipeLines: dataSanitized.recipeLines.length,
      auditLogs: dataSanitized.auditLogs.length,
      salesDaily: dataSanitized.salesDaily.length,
      salesAdjustments: dataSanitized.salesAdjustments.length,
    },
  });
}
