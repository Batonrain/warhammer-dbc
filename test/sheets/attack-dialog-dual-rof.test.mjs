// test/sheets/attack-dialog-dual-rof.test.mjs
//
// Sahara task-f67c: «Обе руки» — порог второй руки брал бонус режима огня ОСНОВНОГО оружия
// (thresholdOf(f) несёт f.rofBonus), а свой не получал. Теперь вторая рука берёт бонус СВОЕГО режима
// (Одиночный +10 / Короткая 0 / Длинная −10) плюс свои rof*AttackMod (Целеуказатель) и ничего не наследует
// от режима огня основной руки.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

const TWO_WEAPON = {
  id: "t-two", name: "Два оружия", type: "talent", system: {}, getFlag: () => undefined,
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: "dualWield.core.twoWeaponWielder", label: "" }] }] } }
};

const pistol = (id, extra = {}) => weaponFor(
  { weaponClass: "pistol", equipped: true, weaponType: "", rof_single: 1, rof_semi: 3, rof_full: 0,
    magazineCur: 10, magazineMax: 10, ...extra }, { id, name: id });

const designator = (weaponId, effects) => ({
  id: `mod-${weaponId}`, type: "weaponMod", name: "Целеуказатель",
  system: { installedOn: weaponId, effects: { ...effects } }
});

function shooter(items) {
  const a = actorFor({ items: [...items, TWO_WEAPON], fatigue: { value: 0 }, aiming: "none",
    actionPoints: { value: 4, max: 4 } });
  a.type = "character";
  a.uuid = "Actor.A1"; a.name = "Стрелок";
  const flags = {};
  a.getFlag = (s, k) => flags[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { flags[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete flags[`${s}.${k}`]; };
  a.update = async () => {};
  return a;
}

const thresholds = () => captured.chat
  .map(m => (m.content ?? "").match(/<label>Порог<\/label><b>(-?\d+)<\/b>/)?.[1])
  .filter(Boolean).map(Number);

/** Бросить пару: основная в режиме mainRof (с бонусом mainBonus), вторая — offRof. Вернуть [основная, вторая]. */
async function pair(main, off, items, { mainRof, mainBonus, offRof }) {
  const a = shooter(items);
  const p = showAttackDialog(a, main);
  captured.dice = [10, 3, 4, 4, 10, 3, 4, 4, 4, 4, 4, 4];
  await captured.press("roll", fakeForm({
    "#atk-char": "bs", "#atk-modifier": "0", "#atk-aim": "",
    "input[name='atk-rof']:checked": { value: mainRof, dataset: { bonus: String(mainBonus) } },
    "#atk-dual-wield": true, "#atk-off-hand": off.id, "#atk-off-rof": offRof
  }));
  await p;
  return thresholds();
}

beforeEach(() => { resetCaptured(); setTargets([]); globalThis.game.combat = undefined; });

describe("«Обе руки»: список режимов второй руки", () => {
  it("оружие без одиночного режима (rof_single 0) не предлагает «Одиночный» — +10 ему не положен", () => {
    const main = pistol("main"), off = pistol("off", { rof_single: 0, rof_semi: 3 });
    showAttackDialog(shooter([main, off]), main);
    const opts = captured.dialog.content.match(/id="atk-off-hand"[\s\S]*?<\/select>/)?.[0] ?? "";
    expect(opts).toContain("semi");
    expect(opts).not.toContain("single");
  });
});

describe("«Обе руки»: бонус режима огня второй руки — её собственный", () => {
  it("базовый случай: у второй руки Одиночный +10, режим основной (Короткая 0) не переносится", async () => {
    const main = pistol("main"), off = pistol("off");
    const [m, o] = await pair(main, off, [main, off], { mainRof: "semi", mainBonus: 0, offRof: "single" });
    // BS 45 − 20 пара (+ режим) ; вторая ещё −20 неосновная рука
    expect(m).toBe(45 - 20 + 0);
    expect(o).toBe(45 - 20 - 20 + 10);
  });

  it("Целеуказатель только на основном: его +5 короткой очереди не достаётся второй руке (Одиночный)", async () => {
    const main = pistol("main"), off = pistol("off");
    const mod = designator("main", { rofSemiAttackMod: 5 });
    const [m, o] = await pair(main, off, [main, off, mod], { mainRof: "semi", mainBonus: 5, offRof: "single" });
    expect(m).toBe(45 - 20 + 5);
    expect(o).toBe(45 - 20 - 20 + 10);           // не +15
  });

  it("основной Одиночный (+10), вторая Короткая: +10 основной руки не уходит во вторую", async () => {
    const main = pistol("main"), off = pistol("off");
    const [m, o] = await pair(main, off, [main, off], { mainRof: "single", mainBonus: 10, offRof: "semi" });
    expect(m).toBe(45 - 20 + 10);
    expect(o).toBe(45 - 20 - 20 + 0);            // Короткая даёт 0, а не +10
  });

  it("Целеуказатель только на второй руке: её +5 короткой очереди учитывается", async () => {
    const main = pistol("main"), off = pistol("off");
    const mod = designator("off", { rofSemiAttackMod: 5 });
    const [m, o] = await pair(main, off, [main, off, mod], { mainRof: "single", mainBonus: 10, offRof: "semi" });
    expect(m).toBe(45 - 20 + 10);
    expect(o).toBe(45 - 20 - 20 + 0 + 5);
  });

  it("Целеуказатель второй руки действует на её Одиночный через rofSingleAttackMod", async () => {
    const main = pistol("main"), off = pistol("off");
    const mod = designator("off", { rofSingleAttackMod: 5 });
    const [, o] = await pair(main, off, [main, off, mod], { mainRof: "semi", mainBonus: 0, offRof: "single" });
    expect(o).toBe(45 - 20 - 20 + 10 + 5);
  });

  it("рукопашная вторая рука (режим «melee», бонус 0) не наследует +10 основного выстрела", async () => {
    const main = pistol("main");
    const sword = weaponFor({ weaponClass: "melee", equipped: true, weaponType: "", rof_single: 0, rof_semi: 0, rof_full: 0,
      meleeCategory: "Меч" }, { id: "sword", name: "sword" });
    const a = shooter([main, sword]);
    const p = showAttackDialog(a, main);
    captured.dice = [10, 3, 4, 4, 10, 3, 4, 4, 4, 4, 4, 4];
    await captured.press("roll", fakeForm({
      "#atk-char": "bs", "#atk-modifier": "0", "#atk-aim": "",
      "input[name='atk-rof']:checked": { value: "single", dataset: { bonus: "10" } },
      "#atk-dual-wield": true, "#atk-off-hand": "sword", "#atk-off-rof": ""
    }));
    await p;
    const [m, o] = thresholds();
    expect(m).toBe(45 - 20 + 10);
    expect(o).toBe(45 - 20 - 20);                // WS 45 тот же; режим «melee» = 0
  });
});
