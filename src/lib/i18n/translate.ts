// The translate function and its types. No React here, so the domain rules, the services
// and the unit tests can use it.
import { de } from "./de";
import { en } from "./en";

export type Language = "en" | "de";
export type Dictionary = typeof en; // a missing or misspelled German key does not compile
export type MessageKey = keyof Dictionary;
export type Params = Record<string, string | number>;

// What the pure rules return instead of a sentence: the UI turns it into text.
export interface Message {
  key: MessageKey;
  params?: Params;
}

export type Translate = (key: MessageKey, params?: Params) => string;

const DICTIONARIES: Record<Language, Dictionary> = { en, de };

// {name} is replaced by params.name. An unknown key or placeholder is shown as it is, so a
// mistake is visible on the screen instead of an empty text.
export function translate(language: Language, key: MessageKey, params: Params = {}): string {
  const entry: string | { one: string; other: string } | undefined = DICTIONARIES[language][key];
  if (entry === undefined) return key;
  const text = typeof entry === "string" ? entry : params.count === 1 ? entry.one : entry.other;
  return text.replace(/\{(\w+)\}/g, (placeholder, name) => (params[name] === undefined ? placeholder : String(params[name])));
}

export function translator(language: Language): Translate {
  return (key, params) => translate(language, key, params);
}

// An error whose text the UI translates. Its own message is English, for logs and scripts.
export class UserError extends Error {
  readonly key: MessageKey;
  readonly params?: Params;

  constructor({ key, params }: Message) {
    super(translate("en", key, params));
    this.name = "UserError";
    this.key = key;
    this.params = params;
  }
}
