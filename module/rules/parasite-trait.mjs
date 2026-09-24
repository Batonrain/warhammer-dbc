// module/rules/parasite-trait.mjs
// ════════════════════════════════════════════════════════════════════════
//  Parasite/Паразит (Трейт — общий, wdbc-ux8a): «...паразит должен
//  коснуться жертвы и сохранять контакт как минимум 1d5 Ходов +1 Ход за
//  каждый уровень брони в точке контакта... Если паразит успешно завершил
//  заражение, он получает полный контроль над телом и разумом хоста.
//  Заражённый хост действует в Инициативу паразита и использует его I, P и
//  W, а если его WS или BS ниже, чем у паразита — то также и их... не может
//  использовать психосилы, Чудеса Веры и Трейт Warp-Gifted.»
//
//  Реализована ЧАСТЬ (wdbc-ux8a, решение пользователя — «делай и Группу B
//  тоже»): контакт/длительность/срыв (module/apps/parasite-trait.mjs,
//  Состояние parasiticContact — счётчик тикает ГЕНЕРИК-циклом
//  processConditionTurnStart, combat/condition-ticks.mjs, спец-хук на 0
//  завершает заражение) и числовая часть слияния — Инициатива, Int/Per/WP
//  паразита, лучший из WS/BS (module/rules/character.mjs), блок
//  собственных психосил (module/sheets/tabs/psychic.mjs).
//
//  НЕ автоматизировано (честная граница, отмечено и на самом предмете
//  packs-src): перенос Навыков/Талантов хосту — нет канала «временно дать
//  чужие Навыки/Таланты без физического клонирования предметов»; блок Чудес
//  Веры/Warp-Gifted — Чудеса Веры не имеют единой точки активации, как
//  психосилы/техночудеса; редирект неизбирательных атак в хост — требовал
//  бы различимого отдельного токена паразита ВНУТРИ хоста, которого в
//  текущей модели слияния нет.
//
//  Опарыш-Паразит/Maggot Parasite (wdbc-1rno) использует ТОЛЬКО механику
//  контакта/захвата этого Трейта — его собственный текст переопределяет
//  финал (полное безвозвратное поглощение тела, не «хост в полусознании» —
//  см. module/apps/maggot-parasite.mjs), поэтому числовая фьюжн-часть ниже
//  для него не применяется вовсе.
//
//  Чистый модуль: ни одного обращения к Foundry на верхнем уровне.
// ════════════════════════════════════════════════════════════════════════

export const PARASITE_TRAIT_CAPABILITY = "trait.parasite";

/** Урон при срыве паразита — 1d5 непоглощаемого Rending в торс (книга). */
export const TORN_OFF_DAMAGE_FORMULA = "1d5";

const SCOPE = "warhammer-dbc";
export const PARASITIC_CONTACT_SOURCE_FLAG = "parasiticContactSourceUuid";
export const POSSESSED_BY_PARASITE_FLAG = "possessedByParasiteUuid";

/** UUID паразита, что держит контакт с этим актором прямо сейчас (стадия заражения, ещё не завершено). */
export function parasiticContactSourceUuid(actor) {
  return actor?.getFlag?.(SCOPE, PARASITIC_CONTACT_SOURCE_FLAG)
    ?? actor?.flags?.[SCOPE]?.[PARASITIC_CONTACT_SOURCE_FLAG] ?? null;
}

/** UUID паразита, что ЗАВЕРШИЛ заражение и полностью контролирует этого актора (фьюжн уже идёт). */
export function possessingParasiteUuid(actor) {
  return actor?.getFlag?.(SCOPE, POSSESSED_BY_PARASITE_FLAG)
    ?? actor?.flags?.[SCOPE]?.[POSSESSED_BY_PARASITE_FLAG] ?? null;
}

/** Контролируется ли actor паразитом прямо сейчас (заражение УЖЕ завершено, не стадия контакта). */
export function isPossessedByParasite(actor) {
  return !!possessingParasiteUuid(actor);
}

