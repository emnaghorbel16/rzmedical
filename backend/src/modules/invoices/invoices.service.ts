import prisma from '../../config/prisma';
import { recordStockMovement } from '../stock/stock.service';
import { StockMovementType } from '../../../generated/prisma/enums';
import { generateDocumentNumber } from '../exercices/document-numbers.service';

export class InvoiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'InvoiceError';
    this.statusCode = statusCode;
  }
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

// ─── Number generation ────────────────────────────────────────────────────────

export const generateInvoiceNumber = async (exerciceAnnee?: number): Promise<{ numero: string; lastDateEmission: string | null }> => {
  // Kept only for backwards-compatible clients. A number is never reserved
  // before the actual document creation.
  return { numero: 'Attribué automatiquement à l’enregistrement', lastDateEmission: null };
};

export const isInvoiceNumberUnique = async (numero: string): Promise<boolean> => {
  const existing = await prisma.facture.findUnique({ where: { numero }, select: { id: true } });
  return !existing;
};

// ─── Serialization ────────────────────────────────────────────────────────────

const serializeLigne = (l: any) => ({
  ...l,
  quantite: Number(l.quantite),
  prixUnitaireHT: Number(l.prixUnitaireHT),
  tauxTVA: Number(l.tauxTVA),
  totalHT: Number(l.totalHT),
});

const serializePaiement = (p: any) => ({
  ...p,
  montant: Number(p.montant),
});

const serializeFacture = (f: any) => ({
  ...f,
  timbreFiscal: Number(f.timbreFiscal),
  montantHT: Number(f.montantHT),
  montantTVA: Number(f.montantTVA),
  montantTTC: Number(f.montantTTC),
  retenueSurce: Number(f.retenueSurce || 0),
  lignes: Array.isArray(f.lignes) ? f.lignes.map(serializeLigne) : [],
  paiements: Array.isArray(f.paiements) ? f.paiements.map(serializePaiement) : [],
  commande: f.commande ? { ...f.commande, total: Number(f.commande.total) } : undefined,
  bonsLivraison: Array.isArray(f.bonsLivraison)
    ? f.bonsLivraison.map((fbl: any) => fbl.bonLivraison)
    : [],
});

// ─── Queries ─────────────────────────────────────────────────────────────────

const FACTURE_INCLUDE = {
  lignes: true,
  paiements: true,
  commande: {
    include: {
      utilisateur: { select: { id: true, nom: true, prenom: true, email: true } },
    },
  },
  bonLivraison: { select: { id: true, code: true, statut: true } },
  bonsLivraison: {
    include: {
      bonLivraison: { select: { id: true, code: true, statut: true } },
    },
  },
  utilisateur: { select: { id: true, nom: true, prenom: true, email: true } },
};

export const getInvoiceByOrderId = async (orderId: number) => {
  return prisma.facture.findFirst({
    where: { commandeId: orderId },
    include: { lignes: true },
  });
};

export const getMyInvoices = async (userId: number) => {
  const factures = await prisma.facture.findMany({
    where: {
      OR: [
        { commande: { utilisateurId: userId } },
        { utilisateurId: userId },
      ],
    },
    orderBy: { creeLe: 'desc' },
    include: FACTURE_INCLUDE,
  });
  return factures.map(serializeFacture);
};

export const getInvoice = async (id: number) => {
  const facture = await prisma.facture.findUnique({ where: { id }, include: FACTURE_INCLUDE });
  if (!facture) return null;
  return serializeFacture(facture);
};

export const getAllInvoices = async (exerciceAnnee?: number) => {
  let where: any = {};

  if (exerciceAnnee) {
    // Chercher les dates de l'exercice
    const exercice = await prisma.exercice.findUnique({ where: { annee: exerciceAnnee } });
    if (exercice) {
      where.dateEmission = { gte: exercice.dateDebut, lte: exercice.dateFin };
    } else {
      // Fallback : toute l'année
      where.dateEmission = {
        gte: new Date(`${exerciceAnnee}-01-01T00:00:00.000Z`),
        lte: new Date(`${exerciceAnnee}-12-31T23:59:59.999Z`),
      };
    }
  }

  const factures = await prisma.facture.findMany({
    where,
    orderBy: { creeLe: 'desc' },
    include: FACTURE_INCLUDE,
  });
  return factures.map(serializeFacture);
};

