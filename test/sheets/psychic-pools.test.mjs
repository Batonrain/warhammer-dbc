// test/sheets/psychic-pools.test.mjs
//
// Пачка I1 (Псайкана, Sahara 3-28, решения владельца 26.10.2026) в самой игре:
// карточка манифестации (Пропускание, Ключевые Силы), окно манифестации и пул
// Быстрого Плетения, кнопка «Переплести» Текучего Плетения, Усмирение Варпа за
// бесплатное Очко. Таланты — настоящие записи пака (packDocById). Чистая логика —
// test/rules/psyker-pools.test.mjs.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, listenerHtml, sheetOf } from "../support/foundry-stub.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { executePsychotest, showManifestDialog, activatePsychicListeners } from "../../module/sheets/tabs/psychic.mjs";
import { handleCalmWarpClick } from "../../module/combat/calm-warp.mjs";
import { processFastWeavingCombatStart, weaveFluid, restoreFluidWeavePoint, signatureFreeHtml, SIGNATURE_USAGE_KEY,
         handleSignatureFreeClick, handlePsyRerollClick, manifestActionPlan, payManifestAction } from "../../module/combat/psyker-pools.mjs";
import { cardOnceUsed, markCardOnce } from "../../module/combat/card-once.mjs";
import { WARP_LOCK_FLAG } from "../../module/rules/warp-lock.mjs";
import { WOUND_FREE_FLAG } from "../../module/rules/wound-in-reality.mjs";
import { FAST_WEAVING_FLAG, FLUID_WEAVE_SPENT_FLAG, FLUID_WEAVE_TURN_FLAG, SIGNATURE_FLAG }
  from "../../module/rules/psyker-talents.mjs";
import { WarhammerCharacterSheet } from "../../module/sheets/actor-sheet.mjs";
import { buildGetData } from "../../module/sheets/sheet-helpers.mjs";

foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);

const DIR = "packs-src/talents/Псайкана";
const CHANNEL = "3dNMHPBv9ewCkDbX", FAST = "T4is6m1SCnsePukP", FLUID = "CwohM0eNM9r0ODvZ", SIG = "jyq8XwnrmtLfQrjV";

/** Талант из настоящей записи пака, с живыми флагами и setFlag. */
function talent(id, flags = {}, system = {}) {
  const doc = packDocById(DIR, id);
  const store = { ...flags };
  const t = { id: doc._id, type: "talent", name: doc.name, system: { ...doc.system, ...system },
    flags: { "warhammer-dbc": store },
    getFlag: (s, k) => store[k],
    setFlag: async (s, k, v) => { store[k] = v; } };
  return t;
}

/** Запись по пути «a.b.c» в духе Foundry (вложенность; «-=ключ» удаляет). */
function applyPath(obj, path, v) {
  const ks = path.split(".");
  let o = obj;
  for (const k of ks.slice(0, -1)) o = (o[k] ??= {});
  const last = ks.at(-1);
  if (last.startsWith("-=")) delete o[last.slice(2)]; else o[last] = v;
}

function power(extra = {}, name = "Эгида / Aegis") {
  const it = { id: "p1", uuid: "Actor.actor-1.Item.p1", name, type: "psychicPower",
    system: { testChar: "wp", powerType: "infusion", action: "half", testMod: 0, ...extra }, updates: [], flags: {},
    getFlag: (s, k) => it.flags?.[s]?.[k],
    update: async d => { it.updates.push(d); for (const [k, v] of Object.entries(d)) applyPath(it, k, v); return d; } };
  return it;
}

function actor(items = [], { fate = 3, surprised = false, int = 4, cor = 30, cls = "bound" } = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const flags = {};
  const a = Object.assign(new Actor(), {
    id: "actor-1", name: "Псайкер", uuid: "Actor.actor-1", type: "character", isOwner: true, items: list, updates: [],
    getFlag: (s, k) => flags[`${s}.${k}`],
    // как в настоящем Foundry: setFlag СЛИВАЕТ объект с прежним значением, а не заменяет его
    setFlag: async (s, k, v) => {
      const old = flags[`${s}.${k}`];
      flags[`${s}.${k}`] = (old && typeof old === "object" && v && typeof v === "object") ? { ...old, ...v } : v;
    },
    unsetFlag: async (s, k) => { delete flags[`${s}.${k}`]; },
    flagsStore: flags,
    system: {
      race: "human", fatigue: { value: 0 }, fate: { value: fate, max: 5 },
      psyker: { rating: 9, currentRating: 9, sustain: 0, class: cls },
      skills: {}, corruption: { value: cor }, corruptionBonus: 0, alignment: "",
      wounds: { value: 8, max: 10, critical: 0 },
      conditions: { surprised },
      actionPoints: { value: 2, max: 2 },
      reactions: { value: 1, max: 1, defenseValue: 0, strangeValue: 0 },
      characteristics: { wp: { total: 40, value: 40, bonus: 4 }, int: { total: 40, value: 40, bonus: int } }
    },
    update: async d => { a.updates.push(d); for (const [k, v] of Object.entries(d)) {
      const keys = k.split("."); let o = a; for (const kk of keys.slice(0, -1)) o = (o[kk] ??= {}); o[keys.at(-1)] = v; } return d; },
    updateEmbeddedDocuments: async () => []
  });
  return a;
}

/** Актору выдан пул Быстрого Плетения (метка на самом акторе). */
const withPool = (a, n) => { a.flagsStore[`warhammer-dbc.${FAST_WEAVING_FLAG}`] = n; return a; };

const opts = (mPR, mode, extra = {}) => ({ mPR, prMod: 0, mode, path: "", modifier: 0, eldar: false, pushChoice: 1,
  damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1, ...extra });
const chatText = () => captured.chat.map(m => String(m.content ?? "")).join("\n");
const plain = () => chatText().replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const cast = async (a, p, o, dice = null) => {
  captured.chat.length = 0; captured.rolls.length = 0; captured.nextRoll = 50; captured.dice = dice;
  await executePsychotest(a, p, o);
};

beforeEach(() => {
  resetCaptured();
  globalThis.game.user = { targets: new Set() };
  globalThis.game.combat = undefined;
  globalThis.game.users = { activeGM: { id: "gm" } };
});

// ── Пропускание ─────────────────────────────────────────────────────────────
describe("Пропускание: строка в карточке манифестации", () => {
  const withChannel = () => actor([talent(CHANNEL)]);

  it("Психофокус удался, Феномена нет — «Проявлений Силы нет»", async () => {
    await cast(withChannel(), power(), opts(9, "normal", { path: "psychofocus" }), [10, 30]);
    expect(plain()).toContain("Проявлений Силы нет");
  });

  it("Психофокус удался, но выпал Феномен — строка предупреждает, что проявление очевидно", async () => {
    await cast(withChannel(), power(), opts(9, "normal", { path: "psychofocus" }), [10, 33, 20]);
    expect(plain()).toContain("вызвала Феномен");
    expect(plain()).not.toContain("Проявлений Силы нет");
  });

  it("Психофокус провален — строки нет вовсе", async () => {
    await cast(withChannel(), power(), opts(9, "normal", { path: "psychofocus" }), [90, 30]);
    expect(plain()).not.toContain("Пропускание");
  });

  it("другой Путь или нет Таланта — строки нет", async () => {
    await cast(withChannel(), power(), opts(9, "normal", { path: "" }), [30]);
    expect(plain()).not.toContain("Пропускание");
    await cast(actor(), power(), opts(9, "normal", { path: "psychofocus" }), [10, 30]);
    expect(plain()).not.toContain("Пропускание");
  });
});

