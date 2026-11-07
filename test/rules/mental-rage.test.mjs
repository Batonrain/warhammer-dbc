// test/rules/mental-rage.test.mjs
//
// Ментальный Гнев / Mental Rage (Талант Берсерка, Sahara 3-861e): силы с system.mindEffect по цели в Ярости с Талантом
// дают кастеру Ступор на 1 Раунд (combat/mental-rage.mjs), эффект для цели игнорируется. Таланты и силы — настоящие
// документы packs-src.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import fs from "node:fs";
import { describe, it, expect, beforeEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { hasMentalRage, isMindEffectPower, mentalRageTargets } from "../../module/rules/mental-rage.mjs";
import { applyMentalRage } from "../../module/combat/mental-rage.mjs";

const NS = "warhammer-dbc";
const MENTAL_RAGE = packDocById("packs-src/talents/Берсерк", "dwORujdMj2xB0uIN");
const TERRIFY = packDocById("packs-src/psychic-powers/ФУНДАМЕНТАЛЬНЫЕ_ДИСЦИПЛИНЫ/ТЕЛЕПАТИЯ/Разное", "aMAbRmFv5fiSxJVh");

const itemOf = doc => ({ id: doc._id, type: doc.type, name: doc.name, system: doc.system, flags: doc.flags ?? {}, getFlag: (s, k) => doc.flags?.[s]?.[k] });
const actor = ({ id, name = id, inRage = true, talent = true } = {}) => {
  const a = { id, uuid: `Actor.${id}`, name, system: { inRage, conditions: {} }, items: talent ? [itemOf(MENTAL_RAGE)] : [], effects: [] };
  a.created = [];
  a.createEmbeddedDocuments = async (_t, docs) => { a.created.push(...docs); return docs; };
  a.update = async patch => { captured.updates.push(patch); return a; };
  return a;
};

beforeEach(() => resetCaptured());

describe("признак силы", () => {
  it("Ужас (Телепатия) воздействует на разум; Размытие и обычная сила — нет", () => {
    expect(isMindEffectPower(itemOf(TERRIFY))).toBe(true);
    expect(isMindEffectPower({ system: {} })).toBe(false);
    expect(isMindEffectPower(null)).toBe(false);
  });
});

describe("mentalRageTargets", () => {
  const power = itemOf(TERRIFY);
  const caster = actor({ id: "psyker", talent: false, inRage: false });

  it("цель в Ярости с Талантом — отвечает", () => {
    const rager = actor({ id: "rager" });
    expect(hasMentalRage(rager)).toBe(true);
    expect(mentalRageTargets(caster, power, [rager])).toEqual([rager]);
  });

  it("не в Ярости, без Таланта, сам кастер, пустая цель, дубль — не отвечают", () => {
    const calm = actor({ id: "calm", inRage: false });
    const plain = actor({ id: "plain", talent: false });
    const selfRager = actor({ id: "self" });
    const rager = actor({ id: "rager" });
    expect(mentalRageTargets(caster, power, [calm, plain, null])).toEqual([]);
    expect(mentalRageTargets(selfRager, power, [selfRager])).toEqual([]);
    expect(mentalRageTargets(caster, power, [rager, rager])).toEqual([rager]);
  });

  it("сила без признака разума — никого", () => {
    expect(mentalRageTargets(caster, { system: { mindEffect: false } }, [actor({ id: "rager" })])).toEqual([]);
  });
});

describe("applyMentalRage: Ступор кастеру", () => {
  it("цель в Ярости с Талантом: Ступор на 1 Раунд кастеру и строка «эффект игнорируется»", async () => {
    const caster = actor({ id: "psyker", name: "Псайкер", talent: false, inRage: false });
    const rager = actor({ id: "rager", name: "Берсерк" });
    const html = await applyMentalRage(caster, itemOf(TERRIFY), [rager]);
    expect(html).toContain("Ментальный Гнев (Берсерк)");
    expect(html).toContain("игнорируется");
    expect(caster.created).toHaveLength(1);
    expect(caster.created[0].statuses).toEqual(["dazed"]);
    expect(caster.created[0].duration).toMatchObject({ value: 1, units: "rounds" });
    expect(rager.created).toEqual([]);
  });

  it("нет подходящей цели — пустая строка и никаких записей", async () => {
    const caster = actor({ id: "psyker", talent: false, inRage: false });
    const html = await applyMentalRage(caster, itemOf(TERRIFY), [actor({ id: "calm", inRage: false })]);
    expect(html).toBe("");
    expect(captured.updates).toEqual([]);
  });
});

describe("проводка", () => {
  it("манифестация зовёт applyMentalRage один раз, переброс — нет; карточка несёт секцию", () => {
    const src = fs.readFileSync("module/sheets/tabs/psychic.mjs", "utf8");
    expect(src).toContain("opts.reroll ? \"\"");
    expect(src).toContain("applyMentalRage(actor, item,");
    expect(src).toMatch(/sections: \[conversionLine, mentalRageSection,/);
  });
});
