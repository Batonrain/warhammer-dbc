// module/rules/terror-sniper.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Terror Sniper / Снайпер Ужаса (core.json, «Стрелок», Sahara 3-5fbf):
//  «Когда он попадает Избирательной атакой оружием со свойством Accurate после
//  любого Прицеливания, он может пройти тест Intimidate(BS)+0 и при Успехе все
//  враги в радиусе Успехи м. от места попадания, видевшие попадание, но не
//  знавшие где находится стрелок, должны пройти тест на Подавление +0 (–20,
//  если они знают где находится стрелок)».
//
//  ── ТРАКТОВКА (книга внутренне противоречива, выбор исполнителя 25.10.2026) ──
//  Фраза «не знавшие, где стрелок» исключает знающих, а скобка «−20, если знают»
//  им же назначает штраф. Принято (Б): тест проходят ВСЕ враги в радиусе,
//  видевшие попадание; «не знавшим» (обычный случай, о нём говорит основная
//  фраза) — Подавление +0, «знающим» — по скобке −20. Так задействованы обе
//  числовые оговорки книги и ни одна не объявлена опечаткой; цена выбора —
//  «не знавшие» читается как описание обычного случая, а не как фильтр.
//  Вариант (А) («знавшие тест не проходят, скобка — опечатка») отличается только
//  тем, что знающие не проходят тест вовсе; переключить на него — убрать
//  знающих из списка в combat/terror-sniper.mjs (одна строка).
//  Книжное «знает ли враг, где стрелок» система не ведёт — по умолчанию «знает»,
//  если стрелок в поле зрения врага (rules/vision-target.mjs, приближённо), и
//  это галочка в карточке, которую стол может поправить.
//
//  Чистые функции: бросков, Foundry и сцены здесь нет. Поток — combat/terror-sniper.mjs.
//  Модуль не импортируется из rules/sources.mjs — круга через source-registry нет.
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";

export const TERROR_SNIPER = Object.freeze({ key: "rangedCore.core.terrorSniper", name: "Terror Sniper" });

/** Штраф теста Подавления для врага, знающего, где стрелок (скобка книги). */
export const TERROR_SNIPER_KNOWS_MOD = -20;

export const hasTerrorSniper = actor => hasAbility(actor, TERROR_SNIPER.key, TERROR_SNIPER.name, "talent");

/**
 * Предлагать ли кнопку Таланта на карточке: попадание стрелковой Избирательной
 * атакой оружием Accurate после любого Прицеливания (полу- или полного).
 */
export function terrorSniperEligible(actor, { isMelee, hit, accurate, aimValue, aiming }) {
  if (isMelee || !hit || !accurate || !aimValue) return false;
  if (!aiming || aiming === "none") return false;
  return hasTerrorSniper(actor);
}

/** Модификатор теста Подавления врага. */
export const terrorSniperSuppressMod = knowsShooter => (knowsShooter ? TERROR_SNIPER_KNOWS_MOD : 0);

/**
 * Порог Intimidate(BS)+0: обычный Навык Запугивания, но вместо его
 * Характеристики (WP) считается BS — та же подмена, что «Бросок с:» листа.
 */
export function terrorSniperThreshold(actor) {
  const skill = actor?.system?.skills?.intimidate;
  const chars = actor?.system?.characteristics ?? {};
  const bs = Number(chars.bs?.total) || 0;
  if (!Number.isFinite(skill?.total)) return { threshold: bs - 20, base: bs - 20 };
  const own = Number(chars[skill.char || "wp"]?.total) || 0;
  const base = skill.total - own + bs;
  return { threshold: base, base };
}
