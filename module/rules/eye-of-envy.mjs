// module/rules/eye-of-envy.mjs
//
// Eye of Envy / Око Зависти (Дар Слаанеш, wdbc-1rno, 12.09.2026) — первая
// находка, которой понадобился хук «атака/тест ПОЛНОСТЬЮ отыграны», не
// существовавший в конвейере атаки (module/combat/attack.mjs::
// _executeAttackRoll считает попадание своей веткой, attackHitOutcome, и не
// проходит через kind-outcome.mjs::resolveKindOutcome — тот хук есть только
// у тестов Навыка/Характеристики/Страха).
//
// Книжный текст (packs-src, benefit): «Когда персонаж совершает атаку по
// цели, чья базовая Характеристика для этой атаки выше, чем его собственная,
// или проводит встречный тест против противника, чья базовая Характеристика
// для этого теста выше, чем его собственная, он получает одно Очко
// Бесчестия, которое теряется после того, как атака или встречный тест были
// полностью отыграны, если его не потратить на них».
//
// Реализована ТОЛЬКО половина — атака. module/sheets/attack/dialog.mjs
// оборачивает вызов _executeAttackRoll этим модулем СНАРУЖИ, не трогая саму
// функцию (1700+ строк, единственный шов уже разрезан по другой причине,
// см. её заголовок) — риск ограничен этим файлом. Встречный тест (диалог
// Навыка/Характеристики, actor-sheet.mjs) — тот же книжный пункт, но другой
// путь и другое время — честно НЕ реализован в этот заход.
//
// Сравнение характеристик — то же самое, что уже делает
// item-rules.mjs::opposedTargetRerollRules (Уравнитель, Дар Нургла): базовая
// Характеристика = .total (не .bonus), по ключу ТЕКУЩЕГО теста. Направление
// обратное Уравнителю — там «моя выше», здесь «у цели выше».
//
// Трата — БЕЗ новой кнопки: apps/infamy-points.mjs::spendFromInfamyPool уже
// списывает временный запас (rules/temp-infamy.mjs) РАНЬШЕ обычного пула при
// ЛЮБОЙ существующей трате Бесчестия (Усиление/Успех/Переброс — actor-
// sheet.mjs::_ipSpend) — игрок тратит его как обычное Очко, просто оно
// живёт ровно до конца этой атаки.
//
// Срок жизни отличается от прежних потребителей temp-infamy.mjs (Стервятник/
// Глас Божий истекают по ВНЕШНЕМУ триггеру — конец Хода/Команды): здесь
// clearIfUnspent считает разницу ДО и ПОСЛЕ, а не обнуляет флаг целиком —
// grantTempInfamy/clearTempInfamy делят ОДИН флаг на актора без учёта
// источника, и наивный clearTempInfamy() стёр бы чужой одновременно висящий
// запас (Стервятник/Глас Божий), если он у актора тоже есть прямо сейчас.

import { hasRuleFlag } from "./flags.mjs";
import { tempInfamyAmount, grantTempInfamy, spendTempInfamy } from "./temp-infamy.mjs";

const CAPABILITY = "gift.slaanesh.eyeOfEnvy";

/** Базовая Характеристика ЦЕЛИ выше моей на ЭТОМ тесте (charKey — ключ теста)? */
export function eyeOfEnvyTriggers(actor, targetActor, charKey) {
  if (!hasRuleFlag(actor, CAPABILITY)) return false;
  const key = String(charKey || "").trim().toLowerCase();
  if (!key || !targetActor) return false;
  const mine   = Number(actor?.system?.characteristics?.[key]?.total) || 0;
  const theirs = Number(targetActor?.system?.characteristics?.[key]?.total) || 0;
  return theirs > mine;
}

/**
 * Оборачивает один бросок (атака/встречный тест): при совпадении выдаёт
 * временное Очко Бесчестия ДО броска и снимает его ПОСЛЕ, если персонаж его
 * не потратил, — независимо от исхода (попал/промазал, заклинило и т.п.,
 * roll всё равно считается «отыгранным»). `roll` — асинхронная функция
 * самого броска, вызывается ровно один раз, её результат прокидывается как
 * есть.
 */
export async function withEyeOfEnvy(actor, targetActor, charKey, roll) {
  const triggered = eyeOfEnvyTriggers(actor, targetActor, charKey);
  if (triggered) {
    await grantTempInfamy(actor, 1, {
      source: "Дар Слаанеш «Око Зависти»",
      restriction: "теряется, если не потрачено до конца этой атаки"
    });
  }
  const before = triggered ? tempInfamyAmount(actor) : 0;
  try {
    return await roll();
  } finally {
    // > before-1, а не !==0: если между грантом и этой строкой запас успел
    // подрасти (другой источник добавил свой temp), лишнее чужое трогать
    // нельзя — списываем СТРОГО 1, и только если моё Очко физически ещё там
    // (амаунт не опустился ниже уровня сразу после гранта).
    if (triggered && tempInfamyAmount(actor) >= before) await spendTempInfamy(actor, 1);
  }
}
