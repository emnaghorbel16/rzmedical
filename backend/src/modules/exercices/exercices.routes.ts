import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import * as controller from './exercices.controller';

const router = Router();

// Routes protégées (données fiscales internes — admin uniquement)
router.get('/', requireAuth, controller.list);
router.get('/actif', requireAuth, controller.getActif);
router.get('/:id/stats', requireAuth, controller.stats);

// Admin — protégés
router.post('/', requireAuth, controller.create);
router.patch('/:id/activer', requireAuth, controller.activer);
router.patch('/:id', requireAuth, controller.update);
router.delete('/:id', requireAuth, controller.remove);

export default router;
