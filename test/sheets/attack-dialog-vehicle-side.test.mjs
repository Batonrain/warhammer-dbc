// test/sheets/attack-dialog-vehicle-side.test.mjs
//
// wdbc-kp1o: атака ПЕРСОНАЖА по технике раньше всегда била в Бортовую броню —
// combat/attack.mjs не спрашивал сторону вовсе, combat/damage.mjs подставлял
// side:"side" безусловно. Выбор Лоб/Борт/Корма существовал только в диалоге
// стрельбы САМОЙ машины (sheets/vehicle-sheet.mjs, #vf-side). Теперь тот же
// выбор + опция «Избирательная атака в Корму −20 с Лба/Борта» есть и в окне
// атаки персонажа, когда цель — техника.
//
// Отдельно проверяется исключение Шагохода (wdbc-6wzt, п.9 Ходовой): «Рукопашные
// атаки по Шагоходу не могут через Избирательную атаку −20 попадать в Кормовую
// броню с любой другой стороны» — запрет только для рукопашной, не для
// дальнобойной и не для не-Шагохода.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function attacker(over = {}) {
  const a = actorFor({ items: [], fatigue: { value: 0 }, aiming: "none", ...over });
  a.update = async () => {};
  return a;
}

function characterTarget() {
  return { uuid: "Actor.char-target", type: "character", system: {} };
}

function vehicleTarget(over = {}) {
  return { uuid: "Actor.vehicle-target", type: "vehicle", system: { chassis: {}, ...over } };
}

function walkerTarget(over = {}) {
  return vehicleTarget({ chassis: { type: "walker" }, ...over });
}

function html() { return captured.dialog?.content ?? ""; }

/** Форма окна с полями по умолчанию — то, что вернёт button.form. */
function attackForm(fields = {}) {
  return fakeForm({ "#atk-char": "bs", "#atk-modifier": "0", "#atk-aim": "", ...fields });
}

function textNode() {
  let text = "";
  return {
    get textContent() { return text; },
    set textContent(v) { text = String(v); },
    style: {}, classList: { add: () => {}, remove: () => {} }
  };
}

function htmlNode() {
  let out = "";
  return { get innerHTML() { return out; }, set innerHTML(v) { out = String(v); } };
}

/** Сторона брони, записанная на кнопке «Применить урон» карточки броска. */
function vehicleSideOnCard() {
  const m = (captured.chat.at(-1)?.content ?? "").match(/data-vehicle-side="([^"]*)"/);
  return m ? m[1] : null;
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Сторона брони техники — разметка окна атаки (wdbc-kp1o)", () => {
  it("цель не связана с техникой — поля выбора стороны нет", () => {
    setTargets([characterTarget()]);
    showAttackDialog(attacker(), weaponFor({ rof_single: 1 }));
    expect(html()).not.toContain("atk-vehicle-side");
    expect(html()).not.toContain("atk-vehicle-rear-called");
  });

  it("нет цели вовсе — поля нет", () => {
    setTargets([]);
    showAttackDialog(attacker(), weaponFor({ rof_single: 1 }));
    expect(html()).not.toContain("atk-vehicle-side");
  });

  it("цель — техника — есть селектор с тремя сторонами, Бортовая выбрана по умолчанию", () => {
    setTargets([vehicleTarget()]);
    showAttackDialog(attacker(), weaponFor({ rof_single: 1 }));
    expect(html()).toContain('id="atk-vehicle-side"');
    expect(html()).toContain('value="front"');
    expect(html()).toContain('value="rear"');
    expect(html()).toMatch(/value="side" selected/);
    expect(html()).toContain("Избирательная атака в Корму (-20)");
  });

  it("цель — техника (не Шагоход), дальнобойная — чекбокс Избирательной атаки не заблокирован", () => {
    setTargets([vehicleTarget()]);
    showAttackDialog(attacker(), weaponFor({ rof_single: 1 }));
    expect(html()).not.toMatch(/id="atk-vehicle-rear-called"\s+disabled/);
  });

  it("цель — техника (не Шагоход), рукопашная — чекбокс тоже не заблокирован (запрет только для Шагохода)", () => {
    setTargets([vehicleTarget()]);
    const sword = weaponFor({ weaponClass: "melee" });
    showAttackDialog(attacker({ items: [sword] }), sword);
    expect(html()).not.toMatch(/id="atk-vehicle-rear-called"\s+disabled/);
  });

  it("цель — Шагоход, дальнобойная — чекбокс не заблокирован (запрет только для рукопашной)", () => {
    setTargets([walkerTarget()]);
    showAttackDialog(attacker(), weaponFor({ rof_single: 1 }));
    expect(html()).not.toMatch(/id="atk-vehicle-rear-called"\s+disabled/);
  });

  it("цель — Шагоход, рукопашная — чекбокс заблокирован с поясняющим title (стр. Ходовой п.9)", () => {
    setTargets([walkerTarget()]);
    const sword = weaponFor({ weaponClass: "melee" });
    showAttackDialog(attacker({ items: [sword] }), sword);
    expect(html()).toMatch(/id="atk-vehicle-rear-called"\s+disabled/);
    expect(html()).toContain("Шагоход");
    expect(html()).toContain("недоступно Шагоходу в рукопашной");
  });
});

