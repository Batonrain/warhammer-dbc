// module/rules/flamer-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Таланты ОГНЕМЁТЧИКА главы 3 (Sahara 3-8318) — чистые функции. Бросков, Foundry
//  и сцены здесь нет; читатели — combat/defense.mjs (тест отмены Распыления),
//  combat/weapon-properties.mjs + hooks.mjs (тест против загорания).
//  Sprayer / Распылитель живёт в combat/defense.mjs (SPRAYER_CAPABILITY).
//
//  Опознание Таланта — «имя ИЛИ ключ» (hasAbility): предметы на акторах —
//  снимки («ловушка Desiccated»). Модуль не импортируется из rules/sources.mjs.
//
//  ── Friendly Fire / Дружественный Огонь ─────────────────────────────────────
//  «Когда он стреляет из оружия со свойством Spray, он может дать всем целям в
//  пределах дистанции от себя по своему выбору бонус +30 на тест A для избегания
//  от попадания». Выбор «кому» система не ведёт (карточка общая, у каждого токена
//  своя кнопка теста): бонус получают все, кто НЕ враг стрелка по расположению
//  токенов (союзник или нейтрал). Тот, кого стрелок не хотел прикрывать, — случай,
//  который книга допускает, а система — нет (см. отчёт сессии).
//
//  ── Pyromaniac / Пироман, первая половина ──────────────────────────────────
//  «Цели должны перебрасывать успешные тесты, чтобы не загореться от атак
//  персонажа оружием, имеющим свойства Spray и Flame, а враги в укрытиях еще и
//  получают штраф –20 на эти тесты». Эта часть — здесь и в hooks.mjs. Вторая
//  половина (укрытия под шаблоном горят 1d5+1 Раундов, закончивший Ход в них
//  загорается) — rules/burning-cover.mjs + combat/burning-cover.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";

export const FLAMER_TALENTS = Object.freeze({
  friendlyFire: { key: "flamer.core.friendlyFire", name: "Friendly Fire" },
  pyromaniac:   { key: "flamer.core.pyromaniac",   name: "Pyromaniac" },
  torrent:      { key: "flamer.core.torrent",      name: "Torrent" }
});

export const FRIENDLY_FIRE_BONUS = 30;
export const PYROMANIAC_COVER_PENALTY = -20;

export function hasFlamerTalent(actor, id) {
  const t = FLAMER_TALENTS[id];
  return !!t && hasAbility(actor, t.key, t.name, "talent");
}

/**
 * Бонус теста отмены Распыления (A) от Дружественного Огня стрелка.
 * @param {"ally"|"enemy"|"neutral"|null} relationship  отношение токена-цели к токену стрелка
 *   (regions/auras.mjs::tokenRelationship); null — токены найти не удалось → бонуса нет
 * @returns {number} +30 или 0
 */
export function friendlyFireBonus(attacker, { relationship }) {
  if (!relationship || relationship === "enemy") return 0;
  return hasFlamerTalent(attacker, "friendlyFire") ? FRIENDLY_FIRE_BONUS : 0;
}

/** Пироман действует: Талант у стрелка, оружие со Spray и Flame. */
export function pyromaniacActive(attacker, { spray, flame }) {
  return !!spray && !!flame && hasFlamerTalent(attacker, "pyromaniac");
}

/** Штраф теста против загорания для цели в укрытии (AP зоны Укрытия > 0). */
export const pyromaniacCoverPenalty = coverAp => ((Number(coverAp) || 0) > 0 ? PYROMANIAC_COVER_PENALTY : 0);

//  ── Torrent / Поток ─────────────────────────────────────────────────────────
//  «Когда он стреляет из огнемета, над которым он поработал хотя бы 1 смену, он
//  может удвоить расход боеприпасов, чтобы вместо каплевидного шаблона поместить
//  шаблон Blast(Rng/5+1) в пределах удвоенной обычной дальности огнемета и прямой
//  видимости. Этот шаблон наносит попадание по обычным правилам Spray».
//
//  «Работал смену» отмечает Мастерская Крафта (apps/craft-workshop.mjs): смена с
//  Tech-Use на выбранном огнемёте увеличивает счётчик на ПРЕДМЕТЕ (флаг ниже).
//  Метка на самом оружии, а не на акторе: оружие переходит из рук в руки, и
//  «над этим огнемётом работали» — свойство огнемёта.

/** Счётчик смен Крафта (с Tech-Use) над этим огнемётом — флаг на предмете. */
export const TORRENT_WORKED_FLAG = "torrentWorkedShifts";
/** Значение навыка Tech-Use в выборе Мастерской (constants/craft.mjs::buildAvailableSkills). */
export const TECH_USE_OPTION = "skill:techUse";

/** Огнемёт: weaponType "flame" (так лежат все 22 огнемёта packs-src/weapons; тот же ключ — WEAPON_TYPE_TO_TRAINING). Смотрится сам предмет, не профиль режима. */
export function isFlamerWeapon(item) {
  return item?.type === "weapon" && item?.system?.weaponType === "flame";
}

/** Сколько смен над оружием отработано (0 — не работали). */
export function torrentWorkedShifts(item) {
  return Math.max(0, Number(item?.getFlag?.("warhammer-dbc", TORRENT_WORKED_FLAG)) || 0);
}

/** Считается ли смена Крафта «работой над огнемётом» для Потока: нужен Tech-Use среди выбранных навыков теста. */
export function shiftCountsForTorrent(selectedSkillValues) {
  return Array.isArray(selectedSkillValues) && selectedSkillValues.includes(TECH_USE_OPTION);
}

/** Поток вообще предлагается в окне атаки: огнемёт в руках стрелка с Талантом (галочка видна). */
export function torrentOffered(actor, { item, isMelee }) {
  return !isMelee && isFlamerWeapon(item) && hasFlamerTalent(actor, "torrent");
}

/** Поток сработает: предложен, галочка стоит и над оружием уже работали. */
export function torrentActive(actor, { item, isMelee, toggles }) {
  return torrentOffered(actor, { item, isMelee }) && !!toggles?.torrent && torrentWorkedShifts(item) >= 1;
}

/** Радиус шаблона Blast(Rng/5+1), м. Rng/5 — с округлением вверх (принятое в проекте «окр.▲»). */
export function torrentBlastRadius(rng) {
  return Math.ceil((Number(rng) || 0) / 5) + 1;
}

/** Предел размещения шаблона: удвоенная обычная дальность огнемёта, м. */
export function torrentMaxDistance(rng) {
  return (Number(rng) || 0) * 2;
}

/**
 * Можно ли поставить шаблон Потока именно сюда. Возвращает причину отказа или null.
 * @param {{distanceM:number, maxM:number, blocked:boolean}} p  blocked — стена на линии зрения стрелок→центр шаблона
 */
export function torrentPlacementProblem({ distanceM, maxM, blocked }) {
  if (Number(distanceM) > Number(maxM)) return `дальше удвоенной дальности огнемёта (${Math.round(distanceM)} м из ${maxM} м)`;
  if (blocked) return "нет прямой видимости до центра шаблона";
  return null;
}
