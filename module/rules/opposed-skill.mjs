// module/rules/opposed-skill.mjs
// ════════════════════════════════════════════════════════════════════════
//  ЧЕМ СОПЕРНИК ОТВЕЧАЕТ ВО ВСТРЕЧНОМ ТЕСТЕ НАВЫКА (шаг 4 плана «закрыть
//  автоматизацию Навыков», 18.11.2026).
//
//  До этой правки авто-встречный тест (галочка в окне броска, wdbc-j814)
//  бросал за соперника ТОТ ЖЕ Навык, что у инициатора: Скрытность против
//  Скрытности, Очарование против Очарования. Книга (Основная книга, стр.
//  57-61, «Описания Навыков») пишет пары иначе:
//
//    Stealth   — «почти всегда встречные vs Awareness»;
//    Awareness — «заметить других… если они пытаются скрыться (vs Stealth)»;
//    Deceive   — «vs Scrutiny для распознания обмана, vs Awareness для
//                распознания маскировки» (маскировка гримом бросается с I);
//    Scrutiny  — «эксклюзивно… во встречных тестах vs Deceive»;
//    Charm     — «тесты на Charm становятся встречными (vs W)»;
//    Interrogate — «всегда встречные (vs W), являются тестами Морали»;
//    Intimidate  — «встречные тесты против Intimidate являются тестами
//                Морали» (тест Морали — W+0, combat/intimidate.mjs).
//
//  Торговля (Commerce) — «I, P, W или F в зависимости от аргументов»: какой
//  именно Характеристикой отвечает соперник, выбирает ГМ в окне броска
//  (селект рядом с авто-встречным, 20.11.2026, wdbc-5abej); без выбора —
//  Интеллект. Остальные Навыки книга встречными с другой стороной не
//  связывает, и для них соперник по-прежнему бросает тот же Навык.
// ════════════════════════════════════════════════════════════════════════

import { SKILLS_DEF } from "../constants/skills.mjs";

/** Навык инициатора → чем отвечает соперник: другим Навыком или Характеристикой. */
export const OPPOSED_PAIRS = {
  stealth:     { skill: "awareness" },
  awareness:   { skill: "stealth" },
  deceive:     { skill: "scrutiny", disguise: { char: "int", skill: "awareness" } },
  scrutiny:    { skill: "deceive" },
  charm:       { char: "wp" },
  interrogate: { char: "wp" },
  intimidate:  { char: "wp" }
};

/** Торговля: Характеристики, которыми может ответить соперник (выбор ГМа). */
export const COMMERCE_COUNTER_CHARS = ["int", "per", "wp", "fel"];
const CHAR_LABELS = { int: "Интеллект", per: "Восприятие", wp: "Сила Воли", fel: "Товарищество" };

/**
 * Сторона соперника во встречном тесте.
 *
 * @param {string|null} skillKey Навык инициатора (null — тест Характеристики)
 * @param {string} charKey       Характеристика, с которой бросал инициатор
 * @param {{counterChar?:string|null}} [opts] Торговля: Характеристика ответа, выбранная ГМом
 * @returns {{testKind:"skill"|"characteristic", skillKey:string|null, charKey:string, label:string, paired:boolean}}
 */
export function opposedSide(skillKey, charKey, { counterChar = null } = {}) {
  if (skillKey === "commerce") {
    const c = COMMERCE_COUNTER_CHARS.includes(counterChar) ? counterChar : "int";
    return { testKind: "characteristic", skillKey: null, charKey: c, label: CHAR_LABELS[c], paired: true };
  }
  const pair = skillKey ? OPPOSED_PAIRS[skillKey] : null;
  if (!pair) {
    return {
      testKind: skillKey ? "skill" : "characteristic", skillKey: skillKey ?? null, charKey,
      label: skillKey ? (SKILLS_DEF[skillKey]?.label ?? skillKey) : "", paired: false
    };
  }
  // Обман гримом бросается с I — тогда это маскировка, и её распознают Внимательностью.
  const p = (pair.disguise && charKey === pair.disguise.char) ? pair.disguise : pair;
  if (p.skill) {
    return { testKind: "skill", skillKey: p.skill, charKey: SKILLS_DEF[p.skill]?.char ?? charKey,
             label: SKILLS_DEF[p.skill]?.label ?? p.skill, paired: true };
  }
  return { testKind: "characteristic", skillKey: null, charKey: p.char, label: "Сила Воли", paired: true };
}
