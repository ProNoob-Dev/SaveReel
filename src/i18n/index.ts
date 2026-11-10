import { DEFAULT_LOCALE } from "../config";
import { ar } from "./ar";
import { de } from "./de";
import { en, type Dictionary } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { hi } from "./hi";
import { id } from "./id";
import { it } from "./it";
import { ja } from "./ja";
import { ko } from "./ko";
import { pt } from "./pt";

const dictionaries: Record<string, Dictionary> = { ar, de, en, es, fr, hi, id, it, ja, ko, pt };

/** Falls back to English for any locale we have not shipped yet. */
export function getDictionary(locale: string): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE] ?? en;
}

/** A locale is "real" only when it has a dictionary and is enabled in LOCALES. */
export function isLocaleReady(locale: string): boolean {
  return Object.hasOwn(dictionaries, locale);
}
