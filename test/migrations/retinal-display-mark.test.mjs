// test/migrations/retinal-display-mark.test.mjs
//
// Встроенный ретинальный дисплей (task-9b5f). Метку «Возможность»
// device.retinalDisplay (task-1a59) получили 33 записи пака — силовая броня
// Астартес, эльдарская и друкхарская броня, Маска Шпиона, Анимус Спекулюм,
// Всевидящее Око. Копии на уже созданных акторах — снимки момента выдачи, метки
// у них нет, и Целеуказатель/Омни-Прицел молча «бесполезны без дисплея»
// (combat/weapon-mods.mjs::modWornRequirementMet). Миграция догоняет копии.
//
// Данные — настоящие JSON packs-src: копия «до правки» — запись пака без
// группы Механики с меткой (так она выглядела до e2392d33c).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import { itemHasKey } from "../../module/rules/item-marker.mjs";
import { modWornRequirementMet, RETINAL_DISPLAY_CAPABILITY } from "../../module/combat/weapon-mods.mjs";
import { diffItemAgainstPack, MECH_PATH } from "../../module/apps/content-sync.mjs";
import { buildRetinalIndex, retinalMarkPatch, retinalMarkUpdates }
  from "../../module/migrations/retinal-display-mark.mjs";

const SYS = "warhammer-dbc";
const PACKS = ["armor", "gear", "implants"];

const DOCS = allPackDocuments(PACKS).map(({ file, doc }) => {
  const pack = file.replaceAll("\\", "/").split("/")[0];
  return { ...doc, uuid: `Compendium.warhammer-dbc.${pack}.Item.${doc._id}` };
});
const INDEX = buildRetinalIndex(DOCS);
const CARRIERS = DOCS.filter(d => itemHasKey(d, RETINAL_DISPLAY_CAPABILITY));
const byEn = en => DOCS.find(d => d.name.split("/")[0].trim() === en);

const hasMark = g => (g.entries ?? []).some(e => e.kind === "capability" && e.capabilityKey === RETINAL_DISPLAY_CAPABILITY);

/** Копия на акторе до правки пака: Механика без группы с меткой. */
function staleCopy(doc, { withSource = true, name = doc.name, id = "it1" } = {}) {
  const mechanics = structuredClone(doc.flags?.[SYS]?.mechanics ?? []).filter(g => !hasMark(g));
  const item = {
    id, type: doc.type, name, system: { ...structuredClone(doc.system), equipped: true },
    flags: { [SYS]: { mechanics } },
    _stats: withSource ? { compendiumSource: doc.uuid } : {}
  };
  item.getFlag = (scope, key) => item.flags?.[scope]?.[key];
  return item;
}

function applyPatch(item, patch) {
  for (const [path, v] of Object.entries(patch)) {
    const keys = path.split(".");
    let o = item;
    for (const k of keys.slice(0, -1)) o = (o[k] ??= {});
    o[keys.at(-1)] = v;
  }
  return item;
}

const targeter = { id: "m1", type: "weaponMod", name: "Target Designator", system: { installedOn: "w1", requiresWorn: ["Retinal Display", "Bionic Eye", "Mind Impulse Unit"] } };
const actorWith = items => ({ id: "a1", items: [...items] });

describe("Носители метки в паке", () => {
  it("33 записи — броня, снаряжение и имплант", () => {
    expect(CARRIERS).toHaveLength(33);
    expect(new Set(CARRIERS.map(d => d.type))).toEqual(new Set(["armor", "gear", "implant"]));
  }, PACK_SCAN_TIMEOUT);
});

