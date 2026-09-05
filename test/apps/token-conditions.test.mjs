// test/apps/token-conditions.test.mjs
//
// CONFIG.statusEffects раньше оставался дефолтным набором Foundry, никак не
// связанным с system.conditions листа — иконка на токене и тег на листе
// жили в двух разных мирах. buildConditionStatusEffects строит статус-набор
// токена ИЗ CONDITIONS_DEF, тем же ключом (id === system.conditions.<key>),
// чтобы module/apps/token-conditions.mjs мог синхронизировать их хуками
// updateActor/createActiveEffect/deleteActiveEffect (сами хуки — no-op в
// тестовом Hooks-заглушке, проверяем только состав набора).

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { CONDITIONS_DEF } from "../../module/constants/conditions.mjs";
import { buildConditionStatusEffects, statusIconUri } from "../../module/apps/token-conditions.mjs";

beforeEach(() => {
  CONFIG.specialStatusEffects = { DEFEATED: "dead", INVISIBLE: "invisible", BLIND: "blind" };
  CONFIG.statusEffects = [
    { id: "dead", name: "Повержен", img: "icons/svg/skull.svg" },
    { id: "invisible", name: "Невидим", img: "icons/svg/invisible.svg" }
  ];
});

describe("buildConditionStatusEffects", () => {
  it("несёт каждое состояние CONDITIONS_DEF своим id/названием, кроме «Усталости»", () => {
    const effects = buildConditionStatusEffects();
    const byId = Object.fromEntries(effects.map(e => [e.id, e]));

    for (const [key, def] of Object.entries(CONDITIONS_DEF)) {
      if (key === "fatigued") continue;
      expect(byId[key], `нет статус-эффекта для ${key}`).toBeTruthy();
      expect(byId[key].name).toBe(def.label);
      expect(byId[key].img).toBe(`systems/warhammer-dbc/assets/conditions/${key}.svg`);
    }
  });

  it("«Усталость» не входит в статус-набор токена — это счётчик, не тумблер", () => {
    const effects = buildConditionStatusEffects();
    expect(effects.some(e => e.id === "fatigued")).toBe(false);
  });

  it("сохраняет «Повержен» ядра (CONFIG.specialStatusEffects.DEFEATED) — на нём завязан трекер боя", () => {
    const effects = buildConditionStatusEffects();
    expect(effects[0]).toEqual({ id: "dead", name: "Повержен", img: "icons/svg/skull.svg" });
  });

  it("без дефолтного «Повержен» в CONFIG — просто не добавляет его, не падает", () => {
    CONFIG.statusEffects = [];
    const effects = buildConditionStatusEffects();
    expect(effects.some(e => e.id === "dead")).toBe(false);
    expect(effects.length).toBe(Object.keys(CONDITIONS_DEF).length - 1);
  });
});

// wdbc-ahtb.1: Foundry v14 валидирует img создаваемого ActiveEffect как
// FilePathField — data:image/svg+xml,... (как было раньше) этой валидации
// не проходит, actor.toggleStatusEffect падал на КАЖДОМ Состоянии, иконка
// на токене не появлялась никогда. Теперь — настоящий путь к файлу,
// сгенерированному tools/build-condition-icons.mjs.
describe("statusIconUri", () => {
  it("настоящий путь к файлу (FilePathField Foundry v14), не data: URI", () => {
    const uri = statusIconUri("bleeding");
    expect(uri).toBe("systems/warhammer-dbc/assets/conditions/bleeding.svg");
    expect(uri).not.toMatch(/^data:/);
  });

  it("неизвестный ключ — безопасный запасной значок, не падает", () => {
    expect(statusIconUri("no-such-condition")).toBe("icons/svg/hazard.svg");
  });
});
