// test/combat/half-step.test.mjs
//
// Half-Step/Полушаг (Талант, стр. 12, wdbc-9wvm): раз в Ход Свободным
// действием — движение до ½SPD, дистанция списывается с пула Отскока этого
// Раунда (module/combat/recoil-pool.mjs), не с обычного движения.

import { describe, it, expect, beforeEach } from "vitest";
import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { declareHalfStep, actorHasHalfStep } from "../../module/combat/movement-actions.mjs";
import { recoilRemaining } from "../../module/combat/recoil-pool.mjs";

const flush = () => new Promise(r => setTimeout(r, 0));

function fakeActor({ items = [], halfMove = 8 } = {}) {
  const flagStore = {};
  const actor = {
    type: "character", name: "Подставной", items,
    system: { movement: { halfMove } },
    getFlag: (scope, key) => flagStore[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flagStore[`${scope}.${key}`] = value; },
    update: async (changes = {}) => {
      for (const [path, value] of Object.entries(changes)) {
        const keys = path.split(".");
        let node = actor;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    }
  };
  return actor;
}

const halfStepTalent = { id: "t1", type: "talent", name: "Half-Step / Полушаг" };

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
});

describe("actorHasHalfStep", () => {
  it("без Таланта — false", () => {
    expect(actorHasHalfStep(fakeActor())).toBe(false);
  });
  it("с Талантом — true", () => {
    expect(actorHasHalfStep(fakeActor({ items: [halfStepTalent] }))).toBe(true);
  });
});

describe("declareHalfStep: гейты до диалога", () => {
  it("без Таланта — предупреждение, диалог не открывается", async () => {
    const actor = fakeActor();
    await declareHalfStep(actor);
    expect(captured.dialog).toBeNull();
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBeUndefined();
  });

  it("уже использован в этом Раунде — предупреждение, без второго диалога", async () => {
    globalThis.game.combat = { started: true, round: 2 };
    const actor = fakeActor({ items: [halfStepTalent] });

    const p1 = declareHalfStep(actor);
    await flush();
    await captured.press("go", fakeForm({ '[name="meters"]': "2" }));
    await p1;

    captured.dialog = null;
    const p2 = declareHalfStep(actor);
    await flush();
    expect(captured.dialog).toBeNull(); // второй вызов не переоткрыл диалог
    await p2;
  });

  it("остаток Отскока в этом Раунде исчерпан — предупреждение, без диалога", async () => {
    globalThis.game.combat = { started: true, round: 1 };
    const actor = fakeActor({ items: [halfStepTalent], halfMove: 4 });
    await actor.setFlag("warhammer-dbc", "recoilPool", { spent: 4, bonus: 0 }); // весь пул уже потрачен
    await declareHalfStep(actor);
    expect(captured.dialog).toBeNull();
  });
});

describe("declareHalfStep: подтверждённый диалог", () => {
  it("списывает из пула Отскока, ставит movedThisTurn и троттл, постит карточку", async () => {
    globalThis.game.combat = { started: true, round: 1 };
    const actor = fakeActor({ items: [halfStepTalent], halfMove: 8 }); // ½SPD = 4

    const promise = declareHalfStep(actor);
    await flush();
    expect(captured.dialog).toBeTruthy();

    await captured.press("go", fakeForm({ '[name="meters"]': "3" }));
    await promise;

    expect(recoilRemaining(actor)).toBe(5); // 8 − 3
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBe(true);
    expect(captured.chat.at(-1).content).toContain("Полушаг");
    expect(captured.chat.at(-1).content).toContain("3м");
  });

  it("запрошено больше ½SPD — зажимается диалогом (max атрибут), но и код не выпускает больше остатка", async () => {
    globalThis.game.combat = { started: true, round: 1 };
    const actor = fakeActor({ items: [halfStepTalent], halfMove: 8 }); // максимум ½SPD = 4

    const promise = declareHalfStep(actor);
    await flush();
    await captured.press("go", fakeForm({ '[name="meters"]': "999" }));
    await promise;

    expect(recoilRemaining(actor)).toBe(4); // 8 − 4 (зажато пределом ½SPD)
  });

  it("отмена — ничего не тратится, флаг не ставится", async () => {
    globalThis.game.combat = { started: true, round: 1 };
    const actor = fakeActor({ items: [halfStepTalent], halfMove: 8 });

    const promise = declareHalfStep(actor);
    await flush();
    captured.dismiss();
    await promise;

    expect(recoilRemaining(actor)).toBe(8);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBeUndefined();
  });
});
