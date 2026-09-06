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

import { resolveCharCat, resolveSkillCat } from "../constants/advancement.mjs";
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
 * @param {Set|Array} charApts      Склонности персонажа
 */
export function skillAdvanceCat(actor, def, { group = "", specialty = "", skillKey = "", entryChar = "" } = {}, charApts) {
  if (def?.alwaysAlly) return "ally";
  if (group && isFriendlySpecialty(actor, group, specialty)) return "ally";
  const itemApts = [entryChar || def?.char, def?.apt2].filter(Boolean);
  return resolveAptitudeOverride(actor, "skill", def?.label || def?.name || "", group)
      // cultureCat матчит по-английски (CULT.friendlySkills/hostileSkills в
      // legions.mjs) — def?.label русский и никогда бы не совпал (wdbc-ko14).
      ?? cultureCat("skill", def?.en || def?.label || def?.name || "", "", cultFxOf(actor))
      ?? resolveSkillCat(group || skillKey, specialty, itemApts, charApts, actor);
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

  const align = resolveAptitudeOverride(actor, "skill", name, grp);
  if (align) return describe("override", align, aptitudeOverrideLabels(actor, "skill", name, grp));

  const cult = cultureCat("skill", def?.en || name, "", cultFxOf(actor));
  if (cult) return describe("culture", cult, ["культура легиона"]);

  // Дружественная специализация Родного мира — источник виден на листе
  // (Родной мир), но не в этой строке, поэтому подписывается тоже.
  if (grp && specialty && isFriendlySpecialty(actor, grp, specialty))
    return describe("homeworld", "ally", ["Родной мир"]);

  return null;
}

function describe(kind, align, labels) {
  const clean = (labels || []).filter(Boolean);
  const word  = ALIGN_WORD[align] || align;
  const from  = clean.length ? `: ${clean.join(", ")}` : "";
  return { kind, align, labels: clean, text: `${word} независимо от Склонностей${from}` };
}
