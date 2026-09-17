// module/apps/warp-route.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Обвязка Foundry для Варп-маршрута (wdbc-r0w9): поиск маршрутов, привязанных
//  к Звёздной системе, привязка/отвязка с любой из двух сторон (лист Системы
//  или лист самого Маршрута). Чистая логика слотов — module/rules/warp-route.mjs.
//
//  Маршрут — мировой предмет (НЕ вложен ни в одну систему), поэтому список
//  «маршруты этой системы» не хранится нигде явно: он всегда собирается
//  запросом по game.items в момент рендера листа, а не в prepareDerivedData
//  (там читать чужие/мировые документы запрещено — см. actor.mjs, комментарий
//  у Отряда про «прочитать чужой документ на этапе загрузки мира нельзя»).
// ════════════════════════════════════════════════════════════════════════════

import { pickAttachSlot, slotOf } from "../rules/warp-route.mjs";
import { generateRouteTraits, routeCategoryFor, routeTypeFor, routeLoreFor,
         routeIlluminationFor, routeStabilityFor, effectiveIllumination } from "../rules/warp-route-traits.mjs";
import { esc } from "../helpers/utils.mjs";

/** Все мировые предметы-маршруты, привязанные к этой Звёздной системе (любой конец). */
export function linkedWarpRoutes(systemActor) {
  const uuid = systemActor?.uuid;
  if (!uuid || !game.items) return [];
  return game.items.filter(i => i.type === "warpRoute"
    && (i.system.systemAUuid === uuid || i.system.systemBUuid === uuid));
}

/** Все маршруты в мире (для диалога «выбрать существующий маршрут»). */
export function allWarpRoutes() {
  if (!game.items) return [];
  return game.items.filter(i => i.type === "warpRoute");
}

/**
 * Привязать маршрут к системе: первый свободный слот, независимо от того, с
 * какого листа вызвано. Уже привязан — тихо ничего не делает. Оба слота заняты
 * ДРУГИМИ системами — отказ с предупреждением (у маршрута ровно два конца).
 *
 * @returns {Promise<boolean>} true, если что-то записалось (или уже было верно)
 */
export async function attachRouteToSystem(route, systemActor) {
  if (!route || route.type !== "warpRoute" || !systemActor) return false;
  const slot = pickAttachSlot(route.system, systemActor.uuid);
  if (slot === "already") return true;
  if (!slot) {
    ui.notifications.warn(
      `«${esc(route.name)}» уже соединяет две другие системы — сперва отсоедините одну из них.`);
    return false;
  }
  await route.update({ [`system.${slot}`]: systemActor.uuid });
  return true;
}

/** Отвязать маршрут от системы (очищает тот конец, где она сейчас числится). */
export async function detachRouteFromSystem(route, systemActor) {
  const slot = slotOf(route?.system, systemActor?.uuid);
  if (!slot) return false;
  await route.update({ [`system.${slot}`]: "" });
  return true;
}

/** Явно задать конкретный слот (лист самого Маршрута — оба конца видны сразу,
 *  выбор слота не нужно угадывать, как при привязке со стороны Системы). */
export async function setRouteSlot(route, slot, systemActor) {
  if (!route || (slot !== "systemAUuid" && slot !== "systemBUuid")) return false;
  await route.update({ [`system.${slot}`]: systemActor?.uuid || "" });
  return true;
}

/**
 * Признаки маршрута, резолвленные из его rating (1d10) в полные строки книжных
 * таблиц. Пустой rating (0 — маршрут ещё не сгенерирован) даёт null для этого
 * признака, а не строку-заглушку из lookup-фолбэка «последняя строка таблицы».
 */
export function resolveRouteRows(route) {
  const s = route?.system || {};
  const row = (table, rating) => (Number(rating) > 0 ? table(rating) : null);
  return {
    category:     row(routeCategoryFor, s.category?.rating),
    routeType:    row(routeTypeFor, s.routeType?.rating),
    lore:         row(routeLoreFor, s.lore?.rating),
    illumination: row(routeIlluminationFor, s.illumination?.rating),
    stability:    row(routeStabilityFor, s.stability?.rating)
  };
}

/**
 * Уровень Знания ЭТОГО Проводника (actor) о ЭТОМ маршруте — из
 * actor.system.knownRoutes, либо "unknown" по умолчанию (Проводник без
 * Таланта Lodesman начинает игру без маршрутов — все пути Неизвестные).
 * Признак маршрута «Неизведанный» (Изученность 10) форсирует Неизвестный
 * ВСЕГДА, независимо от knownRoutes — книга: «пока кто-то не пройдёт первым».
 */
