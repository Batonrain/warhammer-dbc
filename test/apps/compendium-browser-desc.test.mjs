// test/apps/compendium-browser-desc.test.mjs
//
// Жалоба игрока: в пикере «выбор с бюджетом» (Обозреватель компендиумов в
// pickMode — «7 талантов 1 уровня», «500хр на Психосилы», см. rules/pick-budget.mjs)
// нельзя было прочитать, что даёт запись, до покупки — только имя и значок.
// На листе то же самое (уже взятые Таланты/Черты) раскрывается стрелочкой
// (templates/actor/parts/tab-abilities.hbs), и тот же приём (.pick-exp/.pick-desc,
// см. module/sheets/item-picker.mjs) переехал сюда как .cbrowse-exp/.cbrowse-desc.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { openCompendiumBrowser } from "../../module/apps/compendium-browser.mjs";

/** Дать внутреннему async-исполнителю Promise'а долистать до new Dialog(...). */
async function flush() {
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
}

describe("описание записи в пикере с бюджетом (Обозреватель компендиумов)", () => {
  it("строка предмета несёт стрелочку раскрытия и текст Действия/Описания", async () => {
    resetCaptured();
    game.packs = new Map();
    game.packs.set("warhammer-dbc.talents", {
      folders: { contents: [] },
      collection: "warhammer-dbc.talents",
      metadata: { packageName: "warhammer-dbc", type: "Item", name: "talents", label: "Таланты" },
      getIndex: async () => ([{
        _id: "aaaaaaaaaaaaaaaa", name: "Enemy / Враг", img: "icons/x.svg", type: "talent", folder: null,
        system: {
          tier: 1, cost: 0, aptitudes: [],
          benefit: "Персонаж получает −10 ко всем социальным взаимодействиям с этой группой."
        }
      }])
    });

    // Пикер не резолвится, пока игрок не выберет/отменит — тест не ждёт этого,
    // только даёт исполнителю дойти до сборки диалога (см. flush() выше).
    // force:true — деревья кэшируются на сессию (_treeCache), а второй тест
    // в этом файле подставляет свой game.packs.
    openCompendiumBrowser(true, { pack: "talents", filters: {} });
    await flush();

    expect(captured.dialog).toBeTruthy();
    const html = captured.dialog.content;
    expect(html).toContain("Enemy / Враг");
    expect(html).toContain("cbrowse-exp");
    expect(html).toContain("cbrowse-desc");
    expect(html).toContain("Персонаж получает");
    // Панель свёрнута по умолчанию — иначе список первым экраном тонет в тексте.
    expect(html).toMatch(/cbrowse-desc pick-desc"[^>]*style="display:none;"/);
  });

  it("без benefit/description показывает прочерк, а не пустую панель", async () => {
    resetCaptured();
    game.packs = new Map();
    game.packs.set("warhammer-dbc.talents", {
      folders: { contents: [] },
      collection: "warhammer-dbc.talents",
      metadata: { packageName: "warhammer-dbc", type: "Item", name: "talents", label: "Таланты" },
      getIndex: async () => ([{
        _id: "bbbbbbbbbbbbbbbb", name: "Без описания", img: "icons/x.svg", type: "talent", folder: null,
        system: { tier: 1, cost: 0, aptitudes: [] }
      }])
    });

    openCompendiumBrowser(true, { pack: "talents", filters: {} });
    await flush();

    expect(captured.dialog.content).toContain(">—<");
  });
});
