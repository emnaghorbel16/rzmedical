# 📘 Guide d'Utilisation de l'Administration — RZMedical

> **Version 3.0 — Mise à jour complète**  
> Ce guide couvre l'intégralité des modules du panneau d'administration RZMedical : ventes, achats, stocks, fiscalité, relation client, commerciaux, contenu du site et configuration système.

---

## 📑 Sommaire

1. [Accès & Connexion Sécurisée](#1-accès--connexion-sécurisée)
2. [Tableau de Bord (Dashboard)](#2-tableau-de-bord-dashboard)
3. [Étape Prioritaire : Configuration Société & Fiscalité](#3-étape-prioritaire--configuration-société--fiscalité)
4. [Gestion du Catalogue & des Produits](#4-gestion-du-catalogue--des-produits)
5. [Gestion des Stocks](#5-gestion-des-stocks)
6. [Cycle des Ventes : Du Devis à la Facture](#6-cycle-des-ventes--du-devis-à-la-facture)
   - [A. Devis Clients](#a-devis-clients)
   - [B. Commandes](#b-commandes)
   - [C. Bons de Livraison (BL)](#c-bons-de-livraison-bl)
   - [D. Bons de Sortie](#d-bons-de-sortie)
   - [E. Facturation Client & PDF](#e-facturation-client--pdf)
   - [F. Annulation de Facture & Avoirs](#f-annulation-de-facture--avoirs)
7. [Suivi des Impayés & Exercices Fiscaux](#7-suivi-des-impayés--exercices-fiscaux)
8. [Cycle des Achats & Fournisseurs](#8-cycle-des-achats--fournisseurs)
9. [Gestion des Tiers](#9-gestion-des-tiers)
10. [Gestion des Stocks Commerciaux](#10-gestion-des-stocks-commerciaux)
11. [Équipe Commerciale](#11-équipe-commerciale)
12. [Gestion des Charges & Déclarations](#12-gestion-des-charges--déclarations)
13. [Gestion des Clients & Administrateurs](#13-gestion-des-clients--administrateurs)
14. [Support & Relation Client (Inbox)](#14-support--relation-client-inbox)
15. [Contenu du Site Web](#15-contenu-du-site-web)
16. [Règles d'Or & Bonnes Pratiques](#16-règles-dor--bonnes-pratiques)
17. [Résolution des Problèmes Fréquents](#17-résolution-des-problèmes-fréquents)

---

## 1. Accès & Connexion Sécurisée

| Environnement | URL |
| :--- | :--- |
| **Production** | `https://admin.randzmedical.com` |
| **Local (dev)** | `http://localhost:3001` |

**Procédure de connexion :**
1. Saisissez votre adresse email administrateur et votre mot de passe.
2. Si l'authentification à double facteur (2FA) est activée, un code OTP temporaire vous sera envoyé par email — saisissez-le dans les 5 minutes.
3. En cas d'oubli de mot de passe, utilisez le lien **« Mot de passe oublié ? »** sur la page de connexion.

**Déconnexion :** Cliquez sur votre avatar en haut à droite > **Déconnexion**.

> ⚠️ **Sécurité :** Ne partagez jamais vos identifiants. Chaque administrateur doit avoir son propre compte.

---

## 2. Tableau de Bord (Dashboard)

Accessible via `/dashboard` — Vue synthétique de votre activité en temps réel :

| Indicateur | Description |
| :--- | :--- |
| **Chiffre d'affaires** | CA du mois en cours vs mois précédent |
| **Commandes récentes** | Dernières commandes reçues et leur statut |
| **Stock critique** | Produits dont la quantité est en-dessous du seuil d'alerte |
| **Impayés** | Montant total des factures non réglées |
| **Tickets support** | Nombre de tickets ouverts en attente de réponse |

> 💡 **Tip :** Le dashboard se rafraîchit automatiquement. Inutile de recharger la page manuellement.

---

## 3. Étape Prioritaire : Configuration Société & Fiscalité

> ⚠️ **ESSENTIEL — À faire avant toute autre action :**  
> RZMedical est **100 % dynamique**. Toutes les informations saisies ici alimentent **automatiquement** les en-têtes et pieds de page de tous les documents officiels (Factures, Devis, BL, Bons de Commande).

**Navigation :** `Configuration > Société & Fiscalité` → `/configuration`

### 3.1 Identité Visuelle

- **Logo officiel** : Cliquez sur **« Changer de logo »** pour uploader votre logo.
  - Format recommandé : **PNG transparent, haute résolution (minimum 300×100 px)**.
  - Le logo apparaîtra immédiatement sur tous les documents PDF générés.

### 3.2 Coordonnées de l'Entreprise

| Champ | Exemple |
| :--- | :--- |
| Nom de la société | `RZMedical` ou `R and Z Medical` |
| Matricule Fiscale (M.F) | `1742623LAM000` |
| Téléphone | `+216 71 XXX XXX` |
| Fax | `+216 71 XXX XXX` |
| Email de contact | `contact@randzmedical.com` |
| Adresse complète | Rue, bâtiment, étage, ville, code postal |
| Site Web | `https://randzmedical.com` |

### 3.3 Coordonnées Bancaires

| Champ | Exemple |
| :--- | :--- |
| Nom de la Banque | `UIB`, `BIAT`, `BNA`, `Attijari`... |
| RIB / N° de Compte | Identifiant bancaire à 20 chiffres |

Ces informations apparaissent dans le pied de page des factures pour faciliter les virements clients.

### 3.4 Paramètres Fiscaux

- **Taux de TVA autorisés** : Ajoutez ou supprimez les pourcentages légaux applicables (ex. `0%`, `7%`, `13%`, `19%`). Ces taux sont proposés lors de la création de produits et de lignes de facturation.
- **Valeurs du Timbre Fiscal** : Montants légaux en dinars (ex. `1.000 TND`).
- **Frais de livraison standard** : Montant appliqué par défaut aux commandes en ligne depuis la boutique.

> 💾 Cliquez sur **« Enregistrer la configuration »** après chaque modification. La mise à jour est instantanée dans toute l'application, sans redémarrage nécessaire.

---

## 4. Gestion du Catalogue & des Produits

**Navigation :** Menu **Catalogue**

### 4.1 Catégories & Sous-Catégories

- **Catégories** (`/categories`) : Créez vos grandes familles (ex. *Diagnostic*, *Matériel médical*, *Consommables*).
- **Sous-Catégories** (`/subcategories`) : Affinez l'arborescence sous chaque catégorie parente.
- **Réorganisation** (`/reorder-subcategories`) : Glissez-déposez pour modifier l'ordre d'affichage des sous-catégories dans la boutique en ligne.

### 4.2 Marques

- **Marques** (`/brands`) : Associez les marques de vos fabricants (Omron, Beurer, Pic Solution, etc.).
- Une marque peut regrouper plusieurs produits et facilite le filtrage dans la boutique.

### 4.3 Produits (`/products`)

**Création / Édition d'un produit :**

| Champ | Description |
| :--- | :--- |
| Référence | Identifiant unique (ex. `RZM-OMR-M3C`) |
| Désignation | Nom commercial clair et précis |
| Catégorie / Sous-catégorie | Arborescence catalogue |
| Marque | Fabricant du produit |
| Prix d'achat HT | Coût fournisseur (utilisé pour le calcul de marge) |
| Prix de vente HT | Prix public hors taxes |
| Taux de TVA | Sélectionné parmi les taux configurés en section 3 |
| Remise | Pourcentage de remise applicable |
| Stock actuel | Quantité disponible en entrepôt |
| Seuil d'alerte | Déclencheur d'alerte stock faible sur le dashboard |
| Photos | Images du produit (plusieurs photos supportées) |
| Fiche technique | Upload PDF de la documentation technique |
| Notice | Notice d'utilisation patient |
| Statut | Actif / Inactif (masque le produit de la boutique) |

---

## 5. Gestion des Stocks

### 5.1 Mouvements de Stock (`/mouvements-stock`)

Historique automatique et exhaustif de **chaque entrée et sortie** de stock :

| Type de mouvement | Déclencheur |
| :--- | :--- |
| **Entrée** | Validation d'un Bon de Réception fournisseur |
| **Sortie vente** | Génération d'un Bon de Livraison client |
| **Sortie interne** | Création d'un Bon de Sortie |
| **Ajustement** | Correction manuelle après inventaire |

### 5.2 Inventaires (`/inventaires`)

Permet de réaliser un **inventaire physique** de votre entrepôt :
1. Cliquez sur **« Nouvel inventaire »**.
2. Parcourez la liste de vos produits et saisissez les **quantités comptées réellement**.
3. Le système calcule automatiquement les **écarts** entre le stock théorique et le stock réel.
4. **Validez l'inventaire** pour appliquer les corrections de stock.
5. Un historique de tous les inventaires passés est conservé.

> 💡 **Bonne pratique :** Réalisez un inventaire complet minimum une fois par trimestre.

### 5.3 Bons de Sortie (`/bons-sortie`)

Document interne permettant de **sortir du stock sans vente** (prêts, démonstrations, pertes, destruction) :
1. Cliquez sur **« Nouveau Bon de Sortie »**.
2. Sélectionnez les articles et les quantités à sortir.
3. Indiquez le motif (ex. *Prêt commercial*, *Démonstration*, *Perte/Casse*).
4. Validez — le stock est immédiatement débité.

---

## 6. Cycle des Ventes : Du Devis à la Facture

Le flux standard recommandé est le suivant :

```
[ Devis Client ] ──► [ Commande ] ──► [ Bon de Livraison ] ──► [ Facture ]
                                              │
                                    [ Bon de Sortie ] (sorties internes)
```

---

### A. Devis Clients (`/devis`)

1. Cliquez sur **« Nouveau Devis »**.
2. Sélectionnez ou créez un client.
3. Ajoutez les lignes de produits ou de prestations.
4. Les calculs (prix HT, TVA par taux, remises, timbre fiscal) sont effectués **en temps réel**.
5. Cliquez sur **« Créer le devis »**.

**Actions disponibles sur un devis :**

| Action | Description |
| :--- | :--- |
| 📄 Télécharger PDF | Document imprimable avec logo et coordonnées officielles |
| 🔄 Convertir en Commande | Transforme le devis en commande (un clic) |
| 🧾 Convertir en Facture | Transforme le devis en facture directement |
| ✏️ Modifier | Édition possible tant que le devis n'est pas converti |
| 🗑️ Supprimer | Suppression définitive d'un devis non converti |

---

### B. Commandes (`/orders`)

Centralise toutes les commandes :
- Commandes passées depuis la **boutique en ligne** (e-commerce).
- Commandes **saisies manuellement** en back-office.

**Cycle de vie d'une commande :**

```
EN_ATTENTE ──► CONFIRMEE ──► LIVREE
                    │
                 ANNULEE
```

| Statut | Signification |
| :--- | :--- |
| `EN_ATTENTE` | Commande reçue, en attente de traitement |
| `CONFIRMEE` | Stock réservé, prête pour expédition |
| `LIVREE` | Marchandise remise au client |
| `ANNULEE` | Commande annulée — stock automatiquement restitué |

**Actions disponibles depuis la fiche commande :**
- Générer un **Bon de Livraison**.
- Générer une **Facture** directement.
- Modifier les détails si la commande est encore en attente.

---

### C. Bons de Livraison (BL) (`/bons-livraison`)

Le BL atteste officiellement de la **remise physique de la marchandise** au client.

1. Cliquez sur **« Nouveau BL »** ou générez-le depuis une commande.
2. Renseignez le client, l'adresse de livraison et les articles livrés.
3. Imprimez le PDF — il contient une zone pour le **cachet et la signature du client**.

> 🔗 **Groupement Multi-BL :** Vous pouvez effectuer plusieurs livraisons partielles (BL 1, BL 2, BL 3) puis générer **une seule facture globale** regroupant tous ces BL en une seule ligne de temps.

---

### D. Bons de Sortie (`/bons-sortie`)

Voir section [5.3 Bons de Sortie](#53-bons-de-sortie).

---

### E. Facturation Client & PDF (`/invoices`)

La facture est le **document légal et comptable définitif**.

#### Modes de création :

| Mode | Description |
| :--- | :--- |
| **Depuis un ou plusieurs BL** | Lignes et quantités livrées pré-remplies automatiquement |
| **Depuis une commande** | Conversion automatique des lignes de commande |
| **Manuelle** | Saisie libre des articles via **« Créer une facture »** |

#### Contenu du PDF généré :

- ✅ Logo dynamique de votre boutique
- ✅ Mentions légales complètes (Nom, MF, Adresse, Téléphone, Fax, Email)
- ✅ Coordonnées bancaires (Banque & RIB) pour faciliter le virement
- ✅ Montant en lettres en français (*« Arrêtée la présente facture à la somme de... »*)
- ✅ Timbre fiscal et détail par taux de TVA
- ✅ Numérotation séquentielle par exercice fiscal

#### Gestion du règlement :

| Statut | Description |
| :--- | :--- |
| `NON_PAYEE` | Facture émise, aucun règlement reçu |
| `PARTIELLEMENT_PAYEE` | Acompte ou règlement partiel enregistré |
| `PAYEE` | Intégralement réglée |

Enregistrez les montants et modes de règlement (virement, chèque, espèces) pour alimenter automatiquement le suivi des impayés.

---

### F. Annulation de Facture & Avoirs (`/avoirs`)

> ⚖️ **Règle comptable fondamentale :** Une facture validée et émise **ne doit jamais être supprimée**. Cela constituerait une fraude comptable.

**Procédure d'annulation :**
1. Ouvrez la facture concernée.
2. Cliquez sur **« Annuler la facture »**.
3. Le système génère automatiquement un **Avoir commercial numéroté** qui contrebalance comptablement la facture d'origine.
4. L'avoir est consultable et téléchargeable en PDF dans **Ventes > Avoirs Clients**.

---

## 7. Suivi des Impayés & Exercices Fiscaux

### 7.1 Page Impayés (`/impayes`)

Vue synthétique de tous les clients ayant un **solde débiteur** :

| Colonne | Description |
| :--- | :--- |
| Client | Nom et matricule fiscale |
| Montant dû | Total des factures non réglées |
| Ancienneté | Classement : 30j / 60j / 90j+ |
| Actions | Envoi de relance, consultation des factures |

- **Export CSV** : pour vos relances téléphoniques ou transmission au comptable.

### 7.2 Exercices Fiscaux (`/exercices`)

- Définissez l'**année fiscale courante** (ex. `2026`).
- Toutes les numérotations (factures, devis, BL, bons de commande) et les statistiques financières se calquent sur l'exercice sélectionné dans la barre supérieure.
- Vous pouvez **créer un nouvel exercice** en début d'année et le sélectionner comme actif.

> ⚠️ Vérifiez toujours que l'exercice actif en haut de page correspond à l'année comptable en cours avant de créer des documents.

---

## 8. Cycle des Achats & Fournisseurs

**Navigation :** Menu **Achats**

### 8.1 Fournisseurs (`/fournisseurs`)

Répertoire de vos fabricants et distributeurs :
- Coordonnées complètes (adresse, téléphone, email).
- Matricule Fiscale fournisseur.
- Historique des commandes passées à ce fournisseur.

### 8.2 Bons de Commande Fournisseur (`/bons-commande`)

1. Cliquez sur **« Nouveau BC »**.
2. Sélectionnez le fournisseur et ajoutez les articles avec les **prix d'achat convenus**.
3. Téléchargez le **PDF du bon de commande** pour l'envoyer par email à votre fournisseur.
4. Suivez le statut : `BROUILLON` → `ENVOYE` → `RECEPTIONNE`.

### 8.3 Bons de Réception (`/bons-reception`)

À l'arrivée des colis :
1. Ouvrez le bon de commande correspondant et cliquez sur **« Créer un Bon de Réception »**.
2. Vérifiez et saisissez les **quantités réellement reçues** (possibilité de réception partielle).
3. Validez la réception.
4. **Impact immédiat :** Le stock des produits reçus est automatiquement augmenté.
5. Le coût d'achat est enregistré pour le calcul de la marge.

### 8.4 Factures Fournisseurs (`/factures-fournisseurs`)

- Enregistrez les factures d'achat reçues de vos fournisseurs.
- Utilisées pour le calcul de votre **marge réelle** (Prix vente HT − Prix achat HT).
- Alimentent vos **obligations fiscales** (déductibilité de la TVA sur achats).

---

## 9. Gestion des Tiers

**Navigation :** `/tiers`

Les **Tiers** sont des entités (entreprises, organismes, partenaires) avec lesquels vous avez des relations commerciales transversales — ni fournisseurs standards, ni clients boutique.

- Création d'une fiche tiers : nom, type, coordonnées, matricule fiscale.
- Historique des transactions associées.
- Utile pour les grands comptes, organismes publics (hôpitaux, cliniques) et partenaires institutionnels.

---

## 10. Gestion des Stocks Commerciaux

**Navigation :** `/stock-commercial`

Suivi du stock affecté à l'**équipe de vente terrain** (commerciaux itinérants) :

- Visualisez les articles confiés à chaque commercial.
- Suivez les sorties sur le terrain (démonstrations, ventes directes).
- Synchronisez avec le stock central lors des retours.
- Complète la section [Équipe Commerciale](#11-équipe-commerciale).

---

## 11. Équipe Commerciale

**Navigation :** `/commerciaux`

Gestion de votre force de vente terrain :

| Fonctionnalité | Description |
| :--- | :--- |
| **Fiche commercial** | Nom, contact, zone géographique, objectifs |
| **Stock attribué** | Articles confiés au commercial (voir section 10) |
| **Performances** | CA généré par commercial sur une période |
| **Commandes associées** | Commandes rattachées à un commercial spécifique |

---

## 12. Gestion des Charges & Déclarations

**Navigation :** Menu **Charges**

### 12.1 Charges Courantes (`/charges`)

Enregistrez toutes vos dépenses opérationnelles :
- Loyers, eau, électricité, internet.
- Fournitures de bureau.
- Frais de transport et livraison.
- Honoraires et prestations de service.

Chaque charge est catégorisée, datée et peut avoir une pièce justificative attachée.

### 12.2 CNSS (`/charges/cnss`)

Enregistrement et suivi des **cotisations sociales** :
- Saisie des déclarations trimestrielles.
- Suivi du montant patronal et salarial.
- Historique annuel pour la réconciliation comptable.

### 12.3 Déclarations Fiscales (`/charges/9ba4a`)

Suivi des déclarations mensuelles :
- **Déclaration de TVA** : TVA collectée − TVA déductible = TVA à payer.
- **Impôt sur les sociétés (IS)** : Acomptes provisionnels.
- Archivage des déclarations passées avec leur montant et date de dépôt.

---

## 13. Gestion des Clients & Administrateurs

**Navigation :** Menu **Utilisateurs**

### 13.1 Administrateurs (`/admins`)

Gestion des comptes ayant accès au back-office :

| Action | Description |
| :--- | :--- |
| **Créer un admin** | Nom, email, mot de passe, droits d'accès |
| **Modifier les droits** | Restreindre l'accès à certains modules |
| **Désactiver** | Bloquer l'accès sans supprimer le compte |

> 🔐 **Principe du moindre privilège :** Accordez uniquement les droits nécessaires à chaque administrateur selon son rôle.

### 13.2 Comptes Clients (`/customers`)

Fiche détaillée de chaque client inscrit sur la boutique en ligne :

| Champ | Description |
| :--- | :--- |
| Informations personnelles | Nom, prénom, email, téléphone |
| Matricule Fiscale | Pour les clients professionnels B2B |
| Taux de remise personnalisé | Remise permanente accordée (ex. `5%`, `10%`) |
| Historique des commandes | Toutes les commandes passées par ce client |
| Statut | Actif / Suspendu |

> 💡 La **remise personnalisée** s'applique automatiquement lors des commandes et lors de la génération des factures pour ce client.

---

## 14. Support & Relation Client (Inbox)

**Navigation :** `Support` → `/support` | `Inbox` → `/inbox`

### 14.1 Tickets Support (`/support`)

- Liste de tous les tickets ouverts par les clients depuis leur espace boutique.
- Interface de **messagerie intégrée** pour répondre directement au client.

| Statut | Description |
| :--- | :--- |
| `NOUVEAU` | Ticket non encore traité |
| `EN_COURS` | Pris en charge par un administrateur |
| `REPONDU` | Une réponse a été envoyée au client |
| `FERME` | Ticket résolu et clôturé |

### 14.2 Inbox (`/inbox`)

- Messagerie interne entre administrateurs.
- Notifications et messages système relatifs à des événements importants (stock critique, nouvelle commande, etc.).

---

## 15. Contenu du Site Web

**Navigation :** `/site-content`

Gestion du **contenu éditorial** de la boutique en ligne sans intervention technique :

| Section | Description |
| :--- | :--- |
| **Bannières** | Images et textes de la page d'accueil (slider) |
| **Pages statiques** | À propos, Mentions légales, CGV, FAQ |
| **Paramètres SEO** | Titre, description meta, mots-clés par page |
| **Informations de contact** | Téléphone, email, adresse affichés sur le site |
| **Réseaux sociaux** | Liens Facebook, Instagram, LinkedIn, etc. |

> 💡 Toute modification est publiée en **temps réel** sur la boutique en ligne sans redémarrage.

---

## 16. Règles d'Or & Bonnes Pratiques

| ✅ Règle | 💡 Raison |
| :--- | :--- |
| **Remplir "Société & Fiscalité" avant tout** | Garantit que tous les documents PDF sortent avec votre logo, RIB, MF et adresse exacts |
| **Ne jamais supprimer une facture émise** | Créez un Avoir — c'est la seule méthode légale d'annulation |
| **Passer par un Bon de Réception pour entrer du stock** | Assure la traçabilité des coûts et évite les incohérences de stock |
| **Vérifier l'Exercice Fiscal actif avant de créer un document** | Évite des numérotations sur le mauvais exercice comptable |
| **Attribuer à chaque admin uniquement les droits nécessaires** | Limite les risques d'erreurs ou de modifications non autorisées |
| **Réaliser un inventaire trimestriel** | Corrige les écarts de stock accumulés au fil du temps |
| **Exporter les impayés régulièrement** | Facilite les relances clients et le reporting comptable |
| **Sauvegardes régulières de la base de données** | Lancez `pg_dump` hebdomadairement et stockez sur un support externe sécurisé |

---

## 17. Résolution des Problèmes Fréquents

| Problème | Solution |
| :--- | :--- |
| **Le PDF de facture n'a pas de logo** | Vérifiez que le logo est bien uploadé dans *Configuration > Société & Fiscalité* |
| **La TVA ne s'applique pas sur un produit** | Vérifiez que le taux de TVA du produit est bien sélectionné et figure dans les taux autorisés |
| **Le stock ne diminue pas après une vente** | Assurez-vous qu'un **Bon de Livraison** ou **Bon de Sortie** a bien été validé |
| **Le stock ne monte pas après une réception** | Vérifiez que le **Bon de Réception** a bien été validé (pas seulement créé) |
| **La numérotation des factures repart à 1** | Vérifiez que l'exercice fiscal actif est le bon dans la barre supérieure |
| **Le client ne reçoit pas de réponse au support** | Vérifiez l'adresse email du compte client et les filtres anti-spam |
| **Impossible de se connecter** | Vérifiez que votre compte admin est actif dans *Utilisateurs > Administrateurs* |

---

*Guide officiel conçu pour l'administration de **RZMedical**.  
Version 3.0 — Mise à jour complète couvrant tous les modules disponibles.*  
*Pour toute question technique, contactez l'équipe de développement.*
