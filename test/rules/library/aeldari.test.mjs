import { describe, it, expect } from "vitest";
import { collectRules } from "../../../module/rules/collect.mjs";
import {
  EXODITE_RULES, DRUKHARI_RULES, AZURIANE_RULES, HARLEQUIN_RULES, YNNARI_RULES
} from "../../../module/rules/library/aeldari.mjs";

/** Подставной актор: обычный литерал, без Foundry. */
const actor = (race, over = {}) => ({ system: { race, ...over }, items: [] });

const flagsOf = actor => collectRules(actor).flatMap(r => r.effects ?? [])
  .filter(e => e.kind === "grantFlag").map(e => e.target);

// «Своя папка Талантов» пяти рас (item-picker.mjs::talentGroupLock, wdbc-sauo)
// раньше проверялась сравнением system.race в самом пикере.
describe("возможности «своя папка Талантов» рас Аэльдари", () => {
  it("Экзодит получает talents.exodite", () => {
    expect(flagsOf(actor("exodite"))).toEqual(["talents.exodite"]);
  });

  it("Друкхари получает talents.drukhari", () => {
    expect(flagsOf(actor("drukhari"))).toEqual(["talents.drukhari"]);
  });

  // Субрасы Друкхари (Истиннорождённый/Мандрагора/Развалина) не меняют
  // system.race — но старые листы могли записать значение субрасы прямо в
  // race, и RACE_RULES регистрирует те же правила под всеми четырьмя ключами.
  it("исторические значения race субрас Друкхари тоже получают talents.drukhari", () => {
    expect(flagsOf(actor("truebornDrukhari"))).toEqual(["talents.drukhari"]);
    expect(flagsOf(actor("mandrake"))).toEqual(["talents.drukhari"]);
    expect(flagsOf(actor("wrack"))).toEqual(["talents.drukhari"]);
  });

  it("Азуриане получает talents.azuriane", () => {
    expect(flagsOf(actor("azuriane"))).toEqual(["talents.azuriane"]);
  });

  it("Арлекин получает talents.harlequin", () => {
    expect(flagsOf(actor("harlequin"))).toEqual(["talents.harlequin"]);
  });

  it("Иннари получает talents.ynnari", () => {
    expect(flagsOf(actor("ynnari"))).toEqual(["talents.ynnari"]);
  });

  it("у человека ни одного из этих флагов нет", () => {
    expect(flagsOf(actor("human"))).toEqual([]);
  });

  it("идентификаторы правил уникальны и в нижнем регистре", () => {
    const ids = [...EXODITE_RULES, ...DRUKHARI_RULES, ...AZURIANE_RULES, ...HARLEQUIN_RULES, ...YNNARI_RULES]
      .map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(id => id === id.toLowerCase())).toBe(true);
  });
});
