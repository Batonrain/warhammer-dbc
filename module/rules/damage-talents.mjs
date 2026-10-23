// module/rules/damage-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ БОЕВЫХ БОНУСОВ главы 3 — чистые функции (Sahara 3-8dc5 / 3-5fbf /
//  3-9d40). Бросков, Foundry и листа здесь нет: актор и числа приходят
//  аргументами, читатели — combat/attack.mjs и sheets/attack/mods.mjs +
//  attack-dialog.mjs.
//
//  Каждый Талант опознаётся ОДНОЙ развилкой «имя ИЛИ ключ» (hasAbility,
//  rules/ability-by-key.mjs), а не одним ключом. Причина — предметы на акторе
//  снимки: персонаж, купивший Талант до того, как в паке у него появилась
//  запись Конструктора capability, ключа не несёт, и читатель только по ключу
//  молча не сработал бы именно у существующих персонажей («ловушка Desiccated»,
//  тикет 3-861e). Ключ при этом страхует от переименования предмета.
//
//  Модуль НЕ импортируется из rules/sources.mjs и ничего не регистрирует —
//  круга через source-registry нет (AGENTS.md, «Источники правил»).
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";

/** Ключи Возможностей (module/constants/capabilities.mjs) и имена Талантов. */
export const DAMAGE_TALENTS = Object.freeze({
  crushingBlow:   { key: "meleeCore.core.crushingBlow",       name: "Crushing Blow" },
  mightyShot:     { key: "rangedCore.core.mightyShot",        name: "Mighty Shot" },
  steadyFootwork: { key: "meleeCore.core.steadyFootwork",     name: "Steady Footwork" },
  doubleTeam:     { key: "meleeCore.core.doubleTeam",         name: "Double Team" },
  dragoon:        { key: "rangedCore.core.dragoon",           name: "Dragoon" },
  masterDragoon:  { key: "rangedCore.core.masterDragoon",     name: "Master Dragoon" },
  targetSelection:{ key: "rangedCore.core.targetSelection",   name: "Target Selection" },
  plasmaExpertise:{ key: "weaponsmith.core.plasmaExpertise",  name: "Plasma Expertise" },
  plasmaMastery:  { key: "weaponsmith.core.plasmaMastery",    name: "Plasma Mastery" }
});

/** Есть ли у актора Талант из списка выше (по имени или по ключу). */
export function hasDamageTalent(actor, id) {
  const t = DAMAGE_TALENTS[id];
  return !!t && hasAbility(actor, t.key, t.name, "talent");
}

const halfUp = n => Math.ceil((Number(n) || 0) / 2);

/** Есть ли у оружия свойство с таким ключом в уже разобранном списке (resolveWeaponPropsList). */
const hasProp = (wProps, key) => (wProps ?? []).some(p => (p?.key ?? p) === key);

// ── Урон ────────────────────────────────────────────────────────────────────

/**
 * Крушащий Удар (core.json, Таланты «Рукопашные»): «+½WS.b (окр.▲) ко всему своему рукопашному урону».
 * Слагаемое flatBonus рукопашной атаки; 0 у стрелковой и у тех, кто Таланта не имеет.
 */
export function crushingBlowBonus(actor, { isMelee, wsBonus }) {
  if (!isMelee || !hasDamageTalent(actor, "crushingBlow")) return 0;
  return halfUp(wsBonus);
}

/**
 * Могучий Выстрел (core.json, Таланты «Стрелок»): «+½BS.b (окр.▲) ко всему своему стрелковому
 * урону, кроме урона по площади (от свойств Blast и Spray), хотя прямые
 * попадания по цели в центре шаблона Blast получают этот бонус».
 *
 * Число урона одного попадания уходит ВСЕМ, кого накрыл шаблон (одна кнопка
 * «Применить урон» → «Всем», attack-card.mjs), и отличить центр от остальных
 * система не умеет. Поэтому у Blast и Spray бонус в число НЕ входит — иначе он
 * достался бы тем, кому книга его не даёт; у Blast он возвращается как
 * `centerBonus`, чтобы карточка напомнила прибавить его цели в центре руками.
 *
 * @returns {{bonus: number, centerBonus: number}}
 */