describe("Копия, выданная до правки пака", () => {
  it("каждая из 33 копий (по uuid источника) получает метку", () => {
    for (const doc of CARRIERS) {
      const item = staleCopy(doc);
      expect(itemHasKey(item, RETINAL_DISPLAY_CAPABILITY), doc.name).toBe(false);
      const patch = retinalMarkPatch(item, INDEX);
      expect(patch, doc.name).not.toBeNull();
      applyPatch(item, patch);
      expect(itemHasKey(item, RETINAL_DISPLAY_CAPABILITY), doc.name).toBe(true);
    }
  });

  it("Механика копии после правки равна Механике пака (Терминаторская: Лимит пула + метка, порядок тот же)", () => {
    const doc = byEn("Mk IV Tartaros");
    const item = applyPatch(staleCopy(doc), retinalMarkPatch(staleCopy(doc), INDEX));
    expect(item.flags[SYS].mechanics).toEqual(doc.flags[SYS].mechanics);
  });

  it("Целеуказатель с надетой старой силовой бронёй: до миграции бесполезен, после — работает", () => {
    const armour = staleCopy(byEn("Mk VII Aquila"));
    expect(modWornRequirementMet(actorWith([targeter, armour]), targeter)).toBe(false);
    applyPatch(armour, retinalMarkPatch(armour, INDEX));
    expect(modWornRequirementMet(actorWith([targeter, armour]), targeter)).toBe(true);
  });

  it("переименованная ГМом броня опознаётся по uuid источника; без uuid — уже нет", () => {
    const doc = byEn("Mk X Primaris");
    const renamed = staleCopy(doc, { name: "Доспех брата Тарка" });
    expect(retinalMarkPatch(renamed, INDEX)).not.toBeNull();
    expect(retinalMarkPatch(staleCopy(doc, { withSource: false, name: "Доспех брата Тарка" }), INDEX)).toBeNull();
  });

  it("без uuid источника — по имени, в любом порядке половин", () => {
    const doc = byEn("Spy Mask");
    const item = staleCopy(doc, { withSource: false, name: "Маска Шпиона / Spy Mask" });
    expect(retinalMarkPatch(item, INDEX)).not.toBeNull();
  });

  it("Мк V Ересь и броня смертных метку не получают (в паке её у них нет)", () => {
    for (const en of ["Mk V Heresy", "Power Armour", "Light Power Armour"]) {
      const doc = byEn(en);
      expect(doc, en).toBeTruthy();
      expect(retinalMarkPatch(staleCopy(doc), INDEX), en).toBeNull();
      expect(retinalMarkPatch(staleCopy(doc, { withSource: false }), INDEX), en).toBeNull();
    }
  });

  it("предмет не того типа с тем же именем — не трогаем", () => {
    const item = { ...staleCopy(byEn("Spy Mask")), type: "armor" };
    expect(retinalMarkPatch(item, INDEX)).toBeNull();
  });

  it("собранный руками предмет, которого нет в паке, — не трогаем", () => {
    expect(retinalMarkPatch(staleCopy(byEn("Spy Mask"), { withSource: false, name: "Самодельные очки" }), INDEX)).toBeNull();
  });

  it("идемпотентна: метка уже есть — второй прогон не трогает", () => {
    const item = staleCopy(byEn("Guardian Armor"));
    applyPatch(item, retinalMarkPatch(item, INDEX));
    expect(retinalMarkPatch(item, INDEX)).toBeNull();
  });

  it("ГМ снял метку, уже приняв её через «Обновить мир» (она в опоре), — не возвращаем", () => {
    const doc = byEn("Kabalite Armour");
    const item = staleCopy(doc);
    item.flags[SYS].contentSync = { mechanicsBaseline: structuredClone(doc.flags[SYS].mechanics) };
    expect(retinalMarkPatch(item, INDEX)).toBeNull();
  });
});

describe("«Обновить мир» после миграции не показывает ложного конфликта", () => {
  it("опоры Механики нет — после правки строки по Механике нет", () => {
    const doc = byEn("Mk III Indominus");
    const item = applyPatch(staleCopy(doc), retinalMarkPatch(staleCopy(doc), INDEX));
    expect(diffItemAgainstPack(item, doc).filter(d => d.path === MECH_PATH)).toEqual([]);
  });

  it("опора Механики есть (снимок до правки пака) — догоняется той же группой", () => {
    const doc = byEn("Mk III Indominus");
    const item = staleCopy(doc);
    item.flags[SYS].contentSync = { mechanicsBaseline: structuredClone(item.flags[SYS].mechanics) };
    applyPatch(item, retinalMarkPatch(item, INDEX));
    expect(item.flags[SYS].contentSync.mechanicsBaseline).toEqual(doc.flags[SYS].mechanics);
    expect(diffItemAgainstPack(item, doc).filter(d => d.path === MECH_PATH)).toEqual([]);
  });
});

describe("Сбор обновлений по актору", () => {
  it("только копии без метки — одним списком", () => {
    const fresh = staleCopy(byEn("Aegis Armour"), { id: "b" });
    applyPatch(fresh, retinalMarkPatch(fresh, INDEX));
    const items = [staleCopy(byEn("All-Seeing Eye"), { id: "a" }), fresh, staleCopy(byEn("Mk V Heresy"), { id: "c" })];
    expect(retinalMarkUpdates(items, INDEX).map(u => u._id)).toEqual(["a"]);
  });
});
