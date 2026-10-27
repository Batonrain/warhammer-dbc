// test/combat/rage-behavior.test.mjs
//
// Foundry-обвязка поведения Ярости (module/combat/rage-behavior.mjs; Sahara
// focused-wrath-20-bs, п.2). Актор — со СХЕМОЙ персонажа и настоящим
// prepareDerivedData (W идёт в тест выхода уже с +10 Ярости); Таланты и Модуль
// Агрессии — настоящие документы packs-src. Правила без Foundry —
// test/rules/rage-behavior.test.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured, sheetOf } from "../support/foundry-stub.mjs";

import fs from "node:fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { _performDodge, _performParry, _performPsychicParry, _performSprayCancel } from "../../module/combat/defense.mjs";
import { avoidanceVerdict } from "../../module/combat/full-attack-lock.mjs";
import { actionBlockReason, spendActionPoints } from "../../module/combat/action-economy.mjs";
import { frenzyEntryBlocked } from "../../module/combat/frenzy.mjs";
import {
  attemptRageExit, rerollRageExit, processRageTurnStart, stampRageCombatEnd, clearRageStatePatch,
  rageSceneCandidates, askRageExit
} from "../../module/combat/rage-behavior.mjs";
import {
  RAGE_EXIT_TRIED_FLAG, RAGE_EXIT_FAILED_FLAG, RAGE_AFTER_COMBAT_FLAG, RAGE_EXIT_REROLL_CARD_FLAG
} from "../../module/rules/rage-behavior.mjs";
import { CARD_ONCE_FLAGS } from "../../module/combat/card-once.mjs";
import { TURN_SCOPED_FLAG_KEYS, turnStartFlagClears } from "../../module/rules/turn-flags.mjs";
import { isKnownCapability, CAPABILITIES } from "../../module/constants/capabilities.mjs";

const { WarhammerCharacterSheet } = await import("../../module/sheets/actor-sheet.mjs");
const { rollCommand, rallyHorde } = await import("../../module/sheets/tabs/command.mjs");

const NS = "warhammer-dbc";
const TALENTS = "packs-src/talents/Берсерк";
const FRENZY = packDocById(TALENTS, "FP1xN9yNXHr9vWw8");
const BATTLE_RAGE = packDocById(TALENTS, "Rv7GqTcTjclLJCii");
const COLD_FURY = packDocById(TALENTS, "pj2nKLs8aBfjAQof");
const MODULE = packDocById("packs-src/implants/Адептус_Механикус/Кибернетика_Скитарии", "0VkgZGNXAVqIZXsh");

const itemOf = (doc, extra = {}) => {
  const flags = { ...doc.flags, [NS]: { ...(doc.flags?.[NS] ?? {}), ...(extra.flags ?? {}) } };
  return { id: doc._id, type: doc.type, name: doc.name, system: { ...doc.system, ...(extra.system ?? {}) }, flags,
    getFlag: (scope, key) => flags[scope]?.[key] };
};
const frenzy = () => itemOf(FRENZY);
const battleRage = () => itemOf(BATTLE_RAGE);
const coldFury = () => itemOf(COLD_FURY);
const aggressionModule = (quality = "common") => itemOf(MODULE, { system: { quality }, flags: { installed: true, disabled: false } });

/**
 * Актор со схемой персонажа: Воля 40 (с Яростью 50 в итоге), флаги в памяти, update применяет патч.
 * flagStore — plain-объект «ключ → значение» под NS.
 */
function makeActor({ inRage = true, items = [], flags = {}, wp = 40, reactions = 2, ap = 2 } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  for (const k of Object.keys(system.characteristics)) system.characteristics[k].base = 40;
  system.characteristics.wp.base = wp;
  system.inRage = inRage;
  system.wounds.max = 20;
  system.wounds.value = 20;
  system.reactions = { ...(system.reactions ?? {}), value: reactions, max: reactions };
  system.actionPoints = { ...(system.actionPoints ?? {}), value: ap, max: ap };
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const store = { ...flags };
  const self = {
    id: "rager", uuid: "Actor.rager", name: "Берсерк", type: "character", system, items: list, isOwner: true,
    getFlag: (scope, key) => (scope === NS ? store[key] : undefined),
    setFlag: async (scope, key, value) => { store[key] = value; return self; },
    update: async patch => {
      captured.updates.push(patch);
      for (const [path, value] of Object.entries(patch)) {
        if (path.startsWith("system.")) {
          const keys = path.slice("system.".length).split(".");
          let node = self.system;
          for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
          node[keys.at(-1)] = value;
        } else if (path.startsWith(`flags.${NS}.-=`)) delete store[path.slice(`flags.${NS}.-=`.length)];
      }
      return self;
    }
  };
  WarhammerActor.prototype.prepareDerivedData.call(self);
  self.store = store;
  return self;
}

