# 🚀 Guide Complet : Hébergement RZMedical sur OVH VPS

> **Dépôt** : [`github.com/emnaghorbel16/rzmedical`](https://github.com/emnaghorbel16/rzmedical)  
> **Version** : Mise à jour — septembre 2026

---

## 📑 Sommaire

1. [Configuration VPS](#-partie-1--configuration-du-vps)
2. [Commander le VPS chez OVH](#-partie-2--commander-le-vps-chez-ovh)
3. [Connexion & Configuration du Serveur](#-partie-3--connexion--configuration-du-serveur)
4. [Déployer le Projet depuis GitHub](#-partie-4--déployer-le-projet-depuis-github)
5. [Configurer le Nom de Domaine](#-partie-5--configurer-le-nom-de-domaine)
6. [Configurer Nginx & HTTPS](#-partie-6--configurer-nginx--https)
7. [Vérification Finale](#-partie-7--vérification-finale)
8. [Mettre à Jour le Projet](#-partie-8--mettre-à-jour-le-projet-après-un-push-git)
9. [Stratégie de Backup (3 Couches)](#-partie-9--stratégie-complète-de-backup-3-couches)
10. [Sécurité du Serveur](#-partie-10--sécurité-du-serveur)
11. [Maintenance](#-partie-11--commandes-de-maintenance)
12. [Dépannage](#-partie-12--résolution-des-problèmes-courants)

---

## 📦 Partie 1 — Configuration du VPS

| Composant | Valeur |
| :--- | :--- |
| **Offre** | VPS-1 2027 |
| **CPU** | 2 vCore |
| **RAM** | 4 Go |
| **Stockage** | 40 Go SSD NVMe |
| **Bande passante** | 500 Mbit/s illimitée |
| **OS** | Ubuntu 26.04 LTS |
| **Datacenter** | Europe (France - Gravelines) |
| **Engagement** | 12 mois |
| **Backup OVH** | Automated Backup Standard (inclus) |
| **Prix total** | 155 040 TND HT / 12 mois |

---

## 🛒 Partie 2 — Commander le VPS chez OVH

### Prérequis avant de commencer

- [x] Projet sur GitHub : `github.com/emnaghorbel16/rzmedical`
- [x] `.env.example` avec toutes les variables documentées
- [ ] Compte OVH créé sur [ovhcloud.com](https://www.ovhcloud.com/fr-tn/)
- [ ] Nom de domaine prêt (ex. `randzmedical.com`)
- [ ] **MobaXterm** installé sur votre PC Windows : [mobaxterm.mobatek.net](https://mobaxterm.mobatek.net/)

### Souscrire au VPS

1. Aller sur **[ovhcloud.com/fr-tn/vps](https://www.ovhcloud.com/fr-tn/vps/)**
2. Choisir **VPS-1 2027**
3. Sélectionner :

| Option | Valeur |
| :--- | :--- |
| CPU | 2 vCores |
| RAM | 4 Go |
| Stockage | 40 Go SSD NVMe |
| Datacenter | Europe (France - Gravelines) |
| OS | **Ubuntu 26.04 LTS 64 bits** |
| Engagement | **12 mois** |
| Backup automatique | **Activé** (inclus) |

4. Commander → Payer → Attendre l'email OVH (2–10 minutes)

### Récupérer les informations de connexion

OVH envoie un email avec :
- **Adresse IP du VPS** : ex. `198.245.XXX.XXX`
- **Utilisateur** : `ubuntu`
- **Mot de passe** temporaire

---

## 💻 Partie 3 — Connexion & Configuration du Serveur

### 3.1 — Se connecter en SSH

**Avec MobaXterm :**
1. Ouvrir MobaXterm → **« Session » → « SSH »**
2. Remote host : `198.245.XXX.XXX` | Username : `ubuntu`
3. Cliquer **OK** → Saisir le mot de passe OVH

```powershell
# Ou depuis PowerShell Windows
ssh ubuntu@198.245.XXX.XXX
```

### 3.2 — Changer le mot de passe (sécurité immédiate)

```bash
passwd
```

### 3.3 — Mettre à jour et installer les outils

```bash
# Mise à jour complète du système
sudo apt update && sudo apt upgrade -y

# Installer Docker (script officiel)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
newgrp docker

# Installer les outils complémentaires
sudo apt install docker-compose-plugin git nginx certbot python3-certbot-nginx -y

# Vérifier les installations
docker --version
docker compose version
nginx -v
git --version
```

### 3.4 — Créer un fichier d'échange (Swap) de 4 Go

> ⚠️ **Indispensable** car le serveur n'a que 4 Go de RAM. Le Swap agit comme une RAM virtuelle sur le SSD pour éviter les plantages lors des pics de charge.

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
# Rendre le swap permanent après redémarrage :
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3.5 — Générer une clé JWT sécurisée

```bash
# Générer une clé aléatoire de 64 caractères (à garder précieusement)
openssl rand -base64 64
```

---

## 📁 Partie 4 — Déployer le Projet depuis GitHub

> Votre projet est sur GitHub — pas besoin de WinSCP ou de transfert manuel.

### 4.1 — Cloner le dépôt sur le VPS

```bash
cd ~
git clone https://github.com/emnaghorbel16/rzmedical.git
cd rzmedical
```

### 4.2 — Créer le fichier `.env.prod`

```bash
cp .env.example .env.prod
nano .env.prod
```

**Valeurs à renseigner :**

```env
# ─── Base de données ───────────────────────────────────────
POSTGRES_USER=postgres
POSTGRES_PASSWORD=MotDePasseTresSecurise2026!
POSTGRES_DB=rzmedical_db
DATABASE_URL=postgresql://postgres:MotDePasseTresSecurise2026!@db:5432/rzmedical_db?schema=public

# ─── JWT ───────────────────────────────────────────────────
JWT_SECRET=COLLER_LA_CLE_GENEREE_CI_DESSUS
JWT_EXPIRES_IN=8h

# ─── Email (Gmail App Password recommandé) ─────────────────
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=votre.email@gmail.com
EMAIL_PASS=xxxx_xxxx_xxxx_xxxx
EMAIL_FROM_NAME=RZMedical

# ─── URLs de production ────────────────────────────────────
FRONTEND_URL=https://randzmedical.com
NEXT_PUBLIC_SITE_URL=https://randzmedical.com
NEXT_PUBLIC_API_URL=https://api.randzmedical.com/api
CORS_ORIGIN=https://randzmedical.com,https://admin.randzmedical.com

# ─── Upload ────────────────────────────────────────────────
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=200

# ─── Admin par défaut ──────────────────────────────────────
ADMIN_EMAIL=admin@randzmedical.com
ADMIN_PASSWORD=MotDePasseAdmin2026!
```

> 💾 Pour quitter nano : `Ctrl+X` → `Y` → `Entrée`

> ⚠️ Ne committez jamais `.env.prod` dans Git. Il est déjà dans `.gitignore`.

### 4.3 — Lancer tous les services Docker

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Suivre les logs en direct :

```bash
docker compose -f docker-compose.prod.yml logs -f
```

### 4.4 — Appliquer les migrations Prisma

```bash
docker exec rzmedical_backend_prod npx prisma migrate deploy
```

### 4.5 — Créer le compte administrateur (seed — première fois uniquement)

> Cette étape crée le compte admin avec lequel vous vous connecterez à `https://admin.randzmedical.com`.

```bash
docker exec rzmedical_backend_prod npm run db:seed
```

Le script utilise les valeurs définies dans `.env.prod` :

| Variable | Valeur par défaut si non définie |
| :--- | :--- |
| `ADMIN_EMAIL` | `admin@randzmedical.com` |
| `ADMIN_PASSWORD` | `Admin@RZ2024!` |

Résultat attendu :

```
✅ Compte Admin créé avec succès !
   Email    : admin@randzmedical.com
   Password : VotreMotDePasse

⚠️  Changez ce mot de passe après votre première connexion.
```

> 💡 Le seed est **idempotent** — si le compte admin existe déjà, il affiche `✅ Admin déjà existant` sans créer de doublon. Vous pouvez le relancer sans risque.

### 4.6 — Vérifier que tous les conteneurs sont actifs

```bash
docker ps
```

Vous devez voir **4 conteneurs** avec le statut `Up` :

```
NAMES                    IMAGE          STATUS        PORTS
rzmedical_db_prod        postgres:16    Up healthy    127.0.0.1:5432->5432/tcp
rzmedical_backend_prod   node/express   Up            0.0.0.0:4000->4000/tcp
rzmedical_admin_prod     next.js        Up            0.0.0.0:3001->3000/tcp
rzmedical_web_prod       next.js        Up            0.0.0.0:3000->3000/tcp
```

---

## 🌐 Partie 5 — Configurer le Nom de Domaine

### 5.1 — Ajouter les enregistrements DNS

Dans **l'espace client OVH → Domaines → randzmedical.com → Zone DNS** :

| Type | Sous-domaine | Cible | TTL |
| :--- | :--- | :--- | :---: |
| A | `@` (racine) | `198.245.XXX.XXX` | 3600 |
| A | `www` | `198.245.XXX.XXX` | 3600 |
| A | `api` | `198.245.XXX.XXX` | 3600 |
| A | `admin` | `198.245.XXX.XXX` | 3600 |

> ⏱️ La propagation DNS prend **15 minutes à 24 heures**.  
> Vérifiez sur [whatsmydns.net](https://www.whatsmydns.net) avant de passer à l'étape suivante.

### 5.2 — Ouvrir les ports du pare-feu

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# NE PAS ouvrir 5432, 3000, 3001, 4000 — Nginx et Docker s'en chargent
sudo ufw enable
sudo ufw status verbose
```

---

## 🔐 Partie 6 — Configurer Nginx & HTTPS

### 6.1 — Créer la configuration Nginx

```bash
sudo nano /etc/nginx/sites-available/rzmedical
```

Coller cette configuration complète :

```nginx
# ─── Boutique client ─────────────────────────────────────────
server {
    listen 80;
    server_name randzmedical.com www.randzmedical.com;
    client_max_body_size 200M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }
}

# ─── Panneau d'administration ─────────────────────────────────
server {
    listen 80;
    server_name admin.randzmedical.com;
    client_max_body_size 200M;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }
}

# ─── API Backend ──────────────────────────────────────────────
server {
    listen 80;
    server_name api.randzmedical.com;
    client_max_body_size 200M;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

### 6.2 — Activer la configuration

```bash
sudo ln -s /etc/nginx/sites-available/rzmedical /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t           # Doit afficher : "syntax is ok"
sudo systemctl reload nginx
```

### 6.3 — Générer les certificats SSL HTTPS (Let's Encrypt — gratuit)

> ⚠️ Le DNS doit être **complètement propagé** avant cette étape. Vérifiez sur [whatsmydns.net](https://www.whatsmydns.net).

```bash
sudo certbot --nginx \
  -d randzmedical.com \
  -d www.randzmedical.com \
  -d admin.randzmedical.com \
  -d api.randzmedical.com
```

Certbot demande :
1. Votre adresse email (pour les alertes d'expiration)
2. Accepter les CGU → `Y`
3. Rediriger HTTP → HTTPS automatiquement → `2`

Le certificat SSL se **renouvelle automatiquement** tous les 90 jours via un cron systemd.

Vérifier le renouvellement automatique :

```bash
sudo certbot renew --dry-run
```

---

## ✅ Partie 7 — Vérification Finale

| Service | URL | Résultat attendu |
| :--- | :--- | :--- |
| Boutique | `https://randzmedical.com` | Page d'accueil |
| Admin | `https://admin.randzmedical.com` | Page de connexion |
| API (santé) | `https://api.randzmedical.com/` | Message de disponibilité |
| HTTPS | Cadenas vert sur tous | Certificat valide |

```bash
# Tests rapides depuis le VPS
curl -I https://randzmedical.com
curl -I https://admin.randzmedical.com
curl https://api.randzmedical.com/
```

> 🎉 **Après le premier déploiement réussi :**
> 1. Créer un **snapshot OVH** immédiatement (voir Partie 9 — Couche 3)
> 2. Lancer **manuellement le script de backup** pour tester
> 3. Configurer **UptimeRobot** pour la surveillance continue

---

## 🔄 Partie 8 — Mettre à Jour le Projet après un Push Git

### Workflow standard

```bash
cd ~/rzmedical

# 1. Créer un snapshot OVH AVANT (optionnel mais recommandé)
# 2. Récupérer les nouveaux commits
git pull origin main

# 3. Rebuilder et relancer les conteneurs
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# 4. Appliquer les migrations (si le schéma a changé)
docker exec rzmedical_backend_prod npx prisma migrate deploy

# 5. Vérifier les conteneurs
docker ps
```

### Mettre à jour une variable d'environnement

```bash
# Éditer .env.prod
nano ~/rzmedical/.env.prod

# Redémarrer uniquement le service concerné
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d backend
# ou pour le frontend :
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d web
```

---

## 💾 Partie 9 — Stratégie Complète de Backup (3 Couches)

> **Principe :** Les données critiques (base de données + fichiers uploadés) sont protégées par **3 couches indépendantes**. Si une couche échoue, les deux autres protègent toujours vos données.

```
┌────────────────────────────────────────────────────────┐
│           STRATÉGIE BACKUP RZ MEDICAL                  │
│                                                        │
│  COUCHE 1 (OVH Auto)     → Chaque jour   | 7 jours    │
│  COUCHE 2 (Cloudflare R2)→ Chaque nuit   | 30 jours   │
│  COUCHE 3 (OVH Snapshot) → Avant deploy  | 1 actif    │
└────────────────────────────────────────────────────────┘
```

### Couche 1 — Backup Automatique OVH *(Inclus dans l'abonnement)*

OVH sauvegarde automatiquement le serveur entier chaque jour.

**Configurer :**
1. Espace Client OVH → Bare Metal Cloud → VPS → Votre VPS
2. Onglet **« Backup »**
3. **Automated Backup** est déjà activé — vous avez **7 points de restauration** (7 derniers jours)

**Restaurer :**
1. Espace Client OVH → VPS → Backup
2. Choisir la date → **« Restaurer »**
3. Le serveur revient à l'état de cette date (~10–30 minutes, nécessite un redémarrage)

> [!IMPORTANT]
> Cette couche sauvegarde **tout le serveur** (OS + Docker + données). Réservez-la aux catastrophes majeures uniquement.

---

### Couche 2 — Backup Automatique Nightly vers Cloudflare R2

Sauvegarde ciblée : **base PostgreSQL + dossier `uploads/`** seulement.  
Stockée dans Cloudflare R2 : 0 € de frais de téléchargement, 10 Go gratuits.

#### Étape A — Créer un bucket Cloudflare R2

1. Aller sur [dash.cloudflare.com](https://dash.cloudflare.com)
2. Menu gauche → **R2 Object Storage**
3. **« Create bucket »** → Nom : `rzmedical-backups` → Région : Europe
4. **« Manage R2 API Tokens »** → **« Create API Token »**
5. Permissions : `Object Read & Write` sur le bucket `rzmedical-backups`
6. Copier et noter :
   - `Access Key ID`
   - `Secret Access Key`
   - `Endpoint URL` (ex. `https://XXXX.r2.cloudflarestorage.com`)

#### Étape B — Installer et configurer rclone sur le VPS

```bash
curl https://rclone.org/install.sh | sudo bash
rclone config
```

Répondre aux questions :

```
n  → New remote
name> cloudflare-r2
Storage> s3
provider> Cloudflare
access_key_id> VOTRE_ACCESS_KEY_ID
secret_access_key> VOTRE_SECRET_ACCESS_KEY
endpoint> https://XXXX.r2.cloudflarestorage.com
y  → Yes, save
q  → Quit
```

Tester la connexion :

```bash
rclone ls cloudflare-r2:rzmedical-backups
# Doit retourner une liste vide sans erreur
```

#### Étape C — Créer le script de backup

```bash
sudo nano /usr/local/bin/rzmedical-backup.sh
```

Coller ce script :

```bash
#!/bin/bash
# ============================================================
# Script de backup automatique RZ Medical → Cloudflare R2
# Exécuté chaque nuit à 3h00 via cron
# ============================================================

set -euo pipefail

DB_CONTAINER="rzmedical_db_prod"
DB_NAME="rzmedical_db"
DB_USER="postgres"
UPLOADS_DIR="/root/rzmedical/backend/uploads"
BACKUP_DIR="/root/backups"
R2_BUCKET="cloudflare-r2:rzmedical-backups"
RETENTION_DAYS=30
DATE=$(date +%Y-%m-%d_%H-%M)
LOG_FILE="/var/log/rzmedical-backup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========================================"
log "Debut du backup RZ Medical — $DATE"
log "========================================"

mkdir -p "$BACKUP_DIR"
BACKUP_PATH="$BACKUP_DIR/$DATE"
mkdir -p "$BACKUP_PATH"

# 1. Dump PostgreSQL
log "Dump de la base PostgreSQL..."
docker exec "$DB_CONTAINER" pg_dump \
    -U "$DB_USER" \
    -F c \
    -d "$DB_NAME" \
    > "$BACKUP_PATH/rzmedical_db_$DATE.dump"
log "Dump DB termine : $(du -sh "$BACKUP_PATH/rzmedical_db_$DATE.dump" | cut -f1)"

# 2. Archive du dossier uploads
log "Archive du dossier uploads..."
if [ -d "$UPLOADS_DIR" ]; then
    tar -czf "$BACKUP_PATH/uploads_$DATE.tar.gz" \
        -C "$(dirname "$UPLOADS_DIR")" \
        "$(basename "$UPLOADS_DIR")"
    log "Archive uploads terminee : $(du -sh "$BACKUP_PATH/uploads_$DATE.tar.gz" | cut -f1)"
else
    log "ATTENTION: Dossier uploads introuvable : $UPLOADS_DIR"
fi

# 3. Envoi vers Cloudflare R2
log "Envoi vers Cloudflare R2..."
rclone copy "$BACKUP_PATH" "$R2_BUCKET/$DATE/" \
    --stats-one-line 2>> "$LOG_FILE"
log "Envoi termine"

# 4. Nettoyage local (garder les 3 derniers jours)
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +3 -exec rm -rf {} + 2>/dev/null || true
log "Nettoyage local termine"

# 5. Nettoyage R2 (garder 30 jours)
rclone delete "$R2_BUCKET" --min-age "${RETENTION_DAYS}d" --rmdirs 2>> "$LOG_FILE" || true
log "Nettoyage R2 termine"

log "Backup complet termine avec succes — $DATE"
log "========================================\n"
```

Rendre le script exécutable et tester :

```bash
sudo chmod +x /usr/local/bin/rzmedical-backup.sh

# Test manuel
sudo /usr/local/bin/rzmedical-backup.sh

# Vérifier les logs
cat /var/log/rzmedical-backup.log
```

#### Étape D — Automatiser avec Cron (chaque nuit à 3h00)

```bash
sudo crontab -e
```

Ajouter à la fin du fichier :

```cron
0 3 * * * /usr/local/bin/rzmedical-backup.sh
```

#### Étape E — Vérifier sur Cloudflare R2

```bash
rclone ls cloudflare-r2:rzmedical-backups
rclone size cloudflare-r2:rzmedical-backups
```

#### Restaurer depuis Cloudflare R2

```bash
# 1. Télécharger le backup d'une date précise
rclone copy cloudflare-r2:rzmedical-backups/2026-09-25_03-00 /root/restore/

# 2. Restaurer la base de données
docker exec -i rzmedical_db_prod pg_restore \
    -U postgres \
    -d rzmedical_db \
    --clean \
    < /root/restore/rzmedical_db_2026-09-25_03-00.dump

# 3. Restaurer les fichiers uploads
tar -xzf /root/restore/uploads_2026-09-25_03-00.tar.gz \
    -C /root/rzmedical/backend/
```

---

### Couche 3 — Snapshot OVH Manuel *(Avant chaque déploiement majeur)*

> Le bouton « pause » avant une opération risquée.

**Créer un snapshot :**
1. Espace Client OVH → VPS → Votre VPS → onglet **« Snapshot »**
2. Cliquer **« Créer un snapshot »**
3. Le VPS est mis en pause 5–10 secondes pendant la capture
4. Le snapshot est prêt en 2–5 minutes

**Quand créer un snapshot :**

- Avant `git pull` + rebuild après une mise à jour majeure
- Avant une migration Prisma importante
- Avant de modifier la configuration Nginx ou le `.env.prod`

**Restaurer :**
1. OVH → VPS → Snapshot → **« Restaurer »**
2. Le serveur revient à l'état exact du snapshot (~10 minutes)

> [!NOTE]
> Avec votre abonnement, vous avez droit à **1 snapshot actif** à la fois. Créez-en un nouveau avant chaque déploiement (il remplace le précédent).

---

### Tableau Récapitulatif des 3 Couches

| | Couche 1 — OVH Auto | Couche 2 — R2 Nightly | Couche 3 — Snapshot |
| :--- | :--- | :--- | :--- |
| **Fréquence** | Quotidienne (auto) | Chaque nuit 3h (auto) | Manuelle |
| **Rétention** | 7 jours | 30 jours | 1 (le dernier) |
| **Périmètre** | Serveur entier | DB + Uploads seulement | Serveur entier |
| **Temps de restauration** | 10–30 min (reboot VPS) | 5–10 min (ciblée) | ~10 min (reboot VPS) |
| **Coût** | Inclus dans l'abonnement | Gratuit (< 10 Go) | Inclus dans l'abonnement |
| **Usage typique** | Catastrophe totale | Récupération de données | Avant déploiement |

---

## 🛡️ Partie 10 — Sécurité du Serveur

### 10.1 — Authentification par clé SSH

> [!CAUTION]
> Effectuez cette étape **après** avoir configuré et testé votre connexion par clé SSH. Sinon vous serez définitivement bloqué hors du serveur.

**Sur votre PC Windows — générer une clé SSH :**

```powershell
ssh-keygen -t ed25519 -C "rzmedical-vps-ovh"
# Clé publique générée dans : C:\Users\dell\.ssh\id_ed25519.pub
```

**Copier la clé publique sur le VPS :**

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh ubuntu@198.245.XXX.XXX "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

**Tester la connexion par clé (depuis un nouveau terminal) :**

```powershell
ssh ubuntu@198.245.XXX.XXX
# Doit se connecter SANS demander de mot de passe
```

**Désactiver l'authentification par mot de passe :**

```bash
# Sur le VPS
sudo nano /etc/ssh/sshd_config
```

Modifier ou vérifier ces lignes :

```
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
```

```bash
sudo systemctl restart ssh
```

---

### 10.2 — Pare-feu UFW

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
# NE PAS ouvrir 5432, 3000, 3001, 4000 — Nginx et Docker les gèrent
sudo ufw enable
sudo ufw status verbose
```

---

### 10.3 — Fail2Ban (Protection contre la force brute SSH)

```bash
sudo apt install fail2ban -y
sudo nano /etc/fail2ban/jail.local
```

Coller :

```ini
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5
destemail = votre.email@gmail.com

[sshd]
enabled  = true
port     = ssh
logpath  = %(sshd_log)s
backend  = %(sshd_backend)s
maxretry = 3
```

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
sudo fail2ban-client status sshd
```

---

### 10.4 — Protéger PostgreSQL (Ne jamais exposer à Internet)

> [!WARNING]
> Par défaut, Docker peut contourner UFW. Assurez-vous que PostgreSQL n'est accessible que depuis le réseau interne Docker.

Dans `docker-compose.prod.yml`, le port DB doit être bindé sur `127.0.0.1` :

```yaml
db:
  ports:
    - "127.0.0.1:5432:5432"   # ✅ CORRECT — accessible localement uniquement
    # - "0.0.0.0:5432:5432"   # ❌ DANGEREUX — exposé à Internet
```

Vérifier :

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
# PostgreSQL doit afficher : 127.0.0.1:5432->5432/tcp
```

---

### 10.5 — Mises à Jour de Sécurité Automatiques

```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
# Répondre « Oui »
```

---

### 10.6 — Monitoring avec UptimeRobot (Gratuit)

1. Créer un compte sur [uptimerobot.com](https://uptimerobot.com)
2. **« Add New Monitor »** → Type : **HTTP(s)**
3. URL : `https://api.randzmedical.com/`
4. Intervalle : **5 minutes**
5. Contacts d'alerte : votre email + Telegram/WhatsApp

Vous serez alerté immédiatement si le site devient inaccessible.

---

### ✅ Checklist Sécurité Complète

```
[ ] Clé SSH configurée — authentification par mot de passe DÉSACTIVÉE
[ ] UFW activé (ports 22, 80, 443 uniquement)
[ ] Fail2Ban installé et actif (sshd surveillé)
[ ] PostgreSQL bind sur 127.0.0.1 (pas exposé à Internet)
[ ] Variables sensibles dans .env.prod (jamais dans le code ou Git)
[ ] JWT_SECRET aléatoire (64 caractères minimum)
[ ] ADMIN_PASSWORD changé après le premier déploiement
[ ] Certificat SSL HTTPS actif (Let's Encrypt — renouvellement auto)
[ ] Backup OVH Auto activé (7 jours) — inclus dans l'abonnement
[ ] Script Cloudflare R2 actif et testé (30 jours)
[ ] Snapshot OVH créé après le premier déploiement réussi
[ ] Monitoring UptimeRobot configuré
[ ] Mises à jour automatiques activées (unattended-upgrades)
```

---

## 🔧 Partie 11 — Commandes de Maintenance

```bash
# ─── Voir l'état des conteneurs ────────────────────────────
docker ps
docker compose -f docker-compose.prod.yml ps

# ─── Voir les logs en temps réel ───────────────────────────
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs backend -f
docker compose -f docker-compose.prod.yml logs web -f

# ─── Redémarrer un service ──────────────────────────────────
docker restart rzmedical_backend_prod
docker restart rzmedical_web_prod
docker restart rzmedical_admin_prod

# ─── Backup manuel immédiat ────────────────────────────────
sudo /usr/local/bin/rzmedical-backup.sh
tail -f /var/log/rzmedical-backup.log

# ─── Vérifier l'espace disque ──────────────────────────────
df -h
du -sh ~/rzmedical/backend/uploads
rclone size cloudflare-r2:rzmedical-backups

# ─── Nettoyer les images Docker (si disque plein) ──────────
docker system prune -a

# ─── Renouveler manuellement le certificat SSL ─────────────
sudo certbot renew

# ─── Voir les IPs bannies par Fail2Ban ─────────────────────
sudo fail2ban-client status sshd

# ─── Recharger Nginx après modification config ─────────────
sudo nginx -t && sudo systemctl reload nginx
```

---

## 🚨 Partie 12 — Résolution des Problèmes Courants

| ❌ Problème | ✅ Solution |
| :--- | :--- |
| Conteneur ne démarre pas | `docker logs rzmedical_backend_prod` |
| Page inaccessible (502 Bad Gateway) | `sudo nginx -t` puis `docker ps` |
| DNS ne se propage pas | Attendre 30 min, vérifier sur [whatsmydns.net](https://www.whatsmydns.net) |
| Certificat SSL échoue (`certbot`) | Le DNS doit d'abord pointer vers l'IP du VPS |
| Migration DB échoue | Vérifier que le conteneur `db` est en statut `healthy` |
| `git pull` demande un mot de passe | Utiliser un Personal Access Token GitHub ou SSH |
| Backup échoue | `cat /var/log/rzmedical-backup.log` |
| Disque plein | `docker system prune -a` puis `df -h` |
| Connexion SSH refusée | Vérifier votre clé SSH et que l'IP n'est pas bannie par Fail2Ban |
| Erreur Prisma "engine not found" | `docker exec rzmedical_backend_prod npx prisma generate` |
| Variable d'env non prise en compte | Redémarrer le conteneur concerné après édition de `.env.prod` |
| PostgreSQL inaccessible depuis le backend | Vérifier que `DATABASE_URL` utilise le nom de service `db` (pas `localhost`) |

---

## 📞 Résumé des URLs Finales

| Service | URL |
| :--- | :--- |
| **Boutique client** | `https://randzmedical.com` |
| **Panneau d'administration** | `https://admin.randzmedical.com` |
| **API Backend** | `https://api.randzmedical.com` |
| **Dépôt GitHub** | `https://github.com/emnaghorbel16/rzmedical` |

---

*Guide officiel d'hébergement RZMedical sur OVH VPS — Mis à jour en septembre 2026.*
