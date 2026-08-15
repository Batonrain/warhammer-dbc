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

import { formatImperialDateParts, formatClock, currentWatch, currentEnabledPhases, HOURS24_WATCHES, DEFAULT_CALENDAR_CONFIG, WATCH_PRESETS, checkDigitTooltip, DATE_PART_TOOLTIPS }
  from "../constants/imperial-calendar.mjs";
import { triggerNewScene, triggerSessionEnd } from "./game-session.mjs";
import { esc } from "../helpers/utils.mjs";

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
      customPresets: stored?.customPresets ?? DEFAULT_CALENDAR_CONFIG.customPresets
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
  // Основное деление — ВСЕГДА 24 часа, не настраивается и не отключается.
  // Подпись — живые часы:минуты (не фиксированная "HH:00" метка сегмента),
  // иначе прокрутка минутами visually ничего не меняла бы внутри часа.
  const w = currentWatch(worldTime, { watches: HOURS24_WATCHES });
  const clockStr = formatClock(worldTime);
  const phases = currentEnabledPhases(worldTime, cfg);
  const isGM = game.user.isGM;

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
      <div class="wh-cal-w-watch wh-cal-w-watch-primary">
        <span class="wh-cal-w-watch-ic">${esc(w.watch.icon || "")}</span><span class="wh-cal-w-watch-lbl">${esc(clockStr)}</span>
      </div>
      ${phases.map(p => `
      <div class="wh-cal-w-watch wh-cal-w-watch-secondary" title="${esc(p.label)}${p.description ? " — " + esc(p.description) : ""}">
        <span class="wh-cal-w-watch-ic">${esc(p.watch.icon || "")}</span><span class="wh-cal-w-watch-lbl">${esc(p.watch.label)}</span>
      </div>`).join("")}
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

// Строка деления (icon/label/hours) — используется ТОЛЬКО в конструкторе
// своего пресета; встроенные пресеты (WATCH_PRESETS) больше не редактируются.
const watchRowHTML = (w) => `
  <div class="wh-cal-watch-row">
    <input type="text" class="wh-cal-watch-icon" value="${esc(w.icon || "")}" placeholder="иконка" maxlength="2"/>
    <input type="text" class="wh-cal-watch-label" value="${esc(w.label || "")}" placeholder="название"/>
    <input type="number" class="wh-cal-watch-hours" value="${Number.isFinite(w.hours) ? w.hours : 1}" min="0.01" step="0.01" title="Длительность, терранских часов"/>
    <button type="button" class="wh-cal-watch-remove" title="Убрать">✕</button>
  </div>`;