// ── Быстрое Плетение ────────────────────────────────────────────────────────
describe("Быстрое Плетение: пул 2 ОД в начале боя", () => {
  const inFight = a => { globalThis.game.combat = { started: true, round: 0, combatant: { actor: null } }; return a; };

  it("combatStart: носителю — 2 ОД, застигнутому Врасплох — 0, прочим ничего", async () => {
    const calm = actor([talent(FAST)]), surprised = actor([talent(FAST)], { surprised: true }), none = actor();
    await processFastWeavingCombatStart({ combatants: [{ actor: calm }, { actor: surprised }, { actor: none }] });
    expect(calm.getFlag("warhammer-dbc", FAST_WEAVING_FLAG)).toBe(2);
    expect(surprised.getFlag("warhammer-dbc", FAST_WEAVING_FLAG)).toBe(0);
    expect(none.getFlag("warhammer-dbc", FAST_WEAVING_FLAG)).toBeUndefined();
  });

  it("обработчик догнал начало первого Хода: тому, чей Ход уже идёт, пул не выдаётся (метка пережила бы сброс Хода)", async () => {
    const first = actor([talent(FAST)]), later = actor([talent(FAST)]);
    later.uuid = "Actor.actor-2";
    await processFastWeavingCombatStart({ combatant: { actor: first }, combatants: [{ actor: first }, { actor: later }] });
    expect(first.getFlag("warhammer-dbc", FAST_WEAVING_FLAG)).toBe(0);
    expect(later.getFlag("warhammer-dbc", FAST_WEAVING_FLAG)).toBe(2);
  });

  it("живой Foundry: на combatStart turn ещё null — первым считается тот, кто первый в порядке Инициативы", async () => {
    const first = actor([talent(FAST)]), later = actor([talent(FAST)]);
    later.uuid = "Actor.actor-2";
    const combat = { combatant: undefined, turns: [{ actor: first }, { actor: later }],
      combatants: [{ actor: later }, { actor: first }] }; // коллекция идёт не в порядке Инициативы
    await processFastWeavingCombatStart(combat, { round: 1, turn: 0 });
    expect(first.getFlag("warhammer-dbc", FAST_WEAVING_FLAG)).toBe(0);
    expect(later.getFlag("warhammer-dbc", FAST_WEAVING_FLAG)).toBe(2);
  });

  it("новый бой снимает метку «раз в Ход» Текучего Плетения, оставшуюся от прошлого", async () => {
    const a = actor([talent(FLUID)]);
    a.flagsStore["warhammer-dbc.fluidWeaveThisTurn"] = true;
    await processFastWeavingCombatStart({ turns: [], combatants: [{ actor: a }] }, null);
    expect(a.getFlag("warhammer-dbc", FLUID_WEAVE_TURN_FLAG)).toBeUndefined();
  });

  it("вне боя метка пула от прошлого боя не работает: ни галочки в окне, ни пула на панели", () => {
    const a = withPool(actor([talent(FAST)]), 2);
    globalThis.game.combat = undefined;
    showManifestDialog(a, power({ powerType: "aura" }));
    expect(captured.dialog.content).not.toContain("psy-fastweave");
  });

  it("хук combatStart выдаёт пул ПЕРВЫМ — раньше диалогов Колдовского Лезвия и Заготовленной Руны", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(new URL("../../module/hooks.mjs", import.meta.url), "utf8");
    const at = src.indexOf('Hooks.on("combatStart"');
    expect(at).toBeGreaterThan(-1);
    const body = src.slice(at, src.indexOf("Hooks.on(\"updateCombat\"", at));
    const iPool = body.indexOf("processFastWeavingCombatStart(combat, updateData)");
    expect(iPool).toBeGreaterThan(-1);
    expect(iPool).toBeLessThan(body.indexOf("processWitchsEdgeCombatStart(combat)"));
    expect(body).toContain("if (game.user.isGM) await processFastWeavingCombatStart(combat, updateData)");
  });

  it("манифестация не-«Атаки» из пула: полудействие покрыто пулом (−1, остаётся 1), обычные ОД целы; карточка это говорит", async () => {
    const a = inFight(withPool(actor([talent(FAST)]), 2));
    await cast(a, power({ powerType: "aura", action: "half" }), opts(9, "normal", { fastWeaving: true }), [30]);
    expect(a.getFlag("warhammer-dbc", FAST_WEAVING_FLAG)).toBe(1);
    expect(a.system.actionPoints.value).toBe(2);
    expect(plain()).toContain("Быстрое Плетение: −1 ОД");
    expect(plain()).toContain("осталось 1");
  });

  it("полное действие — 2 ОД из пула, обычные ОД целы", async () => {
    const a = inFight(withPool(actor([talent(FAST)]), 2));
    await cast(a, power({ powerType: "summon", action: "full" }), opts(9, "normal", { fastWeaving: true }), [30]);
    expect(a.getFlag("warhammer-dbc", FAST_WEAVING_FLAG)).toBe(0);
    expect(a.system.actionPoints.value).toBe(2);
  });

  it("пул перечитывается при списании: пока шёл план, другое окно уже забрало остаток — недостающее из обычных ОД, пул не уходит в минус", async () => {
    const a = inFight(withPool(actor([talent(FAST)]), 2));
    const p = power({ powerType: "aura", action: "half" });
    const plan = manifestActionPlan(a, p, { fastWeaving: true });
    expect(plan.cover).toBe(1);
    a.flagsStore[`warhammer-dbc.${FAST_WEAVING_FLAG}`] = 0;          // другое окно забрало пул
    expect((await payManifestAction(a, p, plan)).ok).toBe(true);
    expect(a.getFlag("warhammer-dbc", FAST_WEAVING_FLAG)).toBe(0);
    expect(a.system.actionPoints.value).toBe(1);
  });

  it("два окна манифестации подряд делят один пул, а не удваивают его: второе добирает из обычных ОД", async () => {
    const a = inFight(withPool(actor([talent(FAST)]), 1));
    await cast(a, power({ powerType: "aura", action: "half" }), opts(9, "normal", { fastWeaving: true }), [30]);
    expect(a.getFlag("warhammer-dbc", FAST_WEAVING_FLAG)).toBe(0);
    await cast(a, power({ powerType: "aura", action: "half" }), opts(9, "normal", { fastWeaving: true }), [30]);
    expect(a.getFlag("warhammer-dbc", FAST_WEAVING_FLAG)).toBe(0);
    expect(a.system.actionPoints.value).toBe(1);               // второй раз пул пуст — обычные ОД
  });

  it("полное действие при пуле 1: пул покрывает 1 ОД, второй списывается из обычных", async () => {
    const a = inFight(withPool(actor([talent(FAST)]), 1));
    await cast(a, power({ powerType: "summon", action: "full" }), opts(9, "normal", { fastWeaving: true }), [30]);
    expect(a.getFlag("warhammer-dbc", FAST_WEAVING_FLAG)).toBe(0);
    expect(a.system.actionPoints.value).toBe(1);
  });

  it("сила с типом «Атака» — пул не тратится, платится из обычных ОД, карточка называет причину", async () => {
    const a = inFight(withPool(actor([talent(FAST)]), 2));
    await cast(a, power({ powerType: "attack", damage: "1d10", action: "half" }), opts(9, "normal", { fastWeaving: true }), [30, 5, 5, 5, 5]);
    expect(a.getFlag("warhammer-dbc", FAST_WEAVING_FLAG)).toBe(2);
    expect(a.system.actionPoints.value).toBe(1);
    expect(plain()).toContain("без типа «Атака»");
  });

  it("Врасплох — пул не тратится, ОД платятся обычные", async () => {
    const a = inFight(withPool(actor([talent(FAST)], { surprised: true }), 2));
    await cast(a, power(), opts(9, "normal", { fastWeaving: true }), [30]);
    expect(a.getFlag("warhammer-dbc", FAST_WEAVING_FLAG)).toBe(2);
    expect(a.system.actionPoints.value).toBe(1);
    expect(plain()).toContain("Врасплох");
  });

  it("свой Ход идёт — пул уже сброшен, не тратится, ОД обычные", async () => {
    const a = withPool(actor([talent(FAST)]), 2);
    globalThis.game.combat = { started: true, round: 1, combatant: { actor: a } };
    await cast(a, power(), opts(9, "normal", { fastWeaving: true }), [30]);
    expect(a.getFlag("warhammer-dbc", FAST_WEAVING_FLAG)).toBe(2);
    expect(a.system.actionPoints.value).toBe(1);
    expect(plain()).toContain("до начала своего Хода");
  });

  it("галочка не выставлена — пул не трогается, ОД платятся обычные", async () => {
    const a = inFight(withPool(actor([talent(FAST)]), 2));
    await cast(a, power(), opts(9, "normal", {}), [30]);
    expect(a.getFlag("warhammer-dbc", FAST_WEAVING_FLAG)).toBe(2);
    expect(a.system.actionPoints.value).toBe(1);
  });

  it("окно манифестации: у носителя с пулом есть галочка «Быстрое Плетение», у «Атаки» — только причина", () => {
    const a = inFight(withPool(actor([talent(FAST)]), 2));
    showManifestDialog(a, power({ powerType: "aura" }));
    expect(captured.dialog.content).toContain('id="psy-fastweave"');
    expect(captured.dialog.content).toContain('−<span id="pm-fw-cover">1</span> ОД из пула');
    showManifestDialog(a, power({ powerType: "attack" }));
    expect(captured.dialog.content).not.toContain('id="psy-fastweave"');
    expect(captured.dialog.content).toContain("без типа «Атака»");
    showManifestDialog(actor(), power());
    expect(captured.dialog.content).not.toContain("psy-fastweave");
  });
});

