// test/combat/tyranthikos-recalc.test.mjs
//
// Тирантикос: переброс ПЕРВОЙ руки после броска второй (Sahara 2d10). Книга:
// «+2d10 Dmg от первого попадания второй атаки», если попали обе. Окно атаки
// решает про кубы один раз до броска второй руки; карточки пары связаны общим
// dualPairId, и «попала ли первая» берётся по её самой свежей карточке — на
// каждом броске второй руки и по кнопке «Пересчитать Тирантикос».

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import {
  firstHandHitNow, tyranthikosDiceNow, tyranthikosRecalcPlan,
  DUAL_HAND_MAIN, DUAL_HAND_OFF, TYRANTHIKOS_BONUS_DICE
} from "../../module/rules/dual-wield-talents.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Карточка атаки в чате в той форме, в какой её кладёт attack.mjs (флаги warhammer-dbc.attack). */
const cardMsg = (id, pairId, hand, hit, timestamp) => ({
  id, timestamp,
  flags: { "warhammer-dbc": { attack: { hit, opts: { dualPairId: pairId, dualHand: hand } } } }
});

describe("firstHandHitNow: попала ли основная рука по её последней карточке", () => {
  it("берёт самую свежую карточку первой руки пары (переброс = новая карточка)", () => {
    const msgs = [
      cardMsg("a", "P1", DUAL_HAND_MAIN, false, 100),
      cardMsg("b", "P1", DUAL_HAND_MAIN, true, 300),     // переброс: промах стал попаданием
      cardMsg("c", "P1", DUAL_HAND_OFF, true, 200)
    ];
    expect(firstHandHitNow(msgs, "P1")).toBe(true);
    // Порядок в чате не важен — важна метка времени.
    expect(firstHandHitNow([...msgs].reverse(), "P1")).toBe(true);
  });

  it("попадание, перебросанное в промах, — false", () => {
    const msgs = [cardMsg("a", "P1", DUAL_HAND_MAIN, true, 100), cardMsg("b", "P1", DUAL_HAND_MAIN, false, 200)];
    expect(firstHandHitNow(msgs, "P1")).toBe(false);
  });

  it("чужая пара и карточка второй руки не в счёт; нет карточки — null", () => {
    const msgs = [cardMsg("a", "P2", DUAL_HAND_MAIN, true, 100), cardMsg("b", "P1", DUAL_HAND_OFF, true, 200)];
    expect(firstHandHitNow(msgs, "P1")).toBe(null);
    expect(firstHandHitNow(msgs, "")).toBe(null);
    expect(firstHandHitNow(undefined, "P1")).toBe(null);
  });
});

describe("tyranthikosDiceNow / tyranthikosRecalcPlan", () => {
  it("первая рука попала сейчас — кубы есть, не попала — нет", () => {
    expect(tyranthikosDiceNow({ eligible: 2, firstHit: true })).toBe(2);
    expect(tyranthikosDiceNow({ eligible: 2, firstHit: false })).toBe(0);
  });

  it("первую руку не нашли — остаётся решение окна", () => {
    expect(tyranthikosDiceNow({ eligible: 2, firstHit: null, fallback: 2 })).toBe(2);
    expect(tyranthikosDiceNow({ eligible: 2, firstHit: null, fallback: 0 })).toBe(0);
  });

  it("карточка без права на Тирантикос не получает кубов, что бы ни было с первой рукой", () => {
    expect(tyranthikosDiceNow({ eligible: 0, firstHit: true })).toBe(0);
  });

  it("план: промах первой стал попаданием — перебросить карточку, +2d10", () => {
    expect(tyranthikosRecalcPlan({ eligible: 2, applied: 0, firstHit: true })).toEqual({ change: true, dice: 2 });
  });

  it("план: попадание первой стало промахом — кубы снять", () => {
    expect(tyranthikosRecalcPlan({ eligible: 2, applied: 2, firstHit: false })).toEqual({ change: true, dice: 0 });
  });

  it("план: ничего не изменилось — карточку не трогать (урон не перебрасывать зря)", () => {
    expect(tyranthikosRecalcPlan({ eligible: 2, applied: 2, firstHit: true }).change).toBe(false);
    expect(tyranthikosRecalcPlan({ eligible: 2, applied: 0, firstHit: false }).change).toBe(false);
  });
});

