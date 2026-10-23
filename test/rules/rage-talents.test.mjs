// test/rules/rage-talents.test.mjs
//
// Таланты поверх Ярости (корбук, Таланты «Берсерк», pdf-стр. 62; Sahara 3-861e):
//   Wounded Beast / Раненный Зверь — «Если он легко ранен, он увеличивает
//     бонусы к WS и S от Ярости до +15. Если он тяжело или критически ранен —
//     до +20»: +5 / +10 поверх +10 Ярости;
//   Cold Fury / Холодная Ярость — «не получает штрафа к F от Ярости», может
//     совершать ментальные действия в Ярости; псайкер «получает штраф −10 на
//     все психотесты через броски на W».
// Сама Ярость — test/rules/rage.test.mjs.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import {
  WOUNDED_BEAST_EXTRA, woundedBeastBonus, rageRules
} from "../../module/rules/rage.mjs";
import { hasColdFury, hasWoundedBeast, isMentalActionBlocked } from "../../module/rules/predicates.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const talent = name => ({ type: "talent", name, system: {}, flags: {}, getFlag: () => undefined });
/** Талант без имени-совпадения: опознаётся только записью Конструктора (ключом Возможности). */
const talentByKey = key => ({
  type: "talent", name: "ИСПОРЧЕННОЕ ИМЯ", system: {}, getFlag: () => undefined,
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key }
  ] }] } }
});
const WOUNDED = "Wounded Beast / Раненный Зверь";
const COLD = "Cold Fury / Холодная Ярость";

const actor = ({ inRage = true, tier = "healthy", items = [], conditions = {} } = {}) => ({
  system: { inRage, characteristics: {}, wounds: { tier }, conditions },
  items
});

describe("опознание Талантов", () => {
  it("по имени (любая половина двуязычного) и по ключу Возможности", () => {
    expect(hasWoundedBeast(actor({ items: [talent(WOUNDED)] }))).toBe(true);
    expect(hasWoundedBeast(actor({ items: [talent("Wounded Beast")] }))).toBe(true);
    expect(hasWoundedBeast(actor({ items: [talentByKey("berserker.core.woundedBeast")] }))).toBe(true);
    expect(hasColdFury(actor({ items: [talent(COLD)] }))).toBe(true);
    expect(hasColdFury(actor({ items: [talentByKey("berserker.core.coldFury")] }))).toBe(true);
  });

  it("без Таланта и по чужому ключу — нет", () => {
    expect(hasWoundedBeast(actor())).toBe(false);
    expect(hasColdFury(actor({ items: [talent(WOUNDED)] }))).toBe(false);
    expect(hasColdFury(actor({ items: [talentByKey("berserker.core.hatred")] }))).toBe(false);
    expect(hasColdFury(null)).toBe(false);
  });
});

describe("Раненный Зверь: +5 при лёгком ранении, +10 при тяжёлом и критическом (WS и S)", () => {
  const beast = tier => actor({ tier, items: [talent(WOUNDED)] });

  it("таблица книги: +10 → +15 → +20", () => {
    expect(WOUNDED_BEAST_EXTRA).toEqual({ light: 5, heavy: 10, dying: 10 });
  });

  it("лёгкое ранение — +5 к WS и S", () => {
    expect(woundedBeastBonus(beast("light"), "ws")).toBe(5);
    expect(woundedBeastBonus(beast("light"), "s")).toBe(5);
  });

  it("тяжёлое и критическое («При смерти») — +10", () => {
    for (const tier of ["heavy", "dying"]) {
      expect(woundedBeastBonus(beast(tier), "ws"), tier).toBe(10);
      expect(woundedBeastBonus(beast(tier), "s"), tier).toBe(10);
    }
  });

  it("здоров — ничего; книга говорит про раненого", () => {
    expect(woundedBeastBonus(beast("healthy"), "ws")).toBe(0);
  });

  it("W (Воля) не растёт — книга называет только WS и S", () => {
    for (const k of ["wp", "bs", "t", "ag", "int", "fel"]) expect(woundedBeastBonus(beast("heavy"), k), k).toBe(0);
  });

  it("вне Ярости Талант молчит", () => {
    expect(woundedBeastBonus(actor({ inRage: false, tier: "heavy", items: [talent(WOUNDED)] }), "ws")).toBe(0);
  });

  it("без Таланта раненому берсерку добавки нет", () => {
    expect(woundedBeastBonus(actor({ tier: "heavy" }), "ws")).toBe(0);
  });

  it("Талант по ключу Возможности — то же", () => {
    expect(woundedBeastBonus(actor({ tier: "light", items: [talentByKey("berserker.core.woundedBeast")] }), "s")).toBe(5);
  });
});

// ── в расчёте актора ─────────────────────────────────────────────────────────