// ── Текучее Плетение ────────────────────────────────────────────────────────
describe("Текучее Плетение: «Переплести» и возврат очка", () => {
  it("поддерживаемое Вливание: поддержание СНИМАЕТСЯ и заводится заново с теми же эPR, Успехами и целью (без психотеста); −1 очко, метка «переплетено»", async () => {
    const t = talent(FLUID);
    const a = actor([t]);
    const p = power({ isSustained: true, sustainedEpr: 7, sustainedDegree: 3, sustainedTargetUuid: "Actor.ally" });
    globalThis.game.user = { targets: new Set([{ actor: { uuid: "Actor.victim", name: "Чужая цель" } }]) };
    expect(await weaveFluid(a, p)).toBe(true);
    expect(t.getFlag("warhammer-dbc", FLUID_WEAVE_SPENT_FLAG)).toBe(1);
    // сначала общий патч «поддержание снято» (psychic-sustain.mjs::sustainOffPatch) …
    expect(p.updates[0]).toMatchObject({
      "system.isSustained": false, "system.sustainedDegree": null, "system.sustainedEpr": null, "system.sustainedTargetUuid": ""
    });
    // … затем новое поддержание с прежними числами и прежней целью (таргет сцены цель не подменяет)
    expect(p.updates.length).toBe(2);
    expect(p.updates[1]).toMatchObject({ "system.isSustained": true, "system.sustainedEpr": 7, "system.sustainedDegree": 3, "system.sustainedTargetUuid": "Actor.ally" });
    expect(p.updates[1]["flags.warhammer-dbc.rewoven"]).toMatchObject({ epr: 7, degree: 3 });
    expect(p.system).toMatchObject({ isSustained: true, sustainedEpr: 7, sustainedDegree: 3, sustainedTargetUuid: "Actor.ally" });
    expect(p.getFlag("warhammer-dbc", "rewoven")).toMatchObject({ epr: 7, degree: 3 });
    expect(plain()).toContain("эPR 7");
    expect(plain()).toContain("без психотеста");
    expect(captured.rolls.filter(f => String(f).startsWith("1d100"))).toEqual([]); // психотеста нет
  });

  it("переплетение не теряет купленные свойства Force Blade и метку «бесплатная» Раны в Реальности", async () => {
    const t = talent(FLUID);
    const a = actor([t]);
    const buff = { enabled: true, scope: "equipped", damageMod: 0, penMod: 0, rangeMod: 0, balanceMod: 0, addProps: [{ key: "felling", rating: 2 }] };
    const p = power({ powerType: "psychicBlade", hasWeaponShop: true, isSustained: true, sustainedEpr: 5, sustainedDegree: 4, effects: { weaponBuff: buff } });
    p.flags = { "warhammer-dbc": { [WOUND_FREE_FLAG]: true } };
    expect(await weaveFluid(a, p)).toBe(true);
    expect(p.system.effects.weaponBuff).toEqual(buff);
    expect(p.getFlag("warhammer-dbc", WOUND_FREE_FLAG)).toBe(true);
    expect(p.system.isSustained).toBe(true);
  });

  it("в бою — метка «раз в Ход»: второе переплетение отказано, очко не тратится", async () => {
    globalThis.game.combat = { started: true, round: 1, combatant: { actor: null } };
    const t = talent(FLUID);
    const a = actor([t]);
    const p = power({ isSustained: true, sustainedEpr: 5, sustainedDegree: 1 });
    expect(await weaveFluid(a, p)).toBe(true);
    expect(a.getFlag("warhammer-dbc", FLUID_WEAVE_TURN_FLAG)).toBe(true);
    expect(await weaveFluid(a, p)).toBe(false);
    expect(t.getFlag("warhammer-dbc", FLUID_WEAVE_SPENT_FLAG)).toBe(1);
    expect(captured.warnings.join(" ")).toContain("раз в Ход");
  });

  it("Атака, не поддерживаемая сила и пустой пул — отказ без траты", async () => {
    const t = talent(FLUID, { [FLUID_WEAVE_SPENT_FLAG]: 4 });
    const a = actor([t]);
    expect(await weaveFluid(a, power({ isSustained: true, powerType: "attack" }))).toBe(false);
    expect(await weaveFluid(a, power({ isSustained: false }))).toBe(false);
    expect(await weaveFluid(a, power({ isSustained: true }))).toBe(false); // пул пуст (4 из 4 потрачено)
    expect(t.getFlag("warhammer-dbc", FLUID_WEAVE_SPENT_FLAG)).toBe(4);
  });

  it("полное действие концентрации возвращает 1 очко; вне боя ОД не нужны; полный пул — нечего возвращать", async () => {
    const t = talent(FLUID, { [FLUID_WEAVE_SPENT_FLAG]: 2 });
    const a = actor([t]);
    expect(await restoreFluidWeavePoint(a)).toBe(true);
    expect(t.getFlag("warhammer-dbc", FLUID_WEAVE_SPENT_FLAG)).toBe(1);
    const full = talent(FLUID, { [FLUID_WEAVE_SPENT_FLAG]: 0 });
    expect(await restoreFluidWeavePoint(actor([full]))).toBe(false);
  });

  it("в бою восстановление стоит 2 ОД и засчитывается как Концентрация (одна в Ход)", async () => {
    globalThis.game.combat = { started: true, round: 1, combatant: { actor: null } };
    const t = talent(FLUID, { [FLUID_WEAVE_SPENT_FLAG]: 3 });
    const a = actor([t]);
    expect(await restoreFluidWeavePoint(a)).toBe(true);
    expect(a.system.actionPoints.value).toBe(0);
    expect(a.getFlag("warhammer-dbc", "concentrationActionsThisTurn")).toBe(1);
    a.system.actionPoints.value = 2;
    expect(await restoreFluidWeavePoint(a)).toBe(false); // вторая Концентрация в Ход
    expect(t.getFlag("warhammer-dbc", FLUID_WEAVE_SPENT_FLAG)).toBe(2);
  });
});

