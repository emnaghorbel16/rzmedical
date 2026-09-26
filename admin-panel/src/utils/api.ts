/**
 * Centralized API & Base URL helper with automatic host resolution for mobile / network devices.
 * Always ensures the returned URL ends with /api (admin always calls /api/...)
 */
export const getApiUrl = (): string => {
  const IS_SERVER = typeof window === "undefined";
  const envUrl = IS_SERVER
    ? (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api` : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000/api"))
    : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000/api");

  // Normalize: always ensure URL ends with /api (no double /api/api)
  const normalized = envUrl.replace(/\/api\/?$/, "").trimEnd() + "/api";

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      return normalized.replace("localhost", hostname).replace("127.0.0.1", hostname);
    }
  }
  return normalized.replace("localhost", "127.0.0.1");
};

export const getBaseUrl = (): string => {
  return getApiUrl().replace(/\/api\/?$/, "");
};

export const API_URL = getApiUrl();

export async function parseJsonSafe<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await res.json();
  }
  const text = await res.text();
  throw new Error(text.slice(0, 150) || `Erreur serveur (${res.status})`);
}

export const downloadInvoicePdf = async (factureId: number, numero?: string) => {
  const apiUrl = getApiUrl();
  const token = typeof window !== "undefined" ? localStorage.getItem("rzm_token") : null;
  const res = await fetch(`${apiUrl}/invoices/admin/${factureId}/pdf-download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Erreur lors de la génération du PDF");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `facture-${numero || factureId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const downloadDevisPdf = async (devisId: number, numero?: string) => {
  const apiUrl = getApiUrl();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${apiUrl}/devis/${devisId}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Erreur lors de la génération du PDF du devis");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `devis-${numero || devisId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const downloadBonCommandePdf = async (bcId: number, code?: string) => {
  const apiUrl = getApiUrl();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${apiUrl}/achats/bons-commande/${bcId}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Erreur lors de la génération du PDF du bon de commande");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bon-commande-${code || bcId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const downloadBonReceptionPdf = async (brId: number, code?: string) => {
  const apiUrl = getApiUrl();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${apiUrl}/achats/bons-reception/${brId}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Erreur lors de la génération du PDF du bon de réception");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bon-reception-${code || brId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const downloadFactureFournisseurPdf = async (ffId: number, numero?: string) => {
  const apiUrl = getApiUrl();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${apiUrl}/achats/factures/${ffId}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Erreur lors de la génération du PDF de la facture fournisseur");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `facture-fournisseur-${numero || ffId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const downloadBonSortiePdf = async (bonId: number, code?: string) => {
  const token = typeof window !== "undefined" ? (localStorage.getItem("token") || localStorage.getItem("rzm_token")) : null;
  const res = await fetch(`${getApiUrl()}/stock-commercial/bons-sortie/${bonId}/pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Erreur lors de la génération du PDF du bon de sortie");
  const url = window.URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `bon-sortie-${code || bonId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

/** Utility for exporting data to CSV compatible with Excel */
export const exportToCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const bom = "\uFEFF"; // UTF-8 BOM for Excel
  const escapeCell = (val: string | number) => {
    const s = String(val ?? "");
    if (s.includes(";") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csvContent = [
    headers.map(escapeCell).join(";"),
    ...rows.map((row) => row.map(escapeCell).join(";")),
  ].join("\r\n");

  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
