// module/combat/savior.mjs
// ════════════════════════════════════════════════════════════════════════════
//  SAVIOR / СПАСИТЕЛЬ — Таланты «Рукопашные», Sahara 3-8dc5.
//
//  Книга: «Оказываясь в базовом контакте с союзником и врагом одновременно (даже
//  посреди другого действия, в т.ч. Натиска или Верховой Атаки), он может потратить
//  Реакцию, и немедленно без траты действий провести против врага Давление.»
//
//  Кнопка живёт на вкладке Боя листа (не на карточке), поэтому доступна в любой момент,
//  в том числе посреди Натиска или Верховой Атаки: система не ведёт «посреди действия»
//  как состояние, нажатие просто не зависит от него. Условие «союзник И враг в базовом
//  контакте одновременно» система МЕРИТ по токенам сцены (combat/free-attack.mjs:
//  friendlyContactTokenDocs / enemyContactTokenDocs, тот же замер, что у Синхронного
//  Натиска). Враг — выцеленный токен из числа стоящих в контакте, иначе единственный
//  враг в контакте; если врагов несколько и цель не выбрана — просим выцелить.
//
//  Давление — общее Состязание (MELEE_CONTESTS.press, WS vs WS, победа двигает цель,
//  combat/feint-press.mjs::resolvePressSuccess). Реакция списывается в момент «Бросок!»
//  окна (pay): «Отмена» ничего не съедает, нет Реакции — броска нет. ОД Давление не берёт.
// ════════════════════════════════════════════════════════════════════════════

import { hasMeleeTalent } from "../rules/melee-talents.mjs";
import { MELEE_CONTESTS } from "../constants/combat.mjs";
import { spendReaction, canSpendReaction } from "./action-economy.mjs";

/** Есть ли у актора Талант (для показа кнопки). */
export function hasSavior(actor) {
  return hasMeleeTalent(actor, "savior");
}

/**
 * Чистое решение по замеру контакта: можно ли Спасителю сработать и против кого.
 * @param {number} allies          союзников в базовом контакте
 * @param {Array}  enemies         враги в контакте — любые объекты с .actor
 * @param {Actor|null} targetActor выцеленный игроком актор (или null)
 * @returns {{ok:boolean, reason:string, enemy:?object}}
 */
export function saviorPick({ allies, enemies, targetActor = null }) {
  if (!(allies > 0)) return { ok: false, reason: "нет союзника в базовом контакте", enemy: null };
  if (!enemies?.length) return { ok: false, reason: "нет врага в базовом контакте", enemy: null };
  const targeted = targetActor ? enemies.find(e => e.actor === targetActor || (e.actor?.uuid && e.actor.uuid === targetActor.uuid)) : null;
  if (targeted) return { ok: true, reason: "", enemy: targeted };
  if (enemies.length === 1) return { ok: true, reason: "", enemy: enemies[0] };
  return { ok: false, reason: "в контакте несколько врагов — выцельте того, против кого Давление", enemy: null };
}

/** {disabled, title} для кнопки на листе — гейт виден ДО клика. */
export function saviorGate(actor) {
  if (!canSpendReaction(actor)) return { disabled: true, title: "Не хватает Реакций" };
  return { disabled: false, title: "Спаситель: в базовом контакте с союзником и врагом — Реакция, Давление против врага без действий (можно посреди Натиска или Верховой Атаки)" };
}

/** Клик по кнопке: замер контакта → Реакция → Давление. */
export async function triggerSavior(actor) {
  const tokenDoc = actor.getActiveTokens?.(false)?.[0]?.document ?? actor.token ?? null;
  if (!tokenDoc) return ui.notifications?.warn("⚠️ Спаситель: токен персонажа не найден на сцене.");
  const { friendlyContactTokenDocs, enemyContactTokenDocs } = await import("./free-attack.mjs");
  const targetActor = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  const pick = saviorPick({
    allies: friendlyContactTokenDocs(tokenDoc).length,
    enemies: enemyContactTokenDocs(tokenDoc).map(d => ({ actor: d.actor, doc: d })),
    targetActor
  });
  if (!pick.ok) return ui.notifications?.warn(`⚠️ Спаситель: ${pick.reason}.`);
  const enemyActor = pick.enemy.actor;
  const { _showContestDialog } = await import("./techniques.mjs");
  const { resolvePressSuccess } = await import("./feint-press.mjs");
  await _showContestDialog(actor, {
    ...MELEE_CONTESTS.press,
    label: "Давление (Спаситель)",
    note: `${MELEE_CONTESTS.press.note} Спаситель: за Реакцию, без действий; враг — ${enemyActor?.name ?? "?"}.`,
    opponents: () => [enemyActor],
    onSuccess: resolvePressSuccess,
    pay: async () => {
      if (await spendReaction(actor)) return true;
      ui.notifications?.warn("⚠️ Не хватает Реакций.");
      return false;
    }
  });
}
