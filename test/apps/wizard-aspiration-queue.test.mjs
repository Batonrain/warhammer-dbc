// test/apps/wizard-aspiration-queue.test.mjs
//
// task-30f8: Мастер создания, шаг «Стремления». ИЛИ-выбор Механики Стремления
// показывается строкой в форме шага (_mechCollectorImmediate). Раньше ожидающий
// выбор хранился ОДНИМ полем: второй вопрос подряд (игрок выбрал второе
// Стремление с ИЛИ-бонусом, не ответив на первое) перезаписывал первый, а его
// промис оставался висеть вечно — Механика первого Стремления так и не
// применялась. Теперь это очередь: строки показываются по одной, ни одна не
// теряется.

import { describe, it, expect, vi } from "vitest";
import "../support/foundry-stub.mjs";
import { CharacterWizard } from "../../module/apps/character-wizard.mjs";

vi.mock("../../module/apps/compendium-browser.mjs", () => ({ openCompendiumBrowser: vi.fn() }));

function wizard() {
  // Object.create — как в character-wizard-v2.test.mjs: конструктор тянет Foundry.
  const app = Object.create(CharacterWizard.prototype);
  app._isClosing = false;
  app.render = vi.fn();
  return app;
}

const orItem = (name, ...ids) => ({ item: { name }, entries: ids.map(i => ({ id: i })) });

describe("Мастер: очередь ИЛИ-выборов Стремлений (task-30f8)", () => {
  it("второй вопрос подряд не затирает первый: оба получают ответ", async () => {
    const app = wizard();
    const collector = app._mechCollectorImmediate();
    const a = orItem("Mastery / Мастерство", "ws", "bs");
    const b = orItem("Wrath / Гнев", "ws2", "bs2");

    let resA, resB;
    const pA = collector.choose(a.item, a.entries).then(v => { resA = v; });
    const pB = collector.choose(b.item, b.entries).then(v => { resB = v; });

    // На экране — первый вопрос; второй ждёт своей очереди.
    expect(app.pendingAspirationChoice.itemName).toBe("Mastery / Мастерство");

    app._resolveAspirationChoice({ kind: "pick", value: a.entries[1] });
    await pA;
    expect(resA).toBe(a.entries[1]);
    expect(resB).toBeUndefined();

    // После ответа на первый встаёт второй.
    expect(app.pendingAspirationChoice.itemName).toBe("Wrath / Гнев");
    app._resolveAspirationChoice({ kind: "pick", value: b.entries[0] });
    await pB;
    expect(resB).toBe(b.entries[0]);
    expect(app.pendingAspirationChoice).toBeFalsy();
  });

  it("пропуск (✕) снимает только текущий вопрос и отдаёт null", async () => {
    const app = wizard();
    const collector = app._mechCollectorImmediate();
    const a = orItem("Первое", "x", "y");
    const b = orItem("Второе", "z", "w");
    const pA = collector.choose(a.item, a.entries);
    const pB = collector.choose(b.item, b.entries);

    app._resolveAspirationChoice({ kind: "skip", value: null });
    await expect(pA).resolves.toBeNull();
    expect(app.pendingAspirationChoice.itemName).toBe("Второе");

    app._resolveAspirationChoice({ kind: "pick", value: b.entries[1] });
    await expect(pB).resolves.toBe(b.entries[1]);
  });

  it("ответ без вопросов в очереди — тихий no-op", () => {
    const app = wizard();
    expect(() => app._resolveAspirationChoice({ kind: "skip", value: null })).not.toThrow();
  });

  it("закрытие окна отпускает все висящие вопросы (иначе их промисы висят вечно)", async () => {
    const app = wizard();
    // close() тянет остальное состояние окна; проверяем только свой кусок.
    app.pendingMechChoices = [];
    app._factionHookIds = [];
    app.actorId = "nope";
    const collector = app._mechCollectorImmediate();
    const a = orItem("Первое", "x", "y");
    const b = orItem("Второе", "z", "w");
    const pA = collector.choose(a.item, a.entries);
    const pB = collector.choose(b.item, b.entries);

    await app.close();
    await expect(pA).resolves.toBeNull();
    await expect(pB).resolves.toBeNull();
    expect(app.pendingAspirationChoice).toBeFalsy();
  });
});
