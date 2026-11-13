// test/rules/rubric-sorcerer.test.mjs
//
// Колдун Рубрики (Sahara 1-54b9), чистая логика module/rules/rubric-sorcerer.mjs. Черты, Таланты, броня и
// профиль Голема — настоящие документы packs-src; правки Конструктора, а не только текст пака.

import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import {
  GOLEM_SOULS, GOLEM_LOYALTY, hasRubricOfAhriman, hasGolemMaster, hasShieldOfRubric, hasInfernalShells, hasPsychicEcho,
  hasSekhmet, hasRebornInDust, nexusCopies, pickMilderPeril, choiceThreshold, isGolem, golemsOf, soulsBound, soulsFree,
  fallenGolems, nexusFreeGolems, nexusSlotsLeft, golemSlot, sekhmetStats, armourAblative, armourWithoutAblative,
  regenerationRating, possessionThreshold, warpLoreTotal, regenerationHeal, isWounded, isOrdinaryBolt,
  shellsBatch
} from "../../module/rules/rubric-sorcerer.mjs";
import { minionLoyalty } from "../../module/rules/minion-build.mjs";
import { mutationPool } from "../../module/sheets/tabs/mutations.mjs";
import { mutationCatalog } from "../../module/constants/mutations.mjs";

const TRAITS = "packs-src/traits/Элитные_архетипы/Колдун_Рубрики";
const TALENTS = "packs-src/talents/Элитные_архетипы/Колдун_Рубрики";
const AHRIMAN = packDocById(TRAITS, "9sJhwVzdna4nEq1K");
const GOLEM_MASTER = packDocById(TRAITS, "eWHbtOowFK4vzpmy");
const SHIELD = packDocById(TRAITS, "A0mnKWWoZCWS3rMv");
const SHELLS = packDocById(TALENTS, "IyT6qQ2kMX84nJHm");
const NEXUS = packDocById(TALENTS, "5xjq1j1WITDdVE1H");
const ECHO = packDocById(TALENTS, "aXp7wMmnaaZK7OdX");
const SEKHMET = packDocById(TALENTS, "5td6Wrh8tp6cYZtc");
const REBORN = packDocById(TALENTS, "BOIQCCgpura5tzWf");
const AEGIS = packDocById("packs-src/armor/Астартес/Броня/Терминаторская", "zWrnp0yUuNetd2cf");
const REGEN = packDocById("packs-src/traits", "6cf11ucGdzYt6ndt");
const STANDARD_BOLTS = packDocById("packs-src/ammunition/Стандартные", "5K23F0Trz1yBJXF2");
const INFERNO = packDocById("packs-src/ammunition/Специальные___Болты", "DXDYD6nYsLS1KnHm");

const item = (doc, extra = {}) => ({ id: `i${Math.random()}`, type: doc.type, name: doc.name, system: { ...doc.system, ...extra }, flags: doc.flags });
const withItems = (...docs) => ({ items: docs.map(d => item(d)) });
const stripName = doc => ({ ...item(doc), name: "Безымянный" });

describe("опознание способностей", () => {
  it("по имени предмета", () => {
    expect(hasRubricOfAhriman(withItems(AHRIMAN))).toBe(true);
    expect(hasGolemMaster(withItems(GOLEM_MASTER))).toBe(true);
    expect(hasShieldOfRubric(withItems(SHIELD))).toBe(true);
    expect(hasInfernalShells(withItems(SHELLS))).toBe(true);
    expect(hasPsychicEcho(withItems(ECHO))).toBe(true);
    expect(hasSekhmet(withItems(SEKHMET))).toBe(true);
    expect(hasRebornInDust(withItems(REBORN))).toBe(true);
    expect(hasRubricOfAhriman(withItems(GOLEM_MASTER))).toBe(false);
  });

  it("и по ключу записи Конструктора, если имя переименовано", () => {
    for (const [doc, fn] of [[AHRIMAN, hasRubricOfAhriman], [GOLEM_MASTER, hasGolemMaster], [SHIELD, hasShieldOfRubric],
      [SHELLS, hasInfernalShells], [ECHO, hasPsychicEcho], [SEKHMET, hasSekhmet], [REBORN, hasRebornInDust]]) {
      expect(fn({ items: [stripName(doc)] }), doc.name).toBe(true);
    }
  });

  it("копии Таланта «Узы Душ» считаются по числу предметов", () => {
    expect(nexusCopies({ items: [item(NEXUS), item(NEXUS), item(ECHO)] })).toBe(2);
    expect(nexusCopies({ items: [stripName(NEXUS)] })).toBe(1);
  });
});

