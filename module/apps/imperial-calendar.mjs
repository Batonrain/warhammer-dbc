// module/apps/imperial-calendar.mjs
// ════════════════════════════════════════════════════════════════════════
//  Виджет «Имперская дата» — по образцу module/apps/environment.mjs:
//  постоянная свёртываемая панель на экране (видят все), перетаскивается,
//  позиция/свёрнутость — на клиенте (localStorage). Источник времени —
//  game.time.worldTime: прокрутка идёт через game.time.advance(), поэтому
//  Duration (Seconds) у ActiveEffect считается от того же самого счётчика
//  без отдельной интеграции — Foundry уже проверяет её по worldTime.
//
//  Настройки (эпоха/деления суток/контрольный номер) — в игровых Settings
//  системы (scope:"world", config:false, своя форма через Dialog) — правит
//  только GM, прокрутка тоже только GM.
// ════════════════════════════════════════════════════════════════════════

import { formatImperialDateParts, formatClock, currentEnabledPhases, DEFAULT_CALENDAR_CONFIG, WATCH_PRESETS,
  checkDigitTooltip, DATE_PART_TOOLTIPS, watchPresetRegistry, formatDuration, visibleFutureEvents,
  SECONDS_PER_HOUR, SECONDS_PER_YEAR, SECONDS_PER_FRACTION_UNIT, imperialToWorldTime,
  SCREEN_FONT_PRESETS, screenFontStack }
  from "../constants/imperial-calendar.mjs";
import { triggerNewScene, triggerSessionEnd, showFateTurnBanner } from "./game-session.mjs";
import { esc } from "../helpers/utils.mjs";
import { filePicker } from "../sheets/v2-helpers.mjs";

// ── Авто-течение времени (Старт/Пауза + множитель скорости) ────────────────
// Состояние — мировая настройка {running, speed}, правит только ГМ. Тикает
// РЕАЛЬНЫМ таймером в клиенте ГМа (game.time.advance доступен только ГМу),
// каждые TIME_FLOW_TICK_MS реальных мс продвигая worldTime на прошедшее
// реальное время × speed. Хук updateWorldTime (уже подключён ниже, см.
// warhammer-dbc.mjs) сам перерисовывает виджет всем клиентам при каждом
// продвижении — отдельного бродкаста не нужно.

const TIME_FLOW_TICK_MS = 2000;
let _timeFlowLastTs = null;   // Date.now() последнего тика — null, когда не бежит (сброс копит с нуля при следующем Старте)

/** Текущее состояние авто-течения: {running, speed}. speed — множитель к реальному времени (1 = как в жизни). */
export function timeFlowState() {
  try {
    const s = game.settings.get("warhammer-dbc", "timeFlow");
    const speed = Number(s?.speed);
    return { running: !!s?.running, speed: Number.isFinite(speed) && speed > 0 ? speed : 1 };
  } catch (e) { return { running: false, speed: 1 }; }
}

async function _setTimeFlowState(patch) {
  if (!game.user.isGM) return;
  await game.settings.set("warhammer-dbc", "timeFlow", { ...timeFlowState(), ...patch });
}

async function _timeFlowTick() {
  if (!game.user.isGM) return;
  const state = timeFlowState();
  if (!state.running) { _timeFlowLastTs = null; return; }
  const now = Date.now();
  if (_timeFlowLastTs == null) { _timeFlowLastTs = now; return; }   // первый тик после Старта — не прыгаем, просто засекаем момент
  const realElapsedSec = (now - _timeFlowLastTs) / 1000;
  _timeFlowLastTs = now;
  const gameSeconds = realElapsedSec * state.speed;
  if (gameSeconds > 0) await game.time.advance(gameSeconds);
}

/** Запускает таймер авто-течения — вызывается один раз при готовности мира. */
export function initTimeFlow() {
  setInterval(() => { _timeFlowTick().catch(e => console.warn("Warhammer DBC | time flow tick", e)); }, TIME_FLOW_TICK_MS);
}

/** Текущая сохранённая конфигурация календаря (с подстраховкой на дефолт). */
export function calendarConfig() {
  try {
    const stored = game.settings.get("warhammer-dbc", "imperialCalendar");
    return {
      ...DEFAULT_CALENDAR_CONFIG, ...stored,
      enabledPresets: stored?.enabledPresets?.length ? stored.enabledPresets : DEFAULT_CALENDAR_CONFIG.enabledPresets,
      customPresets: stored?.customPresets ?? DEFAULT_CALENDAR_CONFIG.customPresets,
      presetOverrides: stored?.presetOverrides ?? DEFAULT_CALENDAR_CONFIG.presetOverrides,
      watchTriggers: stored?.watchTriggers ?? DEFAULT_CALENDAR_CONFIG.watchTriggers,
      events: stored?.events ?? DEFAULT_CALENDAR_CONFIG.events,
      eventsShownCount: Number.isFinite(stored?.eventsShownCount) ? stored.eventsShownCount : DEFAULT_CALENDAR_CONFIG.eventsShownCount,
      screenMessageFont: stored?.screenMessageFont ?? DEFAULT_CALENDAR_CONFIG.screenMessageFont
    };
  } catch (e) { return DEFAULT_CALENDAR_CONFIG; }
}

// Фиксированный шаг (год/день) — просто ±1 клетка.
const ADVANCE_STEPS = [
  { key: "year",  label: "год",   secs: 365 * 86400 },
  { key: "day",   label: "день",  secs: 86400 }
];

// Произвольный шаг (часы/минуты) — число берётся из поля рядом с кнопкой,
// по умолчанию 1, но GM может вписать любое целое.
const EDITABLE_STEPS = [
  { key: "hour",   label: "ч",   secs: 3600 },
  { key: "minute", label: "мин", secs: 60 }
];