const lastCard = () => captured.chat.at(-1)?.content ?? "";
const thresholdOf = html => Number(/<label>Порог<\/label><b>(-?\d+)<\/b>/.exec(html)?.[1]);

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
  globalThis.game.time = { worldTime: 600 };
});
afterEach(() => {
  globalThis.game.combat = undefined;
  globalThis.fromUuid = async () => null;
});

// ── Избегания ────────────────────────────────────────────────────────────────

describe("Избегания в Ярости: отказ без траты Реакции", () => {
  const inCombat = () => { globalThis.game.combat = { id: "C1", started: true, round: 1 }; };

  it("Уклонение: карточка-отказ, Реакции и запись в актора нетронуты", async () => {
    inCombat();
    const a = makeActor({ items: [frenzy()] });
    await _performDodge(a);
    expect(lastCard()).toContain("Уклонение невозможно: в Ярости персонаж не может совершать Избегания");
    expect(a.system.reactions.value).toBe(2);
    expect(captured.updates).toEqual([]);
    expect(captured.rolls).toEqual([]);
  });

  it("Парирование: то же без Боевого Гнева; Реакции целы", async () => {
    inCombat();
    const a = makeActor({ items: [frenzy()] });
    await _performParry(a);
    expect(lastCard()).toContain("Парирование невозможно: в Ярости персонаж не может совершать Избегания");
    expect(lastCard()).toContain("Боевой Гнев");
    expect(a.system.reactions.value).toBe(2);
    expect(captured.rolls).toEqual([]);
  });

  it("вердикт общий для боя и «вне боя»: Ярость действует всегда", () => {
    const a = makeActor({ items: [frenzy()] });
    expect(avoidanceVerdict(a, "dodge")).toMatchObject({ blocked: true, penalty: 0 });
    expect(avoidanceVerdict(a, "parry").blocked).toBe(true);
    inCombat();
    expect(avoidanceVerdict(a, "dodge").blocked).toBe(true);
  });

  it("Боевой Гнев: Парирование идёт дальше (вердикт открыт), Уклонение — нет", () => {
    const a = makeActor({ items: [frenzy(), battleRage()] });
    expect(avoidanceVerdict(a, "parry").blocked).toBe(false);
    expect(avoidanceVerdict(a, "dodge").blocked).toBe(true);
  });

  it("Модуль Агрессии: оба Избегания открыты; вне Ярости запрета нет вовсе", () => {
    const a = makeActor({ items: [aggressionModule("poor")] });
    expect(avoidanceVerdict(a, "dodge").blocked).toBe(false);
    expect(avoidanceVerdict(a, "parry").blocked).toBe(false);
    expect(avoidanceVerdict(makeActor({ inRage: false }), "dodge").blocked).toBe(false);
  });

  it("Парирование психосилы и отмена попадания Акробатикой — тоже Избегания", async () => {
    const a = makeActor({ items: [frenzy()] });
    await _performPsychicParry(a, { powerName: "Огонь", ePR: 3 });
    expect(lastCard()).toContain("Парирование психосилы");
    expect(lastCard()).toContain("не может совершать Избегания");
    resetCaptured();
    await _performSprayCancel(a);
    expect(lastCard()).toContain("не может совершать Избегания");
    expect(captured.rolls).toEqual([]);
  });

  it("проводка: Сжатие, Вираж, Шагоход и верховое Уклонение спрашивают Ярость до траты Реакции", () => {
    const read = f => fs.readFileSync(f, "utf8");
    expect(read("module/combat/defense.mjs")).toMatch(/rageAvoidanceRefusal\(actor, "evade", "Сжатие"\)[\s\S]{0,80}spendReaction/);
    expect(read("module/combat/vehicle.mjs")).toMatch(/rageAvoidanceRefusal\(driver, "evade", "Вираж"\)[\s\S]{0,80}spendReaction/);
    expect(read("module/combat/walker.mjs")).toContain('rageAvoidanceRefusal(crew.actor, "parry"');
    expect(read("module/combat/walker.mjs")).toContain('rageAvoidanceRefusal(crew.actor, "dodge"');
    expect(read("module/combat/mount.mjs")).toMatch(/avoidanceVerdict\(rider, "dodge"\)/);
  });
});

// ── Ментальные действия ──────────────────────────────────────────────────────

