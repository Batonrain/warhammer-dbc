// module/rules/sources.mjs
//
// Реестр источников правил. Источник — функция (actor, ctx) => массив правил.
// Добавить книгу означает зарегистрировать источник и положить данные; ядро при
// этом не меняется.

import { ASTARTES_RULES } from "./library/astartes.mjs";
import { EXODITE_RULES, DRUKHARI_RULES, AZURIANE_RULES, HARLEQUIN_RULES, YNNARI_RULES,
         HALF_ELDAR_RULES } from "./library/aeldari.mjs";
import { HOMEWORLD_BY_KEY } from "../constants/homeworlds.mjs";
import { isFeatureEnabled } from "../constants/features.mjs";
import { CORE_RULES } from "./library/core.mjs";
import { CONDITION_RULES } from "./library/conditions.mjs";
import { rulesFromItemMechanics } from "./item-rules.mjs";
import { isItemActive } from "../apps/effects.mjs";
import { isDreadnoughtPilot, DREADNOUGHT_PILOT_FLAG,
         SARCOPHAGUS, sarcophagusFlags } from "./dreadnought.mjs";
import { adjutantRerollRules } from "./adjutant.mjs";
import { AVATAR_OF_SLAUGHTER_RULES } from "./library/avatar-of-slaughter.mjs";
import { PATRON_RULES } from "./library/patronage.mjs";
import { BEASTMAN_SHAMAN_RULES } from "./library/beastman-shaman.mjs";
import { addictionPenaltyRules } from "./addiction.mjs";
import { SYNESTHESIA_RULES } from "./library/synesthesia.mjs";
import { situationalRules } from "./situational.mjs";

const SOURCES = new Map();

export function registerRuleSource(key, fn) {
  SOURCES.set(key, fn);
}

export function getRuleSources() {
  return [...SOURCES.entries()];
}

/** Очистка реестра. Нужна тестам, чтобы подставить свои источники. */
export function clearRuleSources() {
  SOURCES.clear();
}

/**
 * Ключ Происхождения лежит на предмете-носителе, а не в system актора. Тип
 * предмета и ключ подсистемы в коде остались прежними («homeworld»,
 * «homeworlds»), в интерфейсе подсистема называется «Происхождения».
 */
const hwKey = actor =>
  [...(actor?.items ?? [])].find(i => i?.type === "homeworld")?.system?.key ?? "";

// Правила основной книги приходят каждому актору: они не привязаны ни к расе,
// ни к Происхождению, а отбираются по условию `when`. Так живёт «Проворный» —
// Черта нескольких рас, штраф от которой достаётся не носителю, а атакующему.
registerRuleSource("core", () => CORE_RULES);

// Ситуативные штрафы состояния тела и снаряжения (wdbc-n17t): Усталость,
// Марш, снятый шлем, выключенная силовая броня, Перевес инвентаря. Числа
// зависят от состояния актора и от того, чем именно он сейчас бросает,
// поэтому источник — функция от (актор, контекст), как у Зависимости, а не
// готовый список записей. См. module/rules/situational.mjs.
registerRuleSource("situational", (a, ctx) => situationalRules(a, ctx));

// Штрафы книжных Состояний (wdbc-r5o7) — та же логика: правило не привязано
// ни к расе, ни к предмету, отбор целиком по `when.hasCondition`/
// `when.targetHasCondition`.
registerRuleSource("conditions", () => CONDITION_RULES);

// Машинная часть расовых Черт остаётся кодом (этап 3 плана): в данные уехало
// описание расы, а не её правила.
//
// Друкхари зарегистрирован под всеми четырьмя историческими значениями
// system.race (сама раса плюс три её субрасы) — см. комментарий у
// DRUKHARI_RULES в library/aeldari.mjs.
const RACE_RULES = {
  astartes: ASTARTES_RULES,
  exodite: EXODITE_RULES,
  drukhari: DRUKHARI_RULES,
  truebornDrukhari: DRUKHARI_RULES,
  mandrake: DRUKHARI_RULES,
  wrack: DRUKHARI_RULES,
  azuriane: AZURIANE_RULES,
  harlequin: HARLEQUIN_RULES,
  ynnari: YNNARI_RULES,
  halfEldar: HALF_ELDAR_RULES
};

registerRuleSource("race", a => RACE_RULES[a?.system?.race] ?? []);

// Правила по Покровительству Бога (system.patronGod) — см. library/patronage.mjs.
registerRuleSource("patron", a => PATRON_RULES[a?.system?.patronGod] ?? []);

// Выключенная подсистема убирает свои правила из сборки: иначе выключатель
// «Происхождения» гасил бы галочки в диалоге броска, а правила Происхождения
// продолжали действовать. Вне Foundry isFeatureEnabled отдаёт значение по
// умолчанию, поэтому реестр по-прежнему запускается в тестах.
registerRuleSource("homeworld", a =>
  isFeatureEnabled("homeworlds") ? (HOMEWORLD_BY_KEY[hwKey(a)]?.rules ?? []) : []);

// Предметы актора: записи Конструктора, которые живут В МОМЕНТ БРОСКА, а не при
// получении предмета (первая такая — «Переброс» Локусов Герольдов). Активность
// источника спрашивается у общего рубильника isItemActive: выключенный Локус,
// снятое оружие и вынутый имплант правил не дают — ровно так же, как не дают
// эффектов. См. module/rules/item-rules.mjs.
registerRuleSource("items", a => rulesFromItemMechanics(a?.items ?? [], isItemActive, a));

