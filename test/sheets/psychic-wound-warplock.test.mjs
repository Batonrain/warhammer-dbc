// test/sheets/psychic-wound-warplock.test.mjs
//
// Пачка I2 (Псайкана, Sahara 3-28) в самой игре — карточка манифестации, окно манифестации и
// вкладка МИСТИКА: +10 к Феномену от ауры Раны в Реальности, галочка «бесплатная» в окне,
// кнопка Варп-Замка под Феноменом, панель Варп-Замка на вкладке. Таланты — настоящие записи пака.

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, sheetOf, fakeHtml } from "../support/foundry-stub.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { executePsychotest, showManifestDialog } from "../../module/sheets/tabs/psychic.mjs";
import { handleCalmWarpClick } from "../../module/combat/calm-warp.mjs";
import { WOUND_FREE_FLAG } from "../../module/rules/wound-in-reality.mjs";
import { WARP_LOCK_FLAG } from "../../module/rules/warp-lock.mjs";
import { buildGetData } from "../../module/sheets/sheet-helpers.mjs";
import { WarhammerCharacterSheet } from "../../module/sheets/actor-sheet.mjs";

foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);

const DIR = "packs-src/talents/Псайкана";
const WOUND = "HlOOH4XLJ1Oilfjn", WARP = "qNtduQTIpI7yyfgY";

function talent(id) {
  const doc = packDocById(DIR, id);
  const store = {};
  return { id: doc._id, type: "talent", name: doc.name, system: { ...doc.system }, flags: { "warhammer-dbc": store },
    getFlag: (s, k) => store[k], setFlag: async (s, k, v) => { store[k] = v; } };
}
function power(extra = {}, flags = {}) {
  const store = { ...flags };
  const it = { id: "p1", uuid: "Actor.actor-1.Item.p1", name: "Эгида / Aegis", type: "psychicPower",
    system: { testChar: "wp", powerType: "infusion", action: "half", testMod: 0, ...extra }, updates: [],
    getFlag: (s, k) => store[k], setFlag: async (s, k, v) => { store[k] = v; }, unsetFlag: async (s, k) => { delete store[k]; },
    update: async d => { it.updates.push(d); for (const [k, v] of Object.entries(d)) if (k.startsWith("system.")) it.system[k.slice(7)] = v; return d; } };
  return it;
}
function marker(src = "Actor.psyker.Item.wound") {
  const d = packDocById("packs-src/traits", "WoundRealityAura");
  return { id: "mk1", type: "trait", name: d.name, system: { ...d.system }, flags: { "warhammer-dbc": { auraSource: src } },
    getFlag(s, k) { return this.flags[s]?.[k]; } };
}
function actor(items = [], { cor = 30, flags = {} } = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const store = { ...flags };
  const a = Object.assign(new Actor(), {
    id: "actor-1", name: "Псайкер", uuid: "Actor.actor-1", type: "character", isOwner: true, items: list, updates: [],
    getFlag: (s, k) => store[`${k}`], setFlag: async (s, k, v) => { store[k] = v; }, unsetFlag: async (s, k) => { delete store[k]; },
    system: {
      race: "human", fatigue: { value: 0 }, fate: { value: 3, max: 5 },
      psyker: { rating: 9, currentRating: 9, sustain: 0, class: "bound" },
      skills: {}, corruption: { value: cor }, corruptionBonus: 3, alignment: "",
      wounds: { value: 8, max: 10, critical: 0 }, conditions: {}, actionPoints: { value: 2, max: 2 },
      characteristics: { wp: { total: 40, value: 40, bonus: 4 }, int: { total: 40, value: 40, bonus: 4 } }
    },
    update: async d => { a.updates.push(d); return d; },
    updateEmbeddedDocuments: async () => []
  });
  return a;
}
const opts = (mPR, mode, extra = {}) => ({ mPR, prMod: 0, mode, path: "", modifier: 0, eldar: false, pushChoice: 1,
  damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1, ...extra });
const allChat = () => captured.chat.map(m => String(m.content ?? "")).join("\n");
const plain = () => allChat().replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const cast = async (a, p, o, dice = null) => {
  captured.chat.length = 0; captured.rolls.length = 0; captured.nextRoll = 50; captured.dice = dice;
  await executePsychotest(a, p, o);
};

let prevSync;
beforeEach(() => {
  resetCaptured();
  globalThis.game.user = { targets: new Set() };
  globalThis.game.combat = undefined;
  globalThis.game.users = { activeGM: { id: "gm" } };
  prevSync = globalThis.fromUuidSync;
  // Источник ауры — псайкер с платным поддержанием 3 PR и двумя бесплатными силами → N = 2.
  const src = actor([talent(WOUND),
    Object.assign(power({ isSustained: true, sustainCost: 3 }), { id: "a" }),
    Object.assign(power({ isSustained: true, sustainCost: 1 }, { [WOUND_FREE_FLAG]: true }), { id: "f1" }),
    Object.assign(power({ isSustained: true, sustainCost: 1 }, { [WOUND_FREE_FLAG]: true }), { id: "f2" })]);
  globalThis.fromUuidSync = uuid => (uuid === "Actor.psyker.Item.wound" ? { parent: src } : null);
});
afterEach(() => { globalThis.fromUuidSync = prevSync; });

