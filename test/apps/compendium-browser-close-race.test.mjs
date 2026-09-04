// test/apps/compendium-browser-close-race.test.mjs
//
// Живая находка при wdbc-2e9t: диалог выбора предмета не убирался из DOM
// сразу после выбора — dlg.close() (Foundry v14, appv1/dialog-v1.mjs) запускает
// jQuery-анимацию slideUp(200мс), а el.remove() и резолв промиса close()
// происходят только по её завершении. Старый код звал finish(uuid) СИНХРОННО
// и ДО dlg.close() — вызывающий (Мастер создания, цепочка пикеров архетипа)
// получал результат мгновенно и уже открывал СЛЕДУЮЩИЙ Обозреватель, пока
// прежнее окно ещё ~200мс видимо и кликабельно поверх/под новым.
//
// Заглушка globalThis.Dialog (foundry-stub.mjs) синхронна и не эмулирует эту
// задержку — регресс здесь физически непроверяем без своего close(),
// возвращающего управляемый (не сразу разрешённый) промис, как настоящий.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { listenerHtml } from "../support/foundry-stub.mjs";
import { openCompendiumBrowser } from "../../module/apps/compendium-browser.mjs";

async function flush() {
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
}

const RealDialog = globalThis.Dialog;
let dlgInstance;

/** dlg.close() возвращает управляемый промис — как настоящая jQuery-анимация,
 *  которая резолвится не сразу, а когда тест сам решит, что «анимация
 *  закончилась» (dlgInstance.finishClose()). */
class FakeCloseableDialog {
  constructor(config) { this.config = config; this.closeCalls = 0; dlgInstance = this; }
  render() {
    this.html = listenerHtml({
      ".cbrowse-item": [{
        dataset: { uuid: "Item.abc", name: "враг" },
        addEventListener: () => {},
        classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false }
      }]
    });
    // listenerHtml — общая заглушка, .val() у неё всегда undefined; строка
    // поиска здесь не участвует в проверяемом поведении, подменяю точечно,
    // не трогая общую заглушку ради одного этого потребителя.
    const origFind = this.html.find.bind(this.html);
    const searchNode = { val: () => "", on: () => searchNode };
    this.html.find = sel => (sel === ".pick-search" ? searchNode : origFind(sel));
    this.config.render(this.html);
  }
  close() {
    this.closeCalls += 1;
    return new Promise(resolve => { this._resolveClose = resolve; });
  }
  finishClose() { this._resolveClose?.(); }
}

beforeEach(() => {
  globalThis.Dialog = FakeCloseableDialog;
  dlgInstance = undefined;
  game.packs = new Map();
  game.packs.set("warhammer-dbc.talents", {
    folders: { contents: [] },
    collection: "warhammer-dbc.talents",
    metadata: { packageName: "warhammer-dbc", type: "Item", name: "talents", label: "Таланты" },
    getIndex: async () => ([{
      _id: "aaaaaaaaaaaaaaaa", name: "Enemy / Враг", img: "icons/x.svg", type: "talent", folder: null,
      system: { tier: 1, cost: 0, aptitudes: [] }
    }])
  });
});

afterEach(() => { globalThis.Dialog = RealDialog; });

describe("openCompendiumBrowser: результат выбора не приходит раньше, чем окно реально закрылось", () => {
  it("клик по предмету зовёт dlg.close() СРАЗУ, но промис резолвится только после её завершения", async () => {
    const promise = openCompendiumBrowser(true, { pack: "talents", filters: {} });
    await flush();
    expect(dlgInstance).toBeTruthy();

    let settled = false, value;
    promise.then(v => { settled = true; value = v; });

    dlgInstance.html.handlers[".cbrowse-item:click"]({ currentTarget: { dataset: { uuid: "Item.abc" } } });

    // close() должен быть вызван НЕМЕДЛЕННО по клику — не отложенно.
    expect(dlgInstance.closeCalls).toBe(1);

    // Несколько тиков микрозадач — промис НЕ должен разрешиться, пока
    // «анимация» (наш управляемый промис close()) не завершена явно.
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(settled).toBe(false);

    dlgInstance.finishClose();
    await promise;
    expect(settled).toBe(true);
    expect(value).toBe("Item.abc");
  });
});
