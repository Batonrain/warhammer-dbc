// test/combat/heal-target.test.mjs
//
// wdbc-1rno.26, решение владельца 24.10.2026 (вариант L): «Недоверие к Лечению»
// (Затронутый Варпом, субмутация 10) ставится из ОДНОЙ общей точки лечения Ран,
// а не из трёх разбросанных мест. combat/heal-target.mjs — эта точка:
//   • woundsRestored(до, после) — сколько Ран восстановлено (Критические — Раны
//     в минусе, запас здоровья = value − critical);
//   • noteWoundsRestored(пациент, лечащий, сколько) — штраф на час, если лечил
//     другой и Раны реально восстановлены;
//   • healActor(пациент, сколько, {healer}) — лечение «под ключ»: записывает Раны
//     (сперва Критические, потом обычные, до максимума) и зовёт ту же отметку.
// Данные подставного актора — как у настоящего (wounds value/max/critical).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { woundsRestored, noteWoundsRestored, healActor } from "../../module/combat/heal-target.mjs";

const NOW = 1_000_000;
const HOUR = 3600;
const CAP = "mutation.warpTouched.healMistrust";

const mistrustItem = () => ({
  id: "wt", name: "Warp Touched / Затронутый Варпом", type: "mutation", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: CAP, label: "" }
  ] }] } }
});

function applyPaths(target, data) {
  for (const [path, value] of Object.entries(data)) {
    const parts = path.split(".");
    let cur = target;
    for (const part of parts.slice(0, -1)) { cur[part] ??= {}; cur = cur[part]; }
    cur[parts.at(-1)] = value;
  }
}

function person(id, { mistrust = false, wounds = { value: 5, max: 10, critical: 0 }, failFlag = false } = {}) {
  const flags = {};
  const updates = [];
  const a = {
    id, uuid: `Actor.${id}`, name: id, updates, items: mistrust ? [mistrustItem()] : [],
    system: { wounds: { ...wounds }, conditions: {}, characteristics: {} },
    update: async d => { updates.push(d); applyPaths(a, d); return d; },
    getFlag: (ns, k) => flags[`${ns}.${k}`],
    setFlag: async (ns, k, v) => {
      if (failFlag) throw new Error("нет прав");
      flags[`${ns}.${k}`] = v; return v;
    }
  };
  return a;
}
const mark = a => a.getFlag("warhammer-dbc", "healMistrustUntil");

beforeEach(() => { resetCaptured(); game.time = { worldTime: NOW }; });

describe("woundsRestored: сколько Ран восстановлено", () => {
  it("обычные Раны, Критические, смесь", () => {
    expect(woundsRestored({ value: 5, critical: 0 }, { value: 8, critical: 0 })).toBe(3);
    expect(woundsRestored({ value: 0, critical: 4 }, { value: 0, critical: 0 })).toBe(4);
    expect(woundsRestored({ value: 0, critical: 2 }, { value: 3, critical: 0 })).toBe(5);
  });
  it("урон и «без изменений» — 0; пустые данные не падают", () => {
    expect(woundsRestored({ value: 8, critical: 0 }, { value: 5, critical: 0 })).toBe(0);
    expect(woundsRestored({ value: 5, critical: 0 }, { value: 5, critical: 0 })).toBe(0);
    expect(woundsRestored(undefined, undefined)).toBe(0);
  });
});

describe("noteWoundsRestored: общая точка «Недоверия к Лечению»", () => {
  it("лечил другой, Раны восстановлены — метка на час и строка для карточки", async () => {
    const patient = person("p", { mistrust: true });
    const text = await noteWoundsRestored(patient, person("m"), 2);
    expect(mark(patient)).toBe(NOW + HOUR);
    expect(text).toContain("Недоверие к Лечению");
  });

  it("лечит сам себя / лечащего нет — метки нет", async () => {
    const patient = person("p", { mistrust: true });
    expect(await noteWoundsRestored(patient, patient, 2)).toBe("");
    expect(await noteWoundsRestored(patient, null, 2)).toBe("");
    const sameId = person("p", { mistrust: true });
    expect(await noteWoundsRestored(patient, sameId, 2)).toBe("");
    expect(mark(patient)).toBeUndefined();
  });

  it("Раны не восстановлены (0 и меньше) — метки нет", async () => {
    const patient = person("p", { mistrust: true });
    expect(await noteWoundsRestored(patient, person("m"), 0)).toBe("");
    expect(await noteWoundsRestored(patient, person("m"), -3)).toBe("");
    expect(mark(patient)).toBeUndefined();
  });

  it("без субмутации — метки нет", async () => {
    const patient = person("p");
    expect(await noteWoundsRestored(patient, person("m"), 2)).toBe("");
    expect(mark(patient)).toBeUndefined();
  });

  it("лечение было раньше «сейчас»: час считается от него; истёкший — не ставится", async () => {
    const a = person("p", { mistrust: true });
    await noteWoundsRestored(a, person("m"), 1, { at: NOW - 600 });
    expect(mark(a)).toBe(NOW - 600 + HOUR);
    const b = person("q", { mistrust: true });
    expect(await noteWoundsRestored(b, person("m"), 1, { at: NOW - 2 * HOUR })).toBe("");
    expect(mark(b)).toBeUndefined();
  });
});