// ── Ключевые Силы ───────────────────────────────────────────────────────────
describe("Ключевые Силы: бесплатное Очко Бесчестия на карточке СВОЕЙ манифестации", () => {
  const sigActor = (opt = {}) => actor([talent(SIG, { [SIGNATURE_FLAG]: ["Aegis"] })], opt);

  it("карточка ключевой силы несёт блок бесплатного Очка и кнопки; у чужой силы и без Таланта — нет", async () => {
    await cast(sigActor(), power(), opts(9, "normal"), [30]);
    expect(chatText()).toContain("wh-signature-free");
    expect(chatText()).not.toContain('data-ability="reroll"'); // переброса психотеста карточка не даёт
    expect(chatText()).toContain('data-ability="success"'); // манифестация удалась
    await cast(sigActor(), power({}, "Другая / Other"), opts(9, "normal"), [30]);
    expect(chatText()).not.toContain("wh-signature-free");
    await cast(actor(), power(), opts(9, "normal"), [30]);
    expect(chatText()).not.toContain("wh-signature-free");
  });

  it("провалившийся психотест — «Успех» не предлагается", async () => {
    await cast(sigActor(), power(), opts(9, "normal"), [95]);
    expect(chatText()).not.toContain('data-ability="success"');
    expect(chatText()).toContain("wh-signature-free"); // блок про Очко есть, кнопок способностей нет
    expect(chatText()).not.toContain("wh-signature-free-btn");
  });

  it("Феномен ключевой силы: кнопки Усмирения Варпа знают силу (data-power-uuid)", async () => {
    await cast(sigActor(), power(), opts(9, "push"), [30, 20]);
    expect(chatText()).toMatch(/class="wh-calm-warp-btn"[^>]*data-power-uuid="Actor.actor-1.Item.p1"/);
  });

  let msgSeq = 0;
  const msg = () => {
    const flags = {};
    return { id: `m${++msgSeq}`, isOwner: true, getFlag: (s, k) => flags[k], setFlag: async (s, k, v) => { flags[k] = v; } };
  };
  const click = async (a, p, table = "phenomenon", message = msg()) => {
    globalThis.fromUuid = async uuid => (uuid === a.uuid ? a : uuid === p.uuid ? p : null);
    const btn = { dataset: { actorUuid: a.uuid, powerUuid: p.uuid, table, phenMod: "0" }, disabled: false };
    captured.chat.length = 0;
    await handleCalmWarpClick(message, btn);
  };

  it("Усмирение Варпа на карточке ключевой силы — бесплатно: Очко не списано, право раз в Раунд занято", async () => {
    globalThis.game.combat = { started: true, round: 2, combatant: { actor: null } };
    const a = sigActor({ fate: 2 }), p = power();
    captured.dice = [20];
    await click(a, p);
    expect(a.system.fate.value).toBe(2);
    expect(plain()).toContain("Бесплатно: ключевая сила");
    // тот же Раунд, второй переброс другого броска — уже платный
    captured.dice = [20];
    await click(a, p, "peril");
    expect(a.system.fate.value).toBe(1);
    // следующий Раунд — снова бесплатно
    globalThis.game.combat = { started: true, round: 3, combatant: { actor: null } };
    captured.dice = [20];
    await click(a, p);
    expect(a.system.fate.value).toBe(1);
  });

  it("чужая сила (не из списка) — Очко платится как обычно", async () => {
    globalThis.game.combat = { started: true, round: 2, combatant: { actor: null } };
    const a = sigActor({ fate: 2 }), other = power({}, "Другая / Other");
    captured.dice = [20];
    await click(a, other);
    expect(a.system.fate.value).toBe(1);
  });

  it("Штиль после бесплатного переброса: оставить изначальный результат освобождает право Раунда", async () => {
    globalThis.game.combat = { started: true, round: 2, combatant: { actor: null } };
    const a = actor([talent(SIG, { [SIGNATURE_FLAG]: ["Aegis"] }),
      { id: "cw", type: "talent", name: "Calm Winds / Штиль", system: {}, flags: {}, getFlag: () => undefined }], { fate: 2 });
    const p = power();
    captured.confirmAnswer = true;
    captured.dice = [20];
    const m = msg();
    await click(a, p, "phenomenon", m);
    expect(plain()).toContain("снова доступно");
    expect(signatureFreeHtml(a, p, { success: true })).toContain("wh-signature-free-btn");
    expect(a.system.fate.value).toBe(2);
    expect(m.getFlag("warhammer-dbc", "signatureFreeUsed")).toBeFalsy();
    // право реально вернулось: следующий переброс на другой карточке снова бесплатный
    captured.dice = [20];
    await click(a, p, "peril");
    expect(a.system.fate.value).toBe(2);
  });

  it("вне боя Раунда нет — но одна карточка даёт одно бесплатное Очко, а не по одному на каждый переброс", async () => {
    const a = sigActor({ fate: 3 }), p = power();
    const m = msg();
    captured.dice = [20];
    await click(a, p, "phenomenon", m);
    expect(a.system.fate.value).toBe(3);
    captured.dice = [20];
    await click(a, p, "peril", m);
    expect(a.system.fate.value).toBe(2); // вторая трата с той же карточки уже платная
  });

  const freeBtn = (a, p, ability) => ({ dataset: { actorUuid: a.uuid, powerUuid: p.uuid, ability }, disabled: false });

  it("кнопка способности «Успех» бесплатна: Очко не списано, Успехи силы +1, карточка Очков говорит «Бесплатно», право Раунда занято", async () => {
    globalThis.game.combat = { started: true, round: 4, combatant: { actor: null } };
    const a = sigActor({ fate: 2 }), p = power({ sustainedDegree: 3 });
    globalThis.fromUuid = async uuid => (uuid === a.uuid ? a : uuid === p.uuid ? p : null);
    captured.chat.length = 0;
    expect(await handleSignatureFreeClick(msg(), freeBtn(a, p, "success"))).toBe(true);
    expect(a.system.fate.value).toBe(2);
    expect(p.system.sustainedDegree).toBe(4);
    expect(plain()).toContain("Бесплатно (Ключевые Силы");
    // другая карточка того же Раунда — уже нельзя
    expect(await handleSignatureFreeClick(msg(), freeBtn(a, p, "success"))).toBe(false);
    expect(p.system.sustainedDegree).toBe(4);
    expect(captured.warnings.join(" ")).toContain("уже использовано");
  });

  it("покровитель Тзинч: бесплатный «Успех» прибавляет силе столько Успехов, сколько дала Вспышка Гения", async () => {
    const a = sigActor({ fate: 2 }), p = power({ sustainedDegree: 3 });
    a.system.patronGod = "tzeentch";
    globalThis.fromUuid = async uuid => (uuid === a.uuid ? a : uuid === p.uuid ? p : null);
    captured.chat.length = 0; captured.dice = [4];
    expect(await handleSignatureFreeClick(msg(), freeBtn(a, p, "success"))).toBe(true);
    expect(plain()).toContain("Вспышка Гения: + 4 Успехов");
    expect(p.system.sustainedDegree).toBe(7);
  });

  it("кнопка работает только для ключевой силы и только владельцу", async () => {
    const a = sigActor({ fate: 2 }), other = power({}, "Другая / Other");
    globalThis.fromUuid = async uuid => (uuid === a.uuid ? a : uuid === other.uuid ? other : null);
    expect(await handleSignatureFreeClick(msg(), freeBtn(a, other, "success"))).toBe(false);
    a.isOwner = false;
    expect(await handleSignatureFreeClick(msg(), freeBtn(a, power(), "success"))).toBe(false);
  });

  it("«Переброс» кнопкой не принимается — он ничего бы не бросил, а право Раунда сжёг", async () => {
    globalThis.game.combat = { started: true, round: 6, combatant: { actor: null } };
    const a = sigActor({ fate: 2 }), p = power();
    globalThis.fromUuid = async uuid => (uuid === a.uuid ? a : uuid === p.uuid ? p : null);
    expect(await handleSignatureFreeClick(msg(), freeBtn(a, p, "reroll"))).toBe(false);
    expect(signatureFreeHtml(a, p, { success: true })).toContain("wh-signature-free-btn"); // право не занято
  });

  it("раз в Раунд: после занятого права блок на новой карточке сообщает, что Очко уже использовано", async () => {
    globalThis.game.combat = { started: true, round: 5, combatant: { actor: null } };
    const a = sigActor(), p = power();
    expect(signatureFreeHtml(a, p, { success: true })).toContain("wh-signature-free-btn");
    await a.setFlag("warhammer-dbc", `usageLimits.${SIGNATURE_USAGE_KEY.replace(/\./g, "-")}`, { scope: "round", used: true, round: 5 });
    const html = signatureFreeHtml(a, p, { success: true });
    expect(html).not.toContain("wh-signature-free-btn");
    expect(html).toContain("уже использовано");
  });
});

