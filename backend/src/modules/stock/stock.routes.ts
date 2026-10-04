import { Router, Request, Response } from 'express';
import { StockMovementType } from '../../../generated/prisma/enums';
import { listStockMovements, validateInventory } from './stock.service';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();

router.get('/movements', requireAuth, async (req: Request, res: Response) => {
  try {
    const type = req.query.type as StockMovementType | undefined;
    const validTypes = Object.values(StockMovementType) as string[];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ error: 'Type de mouvement invalide' });
    }
    const result = await listStockMovements({
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      search: req.query.search as string | undefined,
      type,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      productId: req.query.productId ? Number(req.query.productId) : undefined,
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/inventory', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await validateInventory({
      productId: Number(req.body.productId),
      countedStock: Number(req.body.countedStock),
      reference: req.body.reference,
      userId: req.body.userId ? Number(req.body.userId) : undefined,
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;

