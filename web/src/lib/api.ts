// Couche d'accès aux données — client REST vers le backend Express (port 4000).
//
// • Lectures catalogue/contenu : Server Components, mises en cache avec
//   revalidation temporisée (ISR). Voir REVALIDATE.
// • Auth & commandes : appelées côté client avec un jeton Bearer ; jamais mises
//   en cache (cache: 'no-store').
// • Les images arrivent en chemins racine "/uploads/..." → imageUrl() préfixe
//   l'URL du backend, sauf si le chemin est déjà absolu (http/https/data/blob).

import { cache } from "react";
import type {
  AuthResponse,
  BanniereSite,
  CategorieListItem,
  Commande,
  InfoSociete,
  MarqueListItem,
  PaginatedProducts,
  Produit,
  SiteContentPublic,
  SousCategorieListItem,
  Utilisateur,
} from "./types";

// Cette valeur doit rester identique au rendu serveur et navigateur pour
// éviter un décalage d'hydratation sur les images et la vidéo du catalogue.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || "http://127.0.0.1:4000";

// Fenêtres de revalidation (secondes)
const REVALIDATE = {
  catalog: 300, // produits, catégories, marques
  content: 60, // annonces & bannières (plus réactif)
} as const;

/** Construit l'URL absolue d'un visuel servi par le backend (/uploads/...). */
export function imageUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  ) {
    return path;
  }
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Erreur d'API porteuse du code HTTP (0 = échec réseau). */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface FetchOptions {
  method?: string;
  body?: string;
  token?: string | null;
  revalidate?: number; // si défini → next.revalidate ; sinon → no-store
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, token, revalidate, headers, signal } = options;

  const finalHeaders: Record<string, string> = { ...headers };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined && finalHeaders["Content-Type"] === undefined) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const init: RequestInit & { next?: { revalidate: number } } = {
    method,
    body,
    headers: finalHeaders,
    signal,
  };
  if (typeof revalidate === "number") {
    init.next = { revalidate };
  } else {
    init.cache = "no-store";
  }

  let res: Response;
  try {
    const IS_SERVER = typeof window === "undefined";
    const fetchBaseUrl = IS_SERVER ? (process.env.BACKEND_URL || API_URL) : API_URL;
    res = await fetch(`${fetchBaseUrl}${path}`, init);
  } catch (e) {
    throw new ApiError(
      "Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.",
      0,
    );
  }

  if (!res.ok) {
    let message = `Une erreur est survenue (${res.status}).`;
    try {
      const data = await res.json();
      if (data && typeof data.error === "string") message = data.error;
    } catch {
      /* réponse non-JSON : on garde le message générique */
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --- Filtres catalogue -------------------------------------------------------

export interface ProductFilters {
  categorieId?: number;
  sousCategorieId?: number;
  marqueId?: number;
  // Category/subcategory/brand by name (slug-resolved)
  category?: string;
  subcategory?: string;
  brand?: string;
  q?: string;
  promo?: boolean;
  disponible?: boolean;
  minPrix?: number;
  maxPrix?: number;
  sort?: "recent" | "prix-asc" | "prix-desc" | "nom" | "remise";
  filter?: "new" | "promo"; // raccourcis historiques
  // Pagination
  page?: number;
  limit?: number;
}

function buildQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// --- Lectures (Server Components, ISR) ---------------------------------------

/** Catégories visibles (avec sous-catégories légères) pour le menu et les filtres. */
export function getVisibleCategories(): Promise<CategorieListItem[]> {
  return apiFetch<CategorieListItem[]>("/api/categories/visible", {
    revalidate: REVALIDATE.catalog,
  });
}

/** Toutes les sous-catégories (avec catégorie parente). */
export function getSubcategories(): Promise<SousCategorieListItem[]> {
  return apiFetch<SousCategorieListItem[]>("/api/subcategories", {
    revalidate: REVALIDATE.catalog,
  });
}

/** Toutes les marques (avec catégorie parente). */
export function getBrands(): Promise<MarqueListItem[]> {
  return apiFetch<MarqueListItem[]>("/api/brands", {
    revalidate: REVALIDATE.catalog,
  });
}

/** Liste de produits filtrée/triée. Retourne un tableau ou PaginatedProducts si page est fourni. */
export function getProducts(filters: ProductFilters & { page?: number; limit?: number } = {}): Promise<Produit[] | PaginatedProducts> {
  const qs = buildQuery({
    filter: filters.filter,
    categorieId: filters.categorieId,
    sousCategorieId: filters.sousCategorieId,
    marqueId: filters.marqueId,
    category: filters.category,
    subcategory: filters.subcategory,
    brand: filters.brand,
    q: filters.q,
    promo: filters.promo,
    disponible: filters.disponible,
    minPrix: filters.minPrix,
    maxPrix: filters.maxPrix,
    sort: filters.sort,
    page: filters.page,
    limit: filters.limit,
  });
  return apiFetch<Produit[] | PaginatedProducts>(`/api/products${qs}`, {
    revalidate: REVALIDATE.catalog,
  });
}

/** Produits paginés pour une catégorie (toujours PaginatedProducts). */
export async function getPagedProducts(
  filters: ProductFilters & { page: number; limit?: number },
): Promise<PaginatedProducts> {
  const result = await getProducts({ ...filters, limit: filters.limit ?? 12 });
  if (Array.isArray(result)) {
    // Fallback si le backend renvoie un tableau (pas de pagination)
    return {
      products: result,
      currentPage: 1,
      totalPages: 1,
      totalProducts: result.length,
      pageSize: result.length,
    };
  }
  return result as PaginatedProducts;
}

/** Sous-catégories filtrées par catégorie. */
export function getSubcategoriesByCategory(categorieId: number): Promise<SousCategorieListItem[]> {
  return apiFetch<SousCategorieListItem[]>(`/api/subcategories?categorieId=${categorieId}`, {
    revalidate: REVALIDATE.catalog,
  });
}

/** Marques filtrées par catégorie. */
export function getBrandsByCategory(categorieId: number): Promise<MarqueListItem[]> {
  return apiFetch<MarqueListItem[]>(`/api/brands?categorieId=${categorieId}`, {
    revalidate: REVALIDATE.catalog,
  });
}

/** Derniers produits ajoutés. */
export function getNewProducts(limit = 12): Promise<Produit[]> {
  return apiFetch<Produit[]>(`/api/products/new?limit=${limit}`, {
    revalidate: REVALIDATE.catalog,
  });
}

/** Produits en promotion (remise > 0). */
export function getPromoProducts(): Promise<Produit[]> {
  return apiFetch<Produit[]>("/api/products/promo", {
    revalidate: REVALIDATE.catalog,
  });
}

/**
 * Recherche produits (overlay de recherche). Non mise en cache, annulable via
 * `signal` pour éviter les réponses obsolètes entre deux frappes.
 */
export function searchProducts(
  q: string,
  signal?: AbortSignal,
): Promise<Produit[]> {
  return apiFetch<Produit[]>(`/api/products${buildQuery({ q, sort: "recent" })}`, {
    signal,
  });
}

/**
 * Produit par référence. Mémoïsé par requête (React.cache) pour dédupliquer
 * l'appel entre la page et generateMetadata. Retourne null si introuvable (404).
 */
export const getProductByReference = cache(
  async (reference: string): Promise<Produit | null> => {
    try {
      return await apiFetch<Produit>(
        `/api/products/reference/${encodeURIComponent(reference)}`,
        { revalidate: REVALIDATE.catalog },
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },
);

/** Annonces + bannières actives (barre d'annonce & carrousel). */
export function getSiteContent(categoryId?: number): Promise<SiteContentPublic> {
  const url = categoryId ? `/api/site-content/public?categoryId=${categoryId}` : "/api/site-content/public";
  return apiFetch<SiteContentPublic>(url, {
    revalidate: REVALIDATE.content,
  });
}

// --- Authentification client (côté navigateur) -------------------------------

export interface RegisterInput {
  email: string;
  motDePasse: string;
  prenom: string;
  nom: string;
  telephone?: string;
  adresse?: string;
  matriculeFiscale: string;
  activiteCategoryId: number;
}

export interface LoginInput {
  email: string;
  motDePasse: string;
}

export interface UpdateProfileInput {
  prenom?: string;
  nom?: string;
  telephone?: string;
  adresse?: string;
  dateNaissance?: string | null;
  matriculeFiscale?: string;
  activite?: string;
  activiteCategoryId?: number;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

export function registerClient(input: RegisterInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/client-auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function loginClient(input: LoginInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/client-auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getMe(token: string): Promise<Utilisateur> {
  return apiFetch<Utilisateur>("/api/client-auth/me", { token });
}

export function updateMe(
  token: string,
  input: UpdateProfileInput,
): Promise<Utilisateur> {
  return apiFetch<Utilisateur>("/api/client-auth/me", {
    method: "PATCH",
    token,
    body: JSON.stringify(input),
  });
}



/** Envoie un lien de réinitialisation de mot de passe par email */
export function forgotPassword(email: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/api/client-auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/** Réinitialise le mot de passe avec le token reçu par email */
export function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/api/client-auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

// --- Commandes (côté navigateur) ---------------------------------------------

export interface OrderLineInput {
  produitId: number;
  quantite: number;
}

export function createOrder(
  token: string,
  lignes: OrderLineInput[],
): Promise<Commande> {
  return apiFetch<Commande>("/api/orders", {
    method: "POST",
    token,
    body: JSON.stringify({ lignes }),
  });
}

export function getMyOrders(token: string): Promise<Commande[]> {
  return apiFetch<Commande[]>("/api/orders", { token });
}

export function getMyInvoices(token: string): Promise<unknown[]> {
  return apiFetch<unknown[]>("/api/invoices/my", { token });
}

export async function downloadInvoicePdf(token: string, factureId: number, numero: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/invoices/client/${factureId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!res.ok) {
    let message = "Erreur lors du téléchargement de la facture.";
    try {
      const data = await res.json();
      if (data && data.error) message = data.error;
    } catch {}
    throw new Error(message);
  }
  
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `facture-${numero}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export function createSupportTicket(token: string | null, input: { sujet: string; message: string; nom?: string; email?: string; telephone?: string }) {
  return apiFetch("/api/support", { method: "POST", token, body: JSON.stringify(input) });
}

export function getMySupportTickets(token: string): Promise<unknown[]> {
  return apiFetch<unknown[]>("/api/support/my", { token });
}

export function addSupportMessage(token: string, ticketId: number, contenu: string) {
  return apiFetch(`/api/support/my/${ticketId}/messages`, {
    method: "POST",
    token,
    body: JSON.stringify({ contenu }),
  });
}

export function getOrder(token: string, id: number): Promise<Commande> {
  return apiFetch<Commande>(`/api/orders/${id}`, { token });
}

export const getCompanyInfo = cache(
  async (): Promise<InfoSociete> => {
    return apiFetch<InfoSociete>("/api/company-info", {
      revalidate: REVALIDATE.content,
    });
  }
);

// Ré-export pratique pour les composants bannière (typage direct).
export type { BanniereSite };
