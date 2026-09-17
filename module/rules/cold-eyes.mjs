// module/rules/cold-eyes.mjs
//
// Cold Eyes / Холодные Глаза (Мистическое снаряжение, wdbc-1rno.5, находка
// 7/12): «...он получает +30 на все тесты зрения [уже реализовано, testMod
// skillKey:awareness на самом предмете], не получает штрафов на попадание от
// дальней и экстремальной дистанции [честный архитектурный пробел — такого
// штрафа в системе нет вообще, вынесен отдельным тикетом wdbc-1rno.31], и
// может совершать Полу-Прицеливание за свободное действие и Полное
// Прицеливание за полудействие [реализовано здесь].»

import { itemIs } from "./item-marker.mjs";

const NAME = "Cold Eyes";
export const COLD_EYES_CAPABILITY = "gear.mystic.coldEyes";

/** Носит ли актор предмет «Холодные Глаза». */
export function hasColdEyes(actor) {
  return !!actor?.items?.some(i => itemIs(i, "gear", COLD_EYES_CAPABILITY, NAME));
}
