// test/combat/dread-wail.test.mjs
//
// module/combat/dread-wail.mjs (wdbc-sk8s) — Dread Wail/Грозный Вопль (два
// режима: усиление звукового оружия / звуковая волна AoE) + расширение
// лимита от Sweet Cacophony/Сладкая Какофония.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import {
  hasDreadWail, dreadWailMax, dreadWailAvailable, isSonicWeapon, dreadWailWeaponBonus,
  applyDreadWailWeaponBuff, clearDreadWailWeaponBuff, applyDreadWailWave, WAVE_EFFECTS
} from "../../module/combat/dread-wail.mjs";

const grid = { size: 100, distance: 2 };

function noiseMarine({ hasTrait = true, hasCacophony = false, corBonus = 3, perBonus = 4, fate = 2 } = {}) {
  const flags = {};
  const items = [];
  if (hasTrait) items.push({ type: "trait", name: "Dread Wail / Грозный Вопль" });
  if (hasCacophony) items.push({ type: "talent", name: "Sweet Cacophony / Сладкая Какофония" });
  const data = {
    name: "Шумовой", items,
    system: { corruptionBonus: corBonus, characteristics: { per: { bonus: perBonus } }, fate: { value: fate, max: 5 } },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; }
  };
  data.update = async patch => {
    if (patch["system.fate.value"] !== undefined) data.system.fate.value = patch["system.fate.value"];
  };
  return data;
}

function targetActor({ wpTotal = 40, patronGod = "", uuid = "Actor.t1" } = {}) {
  const flags = {};
  const data = {
    name: `Жертва-${uuid}`, uuid,
    system: { characteristics: { wp: { total: wpTotal } }, patronGod, fatigue: { value: 0 }, conditions: {} },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
  data.update = async patch => {
    for (const [path, value] of Object.entries(patch)) {
      const parts = path.split(".");
      let cur = data;
      for (const p of parts.slice(0, -1)) { cur[p] ??= {}; cur = cur[p]; }
      cur[parts.at(-1)] = value;
    }
  };
  return data;
}

function token(id, actor, x = 0) {
  return { id, x, y: 0, width: 1, height: 1, hidden: false, actor };
}
function scene(tokens) { return { grid, tokens: { contents: tokens } }; }

afterEach(() => { resetCaptured(); globalThis.game.combat = undefined; });

describe("hasDreadWail / dreadWailMax", () => {
  it("определяет владение Чертой", () => {
    expect(hasDreadWail(noiseMarine({ hasTrait: true }))).toBe(true);
    expect(hasDreadWail(noiseMarine({ hasTrait: false }))).toBe(false);
  });
  it("без Sweet Cacophony — лимит 1 независимо от Cor.b", () => {
    expect(dreadWailMax(noiseMarine({ hasCacophony: false, corBonus: 5 }))).toBe(1);
  });
  it("с Sweet Cacophony — лимит Cor.b (мин. 1)", () => {
    expect(dreadWailMax(noiseMarine({ hasCacophony: true, corBonus: 4 }))).toBe(4);
    expect(dreadWailMax(noiseMarine({ hasCacophony: true, corBonus: 0 }))).toBe(1);
  });
});

describe("dreadWailAvailable", () => {
  it("раз за бой без Sweet Cacophony", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const a = noiseMarine();
    expect(dreadWailAvailable(a)).toBe(true);
    await applyDreadWailWeaponBuff(a);
    expect(dreadWailAvailable(a)).toBe(false);
  });

  it("Cor.b раз за бой с Sweet Cacophony", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const a = noiseMarine({ hasCacophony: true, corBonus: 2 });
    await applyDreadWailWeaponBuff(a);
    expect(dreadWailAvailable(a)).toBe(true);
    await applyDreadWailWeaponBuff(a);
    expect(dreadWailAvailable(a)).toBe(false);
  });
});

