// test/sheets/attack-dialog-weapon-class-melee.test.mjs
//
// Стр. 40, wdbc-x1nz.2.57: «Пистолет... может использоваться для стрельбы в
// ближнем бою без каких-либо штрафов». «Тяжелое Оружие... не может
// использоваться для стрельбы в ближнем бою» — то же для Длинной Винтовки
// (свойство weaponProps "longRifle", в схеме нет отдельного класса).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function html() { return captured.dialog?.content ?? ""; }

function modLine(label) {
  const idx = html().indexOf(`<span>${label} (`) >= 0 ? html().indexOf(`<span>${label} (`) : html().indexOf(`<span>${label}`);
  if (idx < 0) return null;
  const before = html().slice(Math.max(0, idx - 400), idx);
  const inputStart = before.lastIndexOf("<input");
  const inputTag = before.slice(inputStart);
  return {
    value: (inputTag.match(/data-value="(-?\d+)"/) || [])[1] ?? null,
    autofail: /data-autofail="true"/.test(inputTag),
    disabled: /\sdisabled/.test(inputTag),
    checked: /\schecked(\s|\/|>)/.test(inputTag)
  };
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Пистолет в рукопашную — без штрафов (wdbc-x1nz.2.57)", () => {
  it("пистолет — «Стрельба в рукопашную» стоит 0", () => {
    const weapon = weaponFor({ weaponClass: "pistol" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    showAttackDialog(actor, weapon);

    expect(modLine("Стрельба в рукопашную")?.value).toBe("0");
  });

  it("обычное стрелковое (не пистолет) — по-прежнему -20", () => {
    const weapon = weaponFor({ weaponClass: "basic" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    showAttackDialog(actor, weapon);

    expect(modLine("Стрельба в рукопашную")?.value).toBe("-20");
  });
});

describe("Тяжёлое/Длинная Винтовка — нельзя стрелять в рукопашную (wdbc-x1nz.2.57)", () => {
  function contactTokens(actor) {
    const shooterToken = { actor, document: { x: 0, y: 0, width: 1, height: 1 } };
    const targetToken   = { actor: { name: "Цель" }, document: { x: 0, y: 0, width: 1, height: 1 } };
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [shooterToken, targetToken] } };
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };
  }

  it("тяжёлое оружие, стрелок в контакте с целью — блокирующая галочка отмечена и autofail", () => {
    const weapon = weaponFor({ weaponClass: "heavy" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    contactTokens(actor);
    showAttackDialog(actor, weapon);

    const line = modLine("Тяжёлое/Длинная Винтовка: нельзя стрелять в рукопашную");
    expect(line).toMatchObject({ autofail: true, checked: true, disabled: false });
  });

  it("тяжёлое оружие, НЕ в контакте с целью — не отмечена (можно стрелять как обычно)", () => {
    const weapon = weaponFor({ weaponClass: "heavy" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    const shooterToken = { actor, document: { x: 0, y: 0, width: 1, height: 1 } };
    const targetToken   = { actor: { name: "Цель" }, document: { x: 10, y: 0, width: 1, height: 1 } };
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [shooterToken, targetToken] } };
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };

    showAttackDialog(actor, weapon);

    expect(modLine("Тяжёлое/Длинная Винтовка: нельзя стрелять в рукопашную")).toMatchObject({ checked: false });
  });

  it("Длинная Винтовка (weaponProps longRifle), контакт с целью — тот же блок, что у тяжёлого", () => {
    const weapon = weaponFor({ weaponClass: "basic", weaponProps: [{ key: "longRifle" }] });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    contactTokens(actor);
    showAttackDialog(actor, weapon);

    expect(modLine("Тяжёлое/Длинная Винтовка: нельзя стрелять в рукопашную")).toMatchObject({ autofail: true, checked: true });
  });

  it("обычная Винтовка (без longRifle), контакт с целью — галочка иммунна (можно стрелять)", () => {
    const weapon = weaponFor({ weaponClass: "basic" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    contactTokens(actor);
    showAttackDialog(actor, weapon);

    // Тот же приём, что у «Высокая высота цели»/Зенитного: checked отражает
    // геометрический факт (в контакте), disabled/immune — что это ни на что
    // не влияет для этого класса оружия (autofail не сработает).
    expect(modLine("Тяжёлое/Длинная Винтовка: нельзя стрелять в рукопашную")).toMatchObject({ disabled: true, autofail: false });
  });

  it("пистолет, контакт с целью — тоже иммунен этому блоку", () => {
    const weapon = weaponFor({ weaponClass: "pistol" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    contactTokens(actor);
    showAttackDialog(actor, weapon);

    expect(modLine("Тяжёлое/Длинная Винтовка: нельзя стрелять в рукопашную")).toMatchObject({ disabled: true });
  });
});
