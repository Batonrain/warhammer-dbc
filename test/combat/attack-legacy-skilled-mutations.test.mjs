// test/combat/attack-legacy-skilled-mutations.test.mjs
//
// Отвлекающее/skilled 3-4 (стрелковая, стр. 427-428) — «Все остальные
// персонажи +10 по цели, в которую попало это оружие»: попадание метит цель
// флагом legacyDistractingMark, читает его обратно sheets/attack/mods.mjs.
// Бесчестное/skilled 10-10 (стр. 428) — +1d10 Dmg против unseen/Врасплох цели.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { situationalMods } from "../../module/sheets/attack/mods.mjs";
import { DISTRACTING_LEGACY_FLAG } from "../../module/rules/legacy-weapon.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

function targetActorWithFlag() {
  const flags = {};
  return {
    id: "t1", name: "Цель", system: { wounds: { value: 10, max: 10 } },
    getFlag: (scope, key) => (scope === "warhammer-dbc" ? flags[key] : undefined),
    async setFlag(scope, key, value) { if (scope === "warhammer-dbc") flags[key] = value; return this; }
  };
}

beforeEach(() => { resetCaptured(); setTargets([]); });

describe("Отвлекающее: попадание метит цель, мод читает флаг обратно", () => {
  it("стрелковое попадание метит цель флагом", async () => {
    const weapon = weaponFor({ weaponClass: "basic", legacy: { active: true, mutations: [{ name: "Отвлекающее" }] } });
    const actor  = actorFor({ items: [weapon] });
    const target = targetActorWithFlag();
    setTargets([target]);
    captured.dice = [10, 5]; // rv=10 (hit при Пороге 45), 1 куб урона
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(target.getFlag("warhammer-dbc", DISTRACTING_LEGACY_FLAG)).toBe(true);
  });

  it("отмеченная цель — situationalMods показывает +10 всем", () => {
    const target = { system: {}, getFlag: () => true };
    const { commonMods } = situationalMods({
      actor: { items: [], system: {} }, attackCtx: { targetActor: target },
      attackerToken: null, gripRange: null, hasFatigue: false, hasLostEyes: false,
      isBlinded: false, isMelee: false, measured: null, targetHelpless: false,
      targetToken: null, weapon: null, wProps: [], wp: {}
    });
    const mod = commonMods.find(m => m.label.startsWith("Отвлекающее"));
    expect(mod).toBeTruthy();
    expect(mod.value).toBe(10);
  });
});

describe("Бесчестное: +1d10 Dmg против unseen/Врасплох цели", () => {
  it("targetSurprised — урон в карточке учитывает +1d10 (5 базы+5 бонус оружия+7 Бесчестного=17)", async () => {
    const weapon = weaponFor({ damage: "1d10+5", legacy: { active: true, mutations: [{ name: "Бесчестное" }] } });
    const actor  = actorFor({ items: [weapon] });
    const target = targetActorWithFlag();
    setTargets([target]);
    // rv=10 (hit), 1 куб урона =5, 1d10 Бесчестного =7 → 5(куб)+5(флат)+7 = 17.
    captured.dice = [10, 5, 7];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { targetSurprised: true });
    expect(card()).toContain("<b>17</b>");
  });

  it("не Врасплох и не Незримо — обычный урон без бонуса (10)", async () => {
    const weapon = weaponFor({ damage: "1d10+5", legacy: { active: true, mutations: [{ name: "Бесчестное" }] } });
    const actor  = actorFor({ items: [weapon] });
    const target = targetActorWithFlag();
    setTargets([target]);
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).toContain("<b>10</b>");
    expect(card()).not.toContain("<b>17</b>");
  });
});

describe("Защитник/vigilant 8-8, стрелковая: попадание метит цель", () => {
  it("стрелковое попадание метит цель shooterUuid", async () => {
    const weapon = weaponFor({ weaponClass: "basic", legacy: { active: true, mutations: [{ name: "Защитник" }] } });
    const actor  = actorFor({ items: [weapon] });
    actor.uuid = "Actor.shooter-1";
    const target = targetActorWithFlag();
    setTargets([target]);
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(target.getFlag("warhammer-dbc", "legacyGuardianMark")).toEqual({ shooterUuid: "Actor.shooter-1" });
  });

  it("рукопашная атака той же Мутацией — не метит (другая ветка книги)", async () => {
    const weapon = weaponFor({ weaponClass: "melee", legacy: { active: true, mutations: [{ name: "Защитник" }] } });
    const actor  = actorFor({ items: [weapon] });
    const target = targetActorWithFlag();
    setTargets([target]);
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});
    expect(target.getFlag("warhammer-dbc", "legacyGuardianMark")).toBeUndefined();
  });
});
