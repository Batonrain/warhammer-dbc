// test/rules/ritual-veil-gate.test.mjs
//
// Sahara task-df48 (решение владельца 27.10.2026): книга требует для двух ритуалов минимальное
// Истончение Завесы — «Призыв Демонического Владыки» «может быть проведен только в месте с
// Истончением Завесы +3 или выше», «Ритуал Тумана Безумия» — «только в зоне истончения Завесы 1 или
// больше». Раньше этого не проверяла ни сцена, ни аура: ритуал просто бросался. Теперь число лежит на
// предмете-ритуале (system.veilMin), а castRitual сверяет его с Завесой там, где стоит ритуалист
// (Завеса сцены + аура Раны в Реальности, rules/veil-steps.mjs::veilStepsFor): ГМу — подтверждение,
// игроку — отказ до траты чего-либо. Вторая половина — тест Навигации берёт ту же сумму с аурой.
// Данные — настоящие записи пака, аура — настоящий Талант и служебная Черта-метка.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import fs from "node:fs";
import path from "node:path";
import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { WOUND_FREE_FLAG } from "../../module/rules/wound-in-reality.mjs";
import { ritualVeilGate, navigationVeil } from "../../module/rules/veil-steps.mjs";
import { castRitual } from "../../module/apps/ritual-cast.mjs";
import { VeilMystic } from "../../module/apps/veil.mjs";

const LORD = () => packDocById("packs-src/rituals/Призыв", "ExLwBwdG16EGofQE");
const MIST = () => packDocById("packs-src/rituals/Ведьмограждение", "qBv2KfryskjVaK3S");
const woundDoc = () => packDocById("packs-src/talents/Псайкана", "HlOOH4XLJ1Oilfjn");
const markerDoc = () => packDocById("packs-src/traits", "WoundRealityAura");

/** Ритуал-предмет с настоящими полями записи пака (требования Навыков в пробе не нужны). */
const ritualItem = doc => ({ id: "rit-1", name: doc.name, type: "ritual", system: doc.system, getFlag: () => undefined });

const sceneOf = (veil, id = "scene-1") => ({ id, getFlag: (s, k) => (s === "warhammer-dbc" && k === "veil" ? veil : undefined) });

// Псайкер-источник ауры и персонаж, накрытый ею — как в test/rules/veil-steps.test.mjs.
const talent = () => { const d = woundDoc(); return { type: "talent", name: d.name, system: { ...d.system }, flags: {} }; };
const power = (name, free) => ({
  type: "psychicPower", name, id: name,
  system: { isSustained: true, sustainCost: 1 },
  flags: { "warhammer-dbc": free ? { [WOUND_FREE_FLAG]: true } : {} },
  getFlag(s, k) { return this.flags[s]?.[k]; }
});
const psyker = nFree => ({
  type: "character", system: { corruptionBonus: 9, psyker: { rating: 9 } },
  items: [talent(), power("P1"), power("P2"), power("P3"), ...Array.from({ length: nFree }, (_, i) => power(`F${i}`, true))]
});
/** Ритуалист в ауре источника U1: настоящая служебная Черта-метка с auraSource. */
const ritualistIn = sourceUuid => ({
  id: "act-1", name: "Каэль Ворн", type: "character", uuid: "Actor.act-1",
  system: { characteristics: { int: { total: 40 } }, skills: {}, groupSkills: {} },
  items: sourceUuid ? [{
    type: "trait", name: markerDoc().name, flags: { "warhammer-dbc": { auraSource: sourceUuid } },
    getFlag(s, k) { return this.flags[s]?.[k]; }
  }] : []
});
const resolveAura = nFree => uuid => (uuid === "U1" ? { parent: psyker(nFree) } : null);

beforeEach(() => { resetCaptured(); globalThis.game.user = { isGM: true }; });
const realFromUuidSync = globalThis.fromUuidSync;
afterEach(() => { delete globalThis.canvas.scene; globalThis.fromUuidSync = realFromUuidSync; });

