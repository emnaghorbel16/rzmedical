import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './auth.service';

export interface AuthRequest extends Request {
  user?: { id: number; email: string; type: string };
}

function decode(req: AuthRequest, res: Response): { id: number; email: string; type: string } | null {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentification requise' });
    return null;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string; type: string };
    req.user = decoded;
    return decoded;
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré. Veuillez vous reconnecter.' });
    return null;
  }
}

// Routes d'administration. Historiquement, seuls les administrateurs possédaient un
// jeton (le login admin rejette les non-admins), donc toute route protégée par
// requireAuth est une route d'admin. On conserve explicitement cette garantie afin
// qu'un jeton CLIENT — désormais émis côté boutique — ne puisse pas y accéder.
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const decoded = decode(req, res);
  if (!decoded) return;
  if (decoded.type !== 'ADMIN') {
    return res.status(403).json({ error: "Accès réservé à l'administration" });
  }
  next();
}

// Authentifie un client de la boutique (jeton de type CLIENT).
export function requireClient(req: AuthRequest, res: Response, next: NextFunction) {
  const decoded = decode(req, res);
  if (!decoded) return;
  if (decoded.type !== 'CLIENT') {
    return res.status(403).json({ error: 'Accès réservé aux clients' });
  }
  next();
}

// Authentification optionnelle (attache req.user si jeton valide, sinon continue en invité)
export function optionalClient(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string; type: string };
      if (decoded.type === 'CLIENT') {
        req.user = decoded;
      }
    } catch {
      // Ignorer si invalide/expiré, l'utilisateur sera traité comme invité
    }
  }
  next();
}

