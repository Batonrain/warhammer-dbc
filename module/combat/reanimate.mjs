// module/combat/reanimate.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Талант «Реанимировать» (Медик, медик.core.reanimate; 3-dc87).
//  Книга: «Раз за бой/сцену персонаж может потратить Очко Бесчестия и за полное
//  действие вернуть к жизни труп на расстоянии касания, подняв Раны до 0, но
//  Оглушив на 1 Раунд, если тот умер не более Cor.b Раундов назад. Нельзя
//  реанимировать существо с полностью уничтоженной головой или убитое
//  варп-оружием/Выжиганием Души.»
//
//  Решение владельца 24.10.2026: умер дольше Cor.b Раундов назад — не получается
//  вовсе (условие допуска, ресурсы не тратятся). Голова и варп-оружие система
//  не отслеживает — самоподтверждение галочкой в диалоге Лечения.
//  Арифметика — rules/medic-talents.mjs, здесь только Foundry-обвязка.
// ════════════════════════════════════════════════════════════════════════════

import { hasTalentCapability } from "../rules/ability-by-key.mjs";
import { REANIMATE_CAP, roundsSinceDeath, reanimateWindow } from "../rules/medic-talents.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { spendActionPoints } from "./action-economy.mjs";
import { isRuleUsageUsed, markRuleUsageUsed } from "../apps/game-session.mjs";
import { actorInfamyPath, actorInfamyValue, spendFromInfamyPool } from "../apps/infamy-points.mjs";
import { tempInfamyAmount } from "../rules/temp-infamy.mjs";
import { inPariahVoid } from "../rules/null-zones.mjs";
import { conditionApplyFields } from "../sheets/tabs/conditions.mjs";
import { setDeceased } from "../sheets/tabs/body.mjs";
import { DECEASED_AT_FLAG } from "../sheets/tabs/death.mjs";
import { noteWoundsRestored, woundsRestored } from "./heal-target.mjs";

const NS = "warhammer-dbc";
/** Метка «раз за сцену» на самом медике (apps/game-session.mjs::markRuleUsageUsed). */
export const REANIMATE_USAGE_FLAG = "reanimate";

async function post(medic, patient, lines, rolls = []) {
  await postTestCard(medic, {
    icon: rollIcon("heart", "#ff8a8a"), title: `Реанимировать — ${esc(patient.name)}`,
    threshold: `<div class="roll-threshold">${lines.join("<br/>")}</div>`
  }, { rolls, sound: false });
}

/**
 * Реанимировать труп. Возвращает true, если пациент возвращён к жизни.
 * Порядок проверок — от дешёвых к платным: ничего не списывается, пока все
 * условия допуска не выполнены.
 */
export async function runReanimate(medic, patient, { reanimateOk = false } = {}) {
  const warn = text => globalThis.ui?.notifications?.warn?.(text);
  if (!hasTalentCapability(medic, REANIMATE_CAP)) { warn(`${medic.name}: нет Таланта «Реанимировать».`); return false; }
  if (patient === medic || (medic.id != null && medic.id === patient.id)) { warn("Реанимировать можно только чужой труп."); return false; }
  if (!patient.getFlag?.(NS, "deceased")) { warn(`${patient.name}: смерть не констатирована — оживлять нечего.`); return false; }
  if (!reanimateOk) { warn("Подтвердите: голова цела, смерть не от варп-оружия/Выжигания Души."); return false; }
  if (isRuleUsageUsed(medic, REANIMATE_USAGE_FLAG)) { warn(`${medic.name}: Реанимировать уже применялось в этой сцене.`); return false; }

  const combat = globalThis.game?.combat;
  const ago = roundsSinceDeath(patient.getFlag?.(NS, DECEASED_AT_FLAG), {
    worldTime: globalThis.game?.time?.worldTime, combatId: combat?.id ?? null, round: combat?.round
  });
  const win = reanimateWindow(ago, medic.system?.corruptionBonus);
  if (!win.ok) {
    await post(medic, patient, [
      `${rollIcon("skull", "#ff6b6b")}<b>Не получается</b>: ${esc(patient.name)} умер ${win.rounds} Раунд(ов) назад — больше Cor.b (${win.limit}).`,
      "Очко Бесчестия и действие не потрачены."
    ]);
    return false;
  }

  if (actorInfamyValue(medic) < 1 && tempInfamyAmount(medic) < 1) { warn(`${medic.name}: нет Очков Бесчестия.`); return false; }
  // Пустота Парии запрещает тратить Очки Бесчестия — проверяем ДО списания ОД.
  if (inPariahVoid(medic)) { warn("В Пустоте Парии нельзя тратить Очки Бесчестия."); return false; }
  if (!await spendActionPoints(medic, 2)) { warn("Не хватает ОД: нужно 2 (полное действие)."); return false; }
  const path = actorInfamyPath(medic);
  const spend = await spendFromInfamyPool(medic, 1, path);
  if (!spend) return false;
  if (spend.poolSpent) await medic.update({ [path]: spend.poolValue });
  await markRuleUsageUsed(medic, REANIMATE_USAGE_FLAG, "scene");

  // Раны до 0: value — текущие, critical — Раны в минусе (rules/wounds.mjs);
  // Оглушение на 1 Раунд — общая точка наложения (иммунитет учитывается).
  const patch = {
    "system.wounds.value": 0, "system.wounds.critical": 0,
    ...conditionApplyFields("stunned", 1, patient)
  };
  const lines = [
    `${rollIcon("heart", "#ff8a8a")}<b>${esc(patient.name)} возвращён к жизни</b>: Раны подняты до 0, Оглушение на 1 Раунд.`,
    ago != null ? `Умер ${ago} Раунд(ов) назад (предел Cor.b = ${win.limit}).` : `Момент смерти не записан — допуск по Cor.b (${win.limit}) на совести стола.`,
    "Потрачены: Очко Бесчестия, полное действие."
  ];
  const woundsBefore = { value: patient.system?.wounds?.value, critical: patient.system?.wounds?.critical };
  let revived = false;
  try {
    await patient.update(patch);
    revived = true;
    await setDeceased(patient, false);
  } catch {
    lines.push(`${rollIcon("warn", "#ffb84d")}Нет прав на изменение листа цели — снимите смерть и выставьте Раны 0 вручную (нужен ГМ).`);
  }
  // Труп встаёт — это лечение от другого: «Недоверие к Лечению» (Затронутый
  // Варпом, wdbc-1rno.26) через общую точку лечения Ран (combat/heal-target.mjs).
  // Только если Раны реально подняты (patient.update прошёл).
  if (revived) {
    try {
      const mistrust = await noteWoundsRestored(patient, medic, woundsRestored(woundsBefore, patient.system?.wounds));
      if (mistrust) lines.push(mistrust);
    } catch {
      lines.push(`${rollIcon("warn", "#ffb84d")}Недоверие к Лечению: нет прав на лист цели — штраф −10 (кроме T) на 1 час отметить вручную (нужен ГМ).`);
    }
  }
  await post(medic, patient, lines);
  return true;
}
