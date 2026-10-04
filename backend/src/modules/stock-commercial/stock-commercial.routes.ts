import { Router } from 'express';
import * as ctrl from './stock-commercial.controller';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();

// ─── Toutes les routes stock-commercial réservées aux admins ──────────────────

// Stock en temps réel
router.get('/', requireAuth, ctrl.getStockCommercial);
router.get('/stock-dynamique/:commercialId', requireAuth, ctrl.getStockDynamiqueCommercial);

// Bons de sortie
router.post('/bons-sortie', requireAuth, ctrl.createBonSortie);
router.get('/bons-sortie', requireAuth, ctrl.listBonsSortie);
router.get('/bons-sortie/:id', requireAuth, ctrl.getBonSortie);
router.patch('/bons-sortie/:id', requireAuth, ctrl.updateBonSortie);
router.get('/bons-sortie/:id/pdf', requireAuth, ctrl.downloadBonSortiePdf);
router.post('/bons-sortie/:id/envoyer-email', requireAuth, ctrl.sendBonSortieEmail);
router.patch('/bons-sortie/:id/valider', requireAuth, ctrl.validerBonSortie);

// Inventaires
router.get('/inventaires', requireAuth, ctrl.listInventaires);
router.get('/bons-sortie/:id/inventaire', requireAuth, ctrl.getInventaire);
router.post('/bons-sortie/:id/inventaire', requireAuth, ctrl.createInventaire);
router.patch('/inventaires/lignes/:ligneId', requireAuth, ctrl.updateLigneInventaire);
router.post('/inventaires/:id/valider', requireAuth, ctrl.validerInventaire);

export default router;

