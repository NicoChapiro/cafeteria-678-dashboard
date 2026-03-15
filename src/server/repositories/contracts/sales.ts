import type { Branch, SalesAdjustment, SalesDaily } from '@/src/domain/types';

export type SalesByDayParams = {
  date: string;
  branch: Branch;
};

export interface SalesRepository {
  listDaily(params: SalesByDayParams): Promise<SalesDaily[]>;
  listAdjustments(params: SalesByDayParams): Promise<SalesAdjustment[]>;
  upsertDaily(entry: SalesDaily): Promise<SalesDaily>;
  addAdjustment(entry: SalesAdjustment): Promise<SalesAdjustment>;
  deleteAdjustment(id: string): Promise<void>;
}
