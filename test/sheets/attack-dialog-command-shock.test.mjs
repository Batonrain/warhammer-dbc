// test/sheets/attack-dialog-command-shock.test.mjs
//
// Бонус Короткой Команды (глава «Командование») и штраф строки Шока (стр. 53)
// приходят из конвейера правил автоматическими модификаторами (autoMods,
// auto:true). Окно атаки собирает Порог само и раньше autoMods не читало вовсе:
// Сержант отдавал Общую Команду «Атаки» на 3 Успеха (+9), а боец стрелял без
// +9; боец в Шоке (−10) бил без штрафа — при том что карточки Команды и Шока
// обещают «учитывается само».
//
// Проверяется итоговый Порог, ушедший в бросок (карточка атаки после нажатия
// «Бросок!»), а не промежуточный resolveTest().autoMods. Усталость — тоже
// autoMod конвейера, но у атаки она своя галочка (sheets/attack/mods.mjs):
// её второй раз добавлять нельзя.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
// Регистрирует источник правил «command» — в игре это делает импорт из hooks.mjs.
import "../../module/combat/command-state.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

const SOLDIER = "Actor.soldier";

function thresholdInCard() {
  const m = (captured.chat.at(-1)?.content ?? "").match(/<label>Порог<\/label><b>(-?\d+)<\/b>/);
  return m ? Number(m[1]) : null;
}

function soldier(weapon, extra = {}) {
  const a = actorFor({ items: [weapon], aiming: "none", conditions: {}, ...extra });
  a.uuid = SOLDIER;
  a.flags = {};
  a.update = async () => {};
  return a;
}

function shocked(a, penalty = -10) {
  a.system.conditions.shocked = true;
  a.flags["warhammer-dbc"] = { shock: { penalty } };
  return a;
}

/** Порог реального броска: открыть окно, нажать «Бросок!», прочитать карточку. */
async function rolledThreshold(actor, weapon, { melee = false } = {}) {
  const p = showAttackDialog(actor, weapon);
  captured.dice = [50, 5, 5, 5];
  await captured.press("roll", fakeForm({
    "#atk-char": melee ? "ws" : "bs", "#atk-modifier": "0", "#atk-aim": "",
    ...(melee ? {} : { "input[name='atk-rof']:checked": { value: "single", dataset: { bonus: "0" } } })
  }));
  await p;
  return thresholdInCard();
}

let realActors;
beforeEach(() => {
  resetCaptured();
  setTargets([]);
  realActors = game.actors;
  game.actors = [];
});
afterEach(() => { game.actors = realActors; });

/** Отряд, где боец в составе, с отданной Общей Командой «Атаки» на 3 Успеха. */
function squadWithGeneralAttack() {
  game.actors = [{
    uuid: "Actor.squad", type: "squad", name: "Копьё",
    system: {
      posts: {}, members: [{ id: "m1", uuid: SOLDIER }],
      presence: { active: true, benefit: "morale" },
      shortCommand: { active: true, key: "general", testKind: "attack", successes: 3 },
      detailCommand: { active: false, picks: [] }
    }
  }];
}

describe("Общая Команда «Атаки» (+Успехи×3) — в Пороге атаки подчинённого", () => {
  it("стрельба: +9 в итоговом Пороге броска", async () => {
    const gun = weaponFor();
    const base = await rolledThreshold(soldier(gun), gun);
    resetCaptured();
    squadWithGeneralAttack();
    expect(await rolledThreshold(soldier(gun), gun)).toBe(base + 9);
  });

  it("рукопашная: +9 в итоговом Пороге броска", async () => {
    const sword = weaponFor({ weaponClass: "melee", meleeCategory: "Меч" });
    const base = await rolledThreshold(soldier(sword), sword, { melee: true });
    resetCaptured();
    squadWithGeneralAttack();
    expect(await rolledThreshold(soldier(sword), sword, { melee: true })).toBe(base + 9);
  });

  it("строка Команды видна в окне атаки", () => {
    squadWithGeneralAttack();
    const gun = weaponFor();
    showAttackDialog(soldier(gun), gun);
    const html = captured.dialog.content;
    expect(html).toMatch(/rule-auto-mod"><span>Общая Команда \(Отряд «Копьё»\)<\/span><b>\+9<\/b>/);
  });
});

describe("Шок (стр. 53) — штраф строки в Пороге атаки", () => {
  it("стрельба: −10 в итоговом Пороге броска", async () => {
    const gun = weaponFor();
    const base = await rolledThreshold(soldier(gun), gun);
    resetCaptured();
    expect(await rolledThreshold(shocked(soldier(gun)), gun)).toBe(base - 10);
  });

  it("рукопашная: −10 в итоговом Пороге броска", async () => {
    const sword = weaponFor({ weaponClass: "melee", meleeCategory: "Меч" });
    const base = await rolledThreshold(soldier(sword), sword, { melee: true });
    resetCaptured();
    expect(await rolledThreshold(shocked(soldier(sword)), sword, { melee: true })).toBe(base - 10);
  });

  it("строка Шока видна в окне атаки", () => {
    const gun = weaponFor();
    showAttackDialog(shocked(soldier(gun)), gun);
    expect(captured.dialog.content).toMatch(/rule-auto-mod"><span>😨 Шок<\/span><b>-10<\/b>/);
  });
});

describe("не задваивает то, что атака считает сама", () => {
  it("Усталость: только своя галочка окна — без неё Порог не меняется", async () => {
    const gun = weaponFor();
    const base = await rolledThreshold(soldier(gun), gun);
    resetCaptured();
    // Галочку «Усталость» форма не прислала — autoMod Усталости из конвейера
    // в Порог попасть не должен (иначе с галочкой вышло бы −20).
    expect(await rolledThreshold(soldier(gun, { fatigue: { value: 1, effective: 1 } }), gun)).toBe(base);
    expect(captured.dialog.content).not.toMatch(/rule-auto-mod"><span>😓 Усталость/);
  });
});
