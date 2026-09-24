// test/combat/legacy-weapon-killer.test.mjs
//
// clearLegacyKillerBuffs (module/combat/legacy-weapon-killer.mjs) — Убийца/
// fearsome 9-9 (wdbc-1rno.35, стр. 427): временный Felling, включённый
// module/apps/legacy-weapon.mjs::activateKillerLegacyFelling, откатывается
// «до конца боя» тем же приёмом, что Reformation Song.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { clearLegacyKillerBuffs } from "../../module/combat/legacy-weapon-killer.mjs";

function weaponWithRevert(props, revert) {
  const flags = {};
  if (revert !== undefined) flags["warhammer-dbc.legacyKillerFellingRevert"] = revert;
  return {
    id: "w1", type: "weapon", system: { weaponProps: props },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async update(data) { if (data["system.weaponProps"]) this.system.weaponProps = data["system.weaponProps"]; },
    async unsetFlag(scope, key) { delete flags[`${scope}.${key}`]; }
  };
}

function combatantWith(items) {
  return { actor: { items } };
}

describe("clearLegacyKillerBuffs", () => {
  it("originalRating null (Felling был добавлен) — снимает Felling целиком", async () => {
    const w = weaponWithRevert([{ key: "felling", rating: 5 }], { originalRating: null });
    await clearLegacyKillerBuffs({ combatants: [combatantWith([w])] });
    expect(w.system.weaponProps).toEqual([]);
    expect(w.getFlag("warhammer-dbc", "legacyKillerFellingRevert")).toBeUndefined();
  });

  it("originalRating 3 (Felling уже был) — возвращает рейтинг к 3", async () => {
    const w = weaponWithRevert([{ key: "felling", rating: 6 }], { originalRating: 3 });
    await clearLegacyKillerBuffs({ combatants: [combatantWith([w])] });
    expect(w.system.weaponProps).toEqual([{ key: "felling", rating: 3 }]);
  });

  it("нет ревёрт-флага — оружие не трогает", async () => {
    const w = weaponWithRevert([{ key: "tearing" }]);
    await clearLegacyKillerBuffs({ combatants: [combatantWith([w])] });
    expect(w.system.weaponProps).toEqual([{ key: "tearing" }]);
  });

  it("нет combat/комбатантов — не падает", async () => {
    await expect(clearLegacyKillerBuffs(null)).resolves.toBeUndefined();
  });
});

// wdbc-t3c3t.4: книга (стр. 427) — «до конца боя ИЛИ СЦЕНЫ». Активация вне боя
// (или актором не из трекера) по концу боя не откатывалась никогда — Felling
// оставался на оружии навсегда. Конец сцены — кнопки «🎬 Сцена»/«⏻ Сессия».
describe("Убийца — откат по концу сцены (wdbc-t3c3t.4)", () => {
  it("triggerNewScene снимает Felling Убийцы у всех акторов мира", async () => {
    const { triggerNewScene } = await import("../../module/apps/game-session.mjs");
    const w = weaponWithRevert([{ key: "felling", rating: 4 }], { originalRating: null });
    const prev = { actors: game.actors, user: game.user };
    game.actors = [{ items: [w], getFlag: () => undefined }];
    game.user = { isGM: true };
    try {
      await triggerNewScene();
    } finally {
      game.actors = prev.actors;
      game.user = prev.user;
    }
    expect(w.system.weaponProps).toEqual([]);
    expect(w.getFlag("warhammer-dbc", "legacyKillerFellingRevert")).toBeUndefined();
  });
});
