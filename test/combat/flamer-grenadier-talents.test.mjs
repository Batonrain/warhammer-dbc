// test/combat/flamer-grenadier-talents.test.mjs
//
// Таланты «Огнемётчик» и «Метание» главы 3 (Sahara 3-8318): Friendly Fire /
// Дружественный Огонь (+30 к тесту отмены Распыления не-врагам стрелка),
// Pyromaniac / Пироман (успешный тест против загорания перебрасывается, в
// укрытии ещё −20), Grenadier / Гренадер (смещение промахнувшейся гранаты −BS.b,
// перебросить направление).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { actorFor, weaponFor, char } from "../support/combat-fixtures.mjs";
import { _performSprayCancel } from "../../module/combat/defense.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { buildTargetEffectButtons } from "../../module/combat/weapon-properties.mjs";
import {
  friendlyFireBonus, pyromaniacActive, pyromaniacCoverPenalty, hasFlamerTalent
} from "../../module/rules/flamer-talents.mjs";
import { grenadierScatterReduce, reducedScatterDistance } from "../../module/rules/throwing-talents.mjs";
import { grenadierReduceScatter, grenadierRerollDirection } from "../../module/combat/grenadier.mjs";

const { _applyWeaponPropEffect } = await import("../../module/hooks.mjs");

const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = name => ({ id: "n-" + name, name, type: "talent", system: {} });
const FF = { key: "flamer.core.friendlyFire", name: "Friendly Fire / Дружественный Огонь" };
const PY = { key: "flamer.core.pyromaniac", name: "Pyromaniac / Пироман" };
const GR = { key: "throwing.core.grenadier", name: "Grenadier / Гренадер" };

beforeEach(() => resetCaptured());

// ── Дружественный Огонь ─────────────────────────────────────────────────────

describe("Дружественный Огонь: +30 к тесту отмены Распыления", () => {
  const withToken = (a, disposition) => { a.getActiveTokens = () => [{ document: { disposition } }]; return a; };
  const defender = disposition => withToken(actorFor({ characteristics: { ag: char(35) } }), disposition);
  const shooter = (items, disposition = 1) => withToken(actorFor({ items }), disposition);

  it("чистая функция: не враг — +30; враг, нет токенов, нет Таланта — 0", () => {
    const a = shooter([byName(FF.name)]);
    expect(friendlyFireBonus(a, { relationship: "ally" })).toBe(30);
    expect(friendlyFireBonus(a, { relationship: "neutral" })).toBe(30);
    expect(friendlyFireBonus(a, { relationship: "enemy" })).toBe(0);
    expect(friendlyFireBonus(a, { relationship: null })).toBe(0);
    expect(friendlyFireBonus(shooter([]), { relationship: "ally" })).toBe(0);
    expect(hasFlamerTalent(shooter([byKey(FF.key)]), "friendlyFire")).toBe(true);
  });

  it("союзник стрелка: Порог 15 → 45, в подписи назван Талант; враг — прежние 15", async () => {
    for (const t of [byName(FF.name), byKey(FF.key)]) {
      resetCaptured();
      captured.dice = [40];
      await _performSprayCancel(defender(1), { attacker: shooter([t], 1) });
      const card = captured.chat.at(-1).content;
      expect(card).toContain("<label>Порог</label><b>45</b>");
      expect(card).toContain("Friendly Fire");
      expect(card).toContain("Успех");
    }
    resetCaptured();
    captured.dice = [40];
    await _performSprayCancel(defender(-1), { attacker: shooter([byName(FF.name)], 1) });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("<label>Порог</label><b>15</b>");
    expect(card).not.toContain("Friendly Fire");
  });

  it("токен цели не найден — бонуса нет", async () => {
    const d = actorFor({ characteristics: { ag: char(35) } });
    captured.dice = [40];
    await _performSprayCancel(d, { attacker: shooter([byName(FF.name)]) });
    expect(captured.chat.at(-1).content).toContain("<label>Порог</label><b>15</b>");
  });
});

// ── Пироман ─────────────────────────────────────────────────────────────────

