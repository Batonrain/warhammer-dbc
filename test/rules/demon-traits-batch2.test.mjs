// dbc-114 (14.11.2026), пачка 2: Варп-Нестабильность, Бестелесный/Фаза, Чародейский Барьер.
// Фикстуры пака — настоящие JSON из packs-src.
import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { instabilityTestNeeded, instabilityDamageFormula, shouldBanish } from "../../module/rules/warp-instability.mjs";
import { isIncorporealNow, canPhase, planeAttackBlockReason, PLANE_TOGGLE_FLAG } from "../../module/rules/incorporeal.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const q = path.join(d, e.name);
  return e.isDirectory() ? walk(q) : (e.name.endsWith(".json") && !e.name.startsWith("_") ? [q] : []);
});
const loadByName = (root, prefix) => walk(path.resolve(root))
  .map(f => JSON.parse(fs.readFileSync(f, "utf8"))).find(j => (j.name || "").startsWith(prefix));
const capsOf = d => d.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).map(e => e.capabilityKey).filter(Boolean);

const withCaps = (keys, toggled = false) => ({
  items: keys.map(k => ({ flags: { "warhammer-dbc": { mechanics: [{ entries: [{ kind: "capability", capabilityKey: k }] }] } } })),
  flags: { "warhammer-dbc": { [PLANE_TOGGLE_FLAG]: toggled } }
});

describe("Варп-Нестабильность", () => {
  it("тест нужен, только если получал урон и сам не наносил", () => {
    expect(instabilityTestNeeded({ hurt: true, dealt: false })).toBe(true);
    expect(instabilityTestNeeded({ hurt: true, dealt: true })).toBe(false);
    expect(instabilityTestNeeded({ hurt: false, dealt: false })).toBe(false);
  });
  it("урон — 1d5 плюс Провалы", () => {
    expect(instabilityDamageFormula(0)).toBe("1d5");
    expect(instabilityDamageFormula(3)).toBe("1d5 + 3");
    expect(instabilityDamageFormula(-2)).toBe("1d5");
  });
  it("изгнание — только когда Раны ушли ниже 0", () => {
    expect(shouldBanish({ overflow: true })).toBe(true);
    expect(shouldBanish({ gotCritical: true })).toBe(true);
    expect(shouldBanish({ overflow: false, gotCritical: false })).toBe(false);
    expect(shouldBanish(null)).toBe(false);
  });
  it("Черта выдаёт способность, у неё есть читатель", () => {
    const d = loadByName("packs-src/traits", "Warp Instability / ");
    expect(capsOf(d)).toContain("wounds.warpInstability");
    expect(CAPABILITIES["wounds.warpInstability"].reader).toBeTruthy();
  });
});

describe("Бестелесный и Фаза", () => {
  it("Черта Бестелесный — бестелесен; без неё — нет", () => {
    expect(isIncorporealNow(withCaps(["plane.incorporeal"]))).toBe(true);
    expect(isIncorporealNow(withCaps([]))).toBe(false);
  });
  it("Фаза переключает: Бестелесный+Фаза выключил — материален; одна Фаза включила — бестелесен", () => {
    expect(isIncorporealNow(withCaps(["plane.incorporeal", "plane.phase"], true))).toBe(false);
    expect(isIncorporealNow(withCaps(["plane.phase"], true))).toBe(true);
    expect(isIncorporealNow(withCaps(["plane.phase"], false))).toBe(false);
  });
  it("переключать может только носитель Фазы", () => {
    expect(canPhase(withCaps(["plane.phase"]))).toBe(true);
    expect(canPhase(withCaps(["plane.incorporeal"]))).toBe(false);
  });
  it("атака между планами запрещена в обе стороны, на одном плане — можно", () => {
    const ghost = withCaps(["plane.incorporeal"]);
    const body = withCaps([]);
    expect(planeAttackBlockReason(ghost, body)).toMatch(/материальн/);
    expect(planeAttackBlockReason(body, ghost)).toMatch(/другом плане/);
    expect(planeAttackBlockReason(ghost, withCaps(["plane.incorporeal"]))).toBe("");
    expect(planeAttackBlockReason(body, withCaps([]))).toBe("");
    expect(planeAttackBlockReason(ghost, null)).toBe("");
  });
  it("в паке: Бестелесный выдаёт способность, Фаза — способность и кнопку", () => {
    expect(capsOf(loadByName("packs-src/traits", "Incorporeal / "))).toContain("plane.incorporeal");
    const phase = loadByName("packs-src/traits", "Phase / ");
    expect(capsOf(phase)).toContain("plane.phase");
    const btn = phase.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).find(e => e.kind === "script");
    expect(btn?.code).toContain("togglePhase(actor)");
    for (const k of ["plane.incorporeal", "plane.phase"]) expect(CAPABILITIES[k].reader).toBeTruthy();
  });
});

describe("Чародейский Барьер", () => {
  const shield = loadByName("packs-src/shields", "Sorcerous Barrier / ");
  it("щит: купол, чародейский, 1-35, не перегружается, включён", () => {
    expect(shield.type).toBe("forcefield");
    expect(shield.system).toMatchObject({
      shieldType: "dome", shieldNature: "warp", ratingMax: 35, currentRating: 35,
      overloadThreshold: 0, equipped: true, status: "active"
    });
  });
  it("Черта выдаёт именно этот щит записью «Снаряжение»", () => {
    const trait = loadByName("packs-src/traits", "Sorcerous Barrier / ");
    const eq = trait.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).find(e => e.kind === "equipment");
    expect(eq.equipSourceUuid).toBe(`Compendium.warhammer-dbc.shields.Item.${shield._id}`);
  });
});
