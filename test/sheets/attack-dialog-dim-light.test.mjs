// test/sheets/attack-dialog-dim-light.test.mjs
//
// Стр. 34, wdbc-x1nz.2.46: «Стандартные Модификаторы Атаки» — Слабый свет
// штрафует только стрелковую атаку (−10), у рукопашной книжная ячейка
// пустая (0). Дым/туман и Тьма ниже штрафуют ОБЕ — этот тест их не трогает.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function html() { return captured.dialog?.content ?? ""; }

function modLine(label) {
  const idx = html().indexOf(`<span>${label} (`);
  if (idx < 0) return null;
  const before = html().slice(Math.max(0, idx - 400), idx);
  const inputStart = before.lastIndexOf("<input");
  const inputTag = before.slice(inputStart);
  const valueMatch = inputTag.match(/data-value="(-?\d+)"/);
  return { value: valueMatch ? Number(valueMatch[1]) : null };
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Слабый свет (wdbc-x1nz.2.46): штраф только стрелковой", () => {
  it("стрелковое оружие — Слабый свет (-10)", () => {
    const weapon = weaponFor({ weaponClass: "basic" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    showAttackDialog(actor, weapon);

    expect(modLine("Слабый свет")).toMatchObject({ value: -10 });
  });

  it("рукопашное оружие — Слабый свет (0), не штрафует", () => {
    const weapon = weaponFor({ weaponClass: "melee" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    showAttackDialog(actor, weapon);

    expect(modLine("Слабый свет")).toMatchObject({ value: 0 });
  });

  it("рукопашное оружие — Дым/туман и Тьма всё ещё штрафуют", () => {
    const weapon = weaponFor({ weaponClass: "melee" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    showAttackDialog(actor, weapon);

    expect(modLine("Дым / туман")).toMatchObject({ value: -10 });
    expect(modLine("Тьма")).toMatchObject({ value: -20 });
  });
});