describe("Ментальные траты ОД и Реакций в Ярости", () => {
  it("physical:false отказывает, физическое и «не указано» — нет", () => {
    const a = makeActor({ items: [frenzy()] });
    expect(actionBlockReason(a, { physical: false })).toContain("в Ярости");
    expect(actionBlockReason(a, { physical: true })).toBe("");
    expect(actionBlockReason(a, {})).toBe("");
  });

  it("Холодная Ярость и «не в Ярости» — не блокируют", () => {
    expect(actionBlockReason(makeActor({ items: [frenzy(), coldFury()] }), { physical: false })).toBe("");
    expect(actionBlockReason(makeActor({ inRage: false }), { physical: false })).toBe("");
  });

  it("в бою ментальная трата ОД не проходит и ОД не списываются", async () => {
    globalThis.game.combat = { id: "C1", started: true, round: 1 };
    const a = makeActor({ items: [frenzy()], ap: 2 });
    expect(await spendActionPoints(a, 1, { physical: false })).toBe(false);
    expect(a.system.actionPoints.value).toBe(2);
    expect(captured.warnings.join(" ")).toContain("в Ярости");
    // физическая трата того же размера идёт
    expect(await spendActionPoints(a, 1, { physical: true })).toBe(true);
    expect(a.system.actionPoints.value).toBe(1);
  });
});

// ── Речь ─────────────────────────────────────────────────────────────────────

describe("Социальный тест в Ярости через лист: автопровал без диалога и броска", () => {
  const sheet = (inRage, items = []) => sheetOf(WarhammerCharacterSheet, {
    inRage, items, characteristics: { fel: { total: 40 }, wp: { total: 40 } }, conditions: {}
  });

  it("Очарование — карточка «нечленораздельные вопли — автопровал», диалога нет, d100 не брошен", async () => {
    await sheet(true)._rollSkill("Очарование", 40, "fel", { skill: "charm" });
    expect(captured.dialog).toBeNull();
    expect(captured.rolls).toEqual([]);
    expect(lastCard()).toContain("Ярость: нечленораздельные вопли — автопровал");
    expect(lastCard()).toContain("Очарование");
  });

  it("Общительность без Навыка — тоже", async () => {
    await sheet(true)._rollSkill("Общительность", 40, "fel", {});
    expect(lastCard()).toContain("автопровал");
  });

  describe("встречный тест: ответчик в Ярости", () => {
    const request = (side, extra = {}) => ({ initiatorUuid: "Actor.init", initiatorName: "Инициатор", safe: false,
      initiatorSide: { threshold: 50, roll: 20, success: true, deg: 4, ...side }, ...extra });
    const comparison = () => captured.chat.find(c => String(c.content).includes("Встречный тест"))?.content ?? "";

    it("сравнение публикуется: ответчик — автопровал, инициатор выигрывает по обычным правилам", async () => {
      await sheet(true)._rollSkill("Очарование", 40, "fel", { skill: "charm" }, { opposedRequest: request({}) });
      expect(captured.chat.some(c => String(c.content).includes("нечленораздельные вопли"))).toBe(true);
      expect(captured.rolls).toEqual([]);
      const cmp = comparison();
      expect(cmp).toContain("Побеждает <b>Инициатор</b>, margin <b>5</b>");     // успех 4 против провала 1
      expect(cmp).toContain("автопровал (Ярость)");
      expect(cmp).toContain("Подставной: Порог <b>0</b>");
    });

    it("инициатор тоже провалил: решают степени провала (обычные правила встречного теста)", async () => {
      await sheet(true)._rollSkill("Очарование", 40, "fel", { skill: "charm" },
        { opposedRequest: request({ success: false, deg: 3, threshold: 30, roll: 60 }) });
      expect(comparison()).toContain("Побеждает <b>Подставной</b>, margin <b>2</b>");
    });

    it("Запугивание — ответчик не автопроваливается: сравнение не публикуется до его броска", async () => {
      const p = sheet(true)._rollSkill("Запугивание", 40, "wp", { skill: "intimidate" }, { opposedRequest: request({}) });
      await new Promise(r => setTimeout(r, 0));
      expect(captured.dialog).not.toBeNull();
      captured.dismiss();
      await p;
      expect(comparison()).toBe("");
    });

    it("соперник-NPC в Ярости (бросок за него автоматом): Порог 0, провал; вне Ярости — обычный бросок", async () => {
      const npc = makeActor({ items: [frenzy()] });
      globalThis.fromUuid = async () => npc;
      const s = sheet(false);
      const raging = await s._resolveOpposedAuto({ targetActorUuid: "Actor.rager" }, { skillKey: "charm", charKey: "fel" });
      expect(raging.opposed).toMatchObject({ threshold: 0, roll: 1 });
      expect(captured.rolls).toEqual([]);
      const intimidate = await s._resolveOpposedAuto({ targetActorUuid: "Actor.rager" }, { skillKey: "intimidate", charKey: "wp" });
      expect(intimidate.opposed.threshold).not.toBe(0);
      expect(captured.rolls).toEqual(["1d100"]);
    });
  });

  it("Запугивание — тест идёт (открывается диалог броска)", async () => {
    const p = sheet(true)._rollSkill("Запугивание", 40, "wp", { skill: "intimidate" });
    await Promise.resolve();
    await new Promise(r => setTimeout(r, 0));
    expect(captured.dialog).not.toBeNull();
    captured.dismiss();
    await p;
    expect(captured.chat.some(c => String(c.content ?? "").includes("автопровал"))).toBe(false);
  });

  it("Холодная Ярость и «не в Ярости» — обычный тест", async () => {
    for (const s of [sheet(true, [coldFury()]), sheet(false)]) {
      resetCaptured();
      const p = s._rollSkill("Очарование", 40, "fel", { skill: "charm" });
      await new Promise(r => setTimeout(r, 0));
      expect(captured.dialog).not.toBeNull();
      captured.dismiss();
      await p;
      expect(captured.chat).toEqual([]);
    }
  });
});

