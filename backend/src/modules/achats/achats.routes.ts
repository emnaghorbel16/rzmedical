import { Router } from 'express';
import * as ctrl from './achats.controller';
import { requireAuth } from '../auth/auth.middleware';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ocrUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 15 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		const accepted = file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/');
		cb(null, accepted);
	},
});

const chargeUploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'charges');
fs.mkdirSync(chargeUploadDir, { recursive: true });
const chargeDocumentUpload = multer({
  storage: multer.diskStorage({
    destination: chargeUploadDir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')),
});

const router = Router();

// ─── Toutes les routes achats sont réservées aux admins authentifiés ──────────

// ─── Stats ────────────────────────────────────────────────────────────────────
router.get('/stats', requireAuth, ctrl.getAchatsStats);

// ─── Bons de Commande ─────────────────────────────────────────────────────────
router.get('/bons-commande', requireAuth, ctrl.listBonsCommande);
router.get('/bons-commande/:id', requireAuth, ctrl.getBonCommande);
router.get('/bons-commande/:id/pdf', requireAuth, ctrl.downloadBonCommandePdf);
router.post('/bons-commande', requireAuth, ctrl.createBonCommande);
router.put('/bons-commande/:id', requireAuth, ctrl.updateBonCommande);
router.delete('/bons-commande/:id', requireAuth, ctrl.deleteBonCommande);
router.post('/bons-commande/:id/transformer-br', requireAuth, ctrl.transformerBCenBR);

// ─── Bons de Réception ────────────────────────────────────────────────────────
router.get('/bons-reception', requireAuth, ctrl.listBonsReception);
router.get('/bons-reception/:id', requireAuth, ctrl.getBonReception);
router.get('/bons-reception/:id/pdf', requireAuth, ctrl.downloadBonReceptionPdf);
router.post('/bons-reception', requireAuth, ctrl.createBonReception);
router.put('/bons-reception/:id', requireAuth, ctrl.updateBonReception);
router.delete('/bons-reception/:id', requireAuth, ctrl.deleteBonReception);
router.patch('/bons-reception/:id/valider', requireAuth, ctrl.validerBonReception);
router.post('/bons-reception/:id/transformer-facture', requireAuth, ctrl.transformerBRenFF);

// ─── Factures Fournisseurs ────────────────────────────────────────────────────
router.post('/factures/ocr', requireAuth, ocrUpload.single('file'), ctrl.analyzeFactureFournisseurOCR);
router.get('/factures', requireAuth, ctrl.listFacturesFournisseurs);
router.get('/factures/:id', requireAuth, ctrl.getFactureFournisseur);
router.get('/factures/:id/pdf', requireAuth, ctrl.downloadFactureFournisseurPdf);
router.post('/factures', requireAuth, ctrl.createFactureFournisseur);
router.put('/factures/:id', requireAuth, ctrl.updateFactureFournisseur);
router.post('/factures/:id/envoyer-email', requireAuth, ctrl.sendFactureFournisseurEmail);
router.delete('/factures/:id', requireAuth, ctrl.deleteFactureFournisseur);
router.post('/factures/:id/paiements', requireAuth, ctrl.addPaiementFF);

// Formulaires de charges spécialisés.
router.post('/charges/document', requireAuth, chargeDocumentUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Pièce justificative invalide' });
  res.status(201).json({ url: `/uploads/charges/${req.file.filename}` });
});
// Route OCR spécifique CNSS — doit être AVANT /charges/:categorie pour éviter le conflit
router.post('/charges/cnss/ocr', requireAuth, ocrUpload.single('file'), ctrl.analyzeCnssReceiptOCR);
router.get('/charges/:categorie', requireAuth, ctrl.listSpecificCharges);
router.post('/charges/:categorie', requireAuth, ctrl.createCharge);
router.get('/charges/:categorie/:id', requireAuth, ctrl.getSpecificCharge);
router.put('/charges/:categorie/:id', requireAuth, ctrl.updateSpecificCharge);

export default router;

