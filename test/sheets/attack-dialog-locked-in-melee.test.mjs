// test/sheets/attack-dialog-locked-in-melee.test.mjs
//
// Стр. 30, wdbc-x1nz.2.64: «Связан в Рукопашной».
// 1) Персонаж в Базовом контакте с враждебным персонажем, вооружённым
//    рукопашным оружием или Пистолетом, — не может стрелять в цели ВНЕ
//    рукопашной (жёсткий блок, тот же autofail-приём, что у «Тяжёлое/Длинная
//    Винтовка»).
// 2) «Стрельба по персонажам в Рукопашной получает штраф −20» — отдельно от
//    уже существующего «Стрельба в рукопашную» (тот про самого стрелка, с
//    исключением для Пистолета): здесь стрелок НЕ в этой рукопашной, цель
//    связана с ТРЕТЬИМ лицом, штраф без исключений.

const HOSTILE = -1, FRIENDLY = 1;

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function html() { return captured.dialog?.content ?? ""; }

function modLine(label) {
  const idx = html().indexOf(`<span>${label} (`) >= 0 ? html().indexOf(`<span>${label} (`) : html().indexOf(`<span>${label}`);
  if (idx < 0) return null;
  const before = html().slice(Math.max(0, idx - 500), idx);
  const inputStart = before.lastIndexOf("<input");
  const inputTag = before.slice(inputStart);
  return {
    value: (inputTag.match(/data-value="(-?\d+)"/) || [])[1] ?? null,
    autofail: /data-autofail="true"/.test(inputTag),
    disabled: /\sdisabled/.test(inputTag),
    checked: /\schecked(\s|\/|>)/.test(inputTag)
  };
}

/** Враг личного масштаба с оружием заданного класса, экипированным или нет. */
function enemyActor({ weaponClass = "melee", equipped = true, name = "Враг" } = {}) {
  return {
    name, type: "character",
    items: [{ type: "weapon", system: { equipped, weaponClass } }]
  };
}

let _tokenId = 0;
function tokenAt({ actor, x = 0, y = 0, disposition = HOSTILE }) {
  // actor живёт НА document (как у настоящего TokenDocument, actorOf()
  // читает document.actor) — не сиблингом, тот же приём, что free-attack.test.mjs.
  // id обязателен и уникален: enemyContactTokenDocs пропускает свой же id,
  // а без него все токены с undefined id считаются друг другом.
  const id = `t${_tokenId++}`;
  return { actor, document: { id, x, y, width: 1, height: 1, disposition, actor } };
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Связан в Рукопашной: блок стрельбы вне рукопашной (wdbc-x1nz.2.64)", () => {
  it("стрелок в контакте с рукопашным врагом, целится МИМО него — autofail, отмечено", () => {
    const weapon = weaponFor({ weaponClass: "basic" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    const shooterToken = tokenAt({ actor, x: 0, y: 0, disposition: FRIENDLY });
    const lockerToken  = tokenAt({ actor: enemyActor(), x: 0, y: 0 });
    const farTarget    = tokenAt({ actor: { name: "Далёкая цель", type: "character" }, x: 20, y: 20, disposition: HOSTILE });
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [shooterToken, lockerToken, farTarget] } };
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([farTarget]) };

    showAttackDialog(actor, weapon);

    const line = modLine("Связан в Рукопашной: нельзя стрелять вне рукопашной");
    expect(line).toMatchObject({ autofail: true, checked: true, disabled: false });
  });

  it("стрелок в контакте, целится В ТОГО ЖЕ врага (свою рукопашную) — не отмечено, можно стрелять", () => {
    const weapon = weaponFor({ weaponClass: "basic" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    const shooterToken = tokenAt({ actor, x: 0, y: 0, disposition: FRIENDLY });
    const lockerToken  = tokenAt({ actor: enemyActor({ name: "Цель" }), x: 0, y: 0 });
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [shooterToken, lockerToken] } };
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([lockerToken]) };

    showAttackDialog(actor, weapon);

    expect(modLine("Связан в Рукопашной: нельзя стрелять вне рукопашной")).toMatchObject({ checked: false });
  });

  it("стрелок не в контакте ни с кем — иммунен блоку", () => {
    const weapon = weaponFor({ weaponClass: "basic" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    const shooterToken = tokenAt({ actor, x: 0, y: 0, disposition: FRIENDLY });
    const farTarget = tokenAt({ actor: { name: "Цель", type: "character" }, x: 20, y: 20, disposition: HOSTILE });
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [shooterToken, farTarget] } };
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([farTarget]) };

    showAttackDialog(actor, weapon);

    expect(modLine("Связан в Рукопашной: нельзя стрелять вне рукопашной")).toMatchObject({ disabled: true, autofail: false });
  });

  it("враг в контакте безоружен/только со стрелковым — не запирает, блока нет", () => {
    const weapon = weaponFor({ weaponClass: "basic" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    const shooterToken = tokenAt({ actor, x: 0, y: 0, disposition: FRIENDLY });
    const unarmedEnemy = tokenAt({ actor: enemyActor({ weaponClass: "basic" }), x: 0, y: 0 });
    const farTarget = tokenAt({ actor: { name: "Цель", type: "character" }, x: 20, y: 20, disposition: HOSTILE });
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [shooterToken, unarmedEnemy, farTarget] } };
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([farTarget]) };

    showAttackDialog(actor, weapon);

    expect(modLine("Связан в Рукопашной: нельзя стрелять вне рукопашной")).toMatchObject({ checked: false, disabled: true });
  });

  it("запирающий враг с Пистолетом (не только рукопашное) — тоже запирает", () => {
    const weapon = weaponFor({ weaponClass: "basic" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    const shooterToken = tokenAt({ actor, x: 0, y: 0, disposition: FRIENDLY });
    const pistolEnemy  = tokenAt({ actor: enemyActor({ weaponClass: "pistol" }), x: 0, y: 0 });
    const farTarget = tokenAt({ actor: { name: "Цель", type: "character" }, x: 20, y: 20, disposition: HOSTILE });
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [shooterToken, pistolEnemy, farTarget] } };
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([farTarget]) };

    showAttackDialog(actor, weapon);

    expect(modLine("Связан в Рукопашной: нельзя стрелять вне рукопашной")).toMatchObject({ autofail: true, checked: true });
  });
});

