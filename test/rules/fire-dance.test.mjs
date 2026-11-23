// Танец Пламени и Лабиринт Пламени (Разобрать 1a371).
import { describe, it, expect } from "vitest";
import { fireDanceActive, fireDancePanicMod, hasFireMaze, FIRE_DANCE_BURN_MOD } from "../../module/rules/fire-dance.mjs";
import { buildTargetEffectButtons } from "../../module/combat/weapon-properties.mjs";
import { pickFireMazeRounds } from "../../module/combat/fire-maze.mjs";

const talent = name => ({ type: "talent", name, system: {} });
const actorWith = (...names) => ({ items: names.map(talent), getFlag: () => undefined });
const flameProp = { rating: 0, def: { key: "flame", label: "Огонь", auto: { targetEffect: { condition: "burning", testChar: "ag", testMod: 0 } } } };

describe("Танец Пламени", () => {
  it("нужен Талант и шаблон огнемёта (Spray + Flame)", () => {
    const a = actorWith("Fire Dance / Танец Пламени");
    expect(fireDanceActive(a, { spray: true, flame: true })).toBe(true);
    expect(fireDanceActive(a, { spray: false, flame: true })).toBe(false);
    expect(fireDanceActive(actorWith("Pyromaniac"), { spray: true, flame: true })).toBe(false);
  });
  it("вторая кнопка Горения с −20 и меткой Танца", () => {
    const html = buildTargetEffectButtons([flameProp], { hit: true, fireDance: true });
    expect(html.match(/wh-wprop-apply-btn/g)).toHaveLength(2);
    expect(html).toContain(`data-wp-test-mod="${FIRE_DANCE_BURN_MOD}" `);
    expect(html).toContain('data-wp-fire-dance="1"');
    expect(buildTargetEffectButtons([flameProp], { hit: true }).match(/wh-wprop-apply-btn/g)).toHaveLength(1);
  });
  it("метка цели даёт −40 к Панике", () => {
    expect(fireDancePanicMod({ getFlag: (ns, k) => k === "fireDancePanic" })).toBe(-40);
    expect(fireDancePanicMod({ getFlag: () => undefined })).toBe(0);
  });
});

describe("Лабиринт Пламени", () => {
  it("Талант распознаётся; без окна берётся больший бросок", async () => {
    expect(hasFireMaze(actorWith("Fire Maze / Лабиринт Пламени"))).toBe(true);
    expect(hasFireMaze(actorWith("Fire Dance"))).toBe(false);
    expect(await pickFireMazeRounds(2, 5)).toBe(5);
  });
});
