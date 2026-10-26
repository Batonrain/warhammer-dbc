// module/combat/timed-effects.mjs
// ════════════════════════════════════════════════════════════════════════
//  ВРЕМЕННЫЙ ЭФФЕКТ «ДО НАЧАЛА СЛЕДУЮЩЕГО СВОЕГО ХОДА» (Sahara
//  inspire-wrath-cannon-fodder, п. 2: Боевой Клич).
//
//  Книга (War Cry, стр. 91): «получить рейтинг Страха 1 или +1 к текущему
//  уровню Страха персонажа до начала своего следующего Хода». Раньше кнопка
//  лишь писала карточку, а рейтинг в расчёт не попадал. Теперь это настоящий
//  ActiveEffect на `system.fearRating` (type "add": «рейтинг 1» при нуле и
//  «+1 к текущему» при ненулевом — одна и та же прибавка).
//
//  Срок — штатная Duration Foundry v14 (сверено по common/documents/
//  active-effect.mjs установленного Foundry): { value, units, expiry }, момент
//  начала ядро пишет само в effect.start. «Если не сказано обратного» эффекты
//  по Раундам кончаются в КОНЦЕ Хода (CORE «Длительность Эффектов»,
//  condition-duration.mjs::durationDataFor) — но War Cry говорит обратное:
//  «до НАЧАЛА следующего Хода», поэтому expiry здесь "turnStart", не "turnEnd".
//
//  Ядро помечает истёкший эффект (duration.expired) и перестаёт применять его
//  изменения; удаляем мы — чтобы он не копился на листе, — по той же отметке
//  (onTimedEffectExpired) и страховкой в начале Хода хозяина (sweepTimedEffects):
//  вне боя ядро Раундов не считает, а эффект без боя жить «до Хода» не может.
// ════════════════════════════════════════════════════════════════════════

import { expectedPhase } from "../constants/effect-keys.mjs";

const NS = "warhammer-dbc";
/** Метка на эффекте: { key, combatId, round }. key — какая способность его выдала. */
export const TIMED_EFFECT_FLAG = "timedEffect";
export const WAR_CRY_EFFECT_KEY = "warCry";
/** Приоритет прибавки Клича: после «upgrade»-источников рейтинга (Fear (X), priority 0) — «+1 к текущему». */
export const WAR_CRY_PRIORITY = 100;

/**
 * Данные эффекта на один Раунд «до начала следующего Хода» (чистая функция).
 *
 * @param {{key:string, name:string, img?:string, changes:object[], combat?:{id:string, round:number}|null}} spec
 */
export function timedEffectData({ key, name, img, changes, combat = null }) {
  return {
    name,
    img: img || "icons/svg/upgrade.svg",
    // type "add" и фаза — по ключу (constants/effect-keys.mjs), как у всех эффектов системы.
    system: { changes: changes.map(c => ({ priority: 0, type: "add", ...c, phase: c.phase ?? expectedPhase(c.key) })) },
    duration: { value: 1, units: "rounds", expiry: "turnStart" },
    flags: { [NS]: { [TIMED_EFFECT_FLAG]: { key, combatId: combat?.id ?? "", round: Number(combat?.round) || 0 } } }
  };
}

/** Эффекты актора, выданные способностью `key`. */
export function timedEffectsOf(actor, key) {
  return [...(actor?.effects ?? [])].filter(e => {
    const f = e.getFlag?.(NS, TIMED_EFFECT_FLAG) ?? e.flags?.[NS]?.[TIMED_EFFECT_FLAG];
    return f && (!key || f.key === key);
  });
}

/**
 * Пора ли снять эффект в начале Хода хозяина (чистая функция): он выдан в
 * другом бою или в Раунде раньше текущего. Вне боя (combat нет) «до следующего
 * Хода» наступить не может — эффект живёт, пока не начнётся бой.
 */
export function timedEffectStale(flag, combat) {
  if (!flag || !combat) return false;
  if (flag.combatId && flag.combatId !== combat.id) return true;
  return Number(combat.round) > Number(flag.round);
}

/**
 * Выдать эффект актору; повторная выдача той же способности заменяет прежний
 * эффект (рейтинг Страха от двух кличей подряд не складывается).
 * @returns {Promise<object|null>} созданный эффект
 */
export async function grantTimedEffect(actor, spec) {
  const combat = globalThis.game?.combat?.started ? globalThis.game.combat : null;
  const old = timedEffectsOf(actor, spec.key).map(e => e.id).filter(Boolean);
  if (old.length) await actor.deleteEmbeddedDocuments("ActiveEffect", old);
  const [effect] = (await actor.createEmbeddedDocuments("ActiveEffect", [timedEffectData({ ...spec, combat })])) ?? [];
  return effect ?? null;
}

/**
 * Ядро пометило эффект истёкшим (hook updateActiveEffect) — удаляем его.
 * Только активный ГМ: отметку ставит он же, и снимать дважды незачем.
 */
