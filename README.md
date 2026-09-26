# RZMedical

> Plateforme e-commerce de dispositifs médicaux — monorepo complet avec boutique client, panneau d'administration et API REST.

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://prisma.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose)

---

## 📑 Sommaire

1. [Architecture](#architecture)
2. [Prérequis](#prérequis)
3. [Démarrage rapide avec Docker](#démarrage-rapide-avec-docker)
4. [Installation locale](#installation-locale)
5. [Variables d'environnement](#variables-denvironnement)
6. [Commandes disponibles](#commandes-disponibles)
7. [API REST](#api-rest)
8. [Base de données](#base-de-données)
9. [Tests & Qualité](#tests--qualité)
10. [Sécurité](#sécurité)
11. [Dépannage](#dépannage)
12. [Documentation complémentaire](#documentation-complémentaire)

---

## Architecture

Ce dépôt est un monorepo organisé en trois applications indépendantes :

| Application | Description | Port (local) |
| :--- | :--- | :---: |
| `web/` | Boutique client — Next.js 15 | `3000` |
| `admin-panel/` | Back-office administrateur — Next.js 15 | `3001` |
| `backend/` | API REST — Express 5 + Prisma 7 + PostgreSQL 16 | `4000` |

```
rzmedical/
├── web/                  # Site public (Next.js)
├── admin-panel/          # Panneau d'administration (Next.js)
├── backend/              # API REST (Express + Prisma)
│   ├── src/
│   │   ├── modules/      # Routes & services métier
│   │   ├── middlewares/  # Auth JWT, upload, CORS…
│   │   └── config/       # Prisma client, config serveur
│   └── prisma/           # Schéma & migrations
├── prisma/               # Schéma partagé (racine)
├── tests/                # Tests E2E Playwright
├── docker-compose.yml
└── docker-compose.prod.yml
```

**Flux applicatif :**

```
Navigateur
  ├──► web :3000          (Next.js — boutique client)
  ├──► admin-panel :3001  (Next.js — back-office)
  └──► backend :4000      (API REST)
              └──► PostgreSQL :5432
```

---

## Prérequis

| Outil | Version minimale |
| :--- | :--- |
| Node.js | 20 LTS |
| npm | 10+ |
| PostgreSQL | 16 (ou via Docker) |
| Docker Desktop | Dernière version stable |
| Git | Toute version récente |

> Pour l'assistant conversationnel intégré au site, une clé API **Groq** est nécessaire (`GROQ_API_KEY`).

---

## Démarrage rapide avec Docker

```bash
# Copier les variables d'environnement
cp .env.example .env

# Démarrer PostgreSQL + Backend + Admin
docker compose up --build
```

| Service | URL locale | Rôle |
| :--- | :--- | :--- |
| PostgreSQL | `localhost:5432` | Base de données |
| Backend (API) | `http://localhost:4000` | API REST |
| Admin Panel | `http://localhost:3001` | Back-office |

> **Note :** Le service `web` (boutique client) n'est pas inclus dans `docker-compose.yml`. Lancez-le séparément en local (voir section suivante).

```bash
# Arrêter les services
docker compose down

# Arrêter ET supprimer les données PostgreSQL
docker compose down -v
```

Le conteneur backend applique automatiquement les migrations Prisma au démarrage. Les données PostgreSQL sont persistées dans le volume nommé `rzmedical_pgdata`.

---

## Installation locale

### Étape 1 — Base de données PostgreSQL

**Option A — Via Docker (recommandé) :**

```bash
docker compose up -d db
```

**Option B — PostgreSQL natif :**

Créez une base de données et notez l'URL de connexion au format :

```
postgresql://USER:PASSWORD@localhost:5432/rzmedical_db
```

---

### Étape 2 — Backend (API)

```bash
cd backend
npm install
```

Créez `backend/.env` à partir du template :

```bash
cp .env.example .env
```

Initialisez la base et générez le client Prisma :

```bash
npx prisma generate
npx prisma migrate deploy
npm run db:seed        # Crée le compte administrateur par défaut
```

Démarrez l'API en mode développement :

```bash
npm run dev
# API disponible sur http://localhost:4000
```

---

### Étape 3 — Site public (`web/`)

Dans un nouveau terminal :

```bash
cd web
npm install
cp .env.example .env.local   # Puis éditez .env.local
npm run dev
# Site disponible sur http://localhost:3000
```

---

### Étape 4 — Panneau d'administration (`admin-panel/`)

Dans un nouveau terminal :

```bash
cd admin-panel
npm install
cp .env.example .env.local   # Puis éditez .env.local
npm run dev
# Admin disponible sur http://localhost:3001
```

---

## Variables d'environnement

### `backend/.env`

| Variable | Exemple | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://postgres:pass@localhost:5432/rzmedical_db` | URL de connexion PostgreSQL |
| `PORT` | `4000` | Port de l'API |
| `JWT_SECRET` | `changez-cette-valeur` | Clé secrète JWT (**obligatoire en prod**) |
| `JWT_EXPIRES_IN` | `8h` | Durée de validité du token |
| `ADMIN_EMAIL` | `admin@randzmedical.com` | Email du compte admin par défaut |
| `ADMIN_PASSWORD` | `changez-ce-mot-de-passe` | Mot de passe admin par défaut |
| `EMAIL_HOST` | `smtp.gmail.com` | Serveur SMTP |
| `EMAIL_PORT` | `587` | Port SMTP |
| `EMAIL_USER` | `noreply@randzmedical.com` | Identifiant SMTP |
| `EMAIL_PASS` | — | Mot de passe SMTP |
| `FRONTEND_URL` | `http://localhost:3000` | URL du site (CORS) |
| `CORS_ORIGIN` | `*` | Origines autorisées (restreindre en prod) |
| `UPLOAD_DIR` | `uploads` | Dossier des fichiers uploadés |
| `MAX_FILE_SIZE_MB` | `200` | Taille max des fichiers |

### `web/.env.local`

| Variable | Exemple | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | URL de l'API (publique) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | URL du site |
| `GROQ_API_KEY` | `gsk_...` | Clé API Groq (assistant IA) |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Modèle Groq utilisé |

### `admin-panel/.env.local`

| Variable | Exemple | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api` | URL de l'API |

> ⚠️ Ne committez jamais les fichiers `.env`. Les fichiers `.env.example` sont des templates committés sans secrets.

---

## Commandes disponibles

Les commandes s'exécutent depuis le dossier de chaque application.

### Backend

```bash
cd backend
```

| Commande | Description |
| :--- | :--- |
| `npm run dev` | Lance l'API avec rechargement automatique (`nodemon` + `tsx`) |
| `npm run build` | Compile TypeScript vers `dist/` |
| `npm start` | Démarre la version compilée (production) |
| `npm run db:seed` | Crée le compte administrateur par défaut |
| `npx prisma generate` | Régénère le client Prisma |
| `npx prisma migrate dev --name <nom>` | Crée et applique une migration (développement) |
| `npx prisma migrate deploy` | Applique les migrations existantes (production) |
| `npx prisma studio` | Interface visuelle d'inspection de la base |

### Web & Admin Panel

```bash
cd web        # ou cd admin-panel
```

| Commande | Description |
| :--- | :--- |
| `npm run dev` | Serveur de développement Next.js |
| `npm run build` | Build de production |
| `npm start` | Démarre le build de production |
| `npm run lint` | Analyse ESLint |

---

## API REST

Toutes les routes sont préfixées par `/api`. L'authentification utilise un token **JWT** dans l'en-tête `Authorization: Bearer <token>`.

### Catalogue & Produits

| Route | Description |
| :--- | :--- |
| `/api/categories` | Catégories (CRUD + visibilité) |
| `/api/subcategories` | Sous-catégories |
| `/api/brands` | Marques |
| `/api/products` | Produits (CRUD, stock, images) |
| `/api/upload` | Upload de fichiers (images, PDF) |

### Ventes

| Route | Description |
| :--- | :--- |
| `/api/devis` | Devis clients |
| `/api/orders` | Commandes (e-commerce + manuelles) |
| `/api/bons-livraison` | Bons de livraison |
| `/api/invoices` | Factures clients + génération PDF |
| `/api/avoirs` | Avoirs (annulation de facture) |

### Achats & Stock

| Route | Description |
| :--- | :--- |
| `/api/achats` | Bons de commande fournisseurs, réceptions, factures fournisseurs |
| `/api/stock` | Mouvements de stock, inventaires, bons de sortie |
| `/api/stock-commercial` | Stock affecté aux commerciaux terrain |
| `/api/fournisseurs` | Répertoire fournisseurs |
| `/api/tiers` | Tiers (grands comptes, partenaires institutionnels) |

### Finance

| Route | Description |
| :--- | :--- |
| `/api/invoices` | Factures & règlements |
| `/api/exercices` | Exercices fiscaux |
| `/api/stats` | Statistiques & tableaux de bord |
| `/api/services` | Charges, CNSS, déclarations fiscales |

### Utilisateurs & Accès

| Route | Description |
| :--- | :--- |
| `/api/auth` | Authentification administrateur (JWT) |
| `/api/client-auth` | Authentification client (boutique) |
| `/api/admins` | Gestion des comptes administrateurs |
| `/api/clients` | Gestion des comptes clients |
| `/api/users` | Utilisateurs génériques |
| `/api/company-info` | Configuration société & fiscalité |

### Communication

| Route | Description |
| :--- | :--- |
| `/api/support` | Tickets de support client |
| `/api/inbox` | Messagerie interne |
| `/api/notifications` | Notifications système |
| `/api/newsletter` | Abonnés à la newsletter |
| `/api/site-content` | Contenu éditorial (bannières, pages) |
| `/api/cart` | Panier client |

---

## Base de données

- **Schéma Prisma :** [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)
- **Migrations :** `backend/prisma/migrations/`
- **Client généré :** `backend/generated/prisma/` *(ignoré par Git — recréé via `prisma generate`)*

**Workflow de modification du schéma :**

```bash
cd backend

# 1. Modifiez backend/prisma/schema.prisma

# 2. Créez et appliquez la migration
npx prisma migrate dev --name description-de-la-modification

# 3. Régénérez le client
npx prisma generate
```

> ⚠️ Ne modifiez jamais manuellement une migration déjà appliquée sur un environnement partagé. Créez toujours une nouvelle migration.

**Sauvegarde manuelle (PostgreSQL) :**

```bash
pg_dump -U postgres rzmedical_db > backup_$(date +%Y%m%d).dump
```

---

## Tests & Qualité

### Tests E2E — Playwright

```bash
# Depuis la racine du dépôt
npx playwright test

# Avec interface graphique
npx playwright test --ui

# Rapport HTML
npx playwright show-report
```

La configuration Playwright se trouve dans [`playwright.config.ts`](playwright.config.ts). Les tests sont dans `tests/`.

### Qualité du code

```bash
# Lint — backend
cd backend && npm run build

# Lint — web
cd web && npm run lint

# Lint — admin
cd admin-panel && npm run lint
```

---

## Sécurité

| Point de vigilance | Action recommandée |
| :--- | :--- |
| `JWT_SECRET` | Utiliser une chaîne aléatoire longue (≥ 64 caractères) en production |
| `ADMIN_PASSWORD` | Changer immédiatement après la première connexion |
| `GROQ_API_KEY` | Ne jamais préfixer par `NEXT_PUBLIC_` — route serveur uniquement |
| CORS | Remplacer `CORS_ORIGIN=*` par le domaine exact en production |
| SMTP | Configurer un vrai compte SMTP (OTP, support, notifications) |
| Uploads | Vérifier les types MIME acceptés côté serveur |
| PostgreSQL | Utiliser des identifiants forts et un volume sauvegardé en production |

---

## Dépannage

### Le backend ne se connecte pas à PostgreSQL

```bash
# Vérifier l'état des services Docker
docker compose ps
docker compose logs db

# Rappel : utiliser "localhost" hors Docker, "db" dans le réseau Docker Compose
```

### Le frontend affiche une erreur réseau (`Network Error`)

```bash
# Tester que l'API répond
curl http://localhost:4000/

# Vérifier NEXT_PUBLIC_API_URL dans .env.local
# Redémarrer Next.js après toute modification d'une variable NEXT_PUBLIC_*
```

### Les emails / OTP ne partent pas

Vérifiez `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER` et `EMAIL_PASS`. Sans identifiants SMTP valides, toutes les fonctions email sont non-opérationnelles.

### Le port 3000 est déjà occupé

L'admin Docker écoute sur `3001` par défaut. Si un autre service occupe `3000`, démarrez le site public sur un port différent :

```bash
cd web && npm run dev -- -p 3002
# Mettez aussi à jour NEXT_PUBLIC_SITE_URL="http://localhost:3002" dans web/.env.local
```

### Prisma : erreur "client non généré"

```bash
cd backend && npx prisma generate
```

### Migrations en désaccord (`drift`)

```bash
cd backend
npx prisma migrate status   # Voir l'état des migrations
npx prisma migrate deploy   # Appliquer les migrations manquantes
```

---

## Documentation complémentaire

| Document | Description |
| :--- | :--- |
| [`GUIDE_UTILISATEUR_ADMIN.md`](GUIDE_UTILISATEUR_ADMIN.md) | Guide complet d'utilisation du panneau d'administration |
| [`docker-compose.yml`](docker-compose.yml) | Configuration Docker (développement) |
| [`docker-compose.prod.yml`](docker-compose.prod.yml) | Configuration Docker (production) |
| [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma) | Schéma de base de données |
| [`playwright.config.ts`](playwright.config.ts) | Configuration des tests E2E |
| [Documentation Next.js](https://nextjs.org/docs) | Référence Next.js officielle |
| [Documentation Prisma](https://www.prisma.io/docs) | Référence Prisma officielle |

---

*RZMedical — Plateforme de gestion de dispositifs médicaux.*