describe("Приказы вне листа навыков: «общаться только воплями» и там", () => {
  it("Команда с вкладки «Команды» и вдохновляющая речь по Орде проваливаются сами, без броска", async () => {
    const a = makeActor({ items: [frenzy()] });
    await rollCommand(a, "short");
    expect(lastCard()).toContain("автопровал");
    expect(captured.rolls).toEqual([]);
    resetCaptured();
    await rallyHorde(a, "Actor.horde");
    expect(lastCard()).toContain("автопровал");
    expect(captured.rolls).toEqual([]);
  });

  it("проводка остальных путей: Вдохновить Гнев и клич Экзодитов", () => {
    const read = f => fs.readFileSync(f, "utf8");
    expect(read("module/combat/inspire-wrath.mjs")).toContain('rageSocialRefusal(actor, { skill: "charm"');
    expect(read("module/combat/lord-of-exodites.mjs")).toContain('rageSocialRefusal(actor, { skill: "command"');
  });
});

// ── Начало Хода ──────────────────────────────────────────────────────────────

/** Токен-документ сцены: x/y в пикселях при сетке 100 пкс = 1 м. */
const tok = (id, name, x, y, disposition, extra = {}) => ({
  id, name, x, y, width: 1, height: 1, disposition, hidden: false, actor: { system: { conditions: {} } }, ...extra
});
const sceneWith = tokens => {
  const scene = { grid: { size: 100, distance: 1 }, tokens: { contents: tokens } };
  for (const t of tokens) t.parent = scene;
  return scene;
};

describe("Начало Хода в Ярости: напоминание", () => {
  it("называет ближайшего ВИДИМОГО врага по диспозиции токенов, с дистанцией", async () => {
    const me = tok("me", "Берсерк", 0, 0, 1);
    sceneWith([me,
      tok("e1", "Дальний враг", 1000, 0, -1),
      tok("e2", "Ближний враг", 300, 0, -1),
      tok("f1", "Союзник", 100, 0, 1),
      tok("n1", "Нейтрал", 100, 100, 0),
      tok("h1", "Скрытый враг", 100, 0, -1, { hidden: true }),
      tok("far", "Враг вне зрения", 5000, 0, -1)]);
    const a = makeActor({ items: [frenzy()] });
    await processRageTurnStart(a, me);
    expect(lastCard()).toContain("обязан двигаться к ближайшему видимому противнику и атаковать в рукопашной");
    expect(lastCard()).toContain("Ближний враг");
    expect(lastCard()).not.toContain("Союзник");
    expect(lastCard()).not.toContain("Скрытый враг");
    expect(lastCard()).not.toContain("вне зрения");
  });

  it("нет сцены/токенов — напоминание без имени", async () => {
    const a = makeActor({ items: [frenzy()] });
    await processRageTurnStart(a, null);
    expect(lastCard()).toContain("обязан двигаться к ближайшему видимому противнику");
    expect(lastCard()).not.toContain("ближайший:");
  });

  it("после провала выхода — «обязан атаковать других», цель по приоритету книги", async () => {
    const me = tok("me", "Берсерк", 0, 0, 1);
    sceneWith([me,
      tok("e1", "Боец", 200, 0, -1),
      tok("e2", "Связанный пленник", 800, 0, -1, { actor: { system: { conditions: { helpless: true } } } })]);
    const a = makeActor({ items: [frenzy()], flags: { [RAGE_EXIT_FAILED_FLAG]: true } });
    await processRageTurnStart(a, me);
    expect(lastCard()).toContain("обязан атаковать других");
    expect(lastCard()).toContain("Связанный пленник");
  });

  it("не в Ярости и без сознания — молчит", async () => {
    await processRageTurnStart(makeActor({ inRage: false }), null);
    expect(captured.chat).toEqual([]);
    const a = makeActor({ items: [frenzy()] });
    a.system.conditions.unconscious = true;
    await processRageTurnStart(a, null);
    expect(captured.chat).toEqual([]);
  });

  it("кандидаты: сам токен, скрытые и невидимые не попадают", () => {
    const me = tok("me", "Берсерк", 0, 0, 1);
    sceneWith([me, tok("e", "Враг", 200, 0, -1), tok("h", "Скрыт", 200, 0, -1, { hidden: true })]);
    const names = rageSceneCandidates(me).map(c => c.name);
    expect(names).toEqual(["Враг"]);
    expect(rageSceneCandidates(null)).toEqual([]);
  });
});

