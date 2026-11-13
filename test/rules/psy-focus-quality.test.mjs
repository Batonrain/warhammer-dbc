// test/rules/psy-focus-quality.test.mjs
//
// Качество предмета-Психофокуса (Psy Focus / Психофокус, Мистическое, core.json
// стр.243): Good.Q «резонирует с одной из Дисциплин и увеличивает бонус от
// психофокуса на +5 для психосил этой дисциплины»; Best.Q — «так же, как Good.Q,
// но также игнорирует штрафы от Крит. Провала на психофокус».
//
// Решения владельца: фокус привязывается к актору явно (psyker.focusItemId +
// psyker.focusResonance), +5 прибавляется только к уже полученному бонусу
// (на провале прибавлять нечего).

import { describe, it, expect } from "vitest";
import {
  activeFocusItem, psyFocusCandidates, focusQualityEffect, focusRollResult
} from "../../module/rules/psy-focus.mjs";

function actorWith(items, psyker = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  return { items: list, system: { psyker } };
}
const focus = (quality, over = {}) => ({
  id: "f1", name: "Psy Focus / Психофокус", type: "gear",
  system: { quality, description: "", effect: "" }, ...over
});

describe("activeFocusItem — явная привязка", () => {
  it("без привязки фокуса нет", () => {
    expect(activeFocusItem(actorWith([focus("best")], {}))).toBeNull();
  });
  it("возвращает предмет по psyker.focusItemId", () => {
    const f = focus("best");
    expect(activeFocusItem(actorWith([f], { focusItemId: "f1" }))).toBe(f);
  });
  it("привязка к удалённому предмету — нет фокуса, а не ошибка", () => {
    expect(activeFocusItem(actorWith([], { focusItemId: "gone" }))).toBeNull();
  });
});

describe("psyFocusCandidates — что предлагать в списке", () => {
  it("берёт Психофокус и Свинцовую Клеть, но не обычное снаряжение", () => {
    const a = actorWith([
      focus("best"),
      { id: "c", name: "Lead Cage / Свинцовая Клеть", type: "gear", system: { quality: "good" } },
      { id: "r", name: "Rope", type: "gear", system: { quality: "common" } }
    ]);
    expect(psyFocusCandidates(a).map(i => i.id).sort()).toEqual(["c", "f1"]);
  });
  it("берёт оружие, в описании которого сказано про психофокус", () => {
    const a = actorWith([
      { id: "s", name: "Force Staff", type: "weapon",
        system: { quality: "good", description: "<p>Служит психофокусом.</p>" } }
    ]);
    expect(psyFocusCandidates(a).map(i => i.id)).toEqual(["s"]);
  });
  it("выбранный предмет остаётся в списке, даже если не опознан по тексту", () => {
    const odd = { id: "o", name: "Странный камень", type: "gear", system: { quality: "best" } };
    const a = actorWith([odd], { focusItemId: "o" });
    expect(psyFocusCandidates(a).map(i => i.id)).toEqual(["o"]);
  });
});

describe("focusQualityEffect — что даёт качество", () => {
  const power = d => ({ system: { discipline: d } });
  const eff = (q, psyker, d) =>
    focusQualityEffect(actorWith([focus(q)], { focusItemId: "f1", ...psyker }), power(d));

  it("нет привязанного фокуса — ни бонуса, ни защиты", () => {
    expect(focusQualityEffect(actorWith([focus("best")], {}), power("telepathy")))
      .toMatchObject({ item: null, bonus: 0, ignoresCritFail: false });
  });
  it("Comm.Q и Poor.Q механически ничего не дают", () => {
    for (const q of ["common", "poor"])
      expect(eff(q, { focusResonance: "telepathy" }, "telepathy"))
        .toMatchObject({ bonus: 0, ignoresCritFail: false });
  });
  it("Good.Q: +5 на резонирующей Дисциплине, крит. провал не отменяет", () => {
    expect(eff("good", { focusResonance: "telepathy" }, "telepathy"))
      .toMatchObject({ resonates: true, bonus: 5, ignoresCritFail: false });
  });
  it("Good.Q на другой Дисциплине — без бонуса", () => {
    expect(eff("good", { focusResonance: "telepathy" }, "divination"))
      .toMatchObject({ resonates: false, bonus: 0 });
  });
  it("Good.Q без выбранного резонанса — без бонуса", () => {
    expect(eff("good", {}, "telepathy")).toMatchObject({ resonates: false, bonus: 0 });
  });
  it("Best.Q: +5 на резонирующей И игнор крит. провала на любой Дисциплине", () => {
    expect(eff("best", { focusResonance: "telepathy" }, "telepathy"))
      .toMatchObject({ bonus: 5, ignoresCritFail: true });
    expect(eff("best", { focusResonance: "telepathy" }, "divination"))
      .toMatchObject({ bonus: 0, ignoresCritFail: true });
  });
  it("Best.Q: игнор крит. провала не зависит от выбора резонанса", () => {
    expect(eff("best", {}, "telepathy")).toMatchObject({ bonus: 0, ignoresCritFail: true });
  });
});

