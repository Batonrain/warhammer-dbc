// test/rules/null-zones.test.mjs
//
// Ауры Парии и Дискорданта (rules/null-zones.mjs): решения «что нельзя в
// зоне». Черты-метки и Черты носителей — из настоящих JSON packs-src.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { packDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import { inPariahVoid, inDiscordantField, voidBlocksPower, isIndirectPower, corruptionInVoid,
         weaponTechClass, fieldDisablesWeapon, fieldDisablesImplant,
         voidSuppressesMutation, fieldFailsTechPower } from "../../module/rules/null-zones.mjs";
import { PREDICATES } from "../../module/rules/predicates.mjs";
import { NULL_ZONE_RULES } from "../../module/rules/library/null-zones.mjs";

const TRAITS = "packs-src/traits/Трейты_рас";
const VOID = packDocById(TRAITS, "PariahVoidZone01");
const FIELD = packDocById(TRAITS, "DiscordFieldZn01");
const PARIAH = packDocById(TRAITS, "x8rVwVWA6EabOqsv");
const DISCORDANT = packDocById(TRAITS, "d3yBzLW8OHJHd5Om");
// Таран (core, Телекинез): книжный тип «Атака, Стрельба, Непрямое» —
// основной тип «Атака», «Непрямое» — доп. типом.
const TARAN = packDocById("packs-src/psychic-powers/ФУНДАМЕНТАЛЬНЫЕ_ДИСЦИПЛИНЫ/ТЕЛЕКИНЕЗ/Сокрушение", "4jq01cSZKuKyuUWv");

// Силы, у которых в книжной строке «Тип:» стоит «Непрямое» (core, aeldari,
// aeldari-branches). Не входят: Усиленный Поток и Крепость Души (о Непрямых
// только в тексте), силы Мирового Певца с «Непрямым» лишь «на природной
// территории» и Лесная Прогулка / Генезис Эволюция / Воля Мира (дают тип
// ДРУГИМ силам).
const INDIRECT_POWERS = [
  "4jq01cSZKuKyuUWv", "WPJLOx2pkXtUWplW", "WvsiXaIkP7IlfDX6", "v897lW8ZtsTJhubk",
  "BdTEfoyGDcBA71yT", "U8bnhE2DoLAmA9MO", "i7XRuR5gg8DI0t7m",
  "1w7cyBOVFL0aUQOP", "KkedeJrIZf7QldJV", "CCam22fS5HBVYouw", "z3QhfhqiEYo11lAT",
  "AaHJpG03ipkyPG0z", "GFPECJG3Lhjjxbwl", "siUHQ3q8MXEp0F6j",
  "98O0oeJhbjWZKyJH", "EG404GFR7SlK4BGF", "7015Kfkmcb8TCdud", "xvejJ80WWZkkNcJm",
  "zUF07vjkSjRcxh8s", "dsjDWR9fPP7iHO1V"
];

const asItem = doc => ({ id: doc._id, name: doc.name, type: doc.type, system: doc.system, flags: doc.flags });
function actor(docs = [], extra = {}) {
  const items = docs.map(asItem);
  return { id: "a", type: "character", system: { psyker: { rating: 0 }, ...extra },
           items: Object.assign([...items], { contents: items }) };
}

describe("Черты-метки и носители в паке", () => {
  it("метки несут флаги зон", () => {
    expect(inPariahVoid(actor([VOID]))).toBe(true);
    expect(inDiscordantField(actor([FIELD]))).toBe(true);
    expect(inPariahVoid(actor([]))).toBe(false);
  });
  it("аура носителя: W.b×3 м, на всех, включая себя, выдаёт метку", () => {
    for (const [carrier, zone] of [[PARIAH, VOID], [DISCORDANT, FIELD]]) {
      const aura = carrier.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).find(e => e.kind === "aura");
      expect(aura.auraRadius).toBe("wp*3");
      expect(aura.auraAffects).toBe("all");
      expect(aura.auraIncludesSelf).toBe(true);
      expect(aura.sourceUuid.endsWith(zone._id)).toBe(true);
    }
  });
});

