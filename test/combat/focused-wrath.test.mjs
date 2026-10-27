// test/combat/focused-wrath.test.mjs
//
// Focused Wrath / Сфокусированный Гнев (berserker.core.focusedWrath), пачка J, Sahara
// focused-wrath-20-bs. Книга: «Когда он использует Очко Бесчестия для рукопашной атаки по
// Ненавистной цели, он усиливает эффект. Усиление: +20 вместо +10; Переброс: также дает
// Преимущество; Успех: еще +1 Успех; Атака Ненависти: Inf.b Успехов вместо 1 (мин.1)».

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import {
  hasFocusedWrath, focusedWrathApplies, boostBonusFor, hateAttackDegrees, FOCUSED_WRATH_BOOST,
  FOCUSED_WRATH_REROLL, focusedWrathBarNote, wrathRerollOpts, attackBoostFor
} from "../../module/rules/focused-wrath.mjs";
import { focusedWrathOnAttack } from "../../module/combat/focused-wrath.mjs";
import { FATE_BONUS } from "../../module/rules/fate-bonus.mjs";
import { raceTarget } from "../../module/rules/talent-targets.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const hatred = (...targets) => ({ type: "talent", name: "Hatred / Ненависть", system: { targets } });
const wrath = () => ({ type: "talent", name: "Focused Wrath / Сфокусированный Гнев", system: {} });
const ork = { system: { race: "ork" } };
const human = { system: { race: "human" } };
const fighter = (items = [hatred(raceTarget("ork", "Орк")), wrath()], infB = 3) =>
  ({ items, system: { characteristics: { inf: { bonus: infB } } } });

describe("опознание и условие «рукопашная атака по Ненавистной цели»", () => {
  it("Талант опознаётся по любой половине имени", () => {
    expect(hasFocusedWrath({ items: [wrath()] })).toBe(true);
    expect(hasFocusedWrath({ items: [{ type: "talent", name: "Сфокусированный Гнев", system: {} }] })).toBe(true);
    expect(hasFocusedWrath({ items: [hatred()] })).toBe(false);
  });

  it("рукопашная + Ненавистная цель + Талант → усиление действует", () => {
    expect(focusedWrathApplies(fighter(), { isMelee: true, targetActor: ork })).toBe(true);
  });

  it("стрелковая атака, чужая цель, нет цели, нет Hatred или нет Таланта → не действует", () => {
    expect(focusedWrathApplies(fighter(), { isMelee: false, targetActor: ork })).toBe(false);
    expect(focusedWrathApplies(fighter(), { isMelee: true, targetActor: human })).toBe(false);
    expect(focusedWrathApplies(fighter(), { isMelee: true, targetActor: null })).toBe(false);
    expect(focusedWrathApplies(fighter([wrath()]), { isMelee: true, targetActor: ork })).toBe(false);
    expect(focusedWrathApplies(fighter([hatred(raceTarget("ork", "Орк"))]), { isMelee: true, targetActor: ork })).toBe(false);
  });
});

