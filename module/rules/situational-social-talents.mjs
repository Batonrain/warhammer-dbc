// module/rules/situational-social-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Три Таланта, чьё условие решает стол и отмечает игрок галочкой в окне теста
//  (Sahara 3-scope и 3-5e84, решения владельца 24.10.2026):
//
//   • Лицо в Толпе (Face in a Crowd, «Социальные»): «может использовать F вместо A
//     для тестов на Stealth в людных местах». «Людное место» система не знает —
//     галочка «В толпе» в тесте Скрытности переключает «Бросок с:» на F
//     (setChar, как Аналитический Взгляд у Внимательности).
//   • Жалкие Слабаки (Pity the Weak): «+10 на Command, Commerce, Deceive и
//     Intimidate против целей, что слабее его в данной ситуации, но −10 на Charm
//     и Logic против них же». «Слабее в данной ситуации» книга не сводит к
//     сравнению характеристик — это галочка «Цель слабее» в окне каждого из шести
//     навыков (в окне виден только свой знак: +10 или −10).
//   • Идолопоклонник (Idolater): «штраф –30 на встречные броски против Команд и
//     социального взаимодействия кумира» — только пока стоит галочка «Кумир
//     рядом» (system.idolNearby); в тесте он предлагается галочкой, потому что
//     встречный ли это бросок против кумира, знает стол. Автопроход Морали этого
//     же Таланта — rules/morale-auto.mjs.
//
//  Файл подключён к sources.mjs, поэтому НЕ импортирует hasRuleFlag и всё, что
//  ведёт к collect.mjs: Таланты опознаются по имени предмета (тот же приём, что
//  rules/awareness-talents.mjs). Ключи Возможностей в паке остаются — по ним
//  храповик достижимости видит выдачу.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { IDOLATER_OPPOSED_PENALTY, isIdolNearby } from "./courage-talents.mjs";

export const FACE_IN_A_CROWD_NAME = "Face in a Crowd";
export const PITY_THE_WEAK_NAME   = "Pity the Weak";
export const IDOLATER_NAME        = "Idolater";

/** Жалкие Слабаки: +10 на эти навыки против слабых целей… */
export const PITY_BONUS_SKILLS = Object.freeze(["command", "commerce", "deceive", "intimidate"]);
/** …и −10 на эти. */
export const PITY_PENALTY_SKILLS = Object.freeze(["charm", "logic"]);
export const PITY_VALUE = 10;

const hasTalentNamed = (actor, name) =>
  [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, name));

/** Id правил-галочек (по ним в тестах находят строку). */
export const SITUATIONAL_SOCIAL_RULE_IDS = Object.freeze({
  faceInACrowd: "situationalSocial.faceInACrowd",
  pityBonus:    "situationalSocial.pityTheWeak.bonus",
  pityPenalty:  "situationalSocial.pityTheWeak.penalty",
  idolater:     "situationalSocial.idolater"
});

/** Источник правил «situationalSocialTalents» (rules/sources.mjs). */
export function situationalSocialRules(actor, ctx = {}) {
  const rules = [];
  const skill = ctx?.kind === "skill" ? String(ctx.skill ?? "").toLowerCase() : "";

  if (skill === "stealth" && hasTalentNamed(actor, FACE_IN_A_CROWD_NAME)) {
    rules.push({
      id: SITUATIONAL_SOCIAL_RULE_IDS.faceInACrowd, when: {},
      label: "Лицо в Толпе: в людном месте — F вместо A",
      effects: [{ kind: "rollBonus", target: "skill:stealth", value: 0, askOnly: true, setChar: "fel" }]
    });
  }

  if (skill && hasTalentNamed(actor, PITY_THE_WEAK_NAME)) {
    if (PITY_BONUS_SKILLS.includes(skill)) {
      rules.push({
        id: SITUATIONAL_SOCIAL_RULE_IDS.pityBonus, when: {},
        label: "Жалкие Слабаки: цель слабее в данной ситуации",
        effects: [{ kind: "rollBonus", target: `skill:${skill}`, value: PITY_VALUE, askOnly: true }]
      });
    } else if (PITY_PENALTY_SKILLS.includes(skill)) {
      rules.push({
        id: SITUATIONAL_SOCIAL_RULE_IDS.pityPenalty, when: {},
        label: "Жалкие Слабаки: цель слабее в данной ситуации (презираете её)",
        effects: [{ kind: "rollBonus", target: `skill:${skill}`, value: -PITY_VALUE, askOnly: true }]
      });
    }
  }

  if (isIdolNearby(actor) && hasTalentNamed(actor, IDOLATER_NAME)
      && (ctx?.kind === "skill" || ctx?.kind === "char")) {
    rules.push({
      id: SITUATIONAL_SOCIAL_RULE_IDS.idolater, when: {},
      label: "Идолопоклонник: встречный бросок против Команды или соц. взаимодействия кумира",
      effects: [{ kind: "rollBonus", target: ["social", "char:wp"], value: IDOLATER_OPPOSED_PENALTY, askOnly: true }]
    });
  }

  return rules;
}