// ─── Mutations — Legacy (from order) ─────────────────────────────────────────

export interface LigneFactureInput {
  designation: string;
  quantite: number;
  prixUnitaireHT: number;
  tauxTVA: number;
  totalHT: number;
}

export interface CreateInvoiceInput {
  numero?: string;
  commandeId: number;
  dateEmission: string;
  clientNom: string;
  clientMF?: string;
  clientAdresse?: string;
  clientTelephone?: string;
  clientEmail?: string;
  timbreFiscal: number;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  montantEnLettres?: string;
  fichierPdf?: string;
  lignes: LigneFactureInput[];
}

export const createInvoice = async (data: CreateInvoiceInput) => {
  // Validate: no duplicate per order
  const existingByOrder = await prisma.facture.findFirst({
    where: { commandeId: data.commandeId },
    select: { id: true, numero: true },
  });
  if (existingByOrder) {
    throw new InvoiceError(`Cette commande possède déjà une facture (N° ${existingByOrder.numero})`, 409);
  }
  const commande = await prisma.commande.findUnique({ where: { id: data.commandeId }, select: { id: true } });
  if (!commande) throw new InvoiceError('Commande introuvable', 404);
  if (!Array.isArray(data.lignes) || data.lignes.length === 0) throw new InvoiceError('La facture doit contenir au moins une ligne');

  let computedHT = 0;
  let computedTVA = 0;
  for (const l of data.lignes) {
    if (!l.designation?.trim()) throw new InvoiceError('La désignation de chaque ligne est obligatoire');
    if (l.quantite <= 0) throw new InvoiceError('La quantité doit être supérieure à 0');
    if (l.prixUnitaireHT < 0) throw new InvoiceError('Le prix unitaire HT ne peut pas être négatif');
    computedHT += round3(l.quantite * l.prixUnitaireHT);
    computedTVA += round3(l.quantite * l.prixUnitaireHT * (l.tauxTVA / 100));
  }
  computedHT = round3(computedHT);
  computedTVA = round3(computedTVA);
  const computedTTC = round3(computedHT + computedTVA + data.timbreFiscal);

  const facture = await prisma.$transaction(async (tx) => {
    const numero = await generateDocumentNumber(tx, 'FACTURE_VENTE');
    return tx.facture.create({
    data: {
      numero,
      statut: 'EMISE',
      statutPaiement: 'NON_PAYEE',
      typeFacture: 'PRODUITS',
      commandeId: data.commandeId,
      dateEmission: new Date(data.dateEmission),
      clientNom: data.clientNom,
      clientMF: data.clientMF || null,
      clientAdresse: data.clientAdresse || null,
      clientTelephone: data.clientTelephone || null,
      clientEmail: data.clientEmail || null,
      timbreFiscal: data.timbreFiscal,
      montantHT: computedHT,
      montantTVA: computedTVA,
      montantTTC: computedTTC,
      montantEnLettres: data.montantEnLettres || null,
      fichierPdf: data.fichierPdf || null,
      lignes: { create: data.lignes.map((l) => ({ designation: l.designation.trim(), quantite: l.quantite, prixUnitaireHT: l.prixUnitaireHT, tauxTVA: l.tauxTVA, totalHT: round3(l.quantite * l.prixUnitaireHT) })) },
    },
    include: { lignes: true, paiements: true },
    });
  });
  return serializeFacture(facture);
};

// ─── Manual invoice (direct from products or service) ─────────────────────────

export interface LigneManualFactureInput {
  produitId?: number;
  designation: string;
  quantite: number;
  quantiteAv?: number;
  prixUnitaireHT: number;
  remise?: number;
  tauxTVA: number;
}