describe("Рубрика Аримана", () => {
  it("два броска на Прорыв: берётся меньший, больший отбрасывается", () => {
    expect(pickMilderPeril(70, 12)).toEqual({ keep: 12, drop: 70 });
    expect(pickMilderPeril(12, 70)).toEqual({ keep: 12, drop: 70 });
    expect(pickMilderPeril(40, 40)).toEqual({ keep: 40, drop: 40 });
  });

  it("порог выбора мутации — W−30 с модификаторами", () => {
    expect(choiceThreshold(60, 0)).toBe(30);
    expect(choiceThreshold(60, 5)).toBe(35);
  });

  it("пул мутаций: два броска дают две записи, успех W−30 открывает всю таблицу", () => {
    const base = mutationPool("mutation", "", 10, 90, 0, false);
    const free = mutationPool("mutation", "", 10, 90, 0, false, true);
    expect(base.length).toBe(2);
    expect(free.length).toBe(mutationCatalog().common.length);
    expect(free.length).toBeGreaterThan(base.length);
    // Рубрика Аримана: Порча за Провал второй кубик не отнимает (запрет книги — только Неделимым).
    expect(mutationPool("mutation", "", 10, 90, 0, true, false, true).length).toBe(2);
    expect(mutationPool("mutation", "", 10, 90, 0, true, false, false).length).toBe(1);
    // Дар Бога от «свободного выбора» не открывается.
    expect(mutationPool("gift", "khorne", 10, null, 0, false, true))
      .toEqual(mutationPool("gift", "khorne", 10, null, 0, false, false));
  });
});

describe("Големы и души", () => {
  const master = { uuid: "Actor.master" };
  const golem = (uuid, over = {}, deceased = false) => ({
    uuid, flags: { "warhammer-dbc": { rubricGolem: { masterUuid: "Actor.master", terminator: false, nexus: false, ...over } } },
    getFlag: (ns, key) => (key === "deceased" ? deceased : undefined)
  });

  it("свободные души: 8 минус живые Големы; разбитый душу возвращает", () => {
    const actors = [golem("A.1"), golem("A.2"), golem("A.3", {}, true), { uuid: "A.9", flags: {}, getFlag: () => undefined }];
    expect(golemsOf(master, actors)).toHaveLength(3);
    expect(soulsBound(master, actors)).toBe(2);
    expect(soulsFree(master, actors)).toBe(GOLEM_SOULS - 2);
    expect(fallenGolems(master, actors).map(g => g.uuid)).toEqual(["A.3"]);
  });

  it("чужой Голем не занимает душу", () => {
    const stranger = golem("A.1", { masterUuid: "Actor.other" });
    expect(soulsFree(master, [stranger])).toBe(GOLEM_SOULS);
    expect(isGolem(stranger)).toBe(true);
  });

  it("душ не бывает меньше нуля", () => {
    const many = Array.from({ length: 10 }, (_, i) => golem(`A.${i}`));
    expect(soulsFree(master, many)).toBe(0);
  });

  it("Узы Душ: свободные связи = копии Таланта минус связанные Големы", () => {
    const m = { uuid: "Actor.master", items: [item(NEXUS), item(NEXUS)] };
    const actors = [golem("A.1", { nexus: true }), golem("A.2"), golem("A.3", {}, true)];
    expect(nexusSlotsLeft(m, actors)).toBe(1);
    expect(nexusFreeGolems(m, actors).map(g => g.uuid)).toEqual(["A.2"]);
  });

  it("слот под Голема: Демон+Обычный, иначе слот без пары", () => {
    expect(golemSlot([{ talentId: "t1", group: "human", tier: "lesser" }])).toBeNull();
    expect(golemSlot([{ talentId: "t1", group: "human", tier: "lesser" }, { talentId: "t2", group: "", tier: "" }])).toEqual({ id: "t2" });
    expect(golemSlot([{ talentId: "t3", group: "daemon", tier: "standard" }, { talentId: "t2", group: "", tier: "" }])).toEqual({ id: "t3" });
  });

  it("Лояльность Голема — 30, Талантами Хозяина не меняется", () => {
    const rich = { system: { characteristics: { wp: { total: 80 }, inf: { total: 90 } } }, items: [] };
    expect(minionLoyalty(rich, "daemon", { golem: true })).toBe(GOLEM_LOYALTY);
    expect(minionLoyalty(rich, "daemon", { golem: false })).toBe(80);
  });
});

