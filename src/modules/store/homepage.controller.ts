import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/db';


export const getHomepageData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tenantId = (req as any).tenant?.id || null;

    const [featured, categories, newArrivals, dbBanners, reviews, blogs, certifications] = await Promise.all([
      prisma.product.findMany({
        where: { isPublished: true, isFeatured: true, tenantId },
        take: 8,
        include: {
          images: { select: { imageUrl: true, isPrimary: true } },
          variants: { select: { price: true, compareAtPrice: true, images: { select: { imageUrl: true, isPrimary: true } } } }
        }
      }),
      prisma.category.findMany({
        where: { isActive: true, tenantId, parentId: null },
        take: 6,
        orderBy: { sortOrder: 'asc' }
      }),
      prisma.product.findMany({
        where: { isPublished: true, tenantId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          images: { select: { imageUrl: true, isPrimary: true } },
          variants: { select: { price: true, compareAtPrice: true, images: { select: { imageUrl: true, isPrimary: true } } } }
        }
      }),
      prisma.banner.findMany({
        where: { isActive: true, tenantId },
        orderBy: { sortOrder: 'asc' },
        include: { category: { select: { id: true, name: true, slug: true } } }
      }).catch(() => []),
      prisma.review.findMany({
        where: { isApproved: true, product: { tenantId } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { name: true } } }
      }).catch(() => []),
      prisma.blog.findMany({
        where: { isPublished: true, tenantId },
        orderBy: { createdAt: 'desc' },
        take: 4
      }).catch(() => []),
      prisma.certification.findMany({
        where: { isActive: true, tenantId },
        orderBy: { sortOrder: 'asc' }
      }).catch(() => [])
    ]);

    const banners = dbBanners.map(b => ({
      id: b.id,
      title: b.title,
      imageUrl: b.imageUrl,
      link: (b.category ? `/products?category=${b.category.slug}` : b.link) || '/products',
      categoryId: b.categoryId,
      categoryName: b.category?.name || null,
    }));

    const mapProductPrice = (p: any) => {
      let displayPrice = Number(p.price);
      let displayComparePrice = p.comparePrice ? Number(p.comparePrice) : null;
      if (displayPrice === 0 && p.variants && p.variants.length > 0) {
        const lowestVariant = p.variants.reduce((min: any, v: any) => (Number(v.price) < Number(min.price) ? v : min), p.variants[0]);
        displayPrice = Number(lowestVariant.price);
        displayComparePrice = lowestVariant.compareAtPrice ? Number(lowestVariant.compareAtPrice) : null;
      }
      let displayImages = p.images;
      if (!displayImages || displayImages.length === 0) {
        if (p.variants && p.variants.length > 0) {
          for (const variant of p.variants) {
            const vImage = variant.images?.find((i: any) => i.isPrimary) || variant.images?.[0];
            if (vImage) {
              displayImages = [vImage];
              break;
            }
          }
        }
      }
      return {
        ...p,
        price: displayPrice,
        comparePrice: displayComparePrice,
        images: displayImages,
        variants: undefined
      };
    };

    res.json({
      success: true,
      data: {
        featured: featured.map(mapProductPrice),
        categories,
        banners,
        new_arrivals: newArrivals.map(mapProductPrice),
        reviews,
        blogs,
        certifications
      }
    });
  } catch (err) {
    next(err);
  }
};
