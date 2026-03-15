import type { Branch } from '@/src/domain/types';
import type { BranchRepository, BranchRecord } from '@/src/server/repositories/contracts/branches';
import { prisma } from '@/src/server/db/prisma';

function toBranchName(value: string): Branch {
  if (value !== 'Santiago' && value !== 'Temuco') {
    throw new Error(`Unsupported branch name: ${value}`);
  }

  return value;
}

function mapBranch(input: { id: string; name: string }): BranchRecord {
  return {
    id: input.id,
    name: toBranchName(input.name),
  };
}

export const prismaBranchRepository: BranchRepository = {
  async list() {
    const rows = await prisma.branch.findMany({
      orderBy: { name: 'asc' },
    });

    return rows.map(mapBranch);
  },
  async getById(id) {
    const row = await prisma.branch.findUnique({ where: { id } });
    return row ? mapBranch(row) : null;
  },
};
