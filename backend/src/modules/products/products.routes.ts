import { Router } from 'express';
import * as controller from './products.controller';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();

// ─── Routes publiques (catalogue) ─────────────────────────────────────────────
router.get('/', controller.getAll);
router.get('/new', controller.getNew);
router.get('/promo', controller.getPromo);
router.get('/reference/:reference', controller.getByReference);
router.get('/:id', controller.getById);

// ─── Routes admin (authentification requise) ───────────────────────────────────
router.post('/', requireAuth, controller.create);
router.put('/:id', requireAuth, controller.update);
router.delete('/:id', requireAuth, controller.remove);
router.get('/:id/stock-repartition', requireAuth, controller.getStockRepartition);

export default router;
