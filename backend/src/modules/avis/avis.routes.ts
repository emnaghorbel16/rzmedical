import { Router, Request, Response } from 'express';
import prisma from '../../config/prisma';
import { optionalClient, AuthRequest } from '../auth/auth.middleware';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();

// ─── GET /api/avis?produitId=xxx ─────────────────────────────────────────────
// Retourne les avis approuvés d'un produit + statistiques agrégées
router.get('/', async (req: Request, res: Response) => {
  try {
    const produitId = parseInt(req.query.produitId as string, 10);
    if (!produitId || isNaN(produitId)) {
      return res.status(400).json({ error: 'produitId requis' });
    }

    const [avis, stats] = await Promise.all([
      prisma.avisClient.findMany({
        where: { produitId, statut: 'APPROUVE' },
        orderBy: { creeLe: 'desc' },
        select: {
          id: true,
          nomAuteur: true,
          note: true,
          titre: true,
          commentaire: true,
          verifieAchat: true,
          creeLe: true,
        },
      }),
      prisma.avisClient.aggregate({
        where: { produitId, statut: 'APPROUVE' },
        _avg: { note: true },
        _count: { id: true },
      }),
    ]);

    res.json({
      avis,
      notemoyenne: stats._avg.note ? Math.round(stats._avg.note * 10) / 10 : null,
      totalAvis: stats._count.id,
    });
  } catch (err) {
    console.error('GET /api/avis error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des avis' });
  }
});

// ─── POST /api/avis — Soumettre un avis (client connecté ou invité) ─────────
router.post('/', optionalClient, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id ?? null;
    const { produitId, note, titre, commentaire, nomAuteur } = req.body;

    if (!produitId || !note || !commentaire) {
      return res.status(400).json({ error: 'produitId, note et commentaire sont requis' });
    }
    const noteNum = Number(note);
    if (isNaN(noteNum) || noteNum < 1 || noteNum > 5) {
      return res.status(400).json({ error: 'La note doit être comprise entre 1 et 5' });
    }
    if (String(commentaire).trim().length < 5) {
      return res.status(400).json({ error: 'Le commentaire doit comporter au moins 5 caractères' });
    }

    // Vérifier que le produit existe
    const produit = await prisma.produit.findUnique({
      where: { id: Number(produitId) },
      select: { id: true },
    });
    if (!produit) {
      return res.status(404).json({ error: 'Produit introuvable' });
    }

    let auteur = (nomAuteur || '').trim();
    let achatVerifie = false;

    if (userId) {
      // Client connecté : vérifier doublon
      const existant = await prisma.avisClient.findFirst({
        where: { produitId: Number(produitId), utilisateurId: userId },
      });
      if (existant) {
        return res.status(409).json({ error: 'Vous avez déjà soumis un avis pour ce produit' });
      }

      // Vérifier si l'achat est confirmé (achat vérifié)
      const commande = await prisma.commande.findFirst({
        where: {
          utilisateurId: userId,
          statut: { in: ['LIVREE', 'CONFIRMEE'] },
          lignesCommande: { some: { produitId: Number(produitId) } },
        },
        select: { id: true },
      });
      achatVerifie = !!commande;

      const utilisateur = await prisma.utilisateur.findUnique({
        where: { id: userId },
        select: { prenom: true, nom: true },
      });
      if (utilisateur?.prenom) {
        auteur = `${utilisateur.prenom} ${utilisateur.nom ? utilisateur.nom[0] + '.' : ''}`.trim();
      }
    }

    if (!auteur) {
      auteur = 'Client';
    }

    const avis = await prisma.avisClient.create({
      data: {
        produitId: Number(produitId),
        utilisateurId: userId,
        nomAuteur: auteur,
        note: Math.round(noteNum),
        titre: titre?.trim() || null,
        commentaire: String(commentaire).trim(),
        statut: 'EN_ATTENTE', // Soumis à validation admin
        verifieAchat: achatVerifie,
      },
    });

    res.status(201).json({
      message: 'Votre avis a été soumis avec succès et sera publié après validation. Merci pour votre retour !',
      avisId: avis.id,
    });
  } catch (err) {
    console.error('POST /api/avis error:', err);
    res.status(500).json({ error: "Erreur lors de la soumission de l'avis" });
  }
});

// ─── Admin: GET /api/avis/admin — Tous les avis (modération) ─────────────────
router.get('/admin', requireAuth, async (req: Request, res: Response) => {
  try {
    const statut = (req.query.statut as string) || undefined;
    const avis = await prisma.avisClient.findMany({
      where: statut ? { statut: statut as any } : undefined,
      orderBy: { creeLe: 'desc' },
      include: {
        produit: { select: { nom: true, reference: true } },
        utilisateur: { select: { prenom: true, nom: true, email: true } },
      },
    });
    res.json(avis);
  } catch (err) {
    console.error('GET /api/avis/admin error:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ─── Admin: PATCH /api/avis/:id — Modérer un avis ────────────────────────────
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const { statut } = req.body;

    if (!['APPROUVE', 'REJETE', 'EN_ATTENTE'].includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    const avis = await prisma.avisClient.update({
      where: { id },
      data: { statut },
    });
    res.json(avis);
  } catch (err) {
    console.error('PATCH /api/avis/:id error:', err);
    res.status(500).json({ error: 'Erreur lors de la modération' });
  }
});

// ─── Admin: DELETE /api/avis/:id ─────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await prisma.avisClient.delete({ where: { id } });
    res.json({ message: 'Avis supprimé' });
  } catch (err) {
    console.error('DELETE /api/avis/:id error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

export default router;
