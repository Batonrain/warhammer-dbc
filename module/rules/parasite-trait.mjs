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
//  завершает заражение) и числовая часть слияния — Инициатива/P/W-
//  характеристики, лучший из WS/BS (module/rules/character.mjs), блок
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
 * Живой пересчёт (module/rules/character.mjs, самый хвост
 * prepareCharacterDerived — ПОСЛЕ того, как обычные Инициатива/Характеристики
 * уже посчитаны, иначе перезаписывать было бы нечего): actor/system/chars
 * правятся НА МЕСТЕ, ничего не возвращает. typeof game/fromUuidSync — тот
 * же честный guard, что у rules/wrapped-in-chaos.mjs::realityRendingPenalty —
 * character.mjs обязан остаться безопасным на «голых» объектах без стаба.
 * Навыки/Таланты/блок Чудес Веры и Warp-Gifted — см. заголовок файла.
 */
export function applyParasiteFusion(actor, system, chars) {
  if (typeof game === "undefined" || typeof fromUuidSync === "undefined") return;
  const parasiteUuid = possessingParasiteUuid(actor);
  if (!parasiteUuid) return;
  let parasite;
  try { parasite = fromUuidSync(parasiteUuid); } catch { parasite = null; }
  if (!parasite) return;

  const pChars = parasite.system?.characteristics ?? {};
  system.initiative = Number(parasite.system?.initiative) || 0;
  if (chars.per) chars.per.total = Number(pChars.per?.total) || 0;
  if (chars.wp)  chars.wp.total  = Number(pChars.wp?.total)  || 0;
  if (chars.ws)  chars.ws.total  = Math.max(Number(chars.ws?.total) || 0, Number(pChars.ws?.total) || 0);
  if (chars.bs)  chars.bs.total  = Math.max(Number(chars.bs?.total) || 0, Number(pChars.bs?.total) || 0);
}