describe("healActor: лечение под ключ", () => {
  it("лечит Раны, возвращает сколько, и ставит метку, если лечил другой", async () => {
    const patient = person("p", { mistrust: true });
    const res = await healActor(patient, 3, { healer: person("m") });
    expect(patient.system.wounds.value).toBe(8);
    expect(res.applied).toBe(3);
    expect(res.mistrust).toContain("Недоверие к Лечению");
    expect(mark(patient)).toBe(NOW + HOUR);
  });

  it("сперва Критические, потом обычные Раны; не выше максимума (effectiveMax — Саркофаг)", async () => {
    const a = person("p", { wounds: { value: 0, max: 10, critical: 2 } });
    expect((await healActor(a, 5)).applied).toBe(5);
    expect(a.system.wounds).toMatchObject({ value: 3, critical: 0 });
    const b = person("q", { wounds: { value: 8, max: 10, critical: 0 } });
    const rb = await healActor(b, 9);
    expect(rb.applied).toBe(2);
    expect(b.system.wounds.value).toBe(10);
    const c = person("r", { wounds: { value: 3, max: 10, effectiveMax: 5, critical: 0 } });
    expect((await healActor(c, 9)).applied).toBe(2);
    expect(c.system.wounds.value).toBe(5);
  });

  it("лечит сам себя или без лечащего — Раны есть, метки нет", async () => {
    const a = person("p", { mistrust: true });
    expect((await healActor(a, 2, { healer: a })).applied).toBe(2);
    expect((await healActor(a, 1)).applied).toBe(1);
    expect(a.system.wounds.value).toBe(8);
    expect(mark(a)).toBeUndefined();
  });

  it("нечего лечить (здоров) или 0 Ран — запись не шлётся, метки нет", async () => {
    const healthy = person("p", { mistrust: true, wounds: { value: 10, max: 10, critical: 0 } });
    expect((await healActor(healthy, 4, { healer: person("m") })).applied).toBe(0);
    const wounded = person("q", { mistrust: true });
    expect((await healActor(wounded, 0, { healer: person("m") })).applied).toBe(0);
    expect(healthy.updates).toHaveLength(0);
    expect(wounded.updates).toHaveLength(0);
    expect(mark(healthy)).toBeUndefined();
    expect(mark(wounded)).toBeUndefined();
  });

  it("добавочные поля уходят в ТОТ ЖЕ update, что и Раны", async () => {
    const patient = person("p");
    await healActor(patient, 2, { extra: { "system.wounds.firstAidUsed": true } });
    expect(patient.updates).toHaveLength(1);
    expect(patient.updates[0]["system.wounds.value"]).toBe(7);
    expect(patient.updates[0]["system.wounds.firstAidUsed"]).toBe(true);
  });

  it("отказ записать метку не выдаёт себя за невылеченные Раны", async () => {
    const patient = person("p", { mistrust: true, failFlag: true });
    const res = await healActor(patient, 2, { healer: person("m") });
    expect(patient.system.wounds.value).toBe(7);
    expect(res).toMatchObject({ applied: 2, mistrust: "", mistrustFailed: true });
  });

  it("отказ записать Раны (нет прав) — исключение наружу, метки нет", async () => {
    const patient = person("p", { mistrust: true });
    patient.update = async () => { throw new Error("нет прав"); };
    await expect(healActor(patient, 2, { healer: person("m") })).rejects.toThrow("нет прав");
    expect(mark(patient)).toBeUndefined();
  });
});
