// Метки без привязки к бою снимаются в конце боя (приёмка #597).
import { describe, it, expect } from "vitest";
import { combatEndMarksPatch } from "../../module/combat/combat-end-marks.mjs";

describe("combatEndMarksPatch", () => {
  it("Танец Пламени, Секуторий, Таран и «до конца Хода» — снять; Состояние «до конца Хода» — тоже", () => {
    const actor = { flags: { "warhammer-dbc": {
      fireDancePanic: true, secutorPin: { weaponUuid: "x" }, devourerRam: true, conditionUntilTurnEnd: { blinded: 1 }, other: 1
    } } };
    const patch = combatEndMarksPatch(actor, key => ({ [`system.conditions.${key}`]: false }));
    expect(patch).toEqual({
      "flags.warhammer-dbc.-=fireDancePanic": null, "flags.warhammer-dbc.-=secutorPin": null,
      "flags.warhammer-dbc.-=devourerRam": null, "flags.warhammer-dbc.-=conditionUntilTurnEnd": null,
      "system.conditions.blinded": false
    });
  });
  it("без меток — пустая заплатка", () => {
    expect(combatEndMarksPatch({ flags: {} })).toEqual({});
  });
});
