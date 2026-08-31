// module/rules/req-atom.mjs
//
// wdbc-0pki: общий слой «проверка одного атома условия» — используется тремя
// независимыми проверщиками требований (module/apps/mechanics.mjs
// actorMeetsReq, module/rules/elite-requirements.mjs entryOk,
// module/constants/talent-requirements.mjs checkAtom/hasTalent) как
// адаптерами СВОИХ форматов хранения к общему смыслу. Форматы хранения не
// унифицируются — только сама проверка факта на акторе: «показатель не ниже
// X», «есть предмет с таким именем». Экзотика каждого движка (specKey-
// покрытие групповых навыков, «Одно из», Пси-рейтинг для reqPatron и т.п.)
// остаётся в адаптерах — здесь только пересечение всех трёх.

import { itemHasName } from "./predicates.mjs";

/** Единая шкала рангов навыка: индекс растёт вместе со знанием. */
export const RANKS = ["untrained", "knows", "trained", "veteran", "expert"];

/** Индекс ранга по ключу — неизвестный/пустой ранг считается «untrained». */
export function rankIndex(rank) {
  const i = RANKS.indexOf(rank || "untrained");
  return i < 0 ? 0 : i;
}

/** Ранг актора не ниже требуемого. */
export function rankAtLeast(rank, wanted) {
  return rankIndex(rank) >= rankIndex(wanted);
}

/**
 * Текущее значение показателя актора по единому ключу: характеристика
 * (ws/bs/s/t/ag/int/per/wp/fel/inf/…), «corruption» (Порча) или «psyRating»
 * (Психорейтинг). Бесчестие — не отдельное поле, а характеристика inf, читается
 * тем же путём, что и любая другая характеристика.
 */
export function statValue(actor, key) {
  const s = actor?.system ?? {};
  if (key === "corruption") return Number(s.corruption?.value) || 0;
  if (key === "psyRating") return Number(s.psyker?.rating) || 0;
  return Number(s.characteristics?.[key]?.total) || 0;
}

/** Показатель актора не ниже порога — характеристика/Порча/Психорейтинг. */
export function statAtLeast(actor, key, threshold) {
  return statValue(actor, key) >= (Number(threshold) || 0);
}

/**
 * Предметы актора с именем `wanted` (двуязычная сверка через itemHasName —
 * специализация в скобках на конце отбрасывается). И `wanted`, и имя предмета
 * на акторе могут быть двуязычными («Eng / Рус») — оба режутся по «/», любая
 * половина требуемого против любой половины предмета: `wanted` — потому что
 * reqTalent/reqTrait/reqPower (mechanics.mjs) хранит ПОЛНОЕ имя перетащенного
 * образца, а не книжную метку одним языком. Тот же приём уже используют
 * predicates.mjs hasEliteArchetype (wdbc-91o8, до общего слоя) —
 * канонизирован сюда. `types` — список item.type; null/undefined = любой тип.
 */
export function itemsNamed(actor, wanted, types = null) {
  const halves = String(wanted ?? "").split("/").map(s => s.trim()).filter(Boolean);
  if (!halves.length) return [];
  const items = actor?.items ?? [];
  return [...items].filter(i => (!types || types.includes(i.type))
    && halves.some(w => itemHasName(i, w)));
}

/** Есть ли у актора хотя бы один такой предмет. */
export function hasItemNamed(actor, wanted, types = null) {
  return itemsNamed(actor, wanted, types).length > 0;
}