describe("аура Раны в Реальности: бросок Феномена", () => {
  it("в ауре Усиленная манифестация (Феномен гарантирован) получает +10 за каждую силу — карточка показывает мод", async () => {
    const a = actor([marker()]);
    await cast(a, power(), opts(9, "push"), [10, 50, 50, 50, 50]);
    const text = plain();
    expect(text).toContain("Рана в Реальности (аура): +20 к броску Феномена");
    expect(text).toMatch(/мод \+(\d+)/);
    // бросок Феномена: 1d100 + мод, мод включает +20 ауры
    expect(captured.rolls.some(f => /^1d100 \+ \d+/.test(String(f)) && Number(String(f).split("+")[1]) >= 20)).toBe(true);
  });
  it("вне ауры строки нет", async () => {
    await cast(actor(), power(), opts(9, "push"), [10, 50, 50, 50, 50]);
    expect(plain()).not.toContain("Рана в Реальности");
  });
});

describe("окно манифестации: галочка «бесплатная»", () => {
  const withSustained = (cost) => Object.assign(power({ isSustained: true, sustainCost: cost }), { id: "base" });
  it("носителю при 3+ платных PR — галочка есть", () => {
    const a = actor([talent(WOUND), withSustained(3)]);
    showManifestDialog(a, power({ sustainable: true }));
    expect(captured.dialog.content).toContain('id="psy-woundfree"');
    expect(captured.dialog.content).toContain("поддерживать бесплатно");
  });
  it("платных меньше 3 — галочки нет, объяснено почему", () => {
    const a = actor([talent(WOUND), withSustained(1)]);
    showManifestDialog(a, power({ sustainable: true }));
    expect(captured.dialog.content).not.toContain('type="checkbox" id="psy-woundfree"');
    expect(captured.dialog.content).toContain("хотя бы 3 PR");
  });
  it("сила, которую поддерживать нельзя, галочки не получает", () => {
    const a = actor([talent(WOUND), withSustained(3)]);
    showManifestDialog(a, power({ sustainable: false }));
    expect(captured.dialog.content).not.toContain("psy-woundfree");
  });
  it("без Таланта — ни галочки, ни пояснения", () => {
    showManifestDialog(actor(), power());
    expect(captured.dialog.content).not.toContain("psy-woundfree");
  });
  it("удавшаяся манифестация с галочкой ставит пометку на силу", async () => {
    const base = withSustained(3);
    const a = actor([talent(WOUND), base]);
    const p = power();
    a.items.push(p);
    await cast(a, p, opts(9, "normal", { woundFree: true }), [10, 30]);
    expect(p.getFlag("warhammer-dbc", WOUND_FREE_FLAG)).toBe(true);
    expect(plain()).toContain("поддерживается бесплатно");
  });
  it("провал манифестации — пометки нет", async () => {
    const a = actor([talent(WOUND), withSustained(3)]);
    const p = power();
    a.items.push(p);
    await cast(a, p, opts(9, "normal", { woundFree: true }), [95, 30]);
    expect(p.getFlag("warhammer-dbc", WOUND_FREE_FLAG)).toBeUndefined();
  });
});

describe("окно манифестации: кнопка «Психотест!» передаёт галочку в бросок", () => {
  it("отмеченная «бесплатная» доходит до пометки силы", async () => {
    const a = actor([talent(WOUND), Object.assign(power({ isSustained: true, sustainCost: 3 }), { id: "base" })]);
    const p = power({ sustainable: true });
    a.items.push(p);
    showManifestDialog(a, p);
    const cast = captured.dialog.buttons.cast.callback;
    captured.dice = [10, 30]; captured.nextRoll = 50;
    await cast(fakeHtml({ "#psy-woundfree": true, "#psy-pr": "9", "#psy-mode": "normal" }));
    expect(p.getFlag("warhammer-dbc", WOUND_FREE_FLAG)).toBe(true);
  });
});

