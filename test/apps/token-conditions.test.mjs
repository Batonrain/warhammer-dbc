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
import { buildConditionStatusEffects, statusIconUri, syncFromEffect } from "../../module/apps/token-conditions.mjs";

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

// ── wdbc-6xhl: у меток иконка на токене не появлялась вовсе ─────────────────
// Тег в блоке СОСТОЯНИЯ был, а на токене — ничего, ни для Ярости, ни для Бега,
// ни для остальных. Хук ловил Состояния по тому, что буквально пришло в патче
// (system.conditions.<ключ>), а метки туда не пишутся НИКОГДА: их источники —
// system.inRage, флаги актора, флаг на щите. Решение переехало сюда чистой
// функцией именно потому, что хук в заглушке — no-op и ничего не доказывает.
import { markStatusPlan } from "../../module/apps/token-conditions.mjs";
import { MIRROR_KEYS } from "../../module/rules/condition-mirrors.mjs";

describe("markStatusPlan: метки на токене", () => {
  it("метка стоит, иконки нет — зажечь", () => {
    expect(markStatusPlan({ inRage: true }, new Set())).toEqual({ add: ["inRage"], remove: [] });
  });

  it("метки нет, иконка висит — погасить", () => {
    expect(markStatusPlan({}, new Set(["running"]))).toEqual({ add: [], remove: ["running"] });
  });

  it("уже сошлось — ничего не делать (иначе хук зациклился бы сам на себе)", () => {
    expect(markStatusPlan({ inRage: true }, new Set(["inRage"]))).toEqual({ add: [], remove: [] });
    expect(markStatusPlan({ inRage: false }, new Set())).toEqual({ add: [], remove: [] });
  });

  it("книжные Состояния план не трогает — у них свой путь по патчу", () => {
    const plan = markStatusPlan({ stunned: true, prone: true }, new Set());
    expect(plan.add).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it("несколько меток разом, в обе стороны", () => {
    const plan = markStatusPlan({ inRage: true, marked: true }, new Set(["running", "marked"]));
    expect(plan.add.sort()).toEqual(["inRage"]);
    expect(plan.remove.sort()).toEqual(["running"]);
  });

  it("каждая метка вообще может попасть на токен — ни одна не исключена молча", () => {
    const all = Object.fromEntries(MIRROR_KEYS.map(k => [k, true]));
    expect(markStatusPlan(all, new Set()).add.sort()).toEqual([...MIRROR_KEYS].sort());
  });

  it("пустые входные данные не роняют", () => {
    expect(markStatusPlan()).toEqual({ add: [], remove: [] });
    expect(markStatusPlan(null, null)).toEqual({ add: [], remove: [] });
  });
});

// ── wdbc-2gn (находка 5, ревью 07.09.2026): снятие метки-с-предмета через
// HUD токена не возвращало иконку на место ────────────────────────────────
//
// «Щит поднят» (shieldUp) зеркалится с ФЛАГА ПРЕДМЕТА (щита), а не с поля
// актора — mirrorClearPatch у неё пуст, isMirrorClearable("shieldUp") === false.
// syncFromEffect вызывается уже ПОСЛЕ deleteActiveEffect (Foundry сам снял
// иконку до вызова хука): раньше ветка только показывала уведомление и
// возвращалась, ничего не воссоздавая — обещание «возвращаем иконку на
// место» не выполнялось. Хуки в заглушке (Hooks.on) — no-op и не запоминают
// колбэки, поэтому проверяется прямым вызовом экспортированной
// syncFromEffect, а не через настоящий Hooks.callAll.
describe("syncFromEffect: снятие иконки метки-с-предмета возвращает её на место", () => {
  const shieldItem = (raised) => ({
    id: "shield-1", type: "armor",
    getFlag: (scope, key) => (scope === "warhammer-dbc" && key === "shieldRaised" ? raised : undefined),
    flags: {}
  });

  function ogrynActor({ shieldRaised = false } = {}) {
    const a = Object.assign(new Actor(), {
      id: "a1", name: "Испытуемый",
      system: { conditions: { shieldUp: shieldRaised } },
      items: [shieldItem(shieldRaised)],
      toggleStatusEffect: async () => {},
      update: async () => {}
    });
    return a;
  }

  beforeEach(() => { game.user = { id: "u1" }; });

  it("«Щит поднят» снят HUD-иконкой, но щит на предмете всё ещё поднят — иконка восстанавливается", async () => {
    const actor = ogrynActor({ shieldRaised: true }); // источник (флаг щита) всё ещё активен
    let toggled = null;
    actor.toggleStatusEffect = async (key, opts) => { toggled = { key, opts }; };
    const effect = { parent: actor, statuses: new Set(["shieldUp"]), delete: async () => {} };

    await syncFromEffect(effect, {}, "u1", /* removed */ true);

    expect(toggled).toEqual({ key: "shieldUp", opts: { active: true } });
  });

  it("книжное Состояние (не метка-с-предмета) по-прежнему снимается патчем актора, без восстановления", async () => {
    const actor = Object.assign(new Actor(), {
      id: "a2", name: "Испытуемый-2",
      system: { conditions: { stunned: true } },
      items: [],
      toggleStatusEffect: async () => {},
      update: async () => {}
    });
    let toggled = false;
    let updated = null;
    actor.toggleStatusEffect = async () => { toggled = true; };
    actor.update = async (fields) => { updated = fields; };
    const effect = { parent: actor, statuses: new Set(["stunned"]), delete: async () => {} };

    await syncFromEffect(effect, {}, "u1", true);

    expect(toggled).toBe(false); // не метка-с-предмета — восстановление не про неё
    expect(updated).toBeTruthy(); // патч актора всё же применяется
  });
});
