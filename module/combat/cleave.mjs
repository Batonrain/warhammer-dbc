// module/combat/cleave.mjs
// ════════════════════════════════════════════════════════════════════════════
//  CLEAVE / РАЗРУБИТЬ — Foundry-обвязка к rules/melee-talents.mjs::cleaveTriggered
//  (Таланты «Рукопашные», Sahara 3-8dc5).
//
//  Кнопка рисуется в карточке урона (combat/damage.mjs), когда удар нанёс 16+
//  непоглощённого и вывел цель из строя, а у атакующего есть Талант. Клик (hooks.mjs,
//  .wh-cleave-btn) открывает обычное окно атаки той же рукопашной рукой с Базой
//  Стандартная и −10; сама эта атака помечена cleave:true и карточку-порождение
//  не даёт (data-cleave-child → damageData.cleaveChild → cleaveTriggered).
//
//  Свободное действие: окно атаки ОД само не списывает. Цель дополнительной атаки —
//  «ещё один персонаж рядом с изначальной»: «рядом» система не меряет, игрок
//  выцеливает сам; прежние цели сбрасываются.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { cleaveTriggered, CLEAVE_PENALTY } from "../rules/melee-talents.mjs";

/** Ключ отметки на карточке (белый список сокета — card-once.mjs::CARD_ONCE_FLAGS). */
export const CLEAVE_CARD_FLAG = "cleaveUsed";

/** Разметка кнопки (класс .wh-cleave-btn слушает hooks.mjs). */
export function cleaveButtonHtml({ attackerUuid, weaponUuid, targetName = "" }) {
  return `<div class="roll-defense-section">
    <button class="wh-cleave-btn" type="button"
      data-attacker-uuid="${esc(attackerUuid)}" data-weapon-uuid="${esc(weaponUuid)}"
      title="Разрубить: свободная базовая атака по другому персонажу рядом с целью, −10; сама новых атак не порождает">
      ${rollIcon("sword")}Разрубить: атаковать ещё одного рядом с ${esc(targetName)} (−10)
    </button>
  </div>`;
}

/**
 * Секция карточки урона. Пустая строка — Талант не сработал.
 * @param {object} p  attackerUuid, weaponUuid, melee, cleaveChild, net, woundsBefore, woundsAfter, targetName
 */
export async function cleaveSection(p) {
  if (!p.attackerUuid || !p.weaponUuid) return "";
  const attacker = await fromUuid(p.attackerUuid).catch(() => null);
  if (!attacker || !cleaveTriggered(attacker, p)) return "";
  return cleaveButtonHtml(p);
}

export { CLEAVE_PENALTY };