describe("Начало Хода псайкера в Ярости: тест W+0 на сохранение поддержания", () => {
  const power = (name, sustained = true) => {
    const p = { id: name, type: "psychicPower", name, system: { isSustained: sustained, sustainedDegree: 2 },
      updates: [], effects: [],
      async update(patch) { p.updates.push(patch); if ("system.isSustained" in patch) p.system.isSustained = patch["system.isSustained"]; },
      getFlag: () => undefined };
    return p;
  };

  it("успех (бросок ≤ W 50 = 40 + 10 Ярости): поддержание цело, силы не тронуты", async () => {
    const p = power("Клинок");
    const a = makeActor({ items: [frenzy(), p] });
    captured.nextRoll = 50;
    await processRageTurnStart(a, null);
    expect(p.system.isSustained).toBe(true);
    expect(p.updates).toEqual([]);
    const sustainCard = captured.chat.find(c => String(c.content).includes("поддержание психосил"));
    expect(sustainCard.content).toContain("Успех");
    expect(thresholdOf(sustainCard.content)).toBe(50);
  });

  it("провал: ВСЕ поддерживаемые силы сброшены общим sustainOffPatch, неподдерживаемые не тронуты", async () => {
    const p1 = power("Клинок"), p2 = power("Щит"), p3 = power("Покой", false);
    const a = makeActor({ items: [frenzy(), p1, p2, p3] });
    captured.nextRoll = 51;
    await processRageTurnStart(a, null);
    expect(p1.system.isSustained).toBe(false);
    expect(p2.system.isSustained).toBe(false);
    expect(p1.updates[0]).toMatchObject({ "system.isSustained": false, "system.sustainedDegree": null });
    expect(p3.updates).toEqual([]);
    const card = captured.chat.find(c => String(c.content).includes("поддержание психосил"));
    expect(card.content).toContain("Провал");
    expect(card.content).toContain("Клинок, Щит");
  });

  it("Холодная Ярость: теста нет вовсе, даже при заведомо провальном броске; сила остаётся", async () => {
    const p = power("Клинок");
    const a = makeActor({ items: [frenzy(), coldFury(), p] });
    captured.nextRoll = 100;
    await processRageTurnStart(a, null);
    expect(captured.chat.some(c => String(c.content).includes("поддержание психосил"))).toBe(false);
    expect(captured.rolls).toEqual([]);
    expect(p.system.isSustained).toBe(true);
    expect(p.updates).toEqual([]);
  });

  it("нет поддерживаемых сил — теста нет, только напоминание", async () => {
    const a = makeActor({ items: [frenzy(), power("Покой", false)] });
    await processRageTurnStart(a, null);
    expect(captured.chat.some(c => String(c.content).includes("поддержание психосил"))).toBe(false);
    expect(captured.chat).toHaveLength(1);
  });
});

// ── Выход из Ярости ──────────────────────────────────────────────────────────

