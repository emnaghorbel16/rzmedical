import React, { useEffect, useState } from "react";
import { getApiUrl } from "@/utils/api";
import Badge from "@/components/ui/badge/Badge";

const API_URL = getApiUrl();

interface Produit {
  id: number;
  nom: string;
  reference: string;
  stock: number;
  prix: number;
  misEnAvantSousCat: boolean;
}

export default function FeaturedProductsModal({ 
  subcategoryId, 
  subcategoryName,
  onClose 
}: { 
  subcategoryId: number; 
  subcategoryName: string;
  onClose: () => void;
}) {
  const [products, setProducts] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("rzm_token");
        const response = await fetch(`${API_URL}/products?sousCategorieId=${subcategoryId}&limit=1000`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          // L'API retourne soit un tableau direct, soit { products: [...] } s'il y a pagination
          const prods = Array.isArray(data) ? data : (data.products || []);
          setProducts(prods);
          setSelectedIds(prods.filter((p: Produit) => p.misEnAvantSousCat).map((p: Produit) => p.id));
        } else {
          setError("Impossible de charger les produits.");
        }
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    };
    load();
  }, [subcategoryId]);

  const toggleProduct = (id: number) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(pId => pId !== id);
      if (prev.length >= 10) return prev; // max 10
      return [...prev, id];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const token = localStorage.getItem("rzm_token");
      const res = await fetch(`${API_URL}/subcategories/${subcategoryId}/featured-products`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ productIds: selectedIds }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erreur lors de l'enregistrement");
      }
      onClose();
    } catch (e: any) {
      setSaveError(e.message);
    }
    setSaving(false);
  };

  const filteredProducts = products.filter(p => 
    !searchQuery.trim() || 
    p.nom.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.reference.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[60] overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-800 relative animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h4 className="text-lg font-bold text-gray-800 dark:text-white">Produits en avant</h4>
            <p className="text-sm text-gray-500">{subcategoryName}</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-10 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" /></div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-red-500">{error}</div>
          ) : (
            <>
              <div className="mb-4 flex justify-between items-center bg-brand-50 dark:bg-brand-900/20 p-3 rounded-lg">
                <span className="text-sm font-medium text-brand-800 dark:text-brand-300">
                  Produits sélectionnés : <strong className="text-lg">{selectedIds.length}</strong> / 10
                </span>
                {selectedIds.length >= 10 && (
                  <span className="text-xs text-amber-600 font-semibold bg-amber-100 px-2 py-1 rounded">Maximum atteint</span>
                )}
              </div>

              <input
                type="text"
                placeholder="Rechercher un produit..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full mb-4 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />

              {filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">Aucun produit trouvé</div>
              ) : (
                <div className="space-y-2">
                  {filteredProducts.map(p => {
                    const isSelected = selectedIds.includes(p.id);
                    const isDisabled = !isSelected && selectedIds.length >= 10;
                    return (
                      <div 
                        key={p.id} 
                        onClick={() => !isDisabled && toggleProduct(p.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected 
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/10" 
                            : isDisabled
                              ? "border-gray-100 dark:border-gray-800 opacity-50 cursor-not-allowed"
                              : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => {}} // handled by parent div click
                          className="rounded border-gray-300 text-brand-500 focus:ring-brand-500 w-4 h-4 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{p.nom}</p>
                          <p className="text-xs text-gray-500 truncate">Réf: {p.reference}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{p.prix} TND</p>
                          <Badge color={p.stock > 0 ? "success" : "error"} size="sm">{p.stock} en stock</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
          {saveError ? (
            <p className="text-xs text-red-500">{saveError}</p>
          ) : <div />}
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">Annuler</button>
            <button 
              onClick={handleSave} 
              disabled={saving || loading}
              className="px-4 py-2 bg-brand-500 text-white text-sm font-semibold rounded-lg hover:bg-brand-600 disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
