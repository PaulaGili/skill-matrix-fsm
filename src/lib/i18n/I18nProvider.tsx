"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { setLanguage as setUi5Language } from "@ui5/webcomponents-base/dist/config/Language.js";
import { translator, type Language, type Translate } from "./translate";

const STORAGE_KEY = "language";

// The language chosen during this visit. It also works when the browser blocks storage.
let chosen: Language | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The stored choice, or German when the browser language is German, otherwise English.
function currentLanguage(): Language {
  if (chosen) return chosen;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "de") return stored;
  } catch {}
  return navigator.language.toLowerCase().startsWith("de") ? "de" : "en";
}

function chooseLanguage(language: Language) {
  chosen = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {}
  listeners.forEach((listener) => listener());
}

interface I18n {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translate;
}

const I18nContext = createContext<I18n>({ language: "en", setLanguage: chooseLanguage, t: translator("en") });

export function I18nProvider({ children }: { children: ReactNode }) {
  // The pages are prerendered in English. The third argument makes the first browser render
  // English too, so it matches the HTML, and React switches to the real language right after.
  const language = useSyncExternalStore<Language>(subscribe, currentLanguage, () => "en");
  const value = useMemo(() => ({ language, setLanguage: chooseLanguage, t: translator(language) }), [language]);

  // The page language and the built-in texts of the UI5 components (calendar, tooltips) follow.
  useEffect(() => {
    document.documentElement.lang = language;
    setUi5Language(language);
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
