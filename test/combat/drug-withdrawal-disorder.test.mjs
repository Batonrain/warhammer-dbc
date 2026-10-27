// test/combat/drug-withdrawal-disorder.test.mjs
//
// Пачки I4/I5 (Псайкана, Sahara 3-28, решения владельца 27.10.2026): «Агрессия 2» зависимости
// Психического Вампира выдаётся САМА. Книга: эффект зависимости у Вампира — ментальное расстройство
// Агрессия на тяжести 2. Решение I5: расстройство ложится СРАЗУ, когда возникла зависимость, держится,
// пока зависимость не сорвана (новая доза его НЕ снимает), снимается только срывом. Если у персонажа уже
// есть своя «Агрессия» — её тяжесть поднимается на +2 на время зависимости, а при срыве возвращается
// прежняя (исходная тяжесть запоминается во флаге предмета); своё расстройство не дублируется и не удаляется.
// Расстройство — обычный предмет «mentalDisorder» (тот же механизм, что у кнопки «Добавить расстройство»),
// помеченный флагом withdrawalDisorder = ключ препарата. Чистая часть — rules/drug-withdrawal.mjs;
// обвязка — combat/drug-withdrawal.mjs.

import "../support/foundry-stub.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { drugWithdrawalClock, startWithdrawal, endWithdrawal, syncWithdrawalDisorders,
         WITHDRAWAL_DISORDER_FLAG, WITHDRAWAL_BOOST_FLAG } from "../../module/combat/drug-withdrawal.mjs";
import { withdrawalDisorders } from "../../module/rules/drug-withdrawal.mjs";
import { vampireDrug, VAMPIRE_ADDICTION } from "../../module/rules/psychic-vampire.mjs";
import { DISORDER_LIBRARY } from "../../module/constants/fear-tables.mjs";

const D = 86400, NS = "warhammer-dbc";
const T0 = 500 * D;

/** Запись по пути «a.b.c» в духе Foundry; «-=ключ» удаляет. */
function applyPath(obj, path, v) {
  const ks = path.split(".");
  let o = obj;
  for (const k of ks.slice(0, -1)) o = (o[k] ??= {});
  const last = ks.at(-1);
  if (last.startsWith("-=")) delete o[last.slice(2)]; else o[last] = v;
}

/** Свой предмет-расстройство игрока (с update, как у настоящего документа). */
function ownDisorder(name, severity, id = "own") {
  const it = { id, type: "mentalDisorder", name, system: { severity }, flags: {},
    getFlag: (s, k) => it.flags[s]?.[k],
    update: async d => { for (const [p, v] of Object.entries(d)) applyPath(it, p, v); } };
  return it;
}

/** Персонаж-заглушка: флаги актора, предметы-расстройства создаются и удаляются как в Foundry. */
function person(items = []) {
  let seq = 0;
  const list = [...items];
  const a = {
    name: "Вампир", items: list, flags: { [NS]: {} },
    system: { characteristics: { wp: { total: 50, bonus: 5 } }, conditions: {}, fatigue: { value: 0 } },
    getFlag: (_s, k) => a.flags[NS][k],
    setFlag: async (_s, k, v) => { a.flags[NS][k] = foundry.utils.mergeObject(a.flags[NS][k] ?? {}, v, { inplace: false }); },
    createEmbeddedDocuments: async (_t, docs) => docs.map(d => {
      const f = JSON.parse(JSON.stringify(d.flags ?? {}));
      const item = { ...d, id: `i${++seq}`, flags: f, getFlag: (s, k) => f[s]?.[k] };
      list.push(item);
      return item;
    }),
    deleteEmbeddedDocuments: async (_t, ids) => {
      for (const id of ids) { const at = list.findIndex(i => i.id === id); if (at >= 0) list.splice(at, 1); }
    },
    update: async () => {}
  };
  return a;
}
const disorders = a => a.items.filter(i => i.type === "mentalDisorder");
const ours = a => disorders(a).filter(i => i.getFlag(NS, WITHDRAWAL_DISORDER_FLAG));
const addicted = (a, now = T0) => startWithdrawal(a, vampireDrug(), now);
const KEY = vampireDrug().name;
/** Всплывающие сообщения за время действия. */
async function infosOf(fn) {
  const infos = [];
  const prev = globalThis.ui.notifications.info;
  globalThis.ui.notifications.info = m => infos.push(String(m));
  try { await fn(); } finally { globalThis.ui.notifications.info = prev; }
  return infos;
}