describe("Выход из Ярости: тест W+0", () => {
  const choice = (o = {}) => ({ turns: 0, lost: false, battleRage: false, ...o });

  it("порог = W актора С +10 Ярости (40 → 50); успех снимает Ярость и закрывает повторный вход", async () => {
    globalThis.game.combat = { id: "C1", started: true, round: 1 };
    const a = makeActor({ items: [frenzy()] });
    expect(a.system.characteristics.wp.total).toBe(50);
    captured.nextRoll = 50;
    expect(await attemptRageExit(a, { choice: choice() })).toBe(true);
    expect(thresholdOf(lastCard())).toBe(50);
    expect(lastCard()).toContain("выходит из Ярости");
    expect(a.system.inRage).toBe(false);
    // книга: «Однажды выйдя из Ярости, не может снова войти до конца боя» (combat/frenzy.mjs, метка «боя»)
    expect(frenzyEntryBlocked(a)).toBe(true);
  });

  it("провал: Ярость остаётся, метка «обязан атаковать других», сообщение в чат", async () => {
    globalThis.game.combat = { id: "C1", started: true, round: 1 };
    const a = makeActor({ items: [frenzy()] });
    captured.nextRoll = 51;
    expect(await attemptRageExit(a, { choice: choice() })).toBe(false);
    expect(a.system.inRage).toBe(true);
    expect(a.store[RAGE_EXIT_FAILED_FLAG]).toBe(true);
    expect(lastCard()).toContain("обязан атаковать других");
    expect(frenzyEntryBlocked(a)).toBe(false);
  });

  it("+10 за каждый Ход после боя и +30 Боевого Гнева складываются в Порог", async () => {
    const a = makeActor({ items: [frenzy(), battleRage()] });
    captured.nextRoll = 99;
    await attemptRageExit(a, { choice: choice({ turns: 3, battleRage: true }) });
    expect(thresholdOf(lastCard())).toBe(50 + 30 + 30);
    expect(lastCard()).toContain("3 Хода после боя");
    expect(lastCard()).toContain("Боевой Гнев (с позволения ГМа)");
  });

  it("галочка «бонус потерян» убирает +10 за Ходы, но не +30; запоминается на акторе", async () => {
    const a = makeActor({ items: [frenzy(), battleRage()], flags: { [RAGE_AFTER_COMBAT_FLAG]: { at: 0, lost: false } } });
    captured.nextRoll = 99;
    await attemptRageExit(a, { choice: choice({ turns: 5, lost: true, battleRage: true }) });
    expect(thresholdOf(lastCard())).toBe(50 + 30);
    expect(a.store[RAGE_AFTER_COMBAT_FLAG]).toEqual({ at: 0, lost: true });
  });

  it("+30 без Таланта игнорируется, даже если галочку поставили", async () => {
    const a = makeActor({ items: [frenzy()] });
    captured.nextRoll = 99;
    await attemptRageExit(a, { choice: choice({ battleRage: true }) });
    expect(thresholdOf(lastCard())).toBe(50);
  });

  it("одна попытка в Ход: вторая в том же Ходу отказывает без броска; следующий Ход (метка снята) — можно", async () => {
    globalThis.game.combat = { id: "C1", started: true, round: 1 };
    const a = makeActor({ items: [frenzy()] });
    captured.nextRoll = 99;
    await attemptRageExit(a, { choice: choice() });
    const rolls = captured.rolls.length;
    expect(await attemptRageExit(a, { choice: choice() })).toBeNull();
    expect(captured.rolls.length).toBe(rolls);
    expect(captured.warnings.join(" ")).toContain("не более одной попытки");
    // начало СВОЕГО Хода: реестр меток Хода гасит метку попытки
    expect(TURN_SCOPED_FLAG_KEYS).toContain(RAGE_EXIT_TRIED_FLAG);
    const patch = turnStartFlagClears({ getFlag: (s, k) => a.getFlag(s, k) });
    expect(patch[`flags.${NS}.-=${RAGE_EXIT_TRIED_FLAG}`]).toBeNull();
    delete a.store[RAGE_EXIT_TRIED_FLAG];
    captured.nextRoll = 10;
    expect(await attemptRageExit(a, { choice: choice() })).toBe(true);
  });

  it("вне боя «Ход» — 6 секунд игрового времени", async () => {
    const a = makeActor({ items: [frenzy()] });
    captured.nextRoll = 99;
    await attemptRageExit(a, { choice: choice() });
    expect(await attemptRageExit(a, { choice: choice() })).toBeNull();     // 600 с — тот же Ход
    globalThis.game.time.worldTime = 606;
    captured.nextRoll = 10;
    expect(await attemptRageExit(a, { choice: choice() })).toBe(true);
  });

  it("Модуль Агрессии: выход без броска", async () => {
    const a = makeActor({ items: [frenzy(), aggressionModule("common")] });
    expect(await attemptRageExit(a, { choice: choice() })).toBe(true);
    expect(captured.rolls).toEqual([]);
    expect(a.system.inRage).toBe(false);
    expect(lastCard()).toContain("Модуль Агрессии: автоматический Успех");
  });

  it("не в Ярости — ничего не происходит", async () => {
    expect(await attemptRageExit(makeActor({ inRage: false }), { choice: choice() })).toBeNull();
    expect(captured.chat).toEqual([]);
  });

  it("выход гасит метки состояния (провал выхода, Ходы после боя) одним патчем", async () => {
    const a = makeActor({ items: [frenzy()], flags: { [RAGE_EXIT_FAILED_FLAG]: true, [RAGE_AFTER_COMBAT_FLAG]: { at: 0, lost: false } } });
    captured.nextRoll = 10;
    await attemptRageExit(a, { choice: choice() });
    expect(a.store[RAGE_EXIT_FAILED_FLAG]).toBeUndefined();
    expect(a.store[RAGE_AFTER_COMBAT_FLAG]).toBeUndefined();
    expect(clearRageStatePatch(a)).toEqual({});
  });

  it("диалог: поля Ходов/потери бонуса всегда, галочка Боевого Гнева — только носителю", async () => {
    let p = askRageExit(makeActor({ items: [frenzy()] }), { turns: 4, lost: true });
    expect(captured.dialog.content).toContain('name="turns"');
    expect(captured.dialog.content).toContain('value="4"');
    expect(captured.dialog.content).toContain('name="lost" checked');
    expect(captured.dialog.content).not.toContain('name="battleRage"');
    captured.dismiss();
    expect(await p).toBeNull();
    p = askRageExit(makeActor({ items: [frenzy(), battleRage()] }));
    expect(captured.dialog.content).toContain('name="battleRage"');
    const form = { elements: { turns: { value: "2" }, lost: { checked: false }, battleRage: { checked: true } } };
    await captured.press("roll", form);
    expect(await p).toEqual({ turns: 2, lost: false, battleRage: true });
  });

  it("диалог из кнопки: Ходы по умолчанию — от конца боя по игровому времени", async () => {
    const a = makeActor({ items: [frenzy()], flags: { [RAGE_AFTER_COMBAT_FLAG]: { at: 570, lost: false } } });
    captured.nextRoll = 99;
    const p = attemptRageExit(a);
    await new Promise(r => setTimeout(r, 0));
    expect(captured.dialog.content).toContain('value="5"');            // (600 − 570) / 6
    await captured.press("roll", { elements: { turns: { value: "5" }, lost: { checked: false } } });
    await p;
    expect(thresholdOf(lastCard())).toBe(50 + 50);
  });
});

