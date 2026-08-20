// test/rules/mount-possession.test.mjs
//
// Одержимость скакунов и байков (корбук стр. 478): таблица Демонических
// Свойств, поправки ритуала и то, какие из выпавших свойств система считает
// сама, а какие остаются столу.

import { describe, it, expect } from "vitest";
import {
  MOUNT_DEMON_TABLE, MOUNT_POSSESSION_COMMON, MOUNT_RITUAL_MODS,
  mountRitualMods, rollMountProperty, possessionFlags
} from "../../module/constants/mount-possession.mjs";
import {
  possessionOf, isPossessed, spliceBonus, mountRangedPenalty, mountSelectiveMod
} from "../../module/rules/mount.mjs";

/** Скакун с записанным результатом осквернения. */
const possessed = flags => ({
  type: "character", items: [],
  system: { movement: { halfMove: 8 } },
  flags: { "warhammer-dbc": { mountPossession: flags } }
});

describe("таблица книги", () => {
  it("четырнадцать строк, сплошной ряд без дыр и нахлёстов", () => {
    expect(MOUNT_DEMON_TABLE).toHaveLength(14);
    for (let i = 1; i < MOUNT_DEMON_TABLE.length; i++) {
      expect(MOUNT_DEMON_TABLE[i].min).toBe(MOUNT_DEMON_TABLE[i - 1].max + 1);
    }
    expect(MOUNT_DEMON_TABLE[0].min).toBe(1);
  });

  it("бросок попадает в строку своего диапазона, а перебор — в последнюю", () => {
    // Свойства без броска: разбор диапазона проверяется через сдвиг adj, а не
    // через случайность — иначе тест зависел бы от Math.random.
    const high = rollMountProperty(500);
    expect(high.name).toBe("Полёт");
    expect(high.total).toBeGreaterThanOrEqual(131);
  });

  it("общих свойств восемь, и все они — про Одержимого", () => {
    expect(MOUNT_POSSESSION_COMMON).toHaveLength(8);
    expect(MOUNT_POSSESSION_COMMON[0]).toMatch(/Daemonic/);
  });
});

describe("поправки ритуала", () => {
  it("сосуд-скакун даёт −10 всегда", () => {
    expect(mountRitualMods("beast").reduce((s, r) => s + r.val, 0)).toBe(MOUNT_RITUAL_MODS.vessel);
  });

  it("демон не зверь — ещё −10", () => {
    expect(mountRitualMods("greater").reduce((s, r) => s + r.val, 0)).toBe(-20);
    expect(mountRitualMods("greaterBeast").reduce((s, r) => s + r.val, 0)).toBe(-10);
  });
});

describe("что система считает сама", () => {
  it("Сращивание превращается в +5×W.b на тесты удержания", () => {
    const flags = possessionFlags([{ flag: "splice" }], 4);
    expect(flags.spliceWb).toBe(4);
    expect(spliceBonus(possessed(flags))).toBe(20);
  });

  it("Стабилизированный снимает штраф стрельбы на любой скорости", () => {
    const mount = possessed(possessionFlags([{ flag: "stabilized" }], 3));
    expect(mountRangedPenalty("run", mount)).toBe(0);
    expect(mountRangedPenalty("run", possessed(possessionFlags([], 3)))).toBe(-30);
  });

  it("Укрытие углубляет штраф Избирательной атаки по всаднику до −30", () => {
    const mount = possessed(possessionFlags([{ flag: "covered" }], 3));
    expect(mountSelectiveMod("rider", mount)).toBe(-30);
    expect(mountSelectiveMod("mount", mount)).toBe(0);
  });

  it("свойства без машинного следа во флаг не попадают", () => {
    const flags = possessionFlags([{ flag: null, name: "Зов" }, { flag: "speed" }], 5);
    expect(flags.speedBonus).toBe(5);
    expect(Object.keys(flags).sort()).toEqual(["demonWb", "speedBonus"]);
  });

  it("необладимый скакун не одержим, и флага у него нет", () => {
    const plain = { type: "character", items: [], system: {} };
    expect(isPossessed(plain)).toBe(false);
    expect(possessionOf(plain)).toBe(null);
    expect(spliceBonus(plain)).toBe(0);
  });
});
