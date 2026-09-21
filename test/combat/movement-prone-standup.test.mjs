// test/combat/movement-prone-standup.test.mjs
//
// Стр. 30, wdbc-x1nz.2.36: Лечь (Свободное действие, накладывает «Повален»)
// и Встать (обычным способом — Полудействие; прыжком — тест Acrobatics:
// Успех встаёт Свободным действием, Провал даёт врагам в рукопашной
// Свободную Атаку, но персонаж всё равно встаёт Полудействием).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { declareProne, declareStandUp, _standUpPlain, _standUpJump } from "../../module/combat/movement-actions.mjs";

function actorFor({ prone = false, actionPoints = { value: 2, max: 2 }, grappling = false } = {}) {
  const doc = {
    name: "Подставной", type: "character", uuid: "Actor.a1",
    system: {
      conditions: { prone, grappling },
      actionPoints,
      characteristics: { ag: { total: 40, bonus: 4 } },
      skills: {}
    }
  };
  doc.update = async data => {
    for (const [path, value] of Object.entries(data)) {
      const keys = path.split(".");
      let node = doc;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = value;
    }
    return doc;
  };
  doc.getActiveTokens = () => [];
  return doc;
}

beforeEach(() => { resetCaptured(); globalThis.game.combat = undefined; });
afterEach(() => { globalThis.game.combat = undefined; });

describe("declareProne (Лечь)", () => {
  it("накладывает Состояние «Повален»", async () => {
    const actor = actorFor();
    await declareProne(actor);
    expect(actor.system.conditions.prone).toBe(true);
    expect(captured.chat).toHaveLength(1);
  });

  it("уже Повален — предупреждение, без повторного наложения", async () => {
    const actor = actorFor({ prone: true });
    await declareProne(actor);
    expect(captured.warnings.some(w => w.includes("Уже Повален"))).toBe(true);
    expect(captured.chat).toHaveLength(0);
  });

  it("в Захвате — блокируется (Физическое действие, wdbc-x1nz.2.31)", async () => {
    const actor = actorFor({ grappling: true });
    await declareProne(actor);
    expect(actor.system.conditions.prone).toBe(false);
    expect(captured.chat).toHaveLength(0);
  });
});

describe("declareStandUp: гейты входа", () => {
  it("не Повален — предупреждение, диалог не открывается", async () => {
    const actor = actorFor({ prone: false });
    await declareStandUp(actor);
    expect(captured.warnings.some(w => w.includes("не Повален"))).toBe(true);
    expect(captured.dialog).toBeNull();
  });
});

describe("_standUpPlain (обычным способом)", () => {
  it("в бою хватает ОД — списывает 1 ОД, снимает Повален", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ prone: true, actionPoints: { value: 2, max: 2 } });
    await _standUpPlain(actor);
    expect(actor.system.actionPoints.value).toBe(1);
    expect(actor.system.conditions.prone).toBe(false);
  });

  it("в бою без ОД — блокируется, остаётся Повален", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ prone: true, actionPoints: { value: 0, max: 2 } });
    await _standUpPlain(actor);
    expect(actor.system.conditions.prone).toBe(true);
  });
});

describe("_standUpJump (прыжком)", () => {
  it("Успех — встаёт Свободным действием, ОД не трогает", async () => {
    globalThis.game.combat = { started: true };
    captured.dice = [10]; // Acrobatics 40 — успех
    const actor = actorFor({ prone: true, actionPoints: { value: 2, max: 2 } });
    await _standUpJump(actor);
    expect(actor.system.conditions.prone).toBe(false);
    expect(actor.system.actionPoints.value).toBe(2);
    expect(captured.chat.at(-1).content).toContain("Успех");
  });

  it("Провал — встаёт всё равно Полудействием (1 ОД), карточка отмечает Свободную Атаку врагам", async () => {
    globalThis.game.combat = { started: true };
    captured.dice = [90]; // Acrobatics 40 — провал
    const actor = actorFor({ prone: true, actionPoints: { value: 2, max: 2 } });
    await _standUpJump(actor);
    expect(actor.system.conditions.prone).toBe(false);
    expect(actor.system.actionPoints.value).toBe(1);
    expect(captured.chat.at(-1).content).toContain("Провал");
    expect(captured.chat.at(-1).content).toContain("Свободную Атаку");
  });

  it("Провал без ОД на полудействие — остаётся Повален", async () => {
    globalThis.game.combat = { started: true };
    captured.dice = [90];
    const actor = actorFor({ prone: true, actionPoints: { value: 0, max: 2 } });
    await _standUpJump(actor);
    expect(actor.system.conditions.prone).toBe(true);
  });
});
