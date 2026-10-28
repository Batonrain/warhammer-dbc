// module/combat/tenacity.mjs
// ════════════════════════════════════════════════════════════════════════════
//  TENACITY / УПОРСТВО — Foundry-обвязка к rules/melee-talents.mjs::tenacityOffered
//  (Таланты «Рукопашные», Sahara 3-8dc5).
//
//  Книга: «Когда он совершает только одну одиночную рукопашную атаку в Ход, и та не
//  наносит урона, будь то из-за промаха, Избегания, поглощения, или щитов, он может
//  тут же провести эту атаку с той же базой и приемом по той же цели еще раз.»
//
//  Кнопка рисуется в карточке рукопашной атаки (combat/attack.mjs → attack-card.mjs),
//  когда атака одиночная и единственная в Ходу. Клик (hooks.mjs, .wh-tenacity-btn)
//  открывает окно атаки тем же оружием, с той же Базой и тем же Приёмом, цель не
//  сбрасывается; повтор ни ОД, ни Лимит Атак не тратит и сам нового повтора не
//  порождает (techniqueOpts.tenacityRepeat, sheets/attack/dialog.mjs).
//
//  «Не нанесла урона»: система не видит исход одним сигналом (промах — на карточке,
//  Избегание — в карточке защиты, поглощение/щиты — в карточке урона), поэтому
//  проверяется метка Хода «рукопашная атака нанесла урон» (MELEE_DAMAGE_DEALT_FLAG),
//  которую ставит применение урона: нанесла — повтор закрыт. Раз на карточку.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { MELEE_DAMAGE_DEALT_FLAG, MELEE_DAMAGE_APPLIED_FLAG, hasMeleeTalent, tenacityNeedsConfirm } from "../rules/melee-talents.mjs";

/** Ключ отметки на карточке (белый список сокета — card-once.mjs::CARD_ONCE_FLAGS). */
export const TENACITY_CARD_FLAG = "tenacityUsed";

/** Разметка кнопки (класс .wh-tenacity-btn слушает hooks.mjs). */
export function tenacityButtonHtml({ attackerUuid, weaponUuid, baseKey = "", technique = "", hit = false }) {
  return `<button class="wh-tenacity-btn" type="button"
      data-attacker-uuid="${esc(attackerUuid)}" data-weapon-uuid="${esc(weaponUuid)}" data-hit="${hit ? 1 : 0}"
      data-base="${esc(baseKey)}" data-technique="${esc(technique)}"
      title="Упорство: если эта атака не нанесла урона (промах, Избегание, поглощение, щиты) и она единственная в Ход — повторить её с той же Базой и Приёмом по той же цели свободным действием">
      🔁 Упорство: повторить атаку, не нанёсшую урона
    </button>`;
}

/**
 * Пометить атакующего: его рукопашная атака нанесла непоглощённый урон. Пишет только
 * носителю Таланта (остальным метка ни для чего не нужна). Нет права писать — тихо
 * пропускаем: метка лишь закрывает повтор, а не открывает.
 */
export async function markMeleeDamageDealt(attackerUuid) {
  if (!attackerUuid) return;
  try {
    const attacker = await fromUuid(attackerUuid).catch(() => null);
    if (!attacker || !hasMeleeTalent(attacker, "tenacity")) return;
    if (attacker.getFlag?.("warhammer-dbc", MELEE_DAMAGE_DEALT_FLAG)) return;
    await attacker.setFlag("warhammer-dbc", MELEE_DAMAGE_DEALT_FLAG, true);
  } catch (e) {
    console.warn("Warhammer DBC | Упорство: метку урона записать не удалось", e);
  }
}

/**
 * Пометить: урон по карточке `messageId` применён к цели (при любом исходе, даже если всё поглощено).
 * Пишет только носителю Таланта; одна метка на Ход — у Упорства «единственная атака Хода».
 */
export async function markMeleeDamageApplied(attackerUuid, messageId) {
  if (!attackerUuid || !messageId) return;
  try {
    const attacker = await fromUuid(attackerUuid).catch(() => null);
    if (!attacker || !hasMeleeTalent(attacker, "tenacity")) return;
    await attacker.setFlag("warhammer-dbc", MELEE_DAMAGE_APPLIED_FLAG, String(messageId));
  } catch (e) {
    console.warn("Warhammer DBC | Упорство: метку применённого урона записать не удалось", e);
  }
}

/**
 * Подтверждение повтора (решение владельца 26.10.2026): если атака ПОПАЛА, а урон по её карточке ещё
 * не применён — «Урон по этой атаке ещё не применён — повторять?». Отмена — повтора нет.
 * Иначе (промах или урон уже применён) диалог не открывается.
 * @returns {Promise<boolean>} true — повторять
 */
export async function confirmTenacityRepeat({ hit, damageApplied }) {
  if (!tenacityNeedsConfirm({ hit, damageApplied })) return true;
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Упорство" },
    content: `<p>Урон по этой атаке ещё не применён — повторять?</p>`,
    yes: { label: "Повторять" }, no: { label: "Отмена" }
  });
  return !!ok;
}