export interface CreateManualInvoiceInput {
  commandeId?: number;
  utilisateurId?: number;
  // Passenger client fields
  clientNom: string;
  clientMF?: string;
  clientAdresse?: string;
  clientTelephone?: string;
  clientEmail?: string;
  dateEmission: string;
  dateEcheance?: string;
  dateEstimationPaiement?: string;
  timbreFiscal: number;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  retenueSurce?: number;
  montantEnLettres?: string;
  fichierPdf?: string;
  typeFacture?: 'PRODUITS' | 'SERVICE';
  etat?: 'NORMALE' | 'PROFORMA' | 'AVOIR';
  statut?: 'BROUILLON' | 'VALIDEE' | 'ENVOYEE' | 'ANNULEE';
  devise?: string;
  commentaire?: string;
  projet?: string;
  incoterm?: string;
  origineDesProuits?: string;
  lignes: LigneManualFactureInput[];
  // Whether to create a Commande record and deduct stock
  createCommande?: boolean;
}

export const createManualInvoice = async (data: CreateManualInvoiceInput) => {
  if (!Array.isArray(data.lignes) || data.lignes.length === 0) {
    throw new InvoiceError('La facture doit contenir au moins une ligne');
  }

  if (data.commandeId) {
    const commande = await prisma.commande.findUnique({
      where: { id: Number(data.commandeId) },
      select: { id: true, utilisateurId: true, factures: { select: { id: true, numero: true } } },
    });
    if (!commande) throw new InvoiceError('Commande introuvable', 404);
    if (commande.factures.length > 0) {
      throw new InvoiceError(`Cette commande possède déjà une facture (N° ${commande.factures[0].numero})`, 409);
    }
  }

  let computedHT = 0;
  let computedTVA = 0;
  for (const l of data.lignes) {
    if (!l.designation?.trim()) throw new InvoiceError('La désignation de chaque ligne est obligatoire');
    if (l.quantite <= 0) throw new InvoiceError('La quantité doit être supérieure à 0');
    const remise = Number(l.remise) || 0;
    const prixApresRemise = round3(Number(l.prixUnitaireHT) * (1 - remise / 100));
    computedHT += round3(l.quantite * prixApresRemise);
    computedTVA += round3(l.quantite * prixApresRemise * (l.tauxTVA / 100));
  }
  computedHT = round3(computedHT);
  computedTVA = round3(computedTVA);
  const computedTTC = round3(computedHT + computedTVA + data.timbreFiscal);

  return prisma.$transaction(async (tx) => {
    let commandeId: number | null = null;

    if (data.createCommande && data.utilisateurId) {
      const orderLines = [];
      for (const l of data.lignes) {
        if (l.produitId) {
          const prixUnitaireTTC = round3(l.prixUnitaireHT * (1 + l.tauxTVA / 100));
          orderLines.push({ produitId: l.produitId, quantite: Math.round(l.quantite), prixUnitaire: prixUnitaireTTC });
        }
      }
      if (orderLines.length > 0) {
        const numeroCommande = await generateDocumentNumber(tx, 'COMMANDE');
        const commande = await tx.commande.create({
          data: { numero: numeroCommande, utilisateurId: data.utilisateurId, statut: 'LIVREE', total: computedTTC, lignes: { create: orderLines } },
        });
        commandeId = commande.id;
      }
    }

    const numero = await generateDocumentNumber(tx, data.etat === 'AVOIR' ? 'AVOIR_VENTE' : 'FACTURE_VENTE');
    const facture = await tx.facture.create({
      data: {
        numero,
        statut: 'VALIDEE',
        statutPaiement: 'NON_PAYEE',
        typeFacture: data.typeFacture || 'PRODUITS',
        etat: (data.etat as any) || 'NORMALE',
        commandeId: data.commandeId ? Number(data.commandeId) : commandeId,
        utilisateurId: data.utilisateurId || null,
        dateEmission: new Date(data.dateEmission),
        dateEcheance: data.dateEcheance ? new Date(data.dateEcheance) : null,
        dateEstimationPaiement: data.dateEstimationPaiement ? new Date(data.dateEstimationPaiement) : null,
        clientNom: data.clientNom,
        clientMF: data.clientMF || null,
        clientAdresse: data.clientAdresse || null,
        clientTelephone: data.clientTelephone || null,
        clientEmail: data.clientEmail || null,
        timbreFiscal: data.timbreFiscal,
        montantHT: computedHT,
        montantTVA: computedTVA,
        montantTTC: computedTTC,
        retenueSurce: data.retenueSurce || 0,
        montantEnLettres: data.montantEnLettres || null,
        devise: data.devise || 'TND',
        commentaire: data.commentaire || null,
        projet: data.projet || null,
        incoterm: data.incoterm || null,
        origineDesProuits: data.origineDesProuits || null,
        fichierPdf: data.fichierPdf || null,
        lignes: {
          create: data.lignes.map((l) => {
            const remise = Number(l.remise) || 0;
            const prixApresRemise = round3(Number(l.prixUnitaireHT) * (1 - remise / 100));
            return {
              designation: l.designation.trim(),
              quantite: l.quantite,
              prixUnitaireHT: prixApresRemise,
              tauxTVA: l.tauxTVA,
              totalHT: round3(l.quantite * prixApresRemise),
            };
          }),
        },
      },
      include: { lignes: true, paiements: true, bonsLivraison: { include: { bonLivraison: true } }, commande: { include: { utilisateur: { select: { id: true, nom: true, prenom: true, email: true } } } } },
    });

    return serializeFacture(facture);
  });
};