beforeEach(() => { resetCaptured(); globalThis.game.time = { worldTime: T0 }; });

describe("данные Вампира: расстройство — часть настройки зависимости", () => {
  it("«Агрессия» тяжести 2 лежит в настройках зависимости рядом с текстом штрафа", () => {
    expect(VAMPIRE_ADDICTION.penaltyDisorder).toEqual({ name: "Агрессия", severity: 2 });
    expect(VAMPIRE_ADDICTION.penalty).toContain("Агрессия");
  });
  it("«Агрессия» есть в библиотеке расстройств — берётся оттуда описание и тест", () => {
    expect(DISORDER_LIBRARY.some(d => d.name === "Агрессия")).toBe(true);
  });
});

describe("чистая часть: какие расстройства положены", () => {
  const entry = lastDose => ({ addicted: true, name: KEY, addiction: JSON.parse(JSON.stringify(VAMPIRE_ADDICTION)), lastDose, doneTo: T0, tested: 0 });
  it("зависимость есть — Агрессия тяжести 2 положена сразу, срок дозы не важен", () => {
    expect(withdrawalDisorders([], { [KEY]: entry(T0) })).toEqual([{ key: KEY, name: "Агрессия", severity: 2 }]);
    expect(withdrawalDisorders([], { [KEY]: entry(null) })).toHaveLength(1);
  });
  it("зависимости нет (запись снята) — ничего", () => {
    expect(withdrawalDisorders([], { [KEY]: null })).toEqual([]);
  });
  it("обычный наркотик без поля расстройства — ничего", () => {
    const e = { Тиск: { addicted: true, name: "Тиск", addiction: { hasAddiction: true, frequency: "1 день" }, lastDose: T0, doneTo: T0, tested: 0 } };
    expect(withdrawalDisorders([], e)).toEqual([]);
  });
});

describe("расстройство выдаётся сразу и держится до срыва", () => {
  it("зависимость возникла — Агрессия тяжести 2 на листе, помечена ключом препарата, игроку об этом сказано", async () => {
    const a = person();
    const infos = await infosOf(() => addicted(a));
    const [item] = ours(a);
    expect(item.name).toContain("Агрессия");
    expect(item.system.severity).toBe(2);
    expect(item.getFlag(NS, WITHDRAWAL_DISORDER_FLAG)).toBe(KEY);
    expect(infos.join(" ")).toContain("Агрессия");
  });
  it("новая доза расстройство НЕ снимает и второго не плодит", async () => {
    const a = person();
    await addicted(a);
    await startWithdrawal(a, vampireDrug(), T0 + 3 * D);
    expect(ours(a)).toHaveLength(1);
  });
  it("часы Календаря — на 3 дня, на 6 дней, прыжком на 100 дней — одно и то же расстройство", async () => {
    const a = person();
    await addicted(a);
    const id = ours(a)[0].id;
    for (const to of [3 * D, 6 * D, 13 * D, 100 * D]) await drugWithdrawalClock(a, { from: T0, to: T0 + to });
    expect(ours(a).map(i => i.id)).toEqual([id]);
  });
  it("зависимость сорвана (endWithdrawal) — расстройство снимается, игроку об этом сказано", async () => {
    const a = person();
    await addicted(a);
    const infos = await infosOf(() => endWithdrawal(a, KEY));
    expect(disorders(a)).toHaveLength(0);
    expect(infos.join(" ")).toContain("снято");
  });
  it("после срыва и новой зависимости расстройство ложится снова", async () => {
    const a = person();
    await addicted(a);
    await endWithdrawal(a, KEY);
    await addicted(a, T0 + 9 * D);
    expect(ours(a)).toHaveLength(1);
  });
  it("запись зависимости пропала без endWithdrawal (флаг стёрт вручную) — следующая синхронизация снимает расстройство", async () => {
    const a = person();
    await addicted(a);
    a.flags[NS].drugWithdrawal = {};
    await syncWithdrawalDisorders(a, T0 + 7 * D);
    expect(disorders(a)).toHaveLength(0);
  });
  it("то же через часы Календаря: зависимостей нет вовсе, а расстройство висит — первый же сдвиг времени его снимает", async () => {
    const a = person();
    await addicted(a);
    a.flags[NS].drugWithdrawal = {};
    await drugWithdrawalClock(a, { from: T0, to: T0 + D });
    expect(disorders(a)).toHaveLength(0);
  });
  it("расстройство удалили вручную — вернётся на следующем сдвиге Календаря, и об этом сообщается", async () => {
    const a = person();
    await addicted(a);
    a.items.splice(0, a.items.length);
    const infos = await infosOf(() => drugWithdrawalClock(a, { from: T0, to: T0 + D }));
    expect(ours(a)).toHaveLength(1);
    expect(infos.join(" ")).toContain("Агрессия");
  });
});