describe("Штраф −20: цель связана в рукопашной с третьим лицом (wdbc-x1nz.2.64)", () => {
  it("цель в контакте с чужим врагом, стрелок не в этой рукопашной — −20", () => {
    const weapon = weaponFor({ weaponClass: "basic" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    const shooterToken = tokenAt({ actor, x: 20, y: 20, disposition: FRIENDLY });
    const targetToken  = tokenAt({ actor: { name: "Цель", type: "character" }, x: 0, y: 0, disposition: HOSTILE });
    const meleeAlly    = tokenAt({ actor: enemyActor({ name: "Союзник цели??" }), x: 0, y: 0, disposition: FRIENDLY });
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [shooterToken, targetToken, meleeAlly] } };
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };

    showAttackDialog(actor, weapon);

    expect(modLine("Цель связана в рукопашной (с другим персонажем)")).toMatchObject({ value: "-20", checked: true });
  });

  it("Пистолет — тот же штраф, без исключений (это не «Стрельба в рукопашную»)", () => {
    const weapon = weaponFor({ weaponClass: "pistol" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    const shooterToken = tokenAt({ actor, x: 20, y: 20, disposition: FRIENDLY });
    const targetToken  = tokenAt({ actor: { name: "Цель", type: "character" }, x: 0, y: 0, disposition: HOSTILE });
    const meleeAlly    = tokenAt({ actor: enemyActor(), x: 0, y: 0, disposition: FRIENDLY });
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [shooterToken, targetToken, meleeAlly] } };
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };

    showAttackDialog(actor, weapon);

    expect(modLine("Цель связана в рукопашной (с другим персонажем)")).toMatchObject({ value: "-20", checked: true });
  });

  it("стрелок САМ в контакте с целью — это уже «Стрельба в рукопашную», новая галочка не дублирует штраф", () => {
    const weapon = weaponFor({ weaponClass: "basic" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    const shooterToken = tokenAt({ actor, x: 0, y: 0, disposition: FRIENDLY });
    const targetToken  = tokenAt({ actor: enemyActor({ name: "Цель" }), x: 0, y: 0 });
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [shooterToken, targetToken] } };
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };

    showAttackDialog(actor, weapon);

    expect(modLine("Цель связана в рукопашной (с другим персонажем)")).toMatchObject({ checked: false });
    // Уже существующий штраф применился как обычно.
    expect(modLine("Стрельба в рукопашную")).toMatchObject({ value: "-20" });
  });

  it("цель ни с кем не в контакте — не отмечено", () => {
    const weapon = weaponFor({ weaponClass: "basic" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    const shooterToken = tokenAt({ actor, x: 20, y: 20, disposition: FRIENDLY });
    const targetToken  = tokenAt({ actor: { name: "Цель", type: "character" }, x: 0, y: 0, disposition: HOSTILE });
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [shooterToken, targetToken] } };
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };

    showAttackDialog(actor, weapon);

    expect(modLine("Цель связана в рукопашной (с другим персонажем)")).toMatchObject({ checked: false });
  });
});
