// test/rules/null-zones-paths.test.mjs
//
// Ауры Парии/Дискорданта на настоящих путях, а не на голых предикатах:
//  • Непрямая сила (пометка в данных пака) проходит сквозь Пустоту на всех
//    трёх стыках — окно манифестации (sheets/tabs/psychic.mjs), кнопка теста
//    Сопротивления и кнопка урона карточки (hooks.mjs → combat/damage.mjs).
//    Карточку собирает сам executePsychotest, её data-атрибуты едут в
//    обработчик hooks.mjs как есть.
//  • Техночудо в поле Дискорданта — Критический Провал и при пороге ≥ 100
//    (sheets/tabs/tech.mjs).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { showManifestDialog, executePsychotest } from "../../module/sheets/tabs/psychic.mjs";
import { activateTechMiracle } from "../../module/sheets/tabs/tech.mjs";

const TRAITS = "packs-src/traits/Трейты_рас";
const VOID = packDocById(TRAITS, "PariahVoidZone01");
const FIELD = packDocById(TRAITS, "DiscordFieldZn01");
// Таран (Атака · Стрельба · Непрямое) и Статический Разряд (Изменение ·
// Касание · Непрямое, тест Сопротивления T и урон) — настоящие JSON пака.
const TARAN = packDocById("packs-src/psychic-powers/ФУНДАМЕНТАЛЬНЫЕ_ДИСЦИПЛИНЫ/ТЕЛЕКИНЕЗ/Сокрушение", "4jq01cSZKuKyuUWv");
const STATIC = packDocById("packs-src/psychic-powers/ФУНДАМЕНТАЛЬНЫЕ_ДИСЦИПЛИНЫ/БИОМАНТИЯ/Биоэлектричество", "WPJLOx2pkXtUWplW");

const asItem = doc => ({ id: doc._id, uuid: `Item.${doc._id}`, name: doc.name, type: doc.type,
                         system: doc.system, flags: doc.flags, update: async () => {} });
const itemList = docs => { const l = docs.map(asItem); return Object.assign(l, { contents: l, get: id => l.find(i => i.id === id) }); };

function caster(docs = []) {
  return {
    id: "caster-1", uuid: "Actor.caster-1", name: "Псайкер", type: "character",
    items: itemList(docs),
    getFlag: () => undefined, setFlag: async () => {}, unsetFlag: async () => {},
    system: {
      race: "human", fatigue: { value: 0 },
      psyker: { rating: 5, currentRating: 5, sustain: 0, class: "bound" },
      skills: {}, corruption: { value: 0 }, corruptionBonus: 0,
      wounds: { value: 10, max: 10, critical: 0 },
      characteristics: { wp: { total: 50, value: 50, bonus: 5 }, t: { total: 40, value: 40, bonus: 4 } }
    },
    update: async () => {}, updateEmbeddedDocuments: async () => {}
  };
}

// Цель в ауре Парии: хватает и для applyDamageToActor (как в
// test/combat/pacifism.test.mjs), и для открытия теста Характеристики.
function voidTarget() {
  const updates = [];
  return {
    id: "target-1", uuid: "Actor.target-1", name: "Пария-сосед", type: "character", updates,
    items: itemList([VOID]),
    system: {
      absorption: { body: 0, toughnessBonus: 0, propFlags: {} },
      characteristics: { wp: { bonus: 0, total: 30 }, t: { bonus: 4, total: 40 } },
      wounds: { value: 30, critical: 0, max: 30 }
    },
    getFlag: () => undefined, setFlag: async () => {},
    sheet: { _rollCharacteristic: vi.fn() },
    async update(data) { updates.push(data); }
  };
}

