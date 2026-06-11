import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const product = await prisma.product.findFirst();
    if (!product) {
      console.log('No product found');
      return;
    }
    console.log('Found product:', product.id);

    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        variantName: 'Test Variant',
      }
    });
    console.log('Variant created:', variant.id);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
