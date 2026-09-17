// test/sheets/warp-routes-tab.test.mjs
//
// Раздел «Варп-маршруты» на вкладке МИСТИКА (wdbc-r0w9): гейт по Навыку
// Navigation (Warp) и строки Знания у конкретного Проводника.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { hasNavigationWarp, warpRoutesTabContext, ROUTE_KNOWLEDGE_LEVEL_OPTIONS }
  from "../../module/sheets/tabs/warp-routes.mjs";

describe("hasNavigationWarp: гейт раздела", () => {
  it("нет groupSkills вовсе (напр. Миньон) — false, не ошибка", () => {
    expect(hasNavigationWarp({ system: {} })).toBe(false);
  });

  it("groupSkills.navigation пуст — false", () => {
    expect(hasNavigationWarp({ system: { groupSkills: { navigation: [] } } })).toBe(false);
  });

  it("есть Navigation (Surface), но не (Warp) — false", () => {
    const actor = { system: { groupSkills: { navigation: [{ specialty: "surface", rank: "trained" }] } } };
    expect(hasNavigationWarp(actor)).toBe(false);
  });

  it("Navigation (Warp) тренирован — true", () => {
    const actor = { system: { groupSkills: { navigation: [{ specialty: "warp", rank: "trained" }] } } };
    expect(hasNavigationWarp(actor)).toBe(true);
  });

  it("запись есть, но rank явно untrained — false", () => {
    const actor = { system: { groupSkills: { navigation: [{ specialty: "warp", rank: "untrained" }] } } };
    expect(hasNavigationWarp(actor)).toBe(false);
  });
});

describe("warpRoutesTabContext: строки Знания", () => {
  const routes = new Map([
    ["Item.route1", { uuid: "Item.route1", name: "Точка Мандевиля", img: "route.png", type: "warpRoute" }]
  ]);
  beforeEach(() => {
    globalThis.fromUuidSync = uuid => routes.get(uuid) ?? null;
  });

  it("пустой knownRoutes — пустой список", () => {
    expect(warpRoutesTabContext({ system: {} })).toEqual([]);
  });

  it("известный маршрут резолвится по имени/картинке", () => {
    const rows = warpRoutesTabContext({
      system: { knownRoutes: [{ routeUuid: "Item.route1", level: "known" }] }
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ idx: 0, name: "Точка Мандевиля", img: "route.png", missing: false, level: "known" });
  });

  it("маршрут не резолвится (удалён/чужой мир) — missing, подпись-заглушка", () => {
    const rows = warpRoutesTabContext({
      system: { knownRoutes: [{ routeUuid: "Item.gone", level: "learned" }] }
    });
    expect(rows[0].missing).toBe(true);
    expect(rows[0].name).toBe("(маршрут недоступен)");
  });

  it("незнакомый/пустой level — трактуется как unknown", () => {
    const rows = warpRoutesTabContext({
      system: { knownRoutes: [{ routeUuid: "Item.route1", level: "" }] }
    });
    expect(rows[0].level).toBe("unknown");
  });

  it("levelOptions отмечает ровно текущий уровень выбранным", () => {
    const rows = warpRoutesTabContext({
      system: { knownRoutes: [{ routeUuid: "Item.route1", level: "chosen" }] }
    });
    const selected = rows[0].levelOptions.filter(o => o.selected);
    expect(selected).toHaveLength(1);
    expect(selected[0].key).toBe("chosen");
  });
});

describe("ROUTE_KNOWLEDGE_LEVEL_OPTIONS: подписи с модификатором", () => {
  it("пять уровней, каждый с числом со знаком", () => {
    expect(ROUTE_KNOWLEDGE_LEVEL_OPTIONS).toHaveLength(5);
    const chosen = ROUTE_KNOWLEDGE_LEVEL_OPTIONS.find(o => o.key === "chosen");
    expect(chosen.label).toContain("+30");
    const unknown = ROUTE_KNOWLEDGE_LEVEL_OPTIONS.find(o => o.key === "unknown");
    expect(unknown.label).toContain("-10");
  });
});