export function mightyShotDamage(actor, { isMelee, bsBonus, wp }) {
  const none = { bonus: 0, centerBonus: 0 };
  if (isMelee || !hasDamageTalent(actor, "mightyShot")) return none;
  const value = halfUp(bsBonus);
  if (!value) return none;
  if (wp?.spray) return none;                          // Распыление — целиком по площади
  if ((Number(wp?.blastRating) || 0) > 0) return { bonus: 0, centerBonus: value };
  return { bonus: value, centerBonus: 0 };
}

// ── Плазма ──────────────────────────────────────────────────────────────────

/** Плазменное оружие — по типу оружия, та же ось, что у Bolter Drill (weaponType). */
export const isPlasmaWeapon = sys => sys?.weaponType === "plasma";

/**
 * Эксперт Плазмы (core.json, Таланты «Оружейник»): «Плазменное оружие со свойством Overheats
 * увеличивает Надёжность на 1 в его руках» — прибавка к reliabilityScore
 * (Перегрев сам даёт −1, так что у носителя оно возвращается к обычному).
 */
export function plasmaExpertiseReliability(actor, { isMelee, sys, wProps }) {
  if (isMelee || !isPlasmaWeapon(sys) || !hasProp(wProps, "overheats")) return 0;
  return hasDamageTalent(actor, "plasmaExpertise") ? 1 : 0;
}

/**
 * Мастерство Плазмы (core.json, Таланты «Оружейник»): «При стрельбе из плазменного оружия с
 * активированным свойством Maximal оно получает ещё +2 к Dmg, Pen» — поверх
 * собственных +1d10/+2 Pen Максимального режима (attack-outcome.mjs).
 *
 * Радиус Blast («может также дать ему +2 к радиусу», «Blast (2), если Blast
 * не было») — необязательный выбор стрелка; ни выбора в окне атаки, ни
 * собственных +2 к радиусу у самого Maximal в движке нет, здесь не считается.
 *
 * @returns {{dmg: number, pen: number}}
 */
export function plasmaMasteryBonus(actor, { isMelee, sys, maximalOn }) {
  const none = { dmg: 0, pen: 0 };
  if (isMelee || !maximalOn || !isPlasmaWeapon(sys)) return none;
  return hasDamageTalent(actor, "plasmaMastery") ? { dmg: 2, pen: 2 } : none;
}

// ── Окно атаки ──────────────────────────────────────────────────────────────

/**
 * Драгун / Мастер-Драгун (core.json, Таланты «Стрелок»): штраф «за нестабильную платформу» при
 * стрельбе из пистолетов, винтовок и длинных винтовок (то есть класс «Пистолет»
 * и «Ручное» — длинная винтовка у нас «Ручное» со свойством longRifle) —
 * Драгун «уменьшает его на 10», Мастер-Драгун «игнорирует любые штрафы».
 * Тяжёлое, метательное и прочие классы не затронуты.
 *
 * `base` — штраф со знаком (−10/−20/−30) или 0; результат тоже ≤ 0.
 * @returns {{value: number, note: string}} note пуст, если Талант ничего не изменил
 */
export function unstablePlatformPenalty(actor, { weaponClass, base }) {
  const b = Number(base) || 0;
  if (b >= 0 || (weaponClass !== "pistol" && weaponClass !== "basic")) return { value: b, note: "" };
  if (hasDamageTalent(actor, "masterDragoon")) return { value: 0, note: "Мастер-Драгун: штраф нестабильной платформы снят" };
  if (hasDamageTalent(actor, "dragoon")) return { value: Math.min(0, b + 10), note: "Драгун: штраф нестабильной платформы меньше на 10" };
  return { value: b, note: "" };
}
