import { describe, it, expect } from "vitest";
import { collectRules } from "../../../module/rules/collect.mjs";
import {
  EXODITE_RULES, DRUKHARI_RULES, AZURIANE_RULES, HARLEQUIN_RULES, YNNARI_RULES, HALF_ELDAR_RULES
} from "../../../module/rules/library/aeldari.mjs";

/** Подставной актор: обычный литерал, без Foundry. */
const actor = (race, over = {}) => ({ system: { race, ...over }, items: [] });

const flagsOf = actor => collectRules(actor).flatMap(r => r.effects ?? [])
  .filter(e => e.kind === "grantFlag").map(e => e.target);

// «Своя папка Талантов» пяти рас (item-picker.mjs::talentGroupLock, wdbc-sauo)
// раньше проверялась сравнением system.race в самом пикере.
describe("возможности «своя папка Талантов» рас Аэльдари", () => {
  it("Экзодит получает talents.exodite", () => {
    expect(flagsOf(actor("exodite"))).toEqual(["talents.exodite", "psyker.ancientMastery"]);
  });

  it("Друкхари получает talents.drukhari", () => {
    expect(flagsOf(actor("drukhari"))).toEqual(["talents.drukhari", "psyker.ancientMastery"]);
  });

  // Субрасы Друкхари (Истиннорождённый/Мандрагора/Развалина) не меняют
  // system.race — но старые листы могли записать значение субрасы прямо в
  // race, и RACE_RULES регистрирует те же правила под всеми четырьмя ключами.
  it("исторические значения race субрас Друкхари тоже получают talents.drukhari", () => {
    expect(flagsOf(actor("truebornDrukhari"))).toEqual(["talents.drukhari", "psyker.ancientMastery"]);
    expect(flagsOf(actor("mandrake"))).toEqual(["talents.drukhari", "psyker.ancientMastery"]);
    expect(flagsOf(actor("wrack"))).toEqual(["talents.drukhari", "psyker.ancientMastery"]);
  });

  it("Азуриане получает talents.azuriane", () => {
    expect(flagsOf(actor("azuriane"))).toEqual(["talents.azuriane", "psyker.ancientMastery"]);
  });

  it("Арлекин получает talents.harlequin", () => {
    expect(flagsOf(actor("harlequin"))).toEqual(["talents.harlequin", "psyker.ancientMastery"]);
  });

  it("Иннари получает talents.ynnari", () => {
    expect(flagsOf(actor("ynnari"))).toEqual(["talents.ynnari", "psyker.ancientMastery"]);
  });

  it("у человека ни одного из этих флагов нет", () => {
    expect(flagsOf(actor("human"))).toEqual([]);
  });

  it("идентификаторы правил уникальны и в нижнем регистре", () => {
    const ids = [...EXODITE_RULES, ...DRUKHARI_RULES, ...AZURIANE_RULES, ...HARLEQUIN_RULES, ...YNNARI_RULES]
      .map(r => r.id);
    // ANCIENT_MASTERY_RULE — один и тот же объект-константа во всех пяти
    // массивах (не копия), поэтому в общем списке id пять одинаковых
    // "aeldari.psyker.ancient-mastery" — это ожидаемо, не дубль-баг: каждая
    // раса добавляет СВОЙ отдельный вход в RACE_RULES (sources.mjs), просто
    // ссылается на общий объект правила вместо копирования текста.
    const talentIds = ids.filter(id => id !== "aeldari.psyker.ancient-mastery");
    expect(new Set(talentIds).size).toBe(talentIds.length);
    expect(ids.every(id => id === id.toLowerCase())).toBe(true);
  });
});

// wdbc-l07y: «Аэльдари всегда используют Природу псайкера "Древнее
// Мастерство"» — раньше isAeldariRace() в module/sheets/tabs/psychic.mjs,
// теперь одна и та же запись в RULES каждой расы группы «Аэльдари».
describe("psyker.ancientMastery — у всех шести рас группы «Аэльдари»", () => {
  it("Полуэльдар (без своей папки Талантов) тоже получает флаг", () => {
    expect(flagsOf({ system: { race: "halfEldar" }, items: [] })).toEqual(["psyker.ancientMastery"]);
    expect(HALF_ELDAR_RULES.map(r => r.id)).toEqual(["aeldari.psyker.ancient-mastery"]);
  });

  it("у не-Аэльдари расы флага нет", () => {
    expect(flagsOf(actor("astartes"))).not.toContain("psyker.ancientMastery");
  });
});
