-- ============================================================
-- Migration corrigée : crée d'abord les tables manquantes
-- puis ajoute les tables de bons_reception
-- ============================================================

-- CreateEnum (si pas encore créé)
DO $$ BEGIN
  CREATE TYPE "StatutBonCommande" AS ENUM ('BROUILLON', 'ENVOYE', 'CONFIRME', 'RECEPTIONNE_PARTIEL', 'RECEPTIONNE', 'ANNULE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StatutBonLivraison" AS ENUM ('BROUILLON', 'PREPARE', 'EXPEDIE', 'LIVRE', 'FACTURE', 'ANNULE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StatutBonReception" AS ENUM ('BROUILLON', 'CONTROLE', 'VALIDE', 'FACTURE', 'ANNULE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable fournisseurs (si pas encore créé)
CREATE TABLE IF NOT EXISTS "fournisseurs" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "contactNom" TEXT,
    "contactPrenom" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "telephone2" TEXT,
    "adresse" TEXT,
    "ville" TEXT,
    "codePostal" TEXT,
    "pays" TEXT DEFAULT 'Tunisie',
    "matriculeFiscale" TEXT,
    "registreCommerce" TEXT,
    "categorie" TEXT,
    "delaiPaiement" TEXT,
    "modePaiement" TEXT,
    "rib" TEXT,
    "banque" TEXT,
    "siteWeb" TEXT,
    "notes" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "misAJourLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fournisseurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable bons_commande (si pas encore créé)
CREATE TABLE IF NOT EXISTS "bons_commande" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "dateCommande" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateLivraisonPrevue" TIMESTAMP(3),
    "statut" "StatutBonCommande" NOT NULL DEFAULT 'BROUILLON',
    "fournisseurId" INTEGER,
    "fournisseurNom" TEXT,
    "fournisseurMF" TEXT,
    "fournisseurAdresse" TEXT,
    "fournisseurTel" TEXT,
    "fournisseurEmail" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'TND',
    "montantHT" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "montantRemise" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "montantTVA" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "timbreFiscal" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "montantTTC" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "commentaire" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "misAJourLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bons_commande_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bons_commande_code_key" UNIQUE ("code")
);

-- CreateTable lignes_bons_commande (si pas encore créé)
CREATE TABLE IF NOT EXISTS "lignes_bons_commande" (
    "id" SERIAL NOT NULL,
    "bonCommandeId" INTEGER NOT NULL,
    "produitId" INTEGER,
    "designation" TEXT NOT NULL,
    "quantite" DECIMAL(12,3) NOT NULL,
    "prixUnitaireHT" DECIMAL(12,3) NOT NULL,
    "remise" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tauxTVA" DECIMAL(5,2) NOT NULL DEFAULT 19,
    "totalHT" DECIMAL(12,3) NOT NULL,
    CONSTRAINT "lignes_bons_commande_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lignes_bons_commande_bonCommandeId_fkey" FOREIGN KEY ("bonCommandeId") REFERENCES "bons_commande"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AddForeignKey bons_commande -> fournisseurs (si pas encore fait)
DO $$ BEGIN
  ALTER TABLE "bons_commande" ADD CONSTRAINT "bons_commande_fournisseurId_fkey"
    FOREIGN KEY ("fournisseurId") REFERENCES "fournisseurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Maintenant on crée bons_reception et ses tables liées
-- ============================================================

CREATE TABLE "bons_reception" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "dateReception" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" "StatutBonReception" NOT NULL DEFAULT 'BROUILLON',
    "stockMisAJour" BOOLEAN NOT NULL DEFAULT false,
    "bonCommandeId" INTEGER,
    "fournisseurId" INTEGER,
    "fournisseurNom" TEXT,
    "commentaire" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "misAJourLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bons_reception_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bons_reception_code_key" UNIQUE ("code"),
    CONSTRAINT "bons_reception_bonCommandeId_fkey" FOREIGN KEY ("bonCommandeId") REFERENCES "bons_commande"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bons_reception_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "fournisseurs"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "lignes_bons_reception" (
    "id" SERIAL NOT NULL,
    "bonReceptionId" INTEGER NOT NULL,
    "produitId" INTEGER,
    "designation" TEXT NOT NULL,
    "quantiteCmd" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "quantiteRecue" DECIMAL(12,3) NOT NULL,
    "prixUnitaireHT" DECIMAL(12,3) NOT NULL,
    "tauxTVA" DECIMAL(5,2) NOT NULL DEFAULT 19,
    CONSTRAINT "lignes_bons_reception_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lignes_bons_reception_bonReceptionId_fkey" FOREIGN KEY ("bonReceptionId") REFERENCES "bons_reception"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "bons_reception_bons_commande" (
    "bonReceptionId" INTEGER NOT NULL,
    "bonCommandeId" INTEGER NOT NULL,
    CONSTRAINT "bons_reception_bons_commande_pkey" PRIMARY KEY ("bonReceptionId", "bonCommandeId"),
    CONSTRAINT "bons_reception_bons_commande_bonReceptionId_fkey" FOREIGN KEY ("bonReceptionId") REFERENCES "bons_reception"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bons_reception_bons_commande_bonCommandeId_fkey" FOREIGN KEY ("bonCommandeId") REFERENCES "bons_commande"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "bons_reception_bons_commande_bonCommandeId_idx" ON "bons_reception_bons_commande"("bonCommandeId");