describe("данные: книжное требование лежит на предметах-ритуалах", () => {
  it("Призыв Демонического Владыки требует Завесу +3, Туман Безумия — 1", () => {
    expect(LORD().system.veilMin).toBe(3);
    expect(MIST().system.veilMin).toBe(1);
  });

  it("каждый ритуал, чья проза говорит «только при Истончении Завесы N», несёт то же N в veilMin", () => {
    // Охрана от подмены/забывчивости: ловит и пропущенное число, и число, расходящееся с прозой.
    // Кириллица без \w: слово — через [а-яё]. Два оборота книги: «Истончением Завесы +3 или выше»
    // и «зоне истончения Завесы 1 или больше».
    const re = /только\s+(?:в\s+месте\s+с\s+Истончением|в\s+зоне\s+истончения)\s+Завесы\s+\+?(\d+)/iu;
    const root = path.resolve(import.meta.dirname, "../../packs-src/rituals");
    const files = fs.readdirSync(root, { recursive: true }).filter(f => String(f).endsWith(".json") && !String(f).endsWith("_Folder.json"));
    const bad = [];
    let matched = 0;
    for (const f of files) {
      const doc = JSON.parse(fs.readFileSync(path.join(root, String(f)), "utf8"));
      const m = re.exec(doc.system?.procedure ?? "");
      const have = Number(doc.system?.veilMin) || 0;
      if (m) { matched++; if (have !== Number(m[1])) bad.push(`${doc.name}: книга ${m[1]}, veilMin ${have}`); }
      else if (have) bad.push(`${doc.name}: veilMin ${have}, а в прозе требования нет`);
    }
    expect(matched).toBe(2);
    expect(bad).toEqual([]);
  });
});

describe("ritualVeilGate: хватает ли ступеней Завесы там, где стоит ритуалист", () => {
  it("у ритуала нет требования — не проверяется и сцену не читает", () => {
    const gate = ritualVeilGate({ system: { veilMin: 0 } }, ritualistIn(null), { scene: null });
    expect(gate).toMatchObject({ required: 0, ok: true });
  });

  it("Завеса сцены +2, ауры нет — не хватает до +3", () => {
    const gate = ritualVeilGate(ritualItem(LORD()), ritualistIn(null), { scene: sceneOf({ base: 2 }), resolve: resolveAura(0) });
    expect(gate).toMatchObject({ required: 3, scene: 2, aura: 0, steps: 2, ok: false });
  });

  it("Завеса сцены +2 и аура Раны в Реальности +1 — ровно +3, хватает", () => {
    const gate = ritualVeilGate(ritualItem(LORD()), ritualistIn("U1"), { scene: sceneOf({ base: 2 }), resolve: resolveAura(3) });
    expect(gate).toMatchObject({ required: 3, scene: 2, aura: 1, steps: 3, ok: true });
  });

  it("сцены нет — Завеса 0: требование +3 не выполнено", () => {
    const gate = ritualVeilGate(ritualItem(LORD()), ritualistIn(null), { scene: null });
    expect(gate).toMatchObject({ steps: 0, ok: false });
  });

  it("выше требования тоже можно (+5 при нужных +3)", () => {
    const gate = ritualVeilGate(ritualItem(LORD()), ritualistIn(null), { scene: sceneOf({ base: 5 }), resolve: resolveAura(0) });
    expect(gate.ok).toBe(true);
  });
});

