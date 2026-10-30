// test/apps/ritual-cast-assistants.test.mjs
//
// Sahara fallbacks-instructor: ассистенты ритуала — список акторов с ролями.
// Здесь — стык с броском (apps/ritual-cast.mjs): жертва годных основных идёт в
// Порог, негодные исключены, Инструктор переоценивает список, Запасные Планы
// перехватывают провал. Чистая логика списка — test/rules/ritual-assistants.test.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { beforeEach, describe, it, expect } from "vitest";
import { ritualThreshold, castRitual } from "../../module/apps/ritual-cast.mjs";

beforeEach(() => { resetCaptured(); globalThis.game.user = {}; });

const talent = name => ({ type: "talent", name, system: {} });
const FALLBACKS = "Fallbacks / Запасные Планы";
const INSTRUCTOR = "Instructor / Инструктор";

const ritualist = (items = [], intBonus = 4) => ({
  id: "boss", uuid: "Actor.boss", name: "Каэль Ворн", type: "character", items,
  system: { characteristics: { int: { total: 40, bonus: intBonus } }, skills: {}, groupSkills: {} }
});
const helper = (uuid, rank) => ({
  id: uuid, uuid, name: uuid, type: "character",
  system: { skills: rank ? { medicae: { rank } } : {}, groupSkills: {}, characteristics: {} }
});
const medicaeReq = rank => [{
  id: "g", operator: "AND",
  entries: [{ id: "e", kind: "reqSkill", skillScope: "plain", skillKey: "medicae", specKey: "", specialty: "", rank }]
}];
const ritualItem = (assistReq = []) => ({
  id: "r1", name: "Зов", type: "ritual", system: { testChar: "int", testMod: -20 },
  getFlag: (_s, k) => (k === "assistReq" ? assistReq : undefined)
});
const row = (actor, over = {}) => ({
  uuid: actor.uuid, name: actor.name, role: "primary", sacrificed: false, actor, ...over
});
const baseR = over => ({
  name: "Тест", type: "summon", skillValue: "", testChar: "int", gmMod: -20,
  assistants: 0, assistSacrificed: 0, assistBonus: 10, summon: {}, curseFam: "close", curseSymp: {},
  numerology: {}, numMod: 0, psyker: false, psykerBonus: 0, aversionPerFail: 5, ...over
});

