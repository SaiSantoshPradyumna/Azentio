import { cookies } from "next/headers";
import { dirFor, LOCALE_COOKIE, parseLocale, t, type Locale } from "./i18n";

export function currentLocale(): Locale {
  return parseLocale(cookies().get(LOCALE_COOKIE)?.value);
}

export function localeDir(locale: Locale = currentLocale()) {
  return dirFor(locale);
}

export function tr(key: string, locale: Locale = currentLocale()): string {
  return t(locale, key);
}
