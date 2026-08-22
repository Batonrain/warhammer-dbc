// module/apps/callouts.mjs
// Коллауты сцены — маркер + линия-выноска + текстовая подпись поверх картинки
// сцены (в духе wiki-схем «иконка на объекте → линия → подпись сбоку»).
// Переиспользуемо для любой сцены (корабли, планеты, звёзды и т.п.).
//
// Отдельного типа документа не заводим — Foundry v13 у Drawing/Tile sub-types
// не поддерживает. Коллаут — это до четырёх обычных документов сцены,
// связанные общим flags.warhammer-dbc.callout.pairId:
//  • icon   — Tile, НЕОБЯЗАТЕЛЬНЫЙ. У Tile текстура честно масштабируется под
//             width/height (texture.fit), в отличие от Drawing PATTERN-заливки,
//             которая тайлит картинку в родном пикс. размере без масштаба.
//  • frame  — «рамка» маркера: либо Drawing-эллипс/прямоугольник (векторная
//             обводка, круг/квадрат), либо Tile с картинкой (свой оверлей) —
//             тип документа зависит от выбранной формы, отсюда обе коллекции
//             сцены (tiles И drawings) нужно проверять при поиске frame.
//  • label  — Drawing-прямоугольник со своими текстовыми полями.
//  • line   — Drawing-полигон из двух точек, только обводка; хранит на своих
//             же flags выбранные пользователем точки соприкосновения
//             (markerAnchor/labelAnchor — см. ANCHOR_KEYS).
//
// Перетаскивание, выделение, HUD видимости/блокировки — всё уже даёт штатный
// TilesLayer/DrawingsLayer, писать свой канвас-слой не нужно. Двойной клик по
// любой из частей открывает не штатный конфиг, а свой единый диалог с
// вкладками Маркер/Линия/Лейбл (openCalloutEditor) — штатные
// TileConfig/DrawingConfig перехватываются и закрываются хуками
// renderTileConfig/renderDrawingConfig.

import { filePicker } from "../sheets/v2-helpers.mjs";
import { esc } from "../helpers/utils.mjs";

const SYSTEM = "warhammer-dbc";
const FLAG_KEY = "callout";
const MARKER_SIZE = 40;
const LINE_COLOR = "#39ff6a";

/* ── Точки соприкосновения (общий набор для маркера и лейбла) ────────────── */

const ANCHOR_KEYS = [
  { key: "center", label: "Центр" },
  { key: "top", label: "Середина верхней границы" },
  { key: "bottom", label: "Середина нижней границы" },
  { key: "left", label: "Середина левой границы" },
  { key: "right", label: "Середина правой границы" },
  { key: "topLeft", label: "Левый верхний угол" },
  { key: "topRight", label: "Правый верхний угол" },
  { key: "bottomLeft", label: "Левый нижний угол" },
  { key: "bottomRight", label: "Правый нижний угол" }
];
const ANCHOR_OFFSETS = {
  center: [0, 0], top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0],
  topLeft: [-1, -1], topRight: [1, -1], bottomLeft: [-1, 1], bottomRight: [1, 1]
};
function anchorPoint(center, halfW, halfH, key) {
  const [mx, my] = ANCHOR_OFFSETS[key] || ANCHOR_OFFSETS.center;
  return { x: center.x + mx * halfW, y: center.y + my * halfH };
}
function anchorOptionsHtml(current) {
  return ANCHOR_KEYS.map(a => `<option value="${a.key}" ${a.key === current ? "selected" : ""}>${esc(a.label)}</option>`).join("");
}

// Точка «своей» границы, обращённая к направлению (dx,dy) — 8 секторов по 45°
// (плюс центр как fallback), в экранных координатах (y растёт вниз).
function angleToAnchor(dx, dy) {
  if (!dx && !dy) return "center";
  const deg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
  if (deg >= 337.5 || deg < 22.5) return "right";
  if (deg < 67.5) return "bottomRight";
  if (deg < 112.5) return "bottom";
  if (deg < 157.5) return "bottomLeft";
  if (deg < 202.5) return "left";
  if (deg < 247.5) return "topLeft";
  if (deg < 292.5) return "top";
  return "topRight";
}
const OPPOSITE_ANCHOR = {
  center: "center", top: "bottom", bottom: "top", left: "right", right: "left",
  topLeft: "bottomRight", topRight: "bottomLeft", bottomLeft: "topRight", bottomRight: "topLeft"
};