const slugify = (s) => "custom_" + String(s || "").toLowerCase().replace(/[^a-zа-я0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 32) + "_" + Date.now().toString(36);

export async function openCalendarSettings() {
  if (!game.user.isGM) return ui.notifications?.info("Настройки календаря доступны только Мастеру.");
  const cfg = calendarConfig();

  const content = `<div class="wh-cal-settings">
    <div class="wh-cal-settings-row">
      <label>Тысячелетие эпохи (М)</label><input type="number" class="cal-epoch-mill" value="${cfg.epochMillennium}" min="1"/>
      <label>Год</label><input type="number" class="cal-epoch-year" value="${cfg.epochYear}" min="0" max="999"/>
      <label>Доля</label><input type="number" class="cal-epoch-frac" value="${cfg.epochFraction}" min="0" max="999"/>
    </div>
    <div class="wh-cal-settings-hint">Это дата, которая соответствует текущему worldTime игры прямо сейчас — т.е. «сколько сейчас», не «когда началась игра». Смена этих полей сдвигает календарь, не трогая сами часы.</div>
    <div class="wh-cal-settings-row">
      <label>Контрольный номер (0-9)</label><input type="number" class="cal-check-digit" value="${cfg.checkDigit}" min="0" max="9"/>
    </div>
    <hr/>
    <div class="wh-cal-settings-hint">Основное деление часов (24ч) фиксировано и всегда включено — не отключается и не настраивается.</div>
    <div class="wh-cal-settings-subtitle">Обозначения рядом с часами (можно включить сразу несколько — каждое своей строкой на виджете)</div>
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
  </div>`;

  new Dialog({
    title: "Настройки Имперского календаря",
    content,
    buttons: {
      save: {
        label: "Сохранить",
        callback: async html => {
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
            customPresets: html[0]._whCalCustomPresets ?? cfg.customPresets,
            presetDescriptions: Object.fromEntries(
              [...html[0].querySelectorAll(".wh-cal-preset-desc")]
                .map(inp => [inp.dataset.key, inp.value.trim()])
                .filter(([, v]) => v)
            )
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
      const root = html[0];
      let customPresets = foundry.utils.deepClone(cfg.customPresets || []);
      let enabled = new Set(cfg.enabledPresets?.length ? cfg.enabledPresets : DEFAULT_CALENDAR_CONFIG.enabledPresets);
      // Текущий текст описаний переживает пере-рендер списка (add/delete
      // своего пресета) — иначе недописанный текст стирался бы при каждом клике.
      let descriptions = { ...(cfg.presetDescriptions || {}) };
      root._whCalCustomPresets = customPresets; // читается в save-callback

      const checklist = html.find(".wh-cal-preset-checklist");
      const renderChecklist = () => {
        const registry = { ...WATCH_PRESETS, ...Object.fromEntries(customPresets.map(p => [p.key, p])) };
        checklist.empty();
        for (const [key, preset] of Object.entries(registry)) {
          const isCustom = customPresets.some(p => p.key === key);
          const row = $(`<div class="wh-cal-preset-row">
            <label class="wh-cal-preset-row-check">
              <input type="checkbox" data-key="${esc(key)}" ${enabled.has(key) ? "checked" : ""}/>
              <span class="wh-cal-preset-row-label">${esc(preset.label)}</span>
            </label>
            <input type="text" class="wh-cal-preset-desc" data-key="${esc(key)}"
                   placeholder="${esc(preset.description || "краткое описание...")}"
                   value="${esc(descriptions[key] || "")}"
                   style="display:${enabled.has(key) ? "block" : "none"}"/>
            ${isCustom ? `<button type="button" class="wh-cal-preset-delete" title="Удалить свой пресет">✕</button>` : ""}
          </div>`);
          row.find('input[type="checkbox"]').on("change", ev => {
            const on = ev.currentTarget.checked;
            if (on) enabled.add(key); else enabled.delete(key);
            row.find(".wh-cal-preset-desc").css("display", on ? "block" : "none");
          });
          row.find(".wh-cal-preset-desc").on("input", ev => { descriptions[key] = ev.currentTarget.value; });
          row.find(".wh-cal-preset-delete").on("click", () => {
            customPresets = customPresets.filter(p => p.key !== key);
            root._whCalCustomPresets = customPresets;
            enabled.delete(key);
            delete descriptions[key];
            renderChecklist();
          });
          checklist.append(row);
        }
      };
      renderChecklist();

      // ── Конструктор своего пресета ──
      const creator = html.find(".wh-cal-preset-creator");
      const draftList = html.find(".wh-cal-preset-creator .wh-cal-watch-list");
      const addDraftRow = (icon = "", label = "", hours = 1) => draftList.append($(watchRowHTML({ icon, label, hours })));
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
          icon: row.querySelector(".wh-cal-watch-icon").value,
          label: row.querySelector(".wh-cal-watch-label").value || "Без названия",
          hours: Math.max(0.01, Number(row.querySelector(".wh-cal-watch-hours").value) || 1)
        }));
        if (!name) return ui.notifications?.warn("Введите название пресета.");
        if (!watches.length) return ui.notifications?.warn("Добавьте хотя бы одно деление.");
        const key = slugify(name);
        customPresets = [...customPresets, { key, label: name, watches }];
        root._whCalCustomPresets = customPresets;
        enabled.add(key);
        creator.hide();
        renderChecklist();
      });
    }
  }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-cal-settings-dialog"], width: 480 }).render(true);
}
