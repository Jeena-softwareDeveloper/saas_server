import { Request, Response } from 'express';
import prisma from '../../config/db';

export const getAllTickets = async (req: Request, res: Response) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    res.json({
      success: true,
      data: tickets
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTicketStatus = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { status }
    });

    res.json({
      success: true,
      data: ticket,
      message: 'Support ticket status updated'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
