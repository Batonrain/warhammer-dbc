// test/rules/technomystic-resources.test.mjs
//
// Пачка J, Техномистик (Sahara 3-2501): Катушка Апокрифа, Облачная Когниция,
// Мотивное Причастие — чистая арифметика переносов ⚙/⚡ между катушками и между
// персонажами (rules/technomystic-resources.mjs) и данные паков (Конструктор,
// исправленный текст Мотивного Причастия).

import { describe, it, expect } from "vitest";
import {
  hasApocryphaCoil, hasCloudCognition, hasMotiveEucharist,
  apocryphaMax, planCoilTransfer,
  CLOUD_COGNITION_MAX, MOTIVE_EUCHARIST_MAX, cloudCognitionCap, planCloudCognition, planMotiveEucharist
} from "../../module/rules/technomystic-resources.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const talent = name => ({ type: "talent", name, system: {}, flags: {} });
const actorWith = (...names) => ({ items: names.map(talent), system: {} });

describe("опознание Талантов", () => {
  it("по английской и русской половине имени", () => {
    expect(hasApocryphaCoil(actorWith("Apocrypha Coil / Катушка Апокрифа"))).toBe(true);
    expect(hasApocryphaCoil(actorWith("Катушка Апокрифа"))).toBe(true);
    expect(hasCloudCognition(actorWith("Cloud Cognition / Облачная Когниция"))).toBe(true);
    expect(hasMotiveEucharist(actorWith("Motive Eucharist / Мотивное Причастие"))).toBe(true);
  });
  it("чужие Таланты не подходят", () => {
    const a = actorWith("Power Cache / Силовой Заряд");
    expect(hasApocryphaCoil(a)).toBe(false);
    expect(hasCloudCognition(a)).toBe(false);
    expect(hasMotiveEucharist(a)).toBe(false);
  });
});

describe("Катушка Апокрифа: максимум = база основной Катушки без бонусов Талантов", () => {
  it("ручная база + установленные импланты", () => {
    expect(apocryphaMax({ manualMax: 2, implantMax: 3 })).toBe(5);
  });
  it("мусор и отрицательные значения не дают отрицательный максимум", () => {
    expect(apocryphaMax({ manualMax: -4, implantMax: 1 })).toBe(0);
    expect(apocryphaMax({})).toBe(0);
  });
});

describe("перенос ⚡ между основной Катушкой и Апокрифой", () => {
  const main = { value: 5, max: 8 };
  const apoc = { value: 1, max: 4 };

  it("в Апокрифу: ограничен свободным местом", () => {
    const r = planCoilTransfer({ direction: "toApocrypha", amount: 9, main, apoc });
    expect(r).toMatchObject({ ok: true, moved: 3, main: 2, apoc: 4 });
  });
  it("из Апокрифы: ограничен её зарядом и местом в основной", () => {
    const r = planCoilTransfer({ direction: "fromApocrypha", amount: 9, main: { value: 6, max: 8 }, apoc: { value: 5, max: 5 } });
    expect(r).toMatchObject({ ok: true, moved: 2, main: 8, apoc: 3 });
  });
  it("нужное число меньше предела — переносится ровно оно", () => {
    const r = planCoilTransfer({ direction: "toApocrypha", amount: 2, main, apoc });
    expect(r).toMatchObject({ moved: 2, main: 3, apoc: 3 });
  });
  it("нечего переносить / некуда", () => {
    expect(planCoilTransfer({ direction: "toApocrypha", amount: 2, main: { value: 0, max: 8 }, apoc })).toMatchObject({ ok: false, moved: 0, reason: "source" });
    expect(planCoilTransfer({ direction: "toApocrypha", amount: 2, main, apoc: { value: 4, max: 4 } })).toMatchObject({ ok: false, moved: 0, reason: "full" });
    expect(planCoilTransfer({ direction: "fromApocrypha", amount: 2, main: { value: 8, max: 8 }, apoc: { value: 2, max: 4 } })).toMatchObject({ ok: false, reason: "full" });
  });
  it("нулевое/дробное/отрицательное число — не переносит", () => {
    expect(planCoilTransfer({ direction: "toApocrypha", amount: 0, main, apoc }).ok).toBe(false);
    expect(planCoilTransfer({ direction: "toApocrypha", amount: -3, main, apoc }).ok).toBe(false);
    expect(planCoilTransfer({ direction: "toApocrypha", amount: 2.9, main, apoc }).moved).toBe(2);
  });
  it("неизвестное направление — отказ", () => {
    expect(planCoilTransfer({ direction: "sideways", amount: 1, main, apoc }).ok).toBe(false);
  });
});

describe("Облачная Когниция: до 2 ⚙, цель не больше ½I.b (окр.▲) в Раунд", () => {
  it("потолок цели: ½I.b ЦЕЛИ с округлением вверх", () => {
    expect(cloudCognitionCap({ system: { characteristics: { int: { bonus: 5 } } } })).toBe(3);
    expect(cloudCognitionCap({ system: { characteristics: { int: { bonus: 4 } } } })).toBe(2);
    expect(cloudCognitionCap({ system: {} })).toBe(0);
  });
  it("передаёт не больше двух, не больше своих, не больше места, не больше остатка потолка", () => {
    const base = { amount: 5, giverCognition: 9, receiver: { value: 1, max: 9 }, received: 0, cap: 4 };
    expect(CLOUD_COGNITION_MAX).toBe(2);
    expect(planCloudCognition(base)).toMatchObject({ ok: true, moved: 2 });
    expect(planCloudCognition({ ...base, giverCognition: 1 })).toMatchObject({ moved: 1 });
    expect(planCloudCognition({ ...base, receiver: { value: 8, max: 9 } })).toMatchObject({ moved: 1 });
    expect(planCloudCognition({ ...base, received: 3 })).toMatchObject({ moved: 1 });
  });
  it("причины отказа", () => {
    const base = { amount: 2, giverCognition: 9, receiver: { value: 1, max: 9 }, received: 0, cap: 2 };
    expect(planCloudCognition({ ...base, giverCognition: 0 })).toMatchObject({ ok: false, moved: 0, reason: "giver" });
    expect(planCloudCognition({ ...base, receiver: { value: 9, max: 9 } })).toMatchObject({ ok: false, reason: "full" });
    expect(planCloudCognition({ ...base, received: 2 })).toMatchObject({ ok: false, reason: "cap" });
    expect(planCloudCognition({ ...base, cap: 0 })).toMatchObject({ ok: false, reason: "cap" });
  });
});