describe("castRitual: Завеса слишком плотна", () => {
  const baseR = over => ({
    name: "Тест", type: "summon", skillValue: "", testChar: "int", gmMod: 50,
    assistants: 0, assistBonus: 10, summon: {}, curseFam: "close", curseSymp: {},
    numerology: {}, numMod: 0, psyker: false, psykerBonus: 0, aversionPerFail: 5, ...over
  });
  /** Проверка Завесы с заданной сценой и источником ауры (по умолчанию — без ауры). */
  const veilGateFn = (scene, nFree = 0) => (item, a) => ritualVeilGate(item, a, { scene, resolve: resolveAura(nFree) });

  it("ГМ отказался продолжать — бросок не идёт, карточки нет; в вопросе — Завеса и требование", async () => {
    captured.confirmAnswer = false;
    const res = await castRitual(baseR(), ritualistIn(null), { item: ritualItem(LORD()), veilGateFn: veilGateFn(sceneOf({ base: 2 })) });
    expect(res).toBeNull();
    expect(captured.rolls).toEqual([]);
    expect(captured.chat).toEqual([]);
    expect(captured.dialog.content).toContain("Завеса слишком плотна (+2)");
    expect(captured.dialog.content).toContain("+3");
  });

  it("ГМ подтвердил — ритуал проводится как обычно", async () => {
    captured.confirmAnswer = true;
    captured.dice = [1];
    const res = await castRitual(baseR(), ritualistIn(null), { item: ritualItem(LORD()), veilGateFn: veilGateFn(sceneOf({ base: 2 })) });
    expect(res.success).toBe(true);
    expect(captured.chat.length).toBe(1);
  });

  it("игрок (не ГМ): отказ без вопроса, бросок и требования не трогаются", async () => {
    globalThis.game.user = { isGM: false };
    let unmetAsked = false;
    const item = { ...ritualItem(LORD()), getFlag: (_s, k) => (k === "req"
      ? [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "reqRace", raceKey: "drukhari" }] }] : undefined) };
    const res = await castRitual(baseR(), ritualistIn(null), {
      item, veilGateFn: veilGateFn(sceneOf({ base: 2 })), confirmUnmet: async () => { unmetAsked = true; return true; }
    });
    expect(res).toBeNull();
    expect(captured.dialog).toBeNull();
    expect(unmetAsked).toBe(false);
    expect(captured.rolls).toEqual([]);
    expect(captured.chat).toEqual([]);
    expect(captured.warnings.join(" ")).toContain("Завеса слишком плотна (+2)");
  });

  it("аура Раны в Реальности добирает недостающую ступень — вопроса нет", async () => {
    captured.dice = [1];
    const res = await castRitual(baseR(), ritualistIn("U1"), { item: ritualItem(LORD()), veilGateFn: veilGateFn(sceneOf({ base: 2 }), 3) });
    expect(res.success).toBe(true);
    expect(captured.dialog).toBeNull();
    expect(captured.warnings).toEqual([]);
  });

  it("в вопросе названа доля ауры, когда она есть", async () => {
    captured.confirmAnswer = false;
    await castRitual(baseR(), ritualistIn("U1"), { item: ritualItem(LORD()), veilGateFn: veilGateFn(sceneOf({ base: 1 }), 3) });
    expect(captured.dialog.content).toContain("Завеса слишком плотна (+2)");
    expect(captured.dialog.content).toContain("аура");
  });

  it("ритуал без требования Завесы не спрашивает и Завесу не читает", async () => {
    captured.dice = [1];
    let asked = false;
    const item = ritualItem({ system: { veilMin: 0 }, name: "Обычный" });
    const res = await castRitual(baseR(), ritualistIn(null), { item, veilGateFn: () => { asked = true; return { required: 0, ok: true }; } });
    expect(res.success).toBe(true);
    expect(captured.dialog).toBeNull();
    // Гейт зовётся всегда (решает он сам), но required:0 ничего не меняет.
    expect(asked).toBe(true);
  });
});

describe("Навигация: ступени Завесы персонажа (сцена + аура)", () => {
  it("navigationVeil: сцена +1 и аура +1 — Завеса +2, модификатор Навигации −20 (а не −10)", () => {
    const r = navigationVeil(ritualistIn("U1"), { scene: sceneOf({ base: 1 }), resolve: resolveAura(3) });
    expect(r).toMatchObject({ scene: 1, aura: 1, total: 2, mod: -20 });
    expect(navigationVeil(ritualistIn(null), { scene: sceneOf({ base: 1 }), resolve: resolveAura(0) }).mod).toBe(-10);
  });

  it("_rollNavigation: карточка и порог считаются с аурой навигатора", async () => {
    globalThis.canvas.scene = sceneOf({ base: 1 });
    globalThis.fromUuidSync = resolveAura(3);
    const actor = ritualistIn("U1");
    const self = {
      _navigators: () => [actor], uiState: { navId: actor.id }, journey: { navSkill: "x" },
      _jSkillTotal: () => 50
    };
    captured.dice = [5];
    await VeilMystic.prototype._rollNavigation.call(self);
    const card = captured.chat[0].content;
    // Порог = 50 − 20 (Завеса +2: сцена 1 + аура 1), а не 50 − 10 (одна сцена).
    expect(card).toContain("-20");
    expect(card).not.toContain("-10");
    expect(card).toContain("аура");
  });
});
