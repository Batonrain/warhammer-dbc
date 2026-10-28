// test/combat/mount-dragon-knight.test.mjs
//
// Dragon Knight / Драконий Рыцарь (Всадник, Sahara 3-cross-actor-5482; DoomBC —
// Основная книга): «Если персонаж и скакун действуют в одну Инициативу, за
// полудействие он может пройти Survival−10, чтобы дать скакуну +3×Успехи на все
// Атаки или Избегания до начала их следующего Хода (выбирая до броска).»

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { dragonKnightTest, clearDragonKnight } from "../../module/combat/mount.mjs";
import { dragonKnightRules, dragonKnightEvasionBonus, DRAGON_KNIGHT_FLAG } from "../../module/rules/dragon-knight.mjs";
import { situationalRules } from "../../module/rules/situational.mjs";

const talent = name => ({ type: "talent", name, system: {}, flags: {} });
const dk = () => talent("Dragon Knight / Драконий Рыцарь");

function flagged(obj) {
  const flags = {};
  obj.flags = flags;
  obj.getFlag = (s, k) => flags[`${s}.${k}`];
  obj.setFlag = async (s, k, v) => { flags[`${s}.${k}`] = v; obj.flags[`${s}.${k}`] = v; };
  obj.unsetFlag = async (s, k) => { delete flags[`${s}.${k}`]; };
  return obj;
}

let mount;
function rider({ items = [dk()], sync = true, survival = 50 } = {}) {
  return flagged({
    id: "r1", uuid: "Actor.rider", name: "Всадник", type: "character", items, isOwner: true,
    system: {
      size: 0, initiative: 5, actionPoints: { value: 2, max: 2 },
      characteristics: { ag: { total: 40 } },
      skills: { survival: { rank: "trained", total: survival } }, groupSkills: { operate: [] }, conditions: {},
      mount: { uuid: "Actor.beast", role: "rider", speed: "half", sync }
    },
    update: async () => {}
  });
}

const realFromUuid = globalThis.fromUuid;
beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
  mount = flagged({
    type: "character", uuid: "Actor.beast", name: "Скакун", items: [], isOwner: true,
    system: { size: 1, initiative: 3, movement: { halfMove: 8 }, wounds: { value: 14, max: 14, critical: 0 } }
  });
  globalThis.fromUuid = async () => mount;
});
afterEach(() => { globalThis.fromUuid = realFromUuid; });

/** Запуск с ответом диалога «Атаки/Избегания». */
async function run(r, mode) {
  const p = dragonKnightTest(r);
  await vi.waitFor(() => expect(captured.press).toBeTypeOf("function")); // сперва грузится скакун
  await captured.press(mode, fakeForm({}));
  return p;
}

describe("Драконий Рыцарь: бонус скакуну", () => {
  it("Survival−10 даёт +3×Успехи на Атаки скакуна, метка стоит на СКАКУНЕ", async () => {
    captured.nextRoll = 5;                       // порог 50−10 = 40 → 4 Успеха
    await run(rider(), "attack");
    const buff = mount.getFlag("warhammer-dbc", DRAGON_KNIGHT_FLAG);
    expect(buff).toMatchObject({ mode: "attack", value: 12 });
    expect(captured.chat.at(-1).content).toContain("+12");
  });

  it("выбор Избеганий", async () => {
    captured.nextRoll = 25;                      // 40−25 → 2 Успеха
    await run(rider(), "evasion");
    expect(mount.getFlag("warhammer-dbc", DRAGON_KNIGHT_FLAG)).toMatchObject({ mode: "evasion", value: 6 });
  });

  it("провал теста — бонуса нет, метки нет", async () => {
    captured.nextRoll = 95;
    await run(rider(), "attack");
    expect(mount.getFlag("warhammer-dbc", DRAGON_KNIGHT_FLAG)).toBeUndefined();
    expect(captured.chat.at(-1).content).toMatch(/Провал/);
  });

  it("не в одну Инициативу (нет «в ритм скакуна», нет Чувства Скакуна) — отказ", async () => {
    captured.nextRoll = 5;
    await dragonKnightTest(rider({ sync: false }));
    expect(captured.dialog).toBeFalsy();
    expect(captured.warnings.join()).toContain("Инициатив");
    expect(mount.getFlag("warhammer-dbc", DRAGON_KNIGHT_FLAG)).toBeUndefined();
  });

  it("с Чувством Скакуна в одну Инициативу и без «в ритм»", async () => {
    captured.nextRoll = 5;
    await run(rider({ items: [dk(), talent("Mount Sense / Чувство Скакуна")], sync: false }), "attack");
    expect(mount.getFlag("warhammer-dbc", DRAGON_KNIGHT_FLAG)).toMatchObject({ value: 12 });
  });

  it("без Таланта — отказ", async () => {
    await dragonKnightTest(rider({ items: [] }));
    expect(captured.dialog).toBeFalsy();
    expect(captured.warnings.length).toBeGreaterThan(0);
  });

  it("в бою тест стоит полудействие (1 ОД); без ОД — отказ без броска", async () => {
    const r = rider();
    const updates = [];
    r.update = async d => { updates.push(d); r.system.actionPoints.value = d["system.actionPoints.value"] ?? r.system.actionPoints.value; };
    globalThis.game.combat = { id: "c1", round: 1, started: true, combatant: { actor: r, actorId: r.id } };
    captured.nextRoll = 5;
    await run(r, "attack");
    expect(updates.some(u => u["system.actionPoints.value"] === 1)).toBe(true);
    r.system.actionPoints.value = 0;
    const before = captured.chat.length;
    mount.flags = {}; await mount.unsetFlag("warhammer-dbc", DRAGON_KNIGHT_FLAG);
    await dragonKnightTest(r);
    expect(captured.chat.length).toBe(before);
  });
});

