// test/combat/attack-blinded-target-unseen.test.mjs
//
// «Раны и Урон», «Статусы», wdbc-x1nz.2.89: «Ослепленный персонаж считает все
// атаки Незримыми». Незримое (стр. 32) запирает Уклонение/Парирование цели,
// пока атаку не засекли (attack-card.mjs, wh-unseen-locked). Раньше unseen
// считался только со стороны атакующего — Ослеплённый защищался как зрячий.
// Sonar Sense / Unnatural Senses цели снимают и это (все штрафы Ослепления).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, traitFor } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

async function shootAt(target) {
  const weapon = weaponFor();
  const actor  = actorFor({ items: [weapon] });
  setTargets([target]);
  captured.dice = [10, 5];
  await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
}

describe("атака по Ослеплённой цели — Незримая", () => {
  it("цель Ослеплена — Уклонение заперто до засечения", async () => {
    await shootAt(actorFor({ conditions: { blinded: true } }));
    expect(card()).toContain("wh-dodge-btn wh-unseen-locked");
    expect(card()).toContain("Цель Ослеплена");
  });

  it("цель без обоих глаз — то же самое", async () => {
    await shootAt(actorFor({ conditions: { lostEyes: true, lostEyesCount: 2 } }));
    expect(card()).toContain("wh-dodge-btn wh-unseen-locked");
  });

  it("цель зрячая — Уклонение доступно", async () => {
    await shootAt(actorFor({ conditions: {} }));
    expect(card()).not.toContain("wh-unseen-locked");
  });

  it("Ослеплена, но с Sonar Sense — Уклонение доступно", async () => {
    await shootAt(actorFor({ conditions: { blinded: true }, items: [traitFor("Sonar Sense / Сонарное Чувство")] }));
    expect(card()).not.toContain("wh-unseen-locked");
  });
});
