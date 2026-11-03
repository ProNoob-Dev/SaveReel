import { DEFAULT_LOCALE } from "../config";
import { en, type Dictionary } from "./en";

const dictionaries: Record<string, Dictionary> = { en };

/** Falls back to English for any locale we have not shipped yet. */
export function getDictionary(locale: string): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE] ?? en;
}

/** A locale is "real" only when it has a dictionary and is enabled in LOCALES. */
export function isLocaleReady(locale: string): boolean {
  return Object.hasOwn(dictionaries, locale);
}