describe("четыре режима траты Очка Бесчестия", () => {
  const ctx = { isMelee: true, targetActor: ork };

  it("Усиление: +20 вместо +10", () => {
    expect(FOCUSED_WRATH_BOOST).toBe(20);
    expect(boostBonusFor(fighter(), ctx)).toBe(20);
    expect(boostBonusFor(fighter(), { ...ctx, targetActor: human })).toBe(FATE_BONUS);
    expect(boostBonusFor(fighter([hatred(raceTarget("ork"))]), ctx)).toBe(FATE_BONUS);
  });

  it("Атака Ненависти: Inf.b Успехов вместо 1 (минимум 1)", () => {
    expect(hateAttackDegrees(fighter(undefined, 3), ctx)).toBe(3);
    expect(hateAttackDegrees(fighter(undefined, 0), ctx)).toBe(1);
    expect(hateAttackDegrees(fighter(undefined, 3), { ...ctx, isMelee: false })).toBe(1);
    expect(hateAttackDegrees(fighter(undefined, 3), { ...ctx, targetActor: human })).toBe(1);
    expect(hateAttackDegrees(fighter([hatred(raceTarget("ork"))], 3), ctx)).toBe(1);
  });

  it("Переброс: с Преимуществом — два броска, оставить лучший (меньший на d100)", () => {
    expect(FOCUSED_WRATH_REROLL).toEqual({ rolls: 2, mode: "keepBest" });
    expect(wrathRerollOpts({ skipAmmo: false }, true)).toEqual({ skipAmmo: false, reroll: { rolls: 2, mode: "keepBest" } });
    expect(wrathRerollOpts({ skipAmmo: false }, false)).toEqual({ skipAmmo: false });
    // Переброс, заданный правилом, остаётся как есть; исходные опции не мутируются.
    const own = { reroll: { rolls: 3, mode: "keepBest" } };
    expect(wrathRerollOpts(own, true).reroll).toEqual({ rolls: 3, mode: "keepBest" });
    const orig = {}; wrathRerollOpts(orig, true); expect(orig).toEqual({});
    expect(wrathRerollOpts(undefined, true).reroll.rolls).toBe(2);
  });

  it("«+10 за Очко» к порогу: +20 при усилении", () => {
    expect(attackBoostFor(true)).toBe(20);
    expect(attackBoostFor(false)).toBe(10);
  });

  it("Успех: +1 Успех теперь дописывает меню карточки теста (apps/infamy-success.mjs), памятки с полосы для него нет", () => {
    expect(focusedWrathBarNote(fighter(), "success", [ork])).toBe("");
    expect(focusedWrathBarNote(fighter(), "boost", [ork])).toMatch(/\+20/);
    expect(focusedWrathBarNote(fighter(), "reroll", [ork])).toMatch(/Преимуществ/);
    expect(focusedWrathBarNote(fighter(), "boost", [human])).toBe("");
    expect(focusedWrathBarNote(fighter(), "boost", [ork, human])).toBe("");
    expect(focusedWrathBarNote(fighter(), "boost", [])).toBe("");
    expect(focusedWrathBarNote(fighter(), "heal", [ork])).toBe("");
    expect(focusedWrathBarNote(fighter([hatred(raceTarget("ork"))]), "boost", [ork])).toBe("");
  });
});

describe("карточка атаки помнит цель, поэтому +10 / Переброс могут свериться с Ненавистью", () => {
  beforeEach(() => { resetCaptured(); setTargets([]); });

  it("флаг attack.targetUuid = uuid актора-цели", async () => {
    setTargets([{ type: "character", uuid: "Actor.victim", system: { race: "ork" } }]);
    const sword = weaponFor({ weaponClass: "melee", damage: "1d10", penetration: 0 }, { name: "Меч" });
    const actor = actorFor({ items: [sword] });
    captured.dice = [20, 5];
    await _executeAttackRoll(actor, sword, "ws", 45, "melee", null, {});
    expect(captured.chat.at(-1).flags["warhammer-dbc"].attack.targetUuid).toBe("Actor.victim");
  });

  it("focusedWrathOnAttack: берёт цель по uuid с карточки и сверяет с Ненавистью", async () => {
    globalThis.fromUuid = async uuid => (uuid === "Actor.ork" ? ork : uuid === "Actor.man" ? human : null);
    const f = fighter();
    expect(await focusedWrathOnAttack(f, { targetUuid: "Actor.ork" }, true)).toBe(true);
    expect(await focusedWrathOnAttack(f, { targetUuid: "Actor.man" }, true)).toBe(false);
    expect(await focusedWrathOnAttack(f, { targetUuid: "Actor.ork" }, false)).toBe(false);   // стрелковая
    expect(await focusedWrathOnAttack(f, {}, true)).toBe(false);                              // карточка без цели
    expect(await focusedWrathOnAttack(f, { targetUuid: "Actor.gone" }, true)).toBe(false);
    expect(await focusedWrathOnAttack(fighter([hatred(raceTarget("ork"))]), { targetUuid: "Actor.ork" }, true)).toBe(false);
  });
});

