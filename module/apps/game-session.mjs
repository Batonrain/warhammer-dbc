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
//  {scope:"scene"|"session", used:bool}) — общий, ещё не подключённый ни к
//  одному конкретному предмету примитив: эта панель лишь ОТКАТЫВАЕТ used→false
//  по scope у всего, что когда-нибудь такую метку получит (будущая фича —
//  где именно её проставлять, ещё не решено).
// ════════════════════════════════════════════════════════════════════════

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

/** Показать 3-секундную надпись поверх экрана (локально на этом клиенте). */
export function showFateTurnBanner(text) {
  try {
    const el = document.createElement("div");
    el.className = "wh-sess-banner";
    el.innerHTML = `<span class="wh-sess-banner-text">${text}</span>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  } catch (e) { console.warn("Warhammer DBC | game-session banner", e); }
}

/** Разослать баннер всем клиентам — сокет не возвращается себе, поэтому себе показываем сразу. */
function broadcastBanner(text) {
  showFateTurnBanner(text);
  try { game.socket.emit("system.warhammer-dbc", { action: "sessionSceneBanner", text }); } catch (e) {}
}

/** Сбросить разовые-за-scope эффекты (usageLimit.used) у всех предметов на всех акторах мира. */
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
