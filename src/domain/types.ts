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
