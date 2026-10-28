// module/rules/alcohol.mjs
//
// Алкоголь (корбук, «Химия: Наркотики», стр. 280; 3-edc4 п.8, Декаданс):
//   «Персонаж проходит тест на Т+0 (от яда) с накапливающимся штрафом –10 за
//   каждую рюмку после первой, и складывает Провалы (но не Успехи). На 1-9
//   Провалов он получает +30 на все тесты социального взаимодействия с другими
//   пьяными персонажами и +20 против Страха, Шока, Запугивания и Подавления, на
//   5+ Провалов он не может проводить Ментальные действия, но поднимает бонус
//   против Страха/Шока/Запугивания/Подавления до +40, на 7+ Провалов он
//   получает штраф –10 на все Физические действия и иммунитет к Страху,
//   Запугиванию, Шоку и Подавлению, на 9+ Провалов он не может совершать Бег или
//   Натиск и увеличивает штраф на все Физические действия до –20. На 15
//   Провалов он теряет сознание. Каждые 20 минут эффект уменьшается на 1 Провал.»
//
// Декаданс (Талант Стойкости): «При употреблении алкоголя он удваивает все
// пределы накопленных провалов на его эффекты» — все пороги выше ×2.
//
// Чистая часть: учёт рюмок и Провалов, спад по времени, ступень опьянения.
// Бросок и запись — combat/alcohol.mjs. Файл ничего не импортирует.

/** Флаг актора: { fails, drinks, at } — накопленные Провалы, рюмки этой попойки, worldTime последнего учёта. */
export const ALCOHOL_FLAG = "alcohol";
/** Каждые 20 минут −1 Провал (секунды). */
export const ALCOHOL_DECAY_SECONDS = 20 * 60;
/** Штраф теста за каждую рюмку после первой. */
export const ALCOHOL_DRINK_PENALTY = -10;

/** Базовые пороги (в Провалах), до удвоения Декадансом. */
export const ALCOHOL_BASE_THRESHOLDS = { mental: 5, physical: 7, noRun: 9, unconscious: 15 };

/** Алкоголь ли этот препарат: по имени («Alcohol / Алкоголь»); «Алкогольный» яды не считаются. */
export function isAlcoholName(name) {
  return /(^|[\s/])(alcohol|алкоголь)\s*$/i.test(String(name ?? "").trim());
}

/**
 * Состояние на момент `now`: прошедшие 20-минутки сняли по Провалу; когда
 * спад съел все Провалы, попойка кончилась — рюмки обнуляются (штраф −10
 * «накапливающийся» относится к одной попойке). Ноль Провалов без прошедшей
 * 20-минутки — не конец попойки: непровалившийся пьёт дальше со штрафом.
 */
export function alcoholDecayed(state, now) {
  const s = { fails: 0, drinks: 0, at: Number(now) || 0, ...(state ?? {}) };
  const steps = Math.max(0, Math.floor(((Number(now) || 0) - (Number(s.at) || 0)) / ALCOHOL_DECAY_SECONDS));
  const fails = Math.max(0, (Number(s.fails) || 0) - steps);
  const ongoing = fails > 0 || steps === 0;
  return {
    fails,
    drinks: ongoing ? (Number(s.drinks) || 0) : 0,
    // Метка сдвигается на съеденные 20-минутки, а не на «сейчас»: остаток минут не теряется.
    at: ongoing ? (Number(s.at) || 0) + steps * ALCOHOL_DECAY_SECONDS : (Number(now) || 0)
  };
}

/** Штраф теста T+0 для следующей рюмки: −10 за каждую рюмку после первой (drinksBefore — сколько уже выпито). */
export function alcoholDrinkPenalty(drinksBefore) {
  const n = Math.max(0, Math.trunc(Number(drinksBefore) || 0));
  return n ? n * ALCOHOL_DRINK_PENALTY : 0; // без -0
}

/** Провалы теста: 0 при успехе, иначе степени провала (Успехи не вычитаются). */
export function alcoholFailsOf(rv, threshold) {
  if (Number(rv) <= Number(threshold)) return 0;
  return Math.floor((Number(rv) - Number(threshold)) / 10) + 1;
}

/** Пороги с учётом Декаданса (×2). */
export function alcoholThresholds(decadence = false) {
  const m = decadence ? 2 : 1;
  return Object.fromEntries(Object.entries(ALCOHOL_BASE_THRESHOLDS).map(([k, v]) => [k, v * m]));
}

/**
 * Что сейчас с пьяным при `fails` Провалах. «1-9 Провалов» книги — нижняя
 * граница 1, верхняя совпадает с порогом «9+», где бонусы переходят в штрафы;
 * для краткости ступень — набор действующих эффектов.
 * @returns {{drunk:boolean, social:number, fearBonus:number, noMental:boolean, fearImmune:boolean,
 *   physicalPenalty:number, noRunCharge:boolean, unconscious:boolean}}
 */
export function alcoholEffects(fails, decadence = false) {
  const f = Number(fails) || 0;
  const t = alcoholThresholds(decadence);
  const drunk = f >= 1;
  return {
    drunk,
    social: drunk ? 30 : 0,
    fearBonus: !drunk ? 0 : f >= t.mental ? 40 : 20,
    noMental: f >= t.mental,
    fearImmune: f >= t.physical,
    physicalPenalty: f >= t.noRun ? -20 : f >= t.physical ? -10 : 0,
    noRunCharge: f >= t.noRun,
    unconscious: f >= t.unconscious
  };
}

/** Текст эффектов для карточки. */
export function alcoholEffectsText(fx) {
  if (!fx.drunk) return "Трезв.";
  const parts = [`+${fx.social} к социальным тестам с другими пьяными`, `+${fx.fearBonus} против Страха/Шока/Запугивания/Подавления`];
  if (fx.noMental) parts.push("не может проводить Ментальные действия");
  if (fx.fearImmune) parts.push("иммунитет к Страху/Запугиванию/Шоку/Подавлению");
  if (fx.physicalPenalty) parts.push(`${fx.physicalPenalty} на все Физические действия`);
  if (fx.noRunCharge) parts.push("не может Бежать и делать Натиск");
  if (fx.unconscious) parts.push("ТЕРЯЕТ СОЗНАНИЕ");
  return parts.join("; ");
}
