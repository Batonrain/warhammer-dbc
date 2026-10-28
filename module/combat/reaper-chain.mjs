// module/combat/reaper-chain.mjs
// ════════════════════════════════════════════════════════════════════════════
//  REAPER / ЖНЕЦ — Foundry-обвязка к rules/melee-talents.mjs::reaperTriggered/reaperMeasure
//  (Таланты «Рукопашные», Sahara 3-8dc5; решение владельца 26.10.2026).
//
//  Книга: «Когда он совершает Натиск и убивает цель, но еще имеет непотраченные атаки, он может
//  продолжить движение до следующей цели и атаковать ее, но не дальше полной дистанции Натиска
//  и не дальше дистанции полудвижения (SPD) от начальной цели.»
//
//  Решения владельца 26.10.2026: «убивает» = у цели констатирована смерть (состояние «Смерть
//  констатирована», sheets/tabs/body.mjs::setDeceased — единственная точка, где система признаёт смерть);
//  «непотраченные атаки» — сам Талант даёт +1 Атаку цепочки за каждое такое убийство, надбавка к лимиту не нужна.
//  Конвейер урона (damage.mjs) метит жертву «последний удар — рукопашный Натиск» (markLastChargeHit), а когда
//  смерть констатируют, offerReaperAfterKill выпускает в чат карточку «Жнец» с кнопкой (только если смерть
//  в том же Раунде и бою, что удар). Одна карточка = одна дополнительная Атака, тратится кнопкой. Клик
//  (hooks.mjs, .wh-reaper-btn):
//    1. берёт выцеленный токен — следующую цель (не атакующий и не убитая);
//    2. МЕРИТ по сцене: от начальной цели цепочки (первая убитая за Натиск; её uuid держит флаг
//       Хода reaperInitialTarget) до новой — не больше Полудвижения; уже пройденное токеном за Ход
//       (TokenDocument#movementHistory) плюс путь до базового контакта с новой целью — не больше
//       дистанции Натиска. Нет сцены или токенов — отказ с причиной, а не «верим на слово»;
//    3. открывает окно атаки с Базой «Натиск»: ОД не списываются (Натиск уже оплачен), сама атака —
//       дополнительная и в лимит Атак за Ход не идёт (techniqueOpts.reaperFollow → freeMeleeFlags);
//       убийство ею снова констатируется — и снова даёт карточку.
//  Токен система не двигает: игрок подводит его сам, в пределах бюджета пути Натиска.
//  Раз на карточку: отметка ставится в момент клика, после успешного замера. Кнопка живёт один Раунд.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { REAPER_CHAIN_FLAG, reaperTriggered, reaperMeasure } from "../rules/melee-talents.mjs";
import { walkedMeters } from "../rules/movement-path.mjs";
import { tokenDocDistance, tokenDocEdgeDistance } from "../regions/auras.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

const NS = "warhammer-dbc";

/** Ключ отметки на карточке (белый список сокета — card-once.mjs::CARD_ONCE_FLAGS). */
export const REAPER_CARD_FLAG = "reaperUsed";

/**
 * Метка на жертве: последний удар по ней нанесён рукопашной Базой «Натиск». Ставит combat/damage.mjs вместе
 * с LAST_DAMAGE_WEAPON_FLAG, читает offerReaperAfterKill в момент, когда система признаёт смерть (setDeceased).
 */
export const LAST_DAMAGE_CHARGE_FLAG = "lastDamageCharge";

/**
 * Записать (или снять) метку «последний удар — Натиск». Зовёт конвейер урона при непоглощённом уроне:
 * «последний» и есть тот, от которого умерли, поэтому не-Натиск прежнюю метку стирает.
 */
