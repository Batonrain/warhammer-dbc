// test/rules/requisition-places.test.mjs
//
// «Таблица Модификаторов реквизиции» по месту (Книга Пустоты, «Реквизиция
// узлов»; Sahara 10-4eac, решение владельца 27.10.2026): выбор места в окне
// «Достать снаряжение», режим «Узел корабля». Сдвиг Редкости, штраф теста и
// недоступность считаются сами; «Поправка ГМа» остаётся для прочего.
//
// Таблица сверяется с текстом книги (void.json: порядок, «Место», «Правила»
// слово в слово), поведение каждой строки — с ОЖИДАНИЕМ, выписанным здесь из
// книги отдельно от данных; узлы, Талант Peer и фракции — настоящие, из
// packs-src (talents/Социальные/Peer, factions/, ship-components/).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { REQUISITION_PLACES, DEFAULT_PLACE, FAITH_FOLDER, placeByKey } from "../../module/constants/requisition-places.mjs";
import { placeEffect, nodeTraits, normPlace } from "../../module/rules/requisition-places.mjs";
import { requisitionPlan, requisitionSummaryLines, rarityMod, qualityMod } from "../../module/rules/requisition.mjs";
import { factionTarget } from "../../module/rules/talent-targets.mjs";
import { setFactionIndex, clearFactionIndex } from "../../module/rules/factions.mjs";
import { allPackDocuments, PACKS_SRC, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";

// ── Настоящие данные ────────────────────────────────────────────────────────

const factionDocs = () => allPackDocuments("factions").map(d => d.doc).filter(d => d.type === "faction");
const factionDoc = key => {
  const f = factionDocs().find(d => d.system?.key === key);
  expect(f, `фракция ${key} в packs-src/factions`).toBeTruthy();
  return f;
};
const PEER = (() => {
  const files = allPackDocuments("talents").filter(d => /^Peer \/ Связи$/.test(d.doc.name));
  expect(files.length, "Талант Peer / Связи в паке").toBe(1);
  return files[0].doc;
})();
const peerOf = key => ({ ...PEER, system: { ...PEER.system, targets: [factionTarget(factionDoc(key))] } });
const actorWith = (...items) => ({ type: "character", name: "Тест", items, system: { characteristics: { inf: { total: 45 } } } });

/** Узлы пака: документ + папка, как её видит живой предмет (item.folder.name). */
const nodes = () => allPackDocuments("ship-components")
  .filter(({ doc }) => doc.type === "component")
  .map(({ file, doc }) => ({ ...doc, folder: { name: path.basename(path.dirname(file)) } }));

const has = (n, key) => (n.system.shipProps ?? []).some(p => p.key === key);

let N;   // образцы настоящих узлов
beforeAll(() => {
  setFactionIndex(factionDocs());
  const all = nodes();
  const pick = (label, fn) => {
    const n = all.find(fn);
    expect(n, `образец в паке: ${label}`).toBeTruthy();
    return n;
  };
  const clean = n => !has(n, "archeotech") && !has(n, "xenotech") && !has(n, "highSpirit") && !has(n, "enduringSpirit");
  N = {
    essential:    pick("Необходимый не-орудие",      n => n.system.essential && n.system.kind !== "weapon" && clean(n)),
    plain:        pick("обычный не-Необходимый узел (ни орудие, ни Дополнительный)", n => !n.system.essential
      && !["weapon", "supplemental"].includes(n.system.kind) && clean(n)),
    weapon:       pick("орудие",                      n => n.system.kind === "weapon" && !n.system.essential && clean(n)),
    supplemental: pick("Дополнительный",              n => n.system.kind === "supplemental" && !n.system.essential && clean(n) && n.folder.name !== FAITH_FOLDER),
    archeotech:   pick("Археотех",                    n => has(n, "archeotech")),
    xenotech:     pick("Ксенотех",                    n => has(n, "xenotech")),
    highSpirit:   pick("High Spirit",                 n => has(n, "highSpirit")),
    enduring:     pick("Enduring Spirit",             n => has(n, "enduringSpirit")),
    faith:        pick("узел веры (папка «Вера»)",    n => n.folder.name === FAITH_FOLDER)
  };
}, PACK_SCAN_TIMEOUT);
afterAll(() => clearFactionIndex());

// ── 1. Таблица совпадает с книгой ───────────────────────────────────────────

const strip = s => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, "");
const bookRows = (() => {
  const text = fs.readFileSync(path.join(PACKS_SRC, "books", "void.json"), "utf8");
  const m = text.match(/<td><strong>Таблица Модификаторов реквизиции<\/strong><\/td><\/tr>[\s\S]*?<\/tbody><\/table>/);
  if (!m) throw new Error("таблица «Модификаторов реквизиции» в Книге Пустоты не найдена");
  const rows = [...m[0].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(r => [...r[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map(c => c[1]));
  // первые две строки — заголовок таблицы и «Место / Правила / Установка»
  return rows.filter(r => r.length === 3).slice(1);
})();

describe("таблица мест совпадает с текстом книги (void.json)", () => {
  it("20 строк, порядок и «Место» дословно", () => {
    expect(bookRows).toHaveLength(20);
    expect(REQUISITION_PLACES.map(p => strip(p.label))).toEqual(bookRows.map(r => strip(r[0])));
  });
  it("«Правила» — слово в слово", () => {
    REQUISITION_PLACES.forEach((p, i) => expect(strip(p.rule), p.label).toBe(strip(bookRows[i][1])));
  });
  it("ключи уникальны, место по умолчанию — «Цивилизованный мир» (книга: «Нет»)", () => {
    expect(new Set(REQUISITION_PLACES.map(p => p.key)).size).toBe(REQUISITION_PLACES.length);
    expect(placeByKey(DEFAULT_PLACE).label).toBe("Цивилизованный мир");
    expect(strip(bookRows[1][1])).toBe("Нет");
    expect(normPlace("что-то-левое")).toBe(DEFAULT_PLACE);
    expect(normPlace(undefined)).toBe(DEFAULT_PLACE);
  });
  it("числа в данных — только те, что названы в книге: сдвиги ±1 шаг, штраф −10", () => {
    for (const p of REQUISITION_PLACES) {
      for (const s of p.shifts ?? []) expect(Math.abs(s.value), p.label).toBe(1);
      if (p.testMod != null) expect(p.testMod, p.label).toBe(-10);
    }
    // «−10 к тестам реквизиции» — ровно у двух мест: станция и пиратская станция
    expect(REQUISITION_PLACES.filter(p => p.testMod).map(p => p.key)).toEqual(["deepStation", "pirateStation"]);
    expect(strip(bookRows[3][1])).toMatch(/^-10ктестамреквизиции/);
    expect(strip(bookRows[10][1])).toMatch(/тестыреквизицииполучают-10/);
  });
});

// ── 2. Ожидание по каждой строке, выписанное из книги ───────────────────────

/** Сдвиг Редкости узла: число, либо "X" — узел на этом месте недоступен. */
const SPEC = {
  backwater:     { all: +1 },                                              // «Редкость всех узлов повышается на шаг»
  civilized:     {},                                                       // «Нет»
  colony:        { essential: +1 },                                        // «Необходимых узлов повышается на шаг»
  deepStation:   { test: -10 },                                            // «-10 к тестам реквизиции»
  savage:        { all: "X" },                                             // «Узлы недоступны.»
  vassal:        { flag: "suzerain", all: -1 },                            // «Для сюзерена … на шаг ниже»
  mining:        {},                                                       // Длительный Ремонт — не реквизиция узла
  fleetBase:     { peer: "imperial-navy", all: -1, archeotech: 0, xenotech: "X" },
  hive:          { all: -1, archeotech: 0, xenotech: "X" },
  forgeWorld:    { peer: "adeptus-mechanicus", all: -1, xenotech: 0 },
  pirateStation: { test: -10 },                                            // «Доступны все узлы, но тесты реквизиции получают -10»
  hellForge:     { flag: "controllerPeer", all: -1 },
  daemonWorld:   { flag: "approved", all: -1 },
  templeWorld:   { bonusPeer: "ecclesiarchy", faith: -1 },                 // «При Peer (Ecclesiarchy) все узлы, связанные с верой»
  agriWorld:     { weapon: +1 },
  fortressWorld: { weapon: -1 },
  graveyard:     { supplemental: +1 },
  pleasureWorld: { spirit: -1 },
  penalColony:   { all: +1 },
  greatShipyard: { all: -1 }
};

/** Ожидаемое для узла `n` на месте `key`: {blocked}|{shift, test}; actor/flags готовит вызывающий. */
function expectedFor(key, n) {
  const spec = SPEC[key];
  const t = nodeTraits(n);
  const hit = {
    all: true, essential: t.essential, weapon: t.kind === "weapon", supplemental: t.kind === "supplemental",
    spirit: t.spirit, faith: t.faith
  };
  let shift = 0;
  for (const k of Object.keys(hit)) if (spec[k] !== undefined && hit[k]) shift = spec[k];
  if (shift === "X") return { blocked: true };
  if (spec.xenotech === "X" && t.xenotech) return { blocked: true };
  if (spec.archeotech === 0 && t.archeotech) shift = 0;
  if (spec.xenotech === 0 && t.xenotech) shift = 0;
  return { blocked: false, shift, test: spec.test ?? 0 };
}

const peerActor = key => actorWith(peerOf(key));
/** Актор и условия, при которых строка работает «в полную силу». */
function full(key) {
  const spec = SPEC[key];
  const actor = spec.peer ? peerActor(spec.peer) : (spec.bonusPeer ? peerActor(spec.bonusPeer) : actorWith());
  return { actor, flags: spec.flag ? { [spec.flag]: true } : {} };
}

describe("каждая строка таблицы на настоящих узлах (при выполненных условиях)", () => {
  for (const place of REQUISITION_PLACES) {
    it(`${place.label}`, () => {
      expect(SPEC[place.key], "ожидание по строке выписано").toBeTruthy();
      const { actor, flags } = full(place.key);
      for (const [name, n] of Object.entries(N)) {
        const want = expectedFor(place.key, n);
        const eff = placeEffect(place.key, { item: n, actor, flags });
        if (want.blocked) {
          expect(eff.blocked, `${name}: недоступен`).toBeTruthy();
          continue;
        }
        expect(eff.blocked, `${name}: доступен`).toBeNull();
        const shift = eff.shifts.reduce((s, x) => s + x.value, 0);
        expect(shift, `${name}: сдвиг Редкости`).toBe(want.shift);
        expect(eff.testMod, `${name}: штраф теста`).toBe(want.test);
      }
    }, PACK_SCAN_TIMEOUT);
  }
  it("ожидание покрывает ровно строки таблицы", () => {
    expect(Object.keys(SPEC)).toEqual(REQUISITION_PLACES.map(p => p.key));
  });
});

// ── 3. Условия: Peer, флаги ─────────────────────────────────────────────────

describe("условия строк: Peer на листе и отмеченные условия", () => {
  it("База Флота без Peer (Imperial Navy) — отказ с причиной; с Peer — работает", () => {
    const e = placeEffect("fleetBase", { item: N.plain, actor: actorWith() });
    expect(e.blocked).toMatch(/Peer \(Imperial Navy\)/);
    expect(e.blocked).toMatch(/База Флота/);
    expect(placeEffect("fleetBase", { item: N.plain, actor: peerActor("imperial-navy") }).blocked).toBeNull();
  });
  it("Peer другой фракции не годится: Mechanicus на Базе Флота — отказ; Imperial Navy в Мире-кузне — отказ", () => {
    expect(placeEffect("fleetBase", { item: N.plain, actor: peerActor("adeptus-mechanicus") }).blocked).toBeTruthy();
    expect(placeEffect("forgeWorld", { item: N.plain, actor: peerActor("imperial-navy") }).blocked).toBeTruthy();
    expect(placeEffect("forgeWorld", { item: N.plain, actor: peerActor("adeptus-mechanicus") }).blocked).toBeNull();
  });
  it("Peer к родителю фракции (Империум) НЕ покрывает Флот, Кузню и Храм — нужна точная фракция, без дерева (решение владельца 27.10.2026)", () => {
    const imperium = peerActor("imperium");
    const fleet = placeEffect("fleetBase", { item: N.plain, actor: imperium });
    expect(fleet.blocked).toMatch(/Peer \(Imperial Navy\)/);
    expect(placeEffect("forgeWorld", { item: N.plain, actor: imperium }).blocked).toMatch(/Peer \(Mechanicus\)/);
    expect(placeEffect("templeWorld", { item: N.faith, actor: imperium }).shifts).toEqual([]);
    // Дерево фракций загружено (beforeAll: imperium — родитель imperial-navy), и всё равно не наследуется;
    // чужая фракция тоже не годится
    expect(placeEffect("fleetBase", { item: N.plain, actor: peerActor("chaos") }).blocked).toBeTruthy();
  });
  it("Peer с несколькими целями: годится, если среди них есть точная фракция; нефракционные цели не мешают", () => {
    const multi = actorWith({ ...PEER, system: { ...PEER.system, targets: [
      factionTarget(factionDoc("imperium")), { kind: "race", value: "ork" }, factionTarget(factionDoc("imperial-navy"))] } });
    expect(placeEffect("fleetBase", { item: N.plain, actor: multi }).blocked).toBeNull();
    const noFaction = actorWith({ ...PEER, system: { ...PEER.system, targets: [{ kind: "race", value: "ork" }] } });
    expect(placeEffect("fleetBase", { item: N.plain, actor: noFaction }).blocked).toBeTruthy();
    expect(placeEffect("fleetBase", { item: N.plain, actor: actorWith({ ...PEER, system: { ...PEER.system, targets: [] } }) }).blocked)
      .toMatch(/цель-фракция/);
  });
  it("Адская кузня: без отметки «Peer контролирующей фракции» — отказ, с ней — Редкость на шаг ниже", () => {
    expect(placeEffect("hellForge", { item: N.plain, actor: actorWith() }).blocked).toMatch(/Peer контролирующей фракции/);
    const e = placeEffect("hellForge", { item: N.plain, actor: actorWith(), flags: { controllerPeer: true } });
    expect(e.blocked).toBeNull();
    expect(e.shifts.map(s => s.value)).toEqual([-1]);
  });
  it("Демонический мир: без разрешения МИ Редкость не меняется (не отказ), с ним — на шаг ниже", () => {
    const off = placeEffect("daemonWorld", { item: N.plain, actor: actorWith() });
    expect(off.blocked).toBeNull();
    expect(off.shifts).toEqual([]);
    expect(off.notes.join(" ")).toMatch(/не отмечено/);
    expect(placeEffect("daemonWorld", { item: N.plain, actor: actorWith(), flags: { approved: true } }).shifts.map(s => s.value)).toEqual([-1]);
  });
  it("Вассальный мир: на шаг ниже только для сюзерена", () => {
    expect(placeEffect("vassal", { item: N.plain, actor: actorWith() }).shifts).toEqual([]);
    expect(placeEffect("vassal", { item: N.plain, actor: actorWith(), flags: { suzerain: true } }).shifts.map(s => s.value)).toEqual([-1]);
  });
  it("Мир-храм: узел веры без Peer (Ecclesiarchy) — без скидки; с Peer — на шаг ниже; не-вера — без скидки и с Peer", () => {
    expect(placeEffect("templeWorld", { item: N.faith, actor: actorWith() }).shifts).toEqual([]);
    expect(placeEffect("templeWorld", { item: N.faith, actor: peerActor("ecclesiarchy") }).shifts.map(s => s.value)).toEqual([-1]);
    expect(placeEffect("templeWorld", { item: N.plain, actor: peerActor("ecclesiarchy") }).shifts).toEqual([]);
  });
  it("Мир удовольствий: и High Spirit, и Enduring Spirit; прочие узлы — нет", () => {
    for (const n of [N.highSpirit, N.enduring]) expect(placeEffect("pleasureWorld", { item: n }).shifts.map(s => s.value), n.name).toEqual([-1]);
    expect(placeEffect("pleasureWorld", { item: N.plain }).shifts).toEqual([]);
  });
  it("Колония: только Необходимые; Захолустье — любые", () => {
    expect(placeEffect("colony", { item: N.essential }).shifts.map(s => s.value)).toEqual([+1]);
    expect(placeEffect("colony", { item: N.plain }).shifts).toEqual([]);
    expect(placeEffect("backwater", { item: N.plain }).shifts.map(s => s.value)).toEqual([+1]);
  });
  it("Улей: Ксенотех недоступен, Археотеху скидка не положена, но он доступен", () => {
    expect(placeEffect("hive", { item: N.xenotech }).blocked).toMatch(/Ксенотех недоступен/);
    const a = placeEffect("hive", { item: N.archeotech });
    expect(a.blocked).toBeNull();
    expect(a.shifts).toEqual([]);
  });
  it("Дикий/феодальный: отказ с причиной для любого узла", () => {
    for (const n of Object.values(N)) expect(placeEffect("savage", { item: n }).blocked).toMatch(/Дикий\/феодальный: узлы недоступны/);
  });
  it("мусорный ключ места и пустой ввод — Цивилизованный мир, ничего не меняется", () => {
    for (const k of ["", undefined, null, "xxx"]) {
      const e = placeEffect(k, { item: N.plain });
      expect(e.place.key).toBe("civilized");
      expect(e.blocked).toBeNull();
      expect(e.shifts).toEqual([]);
      expect(e.testMod).toBe(0);
    }
  });
  it("данные узла без полей не роняют расчёт", () => {
    expect(nodeTraits(null).essential).toBe(false);
    expect(() => placeEffect("colony", { item: { system: {} } })).not.toThrow();
    expect(placeEffect("colony", { item: {} }).shifts).toEqual([]);
  });
});

// ── 4. requisitionPlan: итоговый порог ──────────────────────────────────────

describe("requisitionPlan с местом", () => {
  const a = actorWith();
  const mac = comp => ({ type: "component", name: "Узел", system: { kind: "bridge", rarity: 0, quality: "common", essential: false, ...comp } });

  it("Захолустье: R2 узел → R3, порог на ступень тяжелее; Качество и тип узла сохраняются", () => {
    const n = mac({ rarity: 2, kind: "weapon" });
    const base = requisitionPlan(a, { item: n, node: true });
    const p = requisitionPlan(a, { item: n, node: true, place: "backwater" });
    expect(base.rarity).toBe(2);
    expect(p.rarity).toBe(3);
    expect(p.baseRarity).toBe(2);
    expect(p.total).toBe(rarityMod(3) - 30);
    expect(p.total).toBe(base.total + (rarityMod(3) - rarityMod(2)));
    expect(p.rollContext.requisitionRarity).toBe(3);
  });
  it("Станция: −10 к тесту, Редкость не меняется", () => {
    const n = mac({ rarity: 1 });
    const base = requisitionPlan(a, { item: n, node: true });
    const p = requisitionPlan(a, { item: n, node: true, place: "deepStation" });
    expect(p.rarity).toBe(1);
    expect(p.total).toBe(base.total - 10);
    expect(p.mods.placeMod).toBe(-10);
  });
  it("Поправка ГМа остаётся отдельно и прибавляется поверх места", () => {
    const n = mac({ rarity: 1 });
    const p = requisitionPlan(a, { item: n, node: true, place: "deepStation", local: 5 });
    expect(p.total).toBe(rarityMod(1) - 10 + 5);
    expect(p.mods.localMod).toBe(5);
  });
  it("Сдвиг прижимается к краю таблицы Редкости (−5…+5)", () => {
    expect(requisitionPlan(a, { item: mac({ rarity: 5 }), node: true, place: "penalColony" }).rarity).toBe(5);
    expect(requisitionPlan(a, { item: mac({ rarity: -5 }), node: true, place: "greatShipyard" }).rarity).toBe(-5);
  });
  it("недоступное место: plan.blocked с причиной", () => {
    const p = requisitionPlan(a, { item: mac(), node: true, place: "savage" });
    expect(p.blocked).toMatch(/узлы недоступны/);
    expect(requisitionPlan(a, { item: mac(), node: true }).blocked).toBeNull();
    expect(requisitionPlan(a, { item: mac(), node: true, place: "civilized" }).blocked).toBeNull();
  });
  it("Peer берётся с листа покупателя", () => {
    const n = mac({ rarity: 2 });
    expect(requisitionPlan(a, { item: n, node: true, place: "fleetBase" }).blocked).toMatch(/Peer/);
    const p = requisitionPlan(peerActor("imperial-navy"), { item: n, node: true, place: "fleetBase" });
    expect(p.blocked).toBeNull();
    expect(p.rarity).toBe(1);
  });
  it("без node место не действует вовсе (таблица — про узлы корабля)", () => {
    const gear = { type: "gear", name: "Лампа", system: { availability: 2 } };
    const p = requisitionPlan(a, { item: gear, quantity: 1, place: "savage" });
    expect(p.blocked).toBeNull();
    expect(p.rarity).toBe(2);
    expect(p.place).toBeNull();
    expect(requisitionPlan(a, { item: gear, place: "deepStation" }).total).toBe(requisitionPlan(a, { item: gear }).total);
  });
  it("без места — как прежде, ничего не меняется", () => {
    const n = mac({ rarity: 3, kind: "weapon" });
    const base = requisitionPlan(a, { item: n, node: true });
    expect(base.total).toBe(rarityMod(3) - 30);
    expect(base.place.key).toBe("civilized");
  });
  it("сдвиг Таланта и сдвиг места складываются на одной шкале", () => {
    // Повелитель Войны к узлу не применяется (нет признаков предмета) — вручную cls экзотики
    const lord = actorWith({ type: "talent", name: "Lord of War / Повелитель Войны", system: {} });
    const n = mac({ rarity: 2 });
    const p = requisitionPlan(lord, { item: n, node: true, place: "backwater", cls: { exotic: true } });
    expect(p.shifts.map(s => s.value).sort()).toEqual([-1, 1]);
    expect(p.rarity).toBe(2);
  });
  it("карточка: строки о месте — откуда сдвиг, штраф и причины", () => {
    const n = mac({ rarity: 2, kind: "weapon" });
    const l1 = requisitionSummaryLines(requisitionPlan(a, { item: n, node: true, place: "backwater" })).join("\n");
    expect(l1).toMatch(/Редкость R2 → R3: Захолустная система: Редкость на шаг выше/);
    const l2 = requisitionSummaryLines(requisitionPlan(a, { item: n, node: true, place: "deepStation" })).join("\n");
    expect(l2).toMatch(/Место \(Станция в глубоком космосе\): −10/);
    const l3 = requisitionSummaryLines(requisitionPlan(a, { item: n, node: true, place: "daemonWorld" })).join("\n");
    expect(l3).toMatch(/не отмечено/);
    const l4 = requisitionSummaryLines(requisitionPlan(a, { item: n, node: true })).join("\n");
    expect(l4).not.toMatch(/Место/);
  });
  it("Качество узла по-прежнему из таблицы Качества", () => {
    const n = mac({ rarity: 0 });
    expect(requisitionPlan(a, { item: n, node: true, place: "deepStation", quality: "good" }).total)
      .toBe(-10 + qualityMod("good"));
  });
});

// ── 5. Окно подключено ──────────────────────────────────────────────────────

describe("окно «Достать снаряжение»: выбор места только в режиме «Узел корабля»", () => {
  const src = fs.readFileSync(path.resolve(PACKS_SRC, "../module/apps/requisition.mjs"), "utf8");
  it("выпадающий список места строится из таблицы данных", () => {
    expect(src).toMatch(/REQUISITION_PLACES/);
    expect(src).toMatch(/name="place"/);
  });
  it("место идёт в requisitionPlan и условия — тоже", () => {
    expect(src).toMatch(/place:\s*node \? v\.place/);
    expect(src).toMatch(/placeFlags/);
  });
  it("недоступное место — отказ с причиной и до броска (кнопка «К тесту Inf» гасится, повторная проверка после окна)", () => {
    expect(src).toMatch(/plan\.blocked/);
    expect(src).toMatch(/ui\.notifications\.warn/);
    expect(src).toMatch(/disabled/);
  });
  it("в обычной реквизиции снаряжения списка места нет", () => {
    expect(src).toMatch(/const placeBlock = node \? `[\s\S]*?name="place"/);
    expect(src).toMatch(/\.\.\.\(node \? \{ render:/);   // живая сводка — только у узла
  });
});

// ── 6. Все узлы пака, все места: расчёт не падает и согласован ──────────────

describe("все настоящие узлы × все места", () => {
  it("ни одна пара не роняет расчёт; недоступное — всегда с причиной; сдвиг — ровно ±1 шаг за правило", () => {
    const peerAll = actorWith(peerOf("imperial-navy"), peerOf("adeptus-mechanicus"), peerOf("ecclesiarchy"));
    const flags = { suzerain: true, controllerPeer: true, approved: true };
    let blocked = 0, shifted = 0;
    for (const n of nodes()) {
      for (const p of REQUISITION_PLACES) {
        const e = placeEffect(p.key, { item: n, actor: peerAll, flags });
        if (e.blocked) { blocked++; expect(e.blocked.length).toBeGreaterThan(10); continue; }
        for (const s of e.shifts) { shifted++; expect(Math.abs(s.value)).toBe(1); }
      }
    }
    expect(blocked).toBeGreaterThan(100);   // Дикий/феодальный закрывает все; Улей/База — Ксенотех
    expect(shifted).toBeGreaterThan(1000);
  }, PACK_SCAN_TIMEOUT);
});
