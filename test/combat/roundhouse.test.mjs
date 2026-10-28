// test/combat/roundhouse.test.mjs
//
// Roundhouse Kick / Пинок с Разворота (Пугилист, стр. 62; Sahara 3-eddb):
// после попадания Пинком с Натиска по цели не крупнее — состязание
// Athletics(S)+10 vs Athletics(S)+0; победа отбрасывает цель на ½ м за Успех,
// но не дальше ½S.b м; дальше ¼A.b цели — Ничком.

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { roundhouseKnockback, roundhouseOffered, roundhouseButtonHtml, resolveRoundhouseSuccess, isKickWeapon, startRoundhouse }
  from "../../module/combat/roundhouse.mjs";
import { CARD_ONCE_FLAGS } from "../../module/combat/card-once.mjs";

const TALENT = { id: "rk", name: "Roundhouse Kick / Пинок с Разворота", type: "talent", system: {} };

function kick(grips = "Ног") {
  const w = weaponFor({ weaponClass: "melee", grips, meleeCategory: "Кулаки", balance: -2, equipped: true }, { id: "kick", name: "Пинок" });
  w.getFlag = (scope, key) => (scope === "warhammer-dbc" && key === "integralAttack") ? true : undefined;
  return w;
}

/** Актор с заданным S.b/A.b и Размером. */
function body({ sb = 4, agb = 4, size = 4, items = [] } = {}) {
  const a = actorFor({ items, size, characteristics: {
    ws: char(45), bs: char(45), s: { ...char(sb * 10), bonus: sb }, t: char(40), ag: { ...char(agb * 10), bonus: agb }
  } });
  a.name = "Боец";
  a.uuid = `Actor.${Math.random().toString(36).slice(2)}`;
  return a;
}

beforeEach(() => resetCaptured());

describe("roundhouseKnockback", () => {
  it("½ м за Успех: 3 Успеха → 1,5 м", () => {
    expect(roundhouseKnockback({ deg: 3, strengthBonus: 6, targetAgilityBonus: 4 }).distance).toBe(1.5);
  });
  it("потолок ½S.b: 5 Успехов при S.b 2 → 1 м", () => {
    const k = roundhouseKnockback({ deg: 5, strengthBonus: 2, targetAgilityBonus: 4 });
    expect(k.distance).toBe(1);
    expect(k.cap).toBe(1);
  });
  it("сбив с ног — строго дальше ¼A.b: A.b 4 → порог 1 м; ровно 1 м не сбивает, 1,5 м сбивает", () => {
    expect(roundhouseKnockback({ deg: 2, strengthBonus: 10, targetAgilityBonus: 4 }).knockedDown).toBe(false);
    expect(roundhouseKnockback({ deg: 3, strengthBonus: 10, targetAgilityBonus: 4 }).knockedDown).toBe(true);
  });
  it("A.b 3 → порог 0,75 м: отброс на 1 м сбивает, на 0,5 м — нет (без округления ¼A.b)", () => {
    expect(roundhouseKnockback({ deg: 1, strengthBonus: 10, targetAgilityBonus: 3 }).knockedDown).toBe(false);
    expect(roundhouseKnockback({ deg: 2, strengthBonus: 10, targetAgilityBonus: 3 }).knockedDown).toBe(true);
  });
  it("0 Успехов или S.b 0 — отброса нет, не сбивает", () => {
    expect(roundhouseKnockback({ deg: 0, strengthBonus: 5, targetAgilityBonus: 0 }).knockedDown).toBe(false);
    expect(roundhouseKnockback({ deg: 4, strengthBonus: 0, targetAgilityBonus: 0 }).distance).toBe(0);
  });
});

describe("roundhouseOffered / roundhouseButtonHtml", () => {
  const base = () => {
    const w = kick();
    const actor = body({ items: [TALENT, w] });
    const target = body({ size: 4 });
    return { actor, weapon: w, baseKey: "charge", hit: true, targetActor: target };
  };

  it("Пинок с Натиска, попадание, цель равного Размера → предложено, кнопка с uuid", () => {
    const a = base();
    expect(roundhouseOffered(a)).toBe(true);
    const html = roundhouseButtonHtml(a);
    expect(html).toContain("wh-roundhouse-btn");
    expect(html).toContain(a.actor.uuid);
  });
  it("цель меньшего Размера — предложено", () => {
    const a = base(); a.targetActor = body({ size: 3 });
    expect(roundhouseOffered(a)).toBe(true);
  });
  it("цель крупнее — нет", () => {
    const a = base(); a.targetActor = body({ size: 5 });
    expect(roundhouseOffered(a)).toBe(false);
    expect(roundhouseButtonHtml(a)).toBe("");
  });
  it("не с Натиска — нет", () => {
    const a = base(); a.baseKey = "standard";
    expect(roundhouseOffered(a)).toBe(false);
  });
  it("промах — нет", () => {
    const a = base(); a.hit = false;
    expect(roundhouseOffered(a)).toBe(false);
  });
  it("удар рукой, а не ногой — нет", () => {
    const a = base(); a.weapon = kick("Кист");
    expect(isKickWeapon(a.weapon)).toBe(false);
    expect(roundhouseOffered(a)).toBe(false);
  });
  it("без Таланта — нет", () => {
    const a = base(); a.actor = body({ items: [a.weapon] });
    expect(roundhouseOffered(a)).toBe(false);
  });
});