describe("Избирательная атака в Корму — штраф −20 доезжает до порога (wdbc-kp1o)", () => {
  it("Бортовая по умолчанию, без Избирательной атаки — строки штрафа нет", () => {
    setTargets([vehicleTarget()]);
    const weapon = weaponFor({ rof_single: 1 });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    const breakdown = htmlNode();
    captured.rerender(attackForm({
      "#atk-vehicle-side": "side", "#atk-vehicle-rear-called": false,
      "#atk-total-display": textNode(), "#atk-threshold-breakdown": breakdown,
      ".av-adv-hint": textNode()
    }));

    expect(breakdown.innerHTML).not.toContain("Избирательно в Корму");
  });

  it("Лобовая + Избирательная атака в Корму — отдельная строка штрафа −20", () => {
    setTargets([vehicleTarget()]);
    const weapon = weaponFor({ rof_single: 1 });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    const breakdown = htmlNode();
    captured.rerender(attackForm({
      "#atk-vehicle-side": "front", "#atk-vehicle-rear-called": true,
      "#atk-total-display": textNode(), "#atk-threshold-breakdown": breakdown,
      ".av-adv-hint": textNode()
    }));

    expect(breakdown.innerHTML).toContain("Избирательно в Корму <b>-20</b>");
  });

  it("Бортовая + Избирательная атака в Корму — тоже даёт −20 («с Лба/Борта»)", () => {
    setTargets([vehicleTarget()]);
    const weapon = weaponFor({ rof_single: 1 });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    const breakdown = htmlNode();
    captured.rerender(attackForm({
      "#atk-vehicle-side": "side", "#atk-vehicle-rear-called": true,
      "#atk-total-display": textNode(), "#atk-threshold-breakdown": breakdown,
      ".av-adv-hint": textNode()
    }));

    expect(breakdown.innerHTML).toContain("Избирательно в Корму <b>-20</b>");
  });

  it("напрямую выбранная Кормовая — Избирательная атака бессмысленна, штрафа нет", () => {
    setTargets([vehicleTarget()]);
    const weapon = weaponFor({ rof_single: 1 });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    const breakdown = htmlNode();
    // Галочка технически отмечена, но выбор уже "rear" — прибавлять штраф
    // «за смену стороны» некуда, resolveVehicleSide игнорирует calledRear.
    captured.rerender(attackForm({
      "#atk-vehicle-side": "rear", "#atk-vehicle-rear-called": true,
      "#atk-total-display": textNode(), "#atk-threshold-breakdown": breakdown,
      ".av-adv-hint": textNode()
    }));

    expect(breakdown.innerHTML).not.toContain("Избирательно в Корму");
  });

  it("Шагоход, рукопашная — даже если форма вернула бы Избирательную атаку, штрафа нет", () => {
    setTargets([walkerTarget()]);
    const sword = weaponFor({ weaponClass: "melee" });
    showAttackDialog(attacker({ items: [sword] }), sword);

    const breakdown = htmlNode();
    captured.rerender(attackForm({
      "#atk-char": "ws",
      "#atk-vehicle-side": "front", "#atk-vehicle-rear-called": true,
      "#atk-total-display": textNode(), "#atk-threshold-breakdown": breakdown,
      ".av-adv-hint": textNode()
    }));

    expect(breakdown.innerHTML).not.toContain("Избирательно в Корму");
  });

  it("Шагоход, дальнобойная — Избирательная атака в Корму разрешена и даёт −20", () => {
    setTargets([walkerTarget()]);
    const weapon = weaponFor({ rof_single: 1 });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    const breakdown = htmlNode();
    captured.rerender(attackForm({
      "#atk-vehicle-side": "front", "#atk-vehicle-rear-called": true,
      "#atk-total-display": textNode(), "#atk-threshold-breakdown": breakdown,
      ".av-adv-hint": textNode()
    }));

    expect(breakdown.innerHTML).toContain("Избирательно в Корму <b>-20</b>");
  });
});

