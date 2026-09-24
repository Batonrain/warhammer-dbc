// test/combat/feint-press.test.mjs
//
// Стр. 31, wdbc-x1nz.2.65: эффект победы Финта («цель не может Уклоняться от
// его атак до конца его Хода») и Давления («может сдвинуть цель на Успехи м,
// потолок SPD цели») — раньше был только бросок, эффект не применялся.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { actorFor } from "../support/combat-fixtures.mjs";
import { _showContestDialog } from "../../module/combat/techniques.mjs";
import { MELEE_CONTESTS } from "../../module/constants/combat.mjs";
import { resistButtonData } from "../support/contest.mjs";
import { resolveResistClick, _resetPendingContests } from "../../module/combat/opposed-contest.mjs";
import { resolveFeintSuccess, resolvePressSuccess, feintBlocksEvasion, clearFeintAtTurnEnd } from "../../module/combat/feint-press.mjs";

beforeEach(() => {
  resetCaptured();
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } };
});

function actorWithFlags(over = {}) {
  const a = actorFor(over);
  const store = {};
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  a.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  return a;
}

describe("resolveFeintSuccess", () => {
  it("ставит флаг на цели и обратный указатель на акторе", async () => {
    const actor  = actorWithFlags({});
    actor.uuid = "Actor.attacker"; actor.name = "Атакующий";
    const target = actorWithFlags({});
    target.uuid = "Actor.target"; target.name = "Цель";

    await resolveFeintSuccess(actor, { target });

    expect(target.getFlag("warhammer-dbc", "feintNoEvade")).toEqual({ byUuid: "Actor.attacker", byName: "Атакующий" });
    expect(actor.getFlag("warhammer-dbc", "feintTargetUuid")).toBe("Actor.target");
    expect(captured.chat.at(-1).content).toContain("недоступно");
  });

  it("без выцеленной цели — предупреждает, флагов не ставит", async () => {
    const actor = actorWithFlags({});
    actor.uuid = "Actor.attacker";
    await resolveFeintSuccess(actor, { target: null });
    expect(captured.warnings.some(w => w.includes("не выцелена"))).toBe(true);
    expect(captured.chat.length).toBe(0);
  });
});

describe("feintBlocksEvasion", () => {
  it("true, когда флаг цели указывает именно на этого атакующего", () => {
    const target = actorWithFlags({});
    target.setFlag("warhammer-dbc", "feintNoEvade", { byUuid: "Actor.a", byName: "A" });
    expect(feintBlocksEvasion(target, { uuid: "Actor.a" })).toBe(true);
  });

  it("false — флаг от ДРУГОГО атакующего", () => {
    const target = actorWithFlags({});
    target.setFlag("warhammer-dbc", "feintNoEvade", { byUuid: "Actor.a", byName: "A" });
    expect(feintBlocksEvasion(target, { uuid: "Actor.b" })).toBe(false);
  });

  it("false — флага нет вовсе", () => {
    const target = actorWithFlags({});
    expect(feintBlocksEvasion(target, { uuid: "Actor.a" })).toBe(false);
  });
});

describe("clearFeintAtTurnEnd", () => {
  it("снимает оба флага — с атакующего и с цели", async () => {
    const actor  = actorWithFlags({}); actor.uuid = "Actor.attacker";
    const target = actorWithFlags({}); target.uuid = "Actor.target";
    await target.setFlag("warhammer-dbc", "feintNoEvade", { byUuid: actor.uuid, byName: "A" });
    await actor.setFlag("warhammer-dbc", "feintTargetUuid", target.uuid);
    globalThis.fromUuid = async uuid => (uuid === target.uuid ? target : null);

    await clearFeintAtTurnEnd(actor);

    expect(actor.getFlag("warhammer-dbc", "feintTargetUuid")).toBeUndefined();
    expect(target.getFlag("warhammer-dbc", "feintNoEvade")).toBeUndefined();
  });

  it("нет указателя на акторе — ничего не делает, не падает", async () => {
    const actor = actorWithFlags({});
    await expect(clearFeintAtTurnEnd(actor)).resolves.toBeUndefined();
  });

  it("цель уже перехвачена другим Финтом (флаг указывает на кого-то ещё) — свой указатель не трогает чужой флаг", async () => {
    const actor   = actorWithFlags({}); actor.uuid = "Actor.attacker";
    const other   = actorWithFlags({}); other.uuid = "Actor.other";
    const target  = actorWithFlags({}); target.uuid = "Actor.target";
    await target.setFlag("warhammer-dbc", "feintNoEvade", { byUuid: other.uuid, byName: "Other" });
    await actor.setFlag("warhammer-dbc", "feintTargetUuid", target.uuid);
    globalThis.fromUuid = async uuid => (uuid === target.uuid ? target : null);

    await clearFeintAtTurnEnd(actor);

    expect(target.getFlag("warhammer-dbc", "feintNoEvade")).toEqual({ byUuid: other.uuid, byName: "Other" });
  });
});

