// module/rules/advance-category.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Одна точка расчёта категории цены Продвижения (Дружественная / Нейтральная /
//  Враждебная) — и для ЦЕНЫ в опыте, и для значка Д/Н/В на листе.
//
//  Раньше их считали двумя разными путями, и пути расходились (wdbc-gafj):
//  цена шла через charImpCost/skillCumCost и учитывала расовый override
//  (Африэль/Эльданар/Серый Человек, wdbc-zk69) и культуру легиона, а значок —
//  через голые resolveCharCat/resolveSkillCat, то есть только по совпадению
//  Склонностей. У персонажа с override «Стойкость всегда Дружественная» значок
//  показывал В, а первая ступень стоила 100 опыта — цену Дружественной.
//
//  Порядок приоритетов здесь тот же, по которому книга считает цену, и он
//  задан ОДИН раз:
//    0) расовый override «Враждебный» — Отвращение к Порядку Зверолюда делает
//       враждебными ВСЕ группы Lore и Trade (сверка главы I, 28.09.2026);
//    1) Ремесло и Общие знания — всегда Дружественные (стр. 58, 61);
//    2) специализация, отмеченная Дружественной на Родном мире;
//    3) расовый/субрасовый override (стр. субрас, «независимо от
//       Покровительства») — выше культуры легиона, решение владельца wdbc-zk69;
//    4) культура легиона;
//    5) совпадение Склонностей персонажа / Покровительство (режим цены).
//
//  advanceCatSource отвечает на второй вопрос, который лист раньше не мог
//  задать вовсе: ПОЧЕМУ здесь эта буква. Пункты 1-2 игрок и так видит по
//  названию строки, а вот 3-4 приходят от расы или легиона и с листа не
//  выводятся ниоткуда — их подпись и собирается.
// ════════════════════════════════════════════════════════════════════════════

import { resolveCharCat, resolveSkillCat, aptitudeCat, ALIGN_LABEL } from "../constants/advancement.mjs";
import { effectivePricingMode, talentPatronCat, talentGodKeyOf, isEliteTalent } from "../constants/patronage.mjs";
import { CHAOS_PATRONS }                   from "../constants/chaos-patron.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF }    from "../constants/skills.mjs";
import { cultureCat, resolveCultureFx }    from "../constants/legions.mjs";
import { isFriendlySpecialty }             from "./friendly-specialties.mjs";
import { resolveAptitudeOverride, aptitudeOverrideLabels } from "./aptitude-overrides.mjs";

/** Машинная культура легиона персонажа (может быть не от своего геносемени). */
export function cultFxOf(actor) {
  const gs = actor?.system?.geneSeed;
  if (!gs) return null;
  return resolveCultureFx(gs.cultureLegion || gs.legion, gs.cultureChapter || gs.chapter);
}

/** Категория Характеристики: override расы, иначе обычный расчёт. */
export function charAdvanceCat(actor, charKey, charApts) {
  return resolveAptitudeOverride(actor, "characteristic", charKey)
      ?? resolveCharCat(charKey, charApts, actor);
}

/**
 * Категория Навыка / Группового Навыка / его специализации.
 *
 * @param {Actor}  actor
 * @param {object} def   запись SKILLS_DEF или GROUP_SKILLS_DEF
 * @param {object} [ctx]
 * @param {string} [ctx.group]      ключ Группы Навыков (для специализаций)
 * @param {string} [ctx.specialty]  название специализации
 * @param {string} [ctx.skillKey]   ключ обычного Навыка
 * @param {string} [ctx.entryChar]  своя Характеристика записи Группы
 * @param {string[]} [ctx.entryApts] своя привязка Склонностей записи (wdbc-fzbu)
 * @param {Set|Array} charApts      Склонности персонажа
 */
export function skillAdvanceCat(actor, def, { group = "", specialty = "", skillKey = "", entryChar = "", entryApts = null } = {}, charApts) {
  // Расовый «Враждебный» сильнее книжного «всегда Дружественный»: Отвращение
  // к Порядку Зверолюда делает враждебными все Навыки групп Lore и Trade —
  // и Общие знания с Ремеслом тоже (частное правило расы бьёт общее). Порядок
  // подтверждён Сергеем 26.09.2026 (отменяет обратный порядок ревью 07.09.2026).
  const override = resolveAptitudeOverride(actor, "skill", def?.label || def?.name || "", group, { specialty });
  if (override === "enemy") return "enemy";
  if (def?.alwaysAlly) return "ally";
  if (group && isFriendlySpecialty(actor, group, specialty)) return "ally";
  const itemApts = [entryChar || def?.char, def?.apt2].filter(Boolean);
  return override
      // cultureCat матчит по-английски (CULT.friendlySkills/hostileSkills в
      // legions.mjs) — def?.label русский и никогда бы не совпал (wdbc-ko14).
      ?? cultureCat("skill", def?.en || def?.label || def?.name || "", "", cultFxOf(actor))
      ?? resolveSkillCat(group || skillKey, specialty, itemApts, charApts, actor, entryApts);
}

const ALIGN_WORD = { ally: "Дружественный", enemy: "Враждебный" };

/**
 * Откуда взялась категория, если она пришла НЕ из совпадения Склонностей
 * (wdbc-gafj): `{ kind, align, labels, text }` либо null.
 *
 * Нужна только подсказке значка Д/Н/В: «Дружественный от расы: Эльданар»
 * вместо буквы без объяснения. Категорию из Склонностей не подписывает —
 * список Склонностей персонажа и так лежит на той же вкладке.
 *
 * @param {"char"|"skill"|"group"} scope
 * @param {string} key ключ Характеристики / Навыка / Группы Навыков
 */
