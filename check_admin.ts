import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@shopnest.com' }
  });
  if (admin) {
    console.log(`Admin exists! Role: ${admin.role}`);
  } else {
    console.log(`Admin does NOT exist.`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