describe("Выход из Ярости: края", () => {
  it("в новом бою «Ходы после боя» от прошлого боя не подставляются", async () => {
    globalThis.game.combat = { id: "C2", started: true, round: 1 };
    const a = makeActor({ items: [frenzy()], flags: { [RAGE_AFTER_COMBAT_FLAG]: { at: 570, lost: false } } });
    const p = attemptRageExit(a);
    await new Promise(r => setTimeout(r, 0));
    expect(captured.dialog.content).toContain('name="turns" min="0" step="1" value="0"');
    captured.dismiss();
    await p;
  });

  it("пока висело окно, вторая попытка успела раньше — бросок не идёт", async () => {
    const a = makeActor({ items: [frenzy()] });
    const p = attemptRageExit(a);
    await new Promise(r => setTimeout(r, 0));
    a.store[RAGE_EXIT_TRIED_FLAG] = { combatId: "", turn: 100 };      // 600 с / 6
    await captured.press("roll", { elements: { turns: { value: "0" }, lost: { checked: false } } });
    expect(await p).toBeNull();
    expect(captured.rolls).toEqual([]);
  });

  it("вне боя причина отказа называет стоящие часы", async () => {
    const a = makeActor({ items: [frenzy()], flags: { [RAGE_EXIT_TRIED_FLAG]: { combatId: "", turn: 100 } } });
    await attemptRageExit(a, { choice: { turns: 0, lost: false, battleRage: false } });
    expect(captured.warnings.join(" ")).toContain("прокрутите время");
  });
});