describe("_executeAttackRoll: кнопка на карточке попавшего Пинка с Натиска", () => {
  async function kickAttack({ baseKey, talent = true }) {
    const w = kick();
    const attacker = body({ items: talent ? [TALENT, w] : [w] });
    attacker.uuid = "Actor.attacker";
    const target = body({ size: 4 });
    target.getFlag = () => undefined;
    target.setFlag = async () => {};
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([{ id: "t", actor: target }]) };
    captured.dice = [10, 3, 3, 3, 3];
    await _executeAttackRoll(attacker, w, "ws", 45, "melee", null, { baseKey });
    return captured.chat.map(m => m.content).join("\n");
  }
  it("с Талантом и Натиском — кнопка есть", async () => {
    expect(await kickAttack({ baseKey: "charge" })).toContain("wh-roundhouse-btn");
  });
  it("без Натиска — кнопки нет", async () => {
    expect(await kickAttack({ baseKey: "standard" })).not.toContain("wh-roundhouse-btn");
  });
  it("без Таланта — кнопки нет", async () => {
    expect(await kickAttack({ baseKey: "charge", talent: false })).not.toContain("wh-roundhouse-btn");
  });
});

describe("resolveRoundhouseSuccess", () => {
  it("победа с запасом: карточка называет дальность, цель получает Ничком", async () => {
    const actor = body({ sb: 4 });
    const target = body({ agb: 4 });
    let upd = null;
    target.update = async f => { upd = f; };
    await resolveRoundhouseSuccess(actor, { deg: 3, target });
    const html = captured.chat.at(-1).content;
    expect(html).toContain("<b>1.5</b> м");
    expect(upd).toMatchObject({ "system.conditions.prone": true });
  });

  it("малая дальность — цель остаётся на ногах", async () => {
    const actor = body({ sb: 4 });
    const target = body({ agb: 4 });
    let upd = null;
    target.update = async f => { upd = f; };
    await resolveRoundhouseSuccess(actor, { deg: 1, target });
    expect(upd).toBeNull();
    expect(captured.chat.at(-1).content).toContain("на ногах");
  });

  it("без цели — предупреждение", async () => {
    await resolveRoundhouseSuccess(body(), { deg: 3, target: null });
    expect(captured.warnings.some(w => w.includes("не найдена"))).toBe(true);
  });
});

describe("startRoundhouse: цель карточки, а не текущий прицел", () => {
  const press = () => captured.dialog.buttons.roll.callback(
    fakeHtml({ "#contest-char": "s", "#contest-self": "20", "#contest-mod": "0" }));

  it("противник — актор из data-target-uuid, даже если под прицелом другой", async () => {
    const actor = body({ sb: 4 });
    const hitTarget = body({ agb: 4 });
    hitTarget.name = "Ударенный";
    const other = body();
    other.name = "Перевыцеленный";
    game.user.targets = new Set([{ actor: other }]);
    globalThis.fromUuid = async uuid => (uuid === hitTarget.uuid ? hitTarget : null);
    await startRoundhouse(actor, { targetUuid: hitTarget.uuid });
    await press();
    const html = captured.chat.map(m => m.content).join("\n");
    expect(html).toContain("Ударенный");
    expect(html).not.toContain("Перевыцеленный");
    game.user.targets = new Set();
  });

  it("uuid цели не находится — предупреждение, окна нет", async () => {
    globalThis.fromUuid = async () => null;
    const res = await startRoundhouse(body(), { targetUuid: "Actor.gone" });
    expect(res).toBe(false);
    expect(captured.dialog).toBeFalsy();
    expect(captured.warnings.some(w => w.includes("не найдена"))).toBe(true);
  });

  it("claim зовётся по «Бросок!», а не при открытии окна; отказ — броска нет", async () => {
    const hitTarget = body();
    globalThis.fromUuid = async () => hitTarget;
    let claimed = 0;
    await startRoundhouse(body(), { targetUuid: hitTarget.uuid, claim: async () => { claimed++; return false; } });
    expect(claimed).toBe(0);
    await press();
    expect(claimed).toBe(1);
    expect(captured.chat.length).toBe(0);
  });
});

describe("стыковка hooks.mjs: Швырнуть, Наскок, Пинок с Разворота — раз на карточку", () => {
  const HOOKS = fs.readFileSync(path.join(import.meta.dirname, "../../module/hooks.mjs"), "utf8");
  for (const [sel, key] of [[".wh-roundhouse-btn", "roundhouseUsed"], [".wh-slam-btn", "slamUsed"], [".wh-pounce-btn", "pounceKnockdownUsed"]]) {
    it(`${sel}: кнопка гаснет по отметке карточки, ключ ${key} есть в белом списке сокета`, () => {
      const at = HOOKS.indexOf(`html.querySelectorAll("${sel}")`);
      expect(at).toBeGreaterThan(0);
      const block = HOOKS.slice(at, at + 1800);
      expect(block).toContain("cardOnceUsed(message");
      expect(block).toContain("runCardOnce(message");
      expect(CARD_ONCE_FLAGS).toContain(key);
    });
  }
  it("Наскок: вторая часть (grab) — отдельный ключ pounceGrabUsed", () => {
    expect(CARD_ONCE_FLAGS).toContain("pounceGrabUsed");
  });
  it("Пинок с Разворота передаёт data-target-uuid в startRoundhouse", () => {
    const at = HOOKS.indexOf('html.querySelectorAll(".wh-roundhouse-btn")');
    expect(HOOKS.slice(at, at + 1800)).toMatch(/dataset\.targetUuid/);
  });
});