// ── Лист: звёздочка, «Переплести», пулы ─────────────────────────────────────
describe("Вкладка МИСТИКА: пулы и звёздочки", () => {
  const sheetFor = items => {
    const sheet = sheetOf(WarhammerCharacterSheet, {
      items, characteristics: { int: { value: 40, total: 40, bonus: 4 } }, skills: {}, groupSkills: {},
      psyker: { rating: 5, currentRating: 5 }
    });
    sheet.actor.items.contents = sheet.actor.items;
    return sheet;
  };
  const powerDoc = (id, name, system) => ({ id, name, type: "psychicPower", system: { testChar: "wp", prRequired: 1, ...system }, getFlag: () => undefined });

  it("без Талантов пулов нет, у силы нет ни звёздочки, ни «Переплести»", () => {
    const ctx = buildGetData(sheetFor([powerDoc("a", "Aegis", { powerType: "infusion", isSustained: true })]).actor);
    expect(ctx.psyPools).toBeNull();
    expect(ctx.psyPowers[0].weave).toBeNull();
    expect(ctx.psyPowers[0].isSignature).toBe(false);
  });

  it("с тремя Талантами: пулы, звёздочка у выбранной, «Переплести» у поддерживаемого Вливания, не у Атаки", () => {
    const items = [talent(FLUID), talent(FAST), talent(SIG, { [SIGNATURE_FLAG]: ["Aegis"] }),
      powerDoc("a", "Aegis / Эгида", { powerType: "infusion", isSustained: true }),
      powerDoc("b", "Smite / Сокрушение", { powerType: "attack" })];
    globalThis.game.combat = { started: true, round: 1, combatant: { actor: null } };
    const sheet = sheetFor(items);
    const baseGetFlag = sheet.actor.getFlag;
    sheet.actor.getFlag = (s, k) => (k === FAST_WEAVING_FLAG ? 1 : baseGetFlag?.call(sheet.actor, s, k));
    const ctx = buildGetData(sheet.actor);
    expect(ctx.psyPools.fluid).toMatchObject({ left: 4, max: 4, canRestore: false });
    expect(ctx.psyPools.fast).toMatchObject({ left: 1, max: 2 });
    expect(ctx.psyPools.signature).toMatchObject({ count: 1, limit: 4 });
    const a = ctx.psyPowers.find(p => p.id === "a"), b = ctx.psyPowers.find(p => p.id === "b");
    expect(a.isSignature).toBe(true);
    expect(a.weave.ok).toBe(true);
    expect(b.isSignature).toBe(false);
    expect(b.weave).toBeNull();
  });

  it("вне боя панель показывает пустой пул Быстрого Плетения, даже если метка осталась от прошлого боя", () => {
    globalThis.game.combat = undefined;
    const sheet = sheetFor([talent(FAST)]);
    sheet.actor.getFlag = (s, k) => (k === FAST_WEAVING_FLAG ? 2 : undefined);
    expect(buildGetData(sheet.actor).psyPools.fast.left).toBe(0);
  });

  it("звёздочка: клик отмечает силу на Таланте; сверх I.b — предупреждение, метка не растёт", async () => {
    const sig = talent(SIG, { [SIGNATURE_FLAG]: ["A", "B", "C", "D"] });
    const a = actor([sig, power({}, "E / Е")]);
    const html = listenerHtml();
    activatePsychicListeners(html, a, {});
    await html.handlers[".psy-signature-toggle:click"]({ preventDefault() {}, currentTarget: { dataset: { itemId: "p1" } } });
    expect(sig.getFlag("warhammer-dbc", SIGNATURE_FLAG)).toEqual(["A", "B", "C", "D"]);
    expect(captured.warnings.join(" ")).toContain("I.b");
    const room = talent(SIG, { [SIGNATURE_FLAG]: ["A"] });
    const b = actor([room, power({}, "E / Е")]);
    const html2 = listenerHtml();
    activatePsychicListeners(html2, b, {});
    await html2.handlers[".psy-signature-toggle:click"]({ preventDefault() {}, currentTarget: { dataset: { itemId: "p1" } } });
    expect(room.getFlag("warhammer-dbc", SIGNATURE_FLAG)).toEqual(["A", "E"]);
  });

  it("кнопка «Переплести» и «+1 ⟳» на листе зовут обработчики", async () => {
    const t = talent(FLUID, { [FLUID_WEAVE_SPENT_FLAG]: 1 });
    const p = power({ isSustained: true, sustainedEpr: 4, sustainedDegree: 2 });
    const a = actor([t, p]);
    const html = listenerHtml();
    activatePsychicListeners(html, a, {});
    await html.handlers[".psy-weave-btn:click"]({ preventDefault() {}, currentTarget: { dataset: { itemId: "p1" } } });
    expect(t.getFlag("warhammer-dbc", FLUID_WEAVE_SPENT_FLAG)).toBe(2);
    await html.handlers[".psy-fluid-restore-btn:click"]({ preventDefault() {} });
    expect(t.getFlag("warhammer-dbc", FLUID_WEAVE_SPENT_FLAG)).toBe(1);
  });
});

// ── Действие манифестации списывает ОД в бою ────────────────────────────────
describe("Манифестация в бою списывает ОД по данным самой силы", () => {
  const inFight = a => { globalThis.game.combat = { started: true, round: 1, combatant: { actor: null } }; return a; };
  const ap = a => a.system.actionPoints.value;

  it("Полудействие — 1 ОД, Полное — 2 ОД, Длительное — 2 ОД; карточка называет списание", async () => {
    const a = inFight(actor());
    await cast(a, power({ action: "half" }), opts(9, "normal"), [30]);
    expect(ap(a)).toBe(1);
    expect(plain()).toContain("Действие: Полудействие — списано 1 ОД");
    const b = inFight(actor());
    await cast(b, power({ action: "full" }), opts(9, "normal"), [30]);
    expect(ap(b)).toBe(0);
    const c = inFight(actor());
    await cast(c, power({ action: "extended" }), opts(9, "normal"), [30]);
    expect(ap(c)).toBe(0);
  });

  it("Свободное действие ОД не стоит", async () => {
    const a = inFight(actor());
    await cast(a, power({ action: "free" }), opts(9, "normal"), [30]);
    expect(ap(a)).toBe(2);
  });

  it("Реакция тратит Реакцию, а не ОД", async () => {
    const a = inFight(actor());
    await cast(a, power({ action: "reaction" }), opts(9, "normal"), [30]);
    expect(ap(a)).toBe(2);
    expect(a.system.reactions.value).toBe(0);
  });

  it("не хватает ОД — отказ: психотеста нет, карточки нет, ничего не списано", async () => {
    const a = inFight(actor());
    a.system.actionPoints.value = 1;
    await cast(a, power({ action: "full" }), opts(9, "normal"), [30]);
    expect(captured.chat.length).toBe(0);
    expect(ap(a)).toBe(1);
    expect(captured.warnings.join(" ")).toContain("Не хватает ОД");
  });

  it("не хватает Реакции — отказ", async () => {
    const a = inFight(actor());
    a.system.reactions.value = 0;
    await cast(a, power({ action: "reaction" }), opts(9, "normal"), [30]);
    expect(captured.chat.length).toBe(0);
  });

  it("вне боя ОД не тратятся вовсе", async () => {
    const a = actor();
    globalThis.game.combat = undefined;
    await cast(a, power({ action: "full" }), opts(9, "normal"), [30]);
    expect(ap(a)).toBe(2);
    expect(captured.chat.length).toBeGreaterThan(0);
  });

  it("Оглушённый не может манифестировать в бою — отказ по состоянию", async () => {
    const a = inFight(actor());
    a.system.conditions.stunned = true;
    await cast(a, power({ action: "half" }), opts(9, "normal"), [30]);
    expect(captured.chat.length).toBe(0);
    expect(ap(a)).toBe(2);
  });

  it("окно манифестации в бою сообщает цену действия", () => {
    const a = inFight(actor());
    showManifestDialog(a, power({ action: "full" }));
    expect(captured.dialog.content).toContain("стоит 2 ОД");
  });

  // Путь Силы двигает ступень действия (constants/psyker.mjs::PSY_PATHS): Инкантация — Полудействие→Полное,
  // Руна Судьбы — на ступень ниже, до Свободного только первой психосилой Раунда.
  it("Путь «Инкантация»: Полудействие поднимается до Полного — 2 ОД", async () => {
    const a = inFight(actor());
    await cast(a, power({ action: "half" }), opts(9, "normal", { path: "incantation" }), [30]);
    expect(ap(a)).toBe(0);
    expect(plain()).toContain("Действие: Полное действие — списано 2 ОД");
  });

  it("Путь «Руна Судьбы»: Полное снижается до Полудействия — 1 ОД", async () => {
    const a = inFight(actor());
    await cast(a, power({ action: "full" }), opts(9, "normal", { path: "runeFate" }), [30]);
    expect(ap(a)).toBe(1);
    expect(plain()).toContain("Действие: Полудействие — списано 1 ОД");
  });

  it("Руна Судьбы: Полудействие до Свободного — только первой психосилой Раунда", async () => {
    const a = inFight(actor());
    await cast(a, power({ action: "half" }), opts(9, "normal", { path: "runeFate" }), [30]);
    expect(ap(a)).toBe(2);
    await cast(a, power({ action: "half" }), opts(9, "normal", { path: "runeFate" }), [30]);
    expect(ap(a)).toBe(1);
    // Новый бой с тем же номером Раунда — снова первая психосила.
    globalThis.game.combat = { started: true, id: "other", round: 1, combatant: { actor: null } };
    await cast(a, power({ action: "half" }), opts(9, "normal", { path: "runeFate" }), [30]);
    expect(ap(a)).toBe(1);
  });

  it("Руны Сигиллитов с подпутём Инкантация поднимают Полудействие до Полного; без подпутя — нет", () => {
    const a = inFight(actor());
    expect(manifestActionPlan(a, power({ action: "half" }), { path: "sigillite", subPaths: ["incantation"] }).cost).toBe(2);
    expect(manifestActionPlan(a, power({ action: "half" }), { path: "sigillite", subPaths: ["meditation"] }).cost).toBe(1);
  });

  it("окно: строка цены ОД и покрытие пулом Быстрого Плетения пересчитываются по выбранному Пути", () => {
    const a = inFight(withPool(actor([talent(FAST)]), 2));
    showManifestDialog(a, power({ action: "half" }));
    expect(captured.dialog.content).toContain('id="pm-fw-cover"');
    let nodes = {};
    const shown = path => {
      const vals = { "#psy-pr": "9", "#psy-pr-mod": "0", "#psy-mod": "0", "#psy-path": path, "#psy-variant": "-1",
        "#psy-push-bonus": "1", "#psy-rune-strike": "0", "#psy-mode": "normal" };
      nodes = {};
      const node = sel => (nodes[sel] ??= { value: vals[sel] ?? "", textContent: "", style: {},
        classList: { toggle() {}, remove() {}, add() {} }, addEventListener() {}, checked: false, dataset: {} });
      captured.dialog.render({ querySelector: node, querySelectorAll: () => [], closest: () => null });
      return nodes["#pm-ap-line"].textContent;
    };
    expect(shown("")).toContain("стоит 1 ОД");
    expect(nodes["#pm-fw-cover"].textContent).toBe("1");
    expect(shown("incantation")).toContain("стоит 2 ОД");
    expect(nodes["#pm-fw-cover"].textContent).toBe("2");
    expect(shown("runeFate")).toContain("стоит 0 ОД");
    expect(nodes["#pm-fw-cover"].textContent).toBe("0");
  });
});

