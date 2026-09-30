/**
 * countryFlag.ts
 * Convertit un nom de pays (français ou anglais) en emoji drapeau.
 */
import * as countries from "i18n-iso-countries";
import frLocale from "i18n-iso-countries/langs/fr.json";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(frLocale);
countries.registerLocale(enLocale);

export function getCountryFlag(countryName: string | null | undefined): string | null {
  if (!countryName) return null;
  
  let code = countries.getAlpha2Code(countryName, "fr");
  if (!code) code = countries.getAlpha2Code(countryName, "en");

  if (!code) return null;
  
  return [...code].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
}

export function getCountryCode(countryName: string | null | undefined): string | null {
  if (!countryName) return null;
  let code = countries.getAlpha2Code(countryName, "fr");
  if (!code) code = countries.getAlpha2Code(countryName, "en");
  return code ? code : null;
}
