import { Request, Response } from 'express';
import prisma from '../../config/db';

export const getSupportInfo = async (req: Request, res: Response) => {
  try {
    const supportInfo = {
      phone: "+91 98765 43210",
      email: "support@shopnest.com",
      hours: "Mon-Fri, 9am-6pm"
    };
    
    res.json({
      success: true,
      data: supportInfo
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSupportTicket = async (req: Request, res: Response) => {
  try {
    const { subject, message, name, email, phone } = req.body;
    
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' });
    }

    const tenantId = (req as any).tenant?.id || null;
    const ticket = await prisma.supportTicket.create({
      data: {
        subject,
        message,
        name,
        email,
        phone,
        tenantId,
        userId: (req as any).user?.id || null
      }
    });

    res.status(201).json({
      success: true,
      data: ticket,
      message: 'Support ticket submitted successfully'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
