// test/combat/attack-dragon-knight-buff.test.mjs
//
// Драконий Рыцарь (Sahara 3-25eb): метка dragonKnightBuff на скакуне, mode:"attack",
// даёт +3×Успехи на ВСЕ Атаки скакуна. resolveTest отдавал её в autoMods, но окно
// атаки пропускало в Порог только команды, Шок и пассажира — порог шёл без бонуса.
// Живой «Бросок!» через captured.press; метка — той же формы, что ставит
// combat/mount.mjs::dragonKnightTest.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { DRAGON_KNIGHT_FLAG } from "../../module/rules/dragon-knight.mjs";

const NS = "warhammer-dbc";
const foe = { id: "foe", uuid: "Actor.foe", name: "Враг", system: {}, items: [], getFlag: () => undefined };

function beast(buff) {
  const claws = weaponFor({ weaponClass: "melee", meleeCategory: "Кулаки", grips: "Кист", damage: "1d5", balance: -1, equipped: true },
    { id: "claws", name: "Claws / Когти", flags: { [`${NS}.integralAttack`]: true } });
  const a = actorFor({ items: [claws], fatigue: { value: 0 }, aiming: "none",
    actionPoints: { value: 4, max: 4 },
    characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35) } });
  a.type = "character"; a.uuid = "Actor.beast"; a.name = "Скакун";
  const store = buff ? { [`${NS}.${DRAGON_KNIGHT_FLAG}`]: buff } : {};
  a.getFlag = (s, k) => store[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete store[`${s}.${k}`]; };
  a.update = async data => {
    for (const [path, value] of Object.entries(data)) {
      const keys = path.split("."); let n = a;
      for (const k of keys.slice(0, -1)) n = (n[k] ??= {});
      n[keys.at(-1)] = value;
    }
  };
  return { a, claws };
}

const form = () => fakeForm({ "#atk-char": "ws", "#atk-modifier": "0", "#atk-aim": "" }, {});
const lastAttack = () => captured.chat.filter(m => /roll-technique-block|roll-threshold/.test(m.content ?? "")).at(-1)?.content ?? "";
const thresholdOf = html => Number(html.match(/<label>Порог<\/label><b>(-?\d+)<\/b>/)?.[1]);

beforeEach(() => {
  resetCaptured(); setTargets([foe]);
  globalThis.game.combat = { started: true, id: "c1", round: 1 };
  globalThis.game.time = { worldTime: 0 };
});
afterEach(() => { globalThis.game.combat = undefined; globalThis.game.messages = undefined; });

async function threshold(buff) {
  resetCaptured(); setTargets([foe]);
  const { a, claws } = beast(buff);
  const p = showAttackDialog(a, claws, {});
  captured.dice = [10, 3, 4, 4, 4];
  await captured.press("roll", form());
  captured.dismiss();
  await p;
  return thresholdOf(lastAttack());
}

const mark = (mode, value) => ({ mode, value, riderUuid: "Actor.rider", combatId: "c1", round: 1 });

describe("Драконий Рыцарь: порог атаки скакуна", () => {
  it("метка на Атаки (+15) поднимает порог на 15", async () => {
    const base = await threshold(null);
    expect(Number.isFinite(base)).toBe(true);
    expect(await threshold(mark("attack", 15))).toBe(base + 15);
  });

  it("метка на Избегания Атаки не усиливает", async () => {
    const base = await threshold(null);
    expect(await threshold(mark("evasion", 15))).toBe(base);
  });

  it("метка прошлого боя порог не меняет", async () => {
    const base = await threshold(null);
    expect(await threshold({ ...mark("attack", 15), combatId: "other" })).toBe(base);
  });
});
