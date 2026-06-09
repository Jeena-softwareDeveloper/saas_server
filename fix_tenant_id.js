const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const t = await prisma.tenant.findFirst();
  if (t) {
    const res = await prisma.user.updateMany({
      where: { role: 'CUSTOMER', tenantId: null },
      data: { tenantId: t.id }
    });
    console.log(`Fixed ${res.count} users`);
  } else {
    console.log('No tenant found');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
