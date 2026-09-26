// test/rules/library/beastman-subraces.test.mjs
//
// Сверка субрас Зверолюда (Слаангор, Пестигор, Кхорнгор, Тзаангор) с
// корбуком (глава I): формы «за действие и Очко Бесчестия — до конца боя
// или сцены», Таланты субрас, закреплённый покровитель, частичное снятие
// Natural Weapons у Тзаангора.

import { describe, it, expect } from "vitest";
import "../../support/foundry-stub.mjs";
import { packDocById } from "../../support/pack-doc.mjs";
import {
  activationSpec, activationPlan, activationLabel, endsWithCombat, UNTIL_COMBAT
} from "../../../module/rules/item-activation.mjs";
import { patronKeyOfGod, enforcedPatron } from "../../../module/rules/subrace-patron.mjs";
import { parseTraitRemoval, dropIntegralChoice, presetIntegralChoice } from "../../../module/rules/integral-rating.mjs";
import { checkRequirement } from "../../../module/constants/talent-requirements.mjs";
import { brutalChargeDamageBonus } from "../../../module/combat/attack.mjs";

const SUB = "packs-src/races/Субрасы";
const FORMS = "packs-src/traits/Трейты_рас/Зверолюды";
const TAL = "packs-src/talents/Субрасы_Зверолюдов";
const SLAANGOR = packDocById(SUB, "57Q9H6rZACbBl8rV");
const PESTIGOR = packDocById(SUB, "26yhbXP9Vi4ZgNWA");
const KHORNGOR = packDocById(SUB, "DBpnsL5iimkOSDB1");
const TZAANGOR = packDocById(SUB, "U8W1CR6cJt5Muara");
const SLG_FORM = packDocById(FORMS, "SlaangorFormTr01");
const PST_FORM = packDocById(FORMS, "PestigorFormTr01");
const KHG_FORM = packDocById(FORMS, "KhorngorFormTr01");
const CLAW = packDocById("packs-src/weapons/Интегральные_атаки", "SlgPincerClaw001");
const NATURAL = packDocById("packs-src/traits", "SvLCLe1hbxSaWy3s");

const entries = doc => doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const names = doc => entries(doc).map(e => e.sourceName).filter(Boolean);

describe("формы субрас — цена и срок", () => {
  it.each([
    ["Слаангор", SLG_FORM, 2, 2],
    ["Пестигор", PST_FORM, 2, 0],
    ["Кхорнгор", KHG_FORM, 0, 0]
  ])("%s: Очко Бесчестия, ОД по книге, до конца боя", (_, form, apOn, apOff) => {
    expect(form.system.activatable).toBe(true);
    expect(form.system.active).toBe(false);
    expect(activationSpec(form)).toEqual({ cost: { pool: "infamy", amount: 1 }, apOn, apOff, until: UNTIL_COMBAT });
  });

  it("включение стоит Очко и ОД, выключение — только ОД", () => {
    expect(activationPlan(SLG_FORM)).toEqual({ turnOn: true, cost: { pool: "infamy", amount: 1 }, ap: 2 });
    const on = { system: { ...SLG_FORM.system, active: true } };
    expect(activationPlan(on)).toEqual({ turnOn: false, cost: null, ap: 2 });
  });

  it("простой тумблер (без activation) — бесплатно и без подсказки", () => {
    const plain = { system: { activatable: true, active: false } };
    expect(activationPlan(plain)).toEqual({ turnOn: true, cost: null, ap: 0 });
    expect(activationLabel(plain)).toBe("");
  });

  it("подсказка на кнопке", () => {
    expect(activationLabel(KHG_FORM)).toBe("Включить: свободное действие + 1 Очко Бесчестия, до конца боя или сцены. Выключить: свободное действие, бесплатно.");
  });

  it("конец боя гасит только включённые формы со сроком", () => {
    const on = f => ({ system: { ...f.system, active: true } });
    const barefoot = { system: { activatable: true, active: true } };
    const items = [on(SLG_FORM), PST_FORM, barefoot];
    expect(endsWithCombat(items)).toEqual([items[0]]);
  });
});

