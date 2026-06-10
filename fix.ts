import prisma from './src/config/db';

async function main() {
  const t = await prisma.tenant.findFirst();
  if (t) {
    const res = await prisma.user.updateMany({
      where: { role: 'CUSTOMER', tenantId: null },
      data: { tenantId: t.id }
    });
    console.log('Fixed users:', res.count);
  }
}

main().finally(() => prisma.$disconnect());