function _widgetHTML() {
  const cfg = calendarConfig();
  const worldTime = game.time?.worldTime ?? 0;
  const dateParts = formatImperialDateParts(worldTime, cfg);
  // Основные часы:минуты — живьём из worldTime (не через сегменты
  // HOURS24_WATCHES, у тех подпись фиксирована на "HH:00" и не покажет
  // минуты — см. formatClock).
  const clockStr = formatClock(worldTime);
  const phases = currentEnabledPhases(worldTime, cfg);
  const isGM = game.user.isGM;
  // ГМ видит и скрытые от игроков События (с замком) — остальным только видимые.
  const events = visibleFutureEvents(worldTime, cfg, { isGM });

  const flow = timeFlowState();
  const controls = isGM ? `<div class="wh-cal-w-controls wh-cal-w-flow-row">
    <button type="button" class="wh-cal-w-flow-btn${flow.running ? " running" : ""}" data-flow-toggle
      title="${flow.running ? "Поставить время на паузу" : "Запустить автоматическое течение времени"}">
      ${flow.running ? "⏸ Пауза" : "▶ Старт"}
    </button>
    <span class="wh-cal-w-flow-speed-lbl">×</span>
    <input type="number" class="wh-cal-w-flow-speed" data-flow-speed value="${flow.speed}" min="0.01" step="0.5"
      title="Множитель скорости течения времени (1 = реальное время)"/>
  </div>
  <div class="wh-cal-w-controls">
    ${ADVANCE_STEPS.map(s => `
      <span class="wh-cal-w-step">
        <button type="button" class="wh-cal-w-btn" data-advance="-${s.secs}" title="−1 ${esc(s.label)}">−</button>
        <span class="wh-cal-w-step-lbl">${esc(s.label)}</span>
        <button type="button" class="wh-cal-w-btn" data-advance="${s.secs}" title="+1 ${esc(s.label)}">+</button>
      </span>`).join("")}
  </div>
  <div class="wh-cal-w-controls wh-cal-w-controls-editable">
    ${EDITABLE_STEPS.map(s => `
      <span class="wh-cal-w-step wh-cal-w-step-editable">
        <button type="button" class="wh-cal-w-btn" data-edit-unit="${s.key}" data-dir="-1" title="−N ${esc(s.label)}">−</button>
        <input type="number" class="wh-cal-w-step-input" data-edit-input="${s.key}" value="1" step="1"/>
        <span class="wh-cal-w-step-lbl">${esc(s.label)}</span>
        <button type="button" class="wh-cal-w-btn" data-edit-unit="${s.key}" data-dir="1" title="+N ${esc(s.label)}">+</button>
      </span>`).join("")}
  </div>
  <div class="wh-cal-w-controls wh-cal-w-session-row">
    <button type="button" class="wh-cal-w-session-btn" data-session-act="scene" title="Новая сцена — откатить разовые-за-сцену эффекты">🎬 Сцена</button>
    <button type="button" class="wh-cal-w-session-btn" data-session-act="session" title="Конец сессии — откатить разовые-за-сессию эффекты, восполнить Судьбу/Бесчестие">⏻ Сессия</button>
  </div>` : "";

  // Заголовок под датой: если GM включил хотя бы одно обозначение вахт
  // (по умолчанию — Каликсида, стр. настроек), первое идёт крупной подписью
  // прямо под датой (макетный «средняя вахта»); остальные включённые сразу —
  // мелкими строками ниже, как и раньше (функциональность не теряем).
  const [primaryPhase, ...extraPhases] = phases;
  const dateNote = primaryPhase
    ? `<span class="wh-cal-w-note-ic">${esc(primaryPhase.watch.icon || "")}</span>${esc(primaryPhase.watch.label)}`
    : "место для дополнительного летоисчисления";

  return `<div class="wh-cal-w-head">
      <span class="wh-cal-w-led"></span>
      <span class="wh-cal-w-title">ЛЕТОИСЧИСЛЕНИЕ</span>
      ${isGM ? `<span class="wh-cal-w-settings" title="Настройки календаря">⚙</span>` : ""}
      <span class="wh-cal-w-collapse" title="Свернуть/развернуть">▾</span>
    </div>
    <div class="wh-cal-w-body">
      <div class="wh-cal-w-date">
        <span class="wh-cal-w-date-part" title="${esc(checkDigitTooltip())}">${esc(dateParts.digit)}</span
        ><span class="wh-cal-w-date-dot">.</span
        ><span class="wh-cal-w-date-part" title="${esc(DATE_PART_TOOLTIPS.fraction)}">${esc(dateParts.fraction)}</span
        ><span class="wh-cal-w-date-dot">.</span
        ><span class="wh-cal-w-date-part" title="${esc(DATE_PART_TOOLTIPS.year)}">${esc(dateParts.year)}</span
        ><span class="wh-cal-w-date-dot">.</span
        ><span class="wh-cal-w-date-part" title="${esc(DATE_PART_TOOLTIPS.millennium)}">${esc(dateParts.millennium)}</span>
      </div>
      <div class="wh-cal-w-note"${primaryPhase ? ` title="${esc(primaryPhase.label)}${primaryPhase.description ? " — " + esc(primaryPhase.description) : ""}"` : ""}>${dateNote}</div>
      <div class="wh-cal-w-clock">${esc(clockStr)}</div>
      ${extraPhases.map(p => `
      <div class="wh-cal-w-watch wh-cal-w-watch-secondary" title="${esc(p.label)}${p.description ? " — " + esc(p.description) : ""}">
        <span class="wh-cal-w-watch-ic">${esc(p.watch.icon || "")}</span><span class="wh-cal-w-watch-lbl">${esc(p.watch.label)}</span>
      </div>`).join("")}
      ${events.length ? `<div class="wh-cal-w-events">
        ${events.map(ev => {
          const tip = ev.description ? esc(ev.description) : "";
          const lock = !ev.visibleToPlayers ? "🔒 " : "";
          return `<div class="wh-cal-w-event"${tip ? ` title="${tip}"` : ""}>
            <span class="wh-cal-w-event-ic">⏳</span>
            <span class="wh-cal-w-event-title">${lock}${esc(ev.title)}</span>
            <span class="wh-cal-w-event-eta">через ${esc(formatDuration(ev.targetWorldTime - worldTime))}</span>
          </div>`;
        }).join("")}
      </div>` : ""}
      ${controls}
    </div>`;
}

function _applyCalPos(el) {
  let pos = null;
  try { pos = JSON.parse(localStorage.getItem("wh-cal-pos") || "null"); } catch (e) {}
  if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
    el.style.left = `${pos.left}px`; el.style.top = `${pos.top}px`;
  } else {
    el.style.left = "232px";
    el.style.top  = "10px";
  }
  el.style.right = "auto"; el.style.bottom = "auto";
}

