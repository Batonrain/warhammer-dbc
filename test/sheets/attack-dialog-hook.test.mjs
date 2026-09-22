// test/sheets/attack-dialog-hook.test.mjs
//
// Крюк (core.json, «Типы Рукопашного Оружия»): «Дает –10 на не-Избирательные
// атаки и –15 на Избирательные». Зеркало уже реализованной Булавы
// (test/sheets/attack-dialog-mace.test.mjs) — тот же живой f.aimVal, знак и
// величина другие.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function attackForm(fields = {}, checks = {}) {
  return fakeForm({ "#atk-char": "ws", "#atk-modifier": "0", "#atk-aim": "", ...fields }, checks);
}

function dialogThreshold() {
  const m = (captured.dialog?.content ?? "").match(/id="atk-total-display">(-?\d+)</);
  return m ? Number(m[1]) : null;
}

function thresholdInCard() {
  const m = (captured.chat.at(-1)?.content ?? "").match(/<label>Порог<\/label><b>(-?\d+)<\/b>/);
  return m ? Number(m[1]) : null;
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Крюк: −10/−15 на атаки (core.json, «Типы Рукопашного Оружия»)", () => {
  it("окно открытия — Крюк без прицела даёт −10 к порогу", () => {
    const hook = weaponFor({ weaponClass: "melee", meleeCategory: "Крюк" });
    const actor = actorFor({ items: [hook], aiming: "none" });
    showAttackDialog(actor, hook);

    expect(dialogThreshold()).toBe(45); // WS 45 + База «Стандартная» 10 − Крюк 10
  });

  it("окно открытия — обычный Меч без штрафа", () => {
    const sword = weaponFor({ weaponClass: "melee", meleeCategory: "Меч" });
    const actor = actorFor({ items: [sword], aiming: "none" });
    showAttackDialog(actor, sword);

    expect(dialogThreshold()).toBe(55);
  });

  it("не рукопашная — штраф Крюка не считается даже с этим meleeCategory", () => {
    const weapon = weaponFor({ meleeCategory: "Крюк" });
    const actor = actorFor({ items: [weapon], aiming: "none" });
    showAttackDialog(actor, weapon);

    expect(captured.dialog.content).not.toContain("Крюк (Избирательная/не-Избирательная атака)");
  });

  it("реальный бросок Крюком без прицела — штраф −10 в пороге карточки", async () => {
    const hook = weaponFor({ weaponClass: "melee", meleeCategory: "Крюк" });
    const actor = actorFor({ items: [hook], aiming: "none" });
    actor.update = async () => {};
    const p = showAttackDialog(actor, hook);
    captured.dice = [30, 3];

    await captured.press("roll", attackForm());
    await p;

    expect(thresholdInCard()).toBe(45);
  });

  it("реальный бросок Крюком с Избирательным прицелом — штраф −15, не −10", async () => {
    const hook = weaponFor({ weaponClass: "melee", meleeCategory: "Крюк" });
    const actor = actorFor({ items: [hook], aiming: "none" });
    actor.update = async () => {};
    const p = showAttackDialog(actor, hook);
    captured.dice = [10, 3];

    await captured.press("roll", attackForm({
      "#atk-aim": "leg",
      "#atk-aim option:checked": { dataset: { penalty: "-15" } }
    }));
    await p;

    // WS 45 + База 10 − Крюк(Избирательная, −15) − Избирательная(−15) = 25.
    expect(thresholdInCard()).toBe(25);
  });
});
