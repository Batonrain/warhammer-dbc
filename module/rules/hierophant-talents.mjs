// module/rules/hierophant-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Иерофант (Элитный архетип, корбук) — чистая арифметика Черт и Талантов.
//  Кнопки и запись на акторов — combat/hierophant.mjs.
//
//  • Великий Агитатор — комбинированный тест Charm+0 и Schol.Lore(Imperial
//    Creed)+0 (или For.Lore(Heresy)+0): Орда Магнитудой 10×Успехи на 4 часа.
//  • Владыка Масс — Charm вместо Command, когда командует Ордой
//    (rules/command-substitution.mjs); Храбрость детальной команды —
//    психологический урон Орды вдвое (окр.▲, combat/horde-psych.mjs).
//  • Кровь Мучеников — пока Орда Агитатора жива, не-Избирательные попадания
//    по нему приходятся на Орду (строка карточки атаки).
//  • Град, Живая Волна, Правосудие Толпы, Фанатичные Толпы — числа кнопок.
//  • Нечестивый Кардинал — данные Конструктора (+½Inf, переброс).
// ════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";

export const AGITATOR_FLAG = "agitatorHorde";
/** «Орда под его командованием 4 часа». */
export const AGITATOR_HOURS = 4;
export const AGITATOR_MAG_PER_SUCCESS = 10;

export const hasGrandAgitator = a => hasItemNamed(a, "Grand Agitator", ["trait"]);
export const hasMasterOfMasses = a => hasItemNamed(a, "Master of Masses", ["trait"]);
export const hasBloodOfMartyrs = a => hasItemNamed(a, "Blood of Martyrs", ["talent"]);
export const hasHail = a => hasItemNamed(a, "Hail", ["talent"]);
export const hasLivingTide = a => hasItemNamed(a, "Living Tide", ["talent"]);
export const hasMobJustice = a => hasItemNamed(a, "Mob Justice", ["talent"]);
export const hasZealousMasses = a => hasItemNamed(a, "Zealous Masses", ["talent"]);

/** Магнитуда Орды Агитатора: 10 × Успехи (Провал — 0). */
export function agitatorMagnitude(deg, success = true) {
  return success ? AGITATOR_MAG_PER_SUCCESS * Math.max(1, Number(deg) || 1) : 0;
}

/** Действует ли сейчас Орда Агитатора (метка на Иерофанте, срок по worldTime). */
export function agitatorHordeActive(actor, worldTime = 0) {
  const f = actor?.flags?.["warhammer-dbc"]?.[AGITATOR_FLAG] ?? actor?.getFlag?.("warhammer-dbc", AGITATOR_FLAG);
  if (!f || !(Number(f.magnitude) > 0)) return null;
  if (Number(f.until) && Number(worldTime) >= Number(f.until)) return null;
  return f;
}

/**
 * Кровь Мучеников: строка для карточки атаки по Иерофанту или "".
 * Избирательная атака (прицел в локацию) Орду обходит.
 */
export function bloodOfMartyrsNote(defender, { selective = false, hit = true, worldTime = 0 } = {}) {
  if (!hit || selective || !hasBloodOfMartyrs(defender)) return "";
  if (!agitatorHordeActive(defender, worldTime)) return "";
  return "🙏 Кровь Мучеников: цель стоит в своей Орде (Великий Агитатор) — не-Избирательные попадания приходятся на Орду. Урон применяйте к Орде.";
}

/** Владыка Масс: прибавка к Command при командовании Ордой (Charm вместо Command, не хуже обычного). */
export function masterOfMassesCommandBonus(actor, ctx = {}) {
  if (!hasMasterOfMasses(actor) || ctx?.targetActor?.type !== "horde") return 0;
  const charm = Number(actor?.system?.skills?.charm?.total);
  const command = Number(actor?.system?.skills?.command?.total);
  if (!Number.isFinite(charm) || !Number.isFinite(command)) return 0;
  return Math.max(0, charm - command);
}

/** Храбрость от командующего с Владыкой Масс: психологический урон вдвое (окр.▲). */
export function masterOfMassesPsychDamage(amount) {
  return Math.ceil(Math.max(0, Number(amount) || 0) / 2);
}

/** Владыка Масс: «+½F (окр.▲), но не более текущей Магнитуды» к Магнитуде в счёте атак и урона. */
export function masterOfMassesMagnitudeBoost(fel, magnitude) {
  return Math.min(Math.max(0, Number(magnitude) || 0), Math.ceil(Math.max(0, Number(fel) || 0) / 2));
}

/** Град: N пожертвованных атак (1–3) → +10×N на попадание и +Nd10 урона. */
export function hailBonus(n) {
  const k = Math.max(1, Math.min(3, Math.trunc(Number(n) || 1)));
  return { sacrificed: k, hit: 10 * k, dice: `${k}d10` };
}

/** Живая Волна: числа усилия Орды по Успехам детальной команды (нужно 4+). */
export function livingTide({ magnitude = 0, successes = 0 } = {}) {
  const s = Math.max(0, Math.trunc(Number(successes) || 0));
  const ok = s >= 4;
  return {
    ok,
    athleticsBonus: ok ? Math.max(0, Number(magnitude) || 0) + 10 * (s - 4) : 0,
    moveKg: 500 * s, flipKg: 1000 * s,
    grappleDamage: s,                         // + S.b Орды, мимо брони и ½T.b
    selfDamage: `1d5+${Math.ceil(s / 2)}`
  };
}

/** Правосудие Толпы: восстановление Магнитуды дружественным Ордам. */
export function mobJusticeHeal(deg) {
  return `2d10+${Math.max(1, Number(deg) || 1)}`;
}