describe("Драконий Рыцарь: метка помнит бой и Раунд", () => {
  it("тест в бою пишет в метку id боя и Раунд", async () => {
    const r = rider();
    globalThis.game.combat = { id: "c1", round: 2, started: true, combatant: { actor: r, actorId: r.id } };
    captured.nextRoll = 5;
    await run(r, "evasion");
    expect(mount.getFlag("warhammer-dbc", DRAGON_KNIGHT_FLAG)).toMatchObject({ mode: "evasion", value: 12, combatId: "c1", round: 2 });
  });

  // Снимает метку только начало Хода всадника, пока он сидит на этом скакуне: после спешивания или конца
  // боя её некому снять — прибавка переживала бой.
  const stamped = mode => ({ flags: { "warhammer-dbc": { [DRAGON_KNIGHT_FLAG]: { mode, value: 9, combatId: "c1", round: 1 } } },
    getFlag(_s, k) { return this.flags["warhammer-dbc"][k]; }, type: "character", items: [], system: {} });

  it("тот же бой, тот же или следующий Раунд — действует", () => {
    for (const round of [1, 2]) {
      globalThis.game.combat = { id: "c1", round };
      expect(dragonKnightRules(stamped("attack"))).toHaveLength(1);
      expect(dragonKnightEvasionBonus(stamped("evasion"))).toBe(9);
    }
  });

  it("Раунд позже следующего, другой бой или бой кончился — метка устарела", () => {
    for (const combat of [{ id: "c1", round: 3 }, { id: "c2", round: 1 }, undefined]) {
      globalThis.game.combat = combat;
      expect(dragonKnightRules(stamped("attack"))).toEqual([]);
      expect(dragonKnightEvasionBonus(stamped("evasion"))).toBe(0);
    }
  });
});

describe("Драконий Рыцарь: полудействие не ментальное", () => {
  it("в Ярости тест доступен (запрет Ярости — только на ментальные действия)", async () => {
    const r = rider();
    r.system.inRage = true;
    const updates = [];
    r.update = async d => { updates.push(d); };
    globalThis.game.combat = { id: "c1", round: 1, started: true, combatant: { actor: r, actorId: r.id } };
    captured.nextRoll = 5;
    await run(r, "attack");
    expect(updates.some(u => u["system.actionPoints.value"] === 1)).toBe(true);
    expect(mount.getFlag("warhammer-dbc", DRAGON_KNIGHT_FLAG)).toMatchObject({ value: 12 });
  });
});

describe("Драконий Рыцарь: правило и снятие", () => {
  const buffed = (mode, value) => ({ flags: { "warhammer-dbc": { [DRAGON_KNIGHT_FLAG]: { mode, value } } },
    getFlag(_s, k) { return this.flags["warhammer-dbc"][k]; }, type: "character", items: [], system: {} });

  it("Атаки: бонус на тест атаки скакуна, не на Избегание", () => {
    const rules = dragonKnightRules(buffed("attack", 12));
    expect(rules).toHaveLength(1);
    expect(rules[0].effects[0]).toMatchObject({ kind: "rollBonus", value: 12, target: "attack" });
  });
  it("Избегания: бонус на Уклонение и Парирование", () => {
    const rules = dragonKnightRules(buffed("evasion", 6));
    expect(rules[0].effects[0].target).toEqual(["skill:dodge", "skill:parry"]);
  });
  it("без метки — пусто; метка живёт в общем сборе ситуативных правил", () => {
    expect(dragonKnightRules({ items: [], system: {} })).toEqual([]);
    const ids = situationalRules(buffed("attack", 9), { kind: "attack" }).map(r => r.id);
    expect(ids).toContain("situational.dragonKnight");
  });

  it("начало Хода всадника снимает бонус со скакуна", async () => {
    mount.flags = {};
    await mount.setFlag("warhammer-dbc", DRAGON_KNIGHT_FLAG, { mode: "attack", value: 12 });
    await clearDragonKnight(rider());
    expect(mount.getFlag("warhammer-dbc", DRAGON_KNIGHT_FLAG)).toBeUndefined();
  });
});