// ── Переброс психотеста Ключевой Силой ───────────────────────────────────────
describe("Ключевые Силы: переброс психотеста с карточки своей ключевой силы", () => {
  const sigActor = (opt = {}) => actor([talent(SIG, { [SIGNATURE_FLAG]: ["Aegis"] })], opt);
  let seq = 0;
  /** Сообщение-заглушка по флагам, которые карточка реально положила в чат. */
  const messageOf = card => {
    const f = { ...(card?.flags?.["warhammer-dbc"] ?? {}) };
    return { id: `rr${++seq}`, isOwner: true, flags: { "warhammer-dbc": f }, getFlag: (s, k) => f[k], setFlag: async (s, k, v) => { f[k] = v; } };
  };
  const lastCard = () => captured.chat.filter(c => c.flags).at(-1);
  const btn = (a, p) => ({ dataset: { actorUuid: a.uuid, powerUuid: p.uuid }, disabled: false });
  const wire = (a, p) => { globalThis.fromUuid = async uuid => (uuid === a.uuid ? a : uuid === p.uuid ? p : null); };

  it("карточка своей ключевой силы хранит параметры броска (без функций) и кнопку «Переброс»; чужая сила и без Таланта — нет", async () => {
    const a = sigActor(), p = power();
    await cast(a, p, opts(9, "push", { path: "", extraFn: () => {} }), [30, 20]);
    const saved = lastCard()?.flags?.["warhammer-dbc"]?.psyManifest;
    expect(saved).toMatchObject({ actorUuid: a.uuid, powerUuid: p.uuid });
    expect(saved.opts).toMatchObject({ mPR: 9, mode: "push" });
    expect(saved.opts).not.toHaveProperty("extraFn");
    expect(JSON.parse(JSON.stringify(saved))).toEqual(saved);
    expect(chatText()).toContain("wh-psy-reroll-btn");
    await cast(sigActor(), power({}, "Другая / Other"), opts(9, "normal"), [30]);
    expect(lastCard()).toBeUndefined();
    expect(chatText()).not.toContain("wh-psy-reroll-btn");
    await cast(actor(), p, opts(9, "normal"), [30]);
    expect(chatText()).not.toContain("wh-psy-reroll-btn");
  });

  it("Огонь Души (манифестация с onResult) не перебрасывается: результат уже влил урон в попадание", async () => {
    const a = sigActor(), p = power();
    await cast(a, p, opts(9, "normal", { onResult: () => {} }), [30]);
    expect(lastCard()).toBeUndefined();
    expect(chatText()).not.toContain("wh-psy-reroll-btn");
  });

  it("бесплатный переброс раз в Раунд: Очко не списано, тот же тест с теми же параметрами, старая карточка помечена заменённой", async () => {
    globalThis.game.combat = { started: true, round: 3, combatant: { actor: null } };
    const a = sigActor({ fate: 2 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "normal", { modifier: -10 }), [95]);       // провал
    expect(p.system.sustainedDegree).toBeNull();
    const old = messageOf(lastCard());
    captured.chat.length = 0; captured.rolls.length = 0; captured.dice = [30];
    expect(await handlePsyRerollClick(old, btn(a, p))).toBe(true);
    expect(a.system.fate.value).toBe(2);
    expect(p.system.sustainedDegree).toBeGreaterThan(0);                // поддержание пересчитано новым результатом
    expect(plain()).toContain("Переброс психотеста");
    expect(plain()).toContain("Порог 75");                                // те же модификаторы (−10)
    expect(old.getFlag("warhammer-dbc", "psyRerolled")).toBe(true);
    // новая карточка не перебрасывается повторно
    expect(chatText()).not.toContain("wh-psy-reroll-btn");
    expect(lastCard()?.flags?.["warhammer-dbc"]?.psyManifest).toBeUndefined();
  });

  it("переброс не повторяет разовые траты: ОД, пул Быстрого Плетения и Очко Возрождения", async () => {
    const a = sigActor({ fate: 2 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "normal"), [95]);
    const old = messageOf(lastCard());
    globalThis.game.combat = { started: true, round: 3, combatant: { actor: null } };
    captured.dice = [30];
    await handlePsyRerollClick(old, btn(a, p));
    expect(a.system.actionPoints.value).toBe(2);
  });

  it("переброс берёт те же Психофокус и Усиление, а не бросает их заново", async () => {
    const a = sigActor({ fate: 3, cls: "unbound" }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "push", { path: "psychofocus" }), [4, 10, 95, 20]);  // d5 Усиления 4, фокус 10, тест 95, Феномен 20
    const saved = lastCard().flags["warhammer-dbc"].psyManifest;
    expect(saved.rolled).toMatchObject({ focusRoll: 10, pushBonus: 4 });
    const old = messageOf(lastCard());
    captured.chat.length = 0; captured.rolls.length = 0;
    captured.dice = [30, 20];                                  // ТОЛЬКО тест и Феномен: фокус и d5 повторно не бросаются
    expect(await handlePsyRerollClick(old, btn(a, p))).toBe(true);
    expect(plain()).toContain("Усиление +4");
    expect(plain()).toContain("бросок 10");                    // тот же Психофокус
    expect(captured.dice.length).toBe(0);
  });

  it("проваленный переброс уже поддерживаемой силы снимает поддержание", async () => {
    const a = sigActor({ fate: 3 }), p = power({ isSustained: true, sustainedDegree: 2, sustainedEpr: 9 });
    wire(a, p);
    await cast(a, p, opts(9, "normal"), [30]);
    const old = messageOf(lastCard());
    p.system.isSustained = true;                               // игрок поставил «Подд.» после успеха
    captured.dice = [95];
    await handlePsyRerollClick(old, btn(a, p));
    expect(p.system.isSustained).toBe(false);
    expect(p.system.sustainedDegree).toBeNull();
    expect(plain()).toContain("поддержание силы снято");
  });

  it("новая карточка бесплатного переброса сразу помечена как занятая: Усмирение Варпа на ней платное", async () => {
    const a = sigActor({ fate: 3 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "normal"), [95]);
    const old = messageOf(lastCard());
    const origCreate = ChatMessage.create;
    const created = [];
    ChatMessage.create = async d => { const f = {}; Object.assign(d, { id: `new${created.length}`, isOwner: true, getFlag: (s, k) => f[k], setFlag: async (s, k, v) => { f[k] = v; } }); created.push(d); captured.chat.push(d); return d; };
    try {
      captured.dice = [30];
      await handlePsyRerollClick(old, btn(a, p));
    } finally { ChatMessage.create = origCreate; }
    expect(created.some(c => cardOnceUsed(c, "signatureFreeUsed"))).toBe(true);
  });

  it("кнопка «бесплатно» при уже занятом Очке Раунда спрашивает, прежде чем взять Очко Бесчестия", async () => {
    globalThis.game.combat = { started: true, round: 8, combatant: { actor: null } };
    const a = sigActor({ fate: 2 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "normal"), [95]);
    const old = messageOf(lastCard());
    await a.setFlag("warhammer-dbc", `usageLimits.${SIGNATURE_USAGE_KEY.replace(/\./g, "-")}`, { scope: "round", used: true, round: 8 });
    const b = { dataset: { actorUuid: a.uuid, powerUuid: p.uuid, free: "1" } };
    captured.confirmAnswer = false;
    captured.dice = [30];
    expect(await handlePsyRerollClick(old, b)).toBe(false);
    expect(a.system.fate.value).toBe(2);
    expect(captured.dialog.content).toContain("1 Очко Бесчестия");
    captured.confirmAnswer = true;
    expect(await handlePsyRerollClick(old, b)).toBe(true);
    expect(a.system.fate.value).toBe(1);
  });

  it("вне боя: после бесплатного переброса новая карточка не предлагает второго бесплатного Очка", async () => {
    const a = sigActor({ fate: 3 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "normal"), [95]);
    const old = messageOf(lastCard());
    captured.chat.length = 0; captured.dice = [30];
    await handlePsyRerollClick(old, btn(a, p));
    expect(chatText()).not.toContain("wh-signature-free-btn");
    expect(plain()).toContain("уже использовано");
  });

  it("«Переплести» не трогает силу, заточённую в Плоде Плоти", async () => {
    const t = talent(FLUID);
    const a = actor([t]);
    const p = power({ isSustained: true, sustainedEpr: 5, sustainedDegree: 2 });
    p.flags = { "warhammer-dbc": { fruitOfFleshLockUuid: "Actor.fruit" } };
    globalThis.fromUuid = async uuid => (uuid === "Actor.fruit" ? { name: "Плод" } : null);
    expect(await weaveFluid(a, p)).toBe(false);
    expect(t.getFlag("warhammer-dbc", FLUID_WEAVE_SPENT_FLAG)).toBeUndefined();
    expect(p.updates).toEqual([]);
    expect(captured.warnings.join(" ")).toContain("Плоде Плоти");
    globalThis.fromUuid = async () => null;                    // плод уничтожен — замка нет
    expect(await weaveFluid(a, p)).toBe(true);
  });

  it("переброс в бою не платит ни пул Быстрого Плетения, ни ОД заново", async () => {
    const a = sigActor({ fate: 3 }), p = power({ powerType: "aura" });
    a.system.actionPoints.value = 2;
    a.flagsStore["warhammer-dbc.fastWeavingAp"] = 1;
    a.items.push(talent(FAST));
    wire(a, p);
    globalThis.game.combat = { started: true, round: 2, combatant: { actor: null } };
    await cast(a, p, opts(9, "normal", { fastWeaving: true }), [95]);
    expect(a.getFlag("warhammer-dbc", "fastWeavingAp")).toBe(0);
    expect(a.system.actionPoints.value).toBe(2);
    const old = messageOf(lastCard());
    captured.dice = [30];
    await handlePsyRerollClick(old, btn(a, p));
    expect(a.getFlag("warhammer-dbc", "fastWeavingAp")).toBe(0);
    expect(a.system.actionPoints.value).toBe(2);
  });

  it("переброс не платит Раны Телесной Конверсии второй раз", async () => {
    const a = sigActor({ fate: 2 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "normal", { path: "corpus" }), [95]);
    const afterFirst = a.system.wounds.value;
    expect(afterFirst).toBeLessThan(8);
    const old = messageOf(lastCard());
    captured.dice = [30];
    await handlePsyRerollClick(old, btn(a, p));
    expect(a.system.wounds.value).toBe(afterFirst);
  });

  it("переброс не платит Очко Психического Возрождения второй раз", async () => {
    const res = { id: "res", type: "talent", name: "Psychic Resurgence / Психическое Возрождение", system: {}, flags: {}, getFlag: () => undefined };
    const a = actor([talent(SIG, { [SIGNATURE_FLAG]: ["Aegis"] }), res], { fate: 3 }), p = power();
    a.system.psyker.currentRating = 7;                     // поддержание съело 2 PR; mPR 9 — только за Очко
    wire(a, p);
    await cast(a, p, opts(9, "normal"), [95]);
    expect(a.system.fate.value).toBe(2);
    const old = messageOf(lastCard());
    globalThis.game.combat = { started: true, round: 3, combatant: { actor: null } };
    captured.dice = [30];
    await handlePsyRerollClick(old, btn(a, p));
    expect(a.system.fate.value).toBe(2);                   // бесплатный переброс и без повторной платы Возрождения
  });

  it("в тот же Раунд второй переброс (другая карточка) платный: −1 Очко Бесчестия", async () => {
    globalThis.game.combat = { started: true, round: 4, combatant: { actor: null } };
    const a = sigActor({ fate: 2 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "normal"), [95]);
    const first = messageOf(lastCard());
    await cast(a, p, opts(9, "normal"), [95]);
    const second = messageOf(lastCard());
    captured.dice = [30];
    await handlePsyRerollClick(first, btn(a, p));
    expect(a.system.fate.value).toBe(2);
    captured.dice = [30];
    expect(await handlePsyRerollClick(second, btn(a, p))).toBe(true);
    expect(a.system.fate.value).toBe(1);
    expect(plain()).toContain("−1 Очко Бесчестия");
  });

  it("платный переброс без Очков — отказ, ничего не брошено", async () => {
    globalThis.game.combat = { started: true, round: 5, combatant: { actor: null } };
    const a = sigActor({ fate: 0 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "normal"), [95]);
    const first = messageOf(lastCard());
    await cast(a, p, opts(9, "normal"), [95]);
    const second = messageOf(lastCard());
    captured.dice = [30];
    await handlePsyRerollClick(first, btn(a, p));        // бесплатный
    captured.chat.length = 0;
    captured.dice = [30];
    expect(await handlePsyRerollClick(second, btn(a, p))).toBe(false);
    expect(captured.chat.length).toBe(0);
    expect(second.getFlag("warhammer-dbc", "psyRerolled")).toBeFalsy();
  });

  it("одну карточку перебрасывают один раз", async () => {
    const a = sigActor({ fate: 3 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "normal"), [95]);
    const old = messageOf(lastCard());
    captured.dice = [30];
    expect(await handlePsyRerollClick(old, btn(a, p))).toBe(true);
    expect(await handlePsyRerollClick(old, btn(a, p))).toBe(false);
  });

  it("Варп-Замок после карточки: переброс не манифестирует, ничего не брошено и не списано", async () => {
    const a = sigActor({ fate: 3 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "normal"), [95]);
    const old = messageOf(lastCard());
    await a.setFlag("warhammer-dbc", WARP_LOCK_FLAG, true);
    captured.chat.length = 0; captured.dice = [30];
    expect(await handlePsyRerollClick(old, btn(a, p))).toBe(false);
    expect(captured.chat.length).toBe(0);
    expect(a.system.fate.value).toBe(3);
    expect(captured.warnings.join(" ")).toContain("Варп-Замок");
  });

  it("Пустота Парии после карточки: переброс не-Непрямой силы отказан", async () => {
    const a = sigActor({ fate: 3 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "normal"), [95]);
    const old = messageOf(lastCard());
    const v = packDocById("packs-src/traits/Трейты_рас", "PariahVoidZone01");
    a.items.push({ id: v._id, name: v.name, type: v.type, system: v.system, flags: v.flags });
    captured.chat.length = 0; captured.dice = [30];
    expect(await handlePsyRerollClick(old, btn(a, p))).toBe(false);
    expect(captured.chat.length).toBe(0);
    expect(captured.warnings.join(" ")).toContain("Пустоте Парии");
  });

  it("вне боя: бесплатное Очко этой карточки уже ушло на «Успех» — «Переброс (бесплатно)» переспрашивает, а не платит молча", async () => {
    const a = sigActor({ fate: 2 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "normal"), [95]);
    const old = messageOf(lastCard());
    await markCardOnce(old, "signatureFreeUsed");
    const b = { dataset: { actorUuid: a.uuid, powerUuid: p.uuid, free: "1" } };
    captured.confirmAnswer = false; captured.dialog = null; captured.dice = [30];
    expect(await handlePsyRerollClick(old, b)).toBe(false);
    expect(a.system.fate.value).toBe(2);
    expect(captured.dialog?.content).toContain("1 Очко Бесчестия");
  });

  it("не ключевая сила, не владелец, покровитель Нургл — отказ", async () => {
    const a = sigActor({ fate: 3 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "normal"), [95]);
    const card = lastCard();
    const other = power({}, "Другая / Other"); other.uuid = "Actor.actor-1.Item.p2";
    globalThis.fromUuid = async uuid => (uuid === a.uuid ? a : uuid === other.uuid ? other : p);
    expect(await handlePsyRerollClick(messageOf(card), btn(a, other))).toBe(false);
    wire(a, p);
    a.isOwner = false;
    expect(await handlePsyRerollClick(messageOf(card), btn(a, p))).toBe(false);
    a.isOwner = true;
    a.system.patronGod = "nurgle";
    expect(await handlePsyRerollClick(messageOf(card), btn(a, p))).toBe(false);
  });

  it("хук помечает заменённую карточку и гасит её кнопки; флаг разрешён для отметки ГМом", async () => {
    const fsm = await import("node:fs");
    const hooks = fsm.readFileSync(new URL("../../module/hooks.mjs", import.meta.url), "utf8");
    expect(hooks).toContain("wh-psy-reroll-btn");
    expect(hooks).toContain('cardOnceUsed(message, "psyRerolled")');
    expect(hooks).toMatch(/psyRerolled[\s\S]{0,600}b\.disabled = true/);   // заменённая карточка гасит все свои кнопки
    const { CARD_ONCE_FLAGS } = await import("../../module/combat/card-once.mjs");
    expect(CARD_ONCE_FLAGS).toContain("psyRerolled");
  });
});