describe("Варп-Замок на карточке Феномена", () => {
  it("кнопка под Феноменом манифестации — только у носителя Таланта", async () => {
    await cast(actor([talent(WARP)]), power(), opts(9, "push"), [10, 50, 50, 50, 50]);
    expect(allChat()).toContain("wh-warplock-btn");
    await cast(actor(), power(), opts(9, "push"), [10, 50, 50, 50, 50]);
    expect(allChat()).not.toContain("wh-warplock-btn");
  });
  it("и под переброшенным Феноменом Усмирения Варпа", async () => {
    const a = actor([talent(WARP)], { cor: 30 });
    globalThis.fromUuid = async () => a;
    captured.dice = [20];
    const message = { isOwner: true, getFlag: () => undefined, setFlag: async () => {} };
    await handleCalmWarpClick(message, { dataset: { actorUuid: a.uuid, table: "phenomenon", phenMod: "0" }, disabled: false });
    expect(allChat()).toContain("wh-warplock-btn");
  });
});

describe("вкладка МИСТИКА: панель Варп-Замка и кнопка ⌬", () => {
  const sheetFor = (items, flags = {}) => {
    const sheet = sheetOf(WarhammerCharacterSheet, {
      items, characteristics: { int: { value: 40, total: 40, bonus: 4 }, wp: { value: 40, total: 40, bonus: 4 } },
      skills: {}, groupSkills: {}, psyker: { rating: 9, currentRating: 9 }, corruptionBonus: 3
    });
    sheet.actor.items.contents = sheet.actor.items;
    const base = sheet.actor.getFlag;
    sheet.actor.getFlag = (s, k) => (k in flags ? flags[k] : base?.call(sheet.actor, s, k));
    return sheet;
  };
  const powerDoc = (id, name, system, flags = {}) => ({ id, name, type: "psychicPower", system: { testChar: "wp", prRequired: 1, sustainable: true, ...system },
    getFlag: (s, k) => flags[k] });

  it("панель у носителя Таланта: подавить потенциал доступно, метка не стоит", () => {
    const ctx = buildGetData(sheetFor([talent(WARP)]).actor);
    expect(ctx.psyPools.warpLock.hasTalent).toBe(true);
    expect(ctx.psyPools.warpLock.suppressOk).toBe(true);
    expect(ctx.psyPools.warpLock.suppressMax).toBe(4);
    expect(ctx.psyPools.warpLock.active).toBe(false);
  });
  it("метка «не псайкер» видна в панели", () => {
    const ctx = buildGetData(sheetFor([talent(WARP)], { [WARP_LOCK_FLAG]: true }).actor);
    expect(ctx.psyPools.warpLock.active).toBe(true);
    expect(ctx.psyPools.warpLock.suppressOk).toBe(false);
  });
  it("без Таланта панели нет", () => {
    expect(buildGetData(sheetFor([]).actor).psyPools).toBeNull();
  });
  it("у поддерживаемой силы носителя Раны в Реальности — кнопка ⌬ с состоянием", () => {
    const items = [talent(WOUND),
      powerDoc("base", "Платная", { isSustained: true, sustainCost: 3 }),
      powerDoc("f", "Бесплатная", { isSustained: true, sustainCost: 1 }, { [WOUND_FREE_FLAG]: true }),
      powerDoc("c", "Кандидат", { isSustained: true, sustainCost: 1 })];
    const rows = Object.fromEntries(buildGetData(sheetFor(items).actor).psyPowers.map(p => [p.name, p.wound]));
    expect(rows["Бесплатная"].on).toBe(true);
    expect(rows["Бесплатная"].effective).toBe(true);
    expect(rows["Кандидат"].on).toBe(false);
    expect(rows["Кандидат"].ok).toBe(true);
  });
  it("у не-носителя кнопки ⌬ нет", () => {
    const rows = buildGetData(sheetFor([powerDoc("a", "Сила", { isSustained: true })]).actor).psyPowers;
    expect(rows[0].wound).toBeNull();
  });
});

// Ревью #554: кнопки Варп-Замка носили класс «+1 ⟳» ради стиля, а обработчик
// `.psy-fluid-restore-btn` (sheets/tabs/psychic.mjs) возвращает очко Плетения за
// 2 ОД и Концентрацию — один клик запускал обе траты.
describe("вкладка МИСТИКА: кнопки Варп-Замка не делят класс с «+1 ⟳» Текучего Плетения", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const hbs = fs.readFileSync(path.join(root, "templates/actor/parts/tab-psy.hbs"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles/sheets/actor-psy.css"), "utf8");
  const warpLockBtns = [...hbs.matchAll(/<button[^>]*class="([^"]*psy-warplock-[^"]*)"/g)].map(m => m[1].split(/\s+/));

  it("ни у одной из трёх кнопок нет класса psy-fluid-restore-btn, стиль — свой класс psy-pool-btn", () => {
    expect(warpLockBtns).toHaveLength(3);
    for (const cls of warpLockBtns) {
      expect(cls).not.toContain("psy-fluid-restore-btn");
      expect(cls).toContain("psy-pool-btn");
    }
    expect(css).toMatch(/\.psy-pool-btn\b/);
  });
});
