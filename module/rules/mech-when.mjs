// module/rules/mech-when.mjs
//
// Условие «Когда» (entry.when) — независимые гейты одной записи Конструктора,
// общих для ЛЮБОГО места, что читает Механику предмета: разовая выдача и живая
// пересинхронизация (module/apps/mechanics.mjs), живые запросы
// «Переброс»/«Модификатор теста»/«Возможность» (module/rules/item-rules.mjs),
// «Ландшафт» (module/combat/movement-terrain.mjs), «Усталость»
// (module/rules/fatigue-grace.mjs). Живёт в module/rules/, а не в
// apps/mechanics.mjs, — чтобы её мог позвать fatigue-grace.mjs, который
// нарочно не тянет apps/mechanics.mjs целиком (см. его шапку). Чистая
// функция: никаких обращений к Foundry.
//
// ── Геносемя (when.conditions/when.negate) ──────────────────────────────────
// Список вариантов {legion, chapter, ageAtLeast}, между вариантами ИЛИ (Железа
// Бетчера не работает СРАЗУ у трёх линий — три условия одной записи, не три
// её копии). Пустой список — условия нет, запись работает всем, как раньше.
// Орден в варианте не задан — условие держит только легион, подходит и
// наследникам без своей более узкой записи. ageAtLeast — необязательное
// дополнительное сужение варианта: Геносемя подошло, но нужен ещё и Возраст
// (вкладка Записи, system.bio.age) не меньше указанного — «клыки у Космического
// Волка отрастают через 20 лет после имплантации» книга привязывает к
// возрасту, а не к легиону одному. Внутри одного варианта легион/орден и
// возраст — И. when.negate переворачивает результат целиком: «выдать этим» ⇄
// «выдать всем, КРОМЕ этих». Гейт смотрит на actor.system.geneSeed — нет
// актора (превью/сравнение вне владельца) — условие считается пройденным.
//
// ── Субмутация (when.submutations/when.negateSub) ───────────────────────────
// Список подписей строк ИЗ ТАБЛИЦЫ СУБМУТАЦИЙ САМОГО ПРЕДМЕТА (label из
// parseSubmutations, rules/submutations.mjs — «1», «2-3», «Кхорн»), между
// которыми ИЛИ. Мутация с субмутациями меняет своё действие в зависимости от
// того, какая строка выпала (system.submutation.label, apps/submutations.mjs)
// — так одна и та же Мутация несёт в Конструкторе несколько записей, каждая
// со своим набором строк, и включена только та, чья субмутация сейчас
// записана на предмете. Свой negateSub, а не общий negate: два условия
// независимы (Геносемя — про актора, субмутация — про сам предмет), у записи
// почти никогда не бывает обоих сразу, и совмещать их в один переключатель
// было бы путаницей. Гейт смотрит на item.system.submutation: нет самого
// предмета (вызов вне контекста Механики — тот же случай, что «нет актора» у
// Геносемени) — условие пройдено; предмет есть, но субмутация ещё не выбрана
// (label пуст) — не пройдено: запись не должна включиться ДО броска.
//
// ── Талант+специализация (when.talentSpec/when.negateTalent) ────────────────
// Третий независимый гейт (wdbc-ta4y): «у актора есть Талант/Черта с этим
// именем И этой специализацией» — {name, specialization}, ОДИН вариант, не
// список (в отличие от Геносемени: пока нужен только один конкретный случай —
// «Mastery (Психонаука)» у Серого Человека, а не набор ИЛИ-альтернатив).
// specialization сравнивается тем же способом, что имя (itemHasName,
// rules/predicates.mjs) — по обеим билингвальным половинам, без учёта
// регистра: у выданного через Механику Mastery специализация — это
// masteryLabel(key) (module/rules/mastery-targets.mjs), у купленного руками —
// та же подпись из того же списка (item-picker.mjs), совпадают дословно.
// Нет актора (предпросмотр вне владельца) — условие пройдено, тот же принцип,
// что у Геносемени/субмутации выше.
//
// ── Тир Ран (when.woundTier/when.negateWoundTier) ───────────────────────────
// Четвёртый независимый гейт (wdbc-wyr3): список из healthy/light/heavy/dying
// (PREDICATES.woundTier, rules/predicates.mjs — тот же ключ, что подписан в
// блоке РАНЫ на листе), между вариантами ИЛИ — «Тяжело раненный или хуже»
// пишется woundTier:["heavy","dying"]. Нет актора — условие пройдено, тот же
// принцип, что у остальных гейтов.
//
// ── Ярость (when.requireRage/when.negateRage) ───────────────────────────────
// Пятый независимый гейт: простой тумблер по actor.system.inRage
// (PREDICATES.inRage) — «Горящая Голова» (Fear 2 только в Ярости),
// Бронзовый Мирмидон/Красный Ангел (Трейт только пока в Ярости). Не
// заполнено (requireRage:false) — условия нет вовсе, не «вне Ярости».
//
// ── Герметичная броня (when.requireSealedArmour/when.negateSealedArmour) ────
// Шестой независимый гейт (wdbc-1rno): тот же тумблер-паттерн, что у Ярости,
// но по PREDICATES.wearsSealedArmour — надета ли броня со свойством «Sealed /
// Закрытая» (ARMOR_PROPERTIES.sealed, constants/items.mjs). Книга часто пишет
// «без гермодоспеха» (Миазмы и подобные) — это requireSealedArmour:true +
// negateSealedArmour:true (гейт проходит, когда СНАРЯЖЕНИЯ со свойством НЕТ).
// Не заполнено (requireSealedArmour:false) — условия нет вовсе, тот же
// принцип, что у остальных гейтов.

