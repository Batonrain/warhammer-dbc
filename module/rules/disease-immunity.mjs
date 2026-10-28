// module/rules/disease-immunity.mjs
// ════════════════════════════════════════════════════════════════════════
//  ИММУНИТЕТ К НЕГАТИВНЫМ ЭФФЕКТАМ БОЛЕЗНЕЙ (Метка Нургла, корбук, Метки) —
//  task-0469-c5ab.
//
//  Как собрано. Метка Нургла несёт возможность defence.diseaseEffectsImmune
//  (kind:"capability"). Болезнь (предмет типа disease) свою механику даёт
//  записями Конструктора — сейчас это kind:"charRecovery" («Гниль Нургла: T не
//  восстанавливается» и подобные, PR #524), которые собирает источник правил
//  «items» (rules/sources.mjs → item-rules.mjs::rulesFromItemMechanics) через
//  isItemActive. Значит иммунитет — это «болезнь у такого носителя не активна»:
//  isItemActive (apps/effects.mjs) отвечает false, и все её записи (и эффекты,
//  если ГМ добавит ActiveEffect вручную) гаснут тем же рубильником, что и у
//  снятой брони. Сам предмет-болезнь с листа не пропадает — его по-прежнему
//  видно, он просто «не действует».
//
//  Возможность читается НАПРЯМУЮ с предметов актора, а не через hasRuleFlag:
//  isItemActive зовёт сам сбор правил, и запрос правил изнутри него замкнул бы
//  круг (тот же довод и тот же приём, что в rules/vision-aids.mjs; см. раздел
//  про source-registry в AGENTS.md).
//
//  Активность носителя Метки спрашивается переданной функцией (isActive) — так
//  подавленная/выключенная мутация, выдающая иммунитет, его не даёт; сам этот
//  файл от apps/effects.mjs не зависит (effects.mjs его импортирует).
//  Предмет типа disease иммунитет выдавать не может: болезнь, гасящая сама себя
//  через isActive, дала бы бесконечный вопрос «активна ли я».
// ════════════════════════════════════════════════════════════════════════

import { itemHasKey } from "./item-marker.mjs";
import { itemHasName } from "./predicates.mjs";
import { isStuffOfNightmares } from "./stuff-of-nightmares.mjs";

export const DISEASE_IMMUNE_CAP = "defence.diseaseEffectsImmune";

/**
 * Есть ли у актора действующий источник иммунитета к эффектам болезней.
 * @param {object} actor
 * @param {(item: object) => boolean} [isActive] активность носителя (по умолчанию — любой активен)
 */
export function actorImmuneToDiseaseEffects(actor, isActive = () => true) {
  for (const it of actor?.items ?? []) {
    if (!it || it.type === "disease") continue;
    // Струп у копии без записи (до «Обновить мир») — по имени.
    const carrier = itemHasKey(it, DISEASE_IMMUNE_CAP) || (it.type === "drug" && itemHasName(it, "Scab"));
    if (carrier && isActive(it)) return true;
    // Stuff of Nightmares: «иммунитет к … болезням» (rules/stuff-of-nightmares.mjs).
    if (isStuffOfNightmares(it) && isActive(it)) return true;
  }
  return false;
}

/** Болезнь на акторе-носителе иммунитета: её эффекты сейчас не действуют. */
export function diseaseEffectsSuppressed(item, isActive) {
  return item?.type === "disease" && !!item.parent && actorImmuneToDiseaseEffects(item.parent, isActive);
}
