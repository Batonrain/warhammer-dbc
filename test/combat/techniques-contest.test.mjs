// test/combat/techniques-contest.test.mjs
//
// Агрессивная Стойка (стр. 15): «+10 на все тесты WS, кроме встречных тестов
// против Финта». Давление — тоже WS vs WS контест, но не Финт, поэтому
// бонус ему положен; Повалить/Напролом — тесты Athletics, бонус WS их не
// касается вовсе. _showContestDialog не рендерит DOM (Dialog — заглушка,
// см. foundry-stub.mjs) — единственное, что можно и нужно проверить, это
// содержимое собранной разметки.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { _showContestDialog } from "../../module/combat/techniques.mjs";
import { MELEE_CONTESTS } from "../../module/constants/combat.mjs";

beforeEach(() => resetCaptured());

function selfValue() {
  const m = (captured.dialog?.content ?? "").match(/id="contest-self"[^>]*value="(-?\d+)"/);
  return m ? Number(m[1]) : null;
}

describe("_showContestDialog — бонус Стойки", () => {
  it("Давление в Агрессивной Стойке получает +10 WS", async () => {
    const actor = actorFor({ meleeStance: "aggressive" });
    await _showContestDialog(actor, MELEE_CONTESTS.press);
    expect(selfValue()).toBe(55); // ws 45 + 10
    expect(captured.dialog.content).toContain("Агрессивная");
  });

  it("Финт в Агрессивной Стойке бонус НЕ получает — книга явно исключает его", async () => {
    const actor = actorFor({ meleeStance: "aggressive" });
    await _showContestDialog(actor, MELEE_CONTESTS.feint);
    expect(selfValue()).toBe(45); // ws 45, без бонуса
    expect(captured.dialog.content).not.toContain("Стойка: Агрессивная");
  });

  it("Повалить/Напролом — тесты Athletics, Стойка на них не влияет", async () => {
    const actor = actorFor({ meleeStance: "aggressive" });
    await _showContestDialog(actor, MELEE_CONTESTS.knockdown);
    // Athletics(S) — тест НАВЫКА (wdbc-x1nz.2.73): у стенда Навыка нет,
    // нетренированный S 40 − 20 = 20; бонуса WS нет.
    expect(selfValue()).toBe(20);
  });

  it("тренированная Атлетика входит в порог Повалить (Ранг Навыка, не голая Сила)", async () => {
    const actor = actorFor({ skills: { athletics: { total: 60 } } });
    await _showContestDialog(actor, MELEE_CONTESTS.knockdown);
    expect(selfValue()).toBe(60);
  });

  it("Стандартная Стойка не даёт бонуса Давлению", async () => {
    const actor = actorFor({ meleeStance: "standard" });
    await _showContestDialog(actor, MELEE_CONTESTS.press);
    expect(selfValue()).toBe(45);
  });
});

// wdbc-x1nz.2.66.5: Повалить книгой ограничен ровно двумя Навыками
// (Athletics(S)/Acrobatics(A)) — общий дропдаун характеристик должен
// сужаться до них с правильными подписями, а не предлагать все 10.
describe("_showContestDialog — Повалить сужает выбор характеристики (allowedChars/charLabels)", () => {
  it("список опций — ровно Athletics(S) и Acrobatics(A), с книжными подписями", async () => {
    const actor = actorFor({});
    await _showContestDialog(actor, MELEE_CONTESTS.knockdown);
    const html = captured.dialog.content;
    expect(html).toContain("Athletics(S)");
    expect(html).toContain("Acrobatics(A)");
    expect(html).not.toContain("Int —");
    expect(html).not.toContain("Fel —");
  });

  it("Финт/Давление без allowedChars — дропдаун по-прежнему полный (регресс)", async () => {
    const actor = actorFor({});
    await _showContestDialog(actor, MELEE_CONTESTS.feint);
    const html = captured.dialog.content;
    expect(html).toContain("Int —");
    expect(html).toContain("Fel —");
  });
});

// wdbc-u0by (Truth-Seer/Defiance): диалог Состязаний раньше вообще не читал
// реестр правил (та же дыра, что была у Парирования, module/combat/defense.mjs
// до фикса) — опциональный переброс не мог появиться, даже если у актора был
// Талант/Дар, дающий его. Область считается по характеристике ПО УМОЛЧАНИЮ
// контеста (Финт/Давление — "ws").
describe("_showContestDialog — опциональные перебросы правил (wdbc-u0by)", () => {
  it("предмет с kind:reroll, скоуп char:ws — галочка появляется в разметке Финта", async () => {
    const dancer = { type: "talent", name: "Truth-Seer", system: {},
      flags: { "warhammer-dbc": { mechanics: [{ id: "g1", operator: "AND", entries: [
        { id: "e1", kind: "reroll", rerollScope: "char", rerollChar: "ws", rerollMode: "keepBest", rerollWho: "self", label: "Правдовидец" }
      ] }] } } };
    const actor = actorFor({ items: [dancer] });
    await _showContestDialog(actor, MELEE_CONTESTS.feint);
    expect(captured.dialog.content).toContain("rule-reroll-opt");
    expect(captured.dialog.content).toContain("Правдовидец");
  });

  it("нет подходящего предмета — блока перебросов в разметке нет", async () => {
    const actor = actorFor({});
    await _showContestDialog(actor, MELEE_CONTESTS.feint);
    expect(captured.dialog.content).not.toContain("rule-reroll-opt");
  });
});

