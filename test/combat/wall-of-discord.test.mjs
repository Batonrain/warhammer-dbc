// test/combat/wall-of-discord.test.mjs
//
// Стена Диссонанса (Талант Шумового Десантника, Sahara 1-54b9): за полудействие и Очко Бесчестия враги
// в радиусе Cor.b×2 м проходят S−30; провал — Ничком и отброс на Cor.b×3 м. Размер 2+ неуязвим, летящие
// проваливают сами, союзников стена не трогает.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyWallOfDiscord } from "../../module/combat/noise-marine.mjs";

const grid = { size: 100, distance: 2 };

function body({ name, size = 0, altitude = "landed", sTotal = 40, fate = 2, cor = 3, uuid }) {
  const store = {};
  const a = {
    id: uuid.replace("Actor.", ""), name, uuid, type: "character", items: [], effects: [],
    system: {
      size, characteristics: { s: { total: sTotal, bonus: Math.floor(sTotal / 10) } },
      corruption: { value: cor * 10 }, corruptionBonus: cor, fate: { value: fate, max: 5 },
      movement: { altitude }, conditions: {}, actionPoints: { value: 2, max: 2 }
    },
    getFlag: (scope, key) => store[`${scope}.${key}`],
    async update(data) {
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split(".").slice(1);
        let node = this.system;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    }
  };
  return a;
}

function tokenOf(id, actor, x, disposition) {
  return { id, uuid: `Scene.s.Token.${id}`, x, y: 0, width: 1, height: 1, hidden: false, actor, disposition,
    elevation: 0, moves: [], async update(d, o) { this.moves.push([d, o]); Object.assign(this, d); } };
}

const realGetProperty = globalThis.foundry.utils.getProperty;
beforeEach(() => {
  resetCaptured();
  globalThis.foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);
});
afterEach(() => {
  globalThis.foundry.utils.getProperty = realGetProperty;
  globalThis.game.combat = undefined; delete globalThis.fromUuid;
});

describe("Стена Диссонанса", () => {
  it("враги в радиусе падают и отлетают; великан, летун-мимо-радиуса и союзник — по правилам", async () => {
    const caster = body({ name: "Шумовой", uuid: "Actor.caster" });
    const small = body({ name: "Малыш", uuid: "Actor.small" });
    const giant = body({ name: "Великан", size: 2, uuid: "Actor.giant" });
    const flyer = body({ name: "Летун", altitude: "low", uuid: "Actor.flyer" });
    const ally = body({ name: "Союзник", uuid: "Actor.ally" });
    const farEnemy = body({ name: "Дальний", uuid: "Actor.far" });
    const casterToken = tokenOf("c", caster, 0, 1);
    const tokens = [casterToken,
      tokenOf("small", small, 200, -1), tokenOf("giant", giant, 200, -1), tokenOf("flyer", flyer, 200, -1),
      tokenOf("ally", ally, 200, 1), tokenOf("far", farEnemy, 2000, -1)];
    const scene = { grid, tokens: { contents: tokens } };
    tokens.forEach(t => { t.parent = scene; });
    const byUuid = Object.fromEntries(tokens.map(t => [t.uuid, t]));
    globalThis.fromUuid = async uuid => byUuid[uuid] ?? null;

    captured.dice = [95];   // единственный бросок S−30 — у Малыша; Великан неуязвим, Летун проваливает сам
    await applyWallOfDiscord(caster, casterToken);

    expect(caster.system.fate.value).toBe(1);
    expect(small.system.conditions.prone).toBe(true);
    expect(flyer.system.conditions.prone).toBe(true);
    expect(giant.system.conditions.prone).toBeUndefined();
    expect(ally.system.conditions.prone).toBeUndefined();
    expect(farEnemy.system.conditions.prone).toBeUndefined();

    // Отброс Cor.b×3 = 9 м = 450 px по прямой от носителя.
    const smallToken = byUuid["Scene.s.Token.small"];
    expect(smallToken.moves).toEqual([[{ x: 650, y: 0 }, { animate: false }]]);
    expect(byUuid["Scene.s.Token.giant"].moves).toHaveLength(0);
    expect(byUuid["Scene.s.Token.ally"].moves).toHaveLength(0);
    expect(captured.chat.at(-1).content).toContain("Стена Диссонанса");
    expect(captured.chat.at(-1).content).toContain("нет опоры");
  });

  it("удавшийся тест S−30: стоит на месте", async () => {
    const caster = body({ name: "Шумовой", uuid: "Actor.caster" });
    const sturdy = body({ name: "Крепыш", sTotal: 90, uuid: "Actor.sturdy" });
    const casterToken = tokenOf("c", caster, 0, 1);
    const tokens = [casterToken, tokenOf("sturdy", sturdy, 200, -1)];
    const scene = { grid, tokens: { contents: tokens } };
    tokens.forEach(t => { t.parent = scene; });
    globalThis.fromUuid = async uuid => tokens.find(t => t.uuid === uuid) ?? null;

    captured.dice = [5];
    await applyWallOfDiscord(caster, casterToken);
    expect(sturdy.system.conditions.prone).toBeUndefined();
    expect(tokens[1].moves).toHaveLength(0);
  });

  it("при Cor 66+ неуязвим только Размер 3+", async () => {
    const caster = body({ name: "Шумовой", uuid: "Actor.caster", cor: 7 });
    const big = body({ name: "Здоровяк", size: 2, uuid: "Actor.big" });
    const huge = body({ name: "Громада", size: 3, uuid: "Actor.huge" });
    const casterToken = tokenOf("c", caster, 0, 1);
    const tokens = [casterToken, tokenOf("big", big, 200, -1), tokenOf("huge", huge, 200, -1)];
    const scene = { grid, tokens: { contents: tokens } };
    tokens.forEach(t => { t.parent = scene; });
    globalThis.fromUuid = async uuid => tokens.find(t => t.uuid === uuid) ?? null;

    captured.dice = [95];
    await applyWallOfDiscord(caster, casterToken);
    expect(big.system.conditions.prone).toBe(true);
    expect(huge.system.conditions.prone).toBeUndefined();
  });

  it("нет Очка Бесчестия — стена не выпускается", async () => {
    const caster = body({ name: "Шумовой", uuid: "Actor.caster", fate: 0 });
    const victim = body({ name: "Жертва", uuid: "Actor.v" });
    const casterToken = tokenOf("c", caster, 0, 1);
    const tokens = [casterToken, tokenOf("v", victim, 200, -1)];
    const scene = { grid, tokens: { contents: tokens } };
    tokens.forEach(t => { t.parent = scene; });
    await applyWallOfDiscord(caster, casterToken);
    expect(victim.system.conditions.prone).toBeUndefined();
  });
});
