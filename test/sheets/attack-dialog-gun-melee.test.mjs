// test/sheets/attack-dialog-gun-melee.test.mjs
//
// «Ударить оружием» (core.json, «Безоружный Бой», wdbc-x1nz.2.71): «Все атаки
// стрелковым оружием, использующим эти профили, получают штраф –10, который
// увеличивается до –20 для тяжелого оружия». Проверяется через настоящий
// бросок из окна: штраф — слагаемое порога, дошедшее до карточки.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function shooter(items = []) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none" });
  a.update = async () => {};
  const store = {};
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  a.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  return a;
}

async function rollCard(weapon, opts) {
  resetCaptured();
  captured.dice = [50, 5, 5, 5];
  const p = showAttackDialog(shooter([weapon]), weapon, opts);
  await captured.press("roll", fakeForm({ "#atk-char": "ws", "#atk-modifier": "0", "#atk-aim": "" }, {}));
  await p;
  const card = captured.chat.find(m => /Порог/.test(m.content))?.content ?? "";
  const m = card.match(/<label>Порог<\/label><b>(-?\d+)<\/b>/);
  return m ? Number(m[1]) : null;
}

// WS 45 + База «Обычная» +10 (рукопашная) — всё, что есть у голого стенда,
// кроме проверяемой строки.
const MELEE_BASE = 45 + 10;

beforeEach(() => { resetCaptured(); setTargets([]); });

describe("штраф «Стрелковое в рукопашной» в пороге броска", () => {
  it("винтовка прикладом — −10", async () => {
    const gun = weaponFor({ weaponClass: "basic", equipped: true }, { name: "Лазган" });
    expect(await rollCard(gun, { forceMelee: true, profileIdx: 0 })).toBe(MELEE_BASE - 10);
  });

  it("тяжёлое прикладом — −20", async () => {
    const gun = weaponFor({ weaponClass: "heavy", equipped: true }, { name: "Тяжёлый болтер" });
    expect(await rollCard(gun, { forceMelee: true, profileIdx: 0 })).toBe(MELEE_BASE - 20);
  });

  it("выстрел — штрафа нет (BS 45 как есть)", async () => {
    const gun = weaponFor({ weaponClass: "basic", equipped: true }, { name: "Лазган" });
    captured.dice = [50];
    expect(await rollCard(gun, {})).toBe(45);
  });
});