describe("Пироман: переброс успешного теста против загорания, −20 в укрытии", () => {
  it("активен: Талант + Spray + Flame; штраф укрытия только при AP > 0", () => {
    const a = actorFor({ items: [byName(PY.name)] });
    expect(pyromaniacActive(a, { spray: true, flame: true })).toBe(true);
    expect(pyromaniacActive(a, { spray: true, flame: false })).toBe(false);
    expect(pyromaniacActive(a, { spray: false, flame: true })).toBe(false);
    expect(pyromaniacActive(actorFor({}), { spray: true, flame: true })).toBe(false);
    expect(pyromaniacCoverPenalty(2)).toBe(-20);
    expect(pyromaniacCoverPenalty(0)).toBe(0);
  });

  it("кнопка Горения несёт data-wp-pyromaniac только у burning", () => {
    const flame = { def: { key: "flame", label: "Огненное", auto: { targetEffect: { condition: "burning", testChar: "ag", damageFromRating: true } } }, rating: "1d10" };
    const toxic = { def: { key: "toxic", label: "Ядовитое", auto: { targetEffect: { condition: "poisoned", testChar: "t", damage: "1d10" } } }, rating: 0 };
    expect(buildTargetEffectButtons([flame], { hit: true, pyromaniac: true })).toContain('data-wp-pyromaniac="1"');
    expect(buildTargetEffectButtons([toxic], { hit: true, pyromaniac: true })).toContain('data-wp-pyromaniac="0"');
    expect(buildTargetEffectButtons([flame], { hit: true, pyromaniac: false })).toContain('data-wp-pyromaniac="0"');
  });

  const target = ({ inCover = false, disposition = -1 } = {}) => {
    const system = { characteristics: { ag: { total: 50 } }, conditions: {}, wounds: { value: 20, max: 20, critical: 0 } };
    return {
      uuid: "Actor.forced1", name: "Цель", isOwner: true, type: "character", system,
      // зона Укрытия под токеном: coverApForToken читает token.document.regions[].behaviors
      getActiveTokens: () => [{ document: { disposition, regions: new Set(inCover ? [{ behaviors: [{ type: "cover", disabled: false, system: { coverAp: 3 } }] }] : []) } }],
      update: async changes => {
        captured.updates.push(changes);
        for (const [k, v] of Object.entries(changes)) if (k.startsWith("system.conditions.")) system.conditions[k.slice("system.conditions.".length)] = v;
      }
    };
  };
  const base = { wpForceActorUuid: "Actor.forced1", wpLabel: "Огненное", wpKey: "flame", wpCondition: "burning", wpTestChar: "ag", wpTestMod: "0", wpDamage: "1d10" };

  it("с флагом: успех (10 ≤ 50) перебрасывается; второй бросок 90 → провал, цель загорелась", async () => {
    globalThis.fromUuid = async () => target();
    captured.dice = [10, 90, 3, 3, 3];
    await _applyWeaponPropEffect({ ...base, wpPyromaniac: "1" });
    const note = captured.chat.at(-1).content;
    expect(note).toContain("Пироман: успех против загорания (10)");
    expect(note).toContain("эффект наложен");
  });

  // Стрелок (disposition 1) резолвится по uuid с кнопки; цель — по wpForceActorUuid.
  const shooterActor = (disposition = 1) => ({ uuid: "Actor.shooter1", getActiveTokens: () => [{ document: { disposition } }] });
  const resolver = (tgt, shooter) => async uuid => (uuid === "Actor.shooter1" ? shooter : tgt);
  const withShooter = { ...base, wpPyromaniac: "1", wpPyromaniacAttacker: "Actor.shooter1" };

  it("цель в укрытии (враг стрелка): Порог ниже на 20, подпись называет Пироманa", async () => {
    globalThis.fromUuid = resolver(target({ inCover: true, disposition: -1 }), shooterActor(1));
    captured.dice = [90, 90, 3];
    await _applyWeaponPropEffect(withShooter);
    expect(captured.chat.at(-1).content).toContain("Пироман: в укрытии -20");
    expect(captured.chat.at(-1).content).toContain("<b>30</b>");
    resetCaptured();
    globalThis.fromUuid = resolver(target({ inCover: false, disposition: -1 }), shooterActor(1));
    captured.dice = [90, 90, 3];
    await _applyWeaponPropEffect(withShooter);
    expect(captured.chat.at(-1).content).not.toContain("в укрытии");
  });

  it("цель в укрытии, но союзник/нейтрал стрелка или стрелок неизвестен: −20 нет (переброс успеха остаётся)", async () => {
    for (const [tgtDisp, shooter] of [[1, shooterActor(1)], [0, shooterActor(1)], [-1, null]]) {
      resetCaptured();
      globalThis.fromUuid = resolver(target({ inCover: true, disposition: tgtDisp }), shooter);
      captured.dice = [10, 90, 3];
      await _applyWeaponPropEffect(withShooter);
      const note = captured.chat.at(-1).content;
      expect(note).not.toContain("в укрытии");
      expect(note).toContain("Пироман: успех против загорания (10)");
    }
    // старая кнопка без uuid стрелка — тоже без штрафа
    resetCaptured();
    globalThis.fromUuid = async () => target({ inCover: true, disposition: -1 });
    captured.dice = [90, 90, 3];
    await _applyWeaponPropEffect({ ...base, wpPyromaniac: "1" });
    expect(captured.chat.at(-1).content).not.toContain("в укрытии");
  });

  it("кнопка Горения несёт uuid стрелка", () => {
    const flame = { def: { key: "flame", label: "Огненное", auto: { targetEffect: { condition: "burning", testChar: "ag", damageFromRating: true } } }, rating: "1d10" };
    expect(buildTargetEffectButtons([flame], { hit: true, pyromaniac: true, pyromaniacAttackerUuid: "Actor.s1" }))
      .toContain('data-wp-pyromaniac-attacker="Actor.s1"');
  });

  it("без флага: успех остаётся успехом", async () => {
    globalThis.fromUuid = async () => target();
    captured.dice = [10, 90, 3, 3, 3];
    await _applyWeaponPropEffect({ ...base });
    const note = captured.chat.at(-1).content;
    expect(note).not.toContain("Пироман");
    expect(note).toContain("сопротивилась");
  });
});

