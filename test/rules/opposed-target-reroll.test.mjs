// test/rules/opposed-target-reroll.test.mjs
//
// Уравнитель/The Equalizer (wdbc-1rno, Дар Нургла): «противник, чья БАЗОВАЯ
// Характеристика для этого теста выше моей, должен перебрасывать Успехи».
// Проверяется opposedTargetRerollRules напрямую — сравнение направлено в
// обратную сторону от Локуса Кровопролития (rerollWho:"target"): запись
// живёт на ЗАЩИЩАЮЩЕМСЯ (ctx.targetActor), правило обязано попасть в набор
// АТАКУЮЩЕГО (actor).

import { describe, it, expect, vi } from "vitest";
import { opposedTargetRerollRules } from "../../module/rules/item-rules.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import "../../module/rules/sources.mjs"; // регистрирует источник "opposedTarget" по факту импорта

const char = total => ({ total, bonus: Math.floor(total / 10) });

function actorWithChar(ws, items = []) {
  return { system: { characteristics: { ws: char(ws), bs: char(ws) } }, items };
}

function equalizerItem(ws45 = true) {
  return {
    name: "The Equalizer",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g1", operator: "AND", entries: [
      { id: "eq1", kind: "reroll", rerollScope: "attack", rerollMode: "keepWorst",
        rerollWho: "opponent", label: "Уравнитель" }
    ] }] } }
  };
}

describe("opposedTargetRerollRules — Уравнитель", () => {
  it("атакующий с более высокой базовой WS получает навязанный переброс", () => {
    const attacker = actorWithChar(55);
    const defender = actorWithChar(40, [equalizerItem()]);
    const rules = opposedTargetRerollRules(attacker, { targetActor: defender, char: "ws" });
    expect(rules).toHaveLength(1);
    expect(rules[0].effects).toEqual([
      { kind: "rollMode", target: "attack", mode: "keepWorst", rolls: 2, who: "self" }
    ]);
  });

  it("равные базовые Характеристики — книга переброса не даёт", () => {
    const attacker = actorWithChar(40);
    const defender = actorWithChar(40, [equalizerItem()]);
    expect(opposedTargetRerollRules(attacker, { targetActor: defender, char: "ws" })).toEqual([]);
  });

  it("атакующий с более НИЗКОЙ базовой WS — переброса нет", () => {
    const attacker = actorWithChar(30);
    const defender = actorWithChar(40, [equalizerItem()]);
    expect(opposedTargetRerollRules(attacker, { targetActor: defender, char: "ws" })).toEqual([]);
  });

  it("нет ctx.targetActor — источник пуст", () => {
    const attacker = actorWithChar(55);
    expect(opposedTargetRerollRules(attacker, { char: "ws" })).toEqual([]);
  });

  it("нет ctx.char — источник пуст (не с чем сравнивать)", () => {
    const attacker = actorWithChar(55);
    const defender = actorWithChar(40, [equalizerItem()]);
    expect(opposedTargetRerollRules(attacker, { targetActor: defender })).toEqual([]);
  });

  it("rerollWho:\"target\"/\"self\" на предмете цели не утекает в чужой бросок", () => {
    const attacker = actorWithChar(55);
    const foreignItem = {
      name: "Locus of Bloodshed", flags: { "warhammer-dbc": { mechanics: [{ id: "g1", operator: "AND", entries: [
        { id: "e1", kind: "reroll", rerollScope: "opposed", rerollMode: "keepWorst", rerollWho: "target", label: "Кровопролитие" }
      ] }] } }
    };
    const defender = actorWithChar(40, [foreignItem]);
    expect(opposedTargetRerollRules(attacker, { targetActor: defender, char: "ws" })).toEqual([]);
  });

  it("предмет цели выключен по Механике (нет kind:reroll) — источник пуст", () => {
    const attacker = actorWithChar(55);
    const plain = { name: "Обычная Черта", flags: { "warhammer-dbc": { mechanics: [] } } };
    const defender = actorWithChar(40, [plain]);
    expect(opposedTargetRerollRules(attacker, { targetActor: defender, char: "ws" })).toEqual([]);
  });

  // Мутация-guard: строгое ">" — если бы условие ослабили до ">=", тест на
  // "равные Характеристики" выше его бы поймал; здесь дополнительно проверяем
  // границу с обеих сторон одним прогоном, чтобы регресс было видно сразу.
  it("граница строгого сравнения — 41 против 40 уже переброс, 40 против 40 ещё нет", () => {
    const defender = actorWithChar(40, [equalizerItem()]);
    expect(opposedTargetRerollRules(actorWithChar(41), { targetActor: defender, char: "ws" })).toHaveLength(1);
    expect(opposedTargetRerollRules(actorWithChar(40), { targetActor: defender, char: "ws" })).toEqual([]);
  });
});

describe("Уравнитель — сквозь весь конвейер (resolveTest, реальные источники)", () => {
  it("бой: атака по держателю Уравнителя с более высокой WS даёт вынужденный переброс", () => {
    const defender = actorWithChar(40, [equalizerItem()]);
    const attacker = actorWithChar(55);
    const { rerolls } = resolveTest({ actor: attacker, targetActor: defender, kind: "attack", char: "ws", isMelee: true });
    expect(rerolls.some(r => r.mode === "keepWorst" && r.who === "self")).toBe(true);
  });

  it("бой: атака по держателю Уравнителя с более НИЗКОЙ WS переброса не даёт", () => {
    const defender = actorWithChar(40, [equalizerItem()]);
    const attacker = actorWithChar(30);
    const { rerolls } = resolveTest({ actor: attacker, targetActor: defender, kind: "attack", char: "ws", isMelee: true });
    expect(rerolls.some(r => r.mode === "keepWorst" && r.who === "self")).toBe(false);
  });

  // Вторая книжная половина Уравнителя («…или противник выступает атакующим
  // во встречном тесте…») намеренно НЕ автоматизирована — задокументировано
  // границей теста, не багом: rerollScope у записи только "attack", второй
  // "opposed"-записи в паке нет (см. capabilities.mjs, label ключа
  // gift.nurgle.theEqualizer). Причина в шапке opposedTargetRerollRules —
  // «Вид теста» игрок выбирает уже В диалоге, ctx на момент сбора правил об
  // этом ещё не знает.
  it("тест Навыка с targetActor, но НЕ атака — Уравнитель молчит (честная граница покрытия)", () => {
    const defender = actorWithChar(40, [equalizerItem()]);
    const attacker = actorWithChar(55);
    const { rerolls } = resolveTest({ actor: attacker, targetActor: defender, kind: "skill", skill: "intimidate", char: "ws" });
    expect(rerolls.some(r => r.mode === "keepWorst" && r.who === "self")).toBe(false);
  });
});
