// test/rules/rage-behavior.test.mjs
//
// Поведение Ярости (Frenzy / Ярость, корбук, Таланты «Берсерк»; Sahara
// focused-wrath-20-bs, п.2): запрет Избеганий, автопровал речи, правила
// попытки выйти из Ярости. Таланты и Модуль Агрессии берутся из НАСТОЯЩИХ
// документов packs-src (форма фикстуры из выдуманного JSON не доказывает, что
// запись в паке жива — урок wdbc-g6cb), актор — со схемой персонажа.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import {
  RAGE_FREE_AVOIDANCE_CAPABILITY, RAGE_EXIT_AUTO_CAPABILITY, RAGE_EXIT_TURN_BONUS, RAGE_EXIT_BATTLE_RAGE_BONUS,
  hasBattleRage, hasFreeRageAvoidance, hasRageExitAutoSuccess,
  rageAvoidanceVerdict, rageSocialAutoFail, rageSustainTestNeeded,
  rageExitTriedStamp, rageExitAttemptAllowed, turnsAfterCombat, rageExitParts, worldTurnIndex,
  pickRageTarget, rageTurnReminderText
} from "../../module/rules/rage-behavior.mjs";
import { rageBlocksMental } from "../../module/rules/rage.mjs";
import { isKnownCapability } from "../../module/constants/capabilities.mjs";

const TALENTS = "packs-src/talents/Берсерк";
const BATTLE_RAGE = packDocById(TALENTS, "Rv7GqTcTjclLJCii");
const COLD_FURY = packDocById(TALENTS, "pj2nKLs8aBfjAQof");
const MODULE = packDocById("packs-src/implants/Адептус_Механикус/Кибернетика_Скитарии", "0VkgZGNXAVqIZXsh");

/** Предмет из документа пака — как лежит на акторе. */
const itemOf = (doc, extra = {}) => {
  const flags = { ...doc.flags, "warhammer-dbc": { ...(doc.flags?.["warhammer-dbc"] ?? {}), ...(extra.flags ?? {}) } };
  return {
    id: doc._id, type: doc.type, name: doc.name, system: { ...doc.system, ...(extra.system ?? {}) }, flags,
    getFlag: (scope, key) => flags[scope]?.[key]
  };
};
const moduleItem = (quality = "common") => itemOf(MODULE, { system: { quality }, flags: { installed: true, disabled: false } });

const actor = ({ inRage = true, items = [], conditions = {} } = {}) => ({
  system: { inRage, characteristics: {}, wounds: {}, conditions },
  items
});

describe("настоящие документы пака несут то, на что опирается код", () => {
  it("Боевой Гнев и Холодная Ярость — Таланты с книжными именами", () => {
    expect(BATTLE_RAGE.name).toBe("Battle Rage / Боевой Гнев");
    expect(COLD_FURY.name).toBe("Cold Fury / Холодная Ярость");
    expect(BATTLE_RAGE.type).toBe("talent");
  });

  it("Модуль Агрессии несёт обе новые Возможности, ключи известны реестру", () => {
    const keys = MODULE.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries)
      .filter(e => e.kind === "capability").map(e => e.capabilityKey);
    expect(keys).toContain(RAGE_FREE_AVOIDANCE_CAPABILITY);
    expect(keys).toContain(RAGE_EXIT_AUTO_CAPABILITY);
    for (const k of keys) expect(isKnownCapability(k), k).toBe(true);
  });
});

describe("Боевой Гнев: опознание", () => {
  it("по имени Таланта (в паке без записи Конструктора) и по ключу Возможности", () => {
    expect(hasBattleRage(actor({ items: [itemOf(BATTLE_RAGE)] }))).toBe(true);
    const byKey = { type: "talent", name: "ИСПОРЧЕННОЕ ИМЯ", system: {}, getFlag: () => undefined,
      flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
        { id: "e", kind: "capability", capabilityKey: "berserker.core.battleRage" }] }] } } };
    expect(hasBattleRage(actor({ items: [byKey] }))).toBe(true);
  });

  it("без Таланта и с чужим Талантом — нет", () => {
    expect(hasBattleRage(actor())).toBe(false);
    expect(hasBattleRage(actor({ items: [itemOf(COLD_FURY)] }))).toBe(false);
  });
});