export async function markLastChargeHit(victim, { melee, chargeBase, attackerUuid, targetTokenUuid }) {
  if (!victim?.setFlag) return;
  if (melee && chargeBase && attackerUuid) {
    const combat = globalThis.game?.combat;
    await victim.setFlag(NS, LAST_DAMAGE_CHARGE_FLAG, {
      attackerUuid, tokenUuid: targetTokenUuid || "", combatId: combat?.id ?? "", round: Number(combat?.round) || 0
    });
  } else if (victim.getFlag?.(NS, LAST_DAMAGE_CHARGE_FLAG)) {
    await victim.unsetFlag?.(NS, LAST_DAMAGE_CHARGE_FLAG);
  }
}

/** Разметка кнопки (класс .wh-reaper-btn слушает hooks.mjs). Бой и Раунд — чтобы кнопка не пережила Ход. */
export function reaperButtonHtml({ attackerUuid, weaponUuid, targetTokenUuid, targetName = "", combatId = "", round = 0 }) {
  return `<div class="roll-defense-section">
    <button class="wh-reaper-btn" type="button"
      data-attacker-uuid="${esc(attackerUuid)}" data-weapon-uuid="${esc(weaponUuid)}" data-killed-token-uuid="${esc(targetTokenUuid)}"
      data-combat-id="${esc(combatId)}" data-round="${Number(round) || 0}"
      title="Жнец: выцельте следующего врага — система замерит по сцене (не дальше Полудвижения от начальной цели и не дальше дистанции Натиска) и откроет атаку с Базой «Натиск» без новых ОД. Одна дополнительная Атака на это убийство.">
      ${rollIcon("sword")}Жнец: к следующей цели после ${esc(targetName)}
    </button>
  </div>`;
}

/**
 * Смерть цели констатирована (sheets/tabs/body.mjs::setDeceased, «жив → мёртв») — если последний удар был
 * рукопашным Натиском носителя Таланта в ЭТОМ же Раунде, в чат уходит карточка «Жнец»: одно убийство — одна
 * дополнительная Атака цепочки (кнопка; тратится дочерней атакой). Решение владельца 26.10.2026: «убивает» =
 * состояние «Смерть констатирована», а «непотраченные атаки» даёт сам Талант.
 * @param {Actor} victim
 * @param {Item} weapon  оружие последнего ранения (LAST_DAMAGE_WEAPON_FLAG)
 * @returns {Promise<boolean>} карточка выпущена
 */
export async function offerReaperAfterKill(victim, weapon) {
  const rec = victim?.getFlag?.(NS, LAST_DAMAGE_CHARGE_FLAG);
  if (!rec?.attackerUuid || !weapon) return false;
  const combat = globalThis.game?.combat;
  if (rec.combatId !== (combat?.id ?? "") || rec.round !== (Number(combat?.round) || 0)) return false;   // умер позже, не от этого Натиска
  const attacker = await fromUuid(rec.attackerUuid).catch(() => null);
  if (!attacker || attacker === victim) return false;
  if (!reaperTriggered(attacker, { melee: weapon.system?.weaponClass === "melee", chargeBase: true })) return false;
  const html = reaperButtonHtml({
    attackerUuid: attacker.uuid, weaponUuid: weapon.uuid, targetTokenUuid: rec.tokenUuid, targetName: victim.name,
    combatId: rec.combatId, round: rec.round
  });
  await victim.unsetFlag?.(NS, LAST_DAMAGE_CHARGE_FLAG);
  await postTestCard(attacker, {
    icon: rollIcon("skull", "#e08a3a"),
    title: `Жнец — ${esc(victim.name)} убит(а) на Натиске`,
    lines: [`<div class="roll-threshold">${esc(attacker.name)}: дополнительная Атака цепочки — к следующему врагу.</div>`, html]
  }, { sound: false });
  return true;
}

const rectOf = doc => ({
  x: Number(doc?.x) || 0, y: Number(doc?.y) || 0,
  width: Number(doc?.width) || 1, height: Number(doc?.height) || 1,
  elevation: Number(doc?.elevation) || 0
});

