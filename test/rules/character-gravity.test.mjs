// test/rules/character-gravity.test.mjs
//
// rules/character.mjs: вес снаряжения ×G сцены (стр. 483-484). Прежний
// `Number(g) || 1` превращал честные 0 G в 1 G, и в невесомости эффективный
// вес оставался полным (книга: в невесомости ограничений на ношение тяжестей
// нет, кроме разгрузки и здравого смысла). Тест гоняет настоящий
// prepareCharacterDerived (через prepareDerivedData актора), сцену подсовывает
// токен актора — тот же путь, что берёт код (`actor.token.parent`).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function sceneWith(env) {
  return {
    id: "scene-g",
    getFlag: (scope, key) => (scope === "warhammer-dbc" && key === "env" ? env : undefined)
  };
}

function derivedOn(env) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  const crate = { id: "i1", type: "gear", name: "Ящик", system: { weight: 10, quantity: 2, stored: false } };
  const list = [crate];
  list.get = () => null;
  const actor = {
    type: "character", name: "Подставной", system, items: list, getFlag: () => undefined,
    token: env === undefined ? undefined : { parent: sceneWith(env) }
  };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system.encumbrance;
}

describe("гравитация сцены и вес снаряжения (0-g-1-g-rules-character-mjs-992)", () => {
  it("1 G — вес как есть", () => {
    const enc = derivedOn({ gravity: 1 });
    expect(enc.current).toBe(20);
    expect(enc.gravity).toBe(1);
    expect(enc.effectiveCurrent).toBe(20);
  });

  it("0 G — гравитация остаётся нулём, эффективный вес 0, а не полный", () => {
    const enc = derivedOn({ gravity: 0 });
    expect(enc.current).toBe(20);       // голый вес в сумке не меняется
    expect(enc.gravity).toBe(0);
    expect(enc.effectiveCurrent).toBe(0);
  });

  it("2.5 G — вес растёт кратно", () => {
    const enc = derivedOn({ gravity: 2.5 });
    expect(enc.gravity).toBe(2.5);
    expect(enc.effectiveCurrent).toBe(50);
  });

  it("сцена без записанной гравитации — по умолчанию 1 G", () => {
    const enc = derivedOn({ weather: "clear" });
    expect(enc.gravity).toBe(1);
    expect(enc.effectiveCurrent).toBe(20);
  });
});
