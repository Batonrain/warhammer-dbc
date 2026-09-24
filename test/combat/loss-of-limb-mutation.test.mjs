// test/combat/loss-of-limb-mutation.test.mjs
//
// wdbc-1rno.6.1: мутация Loss of Limb / Потеря Конечности — выпавшая строка
// субмутации (d10) ставит потерю на своей стороне без Кровотечения и таймера
// Гангрены; «Пальцы» (1/6) — −10 к атакам оружием в этой руке; вернуть часть
// тела — только Best.Q бионикой.

import "../support/foundry-stub.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { syncLossOfLimbMutation, isLossOfLimbMutation } from "../../module/combat/limb-loss.mjs";
import { lossOfLimbTarget, mutationLossFields, lostSideFields, lostByMutation } from "../../module/rules/limb-loss.mjs";
import { fingersPenalty } from "../../module/sheets/attack/mods.mjs";

function makeActor() {
  const actor = {
    name: "Порченый", items: [], system: { lostLimbs: {}, conditions: {}, characteristics: { t: { bonus: 3 } } },
    update: async data => {
      for (const [p, v] of Object.entries(data)) {
        const parts = p.split(".");
        let o = actor;
        for (const k of parts.slice(0, -1)) o = (o[k] ??= {});
        o[parts.at(-1)] = v;
      }
    },
    updateEmbeddedDocuments: async () => []
  };
  return actor;
}

function makeMutation(actor, label) {
  const flags = {};
  return {
    type: "mutation", name: "Loss of Limb / Потеря Конечности", actor,
    system: { submutation: { label } },
    getFlag: (ns, k) => flags[k], setFlag: async (ns, k, v) => { flags[k] = v; }, unsetFlag: async (ns, k) => { delete flags[k]; }
  };
}

beforeEach(resetCaptured);

describe("таблица субмутаций", () => {
  it("d10 → часть тела и сторона", () => {
    expect(lossOfLimbTarget("1")).toEqual({ fingers: true, side: "right" });
    expect(lossOfLimbTarget("8")).toEqual({ key: "lostArms", side: "left" });
    expect(lossOfLimbTarget("10")).toEqual({ key: "lostFeet", side: "left" });
    expect(lossOfLimbTarget("")).toBeNull();
  });

  it("патч мутации — без таймера Гангрены, с пометкой mutation", () => {
    expect(mutationLossFields(lossOfLimbTarget("4"))).toEqual({
      "system.lostLimbs.rightLeg.lost": true, "system.lostLimbs.rightLeg.gangreneAt": 0, "system.lostLimbs.rightLeg.mutation": true
    });
  });
});

describe("syncLossOfLimbMutation", () => {
  it("распознаёт мутацию по имени", () => {
    expect(isLossOfLimbMutation(makeMutation(null, "1"))).toBe(true);
    expect(isLossOfLimbMutation({ type: "mutation", name: "Wings / Крылья" })).toBe(false);
  });

  it("строка 8 — левая рука потеряна мутацией, без Кровотечения", async () => {
    const actor = makeActor();
    await syncLossOfLimbMutation(makeMutation(actor, "8"));
    expect(actor.system.lostLimbs.leftArm).toEqual({ lost: true, gangreneAt: 0, mutation: true });
    expect(actor.system.conditions.bleeding).toBeUndefined();
  });

  it("смена строки возвращает прежнюю часть тела; удаление мутации — тоже", async () => {
    const actor = makeActor();
    const item = makeMutation(actor, "8");
    await syncLossOfLimbMutation(item);
    item.system.submutation.label = "9";
    await syncLossOfLimbMutation(item);
    expect(actor.system.lostLimbs.leftArm.lost).toBe(false);
    expect(actor.system.lostLimbs.leftLeg.lost).toBe(true);
    await syncLossOfLimbMutation(item, { removed: true });
    expect(actor.system.lostLimbs.leftLeg.lost).toBe(false);
  });

  it("потерю, которую потом перехватил крит (пометка снята), удаление мутации не трогает", async () => {
    const actor = makeActor();
    const item = makeMutation(actor, "3");
    await syncLossOfLimbMutation(item);
    await actor.update(lostSideFields("lostArms", "right"));
    await syncLossOfLimbMutation(item, { removed: true });
    expect(actor.system.lostLimbs.rightArm.lost).toBe(true);
  });
});

describe("«Пальцы» — −10 к атаке оружием в этой руке", () => {
  const weapon = (hand, grips = "1р") => ({
    type: "weapon", system: { weaponClass: "melee", grips, weaponProps: [] },
    getFlag: (ns, k) => (k === "heldHand" ? hand || undefined : undefined)
  });
  const actor = { items: [], system: { lostLimbs: { leftFingers: { lost: true } }, conditions: {} } };

  it("оружие в левой руке — штраф, в правой — нет", () => {
    expect(fingersPenalty(actor, weapon("left"))).toBe(true);
    expect(fingersPenalty(actor, weapon("right"))).toBe(false);
  });

  it("двуручное без назначенной руки — штраф; одноручное без руки — нет", () => {
    expect(fingersPenalty(actor, weapon("", "2р"))).toBe(true);
    expect(fingersPenalty(actor, weapon(""))).toBe(false);
  });
});

describe("гейт Best.Q: что потеряно мутацией", () => {
  it("lostByMutation — только сторона с пометкой", () => {
    const system = { lostLimbs: { leftArm: { lost: true, mutation: true }, rightArm: { lost: true } } };
    expect(lostByMutation(system, "lostArms", "left")).toBe(true);
    expect(lostByMutation(system, "lostArms", "right")).toBe(false);
  });
});
