-- CreateEnum
CREATE TYPE "StatutAvis" AS ENUM ('EN_ATTENTE', 'APPROUVE', 'REJETE');

-- CreateTable
CREATE TABLE "avis_clients" (
    "id" SERIAL NOT NULL,
    "produitId" INTEGER NOT NULL,
    "utilisateurId" INTEGER,
    "nomAuteur" TEXT NOT NULL,
    "note" INTEGER NOT NULL,
    "titre" TEXT,
    "commentaire" TEXT NOT NULL,
    "statut" "StatutAvis" NOT NULL DEFAULT 'EN_ATTENTE',
    "verifieAchat" BOOLEAN NOT NULL DEFAULT false,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "misAJourLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avis_clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "avis_clients_produitId_statut_idx" ON "avis_clients"("produitId", "statut");

-- CreateIndex
CREATE INDEX "avis_clients_utilisateurId_idx" ON "avis_clients"("utilisateurId");

-- AddForeignKey
ALTER TABLE "avis_clients" ADD CONSTRAINT "avis_clients_produitId_fkey" 
    FOREIGN KEY ("produitId") REFERENCES "produits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avis_clients" ADD CONSTRAINT "avis_clients_utilisateurId_fkey" 
    FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
