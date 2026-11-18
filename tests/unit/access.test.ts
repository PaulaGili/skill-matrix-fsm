import { describe, expect, it, vi } from "vitest";
import { accessAllowed, closedInDemo, needsAccessCode } from "@/lib/access";
import { config } from "@/proxy";

// The proxy imports server code that refuses to load outside a server. Here only its matcher is read.
vi.mock("server-only", () => ({}));

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
    expect(accessAllowed(basic("anyone", "secreT"), "secret")).toBe(false);
  });

  it("accepts the code as the password, with any user name and with a colon in it", () => {
    expect(accessAllowed(basic("anyone", "secret"), "secret")).toBe(true);
    expect(accessAllowed(basic("", "a:b"), "a:b")).toBe(true);
    expect(accessAllowed(`Basic ${Buffer.from("x:Zürich").toString("base64")}`, "Zürich")).toBe(true);
  });
});

describe("needsAccessCode", () => {
  it("refuses a hosted copy on real FSM without a code, and nothing else", () => {
    expect(needsAccessCode({ hosted: true, demo: false, code: undefined })).toBe(true);
    expect(needsAccessCode({ hosted: true, demo: false, code: "secret" })).toBe(false);
    expect(needsAccessCode({ hosted: true, demo: true, code: undefined })).toBe(false);
    expect(needsAccessCode({ hosted: false, demo: false, code: undefined })).toBe(false);
  });
});

describe("closedInDemo", () => {
  it("closes the FSM proxy and the AI routes, and nothing else", () => {
    expect(closedInDemo("/api/fsm/data/v4/Attachment")).toBe(true);
    expect(closedInDemo("/api/ai/question")).toBe(true);
    expect(closedInDemo("/api/demo/skill/v1/tags")).toBe(false);
    expect(closedInDemo("/catalog")).toBe(false);
  });
});

describe("proxy matcher", () => {
  it("covers the pages, the FSM proxy and the AI routes, and leaves static files out", () => {
    const covered = (path: string) => new RegExp(`^${config.matcher}$`).test(path);
    expect(["/", "/catalog", "/api/fsm/skill/v2/tags", "/api/ai/question", "/api/health"].every(covered)).toBe(true);
    expect(covered("/_next/static/chunk.js")).toBe(false);
  });
});
