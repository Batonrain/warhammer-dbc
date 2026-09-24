// test/sheets/attack-dialog-weapon-reach.test.mjs
//
// Длина Оружия, правило 3 (wdbc-x1nz.2.67.1, стр. 39): «Оружие с Rng 8 может
// атаковать в рукопашной и создаёт Базовый контакт через клетку 1×1, а не
// только в упор, оружие с Rng 9 — через две.» Проверяется бейдж контакта в
// окне атаки (module/sheets/attack-dialog.mjs::CONTACT_BADGE) — сам
// contactType() (tactical-map.mjs) сознательно не трогается (см. тикет).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function html() { return captured.dialog?.content ?? ""; }

function place(actor, x) {
  return { actor, document: { x, y: 0, width: 1, height: 1 } };
}

beforeEach(() => {
  resetCaptured();
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } };
});

describe("CONTACT_BADGE: расширенный Базовый контакт для Rng 8/9 (стр. 39)", () => {
  it("Rng 8, зазор 1 клетка (Базы не касаются) — «Контакт через оружие»", () => {
    const weapon = weaponFor({ weaponClass: "melee", range: 8 }, { name: "Глефа" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    const attackerToken = place(actor, 0);
    const targetToken   = place({ name: "Цель" }, 2); // edgeM=1 у токенов 1×1
    globalThis.canvas.tokens.placeables = [attackerToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };

    showAttackDialog(actor, weapon);

    expect(html()).toContain("🗡 Контакт через оружие (1 кл.)");
    expect(html()).not.toContain("⚠ Нет контакта");
  });

  it("Rng 8, зазор 2 клетки — вне досягаемости, обычное «Нет контакта»", () => {
    const weapon = weaponFor({ weaponClass: "melee", range: 8 }, { name: "Глефа" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    const attackerToken = place(actor, 0);
    const targetToken   = place({ name: "Цель" }, 3); // edgeM=2
    globalThis.canvas.tokens.placeables = [attackerToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };

    showAttackDialog(actor, weapon);

    expect(html()).toContain("⚠ Нет контакта");
    expect(html()).not.toContain("Контакт через оружие");
  });

  it("Rng 9, зазор 2 клетки — тоже «Контакт через оружие» (через две)", () => {
    const weapon = weaponFor({ weaponClass: "melee", range: 9 }, { name: "Силовое копьё" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    const attackerToken = place(actor, 0);
    const targetToken   = place({ name: "Цель" }, 3); // edgeM=2
    globalThis.canvas.tokens.placeables = [attackerToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };

    showAttackDialog(actor, weapon);

    expect(html()).toContain("🗡 Контакт через оружие (2 кл.)");
  });

  it("обычное оружие (Rng 5), зазор 1 клетка — «Нет контакта», без нового бейджа", () => {
    const weapon = weaponFor({ weaponClass: "melee", range: 5 }, { name: "Меч" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    const attackerToken = place(actor, 0);
    const targetToken   = place({ name: "Цель" }, 2); // edgeM=1
    globalThis.canvas.tokens.placeables = [attackerToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };

    showAttackDialog(actor, weapon);

    expect(html()).toContain("⚠ Нет контакта");
    expect(html()).not.toContain("Контакт через оружие");
  });

  it("Rng 8, реальный Базовый контакт (вплотную) — обычный бейдж, без упоминания клетки", () => {
    const weapon = weaponFor({ weaponClass: "melee", range: 8 }, { name: "Глефа" });
    const actor  = actorFor({ items: [weapon], aiming: "none" });
    const attackerToken = place(actor, 0);
    const targetToken   = place({ name: "Цель" }, 1); // грани соприкасаются
    globalThis.canvas.tokens.placeables = [attackerToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };

    showAttackDialog(actor, weapon);

    expect(html()).toContain("⚔ Базовый контакт");
    expect(html()).not.toContain("Контакт через оружие");
  });
});
