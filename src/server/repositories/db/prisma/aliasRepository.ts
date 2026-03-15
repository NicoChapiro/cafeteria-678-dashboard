import { randomUUID } from 'node:crypto';

import type { AliasRepository } from '@/src/server/repositories/contracts/aliases';
import { prisma } from '@/src/server/db/prisma';

export const prismaAliasRepository: AliasRepository = {
  async list() {
    const rows = await prisma.productAlias.findMany({
      orderBy: [{ source: 'asc' }, { externalName: 'asc' }],
    });

    return rows.map((row: { source: string; externalName: string; productId: string }) => ({
      source: row.source,
      externalName: row.externalName,
      productId: row.productId,
    }));
  },
  async upsert(alias) {
    await prisma.productAlias.upsert({
      where: {
        source_externalName: {
          source: alias.source,
          externalName: alias.externalName,
        },
      },
      update: { productId: alias.productId },
      create: {
        id: randomUUID(),
        source: alias.source,
        externalName: alias.externalName,
        productId: alias.productId,
      },
    });
  },
  async delete(source, externalName) {
    const deleted = await prisma.productAlias.deleteMany({ where: { source, externalName } });
    return deleted.count > 0;
  },
  async resolveProductId(source, externalName) {
    const found = await prisma.productAlias.findUnique({
      where: { source_externalName: { source, externalName } },
      select: { productId: true },
    });

    return found?.productId ?? null;
  },
};
