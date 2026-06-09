import { Router } from 'express';
import { getAllTickets, updateTicketStatus } from './support.controller';

const router = Router();

router.get('/', getAllTickets);
router.put('/:id/status', updateTicketStatus);

export default router;
