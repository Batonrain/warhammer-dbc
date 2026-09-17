// test/sheets/attack-dialog-black-eyes-vision.test.mjs
//
// wdbc-1rno.1: Black Eyes / Чёрные Глаза (Дар Слаанеш) — при Cor 60+
// АТАКУЮЩИЙ видит сквозь Слабый свет/Дым-туман/Тьму, штрафы гасятся в его
// собственном диалоге атаки (module/sheets/attack/mods.mjs::
// hasBlackEyesDarknessImmunity). Тот же приём проверки, что у Зенитного
// (test/sheets/attack-dialog-z56a-situational.test.mjs).

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
  const disabled   = /\sdisabled/.test(inputTag);
  return { value: valueMatch ? Number(valueMatch[1]) : null, disabled };
}

const blackEyesItem = () => ({
  id: "black-eyes-1", type: "mutation", name: "Black Eyes / Чёрные Глаза",
  flags: { "warhammer-dbc": { mechanics: [{ id: "g1", operator: "AND", entries: [
    { id: "blackEyes-cap", kind: "capability", capabilityKey: "gift.slaanesh.blackEyes" }
  ] }] } }
});

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Чёрные Глаза / Black Eyes (wdbc-1rno.1): иммунитет к штрафам видимости при Cor 60+", () => {
  it("без Дара, Cor 65: обычные штрафы Слабый свет/Дым/Тьма на месте", () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon], corruption: { value: 65 }, fatigue: { value: 0 }, aiming: "none" });
    showAttackDialog(actor, weapon);

    expect(modLine("Слабый свет")).toMatchObject({ value: -10, disabled: false });
    expect(modLine("Дым / туман")).toMatchObject({ disabled: false });
    expect(modLine("Тьма")).toMatchObject({ disabled: false });
  });

  it("с Даром, но Cor 40 (ниже порога 60) — штрафы НЕ гасятся", () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon, blackEyesItem()], corruption: { value: 40 }, fatigue: { value: 0 }, aiming: "none" });
    showAttackDialog(actor, weapon);

    expect(modLine("Тьма")).toMatchObject({ disabled: false });
  });

  it("с Даром и Cor 60+ — Слабый свет/Дым/Тьма погашены (иммунитет)", () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon, blackEyesItem()], corruption: { value: 60 }, fatigue: { value: 0 }, aiming: "none" });
    showAttackDialog(actor, weapon);

    expect(modLine("Слабый свет")).toMatchObject({ value: 0, disabled: true });
    expect(modLine("Дым / туман")).toMatchObject({ value: 0, disabled: true });
    expect(modLine("Тьма")).toMatchObject({ value: 0, disabled: true });
  });

  it("иммунитет не задевает несвязанные галочки (Усталость остаётся обычной)", () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon, blackEyesItem()], corruption: { value: 60 }, fatigue: { value: 10 }, aiming: "none" });
    showAttackDialog(actor, weapon);

    expect(modLine("Усталость")).toMatchObject({ value: -10 });
  });
});
