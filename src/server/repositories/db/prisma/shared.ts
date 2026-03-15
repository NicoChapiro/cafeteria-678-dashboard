import type { Branch } from '@/src/domain/types';

export const BRANCH_ID_BY_NAME: Record<Branch, string> = {
  Santiago: 'branch_santiago',
  Temuco: 'branch_temuco',
};

export const BRANCH_NAME_BY_ID: Record<string, Branch> = {
  branch_santiago: 'Santiago',
  branch_temuco: 'Temuco',
};

export function toBranchId(branch: Branch): string {
  return BRANCH_ID_BY_NAME[branch];
}

export function toBranchName(branchId: string): Branch {
  const branch = BRANCH_NAME_BY_ID[branchId];
  if (!branch) {
    throw new Error(`Unknown branch id: ${branchId}`);
  }

  return branch;
}
