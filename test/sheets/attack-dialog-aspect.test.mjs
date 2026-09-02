// test/sheets/attack-dialog-aspect.test.mjs
//
// Aspect (wdbc-8b5/wdbc-28ld, стр. 168): оружие «под аспект» без
// соответствующего Пути — штраф −30, показанный галочкой (не auto — R3
// снимает штраф у не-Асуриан/Иннари, галочку можно снять руками).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function html() { return captured.dialog?.content ?? ""; }

function modLine(label) {
  const idx = html().indexOf(`<span>${label}`);
  if (idx < 0) return null;
  const before = html().slice(Math.max(0, idx - 400), idx);
  const inputStart = before.lastIndexOf("<input");
  const inputTag = before.slice(inputStart);
  const valueMatch = inputTag.match(/data-value="(-?\d+)"/);
  const checked = /\schecked/.test(inputTag);
  return { value: valueMatch ? Number(valueMatch[1]) : null, checked };
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Aspect — штраф −30 без соответствующего Пути", () => {
  it("оружие без Aspect — строки нет вовсе", () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon], fatigue: { value: 0 }, aiming: "none" });
    showAttackDialog(actor, weapon);

    expect(modLine("Аспект")).toBeNull();
  });

  it("Aspect на оружии, у персонажа нет нужного Пути — галочка отмечена (штраф применён по умолчанию)", () => {
    const weapon = weaponFor({ weaponProps: [{ key: "aspect", rating: "Варп-Пауки" }] });
    const actor  = actorFor({ items: [weapon], fatigue: { value: 0 }, aiming: "none", paths: [] });
    showAttackDialog(actor, weapon);

    expect(modLine("Аспект: нет Пути «Варп-Пауки»")).toMatchObject({ value: -30, checked: true });
  });

  it("Aspect на оружии, у персонажа ЕСТЬ нужный Путь — галочка не отмечена", () => {
    const weapon = weaponFor({ weaponProps: [{ key: "aspect", rating: "Варп-Пауки" }] });
    const actor  = actorFor({
      items: [weapon], fatigue: { value: 0 }, aiming: "none",
      paths: [{ key: "warpspider", grade: "novice" }]
    });
    showAttackDialog(actor, weapon);

    expect(modLine("Аспект: нет Пути «Варп-Пауки»")).toMatchObject({ value: -30, checked: false });
  });

  it("Aspect с нераспознанным текстом рейтинга — не штрафует по умолчанию (не отмечено)", () => {
    const weapon = weaponFor({ weaponProps: [{ key: "aspect", rating: "Неизвестная Группа" }] });
    const actor  = actorFor({ items: [weapon], fatigue: { value: 0 }, aiming: "none", paths: [] });
    showAttackDialog(actor, weapon);

    expect(modLine("Аспект: нет Пути «Неизвестная Группа»")).toMatchObject({ value: -30, checked: false });
  });
});
