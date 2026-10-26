// module/combat/show-off.mjs
// ════════════════════════════════════════════════════════════════════════════
//  SHOW-OFF / РИСОВКА — Foundry-обвязка к rules/show-off.mjs (Таланты «Рукопашные», Sahara 3-8dc5;
//  решение владельца 26.10.2026).
//
//  Книга: «Действие: Полудействие (Физическое, Рукопашное, Ментальное). Находясь в рукопашной,
//  персонаж проводит тест WS+0 vs WS+0 против до F.b целей в базовом контакте (бросая только раз
//  против всех). Если он побеждает, цели до начала его следующего Хода теряют все преимущества
//  Командования и не могут получать новых, а он может немедленно провести по одной базовой
//  рукопашной атаке по каждой цели, против которой он победил на 5+ Успехов. Это не считается
//  атакой, так что позволяет использовать второе полудействие на атакующий прием.»
//
//  Кнопка живёт на вкладке Боя (character-context.mjs → tabs/combat.mjs). Клик:
//    1. враги в базовом контакте — замер по токенам (combat/free-attack.mjs, как у Спасителя);
//    2. цели: выцеленные, иначе все, если их не больше F.b (rules/show-off.mjs::showOffPickTargets);
//    3. общий встречный тест (techniques.mjs::_showContestDialog, apCost:1 — 1 ОД списывается в момент
//       «Бросок!», «Отмена» ничего не съедает): инициатор бросает ОДИН раз, на каждого противника —
//       кнопка «Сопротивляться» (combat/opposed-contest.mjs);
//    4. победа над целью (onSuccess на каждую) — метка запрета Командования (command-state.mjs::
//       suppressCommandOf; снимается в начале следующего Хода Рисующегося), а с перевесом 5+ Успехов
//       — кнопка свободной базовой атаки по этой цели: окно атаки, База «Стандартная», ОД не
//       списываются и лимит Атак за Ход не растёт (techniqueOpts.showOffFree).
//  Свободная атака — первым надетым рукопашным оружием (equipped-melee.mjs); раз на карточку.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, outcomeHtml } from "../helpers/test-card.mjs";
import { hasMeleeTalent } from "../rules/melee-talents.mjs";
import { showOffMaxTargets, showOffPickTargets, showOffFreeAttackWon, SHOW_OFF_FREE_ATTACK_MARGIN } from "../rules/show-off.mjs";
import { canSpendActionPoints } from "./action-economy.mjs";
import { equippedMeleeWeapon } from "./equipped-melee.mjs";
import { suppressCommandOf } from "./command-state.mjs";

/** Ключ отметки на карточке (белый список сокета — card-once.mjs::CARD_ONCE_FLAGS). */
export const SHOW_OFF_CARD_FLAG = "showOffAttackUsed";

/** Определение Состязания: WS+0 vs WS+0, Полудействие (1 ОД) — списывается внутри окна по apCost. */
export const SHOW_OFF_CONTEST = {
  label: "Рисовка", wsBonus: 0,
  modLabel: "WS vs WS",
  defaultChar: "ws", allowedChars: ["ws"],
  apCost: 1,
  note: "Полудействие. WS+0 против WS+0 каждой цели в базовом контакте (до F.b целей, бросок один). Победа — цель теряет Командование до начала вашего следующего Хода; на 5+ Успехов — свободная базовая атака по ней.",
  targetDodgeMod: 0, targetParryMod: 0,
  chatNote: "⚡ Один бросок WS против всех выбранных целей"
};

/** Есть ли у актора Талант (для показа кнопки). */
export function hasShowOff(actor) {
  return hasMeleeTalent(actor, "showOff");
}

