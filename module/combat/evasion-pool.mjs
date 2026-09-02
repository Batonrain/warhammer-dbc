// module/combat/evasion-pool.mjs
// ════════════════════════════════════════════════════════════════════════
//  «Избегание множественных попаданий и атак» (стр. 12), вторая половина
//  правила — см. [[doombc-dodge-parry-not-opposed]] для первой:
//
//  «Если персонаж подвергается нападению противника, наносящего несколько
//  атак в Ход, и после успешного Избегания одной его атаки у персонажа
//  остались не потраченные Успехи, он может потратить их на Избегание от
//  попаданий от других его атак этом Ходу, тратя по 2 Успеха на каждое
//  попадание. Если Успехов недостаточно... и у персонажа еще есть Реакции,
//  он может пытаться делать еще одну попытку Избегания... Если эти
//  попадания имеют штраф к Избеганию от них больше первого, за каждые
//  полные –10 штрафа тратится +1 Успех.»
//
//  «Успехи» здесь — излишек степеней успеха Уклонения/Парирования/Виража
//  сверх того, что нужно было этой атаке (deg − hitsCount, см. negatedHits
//  в helpers/utils.mjs); «штраф» — dodgeMod атаки (techOpts.targetDodgeMod),
//  как более универсальный из dodgeMod/parryMod (Парирование не всегда
//  доступно — нет оружия, Гибкое и т.п.), приближение, а не точный разбор
//  «какой из двух штрафов» — расхождение не стоит усложнения.
//
//  Пул хранится на ЗАЩИЩАЮЩЕМСЯ, ключ — атакующий (flags.warhammer-dbc.
//  evasionPool). «Ход» здесь не Раунд: валиден, пока это ещё Ход ТОГО ЖЕ
//  боевого участника (game.combat.combatant), сравнение — на чтении, без
//  отдельного хука на смену Хода. Вне активного Encounter «Ход» не
//  отследить — пул не заводится вовсе (как и остальная экономика действий,
//  см. action-economy.mjs).
// ════════════════════════════════════════════════════════════════════════

