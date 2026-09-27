import nodemailer from 'nodemailer';
import prisma from '../../config/prisma';
import { generateDocumentNumber } from '../exercices/document-numbers.service';

// Erreur métier avec code HTTP (mappée par le contrôleur)
export class OrderError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'OrderError';
    this.statusCode = statusCode;
  }
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export interface LigneInput {
  produitId: number;
  quantite: number;
}

// Détail renvoyé pour chaque commande (produit léger pour l'affichage)
const orderInclude = {
  lignes: {
    include: {
      produit: {
        select: { id: true, nom: true, reference: true, images: true, prix: true, prixAchat: true, stock: true, qteAchat: true, qteVente: true, disponibleALaVente: true, tva: true, remise: true },
      },
    },
  },
  factures: {
    select: { id: true, numero: true, fichierPdf: true, statut: true, statutPaiement: true },
  },
  bonsLivraison: {
    select: { id: true, code: true, statut: true },
  },
} as const;

async function sendNewOrderEmail(commande: any, client: any) {
  try {
    const info = await prisma.infoSociete.findUnique({ where: { id: 1 } });
    if (!info?.email) return; // Pas d'email configuré

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: { rejectUnauthorized: false },
    });

    const itemsHtml = commande.lignes.map((l: any) => 
      `<li>${l.quantite}x ${l.produit?.nom || 'Produit'} - ${l.prixUnitaire} TND</li>`
    ).join('');

    const html = `
      <h2>Nouvelle commande reçue</h2>
      <p><strong>Numéro :</strong> ${commande.numero}</p>
      <p><strong>Client :</strong> ${client.nom} ${client.prenom} (${client.email})</p>
      <p><strong>Total :</strong> ${commande.total} TND</p>
      <p><strong>Détails :</strong></p>
      <ul>${itemsHtml}</ul>
      <br />
      <p><a href="https://admin.randzmedical.com/orders">Voir dans l'administration</a></p>
    `;

    await transporter.sendMail({
      from: `"RZMedical System" <${process.env.EMAIL_USER}>`,
      to: info.email,
      subject: `Nouvelle commande: ${commande.numero}`,
      html,
    });
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email de nouvelle commande:", error);
  }
}

export const createOrder = async (userId: number, lignes: LigneInput[]) => {
  if (!Array.isArray(lignes) || lignes.length === 0) {
    throw new OrderError('Le panier est vide');
  }

  // Consolide les quantités par produit et valide les entrées
  const quantities = new Map<number, number>();
  for (const l of lignes) {
    const produitId = Number(l?.produitId);
    const quantite = Number(l?.quantite);
    if (!Number.isInteger(produitId) || produitId <= 0) {
      throw new OrderError('Produit invalide dans le panier');
    }
    if (!Number.isInteger(quantite) || quantite <= 0) {
      throw new OrderError('Quantité invalide dans le panier');
    }
    quantities.set(produitId, (quantities.get(produitId) || 0) + quantite);
  }

  // Transaction : tout est validé, recalculé et décrémenté de façon atomique
  const result = await prisma.$transaction(async (tx) => {
    const client = await tx.utilisateur.findUnique({ where: { id: userId } });
    if (!client) {
      throw new OrderError('Utilisateur non trouvé', 404);
    }
    const clientRemise = Number(client.remise) || 0;

    const produitIds = [...quantities.keys()];
    const produits = await tx.produit.findMany({ where: { id: { in: produitIds } } });
    const byId = new Map(produits.map((p) => [p.id, p]));

    const lignesData: { produitId: number; quantite: number; prixUnitaire: number }[] = [];
    let total = 0;

    for (const [produitId, quantite] of quantities) {
      const produit = byId.get(produitId);
      if (!produit) {
        throw new OrderError(`Produit introuvable (id ${produitId})`, 404);
      }
      if (!produit.disponibleALaVente) {
        throw new OrderError(`Le produit « ${produit.nom} » n'est plus disponible`);
      }
      // Le client bénéficie de la remise la plus avantageuse entre la sienne et celle du produit
      const produitRemise = Number(produit.remise) || 0;
      const maxRemise = Math.max(produitRemise, clientRemise);
      const prixUnitaire = round2(Number(produit.prix) * (1 - maxRemise / 100));
      total += prixUnitaire * quantite;

      lignesData.push({ produitId, quantite, prixUnitaire });
    }

    total = round2(total);

    const numero = await generateDocumentNumber(tx, 'COMMANDE');
    const commande = await tx.commande.create({
      data: {
        numero,
        utilisateurId: userId,
        statut: 'EN_ATTENTE',
        total,
        lignes: { create: lignesData },
      },
      include: orderInclude,
    });

    return commande;
  });

  // Envoyer l'email de notification en arrière-plan
  if (result) {
    prisma.utilisateur.findUnique({ where: { id: userId } }).then(client => {
      if (client) sendNewOrderEmail(result, client);
    });
  }

  return result;
};

export const getMyOrders = (userId: number) =>
  prisma.commande.findMany({
    where: { utilisateurId: userId },
    orderBy: { creeLe: 'desc' },
    include: orderInclude,
  });

export const getOrder = (userId: number, orderId: number) =>
  prisma.commande.findFirst({
    where: { id: orderId, utilisateurId: userId },
    include: orderInclude,
  });

export const getOrderById = (orderId: number) =>
  prisma.commande.findUnique({
    where: { id: orderId },
    include: {
      ...orderInclude,
      utilisateur: { select: { id: true, nom: true, prenom: true, email: true, telephone: true, adresse: true, matriculeFiscale: true } }
    },
  });

