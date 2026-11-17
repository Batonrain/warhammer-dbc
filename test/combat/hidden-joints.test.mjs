// test/combat/hidden-joints.test.mjs
//
// Скрытые Сочленения (core.json, «Броня», раздел «Скрытые Сочленения»,
// wdbc-x1nz.4): карточка атаки по Сочленению/Шее несёт кнопку компенсации
// (Common Lore(War)+0, «определить сочленения по памяти»), когда у цели на
// голове одновременно надеты Мягкая и Жёсткая броня (hasHiddenJoints,
// combat/armor-properties.mjs). Клик — тот же приём, что Горжет/сдвиг места
// попадания: переигровка ТОЙ ЖЕ карточки (forcedRoll) с порогом выше на 10
// на успех.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { resolveHiddenJointsClick } from "../../module/combat/hidden-joints.mjs";

const NS = "warhammer-dbc";
const card = () => captured.chat.at(-1)?.content ?? "";
const atkFlags = () => captured.chat.at(-1)?.flags?.[NS]?.attack;

function armorItem(props, head) {
  return { type: "armor", system: { equipped: true, head, properties: props } };
}

function targetWith(items = []) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  return { id: "target-1", uuid: "Actor.target", type: "character", name: "Цель", system: {}, items: list };
}

function shooter({ lore = 50 } = {}) {
  const a = actorFor({
    items: [],
    characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35), int: char(40) },
    groupSkills: { commonLore: [{ specialty: "War", specKey: "war", rank: "trained", total: lore }] }
  });
  a.uuid = "Actor.shooter"; a.isOwner = true;
  a.getFlag = () => undefined;
  a.setFlag = async () => {};
  return a;
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("кнопка на карточке атаки", () => {
  it("Мягкая+Жёсткая на голове цели, прицел в Сочленение — кнопка есть", async () => {
    setTargets([targetWith([armorItem(["soft"], 2), armorItem(["hard"], 5)])]);
    const gun = weaponFor({ damage: "1d10", penetration: 4 });
    captured.dice = [55, 3];
    await _executeAttackRoll(shooter(), gun, "bs", 50, "single", { value: "joint", label: "Шея" }, {});
    expect(card()).toContain("wh-hidden-joints-btn");
  });

  it("только Мягкая (без Жёсткой) — кнопки нет", async () => {
    setTargets([targetWith([armorItem(["soft"], 2)])]);
    const gun = weaponFor({ damage: "1d10", penetration: 4 });
    captured.dice = [55, 3];
    await _executeAttackRoll(shooter(), gun, "bs", 50, "single", { value: "joint", label: "Шея" }, {});
    expect(card()).not.toContain("wh-hidden-joints-btn");
  });

  it("обе есть, но прицел не в Сочленение — кнопки нет", async () => {
    setTargets([targetWith([armorItem(["soft"], 2), armorItem(["hard"], 5)])]);
    const gun = weaponFor({ damage: "1d10", penetration: 4 });
    captured.dice = [20, 3];
    await _executeAttackRoll(shooter(), gun, "bs", 50, "single", { value: "head", label: "Голова" }, {});
    expect(card()).not.toContain("wh-hidden-joints-btn");
  });

  it("рукопашная (aimTarget null) — кнопки нет, даже если бы цель её поддерживала", async () => {
    setTargets([targetWith([armorItem(["soft"], 2), armorItem(["hard"], 5)])]);
    const gun = weaponFor({ damage: "1d10", penetration: 4 });
    captured.dice = [20, 3];
    await _executeAttackRoll(shooter(), gun, "bs", 50, "single", null, {});
    expect(card()).not.toContain("wh-hidden-joints-btn");
  });
});

describe("клик «определить по памяти» — Common Lore(War)+0", () => {
  it("успех: порог теста = Common Lore(War), без штрафа/бонуса", async () => {
    const a = shooter({ lore: 50 });
    captured.dice = [30]; // 30 ≤ 50 — успех
    const { success, roll, threshold } = await resolveHiddenJointsClick(a);
    expect(success).toBe(true);
    expect(roll).toBe(30);
    expect(threshold).toBe(50);
    expect(card()).toContain("Скрытые Сочленения");
    expect(card()).toContain("Common Lore (War)+0");
  });

  it("нетренированный — порог Int−20", async () => {
    const a = shooter({ lore: 50 });
    a.system.groupSkills = {}; // нет записи специализации Common Lore (War)
    captured.dice = [15];
    const { threshold } = await resolveHiddenJointsClick(a);
    expect(threshold).toBe(20); // Int 40 − 20
  });

  it("провал", async () => {
    const a = shooter({ lore: 50 });
    captured.dice = [90];
    const { success, deg } = await resolveHiddenJointsClick(a);
    expect(success).toBe(false);
    expect(deg).toBeGreaterThan(0);
  });
});

describe("переигровка карточки с компенсацией (тот же приём, что Горжет)", () => {
  async function attackJointJustMisses() {
    setTargets([targetWith([armorItem(["soft"], 2), armorItem(["hard"], 5)])]);
    const a = shooter({ lore: 50 });
    const gun = weaponFor({ damage: "1d10", penetration: 4 });
    // Порог 50: бросок 55 — промах РОВНО на те +10 "Скрытых Сочленений",
    // которые отменяет успешная компенсация.
    captured.dice = [55, 3];
    await _executeAttackRoll(a, gun, "bs", 50, "single", { value: "joint", label: "Шея" }, {});
    return { a, gun };
  }

  it("успешная компенсация поднимает порог на 10 и переводит промах в попадание", async () => {
    const { a, gun } = await attackJointJustMisses();
    expect(card()).toContain("Промах");
    const atk = atkFlags();
    captured.dice = [40, 3]; // Common Lore(War) 50: 40 — успех
    const outcome = await resolveHiddenJointsClick(a);
    expect(outcome.success).toBe(true);
    // Карточка переигрывается тем же forcedRoll — не resetCaptured() (заглушка
    // Roll с captured.dice===null игнорирует даже литеральную формулу forcedRoll
    // и отдаёт nextRoll=50), а просто очищаем журнал чата, оставляя очередь
    // кубов живой для броска урона (1d10) переигровки.
    captured.chat = [];
    captured.dice = [3];
    await _executeAttackRoll(a, gun, atk.charKey, atk.threshold + 10, atk.rofMode, atk.aimTarget,
      { ...(atk.opts || {}), forcedRoll: atk.rv, skipAmmo: true, hiddenJointsOutcome: outcome });
    expect(card()).toContain("Попадание");
    expect(card()).not.toContain("wh-hidden-joints-btn");
    expect(card()).toContain("успех");
  });

  it("провал компенсации — порог не меняется, промах остаётся, кнопки больше нет", async () => {
    const { a, gun } = await attackJointJustMisses();
    const atk = atkFlags();
    captured.dice = [95]; // Common Lore(War) 50: 95 — провал
    const outcome = await resolveHiddenJointsClick(a);
    expect(outcome.success).toBe(false);
    captured.chat = [];
    captured.dice = [3];
    await _executeAttackRoll(a, gun, atk.charKey, atk.threshold + (outcome.success ? 10 : 0), atk.rofMode, atk.aimTarget,
      { ...(atk.opts || {}), forcedRoll: atk.rv, skipAmmo: true, hiddenJointsOutcome: outcome });
    expect(card()).toContain("Промах");
    expect(card()).not.toContain("wh-hidden-joints-btn");
    expect(card()).toContain("провал");
  });
});
