// test/combat/force-weapon-quality-pen.test.mjs
//
// wdbc-clh: репорт «Best.Q психосилового оружия задваивает качество к PR от
// force». Прошлое расследование (заметка в тикете) не нашло penMod в
// module/constants/quality.mjs вовсе — это было неверно: penMod ЕСТЬ, но
// только в drukhariQualityEffects (Best +1, Artisan +2 Pen на рукопашном) —
// имперская таблица его не даёт. Свойство Force (module/constants/
// weapon-properties.mjs, forcePR) отдельно добавляет +PR (макс +10) к Pen
// через attackPenetration (module/combat/attack-outcome.mjs). Оба бонуса
// складываются РОВНО ОДИН РАЗ каждый — это не одна и та же прибавка дважды,
// а два разных книжных бонуса (качество оружия + Психосиловое). Тест
// закрепляет текущее (проверенное правильным) поведение: Pen = база +
// качество + PR, без задвоения ни одного из слагаемых.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const penetration = () => {
  const m = card().match(/Пробитие (-?\d+)/);
  return m ? Number(m[1]) : null;
};

/** weaponFor() не ставит item.type — qualityCategory() требует "weapon", иначе уходит в "misc". */
function forceWeapon(overrides = {}) {
  const w = weaponFor({ weaponClass: "melee", penetration: 2, quality: "best", weaponProps: [{ key: "force" }], ...overrides });
  w.type = "weapon";
  return w;
}

beforeEach(() => { resetCaptured(); setTargets([]); });

describe("Психосиловое (force) + Best.Q друкхарийского рукопашного: Pen складывается один раз каждый (wdbc-clh)", () => {
  it("не-псайкер — качество даёт Pen, Force бонус не применяется (нет псайкера)", async () => {
    const weapon = forceWeapon({ drukhari: true });
    const actor  = actorFor({ items: [weapon], isPsyker: false });
    captured.dice = [10, 6]; // d100 атаки (гарантированный успех), d10 урона

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    // база 2 + Best.Q Друкхари (+1) = 3, Force не в руках псайкера — бонуса нет.
    expect(penetration()).toBe(3);
  });

  it("псайкер, PR=5 — качество (+1) и Force (+PR=5) складываются один раз каждый, не дважды", async () => {
    const weapon = forceWeapon({ drukhari: true });
    const actor  = actorFor({ items: [weapon], isPsyker: true, psyker: { currentRating: 5 } });
    captured.dice = [10, 6];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    // база 2 + Best.Q Друкхари (+1) + Force PR (+5) = 8. НЕ 9 (не задвоено
    // качество) и НЕ 13 (не задвоен Force).
    expect(penetration()).toBe(8);
  });

  it("псайкер, PR=20 — Force капается на +10, качество (+1) не участвует в капе", async () => {
    const weapon = forceWeapon({ drukhari: true });
    const actor  = actorFor({ items: [weapon], isPsyker: true, psyker: { currentRating: 20 } });
    captured.dice = [10, 6];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    // база 2 + качество 1 + Force min(20,10)=10 = 13.
    expect(penetration()).toBe(13);
  });

  it("не-друкхарийское (имперское) Best.Q — качество не даёт Pen вовсе, только Force", async () => {
    const weapon = forceWeapon({ drukhari: false });
    const actor  = actorFor({ items: [weapon], isPsyker: true, psyker: { currentRating: 5 } });
    captured.dice = [10, 6];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    // база 2 + качество 0 (имперская таблица не трогает Pen) + Force 5 = 7.
    expect(penetration()).toBe(7);
  });
});
