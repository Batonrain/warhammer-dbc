// module/combat/legacy-weapon-regroup.mjs
// ════════════════════════════════════════════════════════════════════════
//  Перегруппировка/vigilant 1-2, Оружие Наследия (wdbc-1rno.35, стр. 427):
//  «После успешной атаки этим оружием (даже если цель Избежала её) персонаж
//  может потратить Очко Бесчестия, чтобы перебросить свою Инициативу
//  начиная со следующего Раунда.»
//
//  «Начиная со следующего Раунда» — не «сейчас же»: обычный
//  actor.rollInitiative() пересортировал бы ТЕКУЩИЙ Раунд немедленно (стр.
//  427 явно откладывает эффект). Решение: кнопка карточки атаки только
//  СТАВИТ метку на Combatant'е (тратит Очко сразу — это стоимость решения,
//  а не результата), сам переброс происходит на смене Раунда — тот же хук
//  (module/hooks.mjs, updateCombat/changed.round), что The Middle of the
//  Hunt (combat/middle-of-the-hunt.mjs) уже использует для похожей задержки
//  «плюс к Инициативе на конкретном Раунде».
// ════════════════════════════════════════════════════════════════════════

import { actorInfamyValue, actorInfamyPath, spendFromInfamyPool } from "../apps/infamy-points.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const PENDING_FLAG = "legacyRegroupPending";

/** Кнопка карточки атаки: тратит 1 Очко Бесчестия, ставит метку на Combatant'а. */
export async function activateLegacyRegroup(actorUuid) {
  const actor = await fromUuid(actorUuid);
  if (!actor) return;
  const combatant = game.combat?.combatants?.find(c => c.actor?.uuid === actorUuid);
  if (!combatant) return ui.notifications?.warn("Перегруппировка: персонаж сейчас не в бою.");
  if (combatant.getFlag?.("warhammer-dbc", PENDING_FLAG))
    return ui.notifications?.warn("Переброс Инициативы уже запланирован на следующий Раунд.");
  if (actorInfamyValue(actor) < 1) return ui.notifications?.warn("Нет Очков Бесчестия.");

  const path = actorInfamyPath(actor);
  const spend = await spendFromInfamyPool(actor, 1, path);
  await actor.update({ [path]: spend.poolValue });
  await combatant.setFlag("warhammer-dbc", PENDING_FLAG, true);

  await postTestCard(actor, {
    icon: rollIcon("run", "#4dffa6"),
    title: `${esc(actor.name)} — Перегруппировка`,
    lines: ["<div>Инициатива будет переброшена в начале следующего Раунда.</div>"]
  }, { sound: false });
}

/**
 * Смена Раунда: у кого стоит метка — переброс Инициативы (тот же вызов, что
 * кнопка «🎲» на листе актора, module/sheets/actor-sheet.mjs::onInitiativeRoll),
 * метка снимается сразу — сработавшая Перегруппировка не повторяется молча
 * на следующей смене Раунда.
 */
export async function processLegacyRegroupRoundStart(combat) {
  for (const combatant of combat?.combatants ?? []) {
    if (!combatant.getFlag?.("warhammer-dbc", PENDING_FLAG)) continue;
    await combatant.unsetFlag("warhammer-dbc", PENDING_FLAG);
    if (combatant.actor) await combatant.actor.rollInitiative({ createCombatants: false, rerollInitiative: true });
  }
}
