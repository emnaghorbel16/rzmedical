"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getApiUrl, parseJsonSafe } from "@/utils/api";

export interface Exercice {
  id: number;
  annee: number;
  label: string;
  dateDebut: string;
  dateFin: string;
  isActif: boolean;
  creeLe?: string;
  misAJourLe?: string;
}

interface ExerciceContextType {
  exercices: Exercice[];
  activeExercice: Exercice | null; // null means "Tous les exercices"
  isAllSelected: boolean;
  loading: boolean;
  selectExercice: (exercice: Exercice | null) => void;
  refreshExercices: () => Promise<void>;
  activateExerciceOnBackend: (id: number, token?: string) => Promise<boolean>;
}

const ExerciceContext = createContext<ExerciceContextType | undefined>(undefined);

const STORAGE_KEY = "rz_selected_exercice_annee";

export const ExerciceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [activeExercice, setActiveExercice] = useState<Exercice | null>(null);
  const [isAllSelected, setIsAllSelected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchExercices = useCallback(async () => {
    try {
      const apiUrl = getApiUrl();
      const token = typeof window !== "undefined" ? (localStorage.getItem("rzm_token") || localStorage.getItem("token")) : null;
      
      const res = await fetch(`${apiUrl}/exercices`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const list = await parseJsonSafe<Exercice[]>(res);
      if (!Array.isArray(list)) {
        setLoading(false);
        return;
      }
      setExercices(list);

      // Check saved selection in localStorage
      const savedAnneeStr = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

      if (savedAnneeStr === "ALL") {
        setIsAllSelected(true);
        setActiveExercice(null);
      } else if (savedAnneeStr) {
        const parsedYear = parseInt(savedAnneeStr, 10);
        const match = list.find((e) => e.annee === parsedYear);
        if (match) {
          setActiveExercice(match);
          setIsAllSelected(false);
        } else {
          // Default to the one marked isActif: true
          const def = list.find((e) => e.isActif) || list[0] || null;
          setActiveExercice(def);
          setIsAllSelected(false);
          if (def) localStorage.setItem(STORAGE_KEY, def.annee.toString());
        }
      } else {
        // Default to isActif or latest
        const def = list.find((e) => e.isActif) || list[0] || null;
        setActiveExercice(def);
        setIsAllSelected(false);
        if (def) localStorage.setItem(STORAGE_KEY, def.annee.toString());
      }
    } catch (err) {
      console.error("ExerciceContext: fetch error", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExercices();
  }, [fetchExercices]);

  const selectExercice = (ex: Exercice | null) => {
    if (ex === null) {
      setIsAllSelected(true);
      setActiveExercice(null);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, "ALL");
      }
    } else {
      setIsAllSelected(false);
      setActiveExercice(ex);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, ex.annee.toString());
      }
    }
  };

  const activateExerciceOnBackend = async (id: number, token?: string): Promise<boolean> => {
    try {
      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/exercices/${id}/activer`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const d = await parseJsonSafe(res).catch(() => ({}));
        throw new Error(d.error || "Erreur lors de l'activation");
      }
      await fetchExercices();
      return true;
    } catch (err: any) {
      console.error("activateExercice error:", err);
      alert(err.message || "Erreur lors de l'activation de l'exercice");
      return false;
    }
  };

  return (
    <ExerciceContext.Provider
      value={{
        exercices,
        activeExercice,
        isAllSelected,
        loading,
        selectExercice,
        refreshExercices: fetchExercices,
        activateExerciceOnBackend,
      }}
    >
      {children}
    </ExerciceContext.Provider>
  );
};

export const useExercice = (): ExerciceContextType => {
  const context = useContext(ExerciceContext);
  if (!context) {
    throw new Error("useExercice must be used within an ExerciceProvider");
  }
  return context;
};
