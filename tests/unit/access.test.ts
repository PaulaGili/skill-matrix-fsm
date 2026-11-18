import { describe, expect, it } from "vitest";
import { accessAllowed } from "@/lib/access";

const basic = (user: string, password: string) => `Basic ${btoa(`${user}:${password}`)}`;

describe("accessAllowed", () => {
  it("lets everything pass when no code is set", () => {
    expect(accessAllowed(null, undefined)).toBe(true);
    expect(accessAllowed(null, "")).toBe(true);
  });

  it("asks for the code when one is set", () => {
    expect(accessAllowed(null, "secret")).toBe(false);
    expect(accessAllowed("Bearer secret", "secret")).toBe(false);
    expect(accessAllowed(basic("anyone", "wrong"), "secret")).toBe(false);
    expect(accessAllowed("Basic not-base64!", "secret")).toBe(false);
  });

  it("accepts the code as the password, with any user name and with a colon in it", () => {
    expect(accessAllowed(basic("anyone", "secret"), "secret")).toBe(true);
    expect(accessAllowed(basic("", "a:b"), "a:b")).toBe(true);
  });
});
