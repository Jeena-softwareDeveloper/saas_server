const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.product.findMany({ where: { name: '56' } });
  console.log(p);
}
main().finally(() => prisma.$disconnect());
