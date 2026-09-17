import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { resolveRouteRows, routeKnowledgeLevelFor, effectiveIlluminationFor } from "../../module/apps/warp-route.mjs";

const route = (system) => ({ uuid: "Item.route1", type: "warpRoute", system });

describe("resolveRouteRows: признаки маршрута из rating", () => {
  it("все rating заполнены — все строки резолвятся", () => {
    const rows = resolveRouteRows(route({
      category: { rating: 1 }, routeType: { rating: 1 }, lore: { rating: 1 },
      illumination: { rating: 1 }, stability: { rating: 1 }
    }));
    expect(rows.category.label).toBe("Прямой маршрут");
    expect(rows.routeType.label).toBe("Магистральный");
    expect(rows.lore.label).toBe("Задокументированный");
    expect(rows.illumination.label).toBe("Светозарный");
    expect(rows.stability.label).toBe("Спокойный");
  });

  it("rating 0 (не сгенерировано) — null, не строка-заглушка", () => {
    const rows = resolveRouteRows(route({ category: { rating: 0 } }));
    expect(rows.category).toBeNull();
  });

  it("маршрута нет вовсе (route=null) — все null, без исключения", () => {
    const rows = resolveRouteRows(null);
    expect(rows.category).toBeNull();
    expect(rows.stability).toBeNull();
  });
});

describe("routeKnowledgeLevelFor: Знание Проводника о маршруте", () => {
  it("нет записи в knownRoutes — unknown", () => {
    const actor = { system: { knownRoutes: [] } };
    expect(routeKnowledgeLevelFor(actor, route({}), null)).toBe("unknown");
  });

  it("есть запись — возвращает её level", () => {
    const actor = { system: { knownRoutes: [{ routeUuid: "Item.route1", level: "learned" }] } };
    expect(routeKnowledgeLevelFor(actor, route({}), null)).toBe("learned");
  });

  it("Изученность «Неизведанный» форсирует unknown, даже если запись говорит другое", () => {
    const actor = { system: { knownRoutes: [{ routeUuid: "Item.route1", level: "chosen" }] } };
    expect(routeKnowledgeLevelFor(actor, route({}), { forcesUnknown: true })).toBe("unknown");
  });

  it("actor не задан (нет Проводника) — unknown, не исключение", () => {
    expect(routeKnowledgeLevelFor(null, route({}), null)).toBe("unknown");
  });
});

describe("effectiveIlluminationFor: обёртка actor+route", () => {
  it("Ясный + Неизвестный маршрут (этому Проводнику) → Тусклый", () => {
    const r = route({ illumination: { rating: 4 } }); // 2-6 = Ясный
    const rows = resolveRouteRows(r);
    const actor = { system: { knownRoutes: [] } }; // нет записи → unknown
    expect(effectiveIlluminationFor(actor, r, rows).label).toBe("Тусклый");
  });

  it("Ясный + Известный этому Проводнику → без изменений", () => {
    const r = route({ illumination: { rating: 4 } });
    const rows = resolveRouteRows(r);
    const actor = { system: { knownRoutes: [{ routeUuid: r.uuid, level: "known" }] } };
    expect(effectiveIlluminationFor(actor, r, rows).label).toBe("Ясный");
  });
});
