import { randomUUID } from 'node:crypto';

import type { Item, ItemCostVersion } from '@/src/domain/types';
import type { ItemRepository } from '@/src/server/repositories/contracts/items';
import { prisma } from '@/src/server/db/prisma';
import { toBranchId, toBranchName } from './shared';

function mapItem(row: {
  id: string;
  name: string;
  category: string | null;
  baseUnit: string;
  yieldRateDefault: { toNumber(): number } | null;
  createdAt: Date;
  updatedAt: Date;
}): Item {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? undefined,
    baseUnit: row.baseUnit as Item['baseUnit'],
    yieldRateDefault: row.yieldRateDefault?.toNumber(),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapItemCostVersion(row: {
  id: string;
  itemId: string;
  branchId: string;
  packQtyInBase: { toNumber(): number };
  packCostGrossClp: number;
  yieldRateOverride: { toNumber(): number } | null;
  validFrom: Date;
  validTo: Date | null;
  createdAt: Date;
}): ItemCostVersion {
  return {
    id: row.id,
    itemId: row.itemId,
    branch: toBranchName(row.branchId),
    packQtyInBase: row.packQtyInBase.toNumber(),
    packCostGrossClp: row.packCostGrossClp,
    yieldRateOverride: row.yieldRateOverride?.toNumber() ?? null,
    validFrom: row.validFrom,
    validTo: row.validTo,
    createdAt: row.createdAt,
  };
}

export const prismaItemRepository: ItemRepository = {
  async list() {
    const rows = await prisma.item.findMany({ orderBy: { name: 'asc' } });
    return rows.map(mapItem);
  },
  async getById(id) {
    const row = await prisma.item.findUnique({ where: { id } });
    return row ? mapItem(row) : null;
  },
  async upsert(item) {
    const row = await prisma.item.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        category: item.category ?? null,
        baseUnit: item.baseUnit,
        yieldRateDefault: item.yieldRateDefault ?? null,
      },
      create: {
        id: item.id,
        name: item.name,
        category: item.category ?? null,
        baseUnit: item.baseUnit,
        yieldRateDefault: item.yieldRateDefault ?? null,
      },
    });

    return mapItem(row);
  },
  async delete(id) {
    await prisma.item.delete({ where: { id } });
  },
  async listCostVersions(itemId, branch) {
    const rows = await prisma.itemCostVersion.findMany({
      where: { itemId, branchId: toBranchId(branch) },
      orderBy: { validFrom: 'asc' },
    });

    return rows.map(mapItemCostVersion);
  },
  async addCostVersion(itemId, branch, version) {
    await prisma.itemCostVersion.create({
      data: {
        id: randomUUID(),
        itemId,
        branchId: toBranchId(branch),
        packQtyInBase: version.packQtyInBase,
        packCostGrossClp: version.packCostGrossClp,
        yieldRateOverride: version.yieldRateOverride ?? null,
        validFrom: version.validFrom,
        validTo: version.validTo ?? null,
      },
    });

    return this.listCostVersions(itemId, branch);
  },
};
