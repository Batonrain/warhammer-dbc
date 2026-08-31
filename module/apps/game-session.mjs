// module/apps/game-session.mjs
// ════════════════════════════════════════════════════════════════════════
//  Игровая Сессия / Сцена — общая для стола хронология поверх календаря.
//  Действия (triggerNewScene/triggerSessionEnd) вызываются кнопками,
//  встроенными прямо в тело виджета «Летоисчисление»
//  (см. module/apps/imperial-calendar.mjs) — виден только ГМ, две кнопки:
//    🎬 Новая сцена   — откатывает разовые-за-СЦЕНУ эффекты
//                        (flags.warhammer-dbc.usageLimit.scope === "scene").
//    ⏻ Конец сессии   — откатывает разовые-за-СЕССИЮ эффекты
//                        (scope === "session") и восполняет пул
//                        Очков Судьбы/Бесчестия (system.fate.value = .max,
//                        плюс system.dp.ip у Демон-Принца).
//  Оба клика — публичное чат-сообщение и 3-секундная надпись на экране
//  у ВСЕХ клиентов (сокет-бродкаст поверх общего канала "system.warhammer-dbc",
//  тот же, что уже используется для остальной системы — см. warhammer-dbc.mjs).
//
//  Метка «разово за сцену/сессию» (flags.warhammer-dbc.usageLimit =
//  {scope:"scene"|"session", used:bool}) — общий примитив для ПРЕДМЕТОВ: эта
//  панель откатывает used→false по scope у всего, что такую метку носит.
//  У возможностей из реестра правил предмета-носителя нет, поэтому у них своя
//  метка на самом акторе — flags.warhammer-dbc.usageLimits.<возможность>,
//  см. isRuleUsageUsed/markRuleUsageUsed ниже. Ею живёт «Абсолютная вера в
//  прошлое» (Мир-кладбище): один раз за столкновение.
//
//  Все четыре формы «разово» (round/battle/scene/session) — тонкие обёртки
//  этого файла над module/rules/cooldown.mjs (wdbc-f4jt): там единая метка
//  usageLimits.<key> и чтение/запись ОДНОЙ записи, здесь остаётся то, что
//  реально Foundry-тяжёлое и специфично для этой панели — массовый скан всех
//  актёров/предметов по кнопке (resetUsageLimit), сами кнопки, чат-баннеры и
//  восполнение пулов Судьбы/Бесчестия. Имена и поведение экспортов здесь
//  сохранены ради существующих вызывающих мест — новый код пусть берёт
//  cooldown.mjs напрямую.
// ════════════════════════════════════════════════════════════════════════

import {
  isCapabilityAvailable, markCapabilityUsed,
  isRuleUsageUsed as cooldownIsRuleUsageUsed, markRuleUsageUsed as cooldownMarkRuleUsageUsed
} from "../rules/cooldown.mjs";

const BANNER_TEXT = {
  scene:   "Поворот судьбы",
  session: "Боги отворачивают взор"
};

function bannerCard(title, text) {
  return `<div class="wh-sess-chat-card">
      <div class="wh-sess-chat-title">${title}</div>
      <div class="wh-sess-chat-text">${text}</div>
    </div>`;
}

/**
 * Показать 3-секундную надпись поверх экрана (локально на этом клиенте).
 * `fontFamily` — необязательный CSS font-family stack, переопределяет
 * дефолтный Oswald только у ЭТОГО баннера (используется календарём — свой
 * шрифт титра, см. imperial-calendar.mjs); Сессия/Сцена его не передают и
 * остаются на дефолтном шрифте.
 */
export function showFateTurnBanner(text, { fontFamily } = {}) {
  try {
    const el = document.createElement("div");
    el.className = "wh-sess-banner";
    const span = document.createElement("span");
    span.className = "wh-sess-banner-text";
    span.textContent = text; // textContent, не innerHTML — text может быть произвольным GM-вводом
    if (fontFamily) span.style.fontFamily = fontFamily;
    el.appendChild(span);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  } catch (e) { console.warn("Warhammer DBC | game-session banner", e); }
}

/** Разослать баннер всем клиентам — сокет не возвращается себе, поэтому себе показываем сразу. */
function broadcastBanner(text) {
  showFateTurnBanner(text);
  try { game.socket.emit("system.warhammer-dbc", { action: "sessionSceneBanner", text }); } catch (e) {}
}