/**
 * Числовая часть слияния — «действует в Инициативу паразита и использует
 * его I, P и W, а если его WS или BS ниже, чем у паразита — то также и их».
 * I — Интеллект, не Инициатива: книга пишет Характеристики как «WS, BS, S,
 * T, A, I, P, W, F», а Инициатива названа в той же фразе отдельно.
 *
 * Разбито на две точки (wdbc-bjy1.4): Характеристики подставляются ВНУТРИ
 * цикла характеристик module/rules/character.mjs — сразу после вывода
 * Бонуса, до Навыков, Здравомыслия, Усталости и прочего, что считается от
 * .total/.bonus; раньше подмена шла в хвосте пересчёта, и всё производное
 * оставалось хозяйским. Инициатива — в хвосте (applyParasiteFusion), после
 * prepareFinalPools, иначе её перезапишут.
 *
 * typeof game/fromUuidSync — тот же честный guard, что у
 * rules/wrapped-in-chaos.mjs::realityRendingPenalty: character.mjs обязан
 * остаться безопасным на «голых» объектах без стаба.
 */
export function fusedParasite(actor) {
  if (typeof fromUuidSync === "undefined") return null;
  const parasiteUuid = possessingParasiteUuid(actor);
  if (!parasiteUuid) return null;
  try { return fromUuidSync(parasiteUuid) ?? null; } catch { return null; }
}

/** Характеристики, которые хост берёт у паразита целиком / только если у паразита выше. */
const FUSED_ALWAYS = new Set(["int", "per", "wp"]);
const FUSED_IF_HIGHER = new Set(["ws", "bs"]);

/**
 * Подставляет Характеристику паразита в char хоста (число и Бонус вместе —
 * Бонус паразита уже несёт его Unnatural). Правит на месте; true — если
 * подставлено (вызывающий код переписывает разборку Итого).
 */
export function fuseParasiteCharacteristic(key, char, pChar) {
  if (!char || !pChar) return false;
  const pTotal = Number(pChar.total) || 0;
  const take = FUSED_ALWAYS.has(key) || (FUSED_IF_HIGHER.has(key) && pTotal > (Number(char.total) || 0));
  if (!take) return false;
  char.total = pTotal;
  char.bonus = Number(pChar.bonus ?? Math.floor(pTotal / 10)) || 0;
  return true;
}

/** Хвост пересчёта: Инициатива паразита. Характеристики — fuseParasiteCharacteristic. */
export function applyParasiteFusion(actor, system) {
  const parasite = fusedParasite(actor);
  if (!parasite) return;
  system.initiative = Number(parasite.system?.initiative) || 0;
}

/**
 * Пересчитать хостов, слитых с этим паразитом (wdbc-bjy1.14). Хост берёт
 * Характеристики и Инициативу паразита в своём prepareDerivedData, а
 * обновление ТОЛЬКО паразита (урон характеристике, эффект, предмет) пересчёт
 * хоста не запускает — хост держал старые числа до своего следующего
 * обновления. Зовётся из хуков updateActor/…Item/…ActiveEffect паразита на
 * КАЖДОМ клиенте: производные данные локальны, писать в базу нечего.
 * Хосты — мировые акторы и акторы токенов сцены (несвязанный токен несёт свой
 * флаг в дельте). Возвращает число пересчитанных.
 */
export function refreshParasiteHosts(parasite) {
  const uuid = parasite?.uuid;
  if (!uuid || typeof game === "undefined") return 0;
  const candidates = new Set([
    ...(game.actors ?? []),
    ...((typeof canvas !== "undefined" && canvas?.tokens?.placeables) || []).map(t => t?.actor).filter(Boolean)
  ]);
  let n = 0;
  for (const host of candidates) {
    if (possessingParasiteUuid(host) !== uuid) continue;
    host.reset?.();
    if (host.sheet?.rendered) host.sheet.render(false);
    n++;
  }
  return n;
}
