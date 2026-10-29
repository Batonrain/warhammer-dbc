import { describe, it, expect } from "vitest";
import {
  isLoyalist, isPsykerOrSkitarii, classifyWitness
} from "../../module/rules/icon-of-blasphemy.mjs";

const actor = (alignment, items = []) => ({ system: { alignment }, items });
const psykerTrait = { type: "trait", name: "Psyker / Псайкер" };
const skitarii = (installed = true, disabled = false) => ({
  type: "implant", name: "Skitarii War Plate / Боевые Латы Скитарии",
  flags: { "warhammer-dbc": { installed, disabled } }
});

describe("isLoyalist", () => {
  it("alignment loyalist — true", () => expect(isLoyalist(actor("loyalist"))).toBe(true));
  it("alignment heretic — false", () => expect(isLoyalist(actor("heretic"))).toBe(false));
  it("нет актора — false", () => expect(isLoyalist(null)).toBe(false));
});

describe("isPsykerOrSkitarii", () => {
  it("нет ни Черты, ни импланта — false", () => {
    expect(isPsykerOrSkitarii(actor("loyalist"))).toBe(false);
  });
  it("есть Черта Psyker — true", () => {
    expect(isPsykerOrSkitarii(actor("loyalist", [psykerTrait]))).toBe(true);
  });
  it("установленные (не неисправные) Боевые Латы Скитарии — true", () => {
    expect(isPsykerOrSkitarii(actor("loyalist", [skitarii(true, false)]))).toBe(true);
  });
  it("Боевые Латы есть, но НЕ установлены — false", () => {
    expect(isPsykerOrSkitarii(actor("loyalist", [skitarii(false, false)]))).toBe(false);
  });
  it("Боевые Латы установлены, но неисправны (disabled) — false", () => {
    expect(isPsykerOrSkitarii(actor("loyalist", [skitarii(true, true)]))).toBe(false);
  });
});

describe("classifyWitness", () => {
  it("не Лоялист — null, независимо от Псайкера/Скитарии", () => {
    expect(classifyWitness(actor("heretic", [psykerTrait]))).toBeNull();
  });
  it("Лоялист без Псайкера/Скитарии — visual", () => {
    expect(classifyWitness(actor("loyalist"))).toBe("visual");
  });
  it("Лоялист-Псайкер — psychic", () => {
    expect(classifyWitness(actor("loyalist", [psykerTrait]))).toBe("psychic");
  });
  it("Лоялист со Скитарии — psychic", () => {
    expect(classifyWitness(actor("loyalist", [skitarii()]))).toBe("psychic");
  });
});
