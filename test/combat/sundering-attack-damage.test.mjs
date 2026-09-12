// test/combat/sundering-attack-damage.test.mjs
//
// Sundering / Разделение (wdbc-1rno, Тзинч): «урон всех атак копий
// уменьшает кубики с 1d10 до 1d5 и заменяет 1d5 на 1» — интеграция в
// основной боевой конвейер (module/combat/attack.mjs), гейт по
// SUNDERING_COPY_FLAG (метка на самом акторе-копии, НЕ hasRuleFlag/
// grantFlag — module/combat/sundering.mjs ставит её напрямую при спавне).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { SUNDERING_COPY_FLAG } from "../../module/rules/sundering.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
function hits() {
  return [...card().matchAll(
    /<span class="roll-hit-idx">Попадание (\d+)<\/span>\s*<span class="roll-hit-dmg">(\d+)<\/span>\s*<span class="roll-hit-loc">([^<]+)<\/span>/g
  )].map(m => ({ index: Number(m[1]), damage: Number(m[2]), location: m[3] }));
}

/** Актор-копия Разделения: та же actorFor, только с меткой SUNDERING_COPY_FLAG. */
function sunderingCopyActorFor(opts) {
  const actor = actorFor(opts);
  actor.getFlag = (scope, key) => (key === SUNDERING_COPY_FLAG ? { championUuid: "Actor.champ", index: 1 } : undefined);
  return actor;
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Sundering — даунгрейд урона копии в основном конвейере атаки", () => {
  it("обычный актор с оружием 1d10+5 — урон как обычно (кубик реально бросается)", async () => {
    const weapon = weaponFor(); // "1d10+5"
    const actor = actorFor({ items: [weapon] });
    captured.dice = [23, 6]; // d100 атаки, d10 урона
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(hits()).toEqual([{ index: 1, damage: 11, location: "Торс" }]); // 6+5
  });

  it("копия Разделения с тем же оружием — 1d10+5 → 1+5 = 6, кубик урона не бросается вовсе", async () => {
    const weapon = weaponFor(); // "1d10+5"
    const actor = sunderingCopyActorFor({ items: [weapon] });
    captured.dice = [23]; // только d100 атаки — на урон дайсов нет
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(hits()).toEqual([{ index: 1, damage: 6, location: "Торс" }]); // 1+5, фиксировано
  });

  it("копия Разделения с уже-1d5-оружием — 1d5+2 → 1+2 = 3", async () => {
    const weapon = weaponFor({ damage: "1d5+2" });
    const actor = sunderingCopyActorFor({ items: [weapon] });
    captured.dice = [23];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(hits()).toEqual([{ index: 1, damage: 3, location: "Торс" }]);
  });
});