describe("Итоговый выбор доезжает до кнопки применения урона — damageData.side (wdbc-kp1o)", () => {
  // Низкий бросок — гарантированное попадание (BS/WS 45 у actorFor), с запасом
  // кубов под бросок урона: без хотя бы одного попадания applyDamageSection
  // не рисует кнопку «Применить урон» вовсе, и data-vehicle-side негде искать.
  beforeEach(() => { captured.dice = [5, 5, 5, 5, 5, 5]; });

  it("не техника — сторона на кнопке пустая (damage.mjs подставит Бортовую сам)", async () => {
    setTargets([characterTarget()]);
    const weapon = weaponFor({ rof_single: 1 });
    const p = showAttackDialog(attacker({ items: [weapon] }), weapon);
    await captured.press("roll", attackForm());
    await p;
    expect(vehicleSideOnCard()).toBe("");
  });

  it("выбор Лобовой без Избирательной атаки — на кнопке ровно front", async () => {
    setTargets([vehicleTarget()]);
    const weapon = weaponFor({ rof_single: 1 });
    const p = showAttackDialog(attacker({ items: [weapon] }), weapon);
    await captured.press("roll", attackForm({
      "#atk-vehicle-side": "front", "#atk-vehicle-rear-called": false
    }));
    await p;
    expect(vehicleSideOnCard()).toBe("front");
  });

  it("Избирательная атака в Корму с Борта — на кнопке rear", async () => {
    setTargets([vehicleTarget()]);
    const weapon = weaponFor({ rof_single: 1 });
    const p = showAttackDialog(attacker({ items: [weapon] }), weapon);
    await captured.press("roll", attackForm({
      "#atk-vehicle-side": "side", "#atk-vehicle-rear-called": true
    }));
    await p;
    expect(vehicleSideOnCard()).toBe("rear");
  });

  it("Шагоход в рукопашной — Избирательная атака в Корму не проходит, на кнопке остаётся front", async () => {
    setTargets([walkerTarget()]);
    const sword = weaponFor({ weaponClass: "melee" });
    const p = showAttackDialog(attacker({ items: [sword] }), sword);
    await captured.press("roll", attackForm({
      "#atk-char": "ws",
      "#atk-vehicle-side": "front", "#atk-vehicle-rear-called": true
    }));
    await p;
    expect(vehicleSideOnCard()).toBe("front");
  });

  it("Шагоход дальнобойным — Избирательная атака в Корму проходит, на кнопке rear", async () => {
    setTargets([walkerTarget()]);
    const weapon = weaponFor({ rof_single: 1 });
    const p = showAttackDialog(attacker({ items: [weapon] }), weapon);
    await captured.press("roll", attackForm({
      "#atk-vehicle-side": "side", "#atk-vehicle-rear-called": true
    }));
    await p;
    expect(vehicleSideOnCard()).toBe("rear");
  });
});
