import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixColors() {
  try {
    const config = await prisma.siteConfig.findMany({
      where: {
        key: { in: ['PRIMARY_COLOR', 'FOOTER_COLOR'] }
      }
    });

    for (const c of config) {
      if (Array.isArray(c.value) && c.value.length > 0) {
        console.log(`Fixing ${c.key}... changing ${JSON.stringify(c.value)} to ${c.value[0]}`);
        await prisma.siteConfig.update({
          where: { id: c.id },
          data: { value: c.value[0] }
        });
      }
    }
    console.log("Colors fixed!");
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

fixColors();