describe("бросок второй руки читает ЖИВОЕ попадание первой", () => {
  const card = () => captured.chat.at(-1)?.content ?? "";
  const realMessages = globalThis.game.messages;

  beforeEach(() => { resetCaptured(); setTargets([]); });
  afterEach(() => { globalThis.game.messages = realMessages; });

  const offOpts = { dualPairId: "P1", dualHand: DUAL_HAND_OFF, tyranthikosEligible: TYRANTHIKOS_BONUS_DICE };
  const shoot = async (opts = {}) => {
    const weapon = weaponFor({ damage: "1d10", rof_single: 1 });
    const actor = actorFor({ items: [weapon] });
    // 10 — попадание (порог 45); 5 — урон 1d10; 3 и 4 — кубы Тирантикоса.
    captured.dice = [10, 5, 3, 4];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { ...offOpts, ...opts });
    return captured.chat.at(-1);
  };

  it("окно решило «первая промахнулась», но её переброс попал — вторая получает +2d10", async () => {
    globalThis.game.messages = [cardMsg("m1", "P1", DUAL_HAND_MAIN, false, 100), cardMsg("m2", "P1", DUAL_HAND_MAIN, true, 200)];
    await shoot({ tyranthikosDice: 0 });
    expect(card()).toContain('data-damage="12"');   // 5 + 3 + 4
    expect(card()).toContain("Тирантикос");
  });

  it("окно решило «первая попала», но её переброс промахнулся — +2d10 нет", async () => {
    globalThis.game.messages = [cardMsg("m1", "P1", DUAL_HAND_MAIN, true, 100), cardMsg("m2", "P1", DUAL_HAND_MAIN, false, 200)];
    await shoot({ tyranthikosDice: 2 });
    expect(card()).toContain('data-damage="5"');
    expect(card()).not.toContain("Тирантикос: обе");
  });

  it("карточки первой руки в чате нет — остаётся решение окна", async () => {
    globalThis.game.messages = [];
    await shoot({ tyranthikosDice: 2 });
    expect(card()).toContain('data-damage="12"');
  });

  it("карточка запоминает, сколько кубов на ней лежит, и показывает кнопку пересчёта", async () => {
    globalThis.game.messages = [cardMsg("m1", "P1", DUAL_HAND_MAIN, true, 100)];
    const msg = await shoot({ tyranthikosDice: 2 });
    expect(msg.flags["warhammer-dbc"].attack.tyranthikosApplied).toBe(2);
    expect(card()).toContain("wh-tyranthikos-btn");
  });

  it("не-Терминатор (пара без права на Тирантикос) — ни кубов, ни кнопки", async () => {
    globalThis.game.messages = [cardMsg("m1", "P1", DUAL_HAND_MAIN, true, 100)];
    await shoot({ tyranthikosEligible: undefined });
    expect(card()).not.toContain("wh-tyranthikos-btn");
    expect(card()).toContain('data-damage="5"');
  });

  it("промах второй руки — кнопки нет", async () => {
    globalThis.game.messages = [cardMsg("m1", "P1", DUAL_HAND_MAIN, true, 100)];
    const weapon = weaponFor({ damage: "1d10", rof_single: 1 });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [90];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { ...offOpts, tyranthikosDice: 2 });
    expect(card()).not.toContain("wh-tyranthikos-btn");
  });
});

describe("проводка: окно, хук, реестр", () => {
  const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");

  it("окно метит обе карточки пары общим dualPairId и руками", () => {
    const src = read("module/sheets/attack/dialog.mjs");
    expect(src).toMatch(/dualPairId/);
    expect(src).toMatch(/dualHand: DUAL_HAND_MAIN/);
    expect(src).toMatch(/dualHand: DUAL_HAND_OFF/);
    expect(src).toMatch(/tyranthikosEligible/);
  });

  it("кнопка карточки переигрывает ЭТУ ЖЕ карточку (updateMessageId) по плану пересчёта", () => {
    const src = read("module/hooks.mjs");
    expect(src).toMatch(/\.wh-tyranthikos-btn/);
    expect(src).toMatch(/tyranthikosRecalcPlan\(/);
    expect(src).toMatch(/firstHandHitNow\(/);
  });
});
