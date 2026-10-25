// module/combat/furious-assault.mjs
// ════════════════════════════════════════════════════════════════════════════
//  FURIOUS ASSAULT / ЯРОСТНЫЙ ШТУРМ — Foundry-обвязка к
//  rules/berserker-talents.mjs::furiousAssaultOffered (Таланты «Берсерк», Sahara 3-861e).
//
//  Кнопка рисуется в карточке успешной рукопашной Полной Атаки (combat/attack.mjs →
//  attack-card.mjs). Клик (hooks.mjs, .wh-furious-assault-btn): тратится Реакция
//  (spendReaction), открывается окно атаки тем же оружием с Базой Полная Атака и тем же
//  Приёмом; ОД окно само не берёт («за свободное действие»). Раз на карточку. Сама
//  дополнительная атака помечена furiousAssault:true (→ wp.furiousChild) и новой не порождает.
//
//  РЕПРИЗ (Reprise, «Берсерк») отдельной механики не имеет: он разрешает тратить оставшиеся
//  Реакции на Парирование после дополнительной атаки, а запрет Физических Избеганий после
//  Полной Атаки («до начала следующего Хода», MELEE_BASES.fullatk.note) система не применяет
//  вовсе — Реакции и так можно тратить на Парирование. Нечего снимать.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";

/** Ключ отметки на карточке (белый список — card-once.mjs::CARD_ONCE_FLAGS). */
export const FURIOUS_ASSAULT_CARD_FLAG = "furiousAssaultUsed";

/** Разметка кнопки (класс .wh-furious-assault-btn слушает hooks.mjs). */
export function furiousAssaultButtonHtml({ attackerUuid, weaponUuid, technique = "" }) {
  return `<button class="wh-furious-assault-btn" type="button"
      data-attacker-uuid="${esc(attackerUuid)}" data-weapon-uuid="${esc(weaponUuid)}" data-technique="${esc(technique)}"
      title="Яростный Штурм: потратив Реакцию, провести ещё одну атаку тем же оружием с Базой Полная Атака и тем же Приёмом за свободное действие. Новых атак она не порождает.">
      ⚔️ Яростный Штурм: ещё одна атака за Реакцию
    </button>`;
}