/**
 * Замер шага цепочки по токенам-документам. Нет сетки или токена — null в расстояниях (reaperMeasure откажет).
 * @returns {{verdict:object, initialToNext:?number, attackerToNext:?number, walked:?number}}
 */
export function measureReaperStep({ actor, attackerDoc, initialDoc, nextDoc }) {
  const grid = attackerDoc?.parent?.grid ?? globalThis.canvas?.scene?.grid ?? null;
  const ready = !!(grid && attackerDoc && initialDoc && nextDoc);
  const initialToNext = ready ? tokenDocDistance(rectOf(initialDoc), rectOf(nextDoc), grid) : null;
  const attackerToNext = ready ? tokenDocEdgeDistance(rectOf(attackerDoc), rectOf(nextDoc), grid) : null;
  const history = [...(attackerDoc?.movementHistory ?? [])];
  // Отрезки ГМа считаются: NPC двигает сам ГМ, и «не едят бюджет игрока» (path-limit) здесь неверно —
  // предел «не дальше полной дистанции Натиска» относится к любому пройденному пути.
  const walked = ready ? walkedMeters(history, { actions: globalThis.CONFIG?.Token?.movement?.actions ?? {} }) : null;
  const mv = actor?.system?.movement ?? {};
  const verdict = reaperMeasure({
    charge: Number(mv.charge) || 0, halfMove: Number(mv.halfMove) || 0, walked, initialToNext, attackerToNext
  });
  return { verdict, initialToNext, attackerToNext, walked };
}

/**
 * Клик по кнопке. Возвращает true, если окно атаки открыто.
 * @param {Actor} attacker
 * @param {Item} weapon
 * @param {{killedTokenUuid:string, claim:()=>Promise<boolean>}} o
 *   claim — отметка карточки «раз на карточку»; зовётся ТОЛЬКО после успешного замера
 */
export async function startReaperFollow(attacker, weapon, { killedTokenUuid = "", combatId = "", round = 0, claim } = {}) {
  const warn = text => globalThis.ui?.notifications?.warn(`⚠️ Жнец: ${text}`);
  const combat = globalThis.game?.combat;
  if (combatId !== (combat?.id ?? "") || (Number(round) || 0) !== (Number(combat?.round) || 0)) {
    warn("дополнительная Атака этого убийства относилась к другому Раунду — Натиск уже закончился.");
    return false;
  }
  const attackerDoc = attacker.getActiveTokens?.(false, true)?.[0] ?? null;
  if (!attackerDoc) { warn("токен атакующего не найден на сцене — замер невозможен."); return false; }
  const next = [...(globalThis.game?.user?.targets ?? [])]
    .map(t => t.document ?? t)
    .find(d => d?.uuid !== killedTokenUuid && d?.actor && d.actor !== attacker && d.uuid !== attackerDoc.uuid);
  if (!next) { warn("выцельте следующего врага (убитая цель не подходит)."); return false; }
  const initialUuid = attacker.getFlag?.(NS, REAPER_CHAIN_FLAG) || killedTokenUuid;
  const initialDoc = initialUuid ? await fromUuid(initialUuid).catch(() => null) : null;
  if (!initialDoc) { warn("токен начальной цели не найден на сцене — замер невозможен."); return false; }

  const { verdict } = measureReaperStep({ actor: attacker, attackerDoc, initialDoc, nextDoc: next });
  if (!verdict.ok) { warn(`${next.name ?? next.actor?.name ?? "цель"} недосягаема — ${verdict.problems.join("; ")}.`); return false; }

  if (claim && !(await claim())) return false;
  if (!attacker.getFlag?.(NS, REAPER_CHAIN_FLAG)) await attacker.setFlag?.(NS, REAPER_CHAIN_FLAG, initialDoc.uuid);
  await attacker.sheet?._showAttackDialog?.(weapon, { forceBase: "charge", reaperFollow: true });
  return true;
}