describe("isSonicWeapon / dreadWailWeaponBonus", () => {
  it("матчит имя по звуковому паттерну", () => {
    expect(isSonicWeapon({ name: "Sonic Blaster" })).toBe(true);
    expect(isSonicWeapon({ name: "Звуковой Крикун" })).toBe(true);
    expect(isSonicWeapon({ name: "Bolt Pistol" })).toBe(false);
  });

  it("без активного усилителя — {dmg:0,pen:0} даже на звуковом оружии", () => {
    const a = noiseMarine();
    expect(dreadWailWeaponBonus(a, { name: "Sonic Blaster" })).toEqual({ dmg: 0, pen: 0 });
  });

  it("с активным усилителем — бонус только на звуковом оружии", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const a = noiseMarine({ perBonus: 5 });
    await applyDreadWailWeaponBuff(a);
    expect(dreadWailWeaponBonus(a, { name: "Sonic Blaster" })).toEqual({ dmg: 5, pen: 5 });
    expect(dreadWailWeaponBonus(a, { name: "Bolt Pistol" })).toEqual({ dmg: 0, pen: 0 });
  });
});

describe("applyDreadWailWeaponBuff / clearDreadWailWeaponBuff", () => {
  it("списывает счётчик, тратит 1 Очко Бесчестия, ставит флаг с Per.b", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const a = noiseMarine({ perBonus: 3, fate: 2 });
    await applyDreadWailWeaponBuff(a);
    expect(a.system.fate.value).toBe(1);
    expect(dreadWailWeaponBonus(a, { name: "Sonic Blaster" }).dmg).toBe(3);
  });

  it("clear снимает флаг", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const a = noiseMarine();
    await applyDreadWailWeaponBuff(a);
    await clearDreadWailWeaponBuff(a);
    expect(dreadWailWeaponBonus(a, { name: "Sonic Blaster" })).toEqual({ dmg: 0, pen: 0 });
  });
});

describe("applyDreadWailWave", () => {
  it("не задевает посвящённых Слаанеш и цели вне радиуса", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const caster = noiseMarine({ corBonus: 4 }); // радиус 2м
    const casterToken = token("c1", caster, 0);
    const inRange   = targetActor({ uuid: "Actor.inRange", wpTotal: 40 });
    const slaanesh  = targetActor({ uuid: "Actor.slaanesh", patronGod: "slaanesh" });
    const farAway   = targetActor({ uuid: "Actor.far" });
    const s = scene([casterToken, token("t1", inRange, 100), token("t2", slaanesh, 100), token("t3", farAway, 10000)]);
    casterToken.parent = s;

    captured.nextRoll = 90; // провал против разумного порога
    await applyDreadWailWave(caster, casterToken, "stunned");

    expect(inRange.system.conditions.stunned).toBe(true);
    expect(slaanesh.getFlag).toBeDefined();
    expect(slaanesh.system.conditions.stunned).toBeUndefined();
    expect(farAway.system.conditions.stunned).toBeUndefined();
  });

  it("успешный тест цели — эффект не применяется", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const caster = noiseMarine({ corBonus: 4 });
    const casterToken = token("c1", caster, 0);
    const victim = targetActor({ wpTotal: 60 }); // высокий порог
    const s = scene([casterToken, token("t1", victim, 50)]);
    casterToken.parent = s;

    captured.nextRoll = 5; // почти наверняка успех
    await applyDreadWailWave(caster, casterToken, "stunned");
    expect(victim.system.conditions.stunned).toBeUndefined();
  });

  it("эффект fatigue добавляет к system.fatigue.value", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const caster = noiseMarine({ corBonus: 4 });
    const casterToken = token("c1", caster, 0);
    const victim = targetActor({ wpTotal: 20 });
    const s = scene([casterToken, token("t1", victim, 50)]);
    casterToken.parent = s;

    captured.dice = [99, 3]; // 99 → провал теста W−20, 3 → 1d5 Усталости
    await applyDreadWailWave(caster, casterToken, "fatigue");
    expect(victim.system.fatigue.value).toBe(3);
  });

  it("WAVE_EFFECTS перечисляет все 3 варианта", () => {
    expect(WAVE_EFFECTS.map(e => e.key)).toEqual(["fear", "fatigue", "stunned"]);
  });
});
