// test/apps/force-blade-choice.test.mjs
//
// Force Blade / Психосиловой Клинок (wdbc-vxgd): «магазин» покупки свойств
// оружия за Успехи психотеста манифестации — валюта живёт один каст (см.
// комментарий-упрощение в module/constants/force-blade-shop.mjs), результат
// пишется в system.effects.weaponBuff (combat/weapon-mods.mjs).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { fakeHtml, resetCaptured, captured } from "../support/foundry-stub.mjs";
import {
  forceBladeShopCost, forceBladeShopUpdate, forceBladeShopClear,
  promptForceBladeShop, runForceBladeShop
} from "../../module/apps/force-blade-choice.mjs";

describe("forceBladeShopCost", () => {
  it("считает сумму ступеней выбранных id", () => {
    expect(forceBladeShopCost(["tearing", "shocking"])).toBe(1 + 2); // тир 1 + тир 2
  });

  it("пустой выбор — 0", () => {
    expect(forceBladeShopCost([])).toBe(0);
  });

  it("неизвестный id молча игнорируется, не роняет счёт", () => {
    expect(forceBladeShopCost(["tearing", "нет-такого"])).toBe(1);
  });
});

describe("forceBladeShopUpdate", () => {
  it("бюджет превышен — null", () => {
    // tearing(1) + shocking(2) + sanctified(5) = 8 > 5 Успехов
    expect(forceBladeShopUpdate(["tearing", "shocking", "sanctified"], 5)).toBe(null);
  });

  it("Force добавляется всегда, даже при пустом выборе", () => {
    const res = forceBladeShopUpdate([], 3);
    expect(res.weaponBuff.addProps).toEqual([{ key: "force" }]);
    expect(res.weaponBuff.enabled).toBe(true);
    expect(res.spent).toBe(0);
    expect(res.remaining).toBe(3);
  });

  it("свойство с рейтингом переносит rating/rating2 в addProps", () => {
    const res = forceBladeShopUpdate(["crippling"], 2);
    expect(res.weaponBuff.addProps).toContainEqual({ key: "crippling", rating: 2 });
  });

  it("свойство без рейтинга — только key, без лишних полей", () => {
    const res = forceBladeShopUpdate(["tearing"], 1);
    expect(res.weaponBuff.addProps).toContainEqual({ key: "tearing" });
  });

  it("Arc несёт и rating, и rating2 (дайс-формула)", () => {
    const res = forceBladeShopUpdate(["arc"], 2);
    expect(res.weaponBuff.addProps).toContainEqual({ key: "arc", rating: 8, rating2: "2d10" });
  });

  // Flame встречается на трёх ступенях каталога (flame1/flame2/flame3) —
  // все пишут в один и тот же weaponProps-ключ "flame". Взята самая дорогая
  // выбранная ступень, остальные молча отброшены (выше = строго сильнее).
  it("несколько ступеней Flame сразу — остаётся только самая дорогая", () => {
    const res = forceBladeShopUpdate(["flame1", "flame3"], 6);
    const flames = res.weaponBuff.addProps.filter(p => p.key === "flame");
    expect(flames).toEqual([{ key: "flame", rating: "3d10" }]);
  });

  it("Balance +1 пишется в balanceMod, а не в addProps", () => {
    const res = forceBladeShopUpdate(["balance"], 1);
    expect(res.weaponBuff.balanceMod).toBe(1);
    expect(res.weaponBuff.addProps.some(p => p.key === "balance")).toBe(false);
  });

  it("без Balance — balanceMod остаётся 0", () => {
    const res = forceBladeShopUpdate(["tearing"], 1);
    expect(res.weaponBuff.balanceMod).toBe(0);
  });

  it("дубли id в выборе не считаются дважды", () => {
    expect(forceBladeShopUpdate(["tearing", "tearing"], 1).spent).toBe(1);
  });
});

describe("forceBladeShopClear", () => {
  it("выключенный weaponBuff без свойств", () => {
    expect(forceBladeShopClear()).toEqual({
      enabled: false, scope: "equipped", weaponId: "", damageMod: 0, penMod: 0, rangeMod: 0, balanceMod: 0, addProps: []
    });
  });
});

describe("promptForceBladeShop: диалог", () => {
  it("Применить в рамках бюджета — массив выбранных id", async () => {
    resetCaptured();
    const promise = promptForceBladeShop(3);
    const html = fakeHtml({}, { ".fb-shop-cb:checked": [{ dataset: { id: "tearing" } }, { dataset: { id: "shocking" } }] });
    captured.dialog.buttons.ok.callback(html);
    expect(await promise).toEqual({ ids: ["tearing", "shocking"], weaponId: "" });
  });

  it("Применить сверх бюджета — предупреждение и null", async () => {
    resetCaptured();
    const promise = promptForceBladeShop(1);
    const html = fakeHtml({}, { ".fb-shop-cb:checked": [{ dataset: { id: "sanctified" } }] }); // тир 5 > 1
    captured.dialog.buttons.ok.callback(html);
    expect(await promise).toBe(null);
    expect(captured.warnings.some(w => /Успех/i.test(w))).toBe(true);
  });

  it("«Только Force» — пустой массив (не null: Force всё равно применится)", async () => {
    resetCaptured();
    const promise = promptForceBladeShop(3);
    captured.dialog.buttons.cancel.callback();
    expect(await promise).toEqual({ ids: [], weaponId: "" });
  });

  it("закрытие без ответа — тоже пустой массив, не null", async () => {
    resetCaptured();
    const promise = promptForceBladeShop(3);
    captured.dialog.close();
    expect(await promise).toEqual({ ids: [], weaponId: "" });
  });
});

describe("runForceBladeShop: полный цикл", () => {
  function fakeItem() {
    const updates = [];
    return { updates, update: async data => { updates.push(data); return data; } };
  }

  it("выбор в рамках бюджета пишется в system.effects.weaponBuff", async () => {
    resetCaptured();
    const item = fakeItem();
    const promise = runForceBladeShop(item, 2);
    const html = fakeHtml({}, { ".fb-shop-cb:checked": [{ dataset: { id: "shocking" } }] });
    captured.dialog.buttons.ok.callback(html);
    await promise;

    expect(item.updates).toHaveLength(1);
    const wb = item.updates[0]["system.effects.weaponBuff"];
    expect(wb.enabled).toBe(true);
    expect(wb.addProps).toContainEqual({ key: "force" });
    expect(wb.addProps).toContainEqual({ key: "shocking" });
  });

  it("отмена (крестик/«Только Force») — Force всё равно применяется", async () => {
    resetCaptured();
    const item = fakeItem();
    const promise = runForceBladeShop(item, 2);
    captured.dialog.close();
    await promise;

    expect(item.updates[0]["system.effects.weaponBuff"].addProps).toEqual([{ key: "force" }]);
  });

  it("выбор сверх бюджета из диалога — тот же откат к «только Force», без падения", async () => {
    resetCaptured();
    const item = fakeItem();
    const promise = runForceBladeShop(item, 1);
    const html = fakeHtml({}, { ".fb-shop-cb:checked": [{ dataset: { id: "sanctified" } }] });
    captured.dialog.buttons.ok.callback(html);
    await promise;

    expect(item.updates[0]["system.effects.weaponBuff"].addProps).toEqual([{ key: "force" }]);
  });
});
