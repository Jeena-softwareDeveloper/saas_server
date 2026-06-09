import 'dotenv/config';
import prisma from '../config/db';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Seeding Database with Categories and Products...');

  // 1. Create Super Admin
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@admin.com';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'Super Admin',
      email: adminEmail,
      passwordHash: hashedPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
      emailVerified: true
    }
  });
  console.log('Super Admin ensured!');

  // 2. Create Categories
  let electronics = await prisma.category.findFirst({ where: { slug: 'electronics' } });
  if (!electronics) {
    electronics = await prisma.category.create({
      data: {
        name: 'Electronics',
        slug: 'electronics',
        description: 'Gadgets, phones, and laptops.',
        isActive: true,
      },
    });
  }

  let clothing = await prisma.category.findFirst({ where: { slug: 'clothing' } });
  if (!clothing) {
    clothing = await prisma.category.create({
      data: {
        name: 'Clothing',
        slug: 'clothing',
        description: 'Men and Women clothing.',
        isActive: true,
      },
    });
  }

  console.log('Categories created!');

  // 2. Create Products for Electronics
  let phone = await prisma.product.findFirst({ where: { sku: 'ELEC-PHONE-001' } });
  if (!phone) {
    await prisma.product.create({
      data: {
        name: 'Smartphone Pro Max',
        slug: 'smartphone-pro-max',
        description: 'The latest premium smartphone with amazing camera.',
        shortDesc: 'A powerful smartphone.',
        sku: 'ELEC-PHONE-001',
        price: 89900,
        stockQuantity: 50,
        categoryId: electronics.id,
        images: {
          create: [
            { imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=600&auto=format&fit=crop', isPrimary: true },
          ],
        },
      },
    });
  }

  let laptop = await prisma.product.findFirst({ where: { sku: 'ELEC-LAPTOP-002' } });
  if (!laptop) {
    await prisma.product.create({
      data: {
        name: 'UltraBook Laptop 14"',
        slug: 'ultrabook-laptop-14',
        description: 'Lightweight laptop for developers and creators.',
        shortDesc: 'High-performance laptop.',
        sku: 'ELEC-LAPTOP-002',
        price: 125000,
        stockQuantity: 20,
        categoryId: electronics.id,
        images: {
          create: [
            { imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=600&auto=format&fit=crop', isPrimary: true },
          ],
        },
      },
    });
  }

  // 4. Create Products for Clothing
  let tshirt = await prisma.product.findFirst({ where: { sku: 'CLO-TSHIRT-001' } });
  if (!tshirt) {
    await prisma.product.create({
      data: {
        name: 'Classic Cotton T-Shirt',
        slug: 'classic-cotton-tshirt',
        description: '100% premium cotton t-shirt for everyday wear.',
        shortDesc: 'Comfortable t-shirt.',
        sku: 'CLO-TSHIRT-001',
        price: 1499,
        stockQuantity: 100,
        categoryId: clothing.id,
        images: {
          create: [
            { imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=600&auto=format&fit=crop', isPrimary: true },
          ],
        },
      },
    });
  }

  console.log('Products created!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