describe("Сехмет", () => {
  it("+10 WS и S, Раны выше на аблативные Раны брони, Regeneration 6", () => {
    expect(sekhmetStats({ ws: 40, s: 60, woundsMax: 30, ablative: 10 })).toEqual({ ws: 50, s: 70, woundsMax: 40, regeneration: 6 });
  });

  it("аблативные Раны читаются с настоящей Терминаторской брони и снимаются с копии", () => {
    expect(armourAblative(AEGIS)).toBe(10);
    const copy = armourWithoutAblative(AEGIS);
    expect(armourAblative(copy)).toBe(0);
    expect(armourAblative(AEGIS)).toBe(10);
    expect(copy.name).toBe(AEGIS.name);
  });
});

describe("Регенерация", () => {
  it("рейтинг без числа в поле берётся из имени «(5)»", () => {
    const named = { ...item(REGEN, { rating: 0 }), name: "Regeneration / Регенерация (5)" };
    expect(regenerationRating({ items: [named] })).toBe(5);
  });

  it("рейтинг читается с Трейта Regeneration (X)", () => {
    expect(regenerationRating({ items: [item(REGEN)] })).toBe(3);
    expect(regenerationRating({ items: [item(REGEN, { rating: 6 })] })).toBe(6);
    expect(regenerationRating({ items: [] })).toBe(0);
  });

  it("Психическое Эхо удваивает лечение", () => {
    expect(regenerationHeal(4)).toBe(4);
    expect(regenerationHeal(4, { echo: true })).toBe(8);
  });

  it("ранен — есть недостающие Раны или Критические", () => {
    expect(isWounded({ system: { wounds: { value: 30, max: 30, critical: 0 } } })).toBe(false);
    expect(isWounded({ system: { wounds: { value: 12, max: 30, critical: 0 } } })).toBe(true);
    expect(isWounded({ system: { wounds: { value: 0, max: 30, critical: 3 } } })).toBe(true);
  });
});

describe("Тест вселения", () => {
  const caster = (spec = "Warp", total = 60) => ({ system: { groupSkills: { forbiddenLore: [{ specialty: spec, total }] } } });

  it("вселение: For.Lore(Warp)−10; без Навыка теста нет", () => {
    expect(warpLoreTotal(caster())).toBe(60);
    expect(possessionThreshold(caster(), 0)).toBe(50);
    expect(possessionThreshold(caster(), 5)).toBe(55);
    expect(possessionThreshold(caster("Daemons"), 0)).toBeNull();
    expect(possessionThreshold({ system: {} }, 0)).toBeNull();
  });

});

describe("Инфернальные Снаряды", () => {
  it("обычные болты опознаются по настоящей записи пака, особые — нет", () => {
    expect(isOrdinaryBolt(item(STANDARD_BOLTS))).toBe(true);
    expect(isOrdinaryBolt(item(INFERNO))).toBe(false);
  });

  it("за раз переделывается одна единица (магазин на 24)", () => {
    expect(shellsBatch(0)).toBe(0);
    expect(shellsBatch(1)).toBe(1);
    expect(shellsBatch(5)).toBe(1);
  });
});

describe("пак: способности несут свои ключи", () => {
  const dir = path.resolve(import.meta.dirname, "../..");
  const keys = [
    [AHRIMAN, "ability.rubricOfAhriman"], [GOLEM_MASTER, "ability.golemMaster"], [SHIELD, "ability.shieldOfRubric"],
    [SHELLS, "ability.infernalShells"], [NEXUS, "ability.nexusOfSouls"], [ECHO, "ability.psychicEcho"],
    [SEKHMET, "ability.sekhmet"], [REBORN, "ability.rebornInDust"]
  ];
  it.each(keys)("%s", (doc, key) => {
    const text = JSON.stringify(doc.flags);
    expect(text).toContain(`"capabilityKey":"${key}"`);
  });

  it("у каждой пятёрки ручной ввод не нужен: профиль Голема несёт встроенный щит 1-50", () => {
    const golemDir = path.join(dir, "packs-src/bestiary/Существа_Элитных_архетипов");
    const file = fs.readdirSync(golemDir).find(f => f.includes("iFNQWM17E1eZRbOB"));
    const golem = JSON.parse(fs.readFileSync(path.join(golemDir, file), "utf8"));
    const shield = golem.items.find(i => i.type === "forcefield");
    expect(shield.system).toEqual(expect.objectContaining({ ratingMax: 50, overloadThreshold: 0, shieldType: "dome", shieldNature: "warp" }));
    expect(shield.flags["warhammer-dbc"].rubricShield).toBe(true);
    expect(shield._id).toMatch(/^[A-Za-z0-9]{16}$/);
    expect(shield._key).toBe(`!actors.items!iFNQWM17E1eZRbOB.${shield._id}`);
  });
});
