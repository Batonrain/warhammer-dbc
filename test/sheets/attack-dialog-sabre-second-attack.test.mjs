// test/sheets/attack-dialog-sabre-second-attack.test.mjs
//
// Сабля (core.json, «Типы Рукопашного Оружия»): «при совершении Верховой
// Атаки может проигнорировать бонус +20, чтобы совершить две атаки вместо
// одной, но по разным целям на пути» — галочка отменяет +20 Базы «Верховая
// Атака», второй независимый бросок системой не автоматизирован (честный
// предел, тот же, что у «Вторичных целей Очереди»).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { SABRE_PENDING_FLAG, sabreSecondAttackBlockReason } from "../../module/combat/sabre-second-attack.mjs";

function attackForm(fields = {}, checks = {}) {
  return fakeForm({ "#atk-char": "ws", "#atk-modifier": "0", "#atk-aim": "", ...fields }, checks);
}

function thresholdInCard() {
  const m = (captured.chat.at(-1)?.content ?? "").match(/<label>Порог<\/label><b>(-?\d+)<\/b>/);
  return m ? Number(m[1]) : null;
}

function attacker({ items = [], ...system } = {}) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none", ...system });
  a.update = async () => {};
  // Метки (wdbc-f6j9y: вторая атака Сабли взводится флагом на всаднике).
  const flags = {};
  a.getFlag = (scope, key) => flags[`${scope}.${key}`];
  a.setFlag = async (scope, key, v) => { flags[`${scope}.${key}`] = v; };
  a.unsetFlag = async (scope, key) => { delete flags[`${scope}.${key}`]; };
  return a;
}

/** Цель с uuid токена — вторая атака Сабли сравнивает цели по нему. */
function targetToken(uuid) {
  globalThis.game.user = { ...globalThis.game.user, targets: new Set([{ actor: null, document: { uuid } }]) };
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
  globalThis.game.combat = undefined;
});

describe("Сабля: галочка «вторая атака вместо +20» — видимость", () => {
  it("Сабля верхом — галочка есть", () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Сабля" });
    showAttackDialog(attacker({ items: [weapon], mount: { uuid: "Actor.mount-1" } }), weapon);
    expect(captured.dialog.content).toContain("atk-sabre-second-attack");
  });

  it("Сабля не верхом — галочки нет", () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Сабля" });
    showAttackDialog(attacker({ items: [weapon] }), weapon);
    expect(captured.dialog.content).not.toContain("atk-sabre-second-attack");
  });

  it("Рапира верхом — галочки нет (только у Сабли)", () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Рапира" });
    showAttackDialog(attacker({ items: [weapon], mount: { uuid: "Actor.mount-1" } }), weapon);
    expect(captured.dialog.content).not.toContain("atk-sabre-second-attack");
  });
});

describe("Сабля: эффект (отменяет +20 Верховой Атаки)", () => {
  it("Верховая Атака + галочка — +20 не применяется", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Сабля" });
    const actor = attacker({ items: [weapon], mount: { uuid: "Actor.mount-1" } });
    const p = showAttackDialog(actor, weapon);
    captured.dice = [10, 3];

    await captured.press("roll", attackForm({
      "input[name='atk-base']:checked": { value: "mounted" },
      "#atk-sabre-second-attack": true
    }));
    await p;

    // Сравнение — с той же посадкой на скакуна БЕЗ галочки (второй тест
    // ниже, 65): разница ровно 20 — галочка отменяет ровно бонус Базы
    // «Верховая Атака» (sel.baseBon), не больше и не меньше, независимо от
    // прочих модификаторов верховой посадки (те этой галочкой не тронуты).
    expect(thresholdInCard()).toBe(45);
  });

  it("Верховая Атака БЕЗ галочки — обычный +20 применяется", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Сабля" });
    const actor = attacker({ items: [weapon], mount: { uuid: "Actor.mount-1" } });
    const p = showAttackDialog(actor, weapon);
    captured.dice = [10, 3];

    await captured.press("roll", attackForm({
      "input[name='atk-base']:checked": { value: "mounted" }
    }));
    await p;

    expect(thresholdInCard()).toBe(65);
  });

  it("галочка отмечена, но База НЕ Верховая Атака — ничего не меняет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Сабля" });
    const actor = attacker({ items: [weapon], mount: { uuid: "Actor.mount-1" } });
    const p = showAttackDialog(actor, weapon);
    captured.dice = [10, 3];

    await captured.press("roll", attackForm({
      "input[name='atk-base']:checked": { value: "standard" },
      "#atk-sabre-second-attack": true
    }));
    await p;

    // База «Стандартная» верхом не тянет за собой доп. модификаторов
    // посадки (те завязаны на саму Базу «Верховая Атака») — обычный
    // WS45+10 baseline, галочка Сабли не гейтится (f.baseKey !== "mounted").
    expect(thresholdInCard()).toBe(55);
  });
});

// ── wdbc-f6j9y: реальная вторая атака ──────────────────────────────────────
// Решение владельца 22.09.2026: первая Верховая Атака Саблей с отказом от +20
// взводит вторую атаку до конца Хода — без ОД, вне Лимита Атак, База
// зафиксирована «Верховая Атака» без +20, цель — другая.

const sabre = () => weaponFor({ weaponClass: "melee", meleeCategory: "Меч", meleeSubtype: "Сабля" }, { id: "sabre-1", name: "Сабля" });