describe("focusRollResult — итог броска психофокуса", () => {
  const none = { bonus: 0, ignoresCritFail: false };
  const good = { bonus: 5, ignoresCritFail: false };
  const best = { bonus: 5, ignoresCritFail: true };
  const bestOff = { bonus: 0, ignoresCritFail: true };

  it("без качества: успех +10, крит. успех +15, провал 0, крит. провал −10 (как было)", () => {
    expect(focusRollResult({ pass: true,  double: false }, none).mod).toBe(10);
    expect(focusRollResult({ pass: true,  double: true  }, none).mod).toBe(15);
    expect(focusRollResult({ pass: false, double: false }, none).mod).toBe(0);
    expect(focusRollResult({ pass: false, double: true  }, none).mod).toBe(-10);
  });
  it("Good.Q: +5 к бонусу — успех +15, крит. успех +20", () => {
    expect(focusRollResult({ pass: true, double: false }, good).mod).toBe(15);
    expect(focusRollResult({ pass: true, double: true  }, good).mod).toBe(20);
  });
  it("Good.Q: на провале прибавлять нечего — 0, а крит. провал по-прежнему −10", () => {
    expect(focusRollResult({ pass: false, double: false }, good).mod).toBe(0);
    expect(focusRollResult({ pass: false, double: true  }, good).mod).toBe(-10);
  });
  it("Best.Q: крит. провал даёт 0 и помечен как проигнорированный", () => {
    const r = focusRollResult({ pass: false, double: true }, best);
    expect(r.mod).toBe(0);
    expect(r.critFailIgnored).toBe(true);
  });
  it("Best.Q: на обычном провале ничего не «игнорировалось»", () => {
    expect(focusRollResult({ pass: false, double: false }, best).critFailIgnored).toBe(false);
  });
  it("Best.Q без резонанса: бонус успеха прежний, но крит. провал снят", () => {
    expect(focusRollResult({ pass: true,  double: false }, bestOff).mod).toBe(10);
    expect(focusRollResult({ pass: false, double: true  }, bestOff).mod).toBe(0);
  });
  it("отдаёт добавку от предмета отдельно — для подписи в карточке", () => {
    expect(focusRollResult({ pass: true, double: false }, good).itemBonus).toBe(5);
    expect(focusRollResult({ pass: false, double: false }, good).itemBonus).toBe(0);
  });
});

describe("focusQualityEffect — Путь «считается Best.Q Психофокусом на все Дисциплины»", () => {
  const power = d => ({ system: { discipline: d } });
  const runes = { focusQuality: "best", focusAllDisciplines: true };
  const noItem = actorWith([], {});

  it("без предмета: +5 на любой Дисциплине и игнор крит. провала", () => {
    for (const d of ["telepathy", "divination", ""])
      expect(focusQualityEffect(noItem, power(d), runes))
        .toMatchObject({ item: null, resonates: true, bonus: 5, ignoresCritFail: true });
  });
  it("Путь без этих полей ведёт себя как раньше", () => {
    expect(focusQualityEffect(noItem, power("telepathy"), { focusTest: true }))
      .toMatchObject({ resonates: false, bonus: 0, ignoresCritFail: false });
    expect(focusQualityEffect(noItem, power("telepathy"), null))
      .toMatchObject({ resonates: false, bonus: 0, ignoresCritFail: false });
  });
  it("с реальным Best.Q предметом бонус не суммируется: +5, а не +10", () => {
    const a = actorWith([focus("best")], { focusItemId: "f1", focusResonance: "telepathy" });
    const r = focusQualityEffect(a, power("telepathy"), runes);
    expect(r.bonus).toBe(5);
    expect(r.item).toBe(a.items[0]);
    expect(r.ignoresCritFail).toBe(true);
  });
  it("с предметом Good.Q Путь всё равно даёт Best.Q", () => {
    const a = actorWith([focus("good")], { focusItemId: "f1", focusResonance: "divination" });
    expect(focusQualityEffect(a, power("telepathy"), runes))
      .toMatchObject({ bonus: 5, ignoresCritFail: true });
  });
  it("Путь с Good.Q на все Дисциплины: +5, но крит. провал не снимает", () => {
    expect(focusQualityEffect(noItem, power("telepathy"), { focusQuality: "good", focusAllDisciplines: true }))
      .toMatchObject({ bonus: 5, ignoresCritFail: false });
  });
  it("итог броска: крит. провал даёт 0, успех +15, крит. успех +20", () => {
    const eff = focusQualityEffect(noItem, power("telepathy"), runes);
    expect(focusRollResult({ pass: false, double: true }, eff).mod).toBe(0);
    expect(focusRollResult({ pass: true, double: false }, eff).mod).toBe(15);
    expect(focusRollResult({ pass: true, double: true }, eff).mod).toBe(20);
  });
});
