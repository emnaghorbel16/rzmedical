import { Router, Request, Response } from 'express';
import prisma from '../../config/prisma';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();

// GET /api/stats/public — Chiffres clés pour la page À propos (sans auth, volontairement public)
router.get('/public', async (_req: Request, res: Response) => {
  try {
    const [totalProduits, totalClients, totalCommandes] = await Promise.all([
      prisma.produit.count({ where: { disponible: true } }),
      prisma.utilisateur.count({ where: { typeUtilisateur: 'CLIENT' } }),
      prisma.commande.count(),
    ]);
    res.json({ totalProduits, totalClients, totalCommandes });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Helper: build date range filter ──────────────────────────────────────────

function buildDateFilter(periode?: string, dateDebut?: string, dateFin?: string, exerciceAnnee?: number): { gte?: Date; lte?: Date } | undefined {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const quarter = Math.floor(month / 3);

  if (exerciceAnnee) {
    // Exercice fiscal override: return undefined to filter separately via exercice dates
    return undefined;
  }

  switch (periode) {
    case 'annee':
      return { gte: new Date(`${year}-01-01T00:00:00.000Z`), lte: new Date(`${year}-12-31T23:59:59.999Z`) };
    case 'annee_precedente':
      return { gte: new Date(`${year - 1}-01-01T00:00:00.000Z`), lte: new Date(`${year - 1}-12-31T23:59:59.999Z`) };
    case 'mois':
      const firstDayMonth = new Date(year, month, 1);
      const lastDayMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);
      return { gte: firstDayMonth, lte: lastDayMonth };
    case 'trimestre': {
      const qStart = new Date(year, quarter * 3, 1);
      const qEnd = new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999);
      return { gte: qStart, lte: qEnd };
    }
    case 'custom':
      if (dateDebut && dateFin) {
        return { gte: new Date(dateDebut), lte: new Date(dateFin) };
      }
      return undefined;
    default:
      // Default: current year
      return { gte: new Date(`${year}-01-01T00:00:00.000Z`), lte: new Date(`${year}-12-31T23:59:59.999Z`) };
  }
}

// GET /api/stats/impayes - Factures clients et fournisseurs non soldées (admin uniquement)
// Kept separate from the full dashboard so an unrelated dashboard metric cannot
// prevent the collection screen from loading.
router.get('/impayes', requireAuth, async (req: Request, res: Response) => {
  try {
    const periode = (req.query.periode as string) || 'annee';
    const exerciceAnnee = req.query.exerciceAnnee ? Number(req.query.exerciceAnnee) : undefined;
    let dateRange = buildDateFilter(periode, undefined, undefined, exerciceAnnee);

    if (exerciceAnnee) {
      const exercice = await prisma.exercice.findUnique({ where: { annee: exerciceAnnee } });
      dateRange = exercice
        ? { gte: exercice.dateDebut, lte: exercice.dateFin }
        : {
            gte: new Date(`${exerciceAnnee}-01-01T00:00:00.000Z`),
            lte: new Date(`${exerciceAnnee}-12-31T23:59:59.999Z`),
          };
    }

    const [clients, fournisseurs] = await Promise.all([
      prisma.facture.findMany({
        where: {
          statutPaiement: { in: ['NON_PAYEE', 'PARTIELLEMENT_PAYEE'] },
          ...(dateRange ? { dateEmission: dateRange } : {}),
        },
        orderBy: { dateEmission: 'desc' },
        take: 100,
        select: {
          id: true, numero: true, clientNom: true, clientEmail: true,
          dateEmission: true, dateEcheance: true, montantTTC: true,
          statutPaiement: true, devise: true,
          paiements: { select: { montant: true } },
          commande: { select: { id: true, numero: true, statut: true } },
          bonLivraison: { select: { id: true, code: true } },
        },
      }),
      prisma.factureFournisseur.findMany({
        where: {
          statutPaiement: { in: ['NON_PAYEE', 'PARTIELLEMENT_PAYEE'] },
          ...(dateRange ? { dateFacture: dateRange } : {}),
        },
        orderBy: { dateFacture: 'desc' },
        take: 100,
        select: {
          id: true, numero: true, fournisseurNom: true, dateFacture: true,
          dateEcheance: true, montantTTC: true, montantPaye: true,
          solde: true, statutPaiement: true, devise: true,
          bonCommande: { select: { id: true, code: true, statut: true } },
          bonReception: { select: { id: true, code: true } },
        },
      }),
    ]);

    res.json({
      recouvrement: {
        clients: clients.map((invoice) => {
          const { paiements, ...facture } = invoice;
          const montantPaye = paiements.reduce((sum, paiement) => sum + Number(paiement.montant), 0);
          return {
            ...facture,
            montantTTC: Number(invoice.montantTTC),
            montantPaye,
            solde: Number(invoice.montantTTC) - montantPaye,
          };
        }),
        fournisseurs: fournisseurs.map((invoice) => ({
          ...invoice,
          montantTTC: Number(invoice.montantTTC),
          montantPaye: Number(invoice.montantPaye),
          solde: Number(invoice.solde),
        })),
      },
    });
  } catch (err) {
    console.error('GET /api/stats/impayes error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement des impayés' });
  }
});

