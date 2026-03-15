import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BRANCHES = [
  { id: 'branch_santiago', name: 'Santiago' },
  { id: 'branch_temuco', name: 'Temuco' },
] as const;

async function main() {
  for (const branch of BRANCHES) {
    await prisma.branch.upsert({
      where: { id: branch.id },
      update: { name: branch.name },
      create: branch,
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
