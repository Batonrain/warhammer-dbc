// test/combat/ogryn-weapon-break-same-hit.test.mjs
//
// wdbc-2gn (находка 4, ревью 07.09.2026): бросок «ломается ли человеческое
// оружие в лапах Огрина» (module/combat/ogryn-weapon-break.mjs, rollOgrynWeaponBreak,
// вызывается из attack.mjs::_executeAttackRoll) не был помечен как «тот же
// удар», в отличие от расхода патронов (opts.skipAmmo). Кнопки «сдвинуть
// место попадания» и «Горжет» (module/hooks.mjs) переигрывают ЭТУ ЖЕ атаку
// через opts.forcedRoll поверх той же карточки — без гейта один физический
// удар катал независимый бросок на поломку рукояти на каждое повторное
// разрешение, в т.ч. по клику ЗАЩИЩАЮЩЕГОСЯ (Горжет жмётся с его стороны).
//
// Фикс — тот же гейт opts.skipAmmo, что уже не даёт патронам расходоваться
// повторно (attack.mjs:422, комментарий «это тот же выстрел»): при
// skipAmmo:true бросок на поломку не катается вовсе.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

/** Дубина: рукопашное человеческое оружие без свойства Ogrynized. */
const club = () => weaponFor({
  weaponClass: "melee", weaponType: "primitive", damage: "1d10", damageType: "I",
  penetration: 0, weaponProps: []
}, { name: "Дубина" });

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("бросок на поломку человеческого оружия у Огрина — не повторяется на том же ударе", () => {
  it("обычная атака Огрина катает бросок на поломку — заметка есть в карточке", async () => {
    const weapon = club();
    const actor  = actorFor({ race: "ogryn", items: [weapon] });
    // атака (55 vs 15 — попадание), поломка (1d10=8, не ломается: 1-3), урон (1d10=6)
    captured.dice = [15, 8, 6];

    await _executeAttackRoll(actor, weapon, "ws", 55, "melee", null, {});

    expect(card()).toContain("🪨");
    expect(card()).toContain("1d10 = 8");
    expect(weapon.system.destroyed).toBeFalsy();
  });

  it("не-Огрин тем же оружием — броска на поломку нет вовсе, куб не тратится", async () => {
    const weapon = club();
    const actor  = actorFor({ race: "human", items: [weapon] });
    captured.dice = [15, 6]; // атака, урон — куба на поломку в очереди нет

    await _executeAttackRoll(actor, weapon, "ws", 55, "melee", null, {});

    expect(card()).not.toContain("🪨");
  });

  it("«сдвинуть место попадания»/Горжет (opts.skipAmmo) переигрывают ТОТ ЖЕ удар — второй бросок не катается", async () => {
    const weapon = club();
    const actor  = actorFor({ race: "ogryn", items: [weapon] });
    captured.dice = [15, 8, 6];
    await _executeAttackRoll(actor, weapon, "ws", 55, "melee", null, {});
    expect(card()).toContain("🪨"); // первый удар — заметка есть

    // Второй прогон — та же атака (opts.forcedRoll = тот же rv), как это
    // делают hooks.mjs::wh-locshift-btn / wh-gorget-btn. forcedRoll задаёт
    // фиксированное число (не "d100"), очередь кубов на сам бросок не тратит —
    // в очереди остаётся только куб урона, поэтому если бы поломка каталась
    // повторно, заглушка Roll упала бы «очередь кубов пуста».
    captured.dice = [6]; // только урон — куба на повторную поломку в очереди нет
    await _executeAttackRoll(actor, weapon, "ws", 55, "melee", null,
      { forcedRoll: 15, skipAmmo: true, locationShift: 1 });

    expect(card()).not.toContain("🪨"); // второе разрешение того же удара — заметки нет
  });

  it("без skipAmmo (полноценный отдельный переброс за Судьбу) поломка проверяется заново", async () => {
    const weapon = club();
    const actor  = actorFor({ race: "ogryn", items: [weapon] });
    captured.dice = [15, 8, 6];
    await _executeAttackRoll(actor, weapon, "ws", 55, "melee", null, {});

    // Второй удар — НЕ тот же самый бросок (opts.skipAmmo не выставлен):
    // рукоять снова проверяется на прочность.
    captured.dice = [12, 9, 4];
    await _executeAttackRoll(actor, weapon, "ws", 55, "melee", null, {});

    expect(card()).toContain("🪨");
    expect(card()).toContain("1d10 = 9");
  });
});