describe("resolvePressSuccess", () => {
  it("сдвиг ограничен SPD цели (halfMove), даже если Успехов больше", async () => {
    const actor  = actorWithFlags({}); actor.name = "Толкающий";
    const target = actorWithFlags({ movement: { halfMove: 3 } }); target.name = "Цель";
    await resolvePressSuccess(actor, { deg: 7, target });
    expect(captured.chat.at(-1).content).toContain("до <b>3 м</b>");
  });

  it("Успехов меньше SPD — сдвиг по Успехам", async () => {
    const actor  = actorWithFlags({}); actor.name = "Толкающий";
    const target = actorWithFlags({ movement: { halfMove: 6 } }); target.name = "Цель";
    await resolvePressSuccess(actor, { deg: 2, target });
    expect(captured.chat.at(-1).content).toContain("до <b>2 м</b>");
  });

  it("без выцеленной цели — предупреждает", async () => {
    const actor = actorWithFlags({}); actor.name = "Толкающий";
    await resolvePressSuccess(actor, { deg: 3, target: null });
    expect(captured.warnings.some(w => w.includes("не выцелена"))).toBe(true);
  });
});

// Встречный тест (wdbc-x1nz.2.73): бросок инициатора сам по себе эффекта не
// даёт — цель жмёт «Сопротивляться», и только выигранный встречный тест
// применяет Финт.
async function feintThenResist(actor, target, { mine, theirs }) {
  globalThis.game.user = { ...globalThis.game.user, id: "user-1", isGM: true, targets: new Set([{ actor: target }]) };
  globalThis.fromUuid = async uuid => (uuid === actor.uuid ? actor : uuid === target.uuid ? target : null);
  captured.nextRoll = mine;
  await _showContestDialog(actor, { ...MELEE_CONTESTS.feint, onSuccess: resolveFeintSuccess });
  await captured.dialog.buttons.roll.callback(fakeHtml({ "#contest-char": "ws", "#contest-self": "45", "#contest-mod": "0" }));
  const ds = resistButtonData(captured.chat.at(-1).content);
  if (theirs == null) return ds;
  captured.nextRoll = theirs;
  await resolveResistClick(ds);
  return ds;
}

describe("Интеграция через _showContestDialog: клик по Финту реально ставит флаг", () => {
  beforeEach(() => _resetPendingContests());

  it("Финт выиграл встречный тест — onSuccess ставит флаг на цели", async () => {
    const actor  = actorWithFlags({}); actor.uuid = "Actor.attacker"; actor.name = "Атакующий";
    const target = actorWithFlags({}); target.uuid = "Actor.target"; target.name = "Цель";
    await feintThenResist(actor, target, { mine: 10, theirs: 90 }); // 4 Успеха против провала

    expect(target.getFlag("warhammer-dbc", "feintNoEvade")?.byUuid).toBe("Actor.attacker");
  });

  it("свой бросок успешен, но цель бросила лучше — Финт не удаётся", async () => {
    const actor  = actorWithFlags({}); actor.uuid = "Actor.attacker";
    const target = actorWithFlags({}); target.uuid = "Actor.target";
    await feintThenResist(actor, target, { mine: 40, theirs: 5 }); // 1 Успех против 5

    expect(target.getFlag("warhammer-dbc", "feintNoEvade")).toBeUndefined();
    expect(captured.chat.at(-1).content).toContain("отбивается");
  });

  it("пока цель не бросила — эффекта нет, в карточке кнопка «Сопротивляться»", async () => {
    const actor  = actorWithFlags({}); actor.uuid = "Actor.attacker";
    const target = actorWithFlags({}); target.uuid = "Actor.target"; target.name = "Цель";
    const ds = await feintThenResist(actor, target, { mine: 10, theirs: null });

    expect(ds).not.toBeNull();
    expect(ds.opponentUuid).toBe("Actor.target");
    expect(target.getFlag("warhammer-dbc", "feintNoEvade")).toBeUndefined();
  });

  it("без цели бросок не делается вовсе", async () => {
    const actor = actorWithFlags({});
    globalThis.game.user = { ...globalThis.game.user, targets: new Set() };
    await _showContestDialog(actor, { ...MELEE_CONTESTS.feint, onSuccess: resolveFeintSuccess });
    const before = captured.chat.length;
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#contest-char": "ws", "#contest-self": "45", "#contest-mod": "0" }));
    expect(captured.chat.length).toBe(before);
    expect(captured.warnings.some(w => w.includes("нет противника"))).toBe(true);
  });

  it("провал Финта — флаг не ставится", async () => {
    const actor  = actorWithFlags({}); actor.uuid = "Actor.attacker";
    const target = actorWithFlags({}); target.uuid = "Actor.target";
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([{ actor: target }]) };
    captured.nextRoll = 90; // WS 45 — провал

    await _showContestDialog(actor, { ...MELEE_CONTESTS.feint, onSuccess: resolveFeintSuccess });
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#contest-char": "ws", "#contest-self": "45", "#contest-mod": "0" }));

    expect(target.getFlag("warhammer-dbc", "feintNoEvade")).toBeUndefined();
  });
});
