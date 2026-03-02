export type Branch = 'Santiago' | 'Temuco';

export type BaseUnit = 'g' | 'ml' | 'unit';

export type Item = {
  id: string;
  name: string;
  category?: string;
  baseUnit: BaseUnit;
  yieldRateDefault?: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ItemCostVersion = {
  id: string;
  itemId: string;
  branch: Branch;
  packQtyInBase: number;
  packCostGrossClp: number;
  yieldRateOverride?: number | null;
  validFrom: Date;
  validTo: Date | null;
  createdAt: Date;
};

export type NewItemCostVersion = {
  packQtyInBase: number;
  packCostGrossClp: number;
  yieldRateOverride?: number | null;
  validFrom: Date;
  validTo?: Date | null;
};

export type Product = {
  id: string;
  name: string;
  category?: string;
  recipeId?: string | null;
  wasteRatePct?: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductPriceVersion = {
  id: string;
  productId: string;
  branch: Branch;
  priceGrossClp: number;
  validFrom: Date;
  validTo: Date | null;
  createdAt: Date;
};

export type ProductCostVersion = {
  id: string;
  productId: string;
  branch: Branch;
  costGrossClp: number;
  validFrom: Date;
  validTo: Date | null;
  createdAt: Date;
};

export type NewProductPriceVersion = {
  priceGrossClp: number;
  validFrom: Date;
  validTo?: Date | null;
};

export type NewProductCostVersion = {
  costGrossClp: number;
  validFrom: Date;
  validTo?: Date | null;
};

export type RecipeType =
  | 'fria'
  | 'caliente'
  | 'sin_cafeina'
  | 'pan'
  | 'sandwich'
  | 'intermedia';

export type YieldUnit = 'portion' | 'g' | 'ml' | 'unit';

export type Recipe = {
  id: string;
  name: string;
  type: RecipeType;
  yieldQty: number;
  yieldUnit: YieldUnit;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ItemRecipeLine = {
  id: string;
  recipeId: string;
  lineType: 'item';
  itemId: string;
  qtyInBase: number;
};

export type SubRecipeLine = {
  id: string;
  recipeId: string;
  lineType: 'recipe';
  subRecipeId: string;
  qtyInSubYield: number;
};

export type RecipeLine = ItemRecipeLine | SubRecipeLine;



export type SalesDaily = {
  id: string;
  date: string; // YYYY-MM-DD
  branch: Branch;
  productId: string;
  qty: number;
  grossSalesClp: number;
};

export type SalesAdjustment = {
  id: string;
  date: string;
  branch: Branch;
  productId: string;
  qty: number;
  grossSalesClp: number;
  note?: string;
  createdAt: Date;
};

export type AuditLog = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  diffJson: any;
  actor: string;
  createdAt: Date;
};