function derived({ inRage = true, items = [], woundsLost = 0, critical = 0 } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  for (const k of Object.keys(system.characteristics)) system.characteristics[k].base = 40;
  system.inRage = inRage;
  system.wounds.max = 20;
  system.wounds.value = 20 - woundsLost;
  system.wounds.critical = critical;
  const list = [...items];
  list.get = () => null;
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
  });
  return system;
}

describe("Раненный Зверь в расчёте актора (T.b = 4: лёгкое — потеряно до 8 Ран)", () => {
  const items = [talent(WOUNDED)];

  it("здоров: WS и S = 40 + 10 Ярости", () => {
    const s = derived({ items });
    expect(s.characteristics.ws.total).toBe(50);
    expect(s.characteristics.s.total).toBe(50);
  });

  it("легко ранен: 55, и Бонус растёт вместе с итогом", () => {
    const s = derived({ items, woundsLost: 5 });
    expect(s.wounds.tier).toBe("light");
    expect(s.characteristics.ws.total).toBe(55);
    expect(s.characteristics.s.total).toBe(55);
    expect(s.characteristics.s.bonus).toBe(5);
  });

  it("тяжело ранен: 60, Бонус 6 (15 → 20 от значения WS/S: 40 + 10 + 10)", () => {
    const s = derived({ items, woundsLost: 12 });
    expect(s.wounds.tier).toBe("heavy");
    expect(s.characteristics.ws.total).toBe(60);
    expect(s.characteristics.s.bonus).toBe(6);
  });

  it("критически ранен («При смерти») — тоже +10", () => {
    const s = derived({ items, woundsLost: 20, critical: 2 });
    expect(s.wounds.tier).toBe("dying");
    expect(s.characteristics.ws.total).toBe(60);
  });

  it("Воля растёт только на +10 Ярости, не на раны", () => {
    expect(derived({ items, woundsLost: 12 }).characteristics.wp.total).toBe(50);
  });

  it("причина видна в подсказке итога", () => {
    const s = derived({ items, woundsLost: 5 });
    expect(s.characteristics.ws.totalBreakdown).toContainEqual({ label: "Раненный Зверь", value: 5 });
  });

  it("не в Ярости: раны ничего не дают", () => {
    const s = derived({ items, woundsLost: 12, inRage: false });
    expect(s.characteristics.ws.total).toBe(40);
  });

  it("без Таланта: только +10 Ярости, как раньше", () => {
    const s = derived({ items: [], woundsLost: 12 });
    expect(s.characteristics.ws.total).toBe(50);
  });
});

describe("Холодная Ярость: нет штрафа −20 к F", () => {
  const targetsOf = rules => rules.flatMap(r => r.effects.map(e => e.target));

  it("без Таланта: штраф F на месте", () => {
    expect(targetsOf(rageRules(actor()))).toContain("basedon:fel");
  });

  it("с Талантом: штрафа F нет, BS и I остаются", () => {
    const t = targetsOf(rageRules(actor({ items: [talent(COLD)] })));
    expect(t).not.toContain("basedon:fel");
    expect(t).toContain("basedon:bs");
    expect(t).toContain("basedon:int");
  });

  it("то же через конвейер теста, по имени и по ключу", () => {
    for (const items of [[talent(COLD)], [talentByKey("berserker.core.coldFury")]]) {
      const a = actor({ items });
      expect(resolveTest({ actor: a, kind: "char", char: "fel" }).autoMods.some(m => /Ярост/.test(m.label))).toBe(false);
      expect(resolveTest({ actor: a, kind: "char", char: "int" }).autoMods.some(m => /Ярост/.test(m.label))).toBe(true);
    }
  });
});

describe("Холодная Ярость: ментальные действия и псайкер", () => {
  it("в Ярости без Таланта Ментальное действие заблокировано (как раньше)", () => {
    expect(isMentalActionBlocked(actor())).toBe(true);
  });

  it("с Талантом Ярость Ментальное действие не блокирует", () => {
    expect(isMentalActionBlocked(actor({ items: [talent(COLD)] }))).toBe(false);
  });

  it("но галлюцинации и опьянение Талант не снимает — он про Ярость", () => {
    expect(isMentalActionBlocked(actor({ inRage: false, items: [talent(COLD)], conditions: { hallucinogenic: true } }))).toBe(true);
    expect(isMentalActionBlocked(actor({ inRage: true, items: [talent(COLD)], conditions: { intoxicated: true } }))).toBe(true);
  });

  it("манифестация в Ярости с Талантом — −10, подписано; без Таланта и вне Ярости — нет", () => {
    const power = { name: "Smite / Порицание" };
    const mods = a => resolveTest({ actor: a, kind: "power", power, char: "wp" }).autoMods.filter(m => /Холодн/.test(m.label));
    expect(mods(actor({ items: [talent(COLD)] }))).toHaveLength(1);
    expect(mods(actor({ items: [talent(COLD)] }))[0].value).toBe(-10);
    expect(mods(actor())).toHaveLength(0);
    expect(mods(actor({ inRage: false, items: [talent(COLD)] }))).toHaveLength(0);
  });
});