// ── Состояние (when.condition/when.negateCondition) ─────────────────────────
// Восьмой независимый гейт (wdbc-tl0f): список ключей Состояний
// (constants/conditions.mjs), между вариантами ИЛИ — та же форма списка, что у
// Тира Ран и Покровителя. Читает PREDICATES.hasCondition, тот же предикат, по
// которому книжные штрафы Состояний уже отбираются в rules/library/conditions.mjs
// — одно и то же слово книги («пока Оглушён») обязано значить одно и то же и в
// правиле из книги, и в записи автора контента. До этого гейта запись можно
// было привязать только к Ярости и Тиру Ран, а «пока Повален», «пока Ослеплён»
// приходилось выражать отдельным предикатом в коде на каждый случай.
// Нет актора (предпросмотр) — условие пройдено, тот же принцип, что у остальных.

// ── Покровитель (when.patronGod/when.negatePatronGod) ───────────────────────
// Шестой независимый гейт (wdbc-xxb7): список ключей WARP_GODS
// (khorne/nurgle/slaanesh/tzeentch/undivided), между вариантами ИЛИ — та же
// форма списка, что у Тира Ран. Источник — actor.system.patronGod, ЕДИНОЕ
// поле «Покровительство», которым уже пользуется вся система (см.
// constants/patronage.mjs); отдельного поля «Метка» на акторе нет — книжное
// различие Метка/простое Покровительство (стр. 103, Шаман Зверолюдей: «особо
// известные шаманы, Inf 70+, получают такие же бонусы при простом
// Покровительстве») этим гейтом не моделируется, оба читаются как одно и то
// же system.patronGod. Пустой patronGod у актора не считается «Неделимый» —
// сравнивается как есть (пустая строка не входит в список вариантов, если
// "undivided" явно не выбран). Нет актора (предпросмотр) — условие пройдено,
// тот же принцип, что у остальных гейтов.

import { itemHasName, PREDICATES } from "./predicates.mjs";

/** Заполненные ключи Бога-покровителя из entry.when.patronGod. */
export function whenPatronGod(when) {
  return (when?.patronGod || []).filter(Boolean);
}

/** Заполненные варианты (легион задан) из entry.when.conditions. */
export function whenConditions(when) {
  return (when?.conditions || []).filter(c => c?.legion);
}

/** Заполненные подписи строк субмутации из entry.when.submutations. */
export function whenSubmutations(when) {
  return (when?.submutations || []).filter(Boolean);
}

/** entry.when.talentSpec, если оба поля (имя+специализация) заполнены. */
export function whenTalentSpec(when) {
  const ts = when?.talentSpec;
  return (ts?.name && ts?.specialization) ? ts : null;
}

/** Заполненные ключи Состояний из entry.when.condition. */
export function whenCondition(when) {
  return (when?.condition || []).filter(Boolean);
}

