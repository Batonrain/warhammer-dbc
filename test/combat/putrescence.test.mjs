// Гниль Внутри (Разобрать u6c9x).
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { putrescenceNet, putrescenceResistant, putrescenceWeaponUpdate, hasPutrescenceWithin } from "../../module/combat/putrescence.mjs";
import { danceOfPainOffered } from "../../module/rules/dance-of-pain.mjs";

describe("Гниль Внутри", () => {
  it("урон −Cor.b, не меньше 1", () => {
    expect(putrescenceNet(10, 3)).toBe(7);
    expect(putrescenceNet(3, 5)).toBe(1);
  });
  it("обычное оружие ломается, Наследия — Poor.Q с памятью Качества", () => {
    expect(putrescenceWeaponUpdate({ system: { quality: "good" } })["system.destroyed"]).toBe(true);
    const legacy = { system: { quality: "best", legacy: { historyKey: "x" } } };
    expect(putrescenceResistant(legacy)).toBe(true);
    const u = putrescenceWeaponUpdate(legacy);
    expect(u["system.quality"]).toBe("poor");
    expect(u["flags.warhammer-dbc.putrescent"].quality).toBe("best");
  });
  it("узнаёт Черту", () => {
    expect(hasPutrescenceWithin({ items: [{ type: "trait", name: "Putrescence Within / Гниль Внутри" }] })).toBe(true);
  });
});

describe("Танец Боли", () => {
  const dancer = (flags = {}) => ({ items: [{ type: "trait", name: "Dance of Pain / Танец Боли" }], flags: { "warhammer-dbc": flags } });
  it("рукопашное попадание, раз в Ход", () => {
    expect(danceOfPainOffered(dancer(), { isMelee: true, hit: true })).toBe(true);
    expect(danceOfPainOffered(dancer(), { isMelee: true, hit: false })).toBe(false);
    expect(danceOfPainOffered(dancer({ danceOfPainThisTurn: true }), { isMelee: true, hit: true })).toBe(false);
  });
});

import { runicShotBonus, currentPsyRating } from "../../module/rules/runic-shot.mjs";

describe("Рунный Выстрел", () => {
  const pitati = (bullets) => ({ items: [{ type: "trait", name: "Runic Shot / Рунный Выстрел" }],
    system: { psyker: { rating: 5, sustain: 0 } }, flags: { "warhammer-dbc": { runicBullets: bullets } } });
  it("одиночный выстрел с пулей: +тPR Dmg, +½тPR Pen", () => {
    expect(runicShotBonus(pitati(2), { toggles: { runicShot: true }, rofMode: "single" })).toEqual({ dmg: 5, pen: 2, used: true });
    expect(runicShotBonus(pitati(2), { toggles: { runicShot: true }, rofMode: "semi" }).used).toBe(false);
    expect(runicShotBonus(pitati(0), { toggles: { runicShot: true }, rofMode: "single" }).used).toBe(false);
  });
  it("тPR = бPR − поддержание", () => {
    expect(currentPsyRating({ system: { psyker: { rating: 4, sustain: 1 } } })).toBe(3);
  });
});
