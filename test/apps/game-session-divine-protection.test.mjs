// test/apps/game-session-divine-protection.test.mjs
//
// Божественная Защита (rules/death-save.mjs) на кнопках Календаря:
//  • «⏻ Конец сессии» — это и конец сцены: персонаж сперва просыпается
//    (wakeDivineProtected ищет именно флаг Защиты), потом флаг снимается.
//    Раньше флаг снимался первым, и «Без сознания» оставалась навсегда.
//  • Несвязанные токены (actorLink:false) — их синтетических акторов в
//    game.actors нет; обход — migrations/unlinked-tokens.mjs::unlinkedTokens.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { triggerNewScene, triggerSessionEnd } from "../../module/apps/game-session.mjs";

/** Защищённый и без сознания — как после успешной Божественной Защиты. */
function protectedActor() {
  const flags = { "warhammer-dbc.divineProtection": true };
  return {
    type: "character", items: [], system: { conditions: { unconscious: true } },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async setFlag(scope, key, value) { flags[`${scope}.${key}`] = value; },
    async unsetFlag(scope, key) { delete flags[`${scope}.${key}`]; },
    async update(data) {
      for (const [path, v] of Object.entries(data)) {
        if (path.startsWith("system.conditions.")) this.system.conditions[path.slice(18)] = v;
      }
    }
  };
}

/** Сцена с одним несвязанным токеном. */
function sceneWithUnlinked(actor) {
  return { tokens: { contents: [{ actorLink: false, actor }] } };
}

let saved;
beforeEach(() => {
  saved = { actors: game.actors, scenes: game.scenes, user: game.user };
  game.user = { isGM: true };
});
afterEach(() => {
  game.actors = saved.actors; game.scenes = saved.scenes; game.user = saved.user;
});

describe("⏻ Конец сессии — Божественная Защита", () => {
  it("будит персонажа и снимает Защиту", async () => {
    const actor = protectedActor();
    game.actors = [actor];
    game.scenes = [];
    await triggerSessionEnd();
    expect(actor.system.conditions.unconscious).toBe(false);
    expect(actor.getFlag("warhammer-dbc", "divineProtection")).toBeUndefined();
  });

  it("несвязанный токен: тоже будит и снимает", async () => {
    const actor = protectedActor();
    game.actors = [];
    game.scenes = [sceneWithUnlinked(actor)];
    await triggerSessionEnd();
    expect(actor.system.conditions.unconscious).toBe(false);
    expect(actor.getFlag("warhammer-dbc", "divineProtection")).toBeUndefined();
  });
});

describe("🎬 Новая сцена — Божественная Защита", () => {
  it("несвязанный токен просыпается, Защита остаётся до конца сессии", async () => {
    const actor = protectedActor();
    game.actors = [];
    game.scenes = [sceneWithUnlinked(actor)];
    await triggerNewScene();
    expect(actor.system.conditions.unconscious).toBe(false);
    expect(actor.getFlag("warhammer-dbc", "divineProtection")).toBe(true);
  });
});
