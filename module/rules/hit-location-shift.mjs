// module/rules/hit-location-shift.mjs
//
// «Сдвинуть место попадания до A.b» (Военная зона; Черты/Таланты с тем же
// текстом): предмет несёт flags.warhammer-dbc.hitLocationShift. Флаг ставит
// выдача Родного мира (apps/homeworlds.mjs) или kind:"script" записи с
// «При выдаче». Родной мир — предмет типа "homeworld", поэтому проверка
// смотрит не только Черты и Таланты. Мир, выданный до флага (wdbc-6rjtc.6),
// флага не несёт, а «Обновить мир» флаги не переносит — у мира признак берётся
// и из констант по ключу, как carryBonus в rules/character.mjs.

import { HOMEWORLD_BY_KEY } from "../constants/homeworlds.mjs";

const CARRIER_TYPES = new Set(["trait", "talent", "homeworld"]);

/** Есть ли у актора предмет, разрешающий сдвиг места попадания. */
export function hasHitLocationShift(items) {
  return [...(items ?? [])].some(i =>
    CARRIER_TYPES.has(i?.type) && (!!i.getFlag?.("warhammer-dbc", "hitLocationShift")
      || (i.type === "homeworld" && !!HOMEWORLD_BY_KEY[i.system?.key]?.hitLocationShift)));
}
