// module/rules/noise-marine.mjs
// ════════════════════════════════════════════════════════════════════════
//  Шумовой Десантник (Элитный архетип, глава 3, Sahara 1-54b9) — чистая
//  логика без Foundry.
//
//  Intoxicating Uproar / Пьянящий Рёв: «В бою он получает +2 за каждого
//  другого участника боя (до максимума в +12) на тесты T, Страха и
//  Подавления.» Число зависит от того, сколько бойцов сейчас в бою, поэтому в
//  данных его быть не может — источник правил «noiseMarine» считает его на
//  каждый бросок. Остальное из той же Черты (+20 к слуху, невозможность
//  застать врасплох) — записи Конструктора на самой Черте.
//
//  Pain Is Pleasure / Боль Это Наслаждение: «Когда он получает не поглощенный
//  урон, персонаж снимает 1 Усталости и получает +10 на все тесты до конца
//  своего следующего Хода (до максимума в +30).» Накопление — флаг актора
//  { stacks, ends, combatId }; срок считается концами СВОИХ Ходов тем же
//  приёмом, что Адская Живучесть (combat/hellish-resilience.mjs): ранен в
//  чужой Ход — 1 конец, в собственный — 2. Снимает и считает combat/
//  noise-marine.mjs.
//
//  ── Почему файл ничего не импортирует из combat/ и flags.mjs ──
//  Он подключён к rules/sources.mjs (AGENTS.md, wdbc-795h): способность
//  опознаётся по имени предмета, как в rules/awareness-talents.mjs.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

export const UPROAR_PER_COMBATANT = 2;
export const UPROAR_MAX = 12;
export const UPROAR_SCOPES = ["basedon:t", "fear", "suppression"];

export const PAIN_IS_PLEASURE_FLAG = "painIsPleasure";
export const PAIN_IS_PLEASURE_STEP = 10;
export const PAIN_IS_PLEASURE_MAX_STACKS = 3;

const NS = "warhammer-dbc";

const hasNamed = (actor, type, name) =>
  [...(actor?.items ?? [])].some(i => i?.type === type && itemHasName(i, name));

/** Владеет ли актор Чертой Intoxicating Uproar / Пьянящий Рёв. */
export function hasIntoxicatingUproar(actor) {
  return hasNamed(actor, "trait", "Intoxicating Uproar");
}

/** Владеет ли актор Талантом Pain Is Pleasure / Боль Это Наслаждение. */
export function hasPainIsPleasure(actor) {
  return hasNamed(actor, "talent", "Pain Is Pleasure");
}

/**
 * Сколько ДРУГИХ участников в начатом бою, где участвует актор; null — актор вне боя.
 * Павшие (isDefeated) не считаются; два токена одного и того же актора — разные участники боя.
 */
export function otherCombatantsCount(actor, combat = globalThis.game?.combat) {
  if (!actor || !combat?.started) return null;
  const all = [...(combat.combatants ?? [])];
  const mine = all.filter(c => (c.actorId ?? c.actor?.id) === actor.id);
  if (!mine.length) return null;
  const others = all.filter(c => !mine.includes(c) && !c.isDefeated);
  return others.length;
}

/** Бонус Пьянящего Рёва: +2 за каждого другого участника боя, не больше +12. */
export function uproarBonus(otherCount) {
  const n = Math.max(0, Math.floor(Number(otherCount) || 0));
  return Math.min(UPROAR_MAX, n * UPROAR_PER_COMBATANT);
}

/** Бонус Боли-Наслаждения по состоянию флага: +10 за каждый накопленный уровень. */
export function painIsPleasureBonus(flag) {
  const stacks = Math.min(PAIN_IS_PLEASURE_MAX_STACKS, Math.max(0, Math.floor(Number(flag?.stacks) || 0)));
  return stacks * PAIN_IS_PLEASURE_STEP;
}

/**
 * Флаг после ещё одного непоглощённого урона: уровень +1 (макс. +30), срок обновляется для всего накопленного.
 * ownTurn — получил урон в собственный Ход: этот Ход «следующим» не считается.
 */
export function painIsPleasureNext(prev, { ownTurn = false, combatId = "" } = {}) {
  const stacks = Math.min(PAIN_IS_PLEASURE_MAX_STACKS, (Math.max(0, Math.floor(Number(prev?.stacks) || 0))) + 1);
  const ends = ownTurn ? 2 : 1;
  const keep = prev?.combatId === combatId ? Math.max(Number(prev?.ends) || 0, ends) : ends;
  return { stacks, ends: keep, combatId };
}