/** Список шрифтов — тот же источник, что у штатного DrawingConfig/FontConfig. */
function availableFonts() {
  try {
    const choices = foundry.applications.settings.menus.FontConfig?.getAvailableFontChoices?.();
    if (choices && Object.keys(choices).length) return choices;
  } catch (e) { /* берём запасной список ниже */ }
  return { Signika: "Signika", Arial: "Arial", "Times New Roman": "Times New Roman", "Courier New": "Courier New" };
}
function fontOptionsHtml(current) {
  return Object.keys(availableFonts()).map(f => `<option value="${esc(f)}" ${f === current ? "selected" : ""}>${esc(f)}</option>`).join("");
}

/* ── Указание точки на канвасе кликом (в духе прицеливания в combat/aim.mjs) ── */

const HINT_ID = "wh-callout-hint";
let _picking = null;

function endPicking() {
  if (!_picking) return;
  _picking.off();
  _picking = null;
  document.body.classList.remove("wh-callout-picking");
  document.getElementById(HINT_ID)?.remove();
}

function pickPoint(hintText) {
  return new Promise((resolve) => {
    if (!canvas?.ready) { ui.notifications?.warn("Сцена не готова."); resolve(null); return; }
    endPicking();
    document.body.classList.add("wh-callout-picking");

    const hint = document.createElement("div");
    hint.id = HINT_ID;
    hint.innerHTML = `<b>${esc(hintText)}</b> · <span>ПКМ или Esc — отмена</span>`;
    document.body.appendChild(hint);

    const toWorld = (ev) => {
      const rect = canvas.app.view.getBoundingClientRect();
      return canvas.stage.toLocal({ x: ev.clientX - rect.left, y: ev.clientY - rect.top });
    };
    const pick = (ev) => {
      if (ev.button !== 0) return;
      if (ev.target?.closest?.(`#${HINT_ID}`)) return;
      ev.preventDefault(); ev.stopPropagation();
      const p = toWorld(ev);
      endPicking();
      resolve(p);
    };
    const cancel = (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      endPicking();
      resolve(null);
    };
    const onKey = (ev) => { if (ev.key === "Escape") cancel(ev); };

    // Capture-фаза — иначе канвас/плавающие виджеты перехватят клик первым.
    window.addEventListener("pointerdown", pick, true);
    window.addEventListener("contextmenu", cancel, true);
    window.addEventListener("keydown", onKey, true);
    _picking = { off: () => {
      window.removeEventListener("pointerdown", pick, true);
      window.removeEventListener("contextmenu", cancel, true);
      window.removeEventListener("keydown", onKey, true);
    } };
  });
}

