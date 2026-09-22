// test/apps/mechanics-integral-rating.test.mjs
//
// wdbc-o368c: Черты с рейтингом выдают естественное оружие через
// kind:"integralAttack". Три вещи:
//   1. «X» в уроне оружия-образца подставляется рейтингом Черты (и Пробитие —
//      при флаге penetrationFromRating, Смертельное Естественное Оружие), а
//      при смене рейтинга выданная копия пересчитывается;
//   2. записи «по выбору» (equipOptional) спрашиваются ОДНИМ окном с
//      галочками — у существа бывает несколько естественных оружий;
//   3. Укус (X) — только в Борьбе: прячется из списков атак, пока нет
//      второго укуса без флага grappleOnly.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyItemMechanics, syncGrantedEquipment } from "../../module/apps/mechanics.mjs";
import { ratingTemplateOf, applyRatingTemplate, integralEntrySelected, grappleOnlyHidden,
         isBiteName, sourceRating } from "../../module/rules/integral-rating.mjs";

const FLAG = "warhammer-dbc";

describe("профиль от рейтинга — чистые функции", () => {
  it("урон с X — образец есть, X подставляется", () => {
    const t = ratingTemplateOf({ damage: "1d10+X" }, {});
    expect(applyRatingTemplate(t, 4)).toEqual({ damage: "1d10+4" });
  });
  it("Пробитие от рейтинга — по флагу", () => {
    const t = ratingTemplateOf({ damage: "2d10+X" }, { penetrationFromRating: true });
    expect(applyRatingTemplate(t, 3)).toEqual({ damage: "2d10+3", penetration: 3 });
  });
  it("без X и флага — образца нет (Кулак и прочие не трогаются)", () => {
    expect(ratingTemplateOf({ damage: "1d5-2" }, {})).toBeNull();
  });
  it("«X» внутри слова не считается (тип урона и т.п.)", () => {
    expect(ratingTemplateOf({ damage: "1d10+Xeno" }, {})).toBeNull();
  });
  it("рейтинг источника — только при hasRating", () => {
    expect(sourceRating({ hasRating: true, rating: 2 })).toBe(2);
    expect(sourceRating({ hasRating: false, rating: 2 })).toBeNull();
  });
  it("«по выбору» проходит только отмеченное; обычная запись — всегда", () => {
    expect(integralEntrySelected({ id: "a" }, undefined)).toBe(true);
    expect(integralEntrySelected({ id: "a", equipOptional: true }, undefined)).toBe(false);
    expect(integralEntrySelected({ id: "a", equipOptional: true }, ["a"])).toBe(true);
    expect(integralEntrySelected({ id: "a", equipOptional: true }, ["b"])).toBe(false);
  });
});

describe("Укус (X) — только в Борьбе", () => {
  const w = (name, flags = {}) => ({ type: "weapon", name, flags: { [FLAG]: flags } });
  it("один укус с grappleOnly — спрятан", () => {
    const bite = w("Bite / Укус", { grappleOnly: true });
    expect(grappleOnlyHidden(bite, [bite], isBiteName)).toBe(true);
  });
  it("есть второй укус без флага — виден (книга: «как часть обычной атаки»)", () => {
    const bite = w("Bite / Укус", { grappleOnly: true });
    const nw = w("Bite (Natural Weapons) / Укус (Естественное Оружие)");
    expect(isBiteName(nw)).toBe(true);
    expect(grappleOnlyHidden(bite, [bite, nw], isBiteName)).toBe(false);
  });
  it("обычное оружие не трогается", () => {
    const claws = w("Claws / Когти");
    expect(grappleOnlyHidden(claws, [claws], isBiteName)).toBe(false);
  });
});

// ── Сквозной проход через Конструктор ───────────────────────────────────────

const WEAPONS = {
  "Compendium.w.claws": { name: "Когти", type: "weapon", system: { damage: "1d10+X", penetration: 0, weaponClass: "melee" },
                          flags: { [FLAG]: { penetrationFromRating: true } } },
  "Compendium.w.horns": { name: "Рога", type: "weapon", system: { damage: "2d10+X", penetration: 0, weaponClass: "melee" },
                          flags: { [FLAG]: { penetrationFromRating: true } } }
};