// ─── Create Invoice from Manual Lines (auto-BL) ───────────────────────────────
// Flux: Produit/Service → BL (LIVRE) → Facture (BON_LIVRAISON)

export interface CreateManualWithBLInput extends CreateManualInvoiceInput {
  blCode?: string; // optionnel — généré si absent
  commercialId?: number;
  bonSortieId?: number;
}

export const createManualWithBL = async (data: CreateManualWithBLInput) => {
  if (!Array.isArray(data.lignes) || data.lignes.length === 0) {
    throw new InvoiceError('La facture doit contenir au moins une ligne');
  }
  const existingBL = data.commandeId
    ? await prisma.bonLivraison.findFirst({
        where: {
          commandeId: Number(data.commandeId),
          statut: { not: 'ANNULE' },
          factures: { none: {} },
        },
        include: { lignes: true },
      })
    : null;

  // Compute totals
  let computedHT = 0;
  let computedTVA = 0;
  const lignesPrep = data.lignes.map((l) => {
    const remise = Number(l.remise) || 0;
    const puApres = round3(Number(l.prixUnitaireHT) * (1 - remise / 100));
    const lineHT = round3(Number(l.quantite) * puApres);
    const lineTVA = round3(lineHT * (Number(l.tauxTVA) / 100));
    computedHT += lineHT;
    computedTVA += lineTVA;
    return { puApres, lineHT, lineTVA, ...l };
  });
  computedHT = round3(computedHT);
  computedTVA = round3(computedTVA);
  const computedTTC = round3(computedHT + computedTVA + data.timbreFiscal);

  return prisma.$transaction(async (tx) => {
    const blCode = await generateDocumentNumber(tx, 'BON_LIVRAISON');
    // 1. Créer le BL (statut LIVRE = déjà livré physiquement)
    const bl = existingBL ?? await tx.bonLivraison.create({
      data: {
        code: blCode,
        commandeId: data.commandeId ? Number(data.commandeId) : null,
        utilisateurId: data.utilisateurId || null,
        clientNom: data.clientNom,
        clientMF: data.clientMF || null,
        clientAdresse: data.clientAdresse || null,
        clientTel: data.clientTelephone || null,
        clientEmail: data.clientEmail || null,
        commercialId: data.commercialId ? Number(data.commercialId) : null,
        bonSortieId: data.bonSortieId ? Number(data.bonSortieId) : null,
        statut: 'LIVRE',
        stockMisAJour: true,
        lignes: {
          create: lignesPrep.map((l) => ({
            produitId: l.produitId ? Number(l.produitId) : null,
            designation: l.designation.trim(),
            quantiteCmd: Math.ceil(Number(l.quantite)),
            quantiteLivree: Math.ceil(Number(l.quantite)),
            prixUnitaireHT: l.puApres,
            tauxTVA: Number(l.tauxTVA),
          })),
        },
      },
      select: { id: true, code: true },
    });

    if (existingBL) {
      await tx.bonLivraison.update({ where: { id: bl.id }, data: { statut: 'LIVRE', stockMisAJour: true } });
    }
    if (!existingBL || !existingBL.stockMisAJour) {
      const stockLines = existingBL?.lignes ?? lignesPrep;
      for (const [lineIndex, ligne] of stockLines.entries()) {
        if (ligne.produitId) {
          const quantiteALivrer = Math.ceil(Number('quantiteLivree' in ligne ? ligne.quantiteLivree : ligne.quantite));
          
          if (data.commercialId) {
            // 1. Décrémenter le stock de la voiture du commercial
            const stock = await tx.stockCommercial.findUnique({
              where: { commercialId_produitId: { commercialId: data.commercialId, produitId: Number(ligne.produitId) } }
            });
            if (!stock || stock.quantite < quantiteALivrer) {
              throw new InvoiceError(`Le commercial ne dispose pas d'assez de stock pour le produit ID ${ligne.produitId}`);
            }
            await tx.stockCommercial.update({
              where: { id: stock.id },
              data: { quantite: { decrement: quantiteALivrer } }
            });
            // 2. Enregistrer le mouvement de vente pour mettre à jour la qté vendue
            await recordStockMovement(tx, {
              productId: Number(ligne.produitId),
              quantity: quantiteALivrer,
              type: StockMovementType.SALE,
              unitPrice: Number(ligne.prixUnitaireHT),
              nature: 'SORTIE',
              documentType: 'FACTURE',
              reference: bl.code,
              sourceType: 'BON_LIVRAISON',
              sourceId: bl.id,
              sourceLineId: 'id' in ligne ? ligne.id : lineIndex,
            });
          } else {
            await recordStockMovement(tx, {
              productId: Number(ligne.produitId),
              quantity: quantiteALivrer,
              type: StockMovementType.SALE,
              unitPrice: Number(ligne.prixUnitaireHT),
              nature: 'SORTIE',
              documentType: 'FACTURE',
              reference: bl.code,
              sourceType: 'BON_LIVRAISON',
              sourceId: bl.id,
              sourceLineId: 'id' in ligne ? ligne.id : lineIndex,
            });
          }
        }
      }
    }

    // La facture est créée séparément depuis l'étape 2 (champ BL).
    // Le BL doit rester LIVRE et non facturé jusqu'à cette action explicite.
    return {
      id: bl.id,
      code: bl.code,
      statut: 'LIVRE',
      utilisateurId: data.utilisateurId || null,
      lignes: lignesPrep.map((l) => ({
        designation: l.designation.trim(),
        quantiteLivree: Math.ceil(Number(l.quantite)),
        prixUnitaireHT: l.puApres,
        tauxTVA: Number(l.tauxTVA),
      })),
    };
  });
};