describe("Мотивное Причастие: до 3 ⚡ в Катушки цели", () => {
  const recv = { main: { value: 1, max: 5 }, apoc: null };
  it("сначала основная Катушка цели", () => {
    expect(MOTIVE_EUCHARIST_MAX).toBe(3);
    expect(planMotiveEucharist({ amount: 9, giverEnergy: 9, receiver: recv })).toMatchObject({ ok: true, moved: 3, toMain: 3, toApoc: 0 });
  });
  it("излишек уходит в Апокрифу цели, если она есть", () => {
    const r = planMotiveEucharist({ amount: 3, giverEnergy: 9, receiver: { main: { value: 4, max: 5 }, apoc: { value: 0, max: 5 } } });
    expect(r).toMatchObject({ moved: 3, toMain: 1, toApoc: 2 });
  });
  it("не больше своих ⚡ и не больше свободного места целых Катушек", () => {
    expect(planMotiveEucharist({ amount: 3, giverEnergy: 1, receiver: recv }).moved).toBe(1);
    expect(planMotiveEucharist({ amount: 3, giverEnergy: 9, receiver: { main: { value: 4, max: 5 }, apoc: null } }).moved).toBe(1);
  });
  it("причины отказа", () => {
    expect(planMotiveEucharist({ amount: 3, giverEnergy: 0, receiver: recv })).toMatchObject({ ok: false, reason: "giver" });
    expect(planMotiveEucharist({ amount: 3, giverEnergy: 9, receiver: { main: { value: 5, max: 5 }, apoc: null } })).toMatchObject({ ok: false, reason: "full" });
    expect(planMotiveEucharist({ amount: 3, giverEnergy: 9, receiver: { main: { value: 0, max: 0 }, apoc: null } })).toMatchObject({ ok: false, reason: "full" });
  });
});

// ── Данные паков (настоящие документы) ───────────────────────────────────────
const TECH = "packs-src/talents/Техномистик";
const capEntries = doc => (doc.flags?.["warhammer-dbc"]?.mechanics ?? []).flatMap(g => g.entries ?? [])
  .filter(e => e.kind === "capability");

describe("данные паков", () => {
  for (const [id, key] of [
    ["I5KYA2WhNHPleN8r", "technomystic.core.apocryphaCoil"],
    ["F0MKRY39gJQF6Uap", "technomystic.core.cloudCognition"],
    ["6yjm0n9iYD9ULD7E", "technomystic.core.motiveEucharist"]
  ]) {
    it(`${key}: запись Конструктора есть, читатель назван, заметка не «не смоделировано»`, () => {
      const doc = packDocById(TECH, id);
      expect(capEntries(doc).map(e => e.capabilityKey)).toEqual([key]);
      expect(CAPABILITIES[key].reader).toMatch(/module\//);
      expect(doc.system.notes).not.toMatch(/^Не смоделировано/);
      expect(doc.system.notes).toMatch(/Реализовано/);
    });
  }

  it("Мотивное Причастие: передаётся Энергия ⚡, а не Когниция (книга); подпись возможности исправлена", () => {
    const doc = packDocById(TECH, "6yjm0n9iYD9ULD7E");
    expect(doc.system.benefit).toMatch(/Энерги/);
    expect(doc.system.benefit).not.toMatch(/до 3 Когниции/);
    expect(CAPABILITIES["technomystic.core.motiveEucharist"].label).toMatch(/⚡|Энерги/);
    expect(CAPABILITIES["technomystic.core.motiveEucharist"].label).not.toMatch(/до 3 Когниции/);
  });

  it("Облачная Когниция: остаётся Когниция ⚙ (книга) и есть оговорка про Раунд", () => {
    const doc = packDocById(TECH, "F0MKRY39gJQF6Uap");
    expect(doc.system.benefit).toMatch(/2 своей Когниции/);
    expect(doc.system.benefit).toMatch(/Раунд/);
  });
});

describe("счётчик Облачной Когниции привязан к бою", () => {
  it("засчитывается только в том же бою; новый бой начинает с нуля", async () => {
    const { receivedNow, receivedFlagValue } = await import("../../module/rules/technomystic-resources.mjs");
    expect(receivedNow({ combat: "a", n: 2 }, "a")).toBe(2);
    expect(receivedNow({ combat: "a", n: 2 }, "b")).toBe(0);
    expect(receivedNow(2, "a")).toBe(0);          // старый формат (число) не считается
    expect(receivedNow(undefined, "a")).toBe(0);
    expect(receivedFlagValue({ combat: "a", n: 1 }, "a", 2)).toEqual({ combat: "a", n: 3 });
    expect(receivedFlagValue({ combat: "a", n: 1 }, "b", 2)).toEqual({ combat: "b", n: 2 });
  });
});