export async function onTimedEffectExpired(effect, changes) {
  if (changes?.duration?.expired !== true) return false;
  if (!globalThis.game?.users?.activeGM?.isSelf) return false;
  const flag = effect?.getFlag?.(NS, TIMED_EFFECT_FLAG) ?? effect?.flags?.[NS]?.[TIMED_EFFECT_FLAG];
  if (!flag) return false;
  // Вне боя ядро отмечает любой эффект истёкшим на каждом тике Календаря — это не «Ход настал».
  if (!globalThis.game?.combat?.started) return false;
  await effect.delete();
  return true;
}

// ── Грозный Вопль: «рейтинг Страха 2 до конца боя» (Sahara dread-wail-2) ─────
//
// Эффект на ЦЕЛИ (чужом акторе — пишет ГМ-релей, gm-relay.mjs::performTargetWrite).
// Срок — не «до Хода»: метка своя (DREAD_WAIL_FEAR_FLAG), а НЕ timedEffect —
// sweepTimedEffects снимал бы по метке timedEffect уже на следующем Раунде.
// Снимается вместе с боем (clearDreadWailFear ← deleteCombat). «upgrade»: два
// источника Страха не складываются, рейтинг 2 — «не ниже 2» (AGENTS.md).
export const DREAD_WAIL_FEAR_FLAG = "dreadWailFear";

/** Данные эффекта Страха 2 до конца боя (чистая функция). */
export function dreadWailFearEffectData(combat = null) {
  return {
    name: "Грозный Вопль — рейтинг Страха 2",
    img: "icons/svg/terror.svg",
    system: { changes: [{ key: "system.fearRating", type: "upgrade", value: 2, phase: expectedPhase("system.fearRating"), priority: 0 }] },
    flags: { [NS]: { [DREAD_WAIL_FEAR_FLAG]: { combatId: combat?.id ?? "" } } }
  };
}

const dreadWailFearEffectsOf = actor => [...(actor?.effects ?? [])].filter(e =>
  (e.getFlag?.(NS, DREAD_WAIL_FEAR_FLAG) ?? e.flags?.[NS]?.[DREAD_WAIL_FEAR_FLAG]));

/** Наложить Страх 2 на цель до конца текущего боя; повторное попадание заменяет прежний эффект. */
export async function grantDreadWailFear(actor) {
  const combat = globalThis.game?.combat?.started ? globalThis.game.combat : null;
  const old = dreadWailFearEffectsOf(actor).map(e => e.id).filter(Boolean);
  if (old.length) await actor.deleteEmbeddedDocuments("ActiveEffect", old);
  await actor.createEmbeddedDocuments("ActiveEffect", [dreadWailFearEffectData(combat)]);
  // Метка-Состояние «Страх от вопля» (condition-mirrors.mjs) зеркалит этот флаг.
  await actor.setFlag(NS, "dreadWailFeared", true);
}

/**
 * Конец боя: снять Страх 2 Грозного Вопля у участников и у всех токенов сцены
 * этого боя (волна бьёт и тех, кто в бой не вписан). Эффект другого боя не
 * трогается; выданный вне боя (combatId "") уходит с первым же концом боя.
 */
export async function clearDreadWailFear(combat) {
  const actors = new Set();
  for (const c of combat?.combatants ?? []) if (c?.actor) actors.add(c.actor);
  for (const t of combat?.scene?.tokens ?? []) if (t?.actor) actors.add(t.actor);
  for (const actor of actors) {
    const mine = dreadWailFearEffectsOf(actor).filter(e => {
      const f = e.getFlag?.(NS, DREAD_WAIL_FEAR_FLAG) ?? e.flags?.[NS]?.[DREAD_WAIL_FEAR_FLAG];
      return !f?.combatId || f.combatId === combat.id;
    });
    // Старая «вечная» метка (до появления эффекта она нигде не снималась) уходит и без эффекта.
    if (!mine.length) {
      if (!dreadWailFearEffectsOf(actor).length && actor.getFlag?.(NS, "dreadWailFeared")) await actor.unsetFlag(NS, "dreadWailFeared");
      continue;
    }
    await actor.deleteEmbeddedDocuments("ActiveEffect", mine.map(e => e.id).filter(Boolean));
    if (!dreadWailFearEffectsOf(actor).length && actor.getFlag?.(NS, "dreadWailFeared")) {
      await actor.unsetFlag(NS, "dreadWailFeared");
    }
  }
}

/** Начало Хода актора: снять его устаревшие временные эффекты (страховка к onTimedEffectExpired). */
export async function sweepTimedEffects(actor, combat) {
  const stale = timedEffectsOf(actor).filter(e => {
    const f = e.getFlag?.(NS, TIMED_EFFECT_FLAG) ?? e.flags?.[NS]?.[TIMED_EFFECT_FLAG];
    return timedEffectStale(f, combat);
  }).map(e => e.id);
  if (stale.length) await actor.deleteEmbeddedDocuments("ActiveEffect", stale);
  return stale.length;
}
