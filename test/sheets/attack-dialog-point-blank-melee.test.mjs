// test/sheets/attack-dialog-point-blank-melee.test.mjs
//
// Стр. 40, wdbc-x1nz.2.57: «Стрельба в ближнем бою считается дистанцией в
// упор, но имеет модификатор на попадание +0, как будто это боевая
// дистанция.» Раньше «Дистанция в упор» (+30) автоотмечалась чисто по
// измеренному расстоянию (0–3м), не различая «стреляю в упор мимо врагов»
// (честные +30) и «стреляю в того, с кем сцепился врукопашную» (книжные +0) —
// геометрия для этого различия уже была под рукой (measured.contact).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function html() { return captured.dialog?.content ?? ""; }

function modLine(label) {
  const idx = html().indexOf(`<span>${label} (`);
  if (idx < 0) return null;
  const before = html().slice(Math.max(0, idx - 400), idx);
  const inputStart = before.lastIndexOf("<input");
  const inputTag = before.slice(inputStart);
  const valueMatch = inputTag.match(/data-value="(-?\d+)"/);
  return { value: valueMatch ? Number(valueMatch[1]) : null,
           checked: /\schecked(\s|\/|>)/.test(inputTag) };
}

beforeEach(() => {
  resetCaptured();
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } };
});

describe("Дистанция в упор при стрельбе в рукопашную (wdbc-x1nz.2.57)", () => {
  it("стрелок и цель в Базовом контакте — «Дистанция в упор» отмечена, но +0", () => {
    const weapon = weaponFor({ range: 100 });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    const shooterToken = { actor, document: { x: 0, y: 0, width: 1, height: 1 } };
    const targetToken  = { actor: { name: "Цель" }, document: { x: 0, y: 0, width: 1, height: 1 } };
    globalThis.canvas.tokens.placeables = [shooterToken, targetToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };

    showAttackDialog(actor, weapon);

    expect(modLine("Дистанция в упор")).toMatchObject({ value: 0, checked: true });
  });

  it("тот же выстрел в упор, но НЕ в рукопашную (цель в 2м, вне контакта) — честные +30", () => {
    const weapon = weaponFor({ range: 100 });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    const shooterToken = { actor, document: { x: 0, y: 0, width: 1, height: 1 } };
    const targetToken  = { actor: { name: "Цель" }, document: { x: 2, y: 0, width: 1, height: 1 } };
    globalThis.canvas.tokens.placeables = [shooterToken, targetToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };

    showAttackDialog(actor, weapon);

    expect(modLine("Дистанция в упор")).toMatchObject({ value: 30, checked: true });
  });
});
