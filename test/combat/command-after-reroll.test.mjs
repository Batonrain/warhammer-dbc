// test/combat/command-after-reroll.test.mjs
//
// dbc-131: блок «Командование после атаки» (метка Концентрации огня, Синхронный
// Натиск, счётчик Залпового Огня — combat/command-state.mjs::afterSubordinateAttack)
// закрывался только !forcedRoll. Переброс за Очко Судьбы / Огневую Точку /
// Мастера Клинка идёт с skipAmmo без forcedRoll — и засчитывал атаку подчинённого второй раз.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";

const after = vi.fn(async () => {});
vi.mock("../../module/combat/command-state.mjs", async (orig) => ({ ...(await orig()), afterSubordinateAttack: (...a) => after(...a) }));

const { _executeAttackRoll } = await import("../../module/combat/attack.mjs");

const shoot = async (over = {}) => {
  const a = actorFor({ items: [], characteristics: { ws: char(45), bs: char(60), s: char(40), t: char(40), ag: char(35) } });
  captured.dice = [10, 5, 5, 5, 5, 5];
  await _executeAttackRoll(a, weaponFor({ damage: "1d10", penetration: 4 }, { name: "Винтовка" }), "bs", 60, "single", null, over);
};

describe("Командование после атаки — только у новой атаки", () => {
  beforeEach(() => { resetCaptured(); setTargets([]); after.mockClear(); });
  it("обычная атака — засчитывается", async () => {
    await shoot();
    expect(after).toHaveBeenCalledTimes(1);
  });
  it("переброс за Очко Судьбы (skipAmmo без forcedRoll) — второй раз не считается", async () => {
    await shoot({ skipAmmo: true });
    expect(after).not.toHaveBeenCalled();
  });
  it("переигровка (forcedRoll) — тоже нет", async () => {
    await shoot({ forcedRoll: 20, skipAmmo: true });
    expect(after).not.toHaveBeenCalled();
  });
});
