// test/apps/hud-sidebar-inset.test.mjs
//
// Sahara hud-1024-px (dbc-80): на узком окне (1024 px) раскрытый чат — правая
// колонка Foundry #sidebar — накрывал кнопку «Ход» боевого HUD: панель стояла
// с right: 0 под колонкой. Теперь HUD отступает справа на ширину, которую
// колонка реально занимает (--wh-hud-right), и сжимается в оставшееся место.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { sidebarRightInset, syncSidebarInset } from "../../module/apps/hud.mjs";

describe("sidebarRightInset: сколько места справа занимает чат", () => {
  it("раскрытый чат 300 px на окне 1024 — отступ 300", () => {
    expect(sidebarRightInset(1024, { left: 724, width: 300 })).toBe(300);
  });

  it("свёрнутый чат — только полоса вкладок", () => {
    expect(sidebarRightInset(1024, { left: 984, width: 40 })).toBe(40);
  });

  it("колонки нет или она скрыта — отступа нет", () => {
    expect(sidebarRightInset(1024, null)).toBe(0);
    expect(sidebarRightInset(1024, { left: 0, width: 0 })).toBe(0);
  });

  it("колонка уехала за край экрана — отступ не отрицательный", () => {
    expect(sidebarRightInset(1024, { left: 1100, width: 300 })).toBe(0);
  });
});

describe("syncSidebarInset: переменная --wh-hud-right на панели", () => {
  it("ставит отступ по прямоугольнику #sidebar", () => {
    const props = {};
    const el = { style: { setProperty: (k, v) => { props[k] = v; } } };
    const sidebar = { getBoundingClientRect: () => ({ left: 724, width: 300 }) };
    syncSidebarInset(el, { sidebar, viewportWidth: 1024 });
    expect(props["--wh-hud-right"]).toBe("300px");
  });
});

describe("hud.css: правый край панели — от переменной, а не 0", () => {
  it("#wh-hud { right: var(--wh-hud-right …) }", () => {
    const css = readFileSync(new URL("../../styles/ui/hud.css", import.meta.url), "utf8");
    const block = css.match(/#wh-hud\s*\{[^}]*\}/)?.[0] ?? "";
    expect(block).toMatch(/right:\s*var\(--wh-hud-right/);
  });
});
