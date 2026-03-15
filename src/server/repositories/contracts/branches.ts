import type { Branch } from '@/src/domain/types';

export type BranchRecord = {
  id: string;
  name: Branch;
};

export interface BranchRepository {
  list(): Promise<BranchRecord[]>;
  getById(id: string): Promise<BranchRecord | null>;
}
