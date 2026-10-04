import { Router } from 'express';
import * as controller from './brands.controller';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();

// ─── Routes publiques (catalogue) ─────────────────────────────────────────────
router.get('/', controller.getAll);
router.get('/:id', controller.getById);

// ─── Routes admin (authentification requise) ───────────────────────────────────
router.post('/', requireAuth, controller.create);
router.put('/:id', requireAuth, controller.update);
router.delete('/:id', requireAuth, controller.remove);

export default router;

