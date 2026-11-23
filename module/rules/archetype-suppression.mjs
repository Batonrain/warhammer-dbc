// module/rules/archetype-suppression.mjs
// ════════════════════════════════════════════════════════════════════════
//  Подавление Талантов и Черт Элитного Архетипа целиком.
//
//  Два источника:
//   • Сила Из Плоти (Электрожрец): «Все эффекты Архетипа (включая бонусы к
//     Характеристикам) действуют только с фреймом Хоминис… Трейт Machine
//     отключает все эффекты Архетипа» — состояние считается живьём
//     (rules/electropriest.mjs::electropriestActive).
//   • Соглашение Доблести (Кузнец Крови): нарушение обета — «теряет все
//     преимущества Талантов и Трейтов этого Архетипа на 8 дней» — срок на
//     акторе (TIMED_FLAG, мировое время Foundry).
//
//  Механика отключения — та же, что у Пустоты Парии и Чистой Формы: флаг на
//  самом предмете (ITEM_FLAG). Его читают apps/effects.mjs::isItemActive (эффекты
//  и Конструктор) и rules/req-atom.mjs::itemsNamed (все проверки «есть ли
//  Талант X»). Пересинхронизация — apps/mechanics.mjs::syncArchetypeSuppression.
//  Сами Черты-источники (Сила Из Плоти, Соглашение Доблести) не гаснут: это
//  ограничения, а не преимущества, и без них подавление некому снять.
//
//  Чистый модуль без Foundry.
// ════════════════════════════════════════════════════════════════════════

import { ELITE_ARCHETYPES } from "../constants/elite-archetypes.mjs";
import { itemHasName } from "./predicates.mjs";
import { electropriestActive } from "./electropriest.mjs";

const NS = "warhammer-dbc";
/** Флаг на Таланте/Черте: подавлен вместе с Архетипом. */
export const ITEM_FLAG = "archetypeSuppressed";
/** Флаг на предмете Архетипа (eliteArchetype): его бонусы к Характеристикам погашены. */
export const CHARS_FLAG = "archetypeCharsOff";
/** Флаг на акторе: { [имя Архетипа]: { until: мировое время (сек), reason } }. */
export const TIMED_FLAG = "archetypeSuppression";

export const ELECTROPRIEST = "Электрожрец";
export const BLOOD_SMITH = "Кузнец Крови";

/** Архетипы, которые умеют гаснуть целиком, и их Черты-источники (не гаснут). */
export const SUPPRESSIBLE = {
  // Фрейм Хоминис — признак тела, по нему Архетип и включается: гасить его нельзя.
  [ELECTROPRIEST]: ["Power From Flesh", "Hominis Frame"],
  [BLOOD_SMITH]: ["Valourous Accord"]
};

/** Восемь дней Соглашения Доблести, в секундах мирового времени. */
export const VALOUR_DAYS = 8;
export const VALOUR_SECONDS = VALOUR_DAYS * 24 * 3600;

const flagOf = (doc, key) => doc?.flags?.[NS]?.[key] ?? doc?.getFlag?.(NS, key) ?? null;

const archNames = arch => {
  const a = ELITE_ARCHETYPES.find(x => x.name === arch);
  return [...(a?.traits ?? []), ...(a?.talents ?? [])];
};

const matchesAny = (item, names) =>
  names.some(n => String(n).split("/").some(h => h.trim() && itemHasName(item, h.trim())));

/** Архетип (из SUPPRESSIBLE), к которому относится Талант/Черта; null — не наш или источник. */
export function suppressibleArchetypeOf(item) {
  if (item?.type !== "talent" && item?.type !== "trait") return null;
  for (const [arch, sources] of Object.entries(SUPPRESSIBLE)) {
    if (matchesAny(item, sources)) return null;
    if (matchesAny(item, archNames(arch))) return arch;
  }
  return null;
}

/** Предмет Архетипа (eliteArchetype) по имени Архетипа. */
export const isArchetypeDoc = (item, arch) =>
  item?.type === "eliteArchetype" && (item.name === arch || itemHasName(item, arch));

/** Действующие сроки подавления: { arch: {until, reason} } с until > now. */
export function timedSuppressions(actor, now = 0) {
  const raw = flagOf(actor, TIMED_FLAG) ?? {};
  const out = {};
  for (const [arch, v] of Object.entries(raw)) {
    if (v && Number(v.until) > now) out[arch] = v;
  }
  return out;
}