/** Однострочный ввод текста подписи (тот же приём DialogV2, что и legacyPrompt в apps/legacy-weapon.mjs). */
function calloutTextPrompt() {
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Текст подписи" },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<form><div class="atk-dlg-row"><label>Текст подписи</label>
      <input type="text" name="value" style="width:100%" autofocus/></div></form>`,
    rejectClose: false,
    buttons: [
      { action: "ok", label: "Готово", default: true, callback: (_e, button) => button.form.elements.value.value },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
}

/* ── Геометрия ─────────────────────────────────────────────────────────── */

// Прямоугольник документа: центр + половины сторон. У Tile (anchorX/Y=0.5)
// x/y уже и есть центр; у Drawing x/y — левый верхний угол bounding box.
function boxOf(doc) {
  if (doc.documentName === "Tile") return { center: { x: doc.x, y: doc.y }, halfW: doc.width / 2, halfH: doc.height / 2 };
  const w = doc.shape?.width || 0, h = doc.shape?.height || 0;
  return { center: { x: doc.x + w / 2, y: doc.y + h / 2 }, halfW: w / 2, halfH: h / 2 };
}

// Полигон Drawing хранит points локально к своим x/y (левый верхний угол
// bounding box); незамкнутые 2 точки + fillType NONE рисуются как открытая
// линия (см. client/canvas/placeables/drawing.mjs — isClosed по fillType или
// совпадению первой/последней точки).
function lineShapeFor(a, b) {
  let bx = b.x, by = b.y;
  if (a.x === bx && a.y === by) bx += 1; // не даём выродиться в точку — Drawing такое не провалидирует
  const x = Math.min(a.x, bx), y = Math.min(a.y, by);
  return {
    x, y,
    width: Math.abs(bx - a.x), height: Math.abs(by - a.y),
    points: [a.x - x, a.y - y, bx - x, by - y]
  };
}

// Размер прямоугольника подписи «впритык» под текст при данных шрифте/размере
// (см. Drawing#_getTextStyle — та же логика построения PIXI.TextStyle).
const LABEL_PAD_X = 24, LABEL_PAD_Y = 14;
function measureLabelSize(text, fontFamily, fontSize) {
  const style = new PIXI.TextStyle({
    fontFamily: fontFamily || CONFIG.defaultFontFamily || "Signika",
    fontSize: fontSize || 24, fontWeight: "bold"
  });
  const metrics = PIXI.TextMetrics.measureText(String(text || " "), style);
  return {
    width: Math.max(60, Math.ceil(metrics.width) + LABEL_PAD_X * 2),
    height: Math.max(28, Math.ceil(metrics.height) + LABEL_PAD_Y * 2)
  };
}

/* ── Создание коллаута ─────────────────────────────────────────────────────
   Иконка и вся стилистика в момент создания не спрашиваются — рамка маркера
   ставится кругом по умолчанию, всё остальное донастраивается через
   openCalloutEditor (двойной клик по любой части) после создания. */

export async function addCallout() {
  if (!game.user.isGM) return;
  const scene = canvas?.scene;
  if (!scene) { ui.notifications?.warn("Нет активной сцены."); return; }

  const markerPt = await pickPoint("Коллаут: укажи точку на объекте (маркер)");
  if (!markerPt) return;
  const labelPt = await pickPoint("Коллаут: укажи, где разместить подпись");
  if (!labelPt) return;
  const text = await calloutTextPrompt();
  if (text === null) return;

  const pairId = foundry.utils.randomID();

  const frameData = {
    x: markerPt.x - MARKER_SIZE / 2, y: markerPt.y - MARKER_SIZE / 2,
    shape: { type: "e", width: MARKER_SIZE, height: MARKER_SIZE, points: [] },
    fillType: CONST.DRAWING_FILL_TYPES.NONE,
    strokeColor: LINE_COLOR, strokeWidth: 2, strokeAlpha: 1,
    flags: { [SYSTEM]: { [FLAG_KEY]: { pairId, role: "frame" } } }
  };
  // Размер подписи — сразу впритык под введённый текст, а не фиксированный.
  const { width: labelW, height: labelH } = measureLabelSize(text, "Signika", 24);
  const labelData = {
    x: labelPt.x - labelW / 2, y: labelPt.y - labelH / 2,
    shape: { type: "r", width: labelW, height: labelH, points: [] },
    fillType: CONST.DRAWING_FILL_TYPES.SOLID, fillColor: "#001a08", fillAlpha: 0.75,
    strokeWidth: 2, strokeColor: LINE_COLOR, strokeAlpha: 1,
    text: String(text || "Подпись"), fontFamily: "Signika", fontSize: 24,
    textColor: LINE_COLOR, textAlpha: 1,
    flags: { [SYSTEM]: { [FLAG_KEY]: { pairId, role: "label" } } }
  };
  // По умолчанию — «ближайшие границы»: сторона маркера, обращённая к
  // лейблу, и противоположная ей сторона лейбла (обращённая к маркеру).
  const markerAnchor = angleToAnchor(labelPt.x - markerPt.x, labelPt.y - markerPt.y);
  const labelAnchor = OPPOSITE_ANCHOR[markerAnchor];
  const a = anchorPoint(markerPt, MARKER_SIZE / 2, MARKER_SIZE / 2, markerAnchor);
  const b = anchorPoint(labelPt, labelW / 2, labelH / 2, labelAnchor);
  const ls = lineShapeFor(a, b);
  const lineData = {
    x: ls.x, y: ls.y,
    shape: { type: "p", width: ls.width, height: ls.height, points: ls.points },
    fillType: CONST.DRAWING_FILL_TYPES.NONE,
    strokeColor: LINE_COLOR, strokeWidth: 2, strokeAlpha: 1,
    flags: { [SYSTEM]: { [FLAG_KEY]: { pairId, role: "line", markerAnchor, labelAnchor } } }
  };

  await scene.createEmbeddedDocuments("Drawing", [frameData, labelData, lineData]);
}

/* ── Поиск частей коллаута, синхронизация линии/видимости, каскадное удаление ── */

function calloutFlag(doc) { return doc?.flags?.[SYSTEM]?.[FLAG_KEY] || null; }

function pairMembers(scene, pairId) {
  const has = (d) => calloutFlag(d)?.pairId === pairId;
  const role = (d) => calloutFlag(d)?.role;
  return {
    icon: scene.tiles.find(d => has(d) && role(d) === "icon"),
    frame: scene.tiles.find(d => has(d) && role(d) === "frame") || scene.drawings.find(d => has(d) && role(d) === "frame"),
    label: scene.drawings.find(d => has(d) && role(d) === "label"),
    line: scene.drawings.find(d => has(d) && role(d) === "line")
  };
}

// Каскадное удаление рамки/иконки при смене типа документа (круг/квадрат ↔
// свой оверлей) — не «настоящее» удаление коллаута, поэтому на время такой
// внутренней пересборки cascadeDelete для этого pairId глушится.
const _suppressCascade = new Set();

async function syncLineFor(scene, pairId) {
  const { frame, label, line } = pairMembers(scene, pairId);
  if (!frame || !label || !line) return;
  const anchors = calloutFlag(line) || {};
  const fb = boxOf(frame), lb = boxOf(label);
  const a = anchorPoint(fb.center, fb.halfW, fb.halfH, anchors.markerAnchor || "center");
  const b = anchorPoint(lb.center, lb.halfW, lb.halfH, anchors.labelAnchor || "center");
  const ls = lineShapeFor(a, b);
  try {
    await line.update({ x: ls.x, y: ls.y, "shape.width": ls.width, "shape.height": ls.height, "shape.points": ls.points });
  } catch (e) { console.warn("Warhammer DBC | callout: не удалось пересчитать линию", e); }
}

// Видимость синхронизируется ПОПАРНО, не по всем четырём документам сразу:
// иконка+рамка — одна пара («маркер»), подпись+линия — другая («лейбл»).
// Так ГМ может спрятать только подпись (и линию к ней), оставив точку-маркер
// видимой игрокам как загадку, или наоборот — см. чекбоксы в редакторе.
async function syncHidden(doc, hiddenValue) {
  const flag = calloutFlag(doc);
  if (!flag) return;
  const scene = doc.parent;
  if (!scene) return;
  const { icon, frame, label, line } = pairMembers(scene, flag.pairId);
  const pair = (flag.role === "icon" || flag.role === "frame") ? [icon, frame] : [label, line];
  for (const sib of pair) {
    if (sib && sib.id !== doc.id && sib.hidden !== hiddenValue) {
      try { await sib.update({ hidden: hiddenValue }); } catch (e) { console.warn("Warhammer DBC | callout: не удалось синхронизировать видимость", e); }
    }
  }
}

async function cascadeDelete(doc) {
  const flag = calloutFlag(doc);
  if (!flag || _suppressCascade.has(flag.pairId)) return;
  const scene = doc.parent;
  if (!scene) return;
  // Перепроверяем по актуальным коллекциям — часть коллаута могла уже уйти в
  // параллельном каскаде того же удаления (гонка хуков, см. память
  // doombc-mechanics-flag-hook-race).
  const { icon, frame, label, line } = pairMembers(scene, flag.pairId);
  const tileIds = [icon, frame].filter(d => d?.documentName === "Tile" && d.id !== doc.id).map(d => d.id);
  const drawingIds = [frame, label, line].filter(d => d?.documentName === "Drawing" && d.id !== doc.id).map(d => d.id);
  try { if (tileIds.length) await scene.deleteEmbeddedDocuments("Tile", tileIds); } catch (e) { console.warn("Warhammer DBC | callout: каскадное удаление (Tile)", e); }
  try { if (drawingIds.length) await scene.deleteEmbeddedDocuments("Drawing", drawingIds); } catch (e) { console.warn("Warhammer DBC | callout: каскадное удаление (Drawing)", e); }
}

/** Удаляет ВСЕ коллауты текущей сцены (инструмент «Очистить» на панели). */
export async function clearAllCallouts() {
  if (!game.user.isGM) return;
  const scene = canvas?.scene;
  if (!scene) { ui.notifications?.warn("Нет активной сцены."); return; }

  const pairIds = new Set();
  for (const d of scene.tiles) { const f = calloutFlag(d); if (f) pairIds.add(f.pairId); }
  for (const d of scene.drawings) { const f = calloutFlag(d); if (f) pairIds.add(f.pairId); }
  if (!pairIds.size) { ui.notifications?.info("На этой сцене нет коллаутов."); return; }

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Очистить коллауты" },
    content: `<p>Удалить все коллауты (${pairIds.size}) на сцене «${esc(scene.name)}»? Действие необратимо.</p>`,
    rejectClose: false
  });
  if (!confirmed) return;

  // Глушим cascadeDelete на время массового удаления — иначе на каждый из
  // сотен возможных deleteTile/deleteDrawing хук пытался бы досогнать уже
  // удаляемых соседей и просто шумел бы предупреждениями в консоли.
  for (const id of pairIds) _suppressCascade.add(id);
  try {
    const tileIds = scene.tiles.filter(d => calloutFlag(d)).map(d => d.id);
    const drawingIds = scene.drawings.filter(d => calloutFlag(d)).map(d => d.id);
    if (tileIds.length) await scene.deleteEmbeddedDocuments("Tile", tileIds);
    if (drawingIds.length) await scene.deleteEmbeddedDocuments("Drawing", drawingIds);
  } finally {
    for (const id of pairIds) _suppressCascade.delete(id);
  }
  ui.notifications?.info(`Коллаутов удалено: ${pairIds.size}.`);
}

/* ── Единый редактор коллаута (вкладки Маркер / Линия / Лейбл) ───────────── */

async function openCalloutEditor(anyDoc) {
  const flag = calloutFlag(anyDoc);
  if (!flag) return;
  const scene = anyDoc.parent;
  if (!scene) return;
  const { icon, frame, label, line } = pairMembers(scene, flag.pairId);
  if (!frame || !label || !line) { ui.notifications?.warn("Коллаут повреждён — не найдены все его части."); return; }

  const lineFlags = calloutFlag(line) || {};
  const frameIsOverlay = frame.documentName === "Tile";
  const frameShape = frameIsOverlay ? "overlay" : (frame.shape?.type === "r" ? "square" : "circle");
  const markerSize = frameIsOverlay ? frame.width : (frame.shape?.width || MARKER_SIZE);

  const content = `<div class="wh-callout-editor">
    <nav class="wh-callout-tabs">
      <a class="item active" data-tab="marker">Маркер</a>
      <a class="item" data-tab="line">Линия</a>
      <a class="item" data-tab="label">Лейбл</a>
    </nav>

    <section data-tab-panel="marker" class="active">
      <div class="atk-dlg-row">
        <label>Иконка (необязательно)</label>
        <img class="wh-callout-icon-preview" src="${esc(icon?.texture?.src || "")}" width="28" height="28"/>
        <input type="text" name="iconPath" value="${esc(icon?.texture?.src || "")}" style="flex:1"/>
        <button type="button" class="wh-callout-browse" data-target="iconPath">Обзор…</button>
        <button type="button" class="wh-callout-clear" data-target="iconPath">Очистить</button>
      </div>
      <div class="atk-dlg-row">
        <label>Размер маркера</label>
        <input type="number" name="markerSize" value="${markerSize}" min="8" max="300"/>
      </div>
      <div class="atk-dlg-row">
        <label>Форма рамки</label>
        <select name="frameShape">
          <option value="circle" ${frameShape === "circle" ? "selected" : ""}>Круг</option>
          <option value="square" ${frameShape === "square" ? "selected" : ""}>Квадрат</option>
          <option value="overlay" ${frameShape === "overlay" ? "selected" : ""}>Свой оверлей</option>
        </select>
      </div>
      <div class="atk-dlg-row wh-callout-overlay-row" style="${frameShape === "overlay" ? "" : "display:none;"}">
        <label>Картинка рамки</label>
        <img class="wh-callout-overlay-preview" src="${esc(frameIsOverlay ? frame.texture.src : "")}" width="28" height="28"/>
        <input type="text" name="overlayPath" value="${esc(frameIsOverlay ? frame.texture.src : "")}" style="flex:1"/>
        <button type="button" class="wh-callout-browse" data-target="overlayPath">Обзор…</button>
      </div>
      <div class="atk-dlg-row wh-callout-frame-style-row" style="${frameShape === "overlay" ? "display:none;" : ""}">
        <label>Цвет рамки</label>
        <input type="color" name="frameColor" value="${esc(frameIsOverlay ? LINE_COLOR : frame.strokeColor)}"/>
      </div>
      <div class="atk-dlg-row wh-callout-frame-style-row" style="${frameShape === "overlay" ? "display:none;" : ""}">
        <label>Толщина рамки</label>
        <input type="number" name="frameWidth" value="${frameIsOverlay ? 2 : frame.strokeWidth}" min="0" max="20"/>
      </div>
      <div class="atk-dlg-row wh-callout-frame-style-row" style="${frameShape === "overlay" ? "display:none;" : ""}">
        <label>Прозрачность рамки</label>
        <input type="number" name="frameAlpha" value="${frameIsOverlay ? 1 : frame.strokeAlpha}" min="0" max="1" step="0.05"/>
      </div>
      <div class="atk-dlg-row wh-callout-visibility-row">
        <label><input type="checkbox" name="markerHidden" ${frame.hidden ? "checked" : ""}/> Скрыто от игроков (иконка и рамка)</label>
      </div>
    </section>

    <section data-tab-panel="line">
      <div class="atk-dlg-row">
        <label>Толщина линии</label>
        <input type="number" name="lineWidth" value="${line.strokeWidth}" min="0" max="20"/>
      </div>
      <div class="atk-dlg-row">
        <label>Цвет линии</label>
        <input type="color" name="lineColor" value="${esc(line.strokeColor)}"/>
      </div>
      <div class="atk-dlg-row">
        <label>Прозрачность линии</label>
        <input type="number" name="lineAlpha" value="${line.strokeAlpha}" min="0" max="1" step="0.05"/>
      </div>
      <div class="atk-dlg-row">
        <label>Точка на маркере</label>
        <select name="markerAnchor">${anchorOptionsHtml(lineFlags.markerAnchor || "center")}</select>
      </div>
      <div class="atk-dlg-row">
        <label>Точка на лейбле</label>
        <select name="labelAnchor">${anchorOptionsHtml(lineFlags.labelAnchor || "center")}</select>
      </div>
    </section>

    <section data-tab-panel="label">
      <div class="atk-dlg-row">
        <label>Текст подписи</label>
        <input type="text" name="text" value="${esc(label.text)}"/>
      </div>
      <div class="atk-dlg-row">
        <label>Шрифт</label>
        <select name="fontFamily">${fontOptionsHtml(label.fontFamily)}</select>
      </div>
      <div class="atk-dlg-row">
        <label>Размер шрифта</label>
        <input type="number" name="fontSize" value="${label.fontSize}" min="8" max="120"/>
      </div>
      <div class="atk-dlg-row">
        <label>Цвет шрифта</label>
        <input type="color" name="textColor" value="${esc(label.textColor)}"/>
      </div>
      <div class="atk-dlg-row">
        <label>Цвет рамки</label>
        <input type="color" name="labelStrokeColor" value="${esc(label.strokeColor)}"/>
      </div>
      <div class="atk-dlg-row">
        <label>Толщина рамки</label>
        <input type="number" name="labelStrokeWidth" value="${label.strokeWidth}" min="0" max="20"/>
      </div>
      <div class="atk-dlg-row">
        <label>Прозрачность рамки</label>
        <input type="number" name="labelStrokeAlpha" value="${label.strokeAlpha}" min="0" max="1" step="0.05"/>
      </div>
      <div class="atk-dlg-row">
        <label>Ширина / высота</label>
        <input type="number" name="labelWidth" value="${label.shape.width}" min="40" max="1200"/>
        <input type="number" name="labelHeight" value="${label.shape.height}" min="20" max="600"/>
        <button type="button" class="wh-callout-autofit">Подогнать под текст</button>
      </div>
      <div class="atk-dlg-row wh-callout-visibility-row">
        <label><input type="checkbox" name="labelHidden" ${label.hidden ? "checked" : ""}/> Скрыто от игроков (подпись и линия)</label>
      </div>
    </section>
  </div>`;

  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: "Коллаут" },
    classes: ["warhammer-dbc", "wh-holo", "wh-callout-dialog"],
    position: { width: 420 },
    content,
    rejectClose: false,
    buttons: [
      { action: "save", label: "Сохранить", default: true, callback: (_e, button) => {
          const f = button.form.elements;
          return {
            iconPath: f.iconPath.value.trim(), markerSize: Number(f.markerSize.value) || markerSize,
            frameShape: f.frameShape.value, overlayPath: f.overlayPath.value.trim(),
            frameColor: f.frameColor.value, frameWidth: Number(f.frameWidth.value) || 0, frameAlpha: Number(f.frameAlpha.value),
            markerHidden: f.markerHidden.checked,
            lineWidth: Number(f.lineWidth.value) || 0, lineColor: f.lineColor.value, lineAlpha: Number(f.lineAlpha.value),
            markerAnchor: f.markerAnchor.value, labelAnchor: f.labelAnchor.value,
            text: f.text.value, fontFamily: f.fontFamily.value, fontSize: Number(f.fontSize.value) || 24,
            textColor: f.textColor.value,
            labelStrokeColor: f.labelStrokeColor.value, labelStrokeWidth: Number(f.labelStrokeWidth.value) || 0,
            labelStrokeAlpha: Number(f.labelStrokeAlpha.value),
            labelWidth: Number(f.labelWidth.value) || label.shape.width,
            labelHeight: Number(f.labelHeight.value) || label.shape.height,
            labelHidden: f.labelHidden.checked
          };
        } },
      { action: "cancel", label: "Отмена", callback: () => null }
    ],
    render: (_event, dialog) => {
      const root = dialog.element;

      root.querySelectorAll(".wh-callout-tabs .item").forEach(tab => {
        tab.addEventListener("click", () => {
          root.querySelectorAll(".wh-callout-tabs .item").forEach(t => t.classList.remove("active"));
          root.querySelectorAll("[data-tab-panel]").forEach(p => p.classList.remove("active"));
          tab.classList.add("active");
          root.querySelector(`[data-tab-panel="${tab.dataset.tab}"]`)?.classList.add("active");
        });
      });

      root.querySelectorAll(".wh-callout-browse").forEach(btn => {
        btn.addEventListener("click", () => {
          const input = root.querySelector(`[name="${btn.dataset.target}"]`);
          new (filePicker())({
            type: "image",
            current: input?.value || "",
            callback: (path) => {
              if (input) input.value = path;
              const preview = btn.closest(".atk-dlg-row")?.querySelector("img");
              if (preview) preview.src = path;
            }
          }).browse();
        });
      });

      root.querySelector(".wh-callout-clear")?.addEventListener("click", () => {
        const input = root.querySelector('[name="iconPath"]');
        if (input) input.value = "";
        const preview = root.querySelector(".wh-callout-icon-preview");
        if (preview) preview.src = "";
      });

      const shapeSel = root.querySelector('[name="frameShape"]');
      shapeSel?.addEventListener("change", () => {
        const overlay = shapeSel.value === "overlay";
        root.querySelectorAll(".wh-callout-overlay-row").forEach(r => { r.style.display = overlay ? "" : "none"; });
        root.querySelectorAll(".wh-callout-frame-style-row").forEach(r => { r.style.display = overlay ? "none" : ""; });
      });

      root.querySelector(".wh-callout-autofit")?.addEventListener("click", () => {
        const text = root.querySelector('[name="text"]')?.value;
        const fontFamily = root.querySelector('[name="fontFamily"]')?.value;
        const fontSize = Number(root.querySelector('[name="fontSize"]')?.value) || label.fontSize;
        const size = measureLabelSize(text, fontFamily, fontSize);
        const wInput = root.querySelector('[name="labelWidth"]');
        const hInput = root.querySelector('[name="labelHeight"]');
        if (wInput) wInput.value = size.width;
        if (hInput) hInput.value = size.height;
      });
    }
  });
  if (!result) return;

  const pairId = flag.pairId;
  _suppressCascade.add(pairId);
  try {
    // Центр подписи остаётся на месте при смене ширины/высоты — так же, как
    // при изменении размера маркера.
    const labelCenter = boxOf(label).center;
    await label.update({
      text: result.text, fontFamily: result.fontFamily, fontSize: result.fontSize,
      textColor: result.textColor,
      strokeColor: result.labelStrokeColor, strokeWidth: result.labelStrokeWidth, strokeAlpha: result.labelStrokeAlpha,
      x: labelCenter.x - result.labelWidth / 2, y: labelCenter.y - result.labelHeight / 2,
      "shape.width": result.labelWidth, "shape.height": result.labelHeight,
      // «Скрыто от игроков» лейбла — своя пара с линией, независимая от
      // маркера (см. syncHidden: sync теперь только внутри пары icon+frame
      // или label+line, не по всем четырём документам разом).
      hidden: result.labelHidden
    });
    await line.update({
      strokeColor: result.lineColor, strokeWidth: result.lineWidth, strokeAlpha: result.lineAlpha,
      hidden: result.labelHidden,
      [`flags.${SYSTEM}.${FLAG_KEY}.markerAnchor`]: result.markerAnchor,
      [`flags.${SYSTEM}.${FLAG_KEY}.labelAnchor`]: result.labelAnchor
    });

    const size = result.markerSize;
    const frameCenter = boxOf(frame).center;

    // Иконка — необязательная: создаём/обновляем/удаляем по факту наличия пути.
    if (result.iconPath) {
      if (icon) await icon.update({ x: frameCenter.x, y: frameCenter.y, width: size, height: size, "texture.src": result.iconPath, hidden: result.markerHidden });
      else await scene.createEmbeddedDocuments("Tile", [{
        x: frameCenter.x, y: frameCenter.y, width: size, height: size,
        texture: { src: result.iconPath, anchorX: 0.5, anchorY: 0.5, fit: "contain" },
        hidden: result.markerHidden,
        flags: { [SYSTEM]: { [FLAG_KEY]: { pairId, role: "icon" } } }
      }]);
    } else if (icon) {
      await icon.delete();
    }

    // Рамка — смена «формы» между векторной (Drawing) и оверлеем (Tile)
    // требует пересоздания документа другого типа, не просто update().
    const wantsOverlay = result.frameShape === "overlay";
    const frameIsTile = frame.documentName === "Tile";
    if (wantsOverlay !== frameIsTile) {
      await frame.delete();
      if (wantsOverlay) {
        await scene.createEmbeddedDocuments("Tile", [{
          x: frameCenter.x, y: frameCenter.y, width: size, height: size,
          texture: { src: result.overlayPath, anchorX: 0.5, anchorY: 0.5, fit: "contain" },
          hidden: result.markerHidden,
          flags: { [SYSTEM]: { [FLAG_KEY]: { pairId, role: "frame" } } }
        }]);
      } else {
        await scene.createEmbeddedDocuments("Drawing", [{
          x: frameCenter.x - size / 2, y: frameCenter.y - size / 2,
          shape: { type: result.frameShape === "circle" ? "e" : "r", width: size, height: size, points: [] },
          fillType: CONST.DRAWING_FILL_TYPES.NONE,
          strokeColor: result.frameColor, strokeWidth: result.frameWidth, strokeAlpha: result.frameAlpha,
          hidden: result.markerHidden,
          flags: { [SYSTEM]: { [FLAG_KEY]: { pairId, role: "frame" } } }
        }]);
      }
    } else if (wantsOverlay) {
      await frame.update({ width: size, height: size, "texture.src": result.overlayPath, hidden: result.markerHidden });
    } else {
      await frame.update({
        x: frameCenter.x - size / 2, y: frameCenter.y - size / 2,
        "shape.type": result.frameShape === "circle" ? "e" : "r",
        "shape.width": size, "shape.height": size,
        strokeColor: result.frameColor, strokeWidth: result.frameWidth, strokeAlpha: result.frameAlpha,
        hidden: result.markerHidden
      });
    }
  } finally {
    _suppressCascade.delete(pairId);
  }
  await syncLineFor(scene, pairId);
}

// Иконка и рамка маркера — визуально один объект: подвинули/растянули один
// из них (на канвасе можно двигать оба порознь — они на разных слоях,
// Tile/Drawing), второй должен последовать. Гвард против ping-pong
// обновлений (update одного вызывает update другого вызывает...).
const _syncingMarker = new Set();
async function syncMarkerPair(scene, pairId, sourceRole) {
  if (_syncingMarker.has(pairId)) return;
  const { icon, frame } = pairMembers(scene, pairId);
  if (!icon || !frame) return;
  _syncingMarker.add(pairId);
  try {
    if (sourceRole === "frame") {
      const fb = boxOf(frame);
      await icon.update({ x: fb.center.x, y: fb.center.y, width: fb.halfW * 2, height: fb.halfH * 2 });
    } else {
      const ib = boxOf(icon);
      if (frame.documentName === "Tile") {
        await frame.update({ x: ib.center.x, y: ib.center.y, width: ib.halfW * 2, height: ib.halfH * 2 });
      } else {
        await frame.update({
          x: ib.center.x - ib.halfW, y: ib.center.y - ib.halfH,
          "shape.width": ib.halfW * 2, "shape.height": ib.halfH * 2
        });
      }
    }
  } catch (e) { console.warn("Warhammer DBC | callout: не удалось синхронизировать иконку/рамку маркера", e); }
  finally { _syncingMarker.delete(pairId); }
}

export function registerCalloutHooks() {
  const onUpdate = (doc, changes) => {
    if (!game.user.isGM) return;
    if ("hidden" in changes) syncHidden(doc, changes.hidden);
    const flag = calloutFlag(doc);
    if (!flag) return;
    if (flag.role === "line") {
      // Геометрию самой линии (x/y/shape) не пересчитываем повторно — это
      // наша же запись из syncLineFor. Но смену точек соприкосновения
      // (markerAnchor/labelAnchor, тоже флаги линии) отработать надо.
      const calloutChanges = changes.flags?.[SYSTEM]?.[FLAG_KEY];
      if (calloutChanges && ("markerAnchor" in calloutChanges || "labelAnchor" in calloutChanges)) {
        syncLineFor(doc.parent, flag.pairId);
      }
      return;
    }
    if (!("x" in changes || "y" in changes || "width" in changes || "height" in changes || "shape" in changes)) return;
    if (flag.role === "frame" || flag.role === "icon") syncMarkerPair(doc.parent, flag.pairId, flag.role);
    syncLineFor(doc.parent, flag.pairId);
  };
  Hooks.on("updateDrawing", onUpdate);
  Hooks.on("updateTile", onUpdate);

  const onDelete = (doc) => { if (game.user.isGM) cascadeDelete(doc); };
  Hooks.on("deleteDrawing", onDelete);
  Hooks.on("deleteTile", onDelete);

  // Штатный конфиг Tile/Drawing для коллаута подменяется единым диалогом.
  const intercept = (app) => {
    if (!game.user.isGM) return;
    if (!calloutFlag(app.document)) return;
    app.close({ force: true });
    openCalloutEditor(app.document);
  };
  Hooks.on("renderTileConfig", intercept);
  Hooks.on("renderDrawingConfig", intercept);
}