// ─── Create Invoice from Multiple BLs ────────────────────────────────────────

export interface CreateFromMultipleBLsInput {
  utilisateurId?: number;
  bonLivraisonIds: number[];
  dateEmission: string;
  dateEcheance?: string;
  clientMF?: string;
  timbreFiscal: number;
  etat?: 'NORMALE' | 'PROFORMA' | 'AVOIR';
  statut?: 'BROUILLON' | 'VALIDEE' | 'ENVOYEE' | 'ANNULEE';
  statutPaiement?: 'NON_PAYEE' | 'PARTIELLEMENT_PAYEE' | 'PAYEE';
  montantPaye?: number;
  modePaiement?: string;
  devise?: string;
  commentaire?: string;
  projet?: string;
  incoterm?: string;
  origineDesProuits?: string;
}

export const createFromMultipleBLs = async (data: CreateFromMultipleBLsInput) => {
  if (!Array.isArray(data.bonLivraisonIds) || data.bonLivraisonIds.length === 0) {
    throw new InvoiceError('Sélectionnez au moins un bon de livraison');
  }

  // Load all BLs
  const bls = await prisma.bonLivraison.findMany({
    where: { id: { in: data.bonLivraisonIds } },
    include: {
      lignes: true,
      utilisateur: true,
      facturesJonction: { select: { factureId: true } },
    },
  });

  if (bls.length !== data.bonLivraisonIds.length) {
    throw new InvoiceError('Un ou plusieurs bons de livraison sont introuvables', 404);
  }

  // Check none already linked to a facture via jonction
  for (const bl of bls) {
    if (bl.facturesJonction.length > 0) {
      throw new InvoiceError(`Le bon ${bl.code} est déjà lié à une facture`, 409);
    }
  }

  // Merge lines from all BLs
  let computedHT = 0;
  let computedTVA = 0;
  const allLignes: any[] = [];

  for (const bl of bls) {
    if (bl.lignes.length === 0) {
      throw new InvoiceError(`Le bon ${bl.code} ne contient aucune ligne`);
    }
    for (const l of bl.lignes) {
      const qty = l.quantiteLivree;
      const pu = Number(l.prixUnitaireHT);
      const tva = Number(l.tauxTVA);
      const lineHT = round3(qty * pu);
      const lineTVA = round3(lineHT * (tva / 100));
      computedHT += lineHT;
      computedTVA += lineTVA;
      allLignes.push({ designation: l.designation, quantite: qty, prixUnitaireHT: pu, tauxTVA: tva, totalHT: lineHT });
    }
  }

  computedHT = round3(computedHT);
  computedTVA = round3(computedTVA);
  const computedTTC = round3(computedHT + computedTVA + data.timbreFiscal);

  // Use first BL's client info
  const firstBL = bls[0];
  const clientNom = firstBL.clientNom || (firstBL.utilisateur ? `${firstBL.utilisateur.nom || ''} ${firstBL.utilisateur.prenom || ''}`.trim() : 'Client');
  const utilisateurId = data.utilisateurId || firstBL.utilisateurId || null;

  return prisma.$transaction(async (tx) => {
    const numero = await generateDocumentNumber(tx, data.etat === 'AVOIR' ? 'AVOIR_VENTE' : 'FACTURE_VENTE');
    const requestedStatut = data.statutPaiement || 'NON_PAYEE';
    let initialMontant = 0;
    if (requestedStatut === 'PAYEE') {
      initialMontant = computedTTC;
    } else if (requestedStatut === 'PARTIELLEMENT_PAYEE') {
      initialMontant = Number(data.montantPaye) || 0;
    }

    const facture = await tx.facture.create({
      data: {
        numero,
        statut: (data.statut as any) || 'BROUILLON',
        statutPaiement: requestedStatut,
        typeFacture: 'FACTURE',
        etat: (data.etat as any) || 'NORMALE',
        utilisateurId,
        commandeId: firstBL.commandeId || null,
        bonLivraisonId: firstBL.id,
        dateEmission: new Date(data.dateEmission),
        dateEcheance: data.dateEcheance ? new Date(data.dateEcheance) : null,
        clientNom,
        clientMF: data.clientMF || firstBL.clientMF || firstBL.utilisateur?.matriculeFiscale || null,
        clientAdresse: firstBL.clientAdresse || firstBL.utilisateur?.adresse || null,
        clientTelephone: firstBL.clientTel || firstBL.utilisateur?.telephone || null,
        clientEmail: firstBL.clientEmail || firstBL.utilisateur?.email || null,
        timbreFiscal: data.timbreFiscal,
        montantHT: computedHT,
        montantTVA: computedTVA,
        montantTTC: computedTTC,
        devise: data.devise || 'TND',
        commentaire: data.commentaire || null,
        projet: data.projet || null,
        incoterm: data.incoterm || null,
        origineDesProuits: data.origineDesProuits || null,
        lignes: { create: allLignes },
        // Link via junction table
        bonsLivraison: {
          create: data.bonLivraisonIds.map((blId) => ({ bonLivraisonId: blId })),
        },
      },
      include: { lignes: true, paiements: true, bonsLivraison: { include: { bonLivraison: true } } },
    });

    if (initialMontant > 0) {
      await tx.paiement.create({
        data: {
          factureId: facture.id,
          montant: initialMontant,
          modePaiement: data.modePaiement || 'Espèces',
          datePaiement: new Date(data.dateEmission),
          commentaire: 'Paiement initial à la création de la facture',
        },
      });
    }

    // Mark all BLs as FACTURE
    await tx.bonLivraison.updateMany({
      where: { id: { in: data.bonLivraisonIds } },
      data: { statut: 'FACTURE' },
    });

    const refreshed = await tx.facture.findUnique({
      where: { id: facture.id },
      include: { lignes: true, paiements: true, bonsLivraison: { include: { bonLivraison: true } } },
    });

    return serializeFacture(refreshed || facture);
  });
};

