// test/rules/library/beastman-subraces.test.mjs
//
// Сверка субрас Зверолюда (Слаангор, Пестигор, Кхорнгор, Тзаангор) с
// корбуком (глава I). Перенесено из PR #528 (16ee9bcb9), адаптировано к
// реализации main: боевые формы — rules/battle-forms.mjs, закреплённый
// покровитель — rules/patron-lock.mjs, Таланты субрас — id main. Дополняет
// test/combat/beastman-subrace.test.mjs: здесь — проверки данных паков.

import { describe, it, expect } from "vitest";
import "../../support/foundry-stub.mjs";
import { packDocById } from "../../support/pack-doc.mjs";
import { enforcedPatron, lockedPatron } from "../../../module/rules/patron-lock.mjs";
import { partialRemoval, integralEntriesNamed, presetIntegralChoice } from "../../../module/rules/integral-rating.mjs";
import { checkRequirement } from "../../../module/constants/talent-requirements.mjs";

const SUB = "packs-src/races/Субрасы";
const TAL = "packs-src/talents/Субрасы_Зверолюдов";
const SLAANGOR = packDocById(SUB, "57Q9H6rZACbBl8rV");
const PESTIGOR = packDocById(SUB, "26yhbXP9Vi4ZgNWA");
const KHORNGOR = packDocById(SUB, "DBpnsL5iimkOSDB1");
const TZAANGOR = packDocById(SUB, "U8W1CR6cJt5Muara");
const CLAW = packDocById("packs-src/weapons/Интегральные_атаки", "uwzgmx72z7uZCbOu");
const NATURAL = packDocById("packs-src/traits", "SvLCLe1hbxSaWy3s");

const entries = doc => doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);

describe("паки субрас против книги", () => {
  it("Клешня Слаангора — профиль книги", () => {
    const s = CLAW.system;
    expect([s.grips, s.damage, s.damageType, s.penetration, s.rangeMin, s.range]).toEqual(["1р", "1d10+2", "rending", 3, 0, 4]);
    expect(s.weaponProps).toEqual([{ key: "extreme", rating: 8 }, { key: "razorSharp" }, { key: "reinforced" }, { key: "tearing" }]);
  });

  it("Таланты субрас — Таланты 3-го уровня с Требованием «Субраса …», не бесплатные Черты", () => {
    const fiendblood = packDocById(TAL, "ukQwozQtX8h2I29T");
    expect([fiendblood.type, fiendblood.system.tier, fiendblood.system.god, fiendblood.system.requirement])
      .toEqual(["talent", 3, "Слаанеш", "Субраса Слаангор, Cor 30, Inf 30"]);
    expect(packDocById(TAL, "mBwAymB0yjsFgRtu").system.requirement).toContain("Hatred");
    expect(packDocById(TAL, "kuzlAt8ukoGBl90g").system.requirement).toContain("Forbidden Lore (Daemons)");
    expect(packDocById(TAL, "ZNsLdMnjBC5DSMcT").system.requirement).toBe("Субраса Пестигор, Cor 30, Inf 30");
    for (const d of [SLAANGOR, PESTIGOR, KHORNGOR, TZAANGOR]) {
      const names = entries(d).map(e => e.sourceName).filter(Boolean);
      expect(names.some(n => /Fiendblood|Mourner|Butcher|Enlightened/.test(n))).toBe(false);
    }
  });

  it("требование «Субраса …» сверяется с субрасой персонажа", () => {
    // На листе субраса — предмет-субраса; ключ system.subrace — запасной путь.
    const actor = name => ({ system: {}, items: name ? [{ type: "subrace", name }] : [] });
    expect(checkRequirement(actor("Slaangor / Слаангор"), "Субраса Слаангор").state).toBe("ok");
    expect(checkRequirement(actor("Khorngor / Кхорнгор"), "Субраса Слаангор").state).toBe("fail");
    expect(checkRequirement(actor(""), "Субраса Слаангор").state).toBe("fail");
  });
});

describe("не может потерять покровительство", () => {
  it("Бог субрасы — Слаанеш, Нургл, Кхорн, Тзинч", () => {
    expect([SLAANGOR, PESTIGOR, KHORNGOR, TZAANGOR].map(d => d.system.god))
      .toEqual(["Слаанеш", "Нургл", "Кхорн", "Тзинч"]);
  });

  it("смена покровителя возвращается к закреплённому", () => {
    expect(enforcedPatron("khorne", "slaanesh")).toBe("slaanesh");
    expect(enforcedPatron("slaanesh", "slaanesh")).toBe("slaanesh");
    expect(enforcedPatron("khorne", "")).toBe("khorne");
    expect(lockedPatron(new Set(["patron.locked.nurgle"]))).toBe("nurgle");
    expect(lockedPatron(new Set())).toBe("");
  });
});

describe("Тзаангор теряет только Рога и Когти", () => {
  it("строка снятия со скобками — частичная", () => {
    expect(TZAANGOR.system.removesTraits).toContain("Natural Weapons (Рога, Когти)");
    expect(partialRemoval("Natural Weapons (Рога, Когти)")).toEqual({ name: "Natural Weapons", parts: ["Рога", "Когти"] });
    expect(partialRemoval("Aversion to Order")).toEqual({ name: "Aversion to Order", parts: [] });
  });

  it("из выбора Зверолюда остаются Укус и Копыта", () => {
    const groups = NATURAL.flags["warhammer-dbc"].mechanics;
    const chosen = presetIntegralChoice(groups, ["Рога", "Укус", "Когти", "Копыта"]);
    const dropped = integralEntriesNamed(groups, partialRemoval("Natural Weapons (Рога, Когти)").parts).map(e => e.id);
    const keep = chosen.filter(id => !dropped.includes(id));
    const byId = Object.fromEntries(entries(NATURAL).map(e => [e.id, e.equipSourceName]));
    expect(keep.map(id => byId[id].split(" (")[0]).sort()).toEqual(["Bite", "Hooves"]);
    expect(dropped.map(id => byId[id].split(" (")[0]).sort()).toEqual(["Claws", "Horns"]);
  });
});