/** data-атрибуты первой кнопки с классом cls из HTML карточки — как dataset. */
function buttonDataset(html, cls) {
  const tag = html.match(new RegExp(`<button[^>]*class="${cls}"[^>]*>`))?.[0];
  if (!tag) return null;
  const ds = {};
  for (const [, k, v] of tag.matchAll(/data-([\w-]+)="([^"]*)"/g))
    ds[k.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v;
  return ds;
}

// Обработчик renderChatMessageHTML из hooks.mjs — перехватывается на регистрации.
const hooks = {};
globalThis.Hooks.on = (name, fn) => { hooks[name] = fn; };
const { registerHooks } = await import("../../module/hooks.mjs");
registerHooks();

/** Отрисовать карточку с одной кнопкой и нажать её. */
async function clickChatButton(selector, dataset) {
  let onClick = null;
  const btn = { dataset, closest: () => null, addEventListener: (ev, fn) => { if (ev === "click") onClick = fn; } };
  hooks.renderChatMessageHTML({ id: "msg-1" }, {
    dataset: {}, querySelector: () => null, addEventListener: () => {},
    querySelectorAll: sel => (sel === selector ? [btn] : [])
  });
  await onClick({ preventDefault() {}, currentTarget: btn });
}

const MANIFEST_OPTS = { mPR: 1, prMod: 0, mode: "normal", path: "", modifier: 0, eldar: false,
                        pushChoice: 1, damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1 };

/** Карточка манифестации силы по цели target (кастер вне Пустоты). */
async function manifestCard(powerDoc, target) {
  game.user.targets = [{ actor: target, document: { uuid: "Scene.s1.Token.t1" } }];
  captured.nextRoll = 5;
  await executePsychotest(caster(), asItem(powerDoc), MANIFEST_OPTS);
  return captured.chat.at(-1).content;
}

// Та же сила без пометки «Непрямое» — контроль: такую Пустота развеивает.
const withoutIndirect = doc => ({ ...doc, system: { ...doc.system, extraTypes: [] } });

beforeEach(() => {
  resetCaptured();
});
afterEach(() => { delete game.user.targets; delete globalThis.fromUuid; });

describe("Пустота Парии: Непрямая сила из пака проходит", () => {
  it("окно манифестации в ауре не отказывает Тарану", () => {
    showManifestDialog(caster([VOID]), asItem(TARAN));
    expect(captured.warnings.join("\n")).not.toContain("Пустоте Парии");
  });

  it("…а силе без пометки — отказывает", () => {
    showManifestDialog(caster([VOID]), asItem(withoutIndirect(TARAN)));
    expect(captured.warnings.join("\n")).toContain("Пустоте Парии");
  });

  it("кнопка Сопротивления: цель в ауре всё равно проходит тест против Непрямой силы", async () => {
    const target = voidTarget();
    globalThis.fromUuid = async uuid => (uuid === target.uuid ? target : null);
    const ds = buttonDataset(await manifestCard(STATIC, target), "psy-resist-request-btn");
    expect(ds).not.toBeNull();

    await clickChatButton(".psy-resist-request-btn", ds);

    expect(captured.chat.at(-1).content).not.toContain("Пустота Парии");
    expect(target.sheet._rollCharacteristic).toHaveBeenCalled();
  });

  it("кнопка Сопротивления: сила без пометки в ауре развеивается", async () => {
    const target = voidTarget();
    globalThis.fromUuid = async uuid => (uuid === target.uuid ? target : null);
    const ds = buttonDataset(await manifestCard(withoutIndirect(STATIC), target), "psy-resist-request-btn");

    await clickChatButton(".psy-resist-request-btn", ds);

    expect(captured.chat.at(-1).content).toContain("Пустота Парии");
    expect(target.sheet._rollCharacteristic).not.toHaveBeenCalled();
  });

  it("кнопка урона: урон Непрямой силы доходит до цели в ауре", async () => {
    const target = voidTarget();
    globalThis.fromUuid = async uuid => (uuid === target.uuid ? target : null);
    const ds = buttonDataset(await manifestCard(STATIC, target), "wh-apply-dmg-btn");
    expect(ds.psychic).toBe("1");

    await clickChatButton(".wh-apply-dmg-btn", { ...ds, forceTarget: target.uuid });

    expect(captured.chat.map(m => m.content).join("\n")).not.toContain("развеивается");
    expect(target.updates.some(u => "system.wounds.value" in u)).toBe(true);
  });

  it("кнопка урона: урон силы без пометки в ауре развеивается", async () => {
    const target = voidTarget();
    globalThis.fromUuid = async uuid => (uuid === target.uuid ? target : null);
    const ds = buttonDataset(await manifestCard(withoutIndirect(STATIC), target), "wh-apply-dmg-btn");

    await clickChatButton(".wh-apply-dmg-btn", { ...ds, forceTarget: target.uuid });

    expect(captured.chat.at(-1).content).toContain("развеивается");
    expect(target.updates).toEqual([]);
  });
});

describe("Поле Дискорданта: техночудо при пороге ≥ 100", () => {
  it("Критический Провал не засчитывается успехом: ни Энергии, ни урона", async () => {
    const updates = [];
    const actor = {
      id: "a1", name: "Техномагос", items: itemList([FIELD]),
      system: {
        cognition: { value: 10, max: 10 }, energy: { value: 10, max: 10 },
        characteristics: { t: { total: 50 }, int: { total: 40, bonus: 4 } },
        skills: { techUse: { total: 120 } }, techFocus: [], techCompBonus: 0, corruptionBonus: 0
      },
      getFlag: () => undefined,
      update: async data => { updates.push(data); }
    };
    const miracle = { name: "Разряд", update: async () => {}, system: {
      miracleType: "imperative", rating: 1, energyCost: 5, cognitionCost: 0,
      testSkill: "techUse", testMod: 0, iron: "", damage: "1d10", damageType: "energy", weaponProps: []
    } };
    captured.dice = [50, 7];

    await activateTechMiracle(actor, miracle);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Критический Провал");
    expect(card).not.toContain("wh-apply-dmg-btn");
    expect(updates.some(u => "system.energy.value" in u)).toBe(false);
  });
});