export function advanceCatSource(actor, scope, key, { group = "", specialty = "" } = {}) {
  if (!actor || !key) return null;

  if (scope === "char") {
    const align = resolveAptitudeOverride(actor, "characteristic", key);
    if (!align) return null;
    const labels = aptitudeOverrideLabels(actor, "characteristic", key);
    return describe("override", align, labels);
  }

  const def  = scope === "group" ? GROUP_SKILLS_DEF[key] : SKILLS_DEF[key];
  const name = def?.label || def?.name || "";
  const grp  = group || (scope === "group" ? key : "");

  // ПОРЯДОК ЗДЕСЬ ОБЯЗАН СОВПАДАТЬ С skillAdvanceCat, иначе подпись объяснит
  // не ту букву, которая нарисована (ревью 07.09.2026). Расовый «Враждебный»
  // (Отвращение к Порядку Зверолюда) стоит ВПЕРЕДИ «всегда Дружественного».
  const align = resolveAptitudeOverride(actor, "skill", name, grp, { specialty });
  if (align === "enemy") return describe("override", align, aptitudeOverrideLabels(actor, "skill", name, grp, { specialty }));

  if (def?.alwaysAlly) return describe("book", "ally", ["Ремесло и Общие знания Дружественные всегда"]);

  // Дружественная специализация Родного мира — источник виден на листе
  // (Родной мир), но не в этой строке, поэтому подписывается.
  if (grp && specialty && isFriendlySpecialty(actor, grp, specialty))
    return describe("homeworld", "ally", ["Родной мир"]);

  if (align) return describe("override", align, aptitudeOverrideLabels(actor, "skill", name, grp, { specialty }));

  const cult = cultureCat("skill", def?.en || name, "", cultFxOf(actor));
  if (cult) return describe("culture", cult, ["культура легиона"]);

  return null;
}

function describe(kind, align, labels) {
  const clean = (labels || []).filter(Boolean);
  const word  = ALIGN_WORD[align] || align;
  const from  = clean.length ? `: ${clean.join(", ")}` : "";
  // «независимо от Склонностей» — формулировка книги для override и культуры.
  // Для книжного «всегда Дружественный» она была бы маслом масляным, поэтому
  // у него своя.
  const head  = kind === "book" ? `${word} по книге` : `${word} независимо от Склонностей`;
  return { kind, align, labels: clean, text: `${head}${from}` };
}

// ════════════════════════════════════════════════════════════════════════════
//  ПОДСКАЗКА ЦЕНЫ ТАЛАНТА В ОКНЕ ПОКУПКИ (task-bd8d)
//  Категория цены Таланта (resolveTalentCat) зависит от режима цены персонажа,
//  а подпись «почему» была зашита на один режим — Склонности — и при
//  Покровительстве объясняла цену не той причиной. Здесь подпись берёт ту же
//  развилку режимов, что и расчёт: порядок «извне заданная категория → режим»
//  совпадает с talentCostXP/resolveTalentCat.
// ════════════════════════════════════════════════════════════════════════════

const godLabel = key => CHAOS_PATRONS.find(p => p.key === key)?.label ?? "Неделимый";
const lc = cat => (ALIGN_LABEL[cat] || cat).toLowerCase();

/**
 * Причина категории цены Таланта — текст для подсказки «Дружественная — …».
 *
 * @param {Actor}  actor
 * @param {object} doc      документ Таланта из компендиума
 * @param {Set}    charApts Склонности персонажа (charAptitudeSet)
 * @param {object} [opts]
 * @param {string|null} [opts.forced] категория, заданная расой/субрасой/культурой
 *        легиона (item-picker.mjs::talentCategory) — она перебивает любой режим
 * @returns {string}
 */
export function talentPriceReason(actor, doc, charApts, { forced = null } = {}) {
  if (forced) return "категория задана расой или культурой легиона независимо от Склонностей и Покровительства";

  const itemApts = [...new Set((doc?.system?.aptitudes || []).filter(Boolean))];
  const matches  = itemApts.filter(a => charApts.has(a)).length;
  const elite    = isEliteTalent(doc?.name, doc?.system?.specialization);
  const mode     = effectivePricingMode(actor);

  const aptText = elite
    ? "Таланты Элитных Архетипов нейтральны по Склонностям (стр. 24)"
    : `совпадений склонностей: ${matches}`;
  if (mode === "aptitude") return aptText;

  const patron = actor?.system?.patronGod || "";
  const patronCat = talentPatronCat(doc?.name, patron);
  const patronText = elite
    ? "Таланты Элитных Архетипов не привязаны к Богу"
    : `Бог Таланта — ${godLabel(talentGodKeyOf(doc?.name))}, ${patron ? `Покровитель — ${godLabel(patron)}` : "без Покровителя"}`;
  if (mode === "patronage") return `Покровительство: ${patronText}`;

  // Смешанная: каждая половина даёт свою категорию, итог — их сочетание (mixedCat).
  const aptCat = elite ? "neutral" : aptitudeCat(charApts, itemApts);
  return `Смешанная система: по склонностям — ${lc(aptCat)} (${aptText}); по Покровительству — ${lc(patronCat)} (${patronText})`;
}