// GET /api/stats/dashboard - Dashboard financier dynamique (admin uniquement)
router.get('/dashboard', requireAuth, async (req: Request, res: Response) => {
  try {
    const devise = (req.query.devise as string) || undefined;
    const periode = (req.query.periode as string) || 'annee';
    const dateDebut = req.query.dateDebut as string | undefined;
    const dateFin = req.query.dateFin as string | undefined;
    const exerciceAnnee = req.query.exerciceAnnee ? Number(req.query.exerciceAnnee) : undefined;

    // Build date range
    let dateRange: { gte?: Date; lte?: Date } | undefined;

    if (exerciceAnnee) {
      const exercice = await prisma.exercice.findUnique({ where: { annee: exerciceAnnee } });
      if (exercice) {
        dateRange = { gte: exercice.dateDebut, lte: exercice.dateFin };
      } else {
        dateRange = {
          gte: new Date(`${exerciceAnnee}-01-01T00:00:00.000Z`),
          lte: new Date(`${exerciceAnnee}-12-31T23:59:59.999Z`),
        };
      }
    } else {
      dateRange = buildDateFilter(periode, dateDebut, dateFin, undefined);
    }

    // Build facture where clause
    const factureWhere: any = {};
    if (devise) factureWhere.devise = devise;
    if (dateRange) factureWhere.dateEmission = dateRange;

    // ─── Factures: aggregate totals ───────────────────────────────────────────
    const [factureAggregate, facturesByStatutPaiement, facturesByStatut, facturesByEtat] = await Promise.all([
      prisma.facture.aggregate({
        where: factureWhere,
        _count: { id: true },
        _sum: { montantTTC: true, montantHT: true, montantTVA: true, timbreFiscal: true, retenueSurce: true },
      }),
      prisma.facture.groupBy({
        by: ['statutPaiement'],
        where: factureWhere,
        _count: { id: true },
        _sum: { montantTTC: true },
      }),
      prisma.facture.groupBy({
        by: ['statut'],
        where: factureWhere,
        _count: { id: true },
        _sum: { montantTTC: true },
      }),
      prisma.facture.groupBy({
        by: ['etat'],
        where: factureWhere,
        _count: { id: true },
        _sum: { montantTTC: true },
      }),
    ]);

    // ─── Paiements: aggregate ─────────────────────────────────────────────────
    const paiementWhere: any = {};
    if (dateRange) paiementWhere.datePaiement = dateRange;
    if (devise) {
      paiementWhere.facture = { devise };
    }

    const [paiementAggregate, paiementsByMode] = await Promise.all([
      prisma.paiement.aggregate({
        where: paiementWhere,
        _count: { id: true },
        _sum: { montant: true },
      }),
      prisma.paiement.groupBy({
        by: ['modePaiement'],
        where: paiementWhere,
        _count: { id: true },
        _sum: { montant: true },
      }),
    ]);

    // ─── Devis: aggregate ─────────────────────────────────────────────────────
    const devisWhere: any = {};
    if (devise) devisWhere.devise = devise;
    if (dateRange) devisWhere.dateDevis = dateRange;

    const [devisAggregate, devisByStatut] = await Promise.all([
      prisma.devis.aggregate({
        where: devisWhere,
        _count: { id: true },
        _sum: { montantTTC: true },
      }),
      prisma.devis.groupBy({
        by: ['statut'],
        where: devisWhere,
        _count: { id: true },
        _sum: { montantTTC: true },
      }),
    ]);

    // ─── Evolution mensuelle (12 derniers mois ou sur la période) ─────────────
    // Get the last 12 months of data using a raw approach via JS aggregation
    const evolutionStart = dateRange?.gte || new Date(new Date().getFullYear(), 0, 1);
    const evolutionEnd = dateRange?.lte || new Date();

    const [facturesEvolution, paiementsEvolution] = await Promise.all([
      prisma.facture.findMany({
        where: { ...factureWhere, dateEmission: { gte: evolutionStart, lte: evolutionEnd } },
        select: { dateEmission: true, montantTTC: true },
        orderBy: { dateEmission: 'asc' },
      }),
      prisma.paiement.findMany({
        where: { ...paiementWhere, datePaiement: { gte: evolutionStart, lte: evolutionEnd } },
        select: { datePaiement: true, montant: true },
        orderBy: { datePaiement: 'asc' },
      }),
    ]);

    // Group by month
    const evolutionMap: Record<string, { montantFactures: number; montantPaiements: number }> = {};

    for (const f of facturesEvolution) {
      const key = f.dateEmission.toISOString().slice(0, 7); // YYYY-MM
      if (!evolutionMap[key]) evolutionMap[key] = { montantFactures: 0, montantPaiements: 0 };
      evolutionMap[key].montantFactures += Number(f.montantTTC);
    }
    for (const p of paiementsEvolution) {
      const key = p.datePaiement.toISOString().slice(0, 7);
      if (!evolutionMap[key]) evolutionMap[key] = { montantFactures: 0, montantPaiements: 0 };
      evolutionMap[key].montantPaiements += Number(p.montant);
    }

    const evolution = Object.entries(evolutionMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mois, data]) => ({ mois, ...data }));

    // ─── Devises disponibles ──────────────────────────────────────────────────
    const devises = await prisma.facture.groupBy({
      by: ['devise'],
      _count: { id: true },
    });

    // ─── 10 dernières factures ────────────────────────────────────────────────
    const recentFactures = await prisma.facture.findMany({
      where: factureWhere,
      take: 10,
      orderBy: { dateEmission: 'desc' },
      select: {
        id: true,
        numero: true,
        clientNom: true,
        dateEmission: true,
        montantTTC: true,
        statut: true,
        statutPaiement: true,
        devise: true,
        etat: true,
      },
    });

    const [achatAggregate, achatsCount, chargesGeneralesAggregate, chargesCnssAggregate, charges9ba4aAggregate, receptionsCount, blCount, produitsStock, mouvementsStock, recentMouvements, facturesImpayees, achatsImpayes] = await Promise.all([
      prisma.factureFournisseur.aggregate({
        where: dateRange ? { dateFacture: dateRange } : undefined,
        _count: { id: true },
        _sum: { montantHT: true, montantTVA: true, montantTTC: true },
      }),
      prisma.factureFournisseur.count({ where: dateRange ? { dateFacture: dateRange } : undefined }),
      prisma.chargeGenerale.aggregate({ where: dateRange ? { date: dateRange } : undefined, _count: { id: true }, _sum: { montantHT: true, montantTTC: true } }),
      prisma.chargeCnss.aggregate({ where: dateRange ? { creeLe: dateRange } : undefined, _count: { id: true }, _sum: { totalCnss: true } }),
      prisma.charge9ba4a.aggregate({ where: dateRange ? { date: dateRange } : undefined, _count: { id: true }, _sum: { montant: true } }),
      prisma.bonReception.count({ where: dateRange ? { dateReception: dateRange } : undefined }),
      prisma.bonLivraison.count({ where: dateRange ? { dateLivraison: dateRange } : undefined }),
      prisma.produit.findMany({ select: { id: true, nom: true, reference: true, stock: true, cump: true, prixAchat: true } }),
      prisma.stockMovement.findMany({
        where: dateRange ? { createdAt: dateRange } : undefined,
        select: { type: true, stockDelta: true, quantity: true, quantityCosted: true, quantityPending: true, unitCost: true, totalCost: true, cump: true },
      }),
      prisma.stockMovement.findMany({
        where: dateRange ? { createdAt: dateRange } : undefined,
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { product: { select: { nom: true, reference: true } } },
      }),
      prisma.facture.findMany({
        where: {
          statutPaiement: { in: ['NON_PAYEE', 'PARTIELLEMENT_PAYEE'] },
          ...(dateRange ? { dateEmission: dateRange } : {}),
        },
        orderBy: { dateEmission: 'desc' },
        take: 100,
        select: {
          id: true, numero: true, clientNom: true, clientEmail: true,
          dateEmission: true, dateEcheance: true, montantTTC: true,
          statutPaiement: true, devise: true,
          paiements: { select: { montant: true } },
          commande: { select: { id: true, numero: true, statut: true } },
          bonLivraison: { select: { id: true, code: true } },
        },
      }),
      prisma.factureFournisseur.findMany({
        where: {
          statutPaiement: { in: ['NON_PAYEE', 'PARTIELLEMENT_PAYEE'] },
          ...(dateRange ? { dateFacture: dateRange } : {}),
        },
        orderBy: { dateFacture: 'desc' },
        take: 100,
        select: {
          id: true, numero: true, fournisseurNom: true, dateFacture: true,
          dateEcheance: true, montantTTC: true, montantPaye: true,
          solde: true, statutPaiement: true, devise: true,
          bonCommande: { select: { id: true, code: true, statut: true } },
          bonReception: { select: { id: true, code: true } },
        },
      }),
    ]);
    const stockTotal = produitsStock.reduce((sum, product) => sum + product.stock, 0);
    const stockValue = produitsStock.reduce((sum, product) => sum + product.stock * Number(product.cump ?? product.prixAchat ?? 0), 0);
    const stockNegatif = produitsStock.filter((product) => product.stock < 0).length;
    const stockRupture = produitsStock.filter((product) => product.stock === 0).length;
    const entrees = mouvementsStock.filter((movement) => movement.stockDelta > 0).reduce((sum, movement) => sum + movement.stockDelta, 0);
    const sorties = mouvementsStock.filter((movement) => movement.stockDelta < 0).reduce((sum, movement) => sum + Math.abs(movement.stockDelta), 0);
    const ajustements = mouvementsStock.filter((movement) => movement.type === 'ADJUSTMENT' || movement.type === 'INVENTORY').reduce((sum, movement) => sum + movement.stockDelta, 0);
    const coutSorties = mouvementsStock.filter((movement) => movement.type === 'SALE').reduce((sum, movement) => sum + Number(movement.totalCost ?? (movement.quantityCosted * Number(movement.unitCost ?? movement.cump ?? 0))), 0);
    const quantitePending = mouvementsStock.reduce((sum, movement) => sum + movement.quantityPending, 0);
    const produitsCritiques = produitsStock.filter((product) => product.stock <= 5).sort((a, b) => a.stock - b.stock).slice(0, 8).map((product) => ({
      ...product,
      cump: Number(product.cump ?? 0),
      valuation: product.stock * Number(product.cump ?? 0),
    }));

    // ─── Format response ──────────────────────────────────────────────────────
    res.json({
      factures: {
        total: factureAggregate._count.id,
        montantTotalHT: Number(factureAggregate._sum.montantHT) || 0,
        montantTotalTVA: Number(factureAggregate._sum.montantTVA) || 0,
        montantTotalTimbre: Number(factureAggregate._sum.timbreFiscal) || 0,
        montantTotalRetenue: Number(factureAggregate._sum.retenueSurce) || 0,
        montantTotalTTC: Number(factureAggregate._sum.montantTTC) || 0,
        parStatutPaiement: Object.fromEntries(
          facturesByStatutPaiement.map(g => [
            g.statutPaiement,
            { count: g._count.id, montant: Number(g._sum.montantTTC) || 0 }
          ])
        ),
        parStatut: Object.fromEntries(
          facturesByStatut.map(g => [
            g.statut,
            { count: g._count.id, montant: Number(g._sum.montantTTC) || 0 }
          ])
        ),
        parEtat: Object.fromEntries(
          facturesByEtat.map(g => [
            g.etat,
            { count: g._count.id, montant: Number(g._sum.montantTTC) || 0 }
          ])
        ),
        recents: recentFactures.map(f => ({
          ...f,
          montantTTC: Number(f.montantTTC),
        })),
      },
      paiements: {
        total: paiementAggregate._count.id,
        montantTotal: Number(paiementAggregate._sum.montant) || 0,
        parMode: Object.fromEntries(
          paiementsByMode.map(g => [
            g.modePaiement,
            { count: g._count.id, montant: Number(g._sum.montant) || 0 }
          ])
        ),
      },
      devis: {
        total: devisAggregate._count.id,
        montantTotal: Number(devisAggregate._sum.montantTTC) || 0,
        parStatut: Object.fromEntries(
          devisByStatut.map(g => [
            g.statut,
            { count: g._count.id, montant: Number(g._sum.montantTTC) || 0 }
          ])
        ),
      },
      evolution,
      devises: devises.map(d => d.devise).filter(Boolean),
      ventes: {
        caHT: Number(factureAggregate._sum.montantHT) || 0,
        caTVA: Number(factureAggregate._sum.montantTVA) || 0,
        caTTC: Number(factureAggregate._sum.montantTTC) || 0,
        factures: factureAggregate._count.id,
        bonsLivraison: blCount,
      },
      achats: {
        totalHT: Number(achatAggregate._sum.montantHT) || 0,
        totalTVA: Number(achatAggregate._sum.montantTVA) || 0,
        totalTTC: Number(achatAggregate._sum.montantTTC) || 0,
        factures: achatsCount,
        receptions: receptionsCount,
      },
      rentabilite: {
        ventesHT: Number(factureAggregate._sum.montantHT) || 0,
        coutAchats: coutSorties,
        marge: (Number(factureAggregate._sum.montantHT) || 0) - coutSorties,
        charges: (Number(chargesGeneralesAggregate._sum.montantHT) || 0) + (Number(chargesCnssAggregate._sum.totalCnss) || 0) + (Number(charges9ba4aAggregate._sum.montant) || 0),
        chargesTTC: (Number(chargesGeneralesAggregate._sum.montantTTC) || 0) + (Number(chargesCnssAggregate._sum.totalCnss) || 0) + (Number(charges9ba4aAggregate._sum.montant) || 0),
        facturesCharges: chargesGeneralesAggregate._count.id + chargesCnssAggregate._count.id + charges9ba4aAggregate._count.id,
        beneficeNet: ((Number(factureAggregate._sum.montantHT) || 0) - coutSorties) - ((Number(chargesGeneralesAggregate._sum.montantHT) || 0) + (Number(chargesCnssAggregate._sum.totalCnss) || 0) + (Number(charges9ba4aAggregate._sum.montant) || 0)),
      },
      recouvrement: {
        clients: facturesImpayees.map((invoice) => {
          const { paiements, ...facture } = invoice;
          const montantPaye = paiements.reduce((sum, paiement) => sum + Number(paiement.montant), 0);
          return {
            ...facture,
            montantTTC: Number(invoice.montantTTC),
            montantPaye,
            solde: Number(invoice.montantTTC) - montantPaye,
          };
        }),
        fournisseurs: achatsImpayes.map((invoice) => ({
          ...invoice,
          montantTTC: Number(invoice.montantTTC),
          montantPaye: Number(invoice.montantPaye),
          solde: Number(invoice.solde),
        })),
      },
      stock: {
        total: stockTotal,
        valeur: stockValue,
        negatifs: stockNegatif,
        ruptures: stockRupture,
        entrees,
        sorties,
        ajustements,
        variation: entrees - sorties,
        coutSorties,
        marge: (Number(factureAggregate._sum.montantHT) || 0) - coutSorties,
        quantitePending,
        produitsCritiques,
        derniersMouvements: recentMouvements,
      },
      filtresAppliques: { devise: devise || null, periode, dateDebut: dateDebut || null, dateFin: dateFin || null, exerciceAnnee: exerciceAnnee || null },
    });
  } catch (err) {
    console.error('GET /api/stats/dashboard error:', err);
    res.status(500).json({ error: 'Erreur lors du calcul des statistiques du tableau de bord' });
  }
});

