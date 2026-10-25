// test/combat/heal-target-writers.test.mjs
//
// wdbc-1rno.26, вариант L (24.10.2026): писатели Ран, где ДРУГОЙ актор
// восстанавливает чужие Раны, отмечают это общей точкой лечения
// (combat/heal-target.mjs) — «Недоверие к Лечению» Затронутого Варпом ставится
// не только после Первой Помощи, чужого укола и ухода медика, но и после:
//   • Дыхания Жизни (Дар Нургла) — труп встаёт с 0 Ран;
//   • Реанимировать (Талант Медика) — труп встаёт с 0 Ран;
//   • Ракового Исцеления (Мутация) — цель получает аблативные Раны.
// Тест писан ДО переноса: сперва фиксирует, что метки не было (красный), потом
// переключает писателей на общую точку. Самолечение метки не даёт.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { useBreathOfLife } from "../../module/apps/breath-of-life.mjs";
import { runReanimate } from "../../module/combat/reanimate.mjs";
import { applyCancerousHealingEffect } from "../../module/apps/cancerous-healing.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

const DEFAULT_SOURCES = getRuleSources();
const NOW = 1_000_000;
const HOUR = 3600;
const CAP = "mutation.warpTouched.healMistrust";
const NS = "warhammer-dbc";

const mistrustItem = () => ({
  id: "wt", name: "Warp Touched / Затронутый Варпом", type: "mutation", system: {},
  flags: { [NS]: { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: CAP, label: "" }
  ] }] } }
});

function applyPaths(target, data) {
  for (const [path, value] of Object.entries(data)) {
    const parts = path.split(".");
    let cur = target;
    for (const part of parts.slice(0, -1)) { cur[part] ??= {}; cur = cur[part]; }
    cur[parts.at(-1)] = value;
  }
}

/** Подставной актор: Раны, флаги, список предметов, права. */
function person(id, { mistrust = false, wounds = { value: 5, max: 10, critical: 0 }, deceased = false, fate = 3, extra = {} } = {}) {
  const flags = {};
  if (deceased) flags[`${NS}.deceased`] = true;
  const a = {
    id, uuid: `Actor.${id}`, name: id, type: "character", items: mistrust ? [mistrustItem()] : [],
    system: { wounds: { ...wounds }, conditions: {}, characteristics: {}, fate: { value: fate, max: fate }, corruptionBonus: 3, ...extra },
    flags,
    update: async d => { applyPaths(a, d); return d; },
    getFlag: (ns, k) => flags[`${ns}.${k}`],
    setFlag: async (ns, k, v) => { flags[`${ns}.${k}`] = v; return v; }
  };
  return a;
}
const mark = a => a.getFlag(NS, "healMistrustUntil");

const realGetProperty = foundry.utils.getProperty;
beforeEach(() => {
  resetCaptured();
  game.time = { worldTime: NOW };
  game.combat = null;
  foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);
});
afterEach(() => {
  foundry.utils.getProperty = realGetProperty;
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

describe("Дыхание Жизни: труп встаёт — это лечение от другого", () => {
  const gift = () => ({
    type: "mutation", name: "Breath of Life / Дыхание Жизни", id: "bol",
    flags: { [NS]: { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: "gift.nurgle.breathOfLife" }] }] } }
  });
  const withTarget = corpse => { game.user.targets = [{ actor: corpse }]; };
  afterEach(() => { game.user.targets = undefined; });

  it("носитель Недоверия — после оживления метка на час и строка в карточке", async () => {
    const nurgle = person("n", { wounds: { value: 12, max: 12, critical: 0 } });
    const corpse = person("c", { mistrust: true, wounds: { value: 0, max: 10, critical: 4 } });
    withTarget(corpse);
    await useBreathOfLife(nurgle, gift());
    expect(corpse.system.wounds).toMatchObject({ value: 0, critical: 0 });
    expect(mark(corpse)).toBe(NOW + HOUR);
    expect(captured.chat[0].content).toContain("Недоверие к Лечению");
  });

  it("у трупа нет субмутации — метки нет; Раны подняты как раньше", async () => {
    const nurgle = person("n", { wounds: { value: 12, max: 12, critical: 0 } });
    const corpse = person("c", { wounds: { value: 0, max: 10, critical: 4 } });
    withTarget(corpse);
    await useBreathOfLife(nurgle, gift());
    expect(corpse.system.wounds).toMatchObject({ value: 0, critical: 0 });
    expect(mark(corpse)).toBeUndefined();
  });

  it("труп без отрицательных Ран (поднимать нечего) — Раны не восстановлены, метки нет", async () => {
    const nurgle = person("n", { wounds: { value: 12, max: 12, critical: 0 } });
    const corpse = person("c", { mistrust: true, wounds: { value: 0, max: 10, critical: 0 } });
    withTarget(corpse);
    await useBreathOfLife(nurgle, gift());
    expect(mark(corpse)).toBeUndefined();
  });
});