function makeDoc(data, id) {
  const doc = { id, ...structuredClone(data) };
  doc.getFlag = (_s, k) => doc.flags?.[FLAG]?.[k];
  return doc;
}

function traitOnActor({ rating = 3 } = {}) {
  const actor = new Actor();
  actor.system = {};
  const list = [];
  actor.items = list;
  let seq = 0;
  actor.createEmbeddedDocuments = async (_t, docs) => {
    const made = docs.map(d => makeDoc(d, `w-${seq++}`));
    list.push(...made);
    return made;
  };
  actor.deleteEmbeddedDocuments = async (_t, ids) => {
    for (const id of ids) list.splice(list.findIndex(i => i.id === id), 1);
    return ids;
  };
  actor.updateEmbeddedDocuments = async (_t, updates) => {
    for (const { _id, ...patch } of updates) {
      const it = list.find(i => i.id === _id);
      for (const [path, v] of Object.entries(patch)) it.system[path.replace("system.", "")] = v;
    }
    return updates;
  };
  const own = {
    mechanics: [{ id: "g1", operator: "AND", entries: [
      { id: "e-claws", kind: "integralAttack", equipSourceUuid: "Compendium.w.claws", equipSourceName: "Когти", equipOptional: true },
      { id: "e-horns", kind: "integralAttack", equipSourceUuid: "Compendium.w.horns", equipSourceName: "Рога", equipOptional: true }
    ] }]
  };
  const item = {
    id: "trait-nw", uuid: "Actor.a.Item.trait-nw", type: "trait", name: "Естественное Оружие (X)",
    system: { hasRating: true, rating }, parent: actor, effects: [],
    getFlag: (_s, k) => own[k],
    setFlag: async (_s, k, v) => { own[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete own[k]; },
    update: async () => item,
    createEmbeddedDocuments: async () => [],
    deleteEmbeddedDocuments: async () => []
  };
  list.push(item);
  return { actor, item, list };
}

/** Кнопка «Применить» окна с галочками: отмечены ids. */
function pickChecked(ids) {
  const html = { find: () => ({ map: fn => ({ get: () => ids.map((v, i) => fn(i, { value: v })) }) }) };
  return captured.dialog.buttons.pick.callback(html);
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.user = { isGM: true };
  globalThis.fromUuid = async uuid => {
    const d = WEAPONS[uuid];
    return d ? { ...d, toObject: () => structuredClone(d) } : null;
  };
});

describe("Естественное Оружие (X): окно с галочками и подстановка X", () => {
  it("отмечены Когти — выдаются только они, урон и Пробитие по рейтингу", async () => {
    const { item, list } = traitOnActor({ rating: 3 });
    const run = applyItemMechanics(item);
    await new Promise(r => setTimeout(r, 0));
    expect(captured.dialog?.buttons?.pick).toBeTruthy();
    pickChecked(["e-claws"]);
    await run;

    const weapons = list.filter(i => i.type === "weapon");
    expect(weapons.map(w => w.name)).toEqual(["Когти"]);
    expect(weapons[0].system.damage).toBe("1d10+3");
    expect(weapons[0].system.penetration).toBe(3);
    expect(weapons[0].system.equipped).toBe(true);
    expect(item.getFlag(FLAG, "integralChosen")).toEqual(["e-claws"]);
  });

  it("повторное применение не переспрашивает и не задваивает", async () => {
    const { item, list } = traitOnActor();
    const run = applyItemMechanics(item);
    await new Promise(r => setTimeout(r, 0));
    pickChecked(["e-claws", "e-horns"]);
    await run;
    captured.dialog = null;

    await applyItemMechanics(item);
    expect(captured.dialog).toBeNull();
    expect(list.filter(i => i.type === "weapon").map(w => w.name).sort()).toEqual(["Когти", "Рога"]);
  });

  it("смена рейтинга Черты — выданное оружие пересчитывается", async () => {
    const { item, list } = traitOnActor({ rating: 2 });
    const run = applyItemMechanics(item);
    await new Promise(r => setTimeout(r, 0));
    pickChecked(["e-horns"]);
    await run;

    item.system.rating = 5;
    await syncGrantedEquipment(item);
    const horns = list.find(i => i.name === "Рога");
    expect(horns.system.damage).toBe("2d10+5");
    expect(horns.system.penetration).toBe(5);
  });
});