// wdbc-vkwe: плоский бонус источника, не завязанного на Стойку/характеристику
// (Мутация Tentacle/Щупальце — +20 на тесты Борьбы, module/combat/
// grapple.mjs::tentacleTechDef). Проверяется здесь, в общем механизме
// _showContestDialog, а не только в grapple.mjs — им пользуются оба.
describe("_showContestDialog — extraBonus (плоский бонус источника)", () => {
  it("складывается с базой характеристики и виден в поле «Ваш бросок с»", async () => {
    const actor = actorFor({});
    await _showContestDialog(actor, { ...MELEE_CONTESTS.knockdown, extraBonus: 20, extraBonusLabel: "Щупальце" });
    expect(selfValue()).toBe(40); // нетренированный Athletics 20 + 20
  });

  it("без extraBonus — поведение не меняется (0 по умолчанию)", async () => {
    const actor = actorFor({});
    await _showContestDialog(actor, MELEE_CONTESTS.knockdown);
    expect(selfValue()).toBe(20); // нетренированный Athletics
  });

  it("складывается со Стойкой, если оба присутствуют", async () => {
    const actor = actorFor({ meleeStance: "aggressive" });
    await _showContestDialog(actor, { ...MELEE_CONTESTS.press, extraBonus: 20, extraBonusLabel: "Щупальце" });
    expect(selfValue()).toBe(75); // ws 45 + 10 (Стойка) + 20 (extraBonus)
  });

  it("показывает подпись бонуса в разметке диалога, отдельно от подписи Стойки", async () => {
    const actor = actorFor({});
    await _showContestDialog(actor, { ...MELEE_CONTESTS.knockdown, extraBonus: 20, extraBonusLabel: "Щупальце" });
    expect(captured.dialog.content).toContain("Щупальце: +20");
  });

  it("отрицательный extraBonus вычитается", async () => {
    const actor = actorFor({});
    await _showContestDialog(actor, { ...MELEE_CONTESTS.knockdown, extraBonus: -10, extraBonusLabel: "Штраф" });
    expect(selfValue()).toBe(10); // нетренированный Athletics 20 − 10
    expect(captured.dialog.content).toContain("Штраф: -10");
  });
});

// Отвлекающее, Оружие Наследия (стр. 427-428): «При Финте — тест на
// Charm(Fel) или Int вместо WS». Подпись — в окне Финта, где этот тест и
// бросается (wdbc-t3c3t.3), а не в окне обычной атаки.
describe("_showContestDialog — Отвлекающее: Fel/Int вместо WS при Финте (wdbc-t3c3t.3)", () => {
  const distracting = () => weaponFor({ weaponClass: "melee", equipped: true,
    legacy: { active: true, mutations: [{ name: "Отвлекающее" }] } });

  it("Финт с Мутацией — подпись у Fel и у Int", async () => {
    await _showContestDialog(actorFor({ items: [distracting()] }), MELEE_CONTESTS.feint);
    const html = captured.dialog.content;
    expect(html).toMatch(/value="fel"[^>]*>[^<]*вместо WS/);
    expect(html).toMatch(/value="int"[^>]*>[^<]*вместо WS/);
  });

  it("Давление с той же Мутацией — подписи нет (только Финт)", async () => {
    await _showContestDialog(actorFor({ items: [distracting()] }), MELEE_CONTESTS.press);
    expect(captured.dialog.content).not.toContain("вместо WS");
  });

  it("Финт без Мутации — подписи нет", async () => {
    await _showContestDialog(actorFor({}), MELEE_CONTESTS.feint);
    expect(captured.dialog.content).not.toContain("вместо WS");
  });
});

// wdbc-t3c3t.7: Реакцию «Повалить» (hooks.mjs) списывали ДО окна — «Отмена»
// её не возвращала. techDef.pay зовётся только по «Бросок!», вместе с ОД.
describe("_showContestDialog — оплата techDef.pay только при подтверждении (wdbc-t3c3t.7)", () => {
  const withOpponent = () => {
    const opp = actorFor({});
    const opponents = () => [opp];
    return opponents;
  };
  const press = () => captured.dialog.buttons.roll.callback(fakeHtml({ "#contest-char": "s", "#contest-self": "20", "#contest-mod": "0" }));

  it("«Отмена» — pay не вызван", async () => {
    let paid = 0;
    await _showContestDialog(actorFor({}), { ...MELEE_CONTESTS.knockdown, opponents: withOpponent(), pay: async () => { paid++; return true; } });
    expect(paid).toBe(0);
  });

  it("«Бросок!» — pay вызван один раз, бросок сделан", async () => {
    let paid = 0;
    await _showContestDialog(actorFor({}), { ...MELEE_CONTESTS.knockdown, opponents: withOpponent(), pay: async () => { paid++; return true; } });
    await press();
    expect(paid).toBe(1);
    expect(captured.chat.length).toBe(1);
  });

  it("pay отказал (нет Реакции) — броска нет", async () => {
    await _showContestDialog(actorFor({}), { ...MELEE_CONTESTS.knockdown, opponents: withOpponent(), pay: async () => false });
    await press();
    expect(captured.chat.length).toBe(0);
  });
});
