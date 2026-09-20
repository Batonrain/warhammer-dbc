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

describe("Интеграция через _showContestDialog: клик по Финту реально ставит флаг", () => {
  it("успешный Финт (через кнопку броска) вызывает onSuccess с целью", async () => {
    const actor  = actorWithFlags({}); actor.uuid = "Actor.attacker"; actor.name = "Атакующий";
    const target = actorWithFlags({}); target.uuid = "Actor.target"; target.name = "Цель";
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([{ actor: target }]) };
    captured.nextRoll = 10; // WS 45 — успех

    await _showContestDialog(actor, { ...MELEE_CONTESTS.feint, onSuccess: resolveFeintSuccess });
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#contest-char": "ws", "#contest-self": "45", "#contest-mod": "0" }));

    expect(target.getFlag("warhammer-dbc", "feintNoEvade")?.byUuid).toBe("Actor.attacker");
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