// ─── Update PDF ────────────────────────────────────────────────────────────────

export const updateInvoicePdf = async (id: number, fichierPdf: string) => {
  const facture = await prisma.facture.findUnique({ where: { id }, select: { id: true } });
  if (!facture) throw new InvoiceError('Facture introuvable', 404);
  const updated = await prisma.facture.update({ where: { id }, data: { fichierPdf } });
  return serializeFacture(updated);
};

// ─── Update Statut Facture ────────────────────────────────────────────────────

export const updateInvoiceStatut = async (id: number, statut: string) => {
  const facture = await prisma.facture.findUnique({
    where: { id },
    include: { bonsLivraison: true },
  });
  if (!facture) throw new InvoiceError('Facture introuvable', 404);

  const updated = await prisma.$transaction(async (tx) => {
    let numeroAvoir: string | undefined;
    if (statut === 'ANNULEE') {
      numeroAvoir = facture.numeroAvoir || undefined;
      if (!numeroAvoir) numeroAvoir = await generateDocumentNumber(tx, 'AVOIR_VENTE');

      const blIds = facture.bonsLivraison.map((b) => b.bonLivraisonId);
      if (facture.bonLivraisonId) blIds.push(facture.bonLivraisonId);
      if (blIds.length > 0) {
        await tx.bonLivraison.updateMany({
          where: { id: { in: Array.from(new Set(blIds)) } },
          data: { statut: 'LIVRE' },
        });
      }
    }

    return tx.facture.update({
      where: { id },
      data: {
        statut: statut as any,
        ...(statut === 'ANNULEE' ? { numeroAvoir } : {}),
      },
      include: { lignes: true, paiements: true, bonsLivraison: { include: { bonLivraison: true } } },
    });
  });

  return serializeFacture(updated);
};

