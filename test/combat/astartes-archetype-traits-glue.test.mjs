// test/combat/astartes-archetype-traits-glue.test.mjs
//
// Foundry-обвязка Черт Архетипов Космодесанта: вопрос Хирургии Легиона и
// трата Очка, пробуждение из Замедленной Анимации, Экстренное Обслуживание
// (выбор и починка, отказ не тратит Очко), занять/снять Огневую Точку.
// Фикстуры Черт — настоящие JSON из packs-src.

import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { legionSurgeryPass, offerSusAnWake, LEGION_SURGERY_LINE } from "../../module/combat/legion-surgery.mjs";
import { emergencyMaintenance } from "../../module/combat/emergency-maintenance.mjs";
import { activateFirePoint, clearFirePoint, markFirePointRecoil } from "../../module/combat/fire-point.mjs";
import { SUS_AN_ACTIVE_FLAG } from "../../module/rules/legion-surgery.mjs";
import { FIRE_POINT_FLAG } from "../../module/rules/fire-point.mjs";

const TRAITS = "packs-src/traits";
const LEGION_SURGERY_DOC = packDocById(TRAITS, "jD1tJ0ugyhBQTWFI");
const FIRE_POINT_DOC = packDocById(TRAITS, "TGEdkKpPOKT6NizT");

const NS = "warhammer-dbc";
const asItem = (doc, id) => ({ id, name: doc.name, type: doc.type, system: doc.system, flags: doc.flags });

function fakeActor({ traits = [], items = [], system = {}, flags = {} } = {}) {
  const all = [...traits.map((d, i) => asItem(d, `t${i}`)), ...items];
  return {
    id: "a1", uuid: "Actor.a1", name: "Брат", type: "character",
    system: { fate: { value: 2, max: 3 }, conditions: {}, wounds: {}, ...system },
    flags: { [NS]: { ...flags } },
    updates: [],
    items: Object.assign([...all], { contents: all, get: id => all.find(i => i.id === id) }),
    getFlag(ns, k) { return this.flags[ns]?.[k]; },
    async setFlag(ns, k, v) { (this.flags[ns] ??= {})[k] = v; },
    async unsetFlag(ns, k) { delete this.flags[ns]?.[k]; },
    async update(u) { this.updates.push(u); }
  };
}

// Заглушка getProperty отдаёт undefined на всё — здесь нужен настоящий путь,
// иначе списание Очка всегда считает пул пустым.
const realGetProperty = globalThis.foundry.utils.getProperty;
beforeEach(() => {
  resetCaptured();
  globalThis.foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);
});
afterEach(() => { globalThis.foundry.utils.getProperty = realGetProperty; });

