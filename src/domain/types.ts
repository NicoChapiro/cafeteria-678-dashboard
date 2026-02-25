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
