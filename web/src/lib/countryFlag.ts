/**
 * countryFlag.ts
 * Convertit un nom de pays (français ou anglais) en emoji drapeau.
 */

const COUNTRY_MAP: Record<string, string> = {
  allemagne: "DE", germany: "DE",
  algerie: "DZ", "algérie": "DZ",
  argentine: "AR", argentina: "AR",
  australie: "AU", australia: "AU",
  autriche: "AT", austria: "AT",
  belgique: "BE", belgium: "BE",
  bresil: "BR", "brésil": "BR", brazil: "BR",
  canada: "CA",
  chili: "CL", chile: "CL",
  chine: "CN", china: "CN",
  "corée du sud": "KR", "south korea": "KR",
  danemark: "DK", denmark: "DK",
  espagne: "ES", spain: "ES",
  "émirats arabes unis": "AE", "emirats arabes unis": "AE", "united arab emirates": "AE", uae: "AE",
  france: "FR",
  "grèce": "GR", grece: "GR", greece: "GR",
  hongrie: "HU", hungary: "HU",
  inde: "IN", india: "IN",
  "indonésie": "ID", indonesie: "ID", indonesia: "ID",
  iran: "IR",
  irlande: "IE", ireland: "IE",
  "israël": "IL", israel: "IL",
  italie: "IT", italy: "IT",
  japon: "JP", japan: "JP",
  liban: "LB", lebanon: "LB",
  maroc: "MA", morocco: "MA",
  mexique: "MX", mexico: "MX",
  "pays-bas": "NL", netherlands: "NL", hollande: "NL",
  pologne: "PL", poland: "PL",
  portugal: "PT",
  roumanie: "RO", romania: "RO",
  russie: "RU", russia: "RU",
  "sénégal": "SN", senegal: "SN",
  "suède": "SE", suede: "SE", sweden: "SE",
  suisse: "CH", switzerland: "CH",
  tunisie: "TN", tunisia: "TN",
  turquie: "TR", turkey: "TR",
  ukraine: "UA",
  "royaume-uni": "GB", "united kingdom": "GB", uk: "GB",
  "états-unis": "US", "etats-unis": "US", usa: "US", "united states": "US",
};

export function getCountryFlag(countryName: string | null | undefined): string | null {
  if (!countryName) return null;
  const key = countryName.trim().toLowerCase();
  const code = COUNTRY_MAP[key];
  if (!code) return null;
  return [...code].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
}

export function getCountryCode(countryName: string | null | undefined): string | null {
  if (!countryName) return null;
  return COUNTRY_MAP[countryName.trim().toLowerCase()] ?? null;
}
