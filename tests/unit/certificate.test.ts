import { describe, expect, it } from "vitest";
import { MAX_CERTIFICATE_BYTES, checkCertificateFile } from "@/lib/domain/certificate";

describe("checkCertificateFile", () => {
  it("maps the extension to the FSM type", () => {
    expect(checkCertificateFile("a.pdf", 10)).toEqual({ ok: true, type: "PDF" });
    expect(checkCertificateFile("a.PNG", 10)).toEqual({ ok: true, type: "PNG" });
    expect(checkCertificateFile("a.jpg", 10)).toEqual({ ok: true, type: "JPEG" });
    expect(checkCertificateFile("a.jpeg", 10)).toEqual({ ok: true, type: "JPEG" });
  });

  it("rejects other types and names without an extension", () => {
    expect(checkCertificateFile("a.docx", 10).ok).toBe(false);
    expect(checkCertificateFile("pdf", 10).ok).toBe(false);
  });

  it("allows exactly 5 MB and rejects larger or empty files", () => {
    expect(checkCertificateFile("a.pdf", MAX_CERTIFICATE_BYTES).ok).toBe(true);
    expect(checkCertificateFile("a.pdf", MAX_CERTIFICATE_BYTES + 1).ok).toBe(false);
    expect(checkCertificateFile("a.pdf", 0).ok).toBe(false);
  });
});
