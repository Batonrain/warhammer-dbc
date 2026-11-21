// Кенетаи: Оккультный Клинок, Фокусированный Шторм, Общее Сознание (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  occultBladeAllowed, soulBurnBlockedByOccultBlade, occultShotShape, sharedMindRange, sharedMindBonus,
  brotherhoodEpr, isForceMelee, sharedConsciousnessRules, setSharedMindResolver
} from "../../module/rules/kenetai-talents.mjs";

const NS = "warhammer-dbc";
const T2 = { type: "talent", name: "Way of Two Blades / Путь Двух Клинков" };
const SC = { type: "trait", name: "Shared Consciousness / Общее Сознание" };
const WB = { type: "talent", name: "Wide Berth / Пространство для Маневра" };

describe("Оккультный Клинок", () => {
  it("раз в Раунд; Путь Двух Клинков — дважды разными оружиями", () => {
    expect(occultBladeAllowed(null, "c:1", "w1").ok).toBe(true);
    expect(occultBladeAllowed({ tag: "c:1", weapons: ["w1"] }, "c:1", "w2").ok).toBe(false);
    expect(occultBladeAllowed({ tag: "c:0", weapons: ["w1"] }, "c:1", "w1").ok).toBe(true);
    expect(occultBladeAllowed({ tag: "c:1", weapons: ["w1"] }, "c:1", "w2", { twoBlades: true }).ok).toBe(true);
    expect(occultBladeAllowed({ tag: "c:1", weapons: ["w1"] }, "c:1", "w1", { twoBlades: true }).ok).toBe(false);
    expect(occultBladeAllowed({ tag: "c:1", weapons: ["w1", "w2"] }, "c:1", "w3", { twoBlades: true }).ok).toBe(false);
  });
  it("не в один Раунд с Выжиганием Души (без Пути Двух Клинков)", () => {
    expect(occultBladeAllowed(null, "c:1", "w1", { soulBurnTag: "c:1" }).ok).toBe(false);
    expect(occultBladeAllowed(null, "c:1", "w1", { soulBurnTag: "c:1", twoBlades: true }).ok).toBe(true);
    const used = { flags: { [NS]: { occultBladeRound: { tag: "c:1", weapons: ["w1"] } } }, items: [] };
    expect(soulBurnBlockedByOccultBlade(used, "c:1")).toBe(true);
    expect(soulBurnBlockedByOccultBlade(used, "c:2")).toBe(false);
    expect(soulBurnBlockedByOccultBlade({ ...used, items: [T2] }, "c:1")).toBe(false);
  });
  it("Психосиловое рукопашное оружие", () => {
    expect(isForceMelee({ type: "weapon", system: { weaponClass: "melee", weaponProps: [{ key: "force" }] } })).toBe(true);
    expect(isForceMelee({ type: "weapon", system: { weaponClass: "pistol", weaponProps: [{ key: "force" }] } })).toBe(false);
    expect(isForceMelee({ type: "weapon", system: { weaponClass: "melee", weaponProps: [] } })).toBe(false);
  });
});

describe("Фокусированный Шторм", () => {
  it("одно попадание; без Таланта — без прибавок", () => {
    expect(occultShotShape({ shootType: "storm", hits: 4 })).toEqual({ hits: 1, pen: 0, dmg: 0, noTemplate: true });
  });
  it("Шторм/Обстрел +2 Pen за лишнее, Взрыв +1/2 м, Дыхание +1/5 м", () => {
    expect(occultShotShape({ shootType: "storm", hits: 4, focused: true }).pen).toBe(6);
    expect(occultShotShape({ shootType: "barrage", hits: 1, focused: true }).pen).toBe(0);
    expect(occultShotShape({ shootType: "blast", blast: 5, focused: true }).dmg).toBe(2);
    expect(occultShotShape({ shootType: "breath", rangeM: 20, focused: true }).dmg).toBe(4);
  });
});

describe("Общее Сознание", () => {
  const ken = (items = []) => ({ uuid: "K", items: [SC, ...items], system: { characteristics: { wp: { bonus: 4 } }, psyker: { rating: 3 } } });
  it("радиус W.b, ×2 с Пространством для Манёвра", () => {
    expect(sharedMindRange(ken())).toBe(4);
    expect(sharedMindRange(ken([WB]))).toBe(8);
  });
  it("+2 за участника в радиусе, +5 за Кенетаи; вне радиуса — ничего", () => {
    const k = ken();
    const a = { uuid: "A", items: [] }, b = { uuid: "B", items: [] }, c = { uuid: "C", items: [SC] };
    const pos = { K: 0, A: 2, B: 9, C: 3 };
    const dist = (x, y) => Math.abs(pos[x.uuid] - pos[y.uuid]);
    expect(sharedMindBonus(k, k, [a, b, c], dist)).toBe(7);   // A +2, C +5, B вне
    expect(sharedMindBonus(a, k, [a, b, c], dist)).toBe(10);  // сам Кенетаи +5, C +5
    expect(sharedMindBonus(b, k, [a, b, c], dist)).toBe(0);   // сам вне радиуса
  });
  it("правило бонуса к WS и рукопашным атакам", () => {
    const k = { ...ken(), flags: { [NS]: { sharedMind: { members: ["A"] } } } };
    const a = { uuid: "A", items: [] };
    setSharedMindResolver({ actors: () => [k, a], fromUuid: u => (u === "A" ? a : null), dist: () => 1 });
    const [r] = sharedConsciousnessRules(a);
    expect(r.effects[0]).toMatchObject({ kind: "rollBonus", value: 5, target: ["weapon:melee", "basedon:ws"] });
    expect(sharedConsciousnessRules(k)[0].effects[0].value).toBe(2);
    expect(sharedConsciousnessRules({ uuid: "Z", items: [] })).toEqual([]);
    setSharedMindResolver({ actors: () => [] });
  });
  it("Клинки Братства: эPR вдвое, окр.▲", () => {
    expect(brotherhoodEpr(5)).toBe(3);
    expect(brotherhoodEpr(4)).toBe(2);
  });
});