describe("Избегания в Ярости: «не может совершать Избегания»", () => {
  it("вне Ярости всё открыто", () => {
    for (const kind of ["dodge", "parry", "evade"]) {
      expect(rageAvoidanceVerdict(actor({ inRage: false }), kind).blocked, kind).toBe(false);
    }
  });

  it("в Ярости Уклонение, Парирование и прочие Избегания закрыты, причина названа", () => {
    for (const kind of ["dodge", "parry", "evade"]) {
      const v = rageAvoidanceVerdict(actor(), kind);
      expect(v.blocked, kind).toBe(true);
      expect(v.reason, kind).toContain("в Ярости персонаж не может совершать Избегания");
    }
    expect(rageAvoidanceVerdict(actor(), "dodge").reason).toContain("Уклонение невозможно");
    expect(rageAvoidanceVerdict(actor(), "parry").reason).toContain("Боевой Гнев");
  });

  it("Боевой Гнев открывает ТОЛЬКО Парирование: Уклонение и прочее остаются закрытыми", () => {
    const a = actor({ items: [itemOf(BATTLE_RAGE)] });
    expect(rageAvoidanceVerdict(a, "parry").blocked).toBe(false);
    expect(rageAvoidanceVerdict(a, "dodge").blocked).toBe(true);
    expect(rageAvoidanceVerdict(a, "evade").blocked).toBe(true);
  });

  it("Холодная Ярость Избегания НЕ открывает (она про речь и психосилы)", () => {
    const a = actor({ items: [itemOf(COLD_FURY)] });
    expect(rageAvoidanceVerdict(a, "dodge").blocked).toBe(true);
    expect(rageAvoidanceVerdict(a, "parry").blocked).toBe(true);
  });

  it("Модуль Агрессии (любое Качество): Избегания без ограничений; не установлен — запрет на месте", () => {
    for (const q of ["poor", "common", "good", "best"]) {
      const a = actor({ items: [moduleItem(q)] });
      expect(hasFreeRageAvoidance(a), q).toBe(true);
      for (const kind of ["dodge", "parry", "evade"]) expect(rageAvoidanceVerdict(a, kind).blocked, `${q} ${kind}`).toBe(false);
    }
    const inBag = itemOf(MODULE, { system: { quality: "good" }, flags: { installed: false } });
    expect(hasFreeRageAvoidance(actor({ items: [inBag] }))).toBe(false);
    expect(rageAvoidanceVerdict(actor({ items: [inBag] }), "dodge").blocked).toBe(true);
  });
});

describe("Выход из Ярости без броска: Модуль Агрессии", () => {
  it("установленный даёт автоуспех; без модуля и не установленный — нет", () => {
    expect(hasRageExitAutoSuccess(actor({ items: [moduleItem("common")] }))).toBe(true);
    expect(hasRageExitAutoSuccess(actor())).toBe(false);
    const off = itemOf(MODULE, { flags: { installed: true, disabled: true } });
    expect(hasRageExitAutoSuccess(actor({ items: [off] }))).toBe(false);
  });
});

