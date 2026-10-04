import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import categoriesRoutes from './modules/categories/categories.routes';
import subcategoriesRoutes from './modules/subcategories/subcategories.routes';
import brandsRoutes from './modules/brands/brands.routes';
import productsRoutes from './modules/products/products.routes';
import uploadRoutes from './modules/upload/upload.routes';
import statsRoutes from './modules/stats/stats.routes';
import authRoutes from './modules/auth/auth.routes';
import clientsRoutes from './modules/clients/clients.routes';
import clientAuthRoutes from './modules/client-auth/client-auth.routes';
import ordersRoutes from './modules/orders/orders.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import inboxRoutes from './modules/inbox/inbox.routes';
import path from 'path';
import siteContentRoutes from './modules/site-content/site-content.routes';
import invoicesRoutes from './modules/invoices/invoices.routes';
import supportRoutes from './modules/support/support.routes';
import companyInfoRoutes from './modules/company-info/company-info.routes';
import newsletterRoutes from './modules/newsletter/newsletter.routes';
import bonsLivraisonRoutes from './modules/bons-livraison/bons-livraison.routes';
import servicesRoutes from './modules/services/services.routes';
import devisRoutes from './modules/devis/devis.routes';
import exercicesRoutes from './modules/exercices/exercices.routes';
import fournisseursRoutes from './modules/fournisseurs/fournisseurs.routes';
import tiersRoutes from './modules/tiers/tiers.routes';
import achatsRoutes from './modules/achats/achats.routes';
import stockRoutes from './modules/stock/stock.routes';
import stockCommercialRoutes from './modules/stock-commercial/stock-commercial.routes';
import groqStatsRoutes from './modules/groq-stats/groq-stats.routes';

const app = express();

// ─── Sécurité : Headers HTTP (CSP, XSS protection, Clickjacking, etc.) ───────
app.use(helmet({
  // Permet le chargement des images produit depuis le même domaine
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Content Security Policy désactivé car géré côté Next.js
  contentSecurityPolicy: false,
}));

// ─── Sécurité : Bloqueur explicite pour gcdigital.es ─────────────────────────
app.use((req, res, next) => {
  const host = req.get('host') || '';
  const origin = req.get('origin') || '';
  const referer = req.get('referer') || '';
  
  if (
    host.includes('gcdigital.es') ||
    origin.includes('gcdigital.es') ||
    referer.includes('gcdigital.es')
  ) {
    return res.status(403).json({ error: 'Accès interdit. Access denied.' });
  }
  next();
});

// ─── CORS : uniquement les domaines autorisés ──────────────────────────────────
const corsOriginEnv = process.env.CORS_ORIGIN || '';
const allowedOrigins = corsOriginEnv
  ? corsOriginEnv.split(',').map((o: string) => o.trim()).filter(Boolean)
  : [];

const corsOptions: cors.CorsOptions = allowedOrigins.length === 0
  // En développement (CORS_ORIGIN non défini) : autoriser tout avec un warning
  ? (() => {
      console.warn('[SECURITY] CORS_ORIGIN non défini — toutes les origines autorisées (dev uniquement)');
      return { origin: true, credentials: true };
    })()
  : {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Autoriser les requêtes sans origin (Nginx, curl, Postman, serveur-à-serveur)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`Origine CORS non autorisée: ${origin}`));
      },
      credentials: true,
    };

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// ─── Rate limiting global ─────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez dans 15 minutes.' },
  skip: (req) => req.path.startsWith('/uploads'), // Ne pas limiter les fichiers statiques
});
app.use('/api', globalLimiter);

// ─── Rate limiting strict pour les endpoints d'authentification ───────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives d\'authentification. Réessayez dans 15 minutes.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/verify-otp', authLimiter);
app.use('/api/client-auth/login', authLimiter);
app.use('/api/client-auth/register', authLimiter);
app.use('/api/client-auth/forgot-password', authLimiter);

// ─── Rate limiting sur le tracking public des commandes ──────────────────────
const trackLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  message: { error: 'Trop de requêtes de suivi. Réessayez dans 5 minutes.' },
});
app.use('/api/orders/public/track', trackLimiter);

// ─── Rate limiting sur le formulaire de contact ──────────────────────────────
const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10,
  message: { error: 'Trop de tickets envoyés. Réessayez dans 1 heure.' },
});
app.use('/api/support', supportLimiter);

// ─── Dossier d'uploads (fichiers statiques) ──────────────────────────────────
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(path.join(process.cwd(), uploadDir)));

app.use('/api/categories', categoriesRoutes);
app.use('/api/subcategories', subcategoriesRoutes);
app.use('/api/brands', brandsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/client-auth', clientAuthRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/site-content', siteContentRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/company-info', companyInfoRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/bons-livraison', bonsLivraisonRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/devis', devisRoutes);
app.use('/api/exercices', exercicesRoutes);
app.use('/api/fournisseurs', fournisseursRoutes);
app.use('/api/tiers', tiersRoutes);
app.use('/api/achats', achatsRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/stock-commercial', stockCommercialRoutes);
app.use('/api/groq-stats', groqStatsRoutes);

app.get('/', (_req, res) => {
  res.json({ message: 'API RZMedical' });
});

export default app;