/** Какие Архетипы актора сейчас погашены (Set имён). */
export function suppressedArchetypes(actor, now = 0) {
  const set = new Set(Object.keys(timedSuppressions(actor, now)));
  if (!electropriestActive(actor)) set.add(ELECTROPRIEST);
  return set;
}

/** Должен ли предмет актора сейчас быть погашен (Талант/Черта или бонусы предмета Архетипа). */
export function itemShouldBeSuppressed(actor, item, now = 0, set = suppressedArchetypes(actor, now)) {
  if (!set.size) return false;
  if (item?.type === "eliteArchetype") return [...set].some(a => isArchetypeDoc(item, a));
  const arch = suppressibleArchetypeOf(item);
  return !!arch && set.has(arch);
}

/** Флаг подавления, поставленный на предмете (читается из isItemActive и itemsNamed). */
export const isSuppressedItem = item => !!flagOf(item, ITEM_FLAG);

// ── Соглашение Доблести ─────────────────────────────────────────────────────

export const hasValourousAccord = actor =>
  [...(actor?.items ?? [])].some(i => i.type === "trait" && itemHasName(i, "Valourous Accord"));

/** Метка «своё снаряжение»: создано им лично или взято с побеждённого в честном бою. */
export const VALOUR_OWN_FLAG = "valourOwn";
export const isValourOwn = item => !!flagOf(item, VALOUR_OWN_FLAG);

const isForceWeapon = item => (item?.system?.weaponProps ?? []).some(p => p?.key === "force");

/**
 * Нарушает ли действие обет. kind:
 *   "psychic"  — проявление психосилы;
 *   "ritual"   — ритуал (кроме призыва: ritual.system.summon / «призыв» в имени);
 *   "attack"   — атака оружием item (психосиловое — всегда; чужое — без метки valourOwn);
 *   "equip"    — надевание оружия/брони item без метки valourOwn.
 * Возвращает текст нарушения или "".
 */
export function valourViolation(actor, kind, item = null) {
  if (!hasValourousAccord(actor)) return "";
  switch (kind) {
    case "psychic": return "проявил психосилу";
    case "ritual": {
      const summon = String(item?.system?.ritualType ?? "") === "summon";
      return summon ? "" : `провёл ритуал «${item?.name ?? "?"}»`;
    }
    case "attack":
      if (isForceWeapon(item)) return `атаковал психосиловым оружием «${item.name}»`;
      if (item?.type === "weapon" && !isValourOwn(item) && !isNaturalWeapon(item)) return `атаковал чужим оружием «${item.name}»`;
      return "";
    case "equip":
      if ((item?.type === "weapon" || item?.type === "armor") && !isValourOwn(item) && !isNaturalWeapon(item))
        return `взял в бой чужое снаряжение «${item.name}»`;
      return "";
    default: return "";
  }
}

/**
 * Не «оружие, созданное не им»: интегральные атаки тела (когти, рога), удар
 * без оружия и выданное его же способностями (Конструктор, grantedByItem).
 */
function isNaturalWeapon(item) {
  if (flagOf(item, "integralAttack") || flagOf(item, "grantedByItem")) return true;
  return /unarmed|безоружн/i.test(String(item?.name ?? ""));
}

/**
 * Новый срок после нарушения. Первое — 8 дней от сейчас; повторное во время
 * срока — снова 8 дней от сейчас («или дольше, если продолжает нарушать») и
 * освобождение демонов Кольца Крови.
 * @returns {{ until: number, repeat: boolean }}
 */
export function valourPenalty(actor, now = 0) {
  const cur = timedSuppressions(actor, now)[BLOOD_SMITH];
  return { until: now + VALOUR_SECONDS, repeat: !!cur };
}

/**
 * «8 дней или дольше по решению ГМа» (Sahara 587-fd8b): текущий срок покаяния,
 * продлённый на `days` дней (дробные — как есть, полдня = 12 ч). null — нечего
 * продлевать или число не положительное.
 */
export function valourExtension(cur, days) {
  const d = Number(days);
  if (!cur || !Number.isFinite(d) || d <= 0) return null;
  return { ...cur, until: (Number(cur.until) || 0) + Math.round(d * 86400) };
}