describe("Социальные тесты в Ярости проваливаются сами (кроме Запугивания)", () => {
  const SOCIAL = ["charm", "command", "commerce", "deceive", "inquiry", "interrogate"];

  it("все социальные Навыки, кроме Запугивания", () => {
    for (const skill of SOCIAL) expect(rageSocialAutoFail(actor(), { skill }), skill).toBe(true);
  });

  it("Запугивание — исключение книги", () => {
    expect(rageSocialAutoFail(actor(), { skill: "intimidate" })).toBe(false);
  });

  it("несоциальные Навыки не затронуты", () => {
    for (const skill of ["dodge", "athletics", "medicae", "scrutiny", "techUse"]) {
      expect(rageSocialAutoFail(actor(), { skill }), skill).toBe(false);
    }
  });

  it("Общительность без Навыка — социальная; прочие характеристики — нет", () => {
    expect(rageSocialAutoFail(actor(), { char: "fel" })).toBe(true);
    expect(rageSocialAutoFail(actor(), { char: "ws" })).toBe(false);
    expect(rageSocialAutoFail(actor(), { char: "int" })).toBe(false);
    // Навык называет тест сам: Допрос на W — социальный, Запугивание на F — нет
    expect(rageSocialAutoFail(actor(), { skill: "intimidate", char: "fel" })).toBe(false);
    expect(rageSocialAutoFail(actor(), { skill: "interrogate", char: "wp" })).toBe(true);
  });

  it("Холодная Ярость говорить разрешает; вне Ярости — тоже ничего", () => {
    expect(rageSocialAutoFail(actor({ items: [itemOf(COLD_FURY)] }), { skill: "charm" })).toBe(false);
    expect(rageSocialAutoFail(actor({ inRage: false }), { skill: "charm" })).toBe(false);
    expect(rageSocialAutoFail(actor({ inRage: false }), { char: "fel" })).toBe(false);
  });
});

describe("Ментальные действия: общий признак", () => {
  it("закрыты в Ярости, Холодная Ярость снимает", () => {
    expect(rageBlocksMental(actor())).toBe(true);
    expect(rageBlocksMental(actor({ items: [itemOf(COLD_FURY)] }))).toBe(false);
    expect(rageBlocksMental(actor({ inRage: false }))).toBe(false);
  });
});

describe("Поддержание психосил: тест W+0 нужен только в Ярости и только при поддерживаемой силе", () => {
  const power = isSustained => ({ type: "psychicPower", name: "Сила", system: { isSustained } });
  it("Ярость + поддерживаемая сила", () => {
    expect(rageSustainTestNeeded(actor({ items: [power(true)] }))).toBe(true);
  });
  it("Холодная Ярость тест снимает: Талант поддерживает силы в Ярости (цена — −10 психотестов)", () => {
    expect(rageSustainTestNeeded(actor({ items: [itemOf(COLD_FURY), power(true)] }))).toBe(false);
  });
  it("нет поддерживаемых, не в Ярости, не псайкер — не нужен", () => {
    expect(rageSustainTestNeeded(actor({ items: [power(false)] }))).toBe(false);
    expect(rageSustainTestNeeded(actor({ inRage: false, items: [power(true)] }))).toBe(false);
    expect(rageSustainTestNeeded(actor())).toBe(false);
  });
});

describe("«Не более одной попытки выхода в Ход»", () => {
  it("в бою: метка этого боя запрещает, чужого боя и отсутствие метки — нет", () => {
    const tried = rageExitTriedStamp({ combatId: "C1", worldTime: 100 });
    expect(rageExitAttemptAllowed(tried, { combatId: "C1" })).toBe(false);
    expect(rageExitAttemptAllowed(tried, { combatId: "C2" })).toBe(true);
    expect(rageExitAttemptAllowed(null, { combatId: "C1" })).toBe(true);
    expect(rageExitAttemptAllowed(undefined, { combatId: "C1" })).toBe(true);
  });

  it("вне боя «Ход» — 6 секунд игрового времени", () => {
    const tried = rageExitTriedStamp({ combatId: "", worldTime: 12 });
    expect(worldTurnIndex(12)).toBe(2);
    expect(rageExitAttemptAllowed(tried, { worldTime: 17 })).toBe(false);   // тот же Ход
    expect(rageExitAttemptAllowed(tried, { worldTime: 18 })).toBe(true);    // следующий
  });

  it("метка из прошлого боя не мешает после боя", () => {
    const tried = rageExitTriedStamp({ combatId: "C1", worldTime: 12 });
    expect(rageExitAttemptAllowed(tried, { combatId: "", worldTime: 12 })).toBe(true);
  });
});

