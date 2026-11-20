// module/rules/library/target-social-talents.mjs
//
// Таланты, которые штрафуют ЧУЖОЙ тест против носителя (Разобрать b73dj) —
// тот же приём, что Синэстезия (library/synesthesia.mjs): статичное правило
// читает цель текущего теста (ctx.targetActor, первый выбранный токен).
//
//  • Mimic / Мимик: «встречный Deceive+0 vs Scrutiny−10 (или Scrutiny+0, если
//    изучал не вживую)» — галочка −10 у слушателя: изучал ли Мимик голос
//    вживую, знает только стол.
//  • Unremarkable / Непримечательный: «попытки идентифицировать персонажа
//    среди других людей, описать приметы или вспомнить черты лица — −20» —
//    галочка на Awareness/Scrutiny: опознание это или обычный тест, решает стол.

import { hasAbility } from "../ability-by-key.mjs";

export const MIMIC_SCRUTINY_MOD = -10;
export const UNREMARKABLE_MOD = -20;

/** Носитель Таланта — для подсказок и для поиска носителя по имени. */
export const isMimic = actor => hasAbility(actor, "social.core.mimic", "Mimic", "talent");
export const isUnremarkable = actor => hasAbility(actor, "social.core.unremarkable", "Unremarkable", "talent");

export const TARGET_SOCIAL_TALENT_RULES = [
  {
    id: "talent.mimic.scrutiny",
    label: "Мимик: цель подделывает голос, изучив его вживую",
    when: { targetHasTalent: "Mimic" },
    effects: [{ kind: "rollBonus", target: "skill:scrutiny", value: MIMIC_SCRUTINY_MOD, askOnly: true }]
  },
  {
    id: "talent.unremarkable.identify",
    label: "Непримечательный: опознать, описать или вспомнить цель",
    when: { targetHasTalent: "Unremarkable" },
    effects: [{ kind: "rollBonus", target: ["skill:awareness", "skill:scrutiny", "skill:inquiry"], value: UNREMARKABLE_MOD, askOnly: true }]
  }
];