// GET /api/stats/overview - Métriques générales du tableau de bord (admin uniquement)
router.get('/overview', requireAuth, async (req: Request, res: Response) => {
  try {
    const [
      totalProduits,
      totalCategories,
      totalMarques,
      totalSousCategories,
      produitsDisponibles,
      produitsRupture,
      produitsIndisponibles,
    ] = await Promise.all([
      prisma.produit.count(),
      prisma.categorie.count(),
      prisma.marque.count(),
      prisma.sousCategorie.count(),
      prisma.produit.count({ where: { disponible: true } }),
      prisma.produit.count({ where: { stock: 0 } }),
      prisma.produit.count({ where: { disponible: false } }),
    ]);

    res.json({
      totalProduits,
      totalCategories,
      totalMarques,
      totalSousCategories,
      produitsDisponibles,
      produitsRupture,
      produitsIndisponibles,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/stats/products-recent - 5 derniers produits ajoutés (admin uniquement)
router.get('/products-recent', requireAuth, async (req: Request, res: Response) => {
  try {
    const produits = await prisma.produit.findMany({
      take: 5,
      orderBy: { creeLe: 'desc' },
      include: {
        sousCategorie: { include: { categorie: true } },
        marque: true,
      },
    });
    res.json(produits);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/stats/stock-alert - Produits avec stock faible (<= 5) (admin uniquement)
router.get('/stock-alert', requireAuth, async (req: Request, res: Response) => {
  try {
    const produits = await prisma.produit.findMany({
      where: { stock: { lte: 5 } },
      take: 10,
      orderBy: { stock: 'asc' },
      include: {
        sousCategorie: { include: { categorie: true } },
        marque: true,
      },
    });
    res.json(produits);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/stats/by-category - Répartition des produits par catégorie
router.get('/by-category', async (req: Request, res: Response) => {
  try {
    const categories = await prisma.categorie.findMany({
      include: {
        _count: {
          select: { sousCategories: true, marques: true },
        },
        sousCategories: {
          include: { _count: { select: { produits: true } } },
        },
      },
    });

    const result = categories.map(cat => ({
      id: cat.id,
      nom: cat.nom,
      nbSousCategories: cat._count.sousCategories,
      nbMarques: cat._count.marques,
      nbProduits: cat.sousCategories.reduce((sum, sc) => sum + sc._count.produits, 0),
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