describe("Пустота Парии", () => {
  const inside = actor([VOID]);
  it("психосила развеивается, Непрямая — нет", () => {
    expect(voidBlocksPower(inside, { system: { powerType: "direct" } })).toBe(true);
    expect(voidBlocksPower(inside, { system: { powerType: "indirect" } })).toBe(false);
    expect(voidBlocksPower(actor([]), { system: { powerType: "direct" } })).toBe(false);
  });
  it("Таран из пака — Непрямой, в Пустоте не развеивается", () => {
    expect(TARAN.system.powerType).toBe("attack");
    expect(isIndirectPower(TARAN.system)).toBe(true);
    expect(voidBlocksPower(inside, asItem(TARAN))).toBe(false);
  });
  it("пак: пометка Непрямой — ровно у сил с «Непрямое» в книжной строке типа", () => {
    const marked = packDocuments("psychic-powers", "psychicPower")
      .filter(({ doc }) => isIndirectPower(doc.system)).map(({ doc }) => doc._id);
    expect(marked.sort()).toEqual([...INDIRECT_POWERS].sort());
  }, PACK_SCAN_TIMEOUT);
  it("Порча не прибавляется, убывание не трогаем", () => {
    expect(corruptionInVoid(inside, 10, 15)).toBe(10);
    expect(corruptionInVoid(inside, 10, 5)).toBe(5);
    expect(corruptionInVoid(actor([]), 10, 15)).toBe(15);
  });
  it("сам Пария не поднимает Cor и вне зоны", () => {
    expect(corruptionInVoid(actor([PARIAH]), 0, 3)).toBe(0);
  });
  it("сверхъестественная мутация гаснет, обычная — нет", () => {
    expect(voidSuppressesMutation(inside, { system: { supernatural: true } })).toBe(true);
    expect(voidSuppressesMutation(inside, { system: { supernatural: false } })).toBe(false);
  });
  it("предикаты: в зоне, демон, цель-псайкер", () => {
    expect(PREDICATES.inPariahVoid(inside, {}, true)).toBe(true);
    expect(PREDICATES.inPariahVoid(actor([]), {}, true)).toBe(false);
    expect(PREDICATES.isDaemon({ type: "daemon", items: [] }, {}, true)).toBe(true);
    expect(PREDICATES.targetPsykerOrDaemon(null, { targetActor: { system: { psyker: { rating: 2 } }, items: [] } }, true)).toBe(true);
    expect(PREDICATES.targetPsykerOrDaemon(null, { targetActor: { system: { psyker: { rating: 0 } }, items: [] } }, true)).toBe(false);
  });
  it("штраф псайкеру — формулой от базового Пси-Рейтинга, авто", () => {
    const r = NULL_ZONE_RULES.find(x => x.id === "pariah.void.psyker");
    expect(r.effects[0]).toMatchObject({ kind: "rollBonus", target: "all", formula: "-pr*3", auto: true });
  });
  it("социальный штраф Парии — без Запугивания", () => {
    const r = NULL_ZONE_RULES.find(x => x.id === "pariah.self.social");
    expect(r.effects[0].target).not.toContain("skill:intimidate");
    expect(r.effects[0].target).toContain("skill:deceive");
  });
});

describe("Поле Дискорданта", () => {
  const inside = actor([FIELD]);
  it("класс техники: поле предмета главнее weaponType", () => {
    expect(weaponTechClass({ system: { techClass: "none", weaponType: "laser" } })).toBe("none");
    expect(weaponTechClass({ system: { weaponType: "laser" } })).toBe("electric");
    expect(weaponTechClass({ system: { weaponType: "chain" } })).toBe("mechanical");
    expect(weaponTechClass({ system: { weaponType: "exotic" } })).toBe("none");
  });
  it("электрика выключена только в поле", () => {
    const las = { system: { techClass: "electric" } };
    expect(fieldDisablesWeapon(inside, las)).toBe(true);
    expect(fieldDisablesWeapon(actor([]), las)).toBe(false);
    expect(fieldDisablesWeapon(inside, { system: { techClass: "mechanical" } })).toBe(false);
  });
  it("импланты: электроника гаснет, органы — нет", () => {
    expect(fieldDisablesImplant(inside, { system: { techClass: "electric" } })).toBe(true);
    expect(fieldDisablesImplant(inside, { system: { techClass: "" } })).toBe(false);
  });
  it("техночудо: цель в поле — провал; без цели решает сам техножрец", () => {
    expect(fieldFailsTechPower(actor([]), inside)).toBe(true);
    expect(fieldFailsTechPower(inside, null)).toBe(true);
    expect(fieldFailsTechPower(inside, actor([]))).toBe(false);
  });
  it("пак: лазер Империума — электрика, лазер Азуриан — нет, болтер — механика", () => {
    expect(packDocById("packs-src/weapons/Имперское/Стрелковое/Лазерное", "u0GROI7aTGdkD9BO").system.techClass).toBe("electric");
    expect(packDocById("packs-src/weapons/Азуриане/Стрелковое/Лазерное", "KMr7teb6TtxhaiRJ").system.techClass).toBe("none");
    expect(packDocById("packs-src/weapons/Астартес/Стрелковое/Болтерное", "RhagHeJz6DvzlRzl").system.techClass).toBe("mechanical");
  });
});
