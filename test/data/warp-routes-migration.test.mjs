// test/data/warp-routes-migration.test.mjs
//
// system.warpRoutes (Звёздная система) было свободным HTML-текстом ГМа.
// Заменено структурными предметами «Маршрут» (wdbc-r0w9), но непустой текст
// не выбрасывается — переезжает в gmNotes (см. migrateWarpRoutesString,
// тот же приём, что у migrateReactionsString для system.reactions).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { migrateWarpRoutesString } from "../../module/data/actor/star-system.mjs";

describe("migrateWarpRoutesString", () => {
  it("непустой текст уезжает в gmNotes, поле снимается", () => {
    const src = { warpRoutes: "<p>Точка Мандевиля к Гелиону</p>", gmNotes: "<p>старое</p>" };
    migrateWarpRoutesString(src);
    expect(src.warpRoutes).toBeUndefined();
    expect(src.gmNotes).toContain("старое");
    expect(src.gmNotes).toContain("Точка Мандевиля к Гелиону");
  });

  it("пустой текст просто снимается, gmNotes не трогается", () => {
    const src = { warpRoutes: "", gmNotes: "" };
    migrateWarpRoutesString(src);
    expect(src.warpRoutes).toBeUndefined();
    expect(src.gmNotes).toBe("");
  });

  it("без поля — ничего не делает", () => {
    const src = { gmNotes: "" };
    migrateWarpRoutesString(src);
    expect(src.warpRoutes).toBeUndefined();
    expect(src.gmNotes).toBe("");
  });
});