describe("Сабля: первая атака взводит вторую", () => {
  it("Верховая + галочка — метка с оружием и первой целью, на карточке кнопка", async () => {
    const weapon = sabre();
    const actor = attacker({ items: [weapon], mount: { uuid: "Actor.mount-1" } });
    targetToken("Scene.s.Token.A");
    const p = showAttackDialog(actor, weapon);
    captured.dice = [10, 3];
    await captured.press("roll", attackForm({
      "input[name='atk-base']:checked": { value: "mounted" },
      "#atk-sabre-second-attack": true
    }));
    await p;
    expect(actor.getFlag("warhammer-dbc", SABRE_PENDING_FLAG)).toEqual({ itemId: "sabre-1", firstTargetUuid: "Scene.s.Token.A" });
    expect(captured.chat.at(-1).content).toContain("wh-sabre-second-attack-btn");
  });

  it("без галочки — метки и кнопки нет", async () => {
    const weapon = sabre();
    const actor = attacker({ items: [weapon], mount: { uuid: "Actor.mount-1" } });
    const p = showAttackDialog(actor, weapon);
    captured.dice = [10, 3];
    await captured.press("roll", attackForm({ "input[name='atk-base']:checked": { value: "mounted" } }));
    await p;
    expect(actor.getFlag("warhammer-dbc", SABRE_PENDING_FLAG)).toBeUndefined();
    expect(captured.chat.at(-1).content).not.toContain("wh-sabre-second-attack-btn");
  });

  it("пока вторая взведена — галочку первой не предлагаем повторно", async () => {
    const weapon = sabre();
    const actor = attacker({ items: [weapon], mount: { uuid: "Actor.mount-1" } });
    await actor.setFlag("warhammer-dbc", SABRE_PENDING_FLAG, { itemId: "sabre-1", firstTargetUuid: "A" });
    showAttackDialog(actor, weapon);
    expect(captured.dialog.content).not.toContain("atk-sabre-second-attack");
  });
});

describe("Сабля: вторая атака", () => {
  function inOwnTurn(actor, ap = 0) {
    actor.type = "character";
    actor.uuid = "Actor.rider";
    actor.system.actionPoints = { value: ap, max: 2 };
    const c = { actor };
    globalThis.game.combat = { started: true, combatant: c, combatants: [c] };
  }

  it("без ОД и после исчерпанного Лимита Атак — бросок идёт, База Верховая без +20, метка снята", async () => {
    const weapon = sabre();
    const actor = attacker({ items: [weapon], mount: { uuid: "Actor.mount-1" } });
    inOwnTurn(actor, 0);
    await actor.setFlag("warhammer-dbc", "attackActionsThisTurn", 1);
    await actor.setFlag("warhammer-dbc", SABRE_PENDING_FLAG, { itemId: "sabre-1", firstTargetUuid: "Scene.s.Token.A" });
    targetToken("Scene.s.Token.B");
    const p = showAttackDialog(actor, weapon, { sabreSecondAttack: true, forceBase: "mounted" });
    expect(captured.dialog.content).toMatch(/id="atk-sabre-second-attack" checked disabled/);
    captured.dice = [10, 3];
    // Игрок пытается подсунуть Полную Атаку — База всё равно Верховая.
    await captured.press("roll", attackForm({
      "input[name='atk-base']:checked": { value: "fullatk" },
      "#atk-sabre-second-attack": true
    }));
    await p;
    expect(thresholdInCard()).toBe(45);
    expect(actor.getFlag("warhammer-dbc", SABRE_PENDING_FLAG)).toBeUndefined();
    expect(actor.getFlag("warhammer-dbc", "attackActionsThisTurn")).toBe(1);
    expect(captured.chat.at(-1).content).not.toContain("wh-sabre-second-attack-btn");
  });

  it("по той же цели — отказ, метка остаётся", async () => {
    const weapon = sabre();
    const actor = attacker({ items: [weapon], mount: { uuid: "Actor.mount-1" } });
    inOwnTurn(actor, 0);
    await actor.setFlag("warhammer-dbc", SABRE_PENDING_FLAG, { itemId: "sabre-1", firstTargetUuid: "Scene.s.Token.A" });
    targetToken("Scene.s.Token.A");
    const chatBefore = captured.chat.length;
    const p = showAttackDialog(actor, weapon, { sabreSecondAttack: true, forceBase: "mounted" });
    captured.dice = [10, 3];
    await captured.press("roll", attackForm({ "#atk-sabre-second-attack": true }));
    await p;
    expect(captured.chat.length).toBe(chatBefore);
    expect(actor.getFlag("warhammer-dbc", SABRE_PENDING_FLAG)).toBeTruthy();
  });
});

describe("sabreSecondAttackBlockReason", () => {
  const ok = { pending: { itemId: "s", firstTargetUuid: "A" }, itemId: "s", targetUuid: "B", mounted: true, outOfTurn: false };
  it("всё сходится — можно", () => expect(sabreSecondAttackBlockReason(ok)).toBe(""));
  it("нет метки", () => expect(sabreSecondAttackBlockReason({ ...ok, pending: null })).toMatch(/сгорела/));
  it("другое оружие", () => expect(sabreSecondAttackBlockReason({ ...ok, itemId: "x" })).toMatch(/той же Саблей/));
  it("чужой Ход", () => expect(sabreSecondAttackBlockReason({ ...ok, outOfTurn: true })).toMatch(/свой Ход/));
  it("спешился", () => expect(sabreSecondAttackBlockReason({ ...ok, mounted: false })).toMatch(/верхом/));
  it("нет цели", () => expect(sabreSecondAttackBlockReason({ ...ok, targetUuid: null })).toMatch(/цель/));
  it("та же цель", () => expect(sabreSecondAttackBlockReason({ ...ok, targetUuid: "A" })).toMatch(/другой цели/));
});