describe("окно атаки: Атака Ненависти (Кхорн) с Сфокусированным Гневом", () => {
  // Заглушка Foundry не читает путей в документе, а трата Очка берёт заряд по пути «system.fate.value».
  const realGetProperty = foundry.utils.getProperty;
  beforeEach(() => {
    resetCaptured(); setTargets([]);
    foundry.utils.getProperty = (o, path) => path.split(".").reduce((a, k) => a?.[k], o);
  });
  afterEach(() => { foundry.utils.getProperty = realGetProperty; });

  async function hateAttack(items, race = "ork") {
    setTargets([{ type: "character", uuid: "Actor.victim", system: { race } }]);
    const sword = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", damage: "1d10", penetration: 0 }, { name: "Меч" });
    const actor = actorFor({ items: [sword, ...items], alignment: "heretic", patronGod: "khorne",
      fate: { value: 3, max: 3 }, infamy: { value: 3, max: 3 },
      characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35), inf: char(52) } });
    actor.update = async () => {};
    const p = showAttackDialog(actor, sword);
    captured.dice = [99, 5];     // кубик промахивается — зато Атака Ненависти засчитывает попадание сама
    await captured.press("roll", fakeForm({ "#atk-char": "ws", "#atk-modifier": "0", "#atk-aim": "", "#atk-hate": true }));
    await p;
  }
  const degreesInCard = () => (captured.chat.map(m => String(m.content)).join("\n").match(/Попадание — (\d+) степ/) ?? [])[1];

  it("с Талантом и Ненавистной целью — Inf.b (5) Успехов", async () => {
    await hateAttack([hatred(raceTarget("ork", "Орк")), wrath()]);
    expect(degreesInCard()).toBe("5");
  });

  it("цель не Ненавистная или Таланта нет — по-прежнему 1 Успех", async () => {
    await hateAttack([hatred(raceTarget("ork", "Орк")), wrath()], "human");
    expect(degreesInCard()).toBe("1");
    resetCaptured();
    await hateAttack([hatred(raceTarget("ork", "Орк"))]);
    expect(degreesInCard()).toBe("1");
  });
});

describe("проводка в hooks.mjs и данные пака", () => {
  it("+10 за Очко и переброс атаки читают Сфокусированный Гнев", async () => {
    const fs = await import("node:fs");
    const hooks = fs.readFileSync(new URL("../../module/hooks.mjs", import.meta.url), "utf8");
    expect(hooks).toContain("focusedWrathOnAttack(");
    expect(hooks).toContain("attackBoostFor(await focusedWrathOnAttack(");
    expect(hooks).toContain("wrathRerollOpts(atk.opts, wrathApplies)");
  });

  it("Талант в паке несёт запись Конструктора, читатель назван", () => {
    const doc = packDocById("packs-src/talents/Берсерк", "AkrRFmwljtwkhH8L");
    const keys = (doc.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys).toContain("berserker.core.focusedWrath");
    expect(CAPABILITIES["berserker.core.focusedWrath"].reader).toMatch(/focused-wrath/);
    expect(doc.system.notes).not.toMatch(/^Не смоделировано/);
  });
});

describe("трата с полосы Очков Бесчестия: памятка про +1 Успех по Ненавистной цели", () => {
  const realGetProperty = foundry.utils.getProperty;
  beforeEach(() => {
    resetCaptured(); setTargets([]);
    foundry.utils.getProperty = (o, path) => path.split(".").reduce((a, k) => a?.[k], o);
  });
  afterEach(() => { foundry.utils.getProperty = realGetProperty; });

  async function spend(key, targetRace) {
    const { spendInfamy } = await import("../../module/apps/infamy-points.mjs");
    if (targetRace) setTargets([{ type: "character", system: { race: targetRace } }]);
    const actor = { ...fighter(), type: "character", name: "Берсерк", update: async () => {},
      system: { fate: { value: 3, max: 3 }, corruption: { value: 30 }, characteristics: { inf: { bonus: 3 } } } };
    actor.items = fighter().items;
    await spendInfamy(actor, key, { godKey: "undivided", ipFullPath: "system.fate.value", ipMax: 5,
      meta: { gc: "#000", gc2: "#111", sigil: "" } });
    return captured.chat.map(m => String(m.content)).join("\n");
  }

  it("«Успех» с полосы памятки Сфокусированного Гнева больше не пишет (Успех дописывает меню карточки)", async () => {
    expect(await spend("success", "ork")).not.toMatch(/Сфокусированный Гнев/);
  });
  it("«Усиление» — про +20; цель не Ненавистная или не отмечена — памятки нет", async () => {
    expect(await spend("boost", "ork")).toMatch(/\+20 вместо \+10/);
    resetCaptured();
    expect(await spend("boost", "human")).not.toMatch(/Сфокусированный Гнев/);
    resetCaptured();
    expect(await spend("boost", null)).not.toMatch(/Сфокусированный Гнев/);
  });
});
