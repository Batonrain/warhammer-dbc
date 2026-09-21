// test/combat/legacy-weapon-regroup.test.mjs
//
// activateLegacyRegroup / processLegacyRegroupRoundStart (module/combat/
// legacy-weapon-regroup.mjs) — Перегруппировка/vigilant 1-2 (wdbc-1rno.35,
// стр. 427): «...может потратить Очко Бесчестия, чтобы перебросить свою
// Инициативу начиная со следующего Раунда» — переброс откладывается до
// смены Раунда, не происходит сразу (см. заголовок модуля).

import "../support/foundry-stub.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { activateLegacyRegroup, processLegacyRegroupRoundStart } from "../../module/combat/legacy-weapon-regroup.mjs";

foundry.utils.getProperty = (object, key) =>
  String(key).split(".").reduce((o, k) => o?.[k], object);

function actorWith(fate = 1) {
  return { uuid: "Actor.a1", name: "Чемпион", system: { fate: { value: fate } },
    async update(data) { if (data["system.fate.value"] !== undefined) this.system.fate.value = data["system.fate.value"]; },
    async rollInitiative(opts) { this.rollInitiativeCalls = (this.rollInitiativeCalls || 0) + 1; this.rollInitiativeOpts = opts; } };
}

function combatantFor(actor) {
  const flags = {};
  return {
    actor,
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async setFlag(scope, key, value) { flags[`${scope}.${key}`] = value; },
    async unsetFlag(scope, key) { delete flags[`${scope}.${key}`]; }
  };
}

beforeEach(() => resetCaptured());
afterEach(() => { globalThis.game.combat = undefined; globalThis.fromUuid = async () => null; });

describe("activateLegacyRegroup", () => {
  it("в бою, есть Очко Бесчестия — списывает 1, ставит метку на Combatant'е", async () => {
    const actor = actorWith(2);
    const c = combatantFor(actor);
    globalThis.fromUuid = async uuid => (uuid === actor.uuid ? actor : null);
    globalThis.game.combat = { combatants: [c] };
    await activateLegacyRegroup(actor.uuid);
    expect(actor.system.fate.value).toBe(1);
    expect(c.getFlag("warhammer-dbc", "legacyRegroupPending")).toBe(true);
  });

  it("нет Очков Бесчестия — метку не ставит", async () => {
    const actor = actorWith(0);
    const c = combatantFor(actor);
    globalThis.fromUuid = async () => actor;
    globalThis.game.combat = { combatants: [c] };
    await activateLegacyRegroup(actor.uuid);
    expect(c.getFlag("warhammer-dbc", "legacyRegroupPending")).toBeUndefined();
  });

  it("персонаж не в бою (нет Combatant'а) — не тратит, предупреждает", async () => {
    const actor = actorWith(2);
    globalThis.fromUuid = async () => actor;
    globalThis.game.combat = { combatants: [] };
    await activateLegacyRegroup(actor.uuid);
    expect(actor.system.fate.value).toBe(2);
  });

  it("уже запланирован переброс — второй клик не тратит повторно", async () => {
    const actor = actorWith(2);
    const c = combatantFor(actor);
    globalThis.fromUuid = async () => actor;
    globalThis.game.combat = { combatants: [c] };
    await activateLegacyRegroup(actor.uuid);
    await activateLegacyRegroup(actor.uuid);
    expect(actor.system.fate.value).toBe(1);
  });
});

describe("processLegacyRegroupRoundStart", () => {
  it("метка стоит — перебрасывает Инициативу и снимает метку", async () => {
    const actor = actorWith(1);
    const c = combatantFor(actor);
    await c.setFlag("warhammer-dbc", "legacyRegroupPending", true);
    await processLegacyRegroupRoundStart({ combatants: [c] });
    expect(actor.rollInitiativeCalls).toBe(1);
    expect(actor.rollInitiativeOpts).toEqual({ createCombatants: false, rerollInitiative: true });
    expect(c.getFlag("warhammer-dbc", "legacyRegroupPending")).toBeUndefined();
  });

  it("метки нет — не трогает Инициативу", async () => {
    const actor = actorWith(1);
    const c = combatantFor(actor);
    await processLegacyRegroupRoundStart({ combatants: [c] });
    expect(actor.rollInitiativeCalls).toBeUndefined();
  });

  it("нет combat — не падает", async () => {
    await expect(processLegacyRegroupRoundStart(null)).resolves.toBeUndefined();
  });
});