// ─── Paiements ────────────────────────────────────────────────────────────────

export const addPaiement = async (
  factureId: number,
  data: {
    montant: number;
    modePaiement?: string;
    datePaiement?: string;
    reference?: string;
    referenceTransaction?: string;
    commentaire?: string;
  }
) => {
  const facture = await prisma.facture.findUnique({
    where: { id: factureId },
    select: { id: true, montantTTC: true, retenueSurce: true, paiements: { select: { montant: true } } },
  });
  if (!facture) throw new InvoiceError('Facture introuvable', 404);

  const montant = Number(data.montant);
  if (isNaN(montant) || montant <= 0) throw new InvoiceError('Le montant doit être supérieur à 0');

  const totalPaye = facture.paiements.reduce((s, p) => s + Number(p.montant), 0);
  const montantTTC = Number(facture.montantTTC);
  const retenueSurce = Number(facture.retenueSurce || 0);
  const netAPayer = Math.max(0, montantTTC - retenueSurce);

  let datePaiement = new Date();
  if (data.datePaiement) {
    const parsedDate = new Date(data.datePaiement);
    if (!isNaN(parsedDate.getTime())) {
      datePaiement = parsedDate;
    }
  }

  const ref = data.reference || data.referenceTransaction || null;

  const paiement = await prisma.paiement.create({
    data: {
      factureId,
      montant: round3(montant),
      modePaiement: data.modePaiement || 'Espèces',
      datePaiement,
      reference: ref,
      commentaire: data.commentaire || null,
    },
  });

  const newTotalPaye = round3(totalPaye + montant);
  let statutPaiement: 'NON_PAYEE' | 'PARTIELLEMENT_PAYEE' | 'PAYEE';
  if (newTotalPaye <= 0) statutPaiement = 'NON_PAYEE';
  else if (newTotalPaye >= netAPayer - 0.001) statutPaiement = 'PAYEE';
  else statutPaiement = 'PARTIELLEMENT_PAYEE';

  await prisma.facture.update({ where: { id: factureId }, data: { statutPaiement } });

  return {
    paiement: {
      ...paiement,
      montant: Number(paiement.montant),
      referenceTransaction: paiement.reference,
    },
    statutPaiement,
    totalPaye: newTotalPaye,
    resteAPayer: Math.max(0, netAPayer - newTotalPaye),
  };
};

export const getPaiements = async (factureId: number) => {
  const paiements = await prisma.paiement.findMany({
    where: { factureId },
    orderBy: { datePaiement: 'desc' },
  });
  return paiements.map((p) => ({
    ...p,
    montant: Number(p.montant),
    referenceTransaction: p.reference,
  }));
};

