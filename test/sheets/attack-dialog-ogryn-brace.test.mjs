// test/sheets/attack-dialog-ogryn-brace.test.mjs
//
// wdbc-flai, третья часть правила Огринов: «Закрепление оружия убирает все эти
// штрафы». Закрепление — Полудействие (оружие ставится на укрытие, лафет,
// бипод или трипод и держится, пока стрелок не сдвинулся), то есть решение
// игрока в конкретной атаке. Хранимого состояния «закреплено» в системе нет —
// у тяжёлого оружия Закрепление тоже живёт галочкой окна атаки, — поэтому
// здесь галочка ровно компенсирует уже посчитанный штраф.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

const html = () => captured.dialog?.content ?? "";

/** Значение data-value у галочки с этой меткой (null — галочки нет вовсе). */
function modValue(label) {
  const idx = html().indexOf(`<span>${label} (`);
  if (idx < 0) return null;
  const before = html().slice(Math.max(0, idx - 400), idx);
  const inputTag = before.slice(before.lastIndexOf("<input"));
  const m = inputTag.match(/data-value="(-?\d+)"/);
  return m ? Number(m[1]) : null;
}

const ogrynized = (extra = {}) =>
  weaponFor({ weaponClass: "melee", weaponProps: [{ key: "ogryned" }], ...extra },
            { name: "Огринская Дубина" });

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Закрепление снимает штрафы за огринское оружие (wdbc-flai)", () => {
  it("человеку с огринским оружием предложена галочка ровно на сумму штрафа", () => {
    const weapon = ogrynized();
    // Человек: Размер 0, S.b 4 — все три слагаемых по −10.
    const actor = actorFor({ items: [weapon], race: "human", size: 0 });
    showAttackDialog(actor, weapon);

    expect(modValue("Огринское оружие Закреплено")).toBe(30);
  });

  it("галочки нет, когда штрафа нет: оружие обычное", () => {
    const weapon = weaponFor({ weaponClass: "melee" });
    const actor  = actorFor({ items: [weapon], race: "human", size: 0 });
    showAttackDialog(actor, weapon);

    expect(modValue("Огринское оружие Закреплено")).toBe(null);
  });

  it("галочки нет у самого Огрина — ему своё оружие и так по руке", () => {
    const weapon = ogrynized();
    const actor  = actorFor({ items: [weapon], race: "ogryn", size: 1 });
    showAttackDialog(actor, weapon);

    expect(modValue("Огринское оружие Закреплено")).toBe(null);
  });

  it("сумма следует за штрафом: крупному и сильному чужаку остаётся один −10", () => {
    const weapon = ogrynized();
    const actor  = actorFor({
      items: [weapon], race: "astartes", size: 1,
      characteristics: { ws: { total: 45 }, bs: { total: 45 }, s: { total: 60, bonus: 10 },
                         t: { total: 40 }, ag: { total: 35 } }
    });
    showAttackDialog(actor, weapon);

    // Размер 1 и S.b 10 порогов не нарушают — остаётся только форма рук.
    expect(modValue("Огринское оружие Закреплено")).toBe(10);
  });
});
