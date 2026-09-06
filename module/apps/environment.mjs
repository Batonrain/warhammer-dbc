// ════════════════════════════════════════════════════════════════════════
//  Окружающая Среда — окно ГМа (когитаторный стиль) + экранный виджет.
//  • Окно: левое меню-категории (Погода/Температура/Гравитация/Радиация),
//    справа — редактор с живым предпросмотром механики (корбук 483-484).
//    Только ГМ. Правки авто-сохраняются во флаг текущей сцены.
//  • Виджет: в левом-нижнем углу (справа от списка игроков) — видят ВСЕ.
// ════════════════════════════════════════════════════════════════════════

import {
  WEATHER, WEATHER_GROUPS, RAD_TABLE, RAD_PROTECTION, envView, defaultEnv
} from "../constants/environment.mjs";
import { resolveEnvContainer, readEnvForScene, primaryGroupForScene, envSceneHasOverride } from "../constants/scene-nexus.mjs";
import { esc } from "../helpers/utils.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
function currentScene() { return canvas?.scene ?? game.scenes?.current ?? null; }

const CATS = [
  { key: "weather", label: "Погода",      icon: "🌤" },
  { key: "temp",    label: "Температура",  icon: "🌡" },
  { key: "gravity", label: "Гравитация",   icon: "🪐" },
  { key: "rad",     label: "Радиация",     icon: "☢" }
];

