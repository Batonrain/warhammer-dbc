// ════════════════════════════════════════════════════════════════════════
//  Панель инструментов молчит без открытой сцены (wdbc-3w94)
//
//  Это НЕ наша поломка. Обработчики панели в ядре Foundry начинаются с
//  тихого выхода — resources/app/client/applications/ui/scene-controls.mjs:
//
//    static #onChangeControl(event) { if ( !canvas.ready ) return; ... }   // :580-584
//    static #onChangeTool(event)    { if ( !canvas.ready ) return; ... }   // :594-598
//
//  Если у ГМа не открыта ни одна сцена (canvas.ready === false,
//  game.scenes.viewed === null), любой клик по любой кнопке панели молча
//  ничего не делает — включая штатные Стены, Освещение, Измерение, Токены.
//  Ошибки в консоли нет, поэтому это выглядит как «кнопка сломалась».
//
//  Чинить ядро мы не будем, но молчащий интерфейс противоречит замыслу
//  системы: игрок и ГМ должны видеть причину, а не гадать. Здесь три вещи:
//
//  1. Клик по любой кнопке панели без открытой сцены — сказать вслух, чем
//     дело, и как это лечится (открыть сцену).
//  2. Наша кнопка «Doom BC» при этом всё же открывает своё меню: половина
//     разделов (Звёздные системы, Мастерская, Когитаторы, Завеса, Нексус
//     Сцен, Окружающая Среда) канваса не требует и прекрасно работает без
//     открытой карты. Меню само гасит пункты, которым канвас нужен, —
//     см. warhammer-dbc.mjs::openWhHub.
//  3. Пока канваса нет — панель помечена классом и приглушена, чтобы это
//     было видно ДО клика (styles/ui/scene-controls-guard.css).
// ════════════════════════════════════════════════════════════════════════

const ROOT_ID = "scene-controls";
const IDLE_CLASS = "wh-canvas-idle";
const WIRED = "whCanvasGuard";

const MSG = "Сначала откройте сцену: без открытой карты панель инструментов "
          + "Foundry не отзывается ни на одну кнопку. Дважды щёлкните сцену "
          + "в боковой панели «Сцены».";

/** Меню «Doom BC» — задаётся из warhammer-dbc.mjs, где живут все его пункты. */
let _hubOpener = null;
export function registerHubOpener(fn) { _hubOpener = fn; }

/** Готов ли канвас. Отдельной функцией: до `ready` глобали может не быть. */
function canvasReady() { try { return !!canvas?.ready; } catch (e) { return false; } }

function root() { return document.getElementById(ROOT_ID); }

/* Не частить одинаковыми предупреждениями: ГМ, поняв, что не работает, жмёт
   по панели ещё несколько раз подряд, и без этого он получит стопку тостов. */
let _lastWarn = 0;
function warnOnce() {
  const now = Date.now();
  if (now - _lastWarn < 4000) return;
  _lastWarn = now;
  ui.notifications?.warn(MSG);
}

/**
 * Что делать с кликом по кнопке панели. Вынесено из обработчика отдельно и
 * без DOM — только эта таблица решений и содержит правило, остальное вокруг
 * неё разводка событий (стенда с настоящим DOM в проекте нет).
 *
 * @param {boolean} ready            canvas.ready
 * @param {string|undefined} control значение data-control кнопки
 * @param {boolean} hasHub           зарегистрировано ли меню «Doom BC»
 * @returns {"pass"|"hub"|"warn"}    отдать ядру / открыть меню сами / сказать вслух
 */
export function sceneControlsClickAction(ready, control, hasHub) {
  if (ready) return "pass";                              // канвас есть — ядро справится само
  if (control === "wh-hub" && hasHub) return "hub";      // наше меню канваса не требует
  return "warn";                                         // ядро молча проглотит клик — предупредить
}

function onClickCapture(ev) {
  const btn = ev.target?.closest?.("button[data-action]");
  if (!btn) return;
  const act = sceneControlsClickAction(canvasReady(), btn.dataset.control, !!_hubOpener);
  if (act === "pass") return;

  // Ядро в этой ситуации всё равно молча вернётся, так что перехват ничего
  // рабочего не отменяет — фаза capture нужна только чтобы успеть раньше
  // делегированного обработчика ApplicationV2 на том же корневом узле.
  ev.preventDefault();
  ev.stopPropagation();

  if (act === "hub") _hubOpener();
  else warnOnce();
}

/** Пометить/снять пометку «канваса нет» на панели. */
export function syncSceneControlsGuard() {
  const el = root();
  if (!el) return;
  el.classList.toggle(IDLE_CLASS, !canvasReady());
}

function wire(el) {
  if (!el || el.dataset[WIRED]) return;
  el.dataset[WIRED] = "1";
  el.addEventListener("click", onClickCapture, { capture: true });
}

export function initSceneControlsGuard() {
  Hooks.on("renderSceneControls", (app, element) => {
    // v14 отдаёт HTMLElement; подстраховка на случай jQuery-подобного объекта.
    const el = element?.[0] ?? element ?? root();
    wire(el);
    syncSceneControlsGuard();
  });
  for (const h of ["ready", "canvasReady", "canvasTearDown"])
    Hooks.on(h, () => syncSceneControlsGuard());
}