describe("паки субрас против книги", () => {
  it("Слаангор: Digitigrade (3) постоянно, Клешня — только формой", () => {
    expect(names(SLAANGOR)).toEqual(["Digitigrade / Двусоставный (X)", "Slaangor Form / Форма Слаангора"]);
    const grant = entries(SLG_FORM).find(e => e.kind === "integralAttack");
    expect(grant.equipSourceUuid).toBe("Compendium.warhammer-dbc.weapons.Item.SlgPincerClaw001");
    expect(grant.equipOptional).toBeUndefined();
  });

  it("Клешня — профиль книги", () => {
    const s = CLAW.system;
    expect([s.grips, s.damage, s.damageType, s.penetration, s.rangeMin, s.range]).toEqual(["1р", "1d10+2", "rending", 3, 0, 4]);
    expect(s.weaponProps).toEqual([{ key: "extreme", rating: 8 }, { key: "razorSharp" }, { key: "reinforced" }, { key: "tearing" }]);
  });

  it("Пестигор: Toxic (1) постоянно, Sturdy и Stuff of Nightmares — только формой", () => {
    expect(names(PESTIGOR)).toEqual(["Toxic / Токсичный (X)", "Pestigor Form / Форма Пестигора"]);
    expect(names(PST_FORM)).toEqual(["Sturdy / Надёжный", "Stuff of Nightmares / Существо из Кошмаров"]);
  });

  it("Кхорнгор: Brutal Charge (2) и Frenzy постоянно, DNW и +2 Натиска — формой", () => {
    expect(names(KHORNGOR)).toEqual(["Brutal Charge / Брутальный Натиск (X)", "Khorngor Form / Форма Кхорнгора", "Frenzy / Ярость"]);
    const [dnw, bc] = entries(KHG_FORM);
    expect(dnw.sourceName).toBe("Deadly Natural Weapons / Смертельное Естественное Оружие");
    expect(dnw.specialization).toBe("1, Рога, Укус, Когти, Копыта");
    expect(bc.rating).toBe(2);
    // Своя Черта (2) + выданная формой (2) — Натиск складывается.
    const trait = r => ({ type: "trait", name: "Brutal Charge / Брутальный Натиск (X)", system: { rating: r } });
    expect(brutalChargeDamageBonus({ items: [trait(2), trait(2)] })).toBe(4);
  });

  it("Таланты субрас — Таланты 3-го уровня, не бесплатные Черты", () => {
    for (const d of [SLAANGOR, PESTIGOR, KHORNGOR, TZAANGOR]) {
      expect(names(d).some(n => /Fiendblood|Mourner|Butcher|Enlightened/.test(n))).toBe(false);
    }
    const t = packDocById(TAL, "3e9T545VGPxmdD3Y");
    expect([t.type, t.system.tier, t.system.god, t.system.requirement])
      .toEqual(["talent", 3, "Слаанеш", "Субраса Слаангор, Cor 30, Inf 30"]);
    expect(packDocById(TAL, "iccVmUFcgexLNsAc").system.requirement).toContain("Hatred");
    expect(packDocById(TAL, "Q3Z5NnzisjqmBpxB").system.requirement).toContain("Forbidden Lore (Daemons)");
  });

  it("требование «Субраса …» сверяется с субрасой персонажа", () => {
    const actor = subrace => ({ system: { subrace, corruption: { value: 30 }, characteristics: { inf: { total: 30 } } }, items: [] });
    expect(checkRequirement(actor("slaangor"), "Субраса Слаангор, Cor 30, Inf 30").state).toBe("ok");
    expect(checkRequirement(actor("khorngor"), "Субраса Слаангор, Cor 30, Inf 30").unmet).toEqual(["Субраса Слаангор"]);
    expect(checkRequirement(actor(""), "Субраса Слаангор").state).toBe("fail");
  });
});

describe("не может потерять покровительство", () => {
  it("Бог субрасы — ключ покровителя", () => {
    expect([SLAANGOR, PESTIGOR, KHORNGOR, TZAANGOR].map(d => patronKeyOfGod(d.system.god)))
      .toEqual(["slaanesh", "nurgle", "khorne", "tzeentch"]);
    expect(patronKeyOfGod("")).toBe("");
  });

  it("смена покровителя возвращается к Богу субрасы", () => {
    expect(enforcedPatron("slaanesh", "khorne")).toBe("slaanesh");
    expect(enforcedPatron("slaanesh", "")).toBe("slaanesh");
    expect(enforcedPatron("slaanesh", "slaanesh")).toBeNull();
    expect(enforcedPatron("slaanesh", undefined)).toBeNull();
    expect(enforcedPatron("", "khorne")).toBeNull();
  });
});

describe("Тзаангор теряет только Рога и Когти", () => {
  it("строка снятия со скобками — частичная", () => {
    expect(TZAANGOR.system.removesTraits).toContain("Natural Weapons (Рога, Когти)");
    expect(parseTraitRemoval("Natural Weapons (Рога, Когти)")).toEqual({ name: "Natural Weapons", parts: ["Рога", "Когти"] });
    expect(parseTraitRemoval("Aversion to Order")).toEqual({ name: "Aversion to Order", parts: [] });
  });

  it("из выбора Зверолюда остаются Укус и Копыта", () => {
    const groups = NATURAL.flags["warhammer-dbc"].mechanics;
    const chosen = presetIntegralChoice(groups, "Рога, Укус, Когти, Копыта");
    const { keep, dropped } = dropIntegralChoice(groups, chosen, ["Рога", "Когти"]);
    const byId = Object.fromEntries(entries(NATURAL).map(e => [e.id, e.equipSourceName]));
    expect(keep.map(id => byId[id].split(" (")[0]).sort()).toEqual(["Bite", "Hooves"]);
    expect(dropped.map(id => byId[id].split(" (")[0]).sort()).toEqual(["Claws", "Horns"]);
  });
});