export function routeKnowledgeLevelFor(actor, route, loreRow) {
  if (loreRow?.forcesUnknown) return "unknown";
  const entry = (actor?.system?.knownRoutes || []).find(k => k.routeUuid === route?.uuid);
  return entry?.level || "unknown";
}

/** Освещённость, как её увидит ЭТОТ Проводник (поправка «Ясный→Тусклый» на
 *  Неизвестном маршруте) — тонкая обёртка вокруг чистой функции для вызова
 *  прямо с actor+route, не с уже резолвленным уровнем Знания. */
export function effectiveIlluminationFor(actor, route, rows) {
  const level = routeKnowledgeLevelFor(actor, route, rows.lore);
  return effectiveIllumination(rows.illumination, level);
}

/** {uuid, name, img} привязанной системы для отображения на листе Маршрута, либо null. */
export async function resolveLinkedSystem(uuid) {
  if (!uuid) return null;
  const actor = await fromUuid(uuid).catch(() => null);
  if (!actor) return { uuid, name: "(система недоступна)", img: "icons/svg/mystery-man.svg", missing: true };
  return { uuid, name: actor.name, img: actor.img || "icons/svg/mystery-man.svg", missing: false };
}

/** Общий выбор из списка {uuid, name} диалогом с одним select — «+» без drag-n-drop. */
function pickFromList(title, entries, emptyMsg) {
  if (!entries.length) {
    ui.notifications.info(emptyMsg);
    return Promise.resolve(null);
  }
  const opts = entries.map(e => `<option value="${e.uuid}">${esc(e.name)}</option>`).join("");
  return foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<div class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-row"><select id="wr-pick">${opts}</select></div>
    </div>`,
    buttons: [
      { action: "ok", label: "Привязать", icon: "fas fa-link", default: true,
        callback: (event, button) => button.form.querySelector("#wr-pick").value },
      { action: "cancel", label: "Отмена" }
    ]
  }).then(result => (typeof result === "string" ? fromUuid(result) : null));
}

/** Диалог выбора уже существующего мирового предмета «Маршрут» (лист Системы). */
export function pickWarpRouteDialog({ exclude = [] } = {}) {
  const candidates = allWarpRoutes().filter(r => !exclude.includes(r.uuid));
  return pickFromList("Привязать варп-маршрут", candidates,
    "В мире нет ни одного предмета «Варп-маршрут» — создайте его сначала.");
}

/** Диалог выбора существующей Звёздной системы (лист самого Маршрута). */
export function pickStarSystemDialog({ exclude = [] } = {}) {
  const candidates = game.actors.filter(a => a.type === "starSystem" && !exclude.includes(a.uuid));
  return pickFromList("Привязать Звёздную систему", candidates,
    "В мире нет ни одной Звёздной системы — создайте её сначала.");
}

/**
 * Диалог «сколько раз бросить по Особенностям» (книга: «МИ выбирает любое
 * число Особенностей или бросает по d100 столько раз, сколько сочтёт
 * нужным») → бросок пяти 1d10-признаков + featureCount раз по Особенностям
 * → перезаписывает system целиком (существующие Особенности заменяются, не
 * добавляются — это «сгенерировать заново», а не «добросить ещё одну»).
 */
export async function generateRouteTraitsDialog(route) {
  if (!route || route.type !== "warpRoute") return false;
  const count = await foundry.applications.api.DialogV2.wait({
    window: { title: "Сгенерировать признаки маршрута" },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<div class="wh-wizard-form" style="padding:6px;">
      <p class="ss-gen-hint">Категория/Тип/Изученность/Освещённость/Стабильность бросятся автоматически (1d10 каждая). Особенности — d100, сколько раз бросить (МИ решает сам, книга не задаёт число).</p>
      <div class="atk-dlg-row"><label>Особенностей:</label>
        <input type="number" id="wr-feat-count" value="1" min="0" max="12"/></div>
    </div>`,
    buttons: [
      { action: "ok", label: "Бросить", icon: "fas fa-dice", default: true,
        callback: (event, button) => Number(button.form.querySelector("#wr-feat-count").value) || 0 },
      { action: "cancel", label: "Отмена" }
    ]
  });
  if (typeof count !== "number") return false;
  const traits = generateRouteTraits(count);
  await route.update({
    "system.category": traits.category,
    "system.routeType": traits.routeType,
    "system.lore": traits.lore,
    "system.illumination": traits.illumination,
    "system.stability": traits.stability,
    "system.features": traits.features
  });
  return true;
}
