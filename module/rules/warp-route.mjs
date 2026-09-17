// module/rules/warp-route.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ВАРП-МАРШРУТ — чистая логика без Foundry (wdbc-r0w9). Обвязка с документами
//  (attach/detach, поиск связанных маршрутов, диалоги) — module/apps/warp-route.mjs.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Уровни Знания маршрута конкретным Проводником (раздел «Знание маршрута»,
 * книга). Модификатор идёт в Navigation (Warp), Шаги 4-5.
 */
export const ROUTE_KNOWLEDGE_LEVELS = {
  unknown:  { label: "Неизвестный",   mod: -10 },
  presumed: { label: "Предполагаемый", mod: 0 },
  known:    { label: "Известный",     mod: 10 },
  // 10 проходов тем же Проводником, карта для этого не нужна.
  learned:  { label: "Выученный",     mod: 20 },
  // Один маршрут, и только из уже Выученных.
  chosen:   { label: "Избранный",     mod: 30 }
};

export function routeKnowledgeMod(level) {
  return ROUTE_KNOWLEDGE_LEVELS[level]?.mod ?? ROUTE_KNOWLEDGE_LEVELS.unknown.mod;
}

/**
 * Каким полем маршрута занять привязку к системе systemUuid.
 *
 * @param {{systemAUuid?: string, systemBUuid?: string}} routeSystem  system маршрута
 * @param {string} systemUuid  UUID привязываемой Звёздной системы
 * @returns {"systemAUuid"|"systemBUuid"|"already"|null}
 *   "already" — этот конец уже занят именно этой системой (не ошибка, но и
 *   писать нечего); null — оба конца заняты ДРУГИМИ системами, привязка
 *   невозможна без явного отсоединения одной из них.
 */
export function pickAttachSlot(routeSystem, systemUuid) {
  const a = routeSystem?.systemAUuid || "";
  const b = routeSystem?.systemBUuid || "";
  if (a === systemUuid || b === systemUuid) return "already";
  if (!a) return "systemAUuid";
  if (!b) return "systemBUuid";
  return null;
}

/** Каким полем маршрут привязан к systemUuid — для отсоединения/отображения. */
export function slotOf(routeSystem, systemUuid) {
  if (!systemUuid) return null;
  if (routeSystem?.systemAUuid === systemUuid) return "systemAUuid";
  if (routeSystem?.systemBUuid === systemUuid) return "systemBUuid";
  return null;
}

/** Найден ли этот маршрут среди принадлежащих системе systemUuid (любой конец). */
export function routeTouchesSystem(routeSystem, systemUuid) {
  return !!slotOf(routeSystem, systemUuid);
}
