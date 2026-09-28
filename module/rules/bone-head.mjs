// module/rules/bone-head.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «BONE-Head / КОСТеголов» (Огрин, корбук, глава I) — чистая часть без
//  Foundry. Книга:
//
//   «Любой тест I занимает у Огрина минимум полное действие и при Успехе дает
//   не больше 1 Успеха. При попадании в поле Haywire интенсивностью 3+ работа
//   импланта нарушается: Огрин теряет способность читать, писать, и считать
//   более, чем до пяти, автоматически проваливает все тесты I, а все его
//   ментальные действия занимают вдвое больше времени (св. действие >
//   полудействие). Попав в поле Haywire интенсивностью 7+, Огрин впадает в
//   Ступор на 1 Раунд, или пока не покинет поле (что произойдет первым)».
//
//  Что где:
//   • потолок 1 Успех и автопровал тестов I в поле 3+ — правила
//     OGRYN_TRAIT_RULES (rules/library/ogryn.mjs), отбор по Черте;
//   • мощность поля — rules/predicates.mjs::haywireFieldIntensity (аура
//     Дискорданта = 7, попадание Haywire — флаг актора);
//   • попадание, затухание по Раундам и Ступор — combat/bone-head.mjs.
//
//  Затухание: у свойства Haywire книга пишет «мощность поля — 1d10, затухает
//  на 2 каждый Ход» (constants/weapon-properties.mjs). Считаем по Раундам
//  боя [допущение]: «Ход» здесь — ход поля, а своего места в порядке
//  Инициативы у поля нет.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName, HAYWIRE_FIELD_FLAG } from "./predicates.mjs";

export { HAYWIRE_FIELD_FLAG };

/** Английская половина имени Черты — по ней её узнаёт itemHasName. */
export const BONE_HEAD_TRAIT = "BONE-Head";

/** Порог «импланты сбоят» и порог Ступора. */
export const HAYWIRE_IMPAIR_MIN = 3;
export const HAYWIRE_STUPOR_MIN = 7;

/** На сколько затухает поле за Раунд. */
export const HAYWIRE_DECAY_PER_ROUND = 2;

/** Есть ли у актора Черта BONE-Head (своя или от комплексной Черты «Огрин»). */
export function isBoneHead(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "trait" && itemHasName(i, BONE_HEAD_TRAIT));
}

/** Мощность поля через `rounds` Раундов. */
export function decayedHaywire(intensity, rounds) {
  const i = Math.max(0, Number(intensity) || 0);
  return Math.max(0, i - HAYWIRE_DECAY_PER_ROUND * Math.max(0, Number(rounds) || 0));
}

/** Что делает поле такой мощности с имплантом Огрина. */
export function boneHeadHaywireEffects(intensity) {
  const i = Number(intensity) || 0;
  return { impaired: i >= HAYWIRE_IMPAIR_MIN, stupor: i >= HAYWIRE_STUPOR_MIN };
}
