"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartItem } from "@/lib/types";
import { discountedPrice } from "@/lib/format";

const CART_KEY = "rz_cart";

export type AddItemInput = Omit<CartItem, "quantite">;

interface CartContextValue {
  items: CartItem[];
  ready: boolean;
  count: number; // somme des quantités
  distinctCount: number; // nombre de lignes distinctes
  subtotal: number; // Σ (prix remisé produit × quantité) — hors remise client
  isEmpty: boolean;
  bumpKey: number; // s'incrémente à chaque ajout (anim. du badge)
  isOpen: boolean;
  addItem: (item: AddItemInput, qty?: number) => void;
  removeItem: (produitId: number) => void;
  setQuantity: (produitId: number, qty: number) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/** Borne la quantité entre 1 et le stock (si connu). */
function clampQty(qty: number, _stock: number): number {
  return Math.max(1, Math.floor(qty));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [bumpKey, setBumpKey] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // Hydratation
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed as CartItem[]);
      }
    } catch {
      /* panier illisible : on repart vide */
    }
    setReady(true);
  }, []);

  // Persistance (après hydratation, pour ne pas écraser le stockage au 1er rendu)
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, ready]);

  const addItem = useCallback((item: AddItemInput, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.produitId === item.produitId);
      if (idx >= 0) {
        const existing = prev[idx];
        const next = [...prev];
        // On rafraîchit l'instantané produit (prix/stock/dispo) + cumule la quantité
        next[idx] = {
          ...existing,
          ...item,
          quantite: clampQty(existing.quantite + qty, item.stock),
        };
        return next;
      }
      return [...prev, { ...item, quantite: clampQty(qty, item.stock) }];
    });
    setBumpKey((k) => k + 1);
  }, []);

  const removeItem = useCallback((produitId: number) => {
    setItems((prev) => prev.filter((i) => i.produitId !== produitId));
  }, []);

  const setQuantity = useCallback((produitId: number, qty: number) => {
    setItems((prev) => {
      if (qty <= 0) return prev.filter((i) => i.produitId !== produitId);
      return prev.map((i) =>
        i.produitId === produitId ? { ...i, quantite: clampQty(qty, i.stock) } : i,
      );
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen((v) => !v), []);

  const { count, subtotal } = useMemo(() => {
    let count = 0;
    let subtotal = 0;
    for (const i of items) {
      count += i.quantite;
      const dpHT = discountedPrice(i.prix, i.remise);
      const dpTTC = dpHT * (1 + (i.tva ?? 0) / 100);
      subtotal += dpTTC * i.quantite;
    }
    return { count, subtotal: Math.round(subtotal * 100) / 100 };
  }, [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      ready,
      count,
      distinctCount: items.length,
      subtotal,
      isEmpty: items.length === 0,
      bumpKey,
      isOpen,
      addItem,
      removeItem,
      setQuantity,
      clear,
      openCart,
      closeCart,
      toggleCart,
    }),
    [
      items,
      ready,
      count,
      subtotal,
      bumpKey,
      isOpen,
      addItem,
      removeItem,
      setQuantity,
      clear,
      openCart,
      closeCart,
      toggleCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart doit être utilisé dans <CartProvider>");
  return ctx;
}
