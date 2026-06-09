import { Request, Response } from 'express';
import prisma from '../../config/db';

export const getBlogs = async (req: Request, res: Response) => {
  try {
    const tenantId = ((req as any).user?.tenantId || null) || null;
    const blogs = await prisma.blog.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: blogs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createBlog = async (req: Request, res: Response) => {
  try {
    const { title, slug, imageUrl, content, author, isPublished } = req.body;
    
    // Auto-generate slug if not provided
    const blogSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const blog = await prisma.blog.create({
      data: {
        tenantId: ((req as any).user?.tenantId || null) || null,
        title,
        slug: blogSlug,
        imageUrl,
        content,
        author,
        isPublished: isPublished !== undefined ? isPublished : true,
      },
    });

    res.status(201).json({ success: true, data: blog, message: "Blog added successfully" });
  } catch (error: any) {
    // Check for unique constraint violation on slug
    if (error.code === 'P2002' && error.meta?.target?.includes('slug')) {
      return res.status(400).json({ success: false, message: "A blog with this title/slug already exists." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBlog = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { title, slug, imageUrl, content, author, isPublished } = req.body;
    
    const data: any = {};
    if (title !== undefined) data.title = title;
    if (slug !== undefined) data.slug = slug;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (content !== undefined) data.content = content;
    if (author !== undefined) data.author = author;
    if (isPublished !== undefined) data.isPublished = isPublished;

    const blog = await prisma.blog.update({
      where: { id },
      data,
    });
    res.json({ success: true, data: blog, message: "Blog updated successfully" });
  } catch (error: any) {
    if (error.code === 'P2002' && error.meta?.target?.includes('slug')) {
      return res.status(400).json({ success: false, message: "A blog with this title/slug already exists." });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteBlog = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.blog.delete({ where: { id } });
    res.json({ success: true, message: "Blog deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