// ── Переброс откатывает Порчу Варп-Шока своей карточки (пачка I4, решение владельца 27.10.2026) ───────
describe("Ключевые Силы: переброс снимает Порчу Варп-Шока, начисленную этой же карточкой", () => {
  // Неограниченный псайкер: Усиление — бросок d5 (первый кубик очереди), как в соседних тестах переброса.
  const sigActor = (opt = {}) => actor([talent(SIG, { [SIGNATURE_FLAG]: ["Aegis"] })], { cls: "unbound", ...opt });
  let seq = 0;
  const messageOf = card => {
    const f = { ...(card?.flags?.["warhammer-dbc"] ?? {}) };
    return { id: `ws${++seq}`, isOwner: true, flags: { "warhammer-dbc": f }, getFlag: (s, k) => f[k], setFlag: async (s, k, v) => { f[k] = v; } };
  };
  const lastCard = () => captured.chat.filter(c => c.flags).at(-1);
  const btn = (a, p) => ({ dataset: { actorUuid: a.uuid, powerUuid: p.uuid }, disabled: false });
  const wire = (a, p) => { globalThis.fromUuid = async uuid => (uuid === a.uuid ? a : uuid === p.uuid ? p : null); };
  const corr = a => a.system.corruption.value;
  // Первый бросок: Усиление d5 = 4, провал психотеста (95), Феномен 95 → Варп-Прорыв (перил 50), Порча за Прорыв — d5 = 3.
  const PERIL = () => [4, 95, 95, 50, 3];   // свежий массив: очередь кубов заглушка съедает

  it("карточка запоминает величину начисленной Порчи во флаге", async () => {
    const a = sigActor({ cor: 10 }), p = power();
    await cast(a, p, opts(9, "push"), PERIL());
    expect(corr(a)).toBe(13);
    expect(lastCard().flags["warhammer-dbc"].psyManifest.warpShock).toBe(3);
  });

  it("рост Порчи отменён перехватчиком (Пустота Парии): карточка помнит 0, переброс чужую Порчу не снимает", async () => {
    const a = sigActor({ fate: 3, cor: 10 }), p = power();
    wire(a, p);
    const realUpdate = a.update;
    a.update = async d => realUpdate(Object.fromEntries(Object.entries(d).filter(([k]) => k !== "system.corruption.value")));
    await cast(a, p, opts(9, "push"), PERIL());
    expect(corr(a)).toBe(10);
    const card = lastCard();
    expect(card.flags["warhammer-dbc"].psyManifest.warpShock).toBe(0);
    const old = messageOf(card);
    captured.dice = [30, 20];
    await handlePsyRerollClick(old, btn(a, p));
    expect(corr(a)).toBe(10);                               // ни отката, ни начисления: перехватчик всё так же отменяет рост
  });

  it("переброс снимает прежние +3 и начисляет заново по новому результату", async () => {
    const a = sigActor({ fate: 3, cor: 10 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "push"), PERIL());
    const old = messageOf(lastCard());
    captured.chat.length = 0; captured.rolls.length = 0;
    captured.dice = [30, 20];                               // психотест 30, Феномен 20 (обычный: +1 Порчи)
    expect(await handlePsyRerollClick(old, btn(a, p))).toBe(true);
    expect(corr(a)).toBe(10 + 1);                           // 10 + 3 − 3 + 1; без отката было бы 14
    expect(plain()).toContain("Порча Варп-Шока прежнего результата");
  });

  it("новый результат без Феномена: Порча возвращается к исходной", async () => {
    const a = sigActor({ fate: 3, cor: 10 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "normal"), [99, 20]);          // «нормальный» режим: Феномен только на 99 (или дубле при успехе), Феномен 20
    const given = corr(a) - 10;
    expect(given).toBeGreaterThan(0);
    const old = messageOf(lastCard());
    captured.dice = [30];
    await handlePsyRerollClick(old, btn(a, p));
    expect(corr(a)).toBe(10);
  });

  it("Порча из других источников не откатывается", async () => {
    const a = sigActor({ fate: 3, cor: 10 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "push"), PERIL());               // 13
    a.system.corruption.value += 5;                         // между попытками персонаж получил Порчу из другого источника: 18
    const old = messageOf(lastCard());
    captured.dice = [30, 20];
    await handlePsyRerollClick(old, btn(a, p));
    expect(corr(a)).toBe(18 - 3 + 1);
  });

  it("если Порча с тех пор упала ниже начисленного — уходит не глубже нуля", async () => {
    const a = sigActor({ fate: 3, cor: 0 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "push"), PERIL());               // 3
    a.system.corruption.value = 1;                          // сняли вручную
    const old = messageOf(lastCard());
    captured.dice = [30, 20];
    await handlePsyRerollClick(old, btn(a, p));
    expect(corr(a)).toBe(0 + 1);                            // снято только то, что было (1), затем +1
  });

  it("карточка без Феномена (Порча не начислялась) — откатывать нечего", async () => {
    const a = sigActor({ fate: 3, cor: 10 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "normal"), [95]);
    expect(corr(a)).toBe(10);
    const old = messageOf(lastCard());
    captured.dice = [30];
    await handlePsyRerollClick(old, btn(a, p));
    expect(corr(a)).toBe(10);
    expect(plain()).not.toContain("Порча Варп-Шока прежнего результата");
  });

  it("откат делается один раз на карточку, даже если переброс не состоялся с первой попытки", async () => {
    const { returnWarpShock } = await import("../../module/combat/psyker-pools.mjs");
    const a = sigActor({ fate: 3, cor: 10 }), p = power();
    wire(a, p);
    await cast(a, p, opts(9, "push"), PERIL());               // 13
    const old = messageOf(lastCard());
    const saved = old.getFlag("warhammer-dbc", "psyManifest");
    expect(await returnWarpShock(a, old, saved)).toBe(3);
    expect(corr(a)).toBe(10);
    expect(await returnWarpShock(a, old, saved)).toBe(0);   // повторный клик после сбоя не снимает второй раз
    expect(corr(a)).toBe(10);
  });

  it("отметка отката разрешена для ГМа (белый список сокета)", async () => {
    const { CARD_ONCE_FLAGS } = await import("../../module/combat/card-once.mjs");
    expect(CARD_ONCE_FLAGS).toContain("psyWarpShockReturned");
  });

  it("Варп-Замок остаётся как был: Порча Замком не откатывается", async () => {
    const fsm = await import("node:fs");
    const lock = fsm.readFileSync(new URL("../../module/combat/warp-lock.mjs", import.meta.url), "utf8");
    expect(lock).not.toContain("returnWarpShock");
    expect(lock).toContain("остаётся");
  });
});