// ── Разовые-за-сцену возможности актора ─────────────────────────────────────
// Метка usageLimit выше лежит на ПРЕДМЕТЕ, и это годится, пока у способности
// есть предмет-носитель. У возможности из реестра правил (grantFlag) носителя
// нет: правило приходит от Происхождения, расы или книги, а не от предмета.
// Поэтому вторая, такая же по смыслу метка живёт на самом акторе и ключуется
// именем возможности — см. заголовок файла, тонкая обёртка над cooldown.mjs.

/** Израсходована ли разовая возможность актора в текущем scope. */
export function isRuleUsageUsed(actor, flag) {
  return cooldownIsRuleUsageUsed(actor, flag);
}

/** Отметить разовую возможность актора израсходованной до конца сцены/сессии. */
export async function markRuleUsageUsed(actor, flag, scope = "scene") {
  return cooldownMarkRuleUsageUsed(actor, flag, scope);
}

// ── Разовые-за-РАУНД возможности актора ─────────────────────────────────────
// См. заголовок файла — обёртки над module/rules/cooldown.mjs (unit="round").

/** Доступна ли Раз-в-Раунд возможность актора в текущем Раунде боя. */
export function isRoundCapabilityAvailable(actor, flag) {
  return isCapabilityAvailable(actor, flag, "round");
}

/** Отметить Раз-в-Раунд возможность актора потраченной в текущем Раунде. */
export async function markRoundCapabilityUsed(actor, flag) {
  return markCapabilityUsed(actor, flag, "round");
}

/**
 * Сбросить разовые-за-scope эффекты: метки usageLimit у предметов и метки
 * usageLimits возможностей у самих акторов.
 */
async function resetUsageLimit(scope) {
  let n = 0;
  for (const actor of game.actors) {
    const updates = [];
    for (const it of actor.items) {
      const ul = it.getFlag("warhammer-dbc", "usageLimit");
      if (ul?.scope === scope && ul?.used) updates.push({ _id: it.id, "flags.warhammer-dbc.usageLimit.used": false });
    }
    if (updates.length) {
      await actor.updateEmbeddedDocuments("Item", updates);
      n += updates.length;
    }
    const limits = actor.getFlag("warhammer-dbc", "usageLimits") || {};
    const actorUpd = {};
    for (const [key, ul] of Object.entries(limits)) {
      if (ul?.scope === scope && ul?.used) actorUpd[`flags.warhammer-dbc.usageLimits.${key}.used`] = false;
    }
    if (Object.keys(actorUpd).length) {
      await actor.update(actorUpd);
      n += Object.keys(actorUpd).length;
    }
  }
  return n;
}

/** Восполнить Очки Судьбы/Бесчестия всем акторам (system.fate + Демон-Принц system.dp.ip). */
async function refillFatePools() {
  for (const actor of game.actors) {
    const upd = {};
    const max = Number(actor.system.fate?.max);
    if (Number.isFinite(max) && max > 0) upd["system.fate.value"] = max;
    if (actor.type === "demonPrince") {
      upd["system.dp.ip"] = Math.max(0, Number(actor.system.characteristics?.inf?.bonus) || 0);
    }
    if (Object.keys(upd).length) await actor.update(upd);
  }
}

export async function triggerNewScene() {
  if (!game.user.isGM) return;
  await resetUsageLimit("scene");
  await ChatMessage.create({
    speaker: { alias: "Мастер Игры" },
    content: bannerCard("🎬 Новая сцена", BANNER_TEXT.scene)
  });
  broadcastBanner(BANNER_TEXT.scene);
}

export async function triggerSessionEnd() {
  if (!game.user.isGM) return;
  // Конец сессии подразумевает и конец текущей сцены — откатываем то же,
  // что triggerNewScene(), но БЕЗ её собственного чата/баннера («Поворот
  // судьбы»): игроки увидят только одно объявление — про конец сессии.
  await resetUsageLimit("scene");
  await resetUsageLimit("session");
  await refillFatePools();
  await ChatMessage.create({
    speaker: { alias: "Мастер Игры" },
    content: bannerCard("⏻ Конец сессии", BANNER_TEXT.session)
  });
  broadcastBanner(BANNER_TEXT.session);
}