// Adjutant/Адъютант (wdbc-sk8s) даёт способность не себе, а своему
// Командиру — cross-actor проверка вне владельца Таланта, тем же приёмом,
// что источник «dreadnought» ниже. Вне игры (тесты ядра) game.actors нет —
// источник молчит, как и остальные Foundry-зависимые источники здесь.
// Avatar of Slaughter/Аватар Резни (wdbc-sk8s) — статичное when читает метку
// на самом акторе (rules/predicates.mjs::avatarOfSlaughterOffTarget), не
// требует cross-actor обхода — регистрируется так же, как "core".
registerRuleSource("avatarOfSlaughter", () => AVATAR_OF_SLAUGHTER_RULES);

// Hex-Marked Prey/Проклятая Метка (wdbc-xxb7) — то же статичное when по
// предикату (rules/predicates.mjs::hexMarkedPreyAllyBonus), которое само
// читает cross-actor метку через ctx.targetActor.
registerRuleSource("beastmanShaman", () => BEASTMAN_SHAMAN_RULES);
// Synesthesia/Синэстезия (wdbc-1rno) — та же схема: статичное правило читает
// цель ТЕКУЩЕГО теста (targetHasTrait, теперь живой и на обычных тестах
// Навыка, не только атаках), не источник-владелец Мутации.
registerRuleSource("synesthesia", () => SYNESTHESIA_RULES);

registerRuleSource("adjutant", a => {
  if (typeof game === "undefined") return [];
  return adjutantRerollRules(a, game.actors ?? []);
});

// Зависимость (wdbc-5inv) — штраф −10 к тестам Навыков, пока не утолена.
// Считается по времени (game.time.worldTime), не по when: правило действует
// каждый бросок, пока предмет не даст isAddictionUnsatisfied === false.
registerRuleSource("addiction", a => addictionPenaltyRules(a));

// Пилот Дредноута (Книга Машин, стр. 57-58). Связь хранит сам Дредноут — место
// экипажа с ролью `pilot` и uuid актора, — поэтому спрашивать приходится не
// персонажа, а мир: не назначен ли он куда-то пилотом. Из этой возможности
// растут Требования двенадцати Талантов Дредноутов: книга даёт их только
// заключённому в саркофаг, и проверять это должны данные, а не память ГМа.
//
// Вне Foundry игры нет, и источник молчит — на тестах ядра это не сказывается:
// сама связь считается в module/rules/dreadnought.mjs без всякой игры.
registerRuleSource("dreadnought", (a) => {
  if (typeof game === "undefined" || !a?.uuid) return [];
  if (!isDreadnoughtPilot(a.uuid, game.actors ?? [])) return [];

  // Один пункт книги — одно правило, а не свалка в одном: в диалоге броска и в
  // панели возможностей игрок видит, ЧТО именно сработало, а не «Дредноут».
  const rules = [{
    id: "dreadnought.pilot", label: "Пилот Дредноута", when: {},
    effects: [{ kind: "grantFlag", target: DREADNOUGHT_PILOT_FLAG }]
  }];

  // Числовые пункты стр. 57. Рейтинги Сверхъестественного здесь не трогаем:
  // «уменьшить рейтинг на 4» зависит от того, сколько его есть, и считается
  // расчётом листа через sarcophagusCharDelta, а не плоским модификатором.
  rules.push({
    id: "dreadnought.sarcophagus.mind", label: "Саркофаг: защита сознания", when: {},
    effects: [{ kind: "rollBonus", target: "all", value: SARCOPHAGUS.mindControlBonus,
                label: "Саркофаг: против контроля сознания" }]
  });
  rules.push({
    id: "dreadnought.sarcophagus.poison", label: "Саркофаг: сопротивление ядам", when: {},
    effects: [{ kind: "rollBonus", target: "all", value: SARCOPHAGUS.poisonBonus,
                label: "Саркофаг: против ядов" }]
  });

  // Возможности книги: иммунитеты, автоуспехи и запреты. Читателей у части из
  // них пока нет — они помечены «вручную» в панели на листе.
  for (const flag of sarcophagusFlags()) {
    rules.push({
      id: `dreadnought.sarcophagus.${flag}`, label: "Саркофаг Дредноута", when: {},
      effects: [{ kind: "grantFlag", target: flag }]
    });
  }
  return rules;
});

// Локус Неизбежности (стр. 30, wdbc-smc): после авто-попадания рукопашной
// (autoHit.melee.oncePerRound, module/sheets/attack-dialog.mjs) актор несёт
// −10 на все тесты до начала своего следующего Хода. Флаг ставит диалог
// атаки в момент применения, снимает resetActionEconomy (action-economy.mjs)
// тем же приёмом, что exposedAggressive/running/movedThisTurn — переносить
// в постоянное хранимое поле схемы не нужно, живёт как временный флаг.
registerRuleSource("daemonInevitability", a => {
  if (!a?.getFlag?.("warhammer-dbc", "inevitabilityPenalty")) return [];
  return [{
    id: "daemon.inevitabilityPenalty", label: "Локус Неизбежности: штраф после авто-попадания", when: {},
    effects: [{ kind: "rollBonus", target: "all", value: -10, label: "Локус Неизбежности: штраф после авто-попадания" }]
  }];
});