describe("ритуал: Порог от списка ассистентов (ritualThreshold)", () => {
  const BASE = -20 - 20; // нет Навыка + Сложность

  it("жертва ГОДНОГО основного — +10, негодного — нет, запасного — нет", () => {
    const list = [
      row(helper("ok", "trained"), { sacrificed: true }),
      row(helper("bad", "knows"), { sacrificed: true }),
      row(helper("Zapasnoy", "veteran"), { role: "reserve", sacrificed: true })
    ];
    const d = ritualThreshold(baseR({ assistantList: list }), ritualist([talent(FALLBACKS)]), ritualItem(medicaeReq("trained")));
    expect(d.threshold).toBe(BASE + 10);
    expect(d.assistantTally).toMatchObject({ primary: 1, reserve: 1, blocked: 1, sacrificed: 1 });
    expect(d.rows.find(r => r.label.includes("Жертва ассистентов")).label).toContain("×1");
  });

  it("негодный ассистент назван с причиной (строка списка несёт failed)", () => {
    const list = [row(helper("bad", "knows"))];
    const d = ritualThreshold(baseR({ assistantList: list }), ritualist(), ritualItem(medicaeReq("trained")));
    expect(d.assistantRows[0].ok).toBe(false);
    expect(d.assistantRows[0].failed.join(" ")).toContain("Тренированное");
  });

  it("Инструктор у ритуалиста + отметка подготовки — требование ниже, жертва засчитана", () => {
    const list = [row(helper("bad", "knows"), { sacrificed: true })];
    const item = ritualItem(medicaeReq("trained"));
    const d = ritualThreshold(baseR({ assistantList: list, instructorPrepared: true }),
      ritualist([talent(INSTRUCTOR)]), item);
    expect(d.threshold).toBe(BASE + 10);
    expect(d.assistantRows[0].ok).toBe(true);
  });

  // Галочка без Таланта — устаревшее состояние формы, а не способность.
  it("отметка подготовки БЕЗ Таланта Инструктор не действует", () => {
    const list = [row(helper("bad", "knows"), { sacrificed: true })];
    const d = ritualThreshold(baseR({ assistantList: list, instructorPrepared: true }),
      ritualist(), ritualItem(medicaeReq("trained")));
    expect(d.threshold).toBe(BASE);
    expect(d.assistantRows[0].ok).toBe(false);
  });

  it("безымянные числовые ассистенты (консоль Завесы) складываются со списком", () => {
    const list = [row(helper("ok", "trained"), { sacrificed: true })];
    const d = ritualThreshold(baseR({ assistantList: list, assistants: 2, assistSacrificed: 2 }),
      ritualist(), ritualItem(medicaeReq("trained")));
    expect(d.threshold).toBe(BASE + 30);
  });

  it("запасные: потолок и включатель отдаются диалогу", () => {
    const d1 = ritualThreshold(baseR(), ritualist([talent(FALLBACKS)], 5), null);
    expect(d1).toMatchObject({ fallbacks: true, reserveMax: 3, instructor: false });
    const d2 = ritualThreshold(baseR(), ritualist([talent(INSTRUCTOR)], 5), null);
    expect(d2).toMatchObject({ fallbacks: false, reserveMax: 0, instructor: true });
  });

  it("без списка и без предмета ритуал считается как раньше", () => {
    const d = ritualThreshold(baseR({ assistants: 3, assistSacrificed: 1 }), ritualist(), null);
    expect(d.threshold).toBe(BASE + 10);
    expect(d.assistantRows).toEqual([]);
  });
});