import { _degWord, _hitWord, esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { defenseSection } from "./attack-card.mjs";

const FLAG_KEY = "evasionPool";

const poolKey = attackerUuid => String(attackerUuid || "").replace(/\./g, "-");

/** Метка «этот же Ход этого же участника боя» — null вне активного Encounter. */
function currentTurnTag() {
  const combat = game.combat;
  if (!combat?.started) return null;
  return `${combat.id}:${combat.combatant?.id ?? ""}`;
}

/**
 * Банкует излишек Успехов Избегания сверх того, что нужно было ЭТОЙ атаке —
 * вызывается из _performDodge/_performParry/_performSwerve/resolveMountedDodge
 * после успешного теста. Вне боя или без attackerUuid ничего не делает и
 * отдаёт false — тем, кто зовёт, нужно это знать: без банка «остаётся N
 * Успехов» в карточке было бы враньём (потратить их будет негде).
 *
 * @returns {boolean} забанковано ли на самом деле
 */
export async function addEvasionSurplus(defender, attackerUuid, surplus, penalty = 0) {
  const tag = currentTurnTag();
  if (!tag || !attackerUuid || !(surplus > 0)) return false;
  const pool = foundry.utils.deepClone(defender.getFlag("warhammer-dbc", FLAG_KEY) || {});
  const key = poolKey(attackerUuid);
  const existing = pool[key]?.turnTag === tag ? pool[key] : null;
  pool[key] = existing
    ? { turnTag: tag, successes: existing.successes + surplus, penalty: existing.penalty }
    : { turnTag: tag, successes: surplus, penalty };
  await defender.setFlag("warhammer-dbc", FLAG_KEY, pool);
  return true;
}

/** Текущий остаток пула для пары (защищающийся, атакующий) — null, если пусто/устарело. */
export function getEvasionPool(defender, attackerUuid) {
  const tag = currentTurnTag();
  if (!tag || !attackerUuid) return null;
  const entry = defender.getFlag("warhammer-dbc", FLAG_KEY)?.[poolKey(attackerUuid)];
  if (!entry || entry.turnTag !== tag || !(entry.successes > 0)) return null;
  return entry;
}

/** Стоимость снятия ОДНОГО попадания из пула: 2 Успеха база + 1 за каждые
 *  полные −10 штрафа этой атаки сверх штрафа атаки, породившей пул. */
export function poolHitCost(basePenalty, thisPenalty) {
  const worse = Math.max(0, (basePenalty || 0) - (thisPenalty || 0));
  return 2 + Math.floor(worse / 10);
}

/** Сколько попаданий текущей атаки можно снять остатком пула, и по какой цене. */
export function poolAffordableHits(entry, thisPenalty, hitsCount) {
  if (!entry) return { hits: 0, cost: 0, perHit: 0 };
  const perHit = poolHitCost(entry.penalty, thisPenalty);
  const hits = Math.min(hitsCount, Math.floor(entry.successes / perHit));
  return { hits, cost: hits * perHit, perHit };
}

async function spendFromPool(defender, attackerUuid, amount) {
  const tag = currentTurnTag();
  const pool = foundry.utils.deepClone(defender.getFlag("warhammer-dbc", FLAG_KEY) || {});
  const key = poolKey(attackerUuid);
  const entry = pool[key];
  if (!entry || entry.turnTag !== tag) return;
  entry.successes = Math.max(0, entry.successes - amount);
  await defender.setFlag("warhammer-dbc", FLAG_KEY, pool);
}

/**
 * Клик по кнопке «Потратить пул»: тратит остаток на попадания ЭТОЙ атаки (не
 * больше hitsCount) и постит карточку исхода. Если попадания остаются —
 * добавляет свежие кнопки Уклонения/Парирования/Виража на ОСТАТОК (не на
 * полный hitsCount — иначе фреш-бросок мог бы «снять» больше попаданий, чем
 * реально осталось), чтобы разыграть их обычной Реакцией, как велит правило.
 */
export async function performPoolSpend(defender, {
  attackerUuid, hitsCount = 1, dodgeMod = 0, parryMod = 0, targetIsVehicle = false,
  flexible = false, forcedDefenceReroll = "", isMelee = false
} = {}) {
  const entry = getEvasionPool(defender, attackerUuid);
  const rollMode = game.settings.get("core", "rollMode");
  if (!entry) {
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: defender }),
      content: `<div class="wh-roll-result">
        <div class="roll-outcome"><span class="roll-failure">${rollIcon("ban","#ff6b6b")}Пул неизрасходованных Успехов пуст или устарел (сменился Ход).</span></div>
      </div>`
    }, rollMode));
    return;
  }

  const { hits: negated, cost, perHit } = poolAffordableHits(entry, dodgeMod, hitsCount);
  await spendFromPool(defender, attackerUuid, cost);
  const remaining = hitsCount - negated;

  const outcomeHtml = negated === 0
    ? `<span class="roll-failure">В пуле недостаточно Успехов даже на одно попадание (нужно ${perHit} за штуку, доступно ${entry.successes}).</span>`
    : remaining === 0
      ? `<span class="roll-success">Потрачено ${cost} Усп. из пула — снимает ${negated > 1 ? `все ${negated} ${_hitWord(negated)}` : "попадание"}! Атака промахивается.</span>`
      : `<span class="roll-failure">${rollIcon("warn","#ffb84d")}Потрачено ${cost} Усп. из пула — снимает ${negated} из ${hitsCount} ${_hitWord(hitsCount)}. ${remaining} ${_hitWord(remaining)} всё ещё проходит${remaining === 1 ? "" : "ят"}.</span>`;

  const continueHtml = remaining > 0
    ? `<div class="roll-defense-note">Успехов из пула не хватило на все попадания — можно разыграть Реакцией обычное Избегание на оставшиеся ${remaining} ${_hitWord(remaining)}:</div>
       ${defenseSection({ dodgeMod, parryMod, targetIsVehicle, forcedDefenceReroll },
                         { wp: { flexible }, attackerUuid, hitsCount: remaining, isMelee })}`
    : "";

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: defender }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("run")}Пул Избегания — ${esc(defender.name)}</div>
      <div class="roll-threshold">Остаток пула был: <b>${entry.successes}</b> Усп. (цена ${perHit}/попадание)</div>
      <div class="roll-outcome">${outcomeHtml}</div>
      ${continueHtml}
    </div>`
  }, rollMode));
}
