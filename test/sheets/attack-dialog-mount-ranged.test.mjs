// test/sheets/attack-dialog-mount-ranged.test.mjs
//
// wdbc-8nz6 (доводка): штраф стрельбы с седла (стр. 478) раньше нигде не
// применялся к настоящему броску атаки, только показывался в панели
// «ВЕРХОМ» (doombc-mount-ranged-penalty-dead-parameters). Теперь
// автоподставляется в диалог атаки персонажа полем #atk-mount-ranged —
// правится вручную для Интегрированного Оружия/турели Коляски, как #atk-cover.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function thresholdInCard() {
  const m = (captured.chat.at(-1)?.content ?? "").match(/<label>Порог<\/label><b>(-?\d+)<\/b>/);
  return m ? Number(m[1]) : null;
}

function mountedRider(speed, over = {}) {
  const a = actorFor({
    items: [], fatigue: { value: 0 }, aiming: "none",
    mount: { uuid: "Actor.bike", role: "rider", speed },
    ...over
  });
  a.update = async () => {};
  return a;
}

function fieldValue() {
  const m = (captured.dialog?.content ?? "").match(/id="atk-mount-ranged"[^>]*value="(-?\d+)"/);
  return m ? Number(m[1]) : null;
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
  globalThis.game.actors = [{ uuid: "Actor.bike", type: "vehicle", system: {} }];
});

describe("Штраф стрельбы с седла — автоподстановка", () => {
  it("не верхом — поля вообще нет", () => {
    const actor = actorFor({ items: [], fatigue: { value: 0 }, aiming: "none" });
    showAttackDialog(actor, weaponFor({ rof_single: 1 }));
    expect(captured.dialog.content).not.toContain("atk-mount-ranged");
  });

  it("верхом, без движения — штраф 0", () => {
    const actor = mountedRider("still");
    showAttackDialog(actor, weaponFor({ rof_single: 1 }));
    expect(fieldValue()).toBe(0);
  });

  it("верхом, Полное движение — штраф −20", () => {
    const actor = mountedRider("full");
    showAttackDialog(actor, weaponFor({ rof_single: 1 }));
    expect(fieldValue()).toBe(-20);
  });

  it("верхом, Натиск — штраф −30", () => {
    const actor = mountedRider("charge");
    showAttackDialog(actor, weaponFor({ rof_single: 1 }));
    expect(fieldValue()).toBe(-30);
  });

  it("рукопашное оружие верхом — поля нет (штраф только стрелковый)", () => {
    const actor = mountedRider("full");
    showAttackDialog(actor, weaponFor({ weaponClass: "melee" }));
    expect(captured.dialog.content).not.toContain("atk-mount-ranged");
  });

  it("скакун не резолвится (game.actors пуст) — поля нет, штраф не потерян молча", () => {
    globalThis.game.actors = [];
    const actor = mountedRider("full");
    showAttackDialog(actor, weaponFor({ rof_single: 1 }));
    expect(captured.dialog.content).not.toContain("atk-mount-ranged");
  });
});

describe("Штраф стрельбы с седла — реально доезжает до брошенного порога", () => {
  it("Полное движение (−20) вычитается из итогового порога карточки", async () => {
    captured.dice = [50];
    const actor = mountedRider("full");
    const weapon = weaponFor({ rof_single: 1 });
    const p = showAttackDialog(actor, weapon);
    await captured.press("roll", fakeForm({
      "#atk-char": "bs", "#atk-modifier": "0", "#atk-mount-ranged": "-20",
      "input[name='atk-rof']:checked": { value: "single", dataset: { bonus: "0" } }
    }));
    await p;

    // BS 45 + Прицел "none" бонус 0 − 20 (штраф стрельбы с седла) = 25.
    expect(thresholdInCard()).toBe(25);
  });
});
