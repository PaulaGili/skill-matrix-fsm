import { describe, expect, it } from "vitest";
import { de } from "@/lib/i18n/de";
import { en } from "@/lib/i18n/en";
import { translate, type MessageKey } from "@/lib/i18n/translate";

describe("translate", () => {
  it("returns the text of the language", () => {
    expect(translate("en", "action.save")).toBe("Save");
    expect(translate("de", "action.save")).toBe("Speichern");
  });

  it("fills the placeholders", () => {
    expect(translate("en", "hint.until", { date: "29.11.2026" })).toBe("until 29.11.2026");
    expect(translate("de", "hint.until", { date: "29.11.2026" })).toBe("bis 29.11.2026");
    expect(translate("de", "expiry.editLabel", { skill: "Welding", person: "Bieri, Marco" })).toBe("Welding von Bieri, Marco bearbeiten");
  });

  it("chooses singular or plural by the count", () => {
    expect(translate("en", "count.assignments", { count: 1 })).toBe("1 assignment");
    expect(translate("en", "count.assignments", { count: 0 })).toBe("0 assignments");
    expect(translate("de", "count.certificates", { count: 1 })).toBe("1 Zertifikat");
    expect(translate("de", "count.certificates", { count: 3 })).toBe("3 Zertifikate");
  });

  it("shows an unknown key and a missing value as they are", () => {
    expect(translate("de", "no.such.key" as MessageKey)).toBe("no.such.key");
    expect(translate("en", "hint.until")).toBe("until {date}");
  });
});

describe("dictionaries", () => {
  it("have the same keys", () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });

  it("use the same placeholders and the same plural forms", () => {
    const shape = (entry: string | { one: string; other: string }) => {
      const texts = typeof entry === "string" ? [entry] : [entry.one, entry.other];
      return texts.map((text) => (text.match(/\{\w+\}/g) ?? []).sort());
    };
    for (const key of Object.keys(en) as MessageKey[]) {
      // German drops {what} here: the sentence names the object by its name only.
      if (key === "error.notOwnName") continue;
      expect(shape(de[key]), key).toEqual(shape(en[key]));
    }
  });

  it("write German without the sharp s", () => {
    expect(JSON.stringify(de)).not.toContain("\u00df");
  });
});
