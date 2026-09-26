// module/rules/null-zones.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Ауры субрас Парии и Дискорданта (корбук, глава I — Субрасы Людей).
//
//  Сама зона — движок аур (module/regions/auras.mjs): Черта носителя несёт
//  запись kind:"aura" радиусом W.b×3 м «на всех, включая себя», и каждому в
//  радиусе выдаётся Черта-метка — «В Пустоте Парии» (флаг pariah.void) или
//  «В Поле Дискорданта» (discordant.field). Здесь — только решения «что
//  нельзя/что меняется в зоне»; встроены они в места, где это происходит:
//
//  Пустота Парии
//   • психосилы (кроме Непрямых) не срабатывают ни у кастера в зоне, ни по
//     цели в зоне — sheets/tabs/psychic.mjs, hooks.mjs;
//   • Очки Бесчестия/Судьбы нельзя тратить и сжигать — apps/infamy-points.mjs,
//     sheets/tabs/death.mjs;
//   • Порча не прибавляется (у Парии Cor не выше 0 — он всегда в своей
//     ауре) — warhammer-dbc.mjs preUpdateActor;
//   • сверхъестественные мутации и дары (system.supernatural) гаснут —
//     apps/mechanics.mjs::syncNullZoneSuppression;
//   • псайкеры −PR×3, демоны −30 ко всем тестам; Пария −30 к социальным
//     (кроме Запугивания), −60 с псайкерами/демонами — rules/library/null-zones.mjs.
//
//  Поле Дискорданта (как Haywire (7) для электрики)
//   • электрическое стрелковое оружие не стреляет, рукопашное — как
//     выключенное (примитивное) — combat/attack.mjs;
//   • электрические импланты отключены — syncNullZoneSuppression;
//   • техночудо с целью в поле — Критический Провал — sheets/tabs/tech.mjs.
//
//  Хвосты (Мораль, Нестабильность, вместилища демонов, Ритуалы, касание
//  Парии, заклинивание механики, биоорганы, медицина) — отдельные задачи.
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";

export const PARIAH_VOID = "pariah.void";
export const PARIAH_SELF = "pariah.self";
export const DISCORDANT_FIELD = "discordant.field";

export const inPariahVoid = actor => !!actor && hasRuleFlag(actor, PARIAH_VOID);
export const inDiscordantField = actor => !!actor && hasRuleFlag(actor, DISCORDANT_FIELD);

/**
 * Непрямая сила (system психосилы): основной тип «Непрямое» или доп. тип
 * {type:"indirect"} в extraTypes. В книге «Непрямое» почти всегда не первое
 * в строке типа («Атака · Стрельба · Непрямое» у Тарана), поэтому в паке оно
 * лежит доп. типом. Карточки чата несут ответ готовым (data-psy-indirect).
 */
export function isIndirectPower(sys) {
  return sys?.powerType === "indirect" || (sys?.extraTypes ?? []).some(e => e?.type === "indirect");
}

/** Сила развеивается в Пустоте: любая, кроме Непрямой. */
export function voidBlocksPower(actor, power) {
  return inPariahVoid(actor) && !isIndirectPower(power?.system);
}

/**
 * Порча в Пустоте не прибавляется: вернуть значение, которое оставить. Сам
 * Пария (pariah.self) не поднимает Cor и без токена на сцене — он всегда в
 * своей ауре. Уменьшение не трогаем.
 */
export function corruptionInVoid(actor, oldValue, newValue) {
  const o = Number(oldValue) || 0, n = Number(newValue) || 0;
  if (n <= o) return n;
  if (inPariahVoid(actor) || hasRuleFlag(actor, PARIAH_SELF)) return o;
  return n;
}

/**
 * Запасной класс по weaponType — для оружия без system.techClass (старые
 * предметы на акторах). Основной источник — techClass, проставленный в паке
 * по папкам (утверждено владельцем 26.09.2026): лазер/плазма/мельта/волькит/
 * гравитон/силовое/шоковое — электрика; болтер/стаб/огнемёт/гранатомёт/
 * ракетные установки/цепное — механика. «exotic» без techClass не угадывается.
 */
export const WEAPON_TYPE_TECH = {
  laser: "electric", plasma: "electric", melta: "electric", grav: "electric",
  power: "electric", shock: "electric",
  bolt: "mechanical", solid: "mechanical", flame: "mechanical",
  launcher: "mechanical", chain: "mechanical"
};

export function weaponTechClass(weapon) {
  const own = weapon?.system?.techClass;
  if (own) return own;
  return WEAPON_TYPE_TECH[weapon?.system?.weaponType] || "none";
}

/** Оружие выключено полем: электрика у владельца, стоящего в поле. */
export function fieldDisablesWeapon(actor, weapon) {
  return inDiscordantField(actor) && weaponTechClass(weapon) === "electric";
}

/** Имплант выключен полем: электроника (system.techClass "electric"). */
export function fieldDisablesImplant(actor, implant) {
  return inDiscordantField(actor) && implant?.system?.techClass === "electric";
}

/** Мутация/Дар гаснет в Пустоте: помечен сверхъестественным. */
export function voidSuppressesMutation(actor, mutation) {
  return inPariahVoid(actor) && !!mutation?.system?.supernatural;
}

/** Техночудо: цель (или сам техножрец без цели) в поле — Критический Провал. */
export function fieldFailsTechPower(caster, target = null) {
  return inDiscordantField(target ?? caster);
}
