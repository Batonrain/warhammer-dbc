// module/combat/hidden-threat.mjs
//
// Сокрытая Угроза (wdbc-1rno.1, module/rules/hidden-threat.mjs) — реактивный
// тест защищающегося на засечение Незримой атаки (Пси-чутьё/Ноосканирование,
// −50), кнопка в той же карточке, что Уклонение/Парирование
// (module/combat/attack-card.mjs::defenseSection).

import { postTestCard, thresholdLine } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const HIDDEN_THREAT_PENALTY = -50;

const SKILLS = {
  psyniscience: { label: "Психонаука (Пси-чутьё)", char: "per" },
  techUse:      { label: "Техпользование (Ноосканирование)", char: "int" }
};

export async function _performHiddenThreatDetect(actor, skillKey) {
  const def = SKILLS[skillKey];
  if (!def) return;

  const skillTotal = Number(actor.system?.skills?.[skillKey]?.total) || -20;
  const threshold = skillTotal + HIDDEN_THREAT_PENALTY;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= threshold;

  await postTestCard(actor, {
    icon: rollIcon("target"), title: `Засечь Незримую атаку — ${esc(actor.name)}`,
    threshold: thresholdLine({
      label: def.label, base: skillTotal,
      parts: [`Сокрытая Угроза ${HIDDEN_THREAT_PENALTY}`], threshold
    }),
    rv,
    outcome: success
      ? `<span class="roll-success">Успех — атака засечена.</span>`
      : `<span class="roll-failure">Провал — источник атаки остаётся скрыт.</span>`
  }, { rolls: [roll] });
}