describe("Реанимировать: труп встаёт — это лечение от другого", () => {
  const grant = () => {
    clearRuleSources();
    registerRuleSource("test", () => [{ id: "test.reanimate", when: {}, effects: [{ kind: "grantFlag", target: "medic.core.reanimate" }] }]);
  };
  // Правило выдачи Таланта подменяет реестр целиком, поэтому «Недоверие» у трупа
  // выдаём тем же тестовым источником — по ключу возможности пациента.
  const grantBoth = () => {
    clearRuleSources();
    registerRuleSource("test", actor => [
      { id: "test.reanimate", when: {}, effects: [{ kind: "grantFlag", target: "medic.core.reanimate" }] },
      ...(actor.id === "c" ? [{ id: "test.mistrust", when: {}, effects: [{ kind: "grantFlag", target: CAP }] }] : [])
    ]);
  };
  const corpseOf = opts => person("c", { deceased: true, wounds: { value: 0, max: 10, critical: 3 }, ...opts });
  const diedAt = { worldTime: NOW - 12, combatId: null, round: null };
  const corpseWithDeath = opts => { const c = corpseOf(opts); c.flags[`${NS}.deceasedAt`] = diedAt; return c; };

  it("с «Недоверием к Лечению» у трупа — метка на час", async () => {
    grantBoth();
    const medic = person("m");
    const corpse = corpseWithDeath();
    expect(await runReanimate(medic, corpse, { reanimateOk: true })).toBe(true);
    expect(corpse.system.wounds).toMatchObject({ value: 0, critical: 0 });
    expect(mark(corpse)).toBe(NOW + HOUR);
    expect(captured.chat.some(m => m.content.includes("Недоверие к Лечению"))).toBe(true);
  });

  it("без субмутации у трупа — метки нет", async () => {
    grant();
    const medic = person("m");
    const corpse = corpseWithDeath();
    expect(await runReanimate(medic, corpse, { reanimateOk: true })).toBe(true);
    expect(mark(corpse)).toBeUndefined();
  });

  it("отказ (не успели, нет Бесчестия) — Раны не тронуты, метки нет", async () => {
    grantBoth();
    const medic = person("m", { fate: 0 });
    const corpse = corpseWithDeath();
    expect(await runReanimate(medic, corpse, { reanimateOk: true })).toBe(false);
    expect(corpse.system.wounds.critical).toBe(3);
    expect(mark(corpse)).toBeUndefined();
  });
});

describe("Раковое Исцеление: касание другого даёт аблативные Раны — это лечение", () => {
  const target = opts => {
    const t = person("t", { wounds: { value: 4, max: 10, critical: 0 }, ...opts });
    t.system.wounds.ablative = 0; t.system.wounds.ablativeMax = 0;
    t.effects = [];
    t.createEmbeddedDocuments = async () => [];
    return t;
  };

  it("носитель Недоверия, цель ранена — метка на час", async () => {
    const t = target({ mistrust: true });
    await applyCancerousHealingEffect(person("healer"), t);
    expect(t.system.wounds.ablative).toBe(6);
    expect(mark(t)).toBe(NOW + HOUR);
  });

  it("цель не ранена (аблатива не дали) — лечить было нечего, метки нет", async () => {
    const t = target({ mistrust: true, wounds: { value: 10, max: 10, critical: 0 } });
    await applyCancerousHealingEffect(person("healer"), t);
    expect(t.system.wounds.ablative).toBe(0);
    expect(mark(t)).toBeUndefined();
  });

  it("без субмутации — метки нет", async () => {
    const t = target();
    await applyCancerousHealingEffect(person("healer"), t);
    expect(mark(t)).toBeUndefined();
  });

  it("лечит сам себя (носитель Мутации касается себя) — метки нет", async () => {
    const t = target({ mistrust: true });
    await applyCancerousHealingEffect(t, t);
    expect(mark(t)).toBeUndefined();
  });
});