// --- Admin methods ---

export const getAllOrders = (status?: string) => {
  return prisma.commande.findMany({
    where: status ? { statut: status as any } : undefined,
    orderBy: { creeLe: 'desc' },
    include: {
      ...orderInclude,
      utilisateur: { select: { id: true, nom: true, prenom: true, email: true, telephone: true, adresse: true, matriculeFiscale: true } }
    },
  });
};

export const updateOrderStatus = async (orderId: number, status: string) => {
  const commande = await prisma.commande.findUnique({ where: { id: orderId } });
  if (!commande) {
    throw new OrderError('Commande introuvable', 404);
  }

  return prisma.commande.update({
    where: { id: orderId },
    data: { statut: status as any },
    include: {
      ...orderInclude,
      utilisateur: { select: { id: true, nom: true, prenom: true, email: true, telephone: true, adresse: true, matriculeFiscale: true } }
    },
  });
};

export const updateOrderItems = async (orderId: number, nouvellesLignes: LigneInput[]) => {
  if (!Array.isArray(nouvellesLignes) || nouvellesLignes.length === 0) {
    throw new OrderError('La commande ne peut pas être vide');
  }

  // 1. Consolide les nouvelles quantités par produit
  const quantities = new Map<number, number>();
  for (const l of nouvellesLignes) {
    const produitId = Number(l?.produitId);
    const quantite = Number(l?.quantite);
    if (!Number.isInteger(produitId) || produitId <= 0) {
      throw new OrderError('Produit invalide dans les nouvelles lignes');
    }
    if (!Number.isInteger(quantite) || quantite <= 0) {
      throw new OrderError('Quantité invalide dans les nouvelles lignes');
    }
    quantities.set(produitId, (quantities.get(produitId) || 0) + quantite);
  }

  return prisma.$transaction(async (tx) => {
    // 2. Récupère la commande existante
    const commande = await tx.commande.findUnique({
      where: { id: orderId },
      include: { lignes: true, utilisateur: true },
    });

    if (!commande) {
      throw new OrderError('Commande introuvable', 404);
    }
    if (commande.statut === 'ANNULEE') {
      throw new OrderError('Impossible de modifier une commande annulée');
    }
    
    // On permet quand même de modifier une commande Payée ou Livrée si besoin,
    // mais on pourrait l'interdire ici :
    // if (['PAYEE', 'LIVREE'].includes(commande.statut)) {
    //   throw new OrderError('Impossible de modifier une commande déjà payée ou livrée');
    // }

    // 3. Restitue le stock des anciennes lignes
    for (const ligne of commande.lignes) {
      await tx.produit.update({
        where: { id: ligne.produitId },
        data: { stock: { increment: ligne.quantite } },
      });
    }

    // 4. Récupère les informations des nouveaux produits (pour stock et prix)
    const clientRemise = Number(commande.utilisateur.remise) || 0;
    const produitIds = [...quantities.keys()];
    const produits = await tx.produit.findMany({ where: { id: { in: produitIds } } });
    const byId = new Map(produits.map((p) => [p.id, p]));

    const lignesData: { produitId: number; quantite: number; prixUnitaire: number }[] = [];
    let nouveauTotal = 0;

    // 5. Prépare les nouvelles lignes et vérifie les stocks mis à jour
    for (const [produitId, quantite] of quantities) {
      const produit = byId.get(produitId);
      if (!produit) {
        throw new OrderError(`Produit introuvable (id ${produitId})`, 404);
      }
      if (!produit.disponibleALaVente) {
        throw new OrderError(`Le produit « ${produit.nom} » n'est plus disponible`);
      }
      
      // Attention, le stock disponible est maintenant l'ancien stock de base (celui récupéré dans produits)
      // PLUS l'incrément fait plus haut dans la transaction (qui n'est pas vu par findMany car il n'est pas lu après l'update si findMany a été fait avant, 
      // oh attendez: tx.produit.findMany VERRRA les modifs du tx.produit.update s'il est fait APRÈS, c'est le cas ici !).
      // Prix unitaire (remise max)
      const produitRemise = Number(produit.remise) || 0;
      const maxRemise = Math.max(produitRemise, clientRemise);
      const prixUnitaire = round2(Number(produit.prix) * (1 - maxRemise / 100));
      nouveauTotal += prixUnitaire * quantite;

      lignesData.push({ produitId, quantite, prixUnitaire });
    }

    nouveauTotal = round2(nouveauTotal);

    // 6. Supprime les anciennes lignes de commande
    await tx.ligneCommande.deleteMany({
      where: { commandeId: orderId },
    });

    // 7. Mets à jour la commande avec les nouvelles lignes et le nouveau total
    const commandeMaj = await tx.commande.update({
      where: { id: orderId },
      data: {
        total: nouveauTotal,
        lignes: { create: lignesData },
      },
      include: {
        ...orderInclude,
        utilisateur: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } }
      },
    });

    return commandeMaj;
  });
};

export const trackOrderPublicly = async (numero: string) => {
  const order = await prisma.commande.findUnique({
    where: { numero },
    select: {
      numero: true,
      statut: true,
      creeLe: true,
      factures: {
        select: { numero: true, statutPaiement: true }
      },
      bonsLivraison: {
        select: { code: true, statut: true }
      }
    }
  });

  if (!order) {
    throw new OrderError('Commande introuvable', 404);
  }

  // Rename fields in output for frontend compatibility
  return {
    code: order.numero,
    statut: order.statut,
    dateCommande: order.creeLe,
    factures: order.factures,
    bonsLivraison: order.bonsLivraison
  };
};