describe("«+10 за каждый Ход после боя»", () => {
  it("Ходы считаются от конца боя по 6 секунд", () => {
    expect(turnsAfterCombat({ at: 60 }, 60)).toBe(0);
    expect(turnsAfterCombat({ at: 60 }, 65)).toBe(0);
    expect(turnsAfterCombat({ at: 60 }, 78)).toBe(3);
    expect(turnsAfterCombat(undefined, 78)).toBe(0);
    expect(turnsAfterCombat({ at: null, lost: true }, 78)).toBe(0);
    expect(turnsAfterCombat({ at: 600 }, 60)).toBe(0);
  });

  it("слагаемые: +10 за Ход; потеря бонуса его обнуляет; +30 Боевого Гнева — только носителю и по галочке", () => {
    const total = o => rageExitParts(o).reduce((s, p) => s + p.value, 0);
    const br = actor({ items: [itemOf(BATTLE_RAGE)] });
    expect(RAGE_EXIT_TURN_BONUS).toBe(10);
    expect(RAGE_EXIT_BATTLE_RAGE_BONUS).toBe(30);
    expect(total({ turns: 3, actor: actor() })).toBe(30);
    expect(total({ turns: 3, bonusLost: true, actor: actor() })).toBe(0);
    expect(total({ turns: 0, actor: actor() })).toBe(0);
    expect(total({ turns: 2, battleRage: true, actor: br })).toBe(50);
    expect(total({ turns: 2, battleRage: true, actor: actor() })).toBe(20);   // без Таланта галочка ничего не даёт
    expect(total({ turns: 0, battleRage: false, actor: br })).toBe(0);
    // потеря бонуса за конец боя НЕ отнимает +30 Боевого Гнева — это другая прибавка
    expect(total({ turns: 4, bonusLost: true, battleRage: true, actor: br })).toBe(30);
  });
});

describe("Напоминание «двигаться к врагу»", () => {
  const c = (name, distance, relation, helpless = false) => ({ name, distance, relation, helpless });

  it("ближайший ВРАГ, а не ближайший токен", () => {
    const pick = pickRageTarget([c("Друг", 1, "ally"), c("Дальний", 9, "enemy"), c("Ближний", 3, "enemy"), c("Прохожий", 2, "neutral")]);
    expect(pick.name).toBe("Ближний");
  });

  it("нет врагов — нет цели", () => {
    expect(pickRageTarget([c("Друг", 1, "ally")])).toBeNull();
    expect(pickRageTarget([])).toBeNull();
    expect(pickRageTarget(undefined)).toBeNull();
  });

  it("после провала выхода: сперва беспомощный враг (хоть и дальний), потом враг, потом союзник", () => {
    const list = [c("Союзник", 1, "ally"), c("Сильный", 2, "enemy"), c("Связанный", 8, "enemy", true)];
    expect(pickRageTarget(list, { failedExit: true }).name).toBe("Связанный");
    expect(pickRageTarget(list.filter(x => !x.helpless), { failedExit: true }).name).toBe("Сильный");
    expect(pickRageTarget(list.filter(x => x.relation === "ally"), { failedExit: true }).name).toBe("Союзник");
  });

  it("текст: имя и дистанция есть — в строке; нет сцены — без имени; после провала — «обязан атаковать других»", () => {
    expect(rageTurnReminderText({ target: c("Гретчин", 4.26, "enemy") }))
      .toBe("Ярость: обязан двигаться к ближайшему видимому противнику и атаковать в рукопашной — ближайший: Гретчин, 4.3 м");
    expect(rageTurnReminderText({})).toBe("Ярость: обязан двигаться к ближайшему видимому противнику и атаковать в рукопашной");
    const failed = rageTurnReminderText({ failedExit: true });
    expect(failed).toContain("обязан атаковать других");
    expect(failed).toContain("сдавшиеся, беспомощные и обезоруженные");
    expect(failed).toContain("союзные NPC и игроки");
  });
});