export class EnvironmentApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "wh-environment",
    classes: ["warhammer-dbc", "wh-holo", "wh-environment"],
    window: { title: "Окружающая Среда", resizable: true },
    position: { width: 720, height: 560 }
  };

  static PARTS = {
    body: {
      template: "systems/warhammer-dbc/templates/apps/environment.hbs",
      root: true
    }
  };

  constructor(...args) { super(...args); this.uiState = { cat: "weather", target: null }; }

  async _prepareContext(options) {
    const isGM  = game.user.isGM;
    const scene = currentScene();
    const group = scene ? primaryGroupForScene(scene.id) : null;
    const inGroup = !!group;
    const hasOverride = envSceneHasOverride(scene);
    // Область правки: по умолчанию — группа (если сцена в группе), иначе сцена.
    if (this.uiState.target == null) this.uiState.target = hasOverride ? "scene" : (inGroup ? "group" : "scene");
    if (!inGroup) this.uiState.target = "scene";
    const target = this.uiState.target;
    // Для показа: если правим сцену без override — показываем унаследованное от группы.
    const shown = (target === "scene" && !hasOverride) ? readEnvForScene(scene) : resolveEnvContainer(scene, target).read();
    const v = envView(shown);
    return {
      isGM,
      sceneName: scene?.name || "— нет активной сцены —",
      inGroup, groupName: group?.name || "", target,
      isTargetGroup: target === "group", isTargetScene: target === "scene",
      hasOverride,
      cat: this.uiState.cat,
      cats: CATS.map(c => ({ ...c, active: c.key === this.uiState.cat })),
      isWeather: this.uiState.cat === "weather",
      isTemp:    this.uiState.cat === "temp",
      isGravity: this.uiState.cat === "gravity",
      isRad:     this.uiState.cat === "rad",
      env: v,
      weatherGroups: WEATHER_GROUPS.map(g => ({
        label: g.label,
        items: WEATHER.filter(w => w.grp === g.grp).map(w => ({ ...w, selected: w.key === v.weather.key && !v.weather.custom }))
      })),
      weatherCustom: v.weather.custom ? v.raw.weatherText : "",
      gravPresets: [0, 0.2, 0.5, 0.8, 1, 1.5, 2, 3].map(g => ({ g, selected: Number(v.raw.gravity) === g })),
      radLevels: [0, ...RAD_TABLE.map(r => r.lvl)].map(l => ({ l, selected: v.rad.value === l })),
      radTable: RAD_TABLE,
      radProtection: RAD_PROTECTION,
      note: v.note
    };
  }

  async _patch(patch) {
    const scene = currentScene();
    if (!scene) { ui.notifications?.warn("Окружение: нет активной сцены."); return; }
    const c = resolveEnvContainer(scene, this.uiState.target);
    // Первое сохранение override сцены — засеять текущим эффективным окружением.
    const base = (this.uiState.target === "scene" && !envSceneHasOverride(scene)) ? readEnvForScene(scene) : c.read();
    await c.write({ ...base, ...patch });
    this.render(false);
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;

    // Категории (левое меню)
    el.querySelectorAll("[data-cat]").forEach(b => b.addEventListener("click", () => { this.uiState.cat = b.dataset.cat; this.render(false); }));

    if (!game.user.isGM) return;   // редактирование — только ГМ

    // Область правки: Группа / Сцена
    el.querySelectorAll("[data-target]").forEach(b => b.addEventListener("click", () => { this.uiState.target = b.dataset.target; this.render(false); }));
    // Убрать переопределение сцены → вернуться к окружению группы
    el.querySelector("[data-act=clearOverride]")?.addEventListener("click", async () => {
      const scene = currentScene(); if (!scene) return;
      await resolveEnvContainer(scene, "scene").clear?.();
      this.uiState.target = "group";
      this.render(false);
    });

    // Погода
    el.querySelectorAll("[data-weather]").forEach(b => b.addEventListener("click", () => this._patch({ weather: b.dataset.weather, weatherText: "" })));
    el.querySelector("[name=weatherText]")?.addEventListener("change", e => this._patch({ weatherText: e.target.value.trim() }));

    // Температура
    const tempIn = el.querySelector("[name=temp]");
    tempIn?.addEventListener("change", e => this._patch({ temp: Math.round(Number(e.target.value) || 0) }));
    el.querySelector("[name=tempRange]")?.addEventListener("input", e => { if (tempIn) tempIn.value = e.target.value; });
    el.querySelector("[name=tempRange]")?.addEventListener("change", e => this._patch({ temp: Math.round(Number(e.target.value) || 0) }));
    el.querySelectorAll("[data-tempstep]").forEach(b => b.addEventListener("click", () => {
      this._patch({ temp: Math.round((readEnvForScene(currentScene()).temp || 0) + Number(b.dataset.tempstep)) });
    }));

    // Гравитация
    el.querySelector("[name=gravity]")?.addEventListener("change", e => this._patch({ gravity: Math.max(0, Number(e.target.value) || 0) }));
    el.querySelectorAll("[data-grav]").forEach(b => b.addEventListener("click", () => this._patch({ gravity: Number(b.dataset.grav) })));

    // Радиация
    el.querySelectorAll("[data-rad]").forEach(b => b.addEventListener("click", () => this._patch({ rad: Number(b.dataset.rad) })));
    el.querySelector("[name=radRange]")?.addEventListener("change", e => this._patch({ rad: Number(e.target.value) || 0 }));

    // Заметка ГМа (видна игрокам в виджете)
    el.querySelector("[name=note]")?.addEventListener("change", e => this._patch({ note: e.target.value.trim() }));

    // Сброс к норме
    el.querySelector("[data-act=reset]")?.addEventListener("click", () => this._patch(defaultEnv()));
  }
}

// Своего окна у Окружения больше нет (wdbc-59if). EnvironmentApp остался
// строительным блоком объединённой страницы «Сцена» (module/apps/
// scene-settings.mjs) — она берёт отсюда и разметку, и методы. Прежние
// openEnvironment()/refreshEnvironment() удалены НАМЕРЕННО: пока у старого
// окна оставался собственный вход, кнопка «Окружающая Среда» и клик по
// виджету вели в него, и объединения ГМ не видел. Открывать и обновлять —
// openSceneSettings("env") / refreshSceneSettings().

