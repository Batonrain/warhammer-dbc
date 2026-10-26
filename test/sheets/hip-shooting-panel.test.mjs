// test/sheets/hip-shooting-panel.test.mjs
//
// Стрельба от Бедра (Талант Стрелка) — пункт и на панели «Движение» листа, не только в меню Token HUD
// (Sahara covering-fire-hip-shooting п.4). Лист показывает кнопку только владельцу Таланта с подходящим оружием
// (rules/gunner-talents.mjs::hipShootingWeapon), нажатие — то же declareFullMove(actor, { hipShooting: true }).

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = rel => fs.readFileSync(path.join(path.resolve(import.meta.dirname, "../.."), rel), "utf8");

describe("Стрельба от Бедра на панели «Движение» листа", () => {
  it("шаблон: кнопка только под флагом движения и с тем же гейтом ОД, что у Шага", () => {
    const hbs = read("templates/actor/parts/tab-combat.hbs");
    const m = hbs.match(/\{\{#if movementCanHipShoot\}\}[\s\S]*?\{\{\/if\}\}\s*\n\s*<div class="movement-item"> <button type="button" class="wh-move-btn" data-move-action="charge"/);
    expect(m).not.toBeNull();
    expect(m[0]).toContain('data-move-action="hipshooting"');
    expect(m[0]).toContain("moveGate.full.disabled");
  });

  it("лист считает флаг через hipShootingWeapon, а обработчик зовёт Полное Движение «от бедра»", () => {
    expect(read("module/sheets/character-context.mjs")).toMatch(/context\.movementCanHipShoot = !!hipShootingWeapon\(actor\)/);
    expect(read("module/sheets/tabs/combat.mjs")).toMatch(/hipshooting: a => declareFullMove\(a, \{ hipShooting: true \}\)/);
  });
});
