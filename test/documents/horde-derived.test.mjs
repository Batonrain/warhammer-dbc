// test/documents/horde-derived.test.mjs
//
// Расчёт листа Орды: Навыки и Броня.
//
// Навыки считаются как у существ — характеристика навыка плюс надбавка ранга, —
// но покупки за опыт у Орды нет: ранг ставит ГМ прямо на листе, поэтому в схеме
// только rank и выведенный total. Броню Орде надевают предметами: все попадания
// идут в торс, поэтому в поглощение уходит AP тела лучшего надетого предмета.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../../module/constants/skills.mjs";

/** Орда со схемой по умолчанию: расчёт листа без живого документа Foundry. */
function hordeWith(patch = {}, itemList = []) {
  const system = new ACTOR_DATA_MODELS.horde({}).toObject();
  // Патч вида { absorption: 4, characteristics: { ag: {...} } }: вложенное
  // раскладывается по полям вручную, чтобы не затереть остальные записи группы.
  for (const [group, entries] of Object.entries(patch)) {
    if (entries === null || typeof entries !== "object") { system[group] = entries; continue; }
    for (const [key, value] of Object.entries(entries))
      Object.assign(system[group][key], value);
  }
  const items = Object.assign([...itemList], { get: () => null });
  // Через прототип: расчёт Орды вынесен в метод (_prepareHordeData), и голый
  // объект-заглушка до него не дотянулся бы.
  const actorLike = Object.assign(Object.create(WarhammerActor.prototype),
    { type: "horde", name: "Подставная орда", system, items, getFlag: () => undefined });
  actorLike.prepareDerivedData();
  return system;
}

describe("Навыки Орды", () => {
  it("значение навыка = характеристика + надбавка ранга", () => {
    const system = hordeWith({
      characteristics: { ag: { base: 30, advance: 5 }, per: { base: 40, advance: 0 } },
      skills: { dodge: { rank: "trained" }, awareness: { rank: "veteran" } }
    });
    expect(system.skills.dodge.total).toBe(35 + 10);      // Уклонение — по Ag
    expect(system.skills.awareness.total).toBe(40 + 20);  // Бдительность — по Per
  });

  it("нетренированный навык идёт с −20 от характеристики", () => {
    const system = hordeWith({ characteristics: { ag: { base: 30, advance: 0 } } });
    expect(system.skills.dodge.rank).toBe("untrained");
    expect(system.skills.dodge.total).toBe(30 - 20);
  });

  it("в схеме есть все навыки, а не выборочные", () => {
    const system = hordeWith();
    expect(Object.keys(system.skills).sort()).toEqual(Object.keys(SKILLS_DEF).sort());
  });
});

// ── Групповые навыки ─────────────────────────────────────────────────────────
// Управление, Навигация, Знания, Лингвистика, Ремесло: у толпы они такие же,
// как у одиночки, — записями со специализацией.
describe("Групповые навыки Орды", () => {
  it("значение записи = характеристика группы + надбавка ранга", () => {
    const system = hordeWith({
      characteristics: { int: { base: 30, advance: 0 } },
      groupSkills: { commonLore: [{ specialty: "Империум", rank: "trained" }] }
    });
    expect(system.groupSkills.commonLore[0].total).toBe(30 + 10);
  });

  it("своя характеристика записи важнее характеристики группы", () => {
    const system = hordeWith({
      characteristics: { int: { base: 30 }, s: { base: 50 } },
      // Ремесло разрешает выбрать характеристику каждой специализации.
      groupSkills: { trade: [{ specialty: "Кузнец", rank: "knows", char: "s" }] }
    });
    expect(system.groupSkills.trade[0].total).toBe(50 + 0);
  });

  it("в схеме заведены все группы, пустыми списками", () => {
    const system = hordeWith();
    expect(Object.keys(system.groupSkills).sort()).toEqual(Object.keys(GROUP_SKILLS_DEF).sort());
    expect(Object.values(system.groupSkills).every(v => Array.isArray(v) && !v.length)).toBe(true);
  });
});

// ── Броня ────────────────────────────────────────────────────────────────────
// Орду одевают предметами брони: все попадания идут в торс, поэтому считается
// AP тела, и по лучшему предмету, а не суммой слоёв.
const armour = (body, equipped = true) => ({ type: "armor", system: { body, equipped } });

describe("Броня Орды", () => {
  it("надетая броня добавляет AP тела к своему поглощению орды", () => {
    const system = hordeWith({ absorption: 4 }, [armour(6)]);
    expect(system.derived.armourAP).toBe(6);
    expect(system.derived.absorptionTotal).toBe(10);   // 4 своих + 6 брони
  });

  it("слои брони не складываются — берётся лучший предмет", () => {
    const system = hordeWith({}, [armour(3), armour(7), armour(5)]);
    expect(system.derived.armourAP).toBe(7);
  });

  it("снятая броня не считается", () => {
    const system = hordeWith({}, [armour(8, false)]);
    expect(system.derived.armourAP).toBe(0);
    expect(system.derived.absorptionTotal).toBe(0);
  });
});
