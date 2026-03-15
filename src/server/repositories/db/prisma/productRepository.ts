import { randomUUID } from 'node:crypto';

import type { Product, ProductCostVersion, ProductPriceVersion } from '@/src/domain/types';
import type { ProductRepository } from '@/src/server/repositories/contracts/products';
import { prisma } from '@/src/server/db/prisma';
import { toBranchId, toBranchName } from './shared';

function mapProduct(row: {
  id: string;
  name: string;
  category: string | null;
  recipeId: string | null;
  wasteRatePct: { toNumber(): number } | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? undefined,
    recipeId: row.recipeId,
    wasteRatePct: row.wasteRatePct?.toNumber(),
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapPriceVersion(row: {
  id: string;
  productId: string;
  branchId: string;
  priceGrossClp: number;
  validFrom: Date;
  validTo: Date | null;
  createdAt: Date;
}): ProductPriceVersion {
  return {
    id: row.id,
    productId: row.productId,
    branch: toBranchName(row.branchId),
    priceGrossClp: row.priceGrossClp,
    validFrom: row.validFrom,
    validTo: row.validTo,
    createdAt: row.createdAt,
  };
}

function mapCostVersion(row: {
  id: string;
  productId: string;
  branchId: string;
  costGrossClp: number;
  validFrom: Date;
  validTo: Date | null;
  createdAt: Date;
}): ProductCostVersion {
  return {
    id: row.id,
    productId: row.productId,
    branch: toBranchName(row.branchId),
    costGrossClp: row.costGrossClp,
    validFrom: row.validFrom,
    validTo: row.validTo,
    createdAt: row.createdAt,
  };
}

export const prismaProductRepository: ProductRepository = {
  async list() {
    const rows = await prisma.product.findMany({ orderBy: { name: 'asc' } });
    return rows.map(mapProduct);
  },
  async getById(id) {
    const row = await prisma.product.findUnique({ where: { id } });
    return row ? mapProduct(row) : null;
  },
  async upsert(product) {
    const row = await prisma.product.upsert({
      where: { id: product.id },
      update: {
        name: product.name,
        category: product.category ?? null,
        recipeId: product.recipeId ?? null,
        wasteRatePct: product.wasteRatePct ?? null,
        active: product.active,
      },
      create: {
        id: product.id,
        name: product.name,
        category: product.category ?? null,
        recipeId: product.recipeId ?? null,
        wasteRatePct: product.wasteRatePct ?? null,
        active: product.active,
      },
    });

    return mapProduct(row);
  },
  async delete(id) {
    await prisma.product.delete({ where: { id } });
  },
  async listPriceVersions(productId, branch) {
    const rows = await prisma.productPriceVersion.findMany({
      where: { productId, branchId: toBranchId(branch) },
      orderBy: { validFrom: 'asc' },
    });
    return rows.map(mapPriceVersion);
  },
  async addPriceVersion(productId, branch, version) {
    await prisma.productPriceVersion.create({
      data: {
        id: randomUUID(),
        productId,
        branchId: toBranchId(branch),
        priceGrossClp: version.priceGrossClp,
        validFrom: version.validFrom,
        validTo: version.validTo ?? null,
      },
    });

    return this.listPriceVersions(productId, branch);
  },
  async listCostVersions(productId, branch) {
    const rows = await prisma.productCostVersion.findMany({
      where: { productId, branchId: toBranchId(branch) },
      orderBy: { validFrom: 'asc' },
    });
    return rows.map(mapCostVersion);
  },
  async addCostVersion(productId, branch, version) {
    await prisma.productCostVersion.create({
      data: {
        id: randomUUID(),
        productId,
        branchId: toBranchId(branch),
        costGrossClp: version.costGrossClp,
        validFrom: version.validFrom,
        validTo: version.validTo ?? null,
      },
    });

    return this.listCostVersions(productId, branch);
  },
};