describe("Холодная Ярость: переброс неудачной попытки выйти", () => {
  const failedCard = async (a) => {
    captured.nextRoll = 99;
    await attemptRageExit(a, { choice: { turns: 0, lost: false, battleRage: false } });
    return captured.chat.at(-1);
  };

  it("кнопка переброса — только на ПРОВАЛЕ и только у Холодной Ярости", async () => {
    const withCf = makeActor({ items: [frenzy(), coldFury()] });
    expect((await failedCard(withCf)).content).toContain("wh-rage-exit-reroll-btn");
    resetCaptured();
    expect((await failedCard(makeActor({ items: [frenzy()] }))).content).not.toContain("wh-rage-exit-reroll-btn");
    resetCaptured();
    const ok = makeActor({ items: [frenzy(), coldFury()] });
    captured.nextRoll = 10;
    await attemptRageExit(ok, { choice: { turns: 0, lost: false, battleRage: false } });
    expect(lastCard()).not.toContain("wh-rage-exit-reroll-btn");
  });

  it("переброс: тот же Порог, новая попытка не открывается; успех снимает Ярость", async () => {
    const a = makeActor({ items: [frenzy(), coldFury()] });
    const card = await failedCard(a);
    expect(card.flags[NS].rageExit).toMatchObject({ actorUuid: "Actor.rager", threshold: 50 });
    globalThis.fromUuid = async () => a;
    captured.nextRoll = 30;
    const tried = a.store[RAGE_EXIT_TRIED_FLAG];
    expect(await rerollRageExit({ flags: card.flags })).toBe(true);
    expect(thresholdOf(lastCard())).toBe(50);
    expect(lastCard()).toContain("переброс");
    expect(lastCard()).toContain("выходит из Ярости");
    expect(a.system.inRage).toBe(false);
    expect(a.store[RAGE_EXIT_TRIED_FLAG]).toBe(tried);
  });

  it("провал переброса: Ярость остаётся и второй кнопки на карточке переброса нет", async () => {
    const a = makeActor({ items: [frenzy(), coldFury()] });
    const card = await failedCard(a);
    globalThis.fromUuid = async () => a;
    captured.nextRoll = 99;
    await rerollRageExit({ flags: card.flags });
    expect(a.system.inRage).toBe(true);
    expect(lastCard()).not.toContain("wh-rage-exit-reroll-btn");
  });

  it("без Холодной Ярости переброс отказывает; раз-на-карточку заведён в реестре card-once", async () => {
    const a = makeActor({ items: [frenzy()] });
    const card = await failedCard(a);
    globalThis.fromUuid = async () => a;
    const before = captured.chat.length;
    expect(await rerollRageExit({ flags: card.flags })).toBe(false);
    expect(captured.chat.length).toBe(before);
    expect(CARD_ONCE_FLAGS).toContain(RAGE_EXIT_REROLL_CARD_FLAG);
  });
});

describe("Конец боя: Ярость, пережившая бой, получает счётчик Ходов после боя", () => {
  it("ставится только тем, кто в Ярости, один раз на актора", async () => {
    const raging = makeActor({ items: [frenzy()] });
    const calm = makeActor({ inRage: false });
    calm.uuid = "Actor.calm";
    const combat = { combatants: [{ actor: raging }, { actor: raging }, { actor: calm }] };
    await stampRageCombatEnd(combat);
    expect(raging.store[RAGE_AFTER_COMBAT_FLAG]).toEqual({ at: 600, lost: false });
    expect(calm.store[RAGE_AFTER_COMBAT_FLAG]).toBeUndefined();
  });
});

describe("Реестры: метки, карточки и Возможности", () => {
  it("новые Возможности известны, читатели названы; Боевой Гнев больше не пустышка", () => {
    for (const k of ["rage.avoidWithoutLimit", "rage.exitAutoSuccess", "berserker.core.battleRage"]) {
      expect(isKnownCapability(k), k).toBe(true);
      expect(CAPABILITIES[k].reader, k).toMatch(/module\//);
    }
    expect(CAPABILITIES["berserker.core.frenzy"].reader).toContain("rage-behavior");
    expect(CAPABILITIES["berserker.core.coldFury"].reader).toContain("rage-behavior");
  });

  it("проводка в hooks.mjs: начало Хода, конец боя, кнопка переброса", () => {
    const hooks = fs.readFileSync("module/hooks.mjs", "utf8");
    expect(hooks).toContain("processRageTurnStart(nextCombatant.actor, nextCombatant.token)");
    expect(hooks).toContain("stampRageCombatEnd(combat)");
    expect(hooks).toContain(".wh-rage-exit-reroll-btn");
    expect(hooks).toContain("rerollRageExit(message)");
  });

  it("кнопка «Выйти из Ярости» есть на вкладке «Бой» и в HUD, обе зовут attemptRageExit", () => {
    const read = f => fs.readFileSync(f, "utf8");
    expect(read("templates/actor/parts/tab-combat.hbs")).toContain("rage-exit-btn");
    expect(read("module/sheets/tabs/combat.mjs")).toContain("attemptRageExit(actor)");
    expect(read("templates/apps/hud.hbs")).toContain("data-rage-exit");
    expect(read("module/apps/hud.mjs")).toContain("attemptRageExit(actor)");
  });
});
