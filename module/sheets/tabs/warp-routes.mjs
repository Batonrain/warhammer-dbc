// module/sheets/tabs/warp-routes.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Раздел «ВАРП-МАРШРУТЫ» на вкладке МИСТИКА (Книга Пустоты v.2, wdbc-r0w9).
//
//  Отпирается Навыком Navigation (Warp) ≥1 у ЛЮБОГО типа существа с общей
//  схемой (Персонаж/Демон/Принц Демона — module/data/actor/_creature.mjs),
//  не только у Персонажа: раздел «Проводники» книги допускает псайкера,
//  демона, одержимого и принца демонов Проводником не хуже смертного —
//  решение принято с Сергеем 17.09.2026.
//
//  Список — это system.knownRoutes (актор), КАЖДАЯ запись {routeUuid, level}
//  отдельно от самого предмета Маршрута (module/data/item/warp-route.mjs):
//  признаки маршрута общие, а Знание — индивидуально у каждого Проводника
//  (тот же приём, что у `dp.system.dp.gifts` Демона-Принца).
// ════════════════════════════════════════════════════════════════════════════

import { ROUTE_KNOWLEDGE_LEVELS } from "../../rules/warp-route.mjs";
import { pickWarpRouteDialog } from "../../apps/warp-route.mjs";

/** Варианты уровня Знания для <select> строки — с модификатором в подписи. */
export const ROUTE_KNOWLEDGE_LEVEL_OPTIONS = Object.entries(ROUTE_KNOWLEDGE_LEVELS)
  .map(([key, def]) => ({ key, label: `${def.label} (${def.mod >= 0 ? "+" : ""}${def.mod})` }));

/**
 * Хотя бы один уровень группового Навыка Navigation (Warp). Отсутствие
 * `groupSkills` (например, у Миньона — своя урезанная схема) не ошибка, а
 * просто «нет» — раздел молча не показывается.
 */
export function hasNavigationWarp(actor) {
  const entries = actor?.system?.groupSkills?.navigation;
  if (!Array.isArray(entries)) return false;
  return entries.some(e => e?.specialty === "warp" && e?.rank && e.rank !== "untrained");
}

/** Строки раздела: по известному маршруту на строку. Синхронно — fromUuidSync,
 *  мировой предмет уже загружен, так же как followerRow (sheets/tabs/command.mjs). */
export function warpRoutesTabContext(actor) {
  const known = Array.isArray(actor?.system?.knownRoutes) ? actor.system.knownRoutes : [];
  return known.map((k, idx) => {
    let route = null;
    try { route = fromUuidSync(k.routeUuid); } catch { route = null; }
    const level = ROUTE_KNOWLEDGE_LEVELS[k.level] ? k.level : "unknown";
    return {
      idx,
      routeUuid: k.routeUuid || "",
      name: route?.name || "(маршрут недоступен)",
      img: route?.img || "icons/svg/mystery-man.svg",
      missing: !route,
      level,
      levelOptions: ROUTE_KNOWLEDGE_LEVEL_OPTIONS.map(o => ({ ...o, selected: o.key === level }))
    };
  });
}

export function activateWarpRoutesListeners(html, actor) {
  html.find(".warp-route-add-btn").on("click", async ev => {
    ev.preventDefault();
    const known = Array.isArray(actor.system.knownRoutes) ? actor.system.knownRoutes : [];
    const route = await pickWarpRouteDialog({ exclude: known.map(k => k.routeUuid).filter(Boolean) });
    if (!route) return;
    await actor.update({ "system.knownRoutes": [...known, { routeUuid: route.uuid, level: "presumed" }] });
  });

  html.find(".warp-route-level-select").on("change", async ev => {
    const idx = Number(ev.currentTarget.dataset.index);
    const known = foundry.utils.deepClone(actor.system.knownRoutes || []);
    if (!known[idx]) return;
    known[idx].level = ev.currentTarget.value;
    await actor.update({ "system.knownRoutes": known });
  });

  html.find(".warp-route-remove-btn").on("click", async ev => {
    const idx = Number(ev.currentTarget.dataset.index);
    const known = (actor.system.knownRoutes || []).filter((_, i) => i !== idx);
    await actor.update({ "system.knownRoutes": known });
  });

  html.find(".warp-route-open-link").on("click", ev => {
    const uuid = ev.currentTarget.dataset.uuid;
    if (uuid) fromUuid(uuid).then(d => d?.sheet?.render(true)).catch(() => {});
  });
}
