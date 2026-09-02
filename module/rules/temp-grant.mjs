// module/rules/temp-grant.mjs
// ════════════════════════════════════════════════════════════════════════
//  Временная выдача предмета (Черта/Талант и т.п.) с автоматическим снятием
//  по истечении срока — общая инфраструктура для «активируемых» Мутаций/
//  Даров, чей эффект длится ОГРАНИЧЕННОЕ время (Cor.b минут / Cor.b Раундов
//  и т.п.), а не «до конца боя» (для этого случая уже есть готовый
//  прецедент — combat/song-of-swiftness.mjs::clearSongOfSwiftnessBuffs,
//  Hooks.on("deleteCombat")). wdbc-1rno.
//
//  Метка живёт НА САМОМ СОЗДАННОМ ПРЕДМЕТЕ (flags.warhammer-dbc.tempGrant),
//  не в отдельном списке id на акторе (как TRAIT_FLAG у
//  song-of-swiftness.mjs — тому нужен был отдельный список, т.к. один вызов
//  выдаёт бонус СРАЗУ НЕСКОЛЬКИМ акторам; здесь выдача всегда себе, и
//  предмет самодостаточен — снять предмет значит снять метку).
//
//  Две валюты длительности, потому что книга сама их не смешивает —
//  «Cor.b минут» (Трансформация Тумана) и «Cor.b Раундов» (Пространственная
//  Нестабильность) считаются по-разному:
//   - "worldTime" — снимается по live game.time.worldTime (минуты/часы),
//     проверяется на updateWorldTime И на updateCombat (бой почти всегда
//     тоже двигает worldTime через трекер).
//   - "round" — снимается по live game.combat.round текущего боя,
//     ПРИВЯЗАН к конкретному id боя: другой бой или бой уже закончился —
//     раундами мерить больше нечем, считается истёкшим сразу.
//
//  Скрипты Механики (kind:"script") не умеют импортировать модули —
//  executeItemCode даёт только item/actor/token/speaker/game/ui/ChatMessage/
//  event (apps/item-script.mjs). Поэтому САМА МЕТКА собирается вручную
//  прямо в коде записи (те же имена полей, что ниже) — этот модуль
//  импортируется только со стороны чтения (hooks.mjs), не со стороны записи.
// ════════════════════════════════════════════════════════════════════════

/**
 * Истекла ли метка temp-grant ПРЯМО СЕЙЧАС. Чистая функция — worldTime/
 * combat приходят снаружи (тот же приём, что у rules/cooldown.mjs::
 * worldTimeRemaining), никаких обращений к game.* самой.
 *
 * @param {?object} tempGrant  flags.warhammer-dbc.tempGrant предмета
 * @param {{worldTime?: number, combat?: ?{id: string, round: number}}} ctx
 */
export function isTempGrantExpired(tempGrant, { worldTime, combat } = {}) {
  if (!tempGrant) return false;
  if (tempGrant.unit === "worldTime") return Number(worldTime) >= Number(tempGrant.expiresAt);
  if (tempGrant.unit === "round") {
    // Нет боя, или бой уже другой (сменился/пересоздан) — раундами мерить
    // нечем, temp-grant считается истёкшим (та же логика, что «battle»-
    // семья cooldown.mjs: пропавший ориентир не продлевает возможность).
    if (!combat || combat.id !== tempGrant.combatId) return true;
    return Number(combat.round) > Number(tempGrant.expiresAtRound);
  }
  return false;
}

/** Предметы актора с ИСТЁКШЕЙ прямо сейчас меткой temp-grant. */
export function expiredTempGrantItems(items, ctx) {
  return (items ?? []).filter(i => isTempGrantExpired(i.flags?.["warhammer-dbc"]?.tempGrant, ctx));
}

/**
 * Снимает истёкшие temp-grant предметы актора и оповещает в чат. Звать из
 * Hooks (module/hooks.mjs) на updateWorldTime/updateCombat — сам хук решает,
 * по каким акторам пройтись (см. шапку файла и hooks.mjs).
 */
export async function clearExpiredTempGrants(actor, ctx) {
  const expired = expiredTempGrantItems(actor?.items, ctx);
  if (!expired.length) return;
  await actor.deleteEmbeddedDocuments("Item", expired.map(i => i.id));
  const names = expired.map(i => i.flags?.["warhammer-dbc"]?.tempGrant?.label || i.name).join(", ");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result"><div class="roll-header">⏳ Истёк срок действия</div><div class="roll-threshold">${names}</div></div>`
  }, game.settings.get("core", "rollMode")));
}