export const updateInvoice = async (
  id: number,
  data: {
    clientNom?: string;
    clientMF?: string;
    clientAdresse?: string;
    clientTelephone?: string;
    clientEmail?: string;
    dateEmission?: string;
    dateEcheance?: string;
    statut?: string;
    timbreFiscal?: number;
    retenueSurce?: number;
    commentaire?: string;
    lignes?: Array<{
      id?: number;
      designation: string;
      quantite: number;
      prixUnitaireHT: number;
      tauxTVA: number;
      totalHT?: number;
    }>;
  }
) => {
  const existing = await prisma.facture.findUnique({
    where: { id },
    include: { lignes: true, paiements: true },
  });
  if (!existing) throw new InvoiceError('Facture introuvable', 404);

  return prisma.$transaction(async (tx) => {
    let montantHT = Number(existing.montantHT);
    let montantTVA = Number(existing.montantTVA);
    const timbreFiscal = data.timbreFiscal !== undefined ? Number(data.timbreFiscal) : Number(existing.timbreFiscal);
    let montantTTC = Number(existing.montantTTC);

    if (data.lignes && Array.isArray(data.lignes)) {
      montantHT = 0;
      montantTVA = 0;
      for (const l of data.lignes) {
        const qte = Number(l.quantite) || 0;
        const pu = Number(l.prixUnitaireHT) || 0;
        const tva = Number(l.tauxTVA) || 0;
        const lineHT = round3(qte * pu);
        const lineTVA = round3(lineHT * (tva / 100));
        montantHT = round3(montantHT + lineHT);
        montantTVA = round3(montantTVA + lineTVA);
      }
      montantTTC = round3(montantHT + montantTVA + timbreFiscal);

      // Recreate lines
      await tx.ligneFacture.deleteMany({ where: { factureId: id } });
      await tx.ligneFacture.createMany({
        data: data.lignes.map((l) => ({
          factureId: id,
          designation: l.designation,
          quantite: Number(l.quantite),
          prixUnitaireHT: Number(l.prixUnitaireHT),
          tauxTVA: Number(l.tauxTVA),
          totalHT: round3(Number(l.quantite) * Number(l.prixUnitaireHT)),
        })),
      });
    } else if (data.timbreFiscal !== undefined) {
      montantTTC = round3(montantHT + montantTVA + timbreFiscal);
    }

    const updateData: any = {
      montantHT,
      montantTVA,
      montantTTC,
      timbreFiscal,
      misAJourLe: new Date(),
    };

    if (data.clientNom !== undefined) updateData.clientNom = data.clientNom;
    if (data.clientMF !== undefined) updateData.clientMF = data.clientMF;
    if (data.clientAdresse !== undefined) updateData.clientAdresse = data.clientAdresse;
    if (data.clientTelephone !== undefined) updateData.clientTelephone = data.clientTelephone;
    if (data.clientEmail !== undefined) updateData.clientEmail = data.clientEmail;
    if (data.dateEmission) updateData.dateEmission = new Date(data.dateEmission);
    if (data.dateEcheance) updateData.dateEcheance = new Date(data.dateEcheance);
    if (data.statut) updateData.statut = data.statut;
    if (data.retenueSurce !== undefined) updateData.retenueSurce = Number(data.retenueSurce);
    if (data.commentaire !== undefined) updateData.commentaire = data.commentaire;

    // Recalculate payment status
    const totalPaye = existing.paiements.reduce((s, p) => s + Number(p.montant), 0);
    const netAPayer = Math.max(0, montantTTC - Number(updateData.retenueSurce !== undefined ? updateData.retenueSurce : existing.retenueSurce || 0));
    let statutPaiement: 'NON_PAYEE' | 'PARTIELLEMENT_PAYEE' | 'PAYEE' = existing.statutPaiement as any;
    if (totalPaye <= 0) statutPaiement = 'NON_PAYEE';
    else if (totalPaye >= netAPayer - 0.001) statutPaiement = 'PAYEE';
    else statutPaiement = 'PARTIELLEMENT_PAYEE';
    updateData.statutPaiement = statutPaiement;

    const updated = await tx.facture.update({
      where: { id },
      data: updateData,
      include: FACTURE_INCLUDE,
    });

    return serializeFacture(updated);
  });
};