// ── Гренадер ────────────────────────────────────────────────────────────────

describe("Гренадер: смещение гранаты", () => {
  it("BS.b только у гранаты, брошенной (не рукопашной), с Талантом", () => {
    const a = actorFor({ items: [byName(GR.name)] });
    expect(grenadierScatterReduce(a, { sys: { weaponType: "grenade" }, isMelee: false, bsBonus: 4 })).toBe(4);
    expect(grenadierScatterReduce(actorFor({ items: [byKey(GR.key)] }), { sys: { weaponType: "grenade" }, isMelee: false, bsBonus: 4 })).toBe(4);
    expect(grenadierScatterReduce(a, { sys: { weaponType: "bolt" }, isMelee: false, bsBonus: 4 })).toBe(0);
    expect(grenadierScatterReduce(a, { sys: { weaponType: "grenade" }, isMelee: true, bsBonus: 4 })).toBe(0);
    expect(grenadierScatterReduce(actorFor({}), { sys: { weaponType: "grenade" }, isMelee: false, bsBonus: 4 })).toBe(0);
  });

  it("уменьшение не уходит ниже нуля", () => {
    expect(reducedScatterDistance(7, 4)).toBe(3);
    expect(reducedScatterDistance(3, 4)).toBe(0);
  });

  it("промах гранаты «под цель»: на карточке смещения кнопки Гренадера; без Таланта — нет", async () => {
    const grenade = () => Object.assign(weaponFor({ weaponType: "grenade", weaponClass: "thrown", damage: "2d10", penetration: 0,
      weaponProps: [{ key: "blast", rating: 3 }], rof_single: 1 }, { name: "Фраг-граната" }), { delete: async () => {} });
    const shoot = async items => {
      const a = actorFor({ items, characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35) } });
      captured.dice = [77, 4, 2, 5, 5];     // промах, затем d10=4 и d8=2 для смещения
      await _executeAttackRoll(a, grenade(), "bs", 45, "single", { value: "underfoot", label: "Под цель" }, {});
    };
    await shoot([byName(GR.name)]);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("wh-grenadier-reduce-btn");
    expect(html).toContain('data-reduce="4"');
    expect(html).toContain("wh-grenadier-reroll-btn");
    expect(html).toContain('class="wh-scatter-dist">');
    resetCaptured();
    await shoot([]);
    expect(captured.chat.at(-1).content).not.toContain("wh-grenadier");
  });

  it("кнопки: смещение уменьшается и пишется в чат; направление перебрасывается по розе", async () => {
    const distEl = { textContent: "7" }, dirEl = { textContent: "Вперёд" }, iconEl = { textContent: "⬆️" };
    const r = await grenadierReduceScatter({ distEl }, 4);
    expect(r).toEqual({ from: 7, to: 3 });
    expect(distEl.textContent).toBe("3");
    expect(captured.chat.at(-1).content).toContain("7 м → <b>3 м</b>");
    captured.dice = [3];
    const rr = await grenadierRerollDirection({ dirEl, iconEl });
    expect(rr.dir.n).toBe(3);
    expect(dirEl.textContent).toBe("Вправо");
    expect(iconEl.textContent).toBe("➡️");
    expect(captured.chat.at(-1).content).toContain("Вправо");
  });
});
