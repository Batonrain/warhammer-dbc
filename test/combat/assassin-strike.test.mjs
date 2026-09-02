// test/combat/assassin-strike.test.mjs
//
// module/combat/assassin-strike.mjs (wdbc-qpcg): владение Талантом + троттлинг
// «раз в Раунд» + сам тест Acrobatics+0 с исходом (свободное Полудвижение +
// disengageActive при успехе).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import {
  hasAssassinStrike, assassinStrikeAvailable, resolveAssassinStrikeClick,
  ASSASSIN_STRIKE_CAPABILITY
} from "../../module/combat/assassin-strike.mjs";

function fakeActor({ hasTalent = true, acrobatics = 40, flags = {}, uuid = "Actor.stub", isOwner = true } = {}) {
  const flagStore = structuredClone(flags);
  return {
    uuid, name: "Ассасин", isOwner,
    system: { skills: { acrobatics: { total: acrobatics } } },
    items: hasTalent ? [{ type: "talent", name: "Assassin Strike / Удар Ассасина" }] : [],
    getFlag: (scope, key) => String(key).split(".").reduce((o, k) => o?.[k], flagStore[scope]),
    setFlag: async (scope, key, value) => {
      flagStore[scope] ??= {};
      const parts = String(key).split(".");
      let node = flagStore[scope];
      for (const k of parts.slice(0, -1)) node = (node[k] ??= {});
      node[parts.at(-1)] = value;
    }
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
});

describe("hasAssassinStrike", () => {
  it("определяет владение по имени Таланта", () => {
    expect(hasAssassinStrike(fakeActor({ hasTalent: true }))).toBe(true);
    expect(hasAssassinStrike(fakeActor({ hasTalent: false }))).toBe(false);
    expect(hasAssassinStrike(null)).toBe(false);
  });
});

describe("assassinStrikeAvailable", () => {
  it("нет Таланта — недоступно", () => {
    expect(assassinStrikeAvailable(fakeActor({ hasTalent: false }))).toBe(false);
  });

  it("есть Талант, раунд не потрачен — доступно", () => {
    expect(assassinStrikeAvailable(fakeActor({ hasTalent: true }))).toBe(true);
  });

  it("уже потрачен в этом Раунде — недоступно", () => {
    globalThis.game.combat = { round: 2 };
    const actor = fakeActor({
      hasTalent: true,
      flags: { "warhammer-dbc": { usageLimits: { [ASSASSIN_STRIKE_CAPABILITY]: { round: 2 } } } }
    });
    expect(assassinStrikeAvailable(actor)).toBe(false);
  });
});

describe("resolveAssassinStrikeClick", () => {
  it("успех (бросок ≤ Acrobatics) — свободное Полудвижение + disengageActive", async () => {
    const actor = fakeActor({ acrobatics: 40 });
    globalThis.fromUuid = async uuid => (uuid === actor.uuid ? actor : null);
    captured.dice = [25];

    const success = await resolveAssassinStrikeClick(actor.uuid);

    expect(success).toBe(true);
    expect(actor.getFlag("warhammer-dbc", "disengageActive")).toBe(true);
    expect(actor.getFlag("warhammer-dbc", "movedThisTurn")).toBe(true);
    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("Успех");
  });

  it("провал (бросок > Acrobatics) — без Полудвижения и без disengageActive", async () => {
    const actor = fakeActor({ acrobatics: 40 });
    globalThis.fromUuid = async uuid => (uuid === actor.uuid ? actor : null);
    captured.dice = [85];

    const success = await resolveAssassinStrikeClick(actor.uuid);

    expect(success).toBe(false);
    expect(actor.getFlag("warhammer-dbc", "disengageActive")).toBeUndefined();
    expect(captured.chat[0].content).toContain("Провал");
  });

  it("отмечает Раунд потраченным независимо от исхода теста", async () => {
    globalThis.game.combat = { round: 3 };
    const actor = fakeActor({ acrobatics: 40 });
    globalThis.fromUuid = async uuid => (uuid === actor.uuid ? actor : null);
    captured.dice = [99];

    await resolveAssassinStrikeClick(actor.uuid);

    expect(actor.getFlag("warhammer-dbc", `usageLimits.${ASSASSIN_STRIKE_CAPABILITY}`)?.round).toBe(3);
  });

  it("уже потрачен в этом Раунде — предупреждает и не бросает заново", async () => {
    globalThis.game.combat = { round: 1 };
    const actor = fakeActor({
      flags: { "warhammer-dbc": { usageLimits: { [ASSASSIN_STRIKE_CAPABILITY]: { round: 1 } } } }
    });
    globalThis.fromUuid = async uuid => (uuid === actor.uuid ? actor : null);

    await resolveAssassinStrikeClick(actor.uuid);

    expect(captured.warnings.some(w => w.includes("уже потрачен"))).toBe(true);
    expect(captured.chat).toHaveLength(0);
  });

  it("нет прав на актора — предупреждает, не тратит Раунд", async () => {
    const actor = fakeActor({ isOwner: false });
    globalThis.fromUuid = async uuid => (uuid === actor.uuid ? actor : null);

    await resolveAssassinStrikeClick(actor.uuid);

    expect(captured.warnings.some(w => w.includes("Нет прав"))).toBe(true);
    expect(captured.chat).toHaveLength(0);
  });
});
