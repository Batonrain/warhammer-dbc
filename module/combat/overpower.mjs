// module/combat/overpower.mjs
// ════════════════════════════════════════════════════════════════════════════
//  OVERPOWER / ПЕРЕСИЛИТЬ — Foundry-обвязка к rules/berserker-talents.mjs::overpowerOffered
//  (Таланты «Берсерк», Sahara 3-861e).
//
//  Книга: «Совершая атаку с базой Полная Атака, он может пройти тест на S+0 vs S+0
//  после успешного парирования этой атаки врагом, чтобы проигнорировать это
//  Парирование и все равно нанести попадание.»
//
//  Кнопка рисуется в карточке успешного Парирования (combat/defense.mjs). Клик
//  (hooks.mjs, .wh-overpower-btn) открывает общий встречный тест приёма
//  (combat/techniques.mjs::_showContestDialog): атаковавший бросает S+0, парировавший
//  сопротивляется S+0 кнопкой «Сопротивляться» (combat/opposed-contest.mjs). Победа —
//  карточка со словами «Парирование проигнорировано, попадание проходит»: кнопка
//  «Применить урон» на карточке атаки остаётся рабочей — парирование её не гасит
//  (система не привязывает отражённые попадания к конкретным ударам), игрок применяет
//  урон сам. Раз на карточку Парирования — отметка в момент броска (pay).
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

/** Ключ отметки на карточке (белый список — card-once.mjs::CARD_ONCE_FLAGS). */
export const OVERPOWER_CARD_FLAG = "overpowerUsed";

/** Определение Состязания (в общем списке кнопок листа его нет — доступно только с карточки Парирования). */
export const OVERPOWER_CONTEST = {
  label: "Пересилить", wsBonus: 0,
  modLabel: "S vs S",
  defaultChar: "s",
  allowedChars: ["s"],
  note: "S+0 vs S+0 после успешного Парирования Полной Атаки. Победа — Парирование игнорируется, попадание проходит: примените урон кнопкой «Применить урон» на карточке атаки.",
  targetDodgeMod: 0, targetParryMod: 0,
  chatNote: "⚡ Состязательный бросок S — игнорировать Парирование"
};

/** Разметка кнопки (класс .wh-overpower-btn слушает hooks.mjs). */
export function overpowerButtonHtml({ attackerUuid, defenderUuid, attackerName = "" }) {
  return `<div class="roll-defense-section">
    <button class="wh-overpower-btn" type="button"
      data-attacker-uuid="${esc(attackerUuid)}" data-defender-uuid="${esc(defenderUuid)}"
      title="Пересилить: S+0 vs S+0 — при победе Парирование этой Полной Атаки игнорируется">
      ${rollIcon("sword")}Пересилить (${esc(attackerName)}): S+0 vs S+0 — игнорировать Парирование
    </button>
  </div>`;
}

/**
 * Открыть встречный тест Пересилить. pay — claim отметки карточки (вызывается в момент броска).
 * @param {Actor} attacker  тот, кто бьёт Полной Атакой
 * @param {Actor} defender  тот, кто парировал
 */
export async function startOverpower(attacker, defender, { pay } = {}) {
  const { _showContestDialog } = await import("./techniques.mjs");
  await _showContestDialog(attacker, { ...OVERPOWER_CONTEST, opponents: () => [defender], ...(pay ? { pay } : {}) });
}