/** Заполненные ключи тира Ран из entry.when.woundTier. */
export function whenWoundTier(when) {
  return (when?.woundTier || []).filter(Boolean);
}

const normSpec = s => String(s ?? "").trim().toLowerCase();

/** Есть ли у актора Талант/Черта с этим именем И этой специализацией. */
function hasTalentSpec(actor, name, specialization) {
  const want = normSpec(specialization);
  return (actor?.items ?? []).some(i =>
    (i?.type === "talent" || i?.type === "trait") &&
    itemHasName(i, name) && normSpec(i?.system?.specialization) === want);
}

/**
 * Выполняет ли актор/предмет условие «Когда» одной записи Механики.
 * @param {?object} actor  владелец — для гейта по Геносемени/Таланту.
 * @param {object}  entry  запись Механики (entry.when).
 * @param {?object} item   предмет, несущий эту запись — для гейта по субмутации.
 */
export function entryWhenOk(actor, entry, item = null) {
  const conditions = whenConditions(entry?.when);
  const subs = whenSubmutations(entry?.when);
  const talentSpec = whenTalentSpec(entry?.when);
  const tiers = whenWoundTier(entry?.when);
  const requireRage = !!entry?.when?.requireRage;
  const patronGods = whenPatronGod(entry?.when);
  const requireSealedArmour = !!entry?.when?.requireSealedArmour;
  const condKeys = whenCondition(entry?.when);
  if (!conditions.length && !subs.length && !talentSpec && !tiers.length && !requireRage
      && !patronGods.length && !requireSealedArmour && !condKeys.length) return true;

  let geneOk = true;
  if (conditions.length && actor) {
    const gs = actor.system?.geneSeed || {};
    const age = Number(actor.system?.bio?.age) || 0;
    const matches = conditions.some(c => {
      if (c.chapter ? (gs.legion !== c.legion || gs.chapter !== c.chapter) : gs.legion !== c.legion) return false;
      if (c.ageAtLeast != null && c.ageAtLeast !== "" && age < Number(c.ageAtLeast)) return false;
      return true;
    });
    geneOk = entry.when.negate ? !matches : matches;
  }

  let subOk = true;
  if (subs.length && item) {
    const label = item.system?.submutation?.label || "";
    if (!label) {
      // Субмутация ещё не выбрана — гейт не пройден НЕЗАВИСИМО от negateSub:
      // запись не должна включиться ДО броска (см. шапку), а «любая, КРОМЕ
      // этой» — это всё ещё «какая-то выпала».
      subOk = false;
    } else {
      const matches = subs.includes(label);
      subOk = entry.when.negateSub ? !matches : matches;
    }
  }

  let talentOk = true;
  if (talentSpec && actor) {
    // Без актора (предпросмотр вне владельца) условие считается пройденным —
    // и для negateTalent тоже (раньше отрицание гасило запись в предпросмотре).
    const has = hasTalentSpec(actor, talentSpec.name, talentSpec.specialization);
    talentOk = entry.when.negateTalent ? !has : has;
  }

  let tierOk = true;
  if (tiers.length && actor) {
    const matches = PREDICATES.woundTier(actor, {}, tiers);
    tierOk = entry.when.negateWoundTier ? !matches : matches;
  }

  let rageOk = true;
  if (requireRage && actor) {
    const inRage = PREDICATES.inRage(actor);
    rageOk = entry.when.negateRage ? !inRage : inRage;
  }

  let patronOk = true;
  if (patronGods.length && actor) {
    const god = actor.system?.patronGod || "";
    const matches = patronGods.includes(god);
    patronOk = entry.when.negatePatronGod ? !matches : matches;
  }

  let sealedOk = true;
  if (requireSealedArmour && actor) {
    const sealed = PREDICATES.wearsSealedArmour(actor);
    sealedOk = entry.when.negateSealedArmour ? !sealed : sealed;
  }

  let condOk = true;
  if (condKeys.length && actor) {
    const matches = PREDICATES.hasCondition(actor, {}, condKeys);
    condOk = entry.when.negateCondition ? !matches : matches;
  }

  return geneOk && subOk && talentOk && tierOk && rageOk && patronOk && sealedOk && condOk;
}