function _wireCalDrag(el) {
  const head = el.querySelector(".wh-cal-w-head");
  if (!head) return;
  head.addEventListener("mousedown", ev => {
    if (ev.target.closest(".wh-cal-w-collapse, .wh-cal-w-settings")) return;
    ev.preventDefault();
    const r = el.getBoundingClientRect();
    const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
    el.classList.add("dragging");
    const move = e => {
      const left = Math.max(0, Math.min(window.innerWidth  - 40, e.clientX - dx));
      const top  = Math.max(0, Math.min(window.innerHeight - 24, e.clientY - dy));
      el.style.left = `${left}px`; el.style.top = `${top}px`;
      el.style.right = "auto"; el.style.bottom = "auto";
    };
    const up = () => {
      el.classList.remove("dragging");
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      try { localStorage.setItem("wh-cal-pos", JSON.stringify({ left: parseFloat(el.style.left), top: parseFloat(el.style.top) })); } catch (e) {}
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  });
}

// ══════════════════ ТРИГГЕРЫ НА СМЕНУ ДЕЛЕНИЯ (звук/чат/титр) ══════════════════
// Стреляет ровно один раз на весь стол — на клиенте текущего активного ГМ
// (тот же приём "применяет ровно один клиент", что и в сокет-обработчике
// warhammer-dbc.mjs, см. game.users.activeGM). Состояние — модульная
// переменная (не настройка): переживает только текущую вкладку; при
// перезагрузке заново инициализируется БЕЗ выстрела на уже активном делении
// (иначе F5 спамил бы всем триггер уже идущего деления при каждом входе).
let _lastWatchByPreset = {};
let _lastWatchInit = false;

function _isPrimaryGM() {
  return !!game.users.activeGM && game.user.id === game.users.activeGM.id;
}

// Три действия триггера разнесены по отдельным функциям — их же, с теми же
// сигнатурами, зовут кнопки «▶» в настройках (openCalendarSettings), только
// БЕЗ бродкаста (звук — локально, титр — локально без сокета, чат — шёпотом
// только себе), чтобы GM мог проверить содержимое, не спамя стол.

/** Проиграть звук триггера. broadcast=true — всем клиентам (реальный триггер), false — только у себя (кнопка «▶ Тест»). */
function _playTriggerSound(src, broadcast) {
  if (!src) return;
  try {
    const AH = foundry.audio?.AudioHelper || globalThis.AudioHelper;
    const opts = { src, volume: 0.8, autoplay: true, loop: false };
    if (broadcast) AH.play(opts, true); else AH.play(opts);
  } catch (e) { console.warn("warhammer-dbc | imperial calendar watch sound", e); }
}

/** Отправить карточку в чат. whisperOnly=true — шёпотом только себе (кнопка «▶ Тест»), иначе публично всем (реальный триггер). */
function _postTriggerChat(icon, label, text, whisperOnly) {
  if (!text) return;
  ChatMessage.create({
    speaker: { alias: whisperOnly ? "Летоисчисление (тест)" : "Летоисчисление" },
    whisper: whisperOnly ? [game.user.id] : [],
    content: `<div class="wh-sess-chat-card">
      <div class="wh-sess-chat-title">${esc(icon || "")} ${esc(label || "")}</div>
      <div class="wh-sess-chat-text">${esc(text)}</div>
    </div>`
  }).catch(e => console.warn("warhammer-dbc | imperial calendar watch chat", e));
}

/** Показать титр по центру экрана. broadcast=true — всем клиентам (реальный триггер), false — только у себя (кнопка «▶ Тест»). */
function _showTriggerScreen(text, fontKey, broadcast) {
  if (!text) return;
  const fontFamily = screenFontStack(fontKey);
  showFateTurnBanner(text, { fontFamily });
  if (broadcast) {
    try { game.socket.emit("system.warhammer-dbc", { action: "sessionSceneBanner", text, fontFamily }); } catch (e) {}
  }
}

function _fireWatchTrigger(watchId, cfg, phase) {
  const trig = cfg.watchTriggers?.[watchId];
  if (!trig) return;
  _playTriggerSound(trig.sound, true);
  _postTriggerChat(phase.watch.icon, phase.watch.label, trig.chatMessage, false);
  _showTriggerScreen(trig.screenMessage, cfg.screenMessageFont, true);
}

/**
 * Вызывается из хука updateWorldTime (см. warhammer-dbc.mjs) — сравнивает
 * активное деление КАЖДОГО включённого пресета с предыдущим известным и,
 * если оно сменилось, один раз выполняет триггер, настроенный для НОВОГО
 * деления. Направление смены (вперёд/назад по времени — прокрутка ГМ) не
 * важно, важен сам факт входа в другое деление.
 */
export function checkCalendarWatchTriggers(worldTime) {
  try {
    if (!_isPrimaryGM()) return;
    const cfg = calendarConfig();
    const phases = currentEnabledPhases(worldTime, cfg);
    const isFirst = !_lastWatchInit;
    _lastWatchInit = true;
    for (const p of phases) {
      const curId = p.watch?.id;
      const prevId = _lastWatchByPreset[p.key];
      _lastWatchByPreset[p.key] = curId;
      if (!isFirst && curId && curId !== prevId) _fireWatchTrigger(curId, cfg, p);
    }
  } catch (e) { console.warn("warhammer-dbc | imperial calendar watch triggers", e); }
}

export function refreshCalendarWidget() {
  try {
    let el = document.getElementById("wh-cal-widget");
    const fresh = !el;
    if (!el) {
      el = document.createElement("div");
      el.id = "wh-cal-widget";
      document.body.appendChild(el);
      if (localStorage.getItem("wh-cal-collapsed") === "1") el.classList.add("collapsed");
    }
    el.innerHTML = _widgetHTML();
    if (fresh) _applyCalPos(el);
    _wireCalDrag(el);

    el.querySelector(".wh-cal-w-collapse")?.addEventListener("click", ev => {
      ev.stopPropagation();
      const c = el.classList.toggle("collapsed");
      try { localStorage.setItem("wh-cal-collapsed", c ? "1" : "0"); } catch (e) {}
    });
    el.querySelector(".wh-cal-w-settings")?.addEventListener("click", ev => {
      ev.stopPropagation();
      openCalendarSettings();
    });
    el.querySelectorAll(".wh-cal-w-btn[data-advance]").forEach(btn => btn.addEventListener("click", async ev => {
      ev.stopPropagation();
      if (!game.user.isGM) return;
      const delta = Number(ev.currentTarget.dataset.advance) || 0;
      if (delta) await game.time.advance(delta);
    }));
    el.querySelectorAll(".wh-cal-w-btn[data-edit-unit]").forEach(btn => btn.addEventListener("click", async ev => {
      ev.stopPropagation();
      if (!game.user.isGM) return;
      const unit = ev.currentTarget.dataset.editUnit;
      const dir = Number(ev.currentTarget.dataset.dir) || 1;
      const step = EDITABLE_STEPS.find(s => s.key === unit);
      if (!step) return;
      const input = el.querySelector(`[data-edit-input="${unit}"]`);
      let n = parseInt(input?.value, 10);
      if (!Number.isFinite(n)) n = 1;
      const delta = dir * n * step.secs;
      if (delta) await game.time.advance(delta);
    }));
    el.querySelectorAll(".wh-cal-w-step-input").forEach(inp => inp.addEventListener("click", ev => ev.stopPropagation()));
    el.querySelector("[data-flow-toggle]")?.addEventListener("click", async ev => {
      ev.stopPropagation();
      if (!game.user.isGM) return;
      await _setTimeFlowState({ running: !timeFlowState().running });
    });
    el.querySelector("[data-flow-speed]")?.addEventListener("click", ev => ev.stopPropagation());
    el.querySelector("[data-flow-speed]")?.addEventListener("change", async ev => {
      ev.stopPropagation();
      if (!game.user.isGM) return;
      await _setTimeFlowState({ speed: Math.max(0.01, Number(ev.currentTarget.value) || 1) });
    });
    el.querySelectorAll(".wh-cal-w-session-btn").forEach(btn => btn.addEventListener("click", ev => {
      ev.stopPropagation();
      if (!game.user.isGM) return;
      const act = ev.currentTarget.dataset.sessionAct;
      if (act === "scene") triggerNewScene();
      else if (act === "session") triggerSessionEnd();
    }));
  } catch (e) { console.warn("warhammer-dbc | imperial calendar widget", e); }
}

// ══════════════════════════ НАСТРОЙКИ (диалог GM) ══════════════════════════
// Три вкладки: Эпоха (как раньше) / Деления (пресеты — снова редактируемые,
// плюс триггеры на деление) / События. Вкладки — тот же простой приём
// show/hide на <div data-tab-panel>, что уже работает в apps/callouts.mjs
// (контентный корень диалога — <div>, не <form>, поэтому DialogV2-ловушка
// с потерянным вложенным <form> тут не касается — см. doombc-foundry-v13-gotchas).

// Лёгкая строка деления — используется ТОЛЬКО в конструкторе НОВОГО своего
// пресета (ещё не существующего в реестре): триггер добавляется потом, уже
// через раскрытие созданного пресета в чек-листе.
const creatorWatchRowHTML = (w) => `
  <div class="wh-cal-watch-row" data-watch-id="${esc(w.id)}">
    <input type="text" class="wh-cal-watch-icon" value="${esc(w.icon || "")}" placeholder="иконка" maxlength="2"/>
    <input type="text" class="wh-cal-watch-label" value="${esc(w.label || "")}" placeholder="название"/>
    <input type="number" class="wh-cal-watch-hours" value="${Number.isFinite(w.hours) ? w.hours : 1}" min="0.01" step="0.01" title="Длительность, терранских часов"/>
    <button type="button" class="wh-cal-watch-remove" title="Убрать">✕</button>
  </div>`;

// Полная строка деления — используется при раскрытии УЖЕ СУЩЕСТВУЮЩЕГО
// пресета (встроенного или своего) в чек-листе: то же icon/label/hours, плюс
// 🔔 переключает мини-панель триггера (звук/чат/титр) для ЭТОГО watch.id.
const watchUnitHTML = (w, trig = {}) => {
  const hasTrigger = !!(trig.sound || trig.chatMessage || trig.screenMessage);
  return `<div class="wh-cal-watch-unit" data-watch-id="${esc(w.id)}">
    <div class="wh-cal-watch-row">
      <input type="text" class="wh-cal-watch-icon" value="${esc(w.icon || "")}" placeholder="иконка" maxlength="2"/>
      <input type="text" class="wh-cal-watch-label" value="${esc(w.label || "")}" placeholder="название"/>
      <input type="number" class="wh-cal-watch-hours" value="${Number.isFinite(w.hours) ? w.hours : 1}" min="0.01" step="0.01" title="Длительность, терранских часов"/>
      <button type="button" class="wh-cal-watch-bell${hasTrigger ? " active" : ""}" title="Триггер на это деление (звук/чат/титр)">🔔</button>
      <button type="button" class="wh-cal-watch-remove" title="Убрать">✕</button>
    </div>
    <div class="wh-cal-trigger-panel" style="display:none;">
      <div class="wh-cal-trigger-row">
        <span class="wh-cal-trigger-ic">🔊</span>
        <input type="text" class="wh-cal-trigger-sound" value="${esc(trig.sound || "")}" placeholder="звуковой файл..."/>
        <button type="button" class="wh-cal-trigger-browse">Обзор…</button>
        <button type="button" class="wh-cal-trigger-test" data-test="sound" title="Проверить звук (только у себя)">▶</button>
      </div>
      <div class="wh-cal-trigger-row">
        <span class="wh-cal-trigger-ic">💬</span>
        <input type="text" class="wh-cal-trigger-chat" value="${esc(trig.chatMessage || "")}" placeholder="сообщение в чат..."/>
        <button type="button" class="wh-cal-trigger-test" data-test="chat" title="Проверить в чате (шёпотом только себе)">▶</button>
      </div>
      <div class="wh-cal-trigger-row">
        <span class="wh-cal-trigger-ic">🖥</span>
        <input type="text" class="wh-cal-trigger-screen" value="${esc(trig.screenMessage || "")}" placeholder="титр на экран..."/>
        <button type="button" class="wh-cal-trigger-test" data-test="screen" title="Проверить титр (только у себя)">▶</button>
      </div>
    </div>
  </div>`;
};

const slugify = (s) => "custom_" + String(s || "").toLowerCase().replace(/[^a-zа-я0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 32) + "_" + Date.now().toString(36);

/** Подпись набора делений для сравнения "не изменилось ли" — порядок ключей роли не играет. */
const _watchSig = (watches) => (watches || []).map(w => `${w.id}|${w.icon || ""}|${w.label || ""}|${w.hours}`).join(";");

export async function openCalendarSettings() {
  if (!game.user.isGM) return ui.notifications?.info("Настройки календаря доступны только Мастеру.");
  const cfg = calendarConfig();

  // Состояние диалога и root — объявлены здесь (не внутри render:), потому
  // что buttons.save.callback — ОТДЕЛЬНЫЙ колбэк Dialog (не вложен в render),
  // и без общего замыкания не увидел бы ни то, ни другое.
  let root = null;
  const state = {
    customPresets: foundry.utils.deepClone(cfg.customPresets || []),
    presetOverrides: foundry.utils.deepClone(cfg.presetOverrides || {}),
    watchTriggers: foundry.utils.deepClone(cfg.watchTriggers || {}),
    events: foundry.utils.deepClone(cfg.events || []),
    expandedKey: null
  };

  // ── Снимает текущее раскрытое деление ряда обратно в state, ДО того как
  //    его перерисуют/скроют/сохранят — иначе несохранённые правки внутри
  //    раскрытого пресета терялись бы при переключении на другой ряд или Save. ──
  function commitExpandedRow() {
    const key = state.expandedKey;
    if (!key || !root) return;
    const container = root.querySelector(`.wh-cal-preset-expand[data-preset-key="${CSS.escape(key)}"]`);
    if (!container) return;
    const watches = [...container.querySelectorAll(".wh-cal-watch-unit")].map(unit => ({
      id: unit.dataset.watchId,
      icon: unit.querySelector(".wh-cal-watch-icon").value,
      label: unit.querySelector(".wh-cal-watch-label").value || "Без названия",
      hours: Math.max(0.01, Number(unit.querySelector(".wh-cal-watch-hours").value) || 1)
    }));
    const triggerPatch = {};
    for (const unit of container.querySelectorAll(".wh-cal-watch-unit")) {
      const id = unit.dataset.watchId;
      const sound = unit.querySelector(".wh-cal-trigger-sound").value.trim();
      const chatMessage = unit.querySelector(".wh-cal-trigger-chat").value.trim();
      const screenMessage = unit.querySelector(".wh-cal-trigger-screen").value.trim();
      if (sound || chatMessage || screenMessage) triggerPatch[id] = { sound, chatMessage, screenMessage };
    }
    // Триггеры отсутствующих теперь (удалённых) и очищенных делений этого
    // пресета снимаем целиком — иначе за ними осталась бы устаревшая запись.
    const originalIds = (container.dataset.originalIds || "").split(",").filter(Boolean);
    const touchedIds = new Set([...originalIds, ...watches.map(w => w.id)]);
    for (const id of touchedIds) delete state.watchTriggers[id];
    Object.assign(state.watchTriggers, triggerPatch);

    if (WATCH_PRESETS[key]) {
      const isDefault = _watchSig(watches) === _watchSig(WATCH_PRESETS[key].watches);
      if (isDefault) delete state.presetOverrides[key];
      else state.presetOverrides[key] = { watches };
    } else {
      const cp = state.customPresets.find(p => p.key === key);
      if (cp) cp.watches = watches;
    }
  }

  const content = `<div class="wh-cal-settings">
    <nav class="wh-cal-tabs">
      <a class="item active" data-tab="epoch">Эпоха</a>
      <a class="item" data-tab="divisions">Деления</a>
      <a class="item" data-tab="events">События</a>
    </nav>

    <section data-tab-panel="epoch" class="active">
      <div class="wh-cal-settings-row">
        <label>Тысячелетие эпохи (М)</label><input type="number" class="cal-epoch-mill" value="${cfg.epochMillennium}" min="1"/>
        <label>Год</label><input type="number" class="cal-epoch-year" value="${cfg.epochYear}" min="0" max="999"/>
        <label>Доля</label><input type="number" class="cal-epoch-frac" value="${cfg.epochFraction}" min="0" max="999"/>
      </div>
      <div class="wh-cal-settings-hint">Это дата, которая соответствует текущему worldTime игры прямо сейчас — т.е. «сколько сейчас», не «когда началась игра». Смена этих полей сдвигает календарь, не трогая сами часы.</div>
      <div class="wh-cal-settings-row">
        <label>Контрольный номер (0-9)</label><input type="number" class="cal-check-digit" value="${cfg.checkDigit}" min="0" max="9"/>
      </div>
    </section>

    <section data-tab-panel="divisions" style="display:none;">
      <div class="wh-cal-settings-hint">Основное деление часов (24ч) фиксировано и всегда включено — не отключается и не настраивается.</div>
      <div class="wh-cal-settings-row">
        <label>Шрифт титра на экране</label>
        <select class="wh-cal-screen-font">
          ${SCREEN_FONT_PRESETS.map(f => `<option value="${esc(f.key)}" ${cfg.screenMessageFont === f.key ? "selected" : ""}>${esc(f.label)}</option>`).join("")}
        </select>
      </div>
      <div class="wh-cal-settings-hint">Применяется ко всем титрам делений (кнопка «▶» ниже показывает превью выбранным шрифтом).</div>
      <div class="wh-cal-settings-subtitle">Обозначения рядом с часами (можно включить сразу несколько — каждое своей строкой на виджете). Разверните ▸ строку, чтобы поправить сами деления (в т.ч. заводские) и повесить на любое из них звук/чат/титр.</div>
      <div class="wh-cal-preset-checklist"></div>
      <button type="button" class="wh-cal-preset-add">➕ Создать свой пресет</button>

      <div class="wh-cal-preset-creator" style="display:none;">
        <div class="wh-cal-settings-row"><label>Название пресета</label><input type="text" class="wh-cal-preset-name" placeholder="напр. Вахты моего корабля"/></div>
        <div class="wh-cal-watch-list"></div>
        <button type="button" class="wh-cal-watch-add">➕ Добавить деление</button>
        <div class="wh-cal-settings-hint">У каждого деления — своя длительность в терранских часах (не обязательно поровну). Сумма часов задаёт длину полного цикла — для терранских суток это 24, но можно и больше/меньше.</div>
        <div class="wh-cal-settings-row">
          <button type="button" class="wh-cal-preset-save">Сохранить пресет</button>
          <button type="button" class="wh-cal-preset-cancel">Отмена</button>
        </div>
      </div>
    </section>

    <section data-tab-panel="events" style="display:none;">
      <div class="wh-cal-event-count-row">
        <span class="wh-cal-event-count-label">Показывать событий на виджете</span>
        <span class="wh-cal-event-count-stepper">
          <button type="button" class="wh-cal-event-count-btn" data-dir="-1">−</button>
          <span class="wh-cal-event-count-value">${Math.max(0, Math.min(5, Number(cfg.eventsShownCount) || 0))}</span>
          <button type="button" class="wh-cal-event-count-btn" data-dir="1">+</button>
        </span>
      </div>
      <div class="wh-cal-settings-hint">0 — строка Событий скрыта. Показываются ближайшие N из тех, что видны текущему пользователю, отсортированные по возрастанию времени (ближайшее — сверху). ГМ дополнительно видит скрытые от игроков события (со значком 🔒).</div>

      <div class="wh-cal-settings-subtitle">События</div>
      <div class="wh-cal-event-list"></div>
      <button type="button" class="wh-cal-event-add">➕ Новое событие</button>

      <div class="wh-cal-event-form" style="display:none;">
        <div class="wh-cal-settings-row"><label>Название</label><input type="text" class="wh-cal-ev-title" placeholder="напр. Прибытие флота снабжения"/></div>
        <div class="wh-cal-settings-row"><label>Краткое описание</label><input type="text" class="wh-cal-ev-desc" placeholder="Всплывает подсказкой при наведении на виджете"/></div>
        <div class="wh-cal-ev-mode-toggle">
          <div class="wh-cal-ev-mode-opt active" data-mode="relative">Обратный отсчёт</div>
          <div class="wh-cal-ev-mode-opt" data-mode="absolute">Точная дата</div>
        </div>
        <div class="wh-cal-settings-row wh-cal-ev-relative">
          <label>Через:</label>
          <span class="wh-cal-ev-unit-field"><input type="number" class="wh-cal-ev-years" value="0" min="0" step="1"/><span class="wh-cal-ev-unit-lbl">лет</span></span>
          <span class="wh-cal-ev-unit-field"><input type="number" class="wh-cal-ev-fracs" value="0" min="0" step="1"/><span class="wh-cal-ev-unit-lbl">долей года</span></span>
          <span class="wh-cal-ev-unit-field"><input type="number" class="wh-cal-ev-hours" value="8" min="0" step="1"/><span class="wh-cal-ev-unit-lbl">часов</span></span>
          <span class="wh-cal-ev-unit-field"><input type="number" class="wh-cal-ev-minutes" value="0" min="0" step="1"/><span class="wh-cal-ev-unit-lbl">минут</span></span>
        </div>
        <div class="wh-cal-settings-hint wh-cal-ev-relative">Заполняйте только нужные поля — остальные можно оставить нулём, они складываются.</div>
        <div class="wh-cal-settings-row wh-cal-ev-absolute" style="display:none;">
          <label>М</label><input type="number" class="wh-cal-ev-mill" value="${cfg.epochMillennium}" min="1"/>
          <label>Год</label><input type="number" class="wh-cal-ev-year" value="${cfg.epochYear}" min="0" max="999"/>
          <label>Доля</label><input type="number" class="wh-cal-ev-frac" value="${cfg.epochFraction}" min="0" max="999"/>
          <label>Ч</label><input type="number" class="wh-cal-ev-hour" value="0" min="0" max="23"/>
          <label>Мин</label><input type="number" class="wh-cal-ev-minute" value="0" min="0" max="59"/>
        </div>
        <div class="wh-cal-settings-hint wh-cal-ev-absolute" style="display:none;">Часы/минуты необязательны — по умолчанию начало доли года (00:00).</div>
        <label class="wh-cal-ev-visible-row">
          <input type="checkbox" class="wh-cal-ev-visible" checked/> Показывать игрокам
        </label>
        <div class="wh-cal-settings-row">
          <button type="button" class="wh-cal-ev-save">Сохранить событие</button>
        </div>
      </div>
    </section>
  </div>`;

  new Dialog({
    title: "Настройки Имперского календаря",
    content,
    buttons: {
      save: {
        label: "Сохранить",
        callback: async html => {
          commitExpandedRow();
          const enabled = [...html[0].querySelectorAll(".wh-cal-preset-row input[type=checkbox]:checked")]
            .map(cb => cb.dataset.key);
          const newCfg = {
            ...cfg,
            epochWorldTime: game.time.worldTime,
            epochMillennium: Number(html[0].querySelector(".cal-epoch-mill").value) || 1,
            epochYear: Math.max(0, Math.min(999, Number(html[0].querySelector(".cal-epoch-year").value) || 0)),
            epochFraction: Math.max(0, Math.min(999, Number(html[0].querySelector(".cal-epoch-frac").value) || 0)),
            checkDigit: Math.max(0, Math.min(9, Number(html[0].querySelector(".cal-check-digit").value) || 0)),
            enabledPresets: enabled,
            customPresets: state.customPresets,
            presetOverrides: state.presetOverrides,
            watchTriggers: state.watchTriggers,
            presetDescriptions: Object.fromEntries(
              [...html[0].querySelectorAll(".wh-cal-preset-desc")]
                .map(inp => [inp.dataset.key, inp.value.trim()])
                .filter(([, v]) => v)
            ),
            events: state.events,
            eventsShownCount: Math.max(0, Math.min(5, Number(html[0].querySelector(".wh-cal-event-count-value")?.textContent) || 0)),
            screenMessageFont: html[0].querySelector(".wh-cal-screen-font")?.value || ""
          };
          if (!newCfg.enabledPresets.length) newCfg.enabledPresets = DEFAULT_CALENDAR_CONFIG.enabledPresets;
          await game.settings.set("warhammer-dbc", "imperialCalendar", newCfg);
          refreshCalendarWidget();
        }
      },
      cancel: { label: "Отмена" }
    },
    default: "save",
    render: html => {
      root = html[0];

      // ── Вкладки ──
      html.find(".wh-cal-tabs .item").on("click", ev => {
        const tab = $(ev.currentTarget);
        html.find(".wh-cal-tabs .item").removeClass("active");
        html.find("[data-tab-panel]").hide();
        tab.addClass("active");
        html.find(`[data-tab-panel="${tab.data("tab")}"]`).show();
      });

      let enabled = new Set(cfg.enabledPresets?.length ? cfg.enabledPresets : DEFAULT_CALENDAR_CONFIG.enabledPresets);
      // Текущий текст описаний переживает пере-рендер списка (add/delete
      // своего пресета) — иначе недописанный текст стирался бы при каждом клике.
      let descriptions = { ...(cfg.presetDescriptions || {}) };

      const checklist = html.find(".wh-cal-preset-checklist");
      const renderChecklist = () => {
        const registry = watchPresetRegistry({ customPresets: state.customPresets, presetOverrides: state.presetOverrides });
        checklist.empty();
        for (const [key, preset] of Object.entries(registry)) {
          const isCustom = state.customPresets.some(p => p.key === key);
          const isExpanded = state.expandedKey === key;
          const row = $(`<div class="wh-cal-preset-row" data-key="${esc(key)}">
            <div class="wh-cal-preset-row-main">
              <span class="wh-cal-preset-caret${isExpanded ? " open" : ""}">${isExpanded ? "▾" : "▸"}</span>
              <label class="wh-cal-preset-row-check">
                <input type="checkbox" data-key="${esc(key)}" ${enabled.has(key) ? "checked" : ""}/>
                <span class="wh-cal-preset-row-label">${esc(preset.label)}</span>
              </label>
              <input type="text" class="wh-cal-preset-desc" data-key="${esc(key)}"
                     placeholder="${esc(preset.description || "краткое описание...")}"
                     value="${esc(descriptions[key] || "")}"
                     style="display:${enabled.has(key) ? "block" : "none"}"/>
              ${isCustom ? `<button type="button" class="wh-cal-preset-delete" title="Удалить свой пресет">✕</button>` : ""}
            </div>
          </div>`);
          row.find('input[type="checkbox"]').on("change", ev => {
            const on = ev.currentTarget.checked;
            if (on) enabled.add(key); else enabled.delete(key);
            row.find(".wh-cal-preset-desc").css("display", on ? "block" : "none");
          });
          row.find(".wh-cal-preset-desc").on("input", ev => { descriptions[key] = ev.currentTarget.value; });
          row.find(".wh-cal-preset-delete").on("click", () => {
            if (state.expandedKey && state.expandedKey !== key) commitExpandedRow();
            state.customPresets = state.customPresets.filter(p => p.key !== key);
            enabled.delete(key);
            delete descriptions[key];
            if (state.expandedKey === key) state.expandedKey = null;
            renderChecklist();
          });
          row.find(".wh-cal-preset-caret").on("click", () => {
            if (state.expandedKey === key) { commitExpandedRow(); state.expandedKey = null; }
            else { commitExpandedRow(); state.expandedKey = key; }
            renderChecklist();
          });
          checklist.append(row);

          if (isExpanded) {
            const watches = preset.watches || [];
            const expand = $(`<div class="wh-cal-preset-expand" data-preset-key="${esc(key)}">
              ${WATCH_PRESETS[key] ? `<div class="wh-cal-expand-tools"><span class="wh-cal-preset-revert">⟲ Вернуть заводской пресет</span></div>` : ""}
              <div class="wh-cal-watch-units"></div>
              <button type="button" class="wh-cal-watch-add">➕ Добавить деление</button>
            </div>`);
            expand[0].dataset.originalIds = watches.map(w => w.id).join(",");
            const unitsWrap = expand.find(".wh-cal-watch-units");
            for (const w of watches) unitsWrap.append($(watchUnitHTML(w, state.watchTriggers[w.id])));

            // Делегированные обработчики — ловят и деления, добавленные ПОСЛЕ
            // первого рендера этого блока (кнопкой «Добавить деление» ниже).
            const bellActive = unit => {
              const has = !!(unit.find(".wh-cal-trigger-sound").val().trim()
                || unit.find(".wh-cal-trigger-chat").val().trim()
                || unit.find(".wh-cal-trigger-screen").val().trim());
              unit.find(".wh-cal-watch-bell").toggleClass("active", has);
            };
            unitsWrap.on("click", ".wh-cal-watch-remove", ev => $(ev.currentTarget).closest(".wh-cal-watch-unit").remove());
            unitsWrap.on("click", ".wh-cal-watch-bell", ev => {
              const unit = $(ev.currentTarget).closest(".wh-cal-watch-unit");
              unit.find(".wh-cal-trigger-panel").toggle();
            });
            unitsWrap.on("input", ".wh-cal-trigger-sound, .wh-cal-trigger-chat, .wh-cal-trigger-screen", ev => {
              bellActive($(ev.currentTarget).closest(".wh-cal-watch-unit"));
            });
            unitsWrap.on("click", ".wh-cal-trigger-browse", ev => {
              const unit = $(ev.currentTarget).closest(".wh-cal-watch-unit");
              const input = unit.find(".wh-cal-trigger-sound")[0];
              new (filePicker())({
                type: "audio", current: input.value || "",
                callback: path => { input.value = path; bellActive(unit); }
              }).render(true);
            });
            // «▶ Тест» — та же тройка действий, что у реального триггера, но
            // без бродкаста (звук/титр только у себя, чат — шёпотом себе),
            // читает ТЕКУЩИЕ (необязательно ещё сохранённые) значения полей.
            unitsWrap.on("click", ".wh-cal-trigger-test", ev => {
              const unit = $(ev.currentTarget).closest(".wh-cal-watch-unit");
              const kind = ev.currentTarget.dataset.test;
              if (kind === "sound") {
                const src = unit.find(".wh-cal-trigger-sound").val().trim();
                if (!src) return ui.notifications?.warn("Сначала укажите звуковой файл.");
                _playTriggerSound(src, false);
              } else if (kind === "chat") {
                const text = unit.find(".wh-cal-trigger-chat").val().trim();
                if (!text) return ui.notifications?.warn("Сначала введите сообщение в чат.");
                _postTriggerChat(unit.find(".wh-cal-watch-icon").val(), unit.find(".wh-cal-watch-label").val(), text, true);
              } else if (kind === "screen") {
                const text = unit.find(".wh-cal-trigger-screen").val().trim();
                if (!text) return ui.notifications?.warn("Сначала введите текст титра.");
                _showTriggerScreen(text, html.find(".wh-cal-screen-font").val(), false);
              }
            });
            expand.find(".wh-cal-watch-add").on("click", () => {
              unitsWrap.append($(watchUnitHTML({ id: foundry.utils.randomID(), icon: "", label: "", hours: 1 })));
            });
            expand.find(".wh-cal-preset-revert").on("click", () => {
              delete state.presetOverrides[key];
              renderChecklist();
            });
            row.after(expand);
          }
        }
      };
      renderChecklist();

      // ── Конструктор своего пресета ──
      const creator = html.find(".wh-cal-preset-creator");
      const draftList = html.find(".wh-cal-preset-creator .wh-cal-watch-list");
      const addDraftRow = (icon = "", label = "", hours = 1) => draftList.append($(creatorWatchRowHTML({ id: foundry.utils.randomID(), icon, label, hours })));
      draftList.on("click", ".wh-cal-watch-remove", ev => $(ev.currentTarget).closest(".wh-cal-watch-row").remove());
      html.find(".wh-cal-preset-creator .wh-cal-watch-add").on("click", () => addDraftRow());

      html.find(".wh-cal-preset-add").on("click", () => {
        html.find(".wh-cal-preset-name").val("");
        draftList.empty();
        addDraftRow();
        creator.show();
      });
      html.find(".wh-cal-preset-cancel").on("click", () => creator.hide());
      html.find(".wh-cal-preset-save").on("click", () => {
        const name = String(html.find(".wh-cal-preset-name").val() || "").trim();
        const watches = [...draftList[0].querySelectorAll(".wh-cal-watch-row")].map(row => ({
          id: row.dataset.watchId || foundry.utils.randomID(),
          icon: row.querySelector(".wh-cal-watch-icon").value,
          label: row.querySelector(".wh-cal-watch-label").value || "Без названия",
          hours: Math.max(0.01, Number(row.querySelector(".wh-cal-watch-hours").value) || 1)
        }));
        if (!name) return ui.notifications?.warn("Введите название пресета.");
        if (!watches.length) return ui.notifications?.warn("Добавьте хотя бы одно деление.");
        commitExpandedRow();
        const key = slugify(name);
        state.customPresets = [...state.customPresets, { key, label: name, watches }];
        enabled.add(key);
        creator.hide();
        renderChecklist();
      });

      // ── Вкладка «События» ──
      const evCountValue = html.find(".wh-cal-event-count-value");
      html.find(".wh-cal-event-count-btn").on("click", ev => {
        const dir = Number(ev.currentTarget.dataset.dir) || 0;
        const next = Math.max(0, Math.min(5, (Number(evCountValue.text()) || 0) + dir));
        evCountValue.text(next);
      });

      const evList = html.find(".wh-cal-event-list");
      const renderEvents = () => {
        evList.empty();
        const worldTime = game.time?.worldTime ?? 0;
        const sorted = [...state.events].sort((a, b) => a.targetWorldTime - b.targetWorldTime);
        for (const ev of sorted) {
          const past = ev.targetWorldTime <= worldTime;
          const eta = past ? "наступило" : `через ${formatDuration(ev.targetWorldTime - worldTime)}`;
          const row = $(`<div class="wh-cal-event-row${past ? " past" : ""}">
            <span class="wh-cal-event-title" title="${esc(ev.description || "")}">${esc(ev.title)}</span>
            <span class="wh-cal-event-eta">${esc(eta)}</span>
            <span class="wh-cal-event-lock${ev.visibleToPlayers ? "" : " locked"}" title="${ev.visibleToPlayers ? "Видно игрокам — клик, чтобы скрыть" : "Скрыто от игроков — клик, чтобы показать"}">${ev.visibleToPlayers ? "🔓" : "🔒"}</span>
            <button type="button" class="wh-cal-event-remove" title="Удалить">✕</button>
          </div>`);
          row.find(".wh-cal-event-lock").on("click", () => { ev.visibleToPlayers = !ev.visibleToPlayers; renderEvents(); });
          row.find(".wh-cal-event-remove").on("click", () => {
            state.events = state.events.filter(e => e.id !== ev.id);
            renderEvents();
          });
          evList.append(row);
        }
      };
      renderEvents();

      const evForm = html.find(".wh-cal-event-form");
      html.find(".wh-cal-event-add").on("click", () => {
        html.find(".wh-cal-ev-title, .wh-cal-ev-desc").val("");
        html.find(".wh-cal-ev-years, .wh-cal-ev-fracs, .wh-cal-ev-minutes").val(0);
        html.find(".wh-cal-ev-hours").val(8);
        html.find(".wh-cal-ev-hour, .wh-cal-ev-minute").val(0);
        html.find(".wh-cal-ev-visible").prop("checked", true);
        html.find(".wh-cal-ev-mode-opt").removeClass("active");
        html.find('.wh-cal-ev-mode-opt[data-mode="relative"]').addClass("active");
        html.find(".wh-cal-ev-relative").show();
        html.find(".wh-cal-ev-absolute").hide();
        evForm.show();
      });
      html.find(".wh-cal-ev-mode-opt").on("click", ev => {
        const opt = $(ev.currentTarget);
        html.find(".wh-cal-ev-mode-opt").removeClass("active");
        opt.addClass("active");
        const relative = opt.data("mode") === "relative";
        html.find(".wh-cal-ev-relative").toggle(relative);
        html.find(".wh-cal-ev-absolute").toggle(!relative);
      });
      html.find(".wh-cal-ev-save").on("click", () => {
        const title = String(html.find(".wh-cal-ev-title").val() || "").trim();
        if (!title) return ui.notifications?.warn("Введите название события.");
        const relative = html.find('.wh-cal-ev-mode-opt[data-mode="relative"]').hasClass("active");
        const num = (sel, min, max) => {
          const n = Math.trunc(Number(html.find(sel).val()) || 0);
          return Math.max(min, max != null ? Math.min(max, n) : n);
        };
        let targetWorldTime;
        if (relative) {
          const years = num(".wh-cal-ev-years", 0), fracs = num(".wh-cal-ev-fracs", 0);
          const hours = num(".wh-cal-ev-hours", 0), minutes = num(".wh-cal-ev-minutes", 0);
          targetWorldTime = (game.time?.worldTime ?? 0)
            + years * SECONDS_PER_YEAR + fracs * SECONDS_PER_FRACTION_UNIT + hours * SECONDS_PER_HOUR + minutes * 60;
        } else {
          const base = imperialToWorldTime({
            millennium: num(".wh-cal-ev-mill", 1),
            year: num(".wh-cal-ev-year", 0, 999),
            fraction: num(".wh-cal-ev-frac", 0, 999)
          }, cfg);
          targetWorldTime = base + num(".wh-cal-ev-hour", 0, 23) * SECONDS_PER_HOUR + num(".wh-cal-ev-minute", 0, 59) * 60;
        }
        state.events = [...state.events, {
          id: foundry.utils.randomID(),
          title,
          description: String(html.find(".wh-cal-ev-desc").val() || "").trim(),
          targetWorldTime,
          visibleToPlayers: html.find(".wh-cal-ev-visible").is(":checked")
        }];
        evForm.hide();
        renderEvents();
      });
    }
  }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-cal-settings-dialog"], width: 520 }).render(true);
}
