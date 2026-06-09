require('dotenv').config();
import prisma from './src/config/db';

async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'madukadai@gmail.com' }, include: { ownedTenant: true } });
  if (user && user.ownedTenant) {
    await prisma.siteConfig.upsert({
      where: { tenantId_key: { tenantId: user.ownedTenant.id, key: 'STORE_EMAIL' } },
      update: { value: user.email },
      create: { tenantId: user.ownedTenant.id, key: 'STORE_EMAIL', value: user.email, group: 'general' }
    });
    await prisma.siteConfig.upsert({
      where: { tenantId_key: { tenantId: user.ownedTenant.id, key: 'STORE_PHONE' } },
      update: { value: user.phone || '9344193569' },
      create: { tenantId: user.ownedTenant.id, key: 'STORE_PHONE', value: user.phone || '9344193569', group: 'general' }
    });
    console.log('Successfully updated siteConfig for Madu Kadai');
  } else {
    console.log('User or tenant not found');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