describe("своя «Агрессия» игрока: тяжесть +2 на время зависимости, потом прежняя", () => {
  const boostOf = i => i.getFlag(NS, WITHDRAWAL_BOOST_FLAG);

  it("тяжесть растёт на 2, второго расстройства нет, свою не помечаем как выданную; исходная тяжесть запомнена", async () => {
    const own = ownDisorder("Агрессия", 1);
    const a = person([own]);
    const infos = await infosOf(() => addicted(a));
    expect(disorders(a)).toHaveLength(1);
    expect(ours(a)).toHaveLength(0);
    expect(own.system.severity).toBe(3);
    expect(boostOf(own)).toEqual({ key: KEY, from: 1, applied: 3 });
    expect(infos.join(" ")).toContain("3");
  });
  it("повторные дозы и сдвиги Календаря прибавку не удваивают", async () => {
    const own = ownDisorder("Агрессия", 1);
    const a = person([own]);
    await addicted(a);
    await startWithdrawal(a, vampireDrug(), T0 + 2 * D);
    await drugWithdrawalClock(a, { from: T0, to: T0 + 30 * D });
    expect(own.system.severity).toBe(3);
  });
  it("срыв зависимости: возвращается прежняя тяжесть, расстройство остаётся, метка убрана", async () => {
    const own = ownDisorder("Агрессия", 1);
    const a = person([own]);
    await addicted(a);
    await endWithdrawal(a, KEY);
    expect(own.system.severity).toBe(1);
    expect(boostOf(own)).toBeUndefined();
    expect(disorders(a)).toEqual([own]);
  });
  it("у потолка тяжести (5) прибавка обрезается, а возвращается всё равно исходная", async () => {
    const own = ownDisorder("Агрессия", 4);
    const a = person([own]);
    await addicted(a);
    expect(own.system.severity).toBe(5);
    expect(boostOf(own)).toEqual({ key: KEY, from: 4, applied: 5 });
    await endWithdrawal(a, KEY);
    expect(own.system.severity).toBe(4);
  });
  it("игрок сам менял тяжесть за это время — сохраняем его правку: снимаем только нашу прибавку (текущая − фактическая прибавка)", async () => {
    const own = ownDisorder("Агрессия", 1);
    const a = person([own]);
    await addicted(a);                                  // 3
    own.system.severity = 4;                            // игрок поднял сам
    await endWithdrawal(a, KEY);
    expect(own.system.severity).toBe(2);                // 4 − 2
    const low = ownDisorder("Агрессия", 0, "low");
    const b = person([low]);
    await addicted(b);                                  // 2
    low.system.severity = 0;                            // игрок опустил сам
    await endWithdrawal(b, KEY);
    expect(low.system.severity).toBe(-2);               // 0 − 2: прибавка снята, правка игрока сохранена
  });
  it("игрок удалил свою «Агрессию» за время зависимости — выдаётся своя, помеченная", async () => {
    const own = ownDisorder("Агрессия", 1);
    const a = person([own]);
    await addicted(a);
    a.items.splice(0, a.items.length);
    await drugWithdrawalClock(a, { from: T0, to: T0 + D });
    expect(ours(a)).toHaveLength(1);
    expect(ours(a)[0].system.severity).toBe(2);
  });
  it("другое расстройство игрока при срыве остаётся нетронутым", async () => {
    const other = ownDisorder("Кошмары", 1, "x");
    const a = person([other]);
    await addicted(a);
    await endWithdrawal(a, KEY);
    expect(disorders(a).map(i => i.name)).toEqual(["Кошмары"]);
    expect(other.system.severity).toBe(1);
  });
});
