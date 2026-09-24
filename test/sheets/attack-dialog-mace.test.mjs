// test/sheets/attack-dialog-mace.test.mjs
//
// Булава (core.json, «Типы Рукопашного Оружия»): «Дает бонус +10 на любые
// не-Избирательные атаки». Живёт в двух местах attack-dialog.mjs — «холодном»
// wpAttackMod (окно открытия) и живой строке thresholdParts (реальный бросок,
// та же схема разводки, что уже спасала «Цель Повалена» от wdbc-r5o7.2).

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

describe("Булава: +10 на не-Избирательные атаки (core.json, «Типы Рукопашного Оружия»)", () => {
  it("окно открытия — Булава добавляет +10 к порогу", () => {
    const mace = weaponFor({ weaponClass: "melee", meleeCategory: "Булава" });
    const actor = actorFor({ items: [mace], aiming: "none" });
    showAttackDialog(actor, mace);

    expect(dialogThreshold()).toBe(65); // WS 45 + База «Стандартная» 10 + Булава 10
  });

  it("окно открытия — обычный Меч без бонуса", () => {
    const sword = weaponFor({ weaponClass: "melee", meleeCategory: "Меч" });
    const actor = actorFor({ items: [sword], aiming: "none" });
    showAttackDialog(actor, sword);

    expect(dialogThreshold()).toBe(55); // WS 45 + База «Стандартная» 10, без Булавы
  });

  it("не рукопашная (weaponClass не melee) — Булава не считается даже с этим значением meleeCategory", () => {
    const weapon = weaponFor({ meleeCategory: "Булава" });
    const actor = actorFor({ items: [weapon], aiming: "none" });
    showAttackDialog(actor, weapon);

    expect(captured.dialog.content).not.toContain("Булава (не-Избирательная атака)");
  });

  it("реальный бросок Булавой без прицела — бонус +10 в пороге карточки", async () => {
    const mace = weaponFor({ weaponClass: "melee", meleeCategory: "Булава" });
    const actor = actorFor({ items: [mace], aiming: "none" });
    actor.update = async () => {};
    const p = showAttackDialog(actor, mace);
    captured.dice = [50, 3]; // 50 — попадание (порог 65); 3 — кубик урона (не проверяется здесь).

    await captured.press("roll", attackForm());
    await p;

    expect(thresholdInCard()).toBe(65);
  });

  it("реальный бросок Булавой с Избирательным прицелом — бонус снят", async () => {
    const mace = weaponFor({ weaponClass: "melee", meleeCategory: "Булава" });
    const actor = actorFor({ items: [mace], aiming: "none" });
    actor.update = async () => {};
    const p = showAttackDialog(actor, mace);
    captured.dice = [50];

    await captured.press("roll", attackForm({
      "#atk-aim": "leg",
      "#atk-aim option:checked": { dataset: { penalty: "-15" } }
    }));
    await p;

    // WS 45 + База 10 − Избирательная(−15), без Булавы: 40.
    expect(thresholdInCard()).toBe(40);
  });
});
