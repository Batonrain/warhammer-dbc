// test/combat/bulldoze.test.mjs
//
// Стр. 31, wdbc-x1nz.2.65: «Напролом» — эффект победы (не срабатывает
// Свободная Атака, 5+ Успехов сбивает с ног) и запрет/штраф по Размеру.
// ЧЕСТНО НЕ смоделировано: «один бросок против ВСЕХ врагов на пути по
// очереди» — общий диалог считает только одного оппонента (см. заголовок
// module/combat/bulldoze.mjs) — прохождение через несколько целей остаётся
// на ГМ, как и раньше.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor } from "../support/combat-fixtures.mjs";
import { resolveBulldozeSuccess, bulldozeForbidden, bulldozeSizePenalty, bulldozeSizeDiff } from "../../module/combat/bulldoze.mjs";

function withFlags(actor) {
  const store = {};
  actor.getFlag = (scope, key) => store[`${scope}.${key}`];
  actor.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  return actor;
}

beforeEach(() => resetCaptured());

describe("bulldozeSizeDiff / bulldozeForbidden / bulldozeSizePenalty", () => {
  it("цель того же Размера — diff 0, не запрещено, штрафа нет", () => {
    const actor = actorFor({ size: 4 });
    const target = actorFor({ size: 4 });
    expect(bulldozeSizeDiff(actor, target)).toBe(0);
    expect(bulldozeForbidden(actor, target)).toBe(false);
    expect(bulldozeSizePenalty(actor, target)).toBe(0);
  });

  it("цель на 1 Размер крупнее — запрещено", () => {
    const actor = actorFor({ size: 4 });
    const target = actorFor({ size: 5 });
    expect(bulldozeForbidden(actor, target)).toBe(true);
  });

  it("цель на 2 Размера крупнее — тоже запрещено", () => {
    const actor = actorFor({ size: 3 });
    const target = actorFor({ size: 5 });
    expect(bulldozeForbidden(actor, target)).toBe(true);
  });

  it("цель на 2 Размера МЕНЬШЕ — не запрещено, штраф −20", () => {
    const actor = actorFor({ size: 5 });
    const target = actorFor({ size: 3 });
    expect(bulldozeForbidden(actor, target)).toBe(false);
    expect(bulldozeSizePenalty(actor, target)).toBe(-20);
  });

  it("цель на 1 Размер меньше — штраф −10", () => {
    const actor = actorFor({ size: 5 });
    const target = actorFor({ size: 4 });
    expect(bulldozeSizePenalty(actor, target)).toBe(-10);
  });
});

describe("resolveBulldozeSuccess", () => {
  it("успех <5 Успехов — ставит disengageActive, цель не падает", async () => {
    const actor = withFlags(actorFor({}));
    const target = actorFor({});
    target.update = async () => {};
    let updated = null;
    target.update = async fields => { updated = fields; };

    await resolveBulldozeSuccess(actor, { deg: 3, target });

    expect(actor.getFlag("warhammer-dbc", "disengageActive")).toBe(true);
    expect(updated).toBeNull();
    expect(captured.chat.at(-1).content).not.toContain("Пинком");
  });

  it("5+ Успехов — цель получает Ничком и напоминание про Пинок", async () => {
    const actor = withFlags(actorFor({}));
    const target = actorFor({ conditions: {} });
    let updated = null;
    target.update = async fields => { updated = fields; Object.assign(target.system.conditions, { prone: fields["system.conditions.prone"] }); };

    await resolveBulldozeSuccess(actor, { deg: 5, target });

    expect(updated).toMatchObject({ "system.conditions.prone": true });
    expect(captured.chat.at(-1).content).toContain("Пинком");
  });

  it("без выцеленной цели — предупреждает, флаг не ставится", async () => {
    const actor = withFlags(actorFor({}));
    await resolveBulldozeSuccess(actor, { deg: 6, target: null });
    expect(captured.warnings.some(w => w.includes("не выцелена"))).toBe(true);
    expect(actor.getFlag("warhammer-dbc", "disengageActive")).toBeUndefined();
  });
});