describe("Хирургия Легиона — вопрос после провала", () => {
  it("согласие: Очко списано, тест пройден, строка в карточку", async () => {
    const medic = fakeActor({ traits: [LEGION_SURGERY_DOC] });
    captured.confirmAnswer = true;
    const res = await legionSurgeryPass(medic, false, "Первая Помощь");
    expect(res).toEqual({ success: true, line: LEGION_SURGERY_LINE });
    expect(medic.updates).toEqual([{ "system.fate.value": 1 }]);
    expect(captured.dialog.content).toMatch(/Первая Помощь/);
  });

  it("отказ — провал остаётся, Очко цело", async () => {
    const medic = fakeActor({ traits: [LEGION_SURGERY_DOC] });
    captured.confirmAnswer = false;
    expect(await legionSurgeryPass(medic, false, "Ампутация")).toEqual({ success: false, line: "" });
    expect(medic.updates).toEqual([]);
  });

  it("успех, нет Черты или нет Очков — даже не спрашивает", async () => {
    expect(await legionSurgeryPass(fakeActor({ traits: [LEGION_SURGERY_DOC] }), true, "x")).toEqual({ success: true, line: "" });
    expect(await legionSurgeryPass(fakeActor(), false, "x")).toEqual({ success: false, line: "" });
    expect(await legionSurgeryPass(fakeActor({ traits: [LEGION_SURGERY_DOC], system: { fate: { value: 0 } } }), false, "x"))
      .toEqual({ success: false, line: "" });
    expect(captured.dialog).toBe(null);
  });

  it("пробуждение: пациент в Анимации с Ранами −7 — снято «Без сознания» и метка", async () => {
    const medic = fakeActor({ traits: [LEGION_SURGERY_DOC] });
    const patient = fakeActor({ system: { conditions: { unconscious: true }, wounds: { critical: 7 } },
                                flags: { [SUS_AN_ACTIVE_FLAG]: true } });
    const line = await offerSusAnWake(medic, patient);
    expect(line).toMatch(/пробуждается/);
    expect(medic.updates).toEqual([{ "system.fate.value": 1 }]);
    expect(patient.updates).toHaveLength(1);
    expect(patient.updates[0][`flags.${NS}.-=${SUS_AN_ACTIVE_FLAG}`]).toBe(null);
  });

  it("пробуждение: Раны ниже −7 — не предлагается", async () => {
    const medic = fakeActor({ traits: [LEGION_SURGERY_DOC] });
    const patient = fakeActor({ system: { conditions: { unconscious: true }, wounds: { critical: 8 } },
                                flags: { [SUS_AN_ACTIVE_FLAG]: true } });
    expect(await offerSusAnWake(medic, patient)).toBe("");
    expect(medic.updates).toEqual([]);
  });
});

describe("Экстренное Обслуживание — кнопка Черты", () => {
  it("чинить нечего — ошибка (Очко записи не списывается)", async () => {
    await expect(emergencyMaintenance(fakeActor())).rejects.toThrow(/нет повреждений/);
  });

  it("выбранное повреждение починено, карточка в чат", async () => {
    const jammed = { id: "w1", name: "Болтер", type: "weapon", system: { jammed: true }, updates: [],
                     async update(u) { this.updates.push(u); } };
    const tm = fakeActor({ items: [jammed], system: { armorCorrosion: { body: 2 } } });
    const run = emergencyMaintenance(tm);
    await new Promise(r => setTimeout(r, 0));
    await captured.press("repair", fakeForm({ 'select[name="emRepair"]': "jam:w1" }));
    await run;
    expect(jammed.updates).toEqual([{ "system.jammed": false, "system.jamLockedRound": 0 }]);
    expect(tm.updates).toEqual([]);
    expect(captured.chat.at(-1).content).toMatch(/Болтер: заклинило/);
  });

  it("отмена окна — ошибка, ничего не чинится", async () => {
    const tm = fakeActor({ system: { armorCorrosion: { body: 2 } } });
    const run = emergencyMaintenance(tm);
    await new Promise(r => setTimeout(r, 0));
    await captured.press("cancel");
    await expect(run).rejects.toThrow(/Отменено/);
    expect(tm.updates).toEqual([]);
  });
});

describe("Огневая Точка — занять, Отскок, снять", () => {
  it("занимается только с Чертой и один раз", async () => {
    const havoc = fakeActor({ traits: [FIRE_POINT_DOC] });
    expect(await activateFirePoint(havoc, "Закрепление")).toBe(true);
    expect(havoc.flags[NS][FIRE_POINT_FLAG]).toEqual({ active: true, recoil: false });
    expect(await activateFirePoint(havoc, "ещё раз")).toBe(false);
    expect(await activateFirePoint(fakeActor(), "без Черты")).toBe(false);
  });

  it("Отскок ставит метку, снятие убирает состояние", async () => {
    const havoc = fakeActor({ traits: [FIRE_POINT_DOC], flags: { [FIRE_POINT_FLAG]: { active: true, recoil: false } } });
    await markFirePointRecoil(havoc);
    expect(havoc.flags[NS][FIRE_POINT_FLAG]).toEqual({ active: true, recoil: true });
    await clearFirePoint(havoc);
    expect(havoc.flags[NS][FIRE_POINT_FLAG]).toBeUndefined();
  });
});