/** Флаг после конца Хода носителя: счётчик убывает; null — бонус кончился, флаг снимается. */
export function painIsPleasureAtTurnEnd(flag) {
  if (!flag || !(Number(flag.stacks) > 0)) return null;
  const ends = (Number(flag.ends) || 1) - 1;
  return ends <= 0 ? null : { ...flag, ends };
}

/**
 * Источник правил «noiseMarine» (rules/sources.mjs): авто-бонусы Шумового Десантника.
 * @returns {object[]}
 */
export function noiseMarineRules(actor) {
  const rules = [];
  if (hasIntoxicatingUproar(actor)) {
    const bonus = uproarBonus(otherCombatantsCount(actor));
    if (bonus > 0) {
      rules.push({
        id: "noiseMarine.intoxicatingUproar", label: "Пьянящий Рёв", when: {},
        effects: [{ kind: "rollBonus", target: UPROAR_SCOPES, value: bonus, auto: true,
                    label: `Пьянящий Рёв: другие участники боя (макс. +${UPROAR_MAX})` }]
      });
    }
  }
  if (hasPainIsPleasure(actor)) {
    const bonus = painIsPleasureBonus(actor?.getFlag?.(NS, PAIN_IS_PLEASURE_FLAG));
    if (bonus > 0) {
      rules.push({
        id: "noiseMarine.painIsPleasure", label: "Боль Это Наслаждение", when: {},
        effects: [{ kind: "rollBonus", target: "all", value: bonus, auto: true,
                    label: "Боль Это Наслаждение: всплеск агонии и экстаза" }]
      });
    }
  }
  return rules;
}

// ── Стена Диссонанса ───────────────────────────────────────────────────────

export const WALL_RADIUS_PER_COR = 2;
export const WALL_KNOCKBACK_PER_COR = 3;
export const WALL_SIZE_IMMUNE = 2;
export const WALL_SIZE_IMMUNE_HIGH_COR = 3;
export const WALL_HIGH_COR = 66;

/** Радиус стены и дальность отброса в метрах: Cor.b×2 и Cor.b×3. */
export function wallOfDiscordGeometry(actor) {
  const cb = Math.max(0, Number(actor?.system?.corruptionBonus) || 0);
  return { radius: cb * WALL_RADIUS_PER_COR, knockback: cb * WALL_KNOCKBACK_PER_COR };
}

/** Стена не действует на Размер 2+, а при Порче 66+ — на Размер 3+. */
export function wallImmuneBySize(size, corruption) {
  const limit = (Number(corruption) || 0) >= WALL_HIGH_COR ? WALL_SIZE_IMMUNE_HIGH_COR : WALL_SIZE_IMMUNE;
  return (Number(size) || 0) >= limit;
}

const centreOf = (tokenDoc, gridSize) => ({
  x: (Number(tokenDoc?.x) || 0) + ((Number(tokenDoc?.width) || 1) * gridSize) / 2,
  y: (Number(tokenDoc?.y) || 0) + ((Number(tokenDoc?.height) || 1) * gridSize) / 2
});

/**
 * Куда встанет цель, отброшенная на `meters` от токена-источника: по прямой от центра источника через центр цели.
 * Стены сцены и другие токены не учитываются. Возвращает левый верхний угол (x, y) в пикселях сцены.
 */
export function wallPushDestination(casterToken, targetToken, grid, meters) {
  const size = Number(grid?.size) || 100;
  const unit = Number(grid?.distance) || 1;
  const a = centreOf(casterToken, size);
  const b = centreOf(targetToken, size);
  let dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) { dx = 1; dy = 0; } else { dx /= len; dy /= len; }
  const px = ((Number(meters) || 0) / unit) * size;
  return { x: Math.round((Number(targetToken?.x) || 0) + dx * px), y: Math.round((Number(targetToken?.y) || 0) + dy * px) };
}

/** Не дальше ли цель сдвинута, чем дальность отброса (+1 клетка запаса на округление) — сверка ГМ-релея. */
export function knockbackWithinLimit(tokenDoc, dest, grid, meters) {
  const size = Number(grid?.size) || 100;
  const unit = Number(grid?.distance) || 1;
  if (!Number.isFinite(Number(dest?.x)) || !Number.isFinite(Number(dest?.y))) return false;
  const moved = Math.hypot(Number(dest.x) - (Number(tokenDoc?.x) || 0), Number(dest.y) - (Number(tokenDoc?.y) || 0));
  return moved <= (((Number(meters) || 0) / unit) + 1) * size;
}