describe("ритуал: Запасные Планы на провале (castRitual)", () => {
  const withReserve = (extra = {}) => baseR({
    assistantList: [
      row(helper("p1", "trained")),
      row(helper("Zapasnoy", "veteran"), { role: "reserve" })
    ], ...extra
  });
  const item = () => ritualItem(medicaeReq("trained"));
  const asker = (mode, victimUuid = "Zapasnoy") => {
    const calls = [];
    const fn = async (ctx) => { calls.push(ctx); return mode ? { mode, victimUuid } : null; };
    fn.calls = calls;
    return fn;
  };
  const vetoShift = () => { const calls = []; const fn = async (...a) => calls.push(a); fn.calls = calls; return fn; };

  it("провал + Талант + запасной: игрока спрашивают, кого и что", async () => {
    captured.dice = [95, 40];
    const ask = asker(null);
    await castRitual(withReserve(), ritualist([talent(FALLBACKS)]), { item: item(), fallbackChoiceFn: ask, veilShiftFn: vetoShift() });
    expect(ask.calls.length).toBe(1);
    expect(ask.calls[0].victims.map(v => v.uuid)).toEqual(["Zapasnoy"]);
  });

  it("успех — вопроса нет", async () => {
    captured.dice = [1];
    const ask = asker("ignore");
    await castRitual(withReserve({ gmMod: 50 }), ritualist([talent(FALLBACKS)]), { item: item(), fallbackChoiceFn: ask });
    expect(ask.calls.length).toBe(0);
  });

  it("нет Таланта — вопроса нет, провал разыгрывается", async () => {
    captured.dice = [95, 40];
    const ask = asker("ignore");
    await castRitual(withReserve(), ritualist([]), { item: item(), fallbackChoiceFn: ask, veilShiftFn: vetoShift() });
    expect(ask.calls.length).toBe(0);
    expect(captured.chat[0].content).toContain("Отвращение Варпа");
  });

  it("Талант есть, запасного нет — вопроса нет", async () => {
    captured.dice = [95, 40];
    const ask = asker("ignore");
    await castRitual(baseR({ assistantList: [row(helper("p1", "trained"))] }),
      ritualist([talent(FALLBACKS)]), { item: item(), fallbackChoiceFn: ask, veilShiftFn: vetoShift() });
    expect(ask.calls.length).toBe(0);
  });

  it("негодный запасной в жертву не годится — вопроса нет", async () => {
    captured.dice = [95, 40];
    const ask = asker("ignore");
    await castRitual(baseR({ assistantList: [row(helper("Zapasnoy", "knows"), { role: "reserve" })] }),
      ritualist([talent(FALLBACKS)]), { item: item(), fallbackChoiceFn: ask, veilShiftFn: vetoShift() });
    expect(ask.calls.length).toBe(0);
  });

  it("«проигнорировать срыв»: Отвращение не бросается, Завеса не сдвигается, жертва названа", async () => {
    captured.dice = [95]; // второго кубика на Отвращение НЕТ — бросок упал бы
    const shift = vetoShift();
    const res = await castRitual(withReserve(), ritualist([talent(FALLBACKS)]),
      { item: item(), fallbackChoiceFn: asker("ignore"), veilShiftFn: shift });
    expect(res.success).toBe(false);
    expect(shift.calls.length).toBe(0);
    const html = captured.chat[0].content;
    expect(html).not.toContain("Отвращение Варпа");
    expect(html).toContain("Запасные Планы");
    expect(html).toContain("Zapasnoy");
    expect(html).toContain("срыв проигнорирован");
  });

  // Решение владельца 30.10.2026: «повторить в следующий Ход» — тоже срыв не разыгрывается:
  // жертва запасного гасит цену ошибки в обоих исходах (прежнее допущение «повтор цену не снимает» отменено).
  it("«повторить в следующий Ход»: цена ошибки и Отвращение Варпа НЕ разыгрываются, Завеса не сдвигается", async () => {
    captured.dice = [95]; // второго кубика на Отвращение НЕТ — бросок упал бы
    const shift = vetoShift();
    const res = await castRitual(withReserve(), ritualist([talent(FALLBACKS)]),
      { item: item(), fallbackChoiceFn: asker("retry"), veilShiftFn: shift });
    expect(res.success).toBe(false);
    expect(shift.calls.length).toBe(0);
    const html = captured.chat[0].content;
    expect(html).not.toContain("Отвращение Варпа");
    expect(html).toContain("Запасные Планы");
    expect(html).toContain("Zapasnoy");
    expect(html).toContain("в следующий Ход");
    expect(html).toContain("не считается перебросом");
    expect(html).toContain("цена ошибки не применяется");
  });

  it.each([["exorcism", "Феномен"], ["curse", "Что Посеешь"]])(
    "повтор гасит цену ошибки и у вида «%s» (не только у Отвращения)", async (type, marker) => {
      captured.dice = [95]; // кубика на Феномен нет
      await castRitual(withReserve({ type }), ritualist([talent(FALLBACKS)]),
        { item: item(), fallbackChoiceFn: asker("retry"), veilShiftFn: vetoShift() });
      const html = captured.chat[0].content;
      expect(html).not.toContain(marker);
      expect(html).not.toMatch(/Феномен|Прорыв|Отвращение/);
      expect(html).toContain("цена ошибки не применяется");
    });

  it("отмена выбора — как будто Таланта нет, ничего не пишется про жертву", async () => {
    captured.dice = [95, 40];
    await castRitual(withReserve(), ritualist([talent(FALLBACKS)]),
      { item: item(), fallbackChoiceFn: asker(null), veilShiftFn: vetoShift() });
    const html = captured.chat[0].content;
    expect(html).toContain("Отвращение Варпа");
    expect(html).not.toContain("Запасные Планы");
  });

  it("выбранный uuid не из списка жертв — вопрос игнорируется, провал разыгрывается", async () => {
    captured.dice = [95, 40];
    await castRitual(withReserve(), ritualist([talent(FALLBACKS)]),
      { item: item(), fallbackChoiceFn: asker("ignore", "p1"), veilShiftFn: vetoShift() });
    expect(captured.chat[0].content).toContain("Отвращение Варпа");
  });
});
