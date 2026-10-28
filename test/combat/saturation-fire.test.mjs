// test/combat/saturation-fire.test.mjs
//
// Saturation Fire / Стрельба на Насыщение (Стрелок; Sahara 3-5fbf, решение
// владельца 24.10.2026 — только укрытие цели): «половина выстрелов в очереди,
// что не попала в цель (окр.▲), вместо этого попадает в укрытие цели».
// Система показывает строку «в укрытие N, AP укрытия −N»; износ ведёт ГМ.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { saturationFireCoverShots } from "../../module/rules/gunner-talents.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const SAT = { key: "rangedCore.core.saturationFire", name: "Saturation Fire / Стрельба на Насыщение" };
const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = name => ({ id: "t-" + name, name, type: "talent", system: {} });
const smg = () => weaponFor({ weaponClass: "basic", damage: "1d10", penetration: 0, rof_single: 1, rof_semi: 3, rof_full: 8,
  magazineCur: 30, magazineMax: 30 }, { name: "Автомат" });

beforeEach(() => { resetCaptured(); setTargets([]); });

async function fire(items, mode, roll) {
  const w = smg();
  captured.dice = [roll, 3, 4, 5, 6, 7, 8, 9];
  await _executeAttackRoll(actorFor({ items: [w, ...items] }), w, "bs", 45, mode, null, {});
}

describe("Стрельба на Насыщение: непопавшие выстрелы очереди — в укрытие цели", () => {
  it("длинная очередь RoF 8: бросок 15 при пороге 45 — 4 попадания, 4 промаха → 2 выстрела в укрытие", async () => {
    await fire([byKey(SAT.key)], "full", 15);
    expect(card()).toContain("Стрельба на Насыщение");
    expect(card()).toContain("2 шт.");
    expect(card()).toContain("AP укрытия −2");
  });

  it("по имени: то же", async () => {
    await fire([byName(SAT.name)], "full", 15);
    expect(card()).toContain("2 шт.");
  });

  it("полный промах: половина всего RoF, округление вверх — ⌈8/2⌉ = 4", async () => {
    await fire([byName(SAT.name)], "full", 90);
    expect(card()).toContain("4 шт.");
  });

  it("короткая очередь RoF 3, 1 попадание → промахов 2 → 1", async () => {
    await fire([byName(SAT.name)], "semi", 40);
    expect(card()).toContain("1 шт.");
  });

  it("без Таланта и в одиночном выстреле строки нет", async () => {
    await fire([], "full", 15);
    expect(card()).not.toContain("Насыщение");
    resetCaptured();
    await fire([byName(SAT.name)], "single", 15);
    expect(card()).not.toContain("Насыщение");
  });

  it("чистая функция: округление промахов вверх, нулевых промахов нет", () => {
    const a = actorFor({ items: [byName(SAT.name)] });
    const base = { rofMode: "full", isMelee: false };
    expect(saturationFireCoverShots(a, { ...base, rof: 8, hits: 3 })).toBe(3);   // 5 → ⌈2.5⌉
    expect(saturationFireCoverShots(a, { ...base, rof: 8, hits: 8 })).toBe(0);
    expect(saturationFireCoverShots(a, { ...base, rof: 3, hits: 5 })).toBe(0);
    expect(saturationFireCoverShots(a, { ...base, rofMode: "suppression", rof: 8, hits: 0 })).toBe(0);
    expect(saturationFireCoverShots(a, { ...base, isMelee: true, rof: 8, hits: 0 })).toBe(0);
  });
});
