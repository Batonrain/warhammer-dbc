// test/combat/attack-quiet-elimination.test.mjs
//
// Quiet Elimination / Тихое Устранение (wdbc-1rno.3): «Если персонаж
// атакует противника врасплох — +1 куб урона, цель не издаёт звука при
// гибели». Завязано на opts.targetSurprised (per-attack галочка «Цель
// Врасплох», stem/attack/mods.mjs #atk-mod-surprised → form.mjs → dialog.mjs),
// не на «Незримое» и не ограничено ножом/пистолетом (тот +10 — отдельный
// situational-мод, test/sheets/attack-mods-quiet-elimination.test.mjs).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { actorFor, weaponFor, traitFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Quiet Elimination: targetSurprised даёт +1 куб урона и строку «не издаёт звука»", () => {
  it("targetSurprised=true + Трейт — карточка несёт заметку Тихого Устранения", async () => {
    const weapon = weaponFor();
    const actor = actorFor({ items: [weapon, traitFor("Тихое Устранение")] });
    captured.dice = [10, 5, 5]; // атака, база урона, +1 куб Тихого Устранения (отдельный Roll)
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { targetSurprised: true });
    expect(card()).toContain("Тихое Устранение");
    expect(card()).toContain("не издаёт звука");
  });

  it("targetSurprised=false — заметки нет, хоть Трейт и есть", async () => {
    const weapon = weaponFor();
    const actor = actorFor({ items: [weapon, traitFor("Тихое Устранение")] });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { targetSurprised: false });
    expect(card()).not.toContain("Тихое Устранение");
  });

  it("targetSurprised=true, но нет Трейта — заметки нет", async () => {
    const weapon = weaponFor();
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { targetSurprised: true });
    expect(card()).not.toContain("Тихое Устранение");
  });
});
