// 3-dc87: Талант «Реанимировать» (combat/reanimate.mjs).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { runReanimate } from "../../module/combat/reanimate.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

const DEFAULT_SOURCES = getRuleSources();

function applyPaths(target, data) {
  for (const [path, value] of Object.entries(data)) {
    const parts = path.split(".");
    let cur = target;
    for (const part of parts.slice(0, -1)) { cur[part] ??= {}; cur = cur[part]; }
    cur[parts.at(-1)] = value;
  }
}

function actor({ id, fate = 3, corBonus = 3, deceased = false, diedAt = null } = {}) {
  const flags = {};
  if (deceased) flags["warhammer-dbc.deceased"] = true;
  if (diedAt) flags["warhammer-dbc.deceasedAt"] = diedAt;
  const updates = [];
  const a = {
    id, name: id, updates, items: [], type: "character",
    corruptionBonusProbe: corBonus,
    system: { fate: { value: fate, max: fate }, corruptionBonus: corBonus, conditions: {}, wounds: { value: -3, max: 10, critical: 3 }, characteristics: {} },
    update: async d => { updates.push(d); applyPaths(a, d); return d; },
    getFlag: (ns, k) => flags[`${ns}.${k}`],
    setFlag: async (ns, k, v) => { flags[`${ns}.${k}`] = v; return v; },
    flags
  };
  return a;
}

beforeEach(resetCaptured);
const realGetProperty = foundry.utils.getProperty;
beforeEach(() => {
  game.time = { worldTime: 1000 }; game.combat = null;
  // Заглушка Foundry отдаёт getProperty → undefined; пул Бесчестия читается им.
  foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);
});
afterEach(() => {
  foundry.utils.getProperty = realGetProperty;
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});
const grant = () => {
  clearRuleSources();
  registerRuleSource("test", () => [{ id: "test.reanimate", when: {}, effects: [{ kind: "grantFlag", target: "medic.core.reanimate" }] }]);
};

describe("runReanimate", () => {
  it("в окне Cor.b Раундов: Раны 0, Оглушение 1 Раунд, смерть снята, Очко Бесчестия и сцена потрачены", async () => {
    grant();
    const medic = actor({ id: "m", fate: 3 });
    const corpse = actor({ id: "c", deceased: true, diedAt: { worldTime: 1000 - 12, combatId: null, round: null } }); // 2 Раунда
    const ok = await runReanimate(medic, corpse, { reanimateOk: true });
    expect(ok).toBe(true);
    expect(corpse.system.wounds.value).toBe(0);
    expect(corpse.system.wounds.critical).toBe(0);
    expect(corpse.system.conditions.stunned).toBe(true);
    expect(corpse.system.conditions.stunnedRounds).toBe(1);
    expect(corpse.flags["warhammer-dbc.deceased"]).toBe(false);
    expect(medic.system.fate.value).toBe(2);
    expect(medic.flags["warhammer-dbc.usageLimits.reanimate"]?.used).toBe(true);
  });

  it("умер дольше Cor.b Раундов назад — не получается, ничего не потрачено", async () => {
    grant();
    const medic = actor({ id: "m", corBonus: 3 });
    const corpse = actor({ id: "c", deceased: true, diedAt: { worldTime: 1000 - 6 * 4, combatId: null, round: null } }); // 4 Раунда > 3
    const ok = await runReanimate(medic, corpse, { reanimateOk: true });
    expect(ok).toBe(false);
    expect(corpse.flags["warhammer-dbc.deceased"]).toBe(true);
    expect(medic.system.fate.value).toBe(3);
    expect(medic.flags["warhammer-dbc.usageLimits.reanimate"]).toBeUndefined();
  });

  it("раз за сцену: второй раз отказ", async () => {
    grant();
    const medic = actor({ id: "m" });
    const c1 = actor({ id: "c1", deceased: true, diedAt: { worldTime: 1000, combatId: null, round: null } });
    const c2 = actor({ id: "c2", deceased: true, diedAt: { worldTime: 1000, combatId: null, round: null } });
    expect(await runReanimate(medic, c1, { reanimateOk: true })).toBe(true);
    expect(await runReanimate(medic, c2, { reanimateOk: true })).toBe(false);
    expect(c2.flags["warhammer-dbc.deceased"]).toBe(true);
  });

  it("без Таланта, без подтверждения головы/варп-оружия, живая цель — отказ", async () => {
    const medic = actor({ id: "m" });
    const corpse = actor({ id: "c", deceased: true });
    expect(await runReanimate(medic, corpse, { reanimateOk: true })).toBe(false); // нет Таланта
    grant();
    expect(await runReanimate(medic, corpse, { reanimateOk: false })).toBe(false);
    expect(await runReanimate(medic, actor({ id: "alive" }), { reanimateOk: true })).toBe(false);
  });

  it("нет Очков Бесчестия — отказ, смерть не снята", async () => {
    grant();
    const medic = actor({ id: "m", fate: 0 });
    const corpse = actor({ id: "c", deceased: true, diedAt: { worldTime: 1000, combatId: null, round: null } });
    expect(await runReanimate(medic, corpse, { reanimateOk: true })).toBe(false);
    expect(corpse.flags["warhammer-dbc.deceased"]).toBe(true);
  });
});
