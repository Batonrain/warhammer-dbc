// module/rules/fatalism.mjs
//
// Fatalism / Фатализм (Дар Нургла, d100 70…73, wdbc-1rno, 12.09.2026) —
// первая находка в кластере «сопротивление психосилам». Разведка прошлых
// заходов (см. заметки wdbc-1rno) констатировала, что психосилы в системе не
// имеют ВООБЩЕ никакого конвейера «применяется к цели → цель проверяется на
// сопротивление/иммунитет» — это оказалось неточно: конвейер есть,
// «Психотест X vs Y+N» (sheets/tabs/psychic.mjs::executePsychotest,
// resistSection, wdbc-5vf4) уже отправляет цели кнопку «📨 Запросить тест
// Сопротивления», которая открывает ОБЫЧНЫЙ делегированный тест Характе-
// ристики (hooks.mjs::registerDelegatedTestOpener("genericTest", …)). Не
// хватало только ОДНОГО звена — иммунитета, который отменяет сам тест, а не
// подсказки предикату внутри него.
//
// Книжный текст (packs-src, benefit): «Бог Неизменности ограждает судьбу
// своего чемпиона от чужого вмешательства. Все персонажи в радиусе Cor.b м
// от персонажа, кроме тех, кого он сознательно исключил из ауры, игнорируют
// эффекты психосил Прорицания и прочих сил, что манипулируют судьбой и
// вероятностью.»
//
// Реализовано: дисциплина Прорицания (sys.discipline === "divination") —
// единственная, для которой в данных есть машиночитаемый признак. «Прочие
// силы, манипулирующие судьбой и вероятностью» вне дисциплины Прорицания
// НЕ распознаются программно (нет поля-метки «эта конкретная сила из другой
// дисциплины тоже манипулирует судьбой») — честно не смоделировано, решение
// стола по конкретной силе.
//
// НЕ реализовано: «кроме сознательно исключённых из ауры» — у ауры нет поля
// списка исключений (носитель выбирал бы вручную, кого не защищать), это
// новое UI-поле, не 5-минутная находка. Аура защищает БЕЗУСЛОВНО всех в
// радиусе, включая врагов носителя — то же самое, чем книга и описывает её
// умолчание («кроме тех, кого он сознательно исключил»).

import { hasRuleFlag } from "./flags.mjs";
import { tokensWithinRadius } from "./aoe-target.mjs";

const CAPABILITY = "gift.nurgle.fatalism";

/** Дисциплины психосил, для которых Фатализм гасит эффект книжно (пока — только Прорицание). */
const PROTECTED_DISCIPLINES = new Set(["divination"]);

/**
 * Стоит ли targetToken в радиусе Cor.b м хотя бы одного носителя Фатализма
 * на той же сцене (включая самого носителя). Токен несёт сцену в себе
 * (`parent`) — game/canvas здесь не нужны, вызывающая сторона (hooks.mjs)
 * передаёт уже выделенный/известный токен.
 */
export function fatalismProtects(targetToken) {
  const scene = targetToken?.parent;
  if (!scene) return false;
  for (const bearerToken of scene.tokens?.contents ?? []) {
    const bearer = bearerToken.actor;
    if (!bearer || !hasRuleFlag(bearer, CAPABILITY)) continue;
    const radius = Number(bearer.system?.corruptionBonus) || 0;
    if (radius <= 0) continue;
    const within = tokensWithinRadius(bearerToken, radius, { includeSelf: true });
    if (within.some(t => t.id === targetToken.id)) return true;
  }
  return false;
}

/**
 * Гасит ли Фатализм ЭТУ конкретную силу: дисциплина книжно защищена
 * (сейчас — только «divination») И цель физически в радиусе носителя.
 */
export function fatalismBlocksPower(targetToken, discipline) {
  if (!PROTECTED_DISCIPLINES.has(String(discipline || "").trim().toLowerCase())) return false;
  return fatalismProtects(targetToken);
}
