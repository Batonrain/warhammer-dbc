// module/rules/blood-replacement.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Замена Крови / Blood Replacement (Общие мутации, d100 9..10; wdbc-1rno.15).
//  Книга: «когда он получает непоглощённый I, R или X урон, эта субстанция
//  вырывается наружу, вызывая эффект ранения, расписанный в каждой
//  субмутации … иммунитет к смерти от Кровотечения и Обескровливания».
//
//  Здесь — чистая часть: какая субмутация на акторе и что делает её Ранение.
//  Карточка Ранения (combat/blood-replacement.mjs) сама находит всех в 2 м и,
//  где есть готовый механизм, ставит его кнопкой (дым — зона Дыма).
//  Уже работающее отдельно: 2 Ртуть (combat/mercury-reaction.mjs), иммунитеты
//  3 Свет к Blinding и 10 Кислота к Corrosive — записи Конструктора на паке.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

export const BLOOD_REPLACEMENT_CAP = "mutation.bloodReplacement";
export const BLOOD_WOUND_RADIUS_M = 2;
/** Дым (4): шаблон Smoke (4) — радиус 4 м. */
export const BLOOD_SMOKE_RADIUS_M = 4;

/** Типы урона, вызывающие Ранение: I, R, X. */
const WOUND_TYPES = new Set(["impact", "rending", "blast"]);

/** Ранение по субмутациям (текст книги, коротко) и кого задевает. */
export const BLOOD_WOUNDS = Object.freeze({
  1: { label: "Алкоголь", who: "all", text: "Из раны хлещет спирт: на 1 Раунд персонаж и все в 2 м автоматически проваливают тесты против Загорания и получают +1 кубик урона от Горения." },
  2: { label: "Ртуть", who: null, text: "Раненая часть тела иммунна к E(Ls), но её броня проводит ток до конца боя — отмечено само." },
  3: { label: "Свет", who: "others", text: "Вспышка ослепительного света: все в 2 м получают попадание со свойством Blinding (4)." },
  4: { label: "Дым", who: null, smoke: true, text: "Клубы чёрного дыма: на персонаже центрируется шаблон Smoke (4). Его собственному зрению и атакам дым не мешает." },
  5: { label: "Память", who: null, text: "Кровь как обычно; кто попробует её брызги — получит одно воспоминание персонажа." },
  6: { label: "Феромоны", who: "others", text: "Облако розового тумана: все в 2 м получают попадание со свойством Hallucinogenic (1); враги, проваливший тест, не бросают d10, а в Ступоре на время галлюцинации." },
  7: { label: "Личинки", who: "enemies", text: "Личинки зарываются во врагов: все враги в 2 м проходят A−20 или получают эффект Crippling (3)." },
  8: { label: "Магма", who: "others", text: "Облако пирокластов: шаблон 1d10 E(Fl), Pen 0, Blast (2), Flame, Tainted на персонаже, его самого не задевает. Против псайкеров Flame (3d10)." },
  9: { label: "Варп", who: "enemies", text: "Взрыв Варпа: шаблон 1d10 E, Pen 0, Blast (2), Warp Weapon, Tainted на персонаже, его самого не задевает. Получивший урон враг: −5 к тестам против психосил и выжигания души до конца боя (складывается)." },
  10: { label: "Кислота", who: "others", text: "Брызги кислоты: все в 2 м, кроме самого мутанта, проходят A−10 или получают попадание со свойством Corrosive (3)." }
});

/** Предмет-мутация «Замена Крови» актора (не подавленная) или null. */
export function bloodReplacementItem(actor) {
  return [...(actor?.items ?? [])].find(i => i?.type === "mutation"
    && (itemHasName(i, "Blood Replacement") || itemHasName(i, "Замена Крови"))
    && !i.getFlag?.("warhammer-dbc", "suppressed")) ?? null;
}

/** Номер субмутации Замены Крови (1…10) или null. */
export function bloodReplacementSub(actor) {
  const it = bloodReplacementItem(actor);
  const n = parseInt(it?.system?.submutation?.label ?? "", 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Ранение для этого урона: { sub, ...BLOOD_WOUNDS[sub] } — только непоглощённый
 * I/R/X и только у носителя мутации; Ртуть (2) отмечается своим модулем, карточка ей не нужна.
 */
export function bloodWoundFor(actor, { netDamage = 0, damageType = "" } = {}) {
  if (!(netDamage > 0) || !WOUND_TYPES.has(damageType)) return null;
  const sub = bloodReplacementSub(actor);
  const w = sub ? BLOOD_WOUNDS[sub] : null;
  if (!w || sub === 2) return null;
  return { sub, ...w };
}

/** Дым (4): «Дым не мешает его зрению и атакам». */
export const bloodSmokeSight = actor => bloodReplacementSub(actor) === 4;

/** Кто из соседей задет: «all» — все в 2 м (сам носитель отдельно), «others» — кроме него, «enemies» — враги. */
export function bloodWoundVictims(wound, neighbours, isEnemy = () => true) {
  if (!wound?.who) return [];
  return wound.who === "enemies" ? neighbours.filter(isEnemy) : neighbours;
}
