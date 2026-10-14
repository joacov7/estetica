import { describe, it, expect } from "vitest";
import { normalizeWhatsappPhone, waLink, fillTemplate } from "./whatsapp";

describe("normalizeWhatsappPhone", () => {
  it("prepends the country code when missing", () => {
    expect(normalizeWhatsappPhone("3444 123456", "549")).toBe("5493444123456");
  });
  it("keeps the number when it already starts with the country code", () => {
    expect(normalizeWhatsappPhone("5493444123456", "549")).toBe("5493444123456");
  });
  it("strips leading zeros and non-digits", () => {
    expect(normalizeWhatsappPhone("0 (3444) 12-3456", "549")).toBe("5493444123456");
  });
  it("returns null for empty or too-short numbers", () => {
    expect(normalizeWhatsappPhone("", "549")).toBeNull();
    expect(normalizeWhatsappPhone("12", "")).toBeNull();
  });
});

describe("waLink", () => {
  it("builds a wa.me link with URL-encoded text", () => {
    expect(waLink("3444123456", "Hola {x}", "549")).toBe(
      "https://wa.me/5493444123456?text=Hola%20%7Bx%7D",
    );
  });
  it("returns null when the phone is unusable", () => {
    expect(waLink("", "hola", "549")).toBeNull();
  });
});

describe("fillTemplate", () => {
  it("replaces {nombre} with the first name (case-insensitive)", () => {
    expect(fillTemplate("Hola {nombre}!", "Mery Pérez")).toBe("Hola Mery!");
    expect(fillTemplate("Hola {NOMBRE}", "Ana")).toBe("Hola Ana");
  });
  it("leaves text without placeholders unchanged", () => {
    expect(fillTemplate("Hola!", "Ana")).toBe("Hola!");
  });
});
