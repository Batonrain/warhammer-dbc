// Питати: Сквозной Выстрел, Живая Пуля, Рунная Артиллерия, Выдержанный Взрыв (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { runicShotBonus, runicWeaveAllowed, isPsychicBlast, runicArtilleryActive } from "../../module/rules/runic-shot.mjs";

const pitati = (talents = [], flags = {}, extraItems = []) => ({
  items: [{ type: "trait", name: "Runic Shot / Рунный Выстрел" }, ...talents.map(n => ({ type: "talent", name: n })), ...extraItems],
  system: { psyker: { rating: 4, sustain: 0 } },
  flags: { "warhammer-dbc": { runicBullets: 3, ...flags } }
});
const power = system => ({ type: "psychicPower", name: "сила", system });

describe("Питати", () => {
  it("Сквозной Выстрел удваивает тPR рунной пули", () => {
    const r = runicShotBonus(pitati(["Piercing Shot"], { piercingShotReady: true }), { toggles: { runicShot: true }, rofMode: "single" });
    expect(r).toEqual({ dmg: 8, pen: 4, used: true, piercing: true });
  });
  it("вплетение: не на себя; Касание — только Биомантия с Живой Пулей", () => {
    expect(runicWeaveAllowed(pitati(), power({ range: "Сам" }))).toBe(false);
    expect(runicWeaveAllowed(pitati(), power({ range: "30 м" }))).toBe(true);
    const touchBio = power({ powerType: "touch", discipline: "biomancy" });
    expect(runicWeaveAllowed(pitati(), touchBio)).toBe(false);
    expect(runicWeaveAllowed(pitati(["Living Bullet"]), touchBio)).toBe(true);
    expect(runicWeaveAllowed(pitati(["Living Bullet"]), power({ powerType: "touch", discipline: "telekinesis" }))).toBe(false);
  });
  it("психический взрыв — свойство Blast", () => {
    expect(isPsychicBlast(power({ weaponProps: [{ key: "blast" }] }))).toBe(true);
    expect(isPsychicBlast(power({ weaponProps: [] }))).toBe(false);
  });
  it("Рунная Артиллерия: Полное прицеливание и поддерживаемое Preternatural Awareness", () => {
    const pa = { type: "psychicPower", name: "Preternatural Awareness", system: { isSustained: true } };
    expect(runicArtilleryActive(pitati(["Runic Artillery"], {}, [pa]), { aiming: "full" })).toBe(true);
    expect(runicArtilleryActive(pitati(["Runic Artillery"], {}, [pa]), { aiming: "half" })).toBe(false);
    expect(runicArtilleryActive(pitati(["Runic Artillery"]), { aiming: "full" })).toBe(false);
  });
});