/** {disabled, title} для кнопки на листе — гейт по ОД виден ДО клика. */
export function showOffGate(actor) {
  if (!canSpendActionPoints(actor, 1, { physical: true })) return { disabled: true, title: "Не хватает ОД на Полудействие" };
  return {
    disabled: false,
    title: `Рисовка: Полудействие. WS+0 против до F.b врагов в базовом контакте одним броском; победа — цели теряют Командование до вашего следующего Хода, на ${SHOW_OFF_FREE_ATTACK_MARGIN}+ Успехов — свободная базовая атака`
  };
}

/** Разметка кнопки свободной атаки (класс .wh-show-off-attack-btn слушает hooks.mjs). */
export function showOffAttackButtonHtml({ attackerUuid, weaponUuid, targetUuid, targetName = "" }) {
  return `<button class="wh-show-off-attack-btn" type="button"
      data-attacker-uuid="${esc(attackerUuid)}" data-weapon-uuid="${esc(weaponUuid)}" data-target-uuid="${esc(targetUuid)}"
      title="Рисовка: победа на ${SHOW_OFF_FREE_ATTACK_MARGIN}+ Успехов — базовая рукопашная атака по этой цели, не считается атакой (ни ОД, ни лимита Атак)">
      ${rollIcon("sword")}Свободная атака по ${esc(targetName)}
    </button>`;
}

/** Победа над одной целью (колбэк общего встречного теста, зовётся на каждого побеждённого). */
export async function resolveShowOffSuccess(actor, { deg, target, margin } = {}) {
  if (!target) return globalThis.ui?.notifications?.warn(`${actor.name}: цель Рисовки не найдена — эффект не наложен.`);
  await suppressCommandOf(target, actor);
  const weapon = equippedMeleeWeapon(actor);
  const freeAttack = showOffFreeAttackWon({ margin, deg });
  const sections = [
    `<div class="roll-threshold">${esc(target.name)} теряет все преимущества Командования и не получает новых до начала следующего Хода ${esc(actor.name)}.</div>`
  ];
  if (freeAttack) {
    sections.push(weapon
      ? `<div class="roll-defense-section">${showOffAttackButtonHtml({
          attackerUuid: actor.uuid, weaponUuid: weapon.uuid, targetUuid: target.uuid, targetName: target.name })}</div>`
      : `<div class="roll-threshold">Победа на ${margin} Успехов — свободная атака положена, но надетого рукопашного оружия нет.</div>`);
  }
  await postTestCard(actor, {
    icon: rollIcon("sword", "#e08a3a"),
    title: `Рисовка: ${esc(target.name)}`,
    outcome: outcomeHtml(true, `Победа — перевес ${margin} Успехов${freeAttack ? " (5+: свободная атака)" : ""}`),
    sections
  }, { sound: false });
}

/** Клик по кнопке вкладки Боя: цели по токенам → общий встречный тест. */
export async function triggerShowOff(actor) {
  const warn = text => globalThis.ui?.notifications?.warn(`⚠️ Рисовка: ${text}.`);
  const tokenDoc = actor.getActiveTokens?.(false, true)?.[0] ?? actor.token ?? null;
  if (!tokenDoc) return warn("токен персонажа не найден на сцене — замер контакта невозможен");
  const { enemyContactTokenDocs } = await import("./free-attack.mjs");
  const contact = enemyContactTokenDocs(tokenDoc).map(d => ({ uuid: d.uuid, actor: d.actor, name: d.name ?? d.actor?.name }));
  const targeted = [...(globalThis.game?.user?.targets ?? [])].map(t => t.document ?? t).map(d => ({ uuid: d.uuid, actor: d.actor }));
  const pick = showOffPickTargets({ contact, targeted, max: showOffMaxTargets(actor) });
  if (!pick.ok) return warn(pick.reason);
  const opponents = pick.picked.map(p => p.actor).filter(a => a && a !== actor);
  if (!opponents.length) return warn("у целей нет актора");
  const { _showContestDialog } = await import("./techniques.mjs");
  return _showContestDialog(actor, { ...SHOW_OFF_CONTEST, opponents: () => opponents, onSuccess: resolveShowOffSuccess });
}
