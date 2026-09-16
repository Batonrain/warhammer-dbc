// module/rules/black-eyes.mjs
//
// Black Eyes / Чёрные Глаза (Дар Слаанеш, wdbc-1rno.1): «При Cor 60+ никакая
// преграда, кроме твёрдой стены, не мешает его зрению, позволяя ему видеть
// сквозь дым, тьму и колдовской морок (в т.ч. психосилы Иллюзий), игнорируя
// штрафы на попадания от них.»
//
// «Колдовской морок»/психосилы Иллюзий — отдельного числового штрафа на
// попадание нигде в системе нет (проверено 16.09.2026): module/rules/
// illusion-detection.mjs — про засечение иллюзии Пси-чутьём, не про BS,
// rollBonus/testMod от иллюзий не существует. Эта часть остаётся честным
// остатком (см. capabilities.mjs). Дым/тьма/слабый свет — РЕАЛЬНЫЕ галочки
// диалога атаки (module/sheets/attack/mods.mjs), гасятся здесь.
//
// Cor 40+ (ИК/УФ-зрение) и Cor 80+ (бесплатное Полу-Прицеливание) —
// отдельные пороги, не относящиеся к этому файлу: первый нечем моделировать
// (нет механики спектра зрения), второй ждёт реворка Прицеливания
// (wdbc-1rno.5).

import { itemIs } from "./item-marker.mjs";

const NAME = "Black Eyes";
export const BLACK_EYES_CAPABILITY = "gift.slaanesh.blackEyes";

/** Это предмет-Дар «Чёрные Глаза»? */
export function isBlackEyesItem(item) {
  return itemIs(item, "mutation", BLACK_EYES_CAPABILITY, NAME);
}

/** Cor 60+ и владеет Даром — видит сквозь дым/тьму/слабый свет. */
export function hasBlackEyesDarknessImmunity(actor) {
  const cor = Number(actor?.system?.corruption?.value) || 0;
  if (cor < 60) return false;
  return !!actor?.items?.some(i => isBlackEyesItem(i));
}
