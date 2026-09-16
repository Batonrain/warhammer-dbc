// module/rules/fruit-of-flesh.mjs
// ════════════════════════════════════════════════════════════════════════
//  Fruit of Flesh / Плод Плоти (Общие Мутации, wdbc-1rno) — 12 субмутаций
//  (rules/submutations.mjs), у каждой свой триггер-опасность и свой плод-
//  граната. Раз в сутки на весь предмет (framework kind:"script" +
//  scriptThrottleUnit:"day" — гейт частоты не здесь, apps/mechanics.mjs).
//
//  Группа A (готовые примитивы движка, реализована здесь):
//   • "0"   Плод Исцеления — самоотчёт непоглощённого урона (тот же
//     принцип self-report, что Tireless Warrior/Priest of Bloodshed: сам
//     момент «получил непоглощённый урон» система не перехватывает
//     реактивно), плод созревает 3 дня, съевший восстанавливает 2d10 Ран,
//     не больше поглощённого при создании.
//   • "4-5" Пламя — тушит Горение себе и всем в радиусе Cor.b м, Flame-
//     рейтинг гранаты = максимум burningSourceDamage среди потушенных
//     (condition-ticks.mjs, магнитуда поджигания уже хранится там).
//   • "7"   Яд и Радиация — снимает Отравление/Радиацию себе и радиусу,
//     Rad-рейтинг = десятки суммарной снятой дозы (conditions.radiationLevel).
//
//  Группы B/C (Haywire/Дым/Пси-атака/Стазис/Заточение/Осколки/Тройной Плод)
//  сюда не входят — dispatchFruitKind() честно возвращает "" для их
//  подписей, apps/fruit-of-flesh.mjs на этот случай не делает ничего кроме
//  предупреждения (см. его шапку).
//
//  Модуль чистый — Foundry не нужен, проверяется test/rules/fruit-of-flesh.test.mjs.
// ════════════════════════════════════════════════════════════════════════

/** Подпись строки субмутации (submutation.label) → внутренний ключ вида плода. */
const KIND_BY_LABEL = {
  "0": "heal", "1": "haywire", "2-3": "smoke", "4-5": "flame",
  "6": "stun", "7": "toxicRad", "8": "psychicDamage", "9": "psychicLock",
  "10": "shard", "11": "triple"
};

/** Вид плода по подписи субмутации — "" если субмутация ещё не выпала/не распознана. */
export function fruitKindByLabel(label) {
  return KIND_BY_LABEL[String(label ?? "").trim()] || "";
}

/** Раны после лечения healAmount (клэмп к максимуму, не ниже текущих). */
export function fruitHealWounds(system, healAmount) {
  const heal = Math.max(0, Number(healAmount) || 0);
  const cur  = Number(system?.wounds?.value) || 0;
  const max  = Number(system?.wounds?.max) || 0;
  return Math.min(max, cur + heal);
}

/** Сколько реально исцеляет созревший Плод Исцеления: не больше поглощённого. */
export function fruitHealAmount(rollTotal, capacity) {
  return Math.max(0, Math.min(Number(rollTotal) || 0, Number(capacity) || 0));
}

/** Секунд до созревания Плода Исцеления — maturesAt уже абсолютный момент (worldTime активации + 3 дня). */
export function fruitMaturityRemaining(maturesAt, worldTime) {
  if (maturesAt == null) return 0;
  const remaining = Number(maturesAt) - Number(worldTime);
  return remaining > 0 ? remaining : 0;
}

/** Flame-рейтинг гранаты Плода — максимум магнитуд потушенных поджиганий (минимум 1, если хоть кто-то горел). */
export function fruitFlameRating(sourceDamages) {
  const vals = (sourceDamages || []).map(v => Math.max(1, Number(v) || 1));
  return vals.length ? Math.max(...vals) : 0;
}

/** Rad-рейтинг гранаты Плода — десятки суммарной снятой дозы радиации, минимум 1, если доза была. */
export function fruitRadRating(totalDoseRemoved) {
  const total = Math.max(0, Number(totalDoseRemoved) || 0);
  if (total <= 0) return 0;
  return Math.max(1, Math.floor(total / 10));
}

/** Blast-рейтинг гранаты Плода — ½Cor.b, округление вверх. */
export function fruitBlastRating(corBonus) {
  return Math.max(0, Math.ceil((Number(corBonus) || 0) / 2));
}