// ══════════════════════════ ЭКРАННЫЙ ВИДЖЕТ ════════════════════════════════
// Постоянная панель в левом-нижнем углу (справа от списка игроков) — для ВСЕХ.
function _widgetHTML(v) {
  const rows = [];
  rows.push(`<div class="wh-env-w-row" style="--c:${v.weather.tone}">
    <span class="wh-env-w-ic">${v.weather.icon}</span>
    <span class="wh-env-w-k">${esc(v.weather.rowLabel)}</span>
    <span class="wh-env-w-v">${esc(v.weather.label)}</span>
  </div>`);
  const tSign = v.temp.testSigned ? `T${v.temp.testSigned}` : "";
  rows.push(`<div class="wh-env-w-row" style="--c:${v.temp.tone}">
    <span class="wh-env-w-ic">🌡</span>
    <span class="wh-env-w-k">Температура</span>
    <span class="wh-env-w-v">${v.temp.value}°C${tSign ? ` <b class="wh-env-w-t">${tSign}</b>` : ""}</span>
  </div>`);
  rows.push(`<div class="wh-env-w-row" style="--c:${v.gravity.tone}">
    <span class="wh-env-w-ic">🪐</span>
    <span class="wh-env-w-k">Гравитация</span>
    <span class="wh-env-w-v">${v.gravity.kind === "zero" ? "0G" : Number(v.gravity.value).toFixed(1) + "G"}</span>
  </div>`);
  const radCls = v.rad.active ? " danger" : "";
  rows.push(`<div class="wh-env-w-row${radCls}" style="--c:${v.rad.tone}">
    <span class="wh-env-w-ic">☢</span>
    <span class="wh-env-w-k">Радиация</span>
    <span class="wh-env-w-v">${v.rad.active ? `ур. ${v.rad.value}` : "норма"}</span>
  </div>`);
  const note = v.note ? `<div class="wh-env-w-note">${esc(v.note)}</div>` : "";
  return `<div class="wh-env-w-head"><span class="wh-env-w-led"></span><span class="wh-env-w-title">ОКРУЖЕНИЕ</span><span class="wh-env-w-collapse" title="Свернуть/развернуть">▾</span></div>
    <div class="wh-env-w-body">${rows.join("")}</div>${note}`;
}

// Восстанавливает позицию из localStorage или ставит дефолт правее списка игроков.
function _applyEnvPos(el) {
  let pos = null;
  try { pos = JSON.parse(localStorage.getItem("wh-env-pos") || "null"); } catch (e) {}
  if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
    el.style.left = `${pos.left}px`; el.style.top = `${pos.top}px`;
  } else {
    // Дефолт: правее списка игроков и выше нижнего HUD (можно перетащить).
    el.style.left = "232px";
    el.style.top  = `${Math.max(10, (window.innerHeight || 800) - 340)}px`;
  }
  el.style.right = "auto"; el.style.bottom = "auto";
}

// Перетаскивание за шапку (позиция сохраняется на клиенте).
function _wireEnvDrag(el) {
  const head = el.querySelector(".wh-env-w-head");
  if (!head) return;
  head.addEventListener("mousedown", ev => {
    if (ev.target.closest(".wh-env-w-collapse")) return;   // клик по «свернуть» — не тащим
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
      try { localStorage.setItem("wh-env-pos", JSON.stringify({ left: parseFloat(el.style.left), top: parseFloat(el.style.top) })); } catch (e) {}
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  });
}

export function refreshEnvWidget() {
  try {
    const scene = currentScene();
    let el = document.getElementById("wh-env-widget");
    if (!scene) { el?.remove(); return; }
    const fresh = !el;
    if (!el) {
      el = document.createElement("div");
      el.id = "wh-env-widget";
      document.body.appendChild(el);
      if (localStorage.getItem("wh-env-collapsed") === "1") el.classList.add("collapsed");
    }
    el.classList.toggle("gm", game.user.isGM);
    el.innerHTML = _widgetHTML(envView(readEnvForScene(scene)));
    if (fresh) _applyEnvPos(el);
    _wireEnvDrag(el);
    // Свернуть/развернуть.
    el.querySelector(".wh-env-w-collapse")?.addEventListener("click", ev => {
      ev.stopPropagation();
      const c = el.classList.toggle("collapsed");
      try { localStorage.setItem("wh-env-collapsed", c ? "1" : "0"); } catch (e) {}
    });
    // Клик по телу открывает окно (только ГМ) — объединённую страницу «Сцена»
    // на разделе «Окружение», а не старое отдельное окно (wdbc-59if). Импорт
    // динамический: scene-settings.mjs сам берёт EnvironmentApp отсюда, и
    // статический импорт замкнул бы кольцо.
    el.querySelector(".wh-env-w-body")?.addEventListener("click", () => {
      if (!game.user.isGM) return;
      import("./scene-settings.mjs").then(m => m.openSceneSettings("env"))
        .catch(e => console.warn("warhammer-dbc | env widget → Сцена", e));
    });
  } catch (e) { console.warn("warhammer-dbc | env widget", e); }
}
