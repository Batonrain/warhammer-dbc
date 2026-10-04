// test/sheets/aspirations-repick.test.mjs
//
// «Совершенство» (стр. 22) просит ответа игрока. Три случая листа:
//  — игрок закрыл вопрос при ПЕРВОМ выборе: слот не остаётся с записью без бонусов;
//  — игрок передумал уже после ответа («Изменить выбор») и закрыл окно: прежняя
//    выдача и слот целы;
//  — Мастер передаёт обёртку-коллектор: вопрос Механики уходит через неё.

import "../support/foundry-stub.mjs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listenerHtml } from "../support/foundry-stub.mjs";

const grant = vi.fn();
const clear = vi.fn(async () => {});
vi.mock("../../module/apps/aspirations.mjs", () => ({
  grantAspiration: (...a) => grant(...a),
  clearAspirationGrant: (...a) => clear(...a),
  aspirationOptions: () => []
}));

const { activateAspirationListeners } = await import("../../module/sheets/tabs/aspirations.mjs");

function actorWith(slots) {
  const actor = {
    system: { aspirations: { slots } },
    async update(data) {
      for (const [path, value] of Object.entries(data)) {
        if (path === "system.aspirations.slots") actor.system.aspirations.slots = value;
      }
    }
  };
  return actor;
}
const clickEv = index => ({ preventDefault() {}, currentTarget: { dataset: { index } } });
const changeEv = (index, value) => ({ preventDefault() {}, currentTarget: { dataset: { index }, value } });

beforeEach(() => { grant.mockReset(); clear.mockClear(); });

describe("Стремления с выбором: отмена и перевыбор", () => {
  it("закрыли вопрос при первом выборе — слот снова пуст, прежняя выдача снята", async () => {
    grant.mockResolvedValue("cancelled");
    const actor = actorWith([{ id: "" }, { id: "" }, { id: "" }]);
    const html = listenerHtml({});
    activateAspirationListeners(html, actor);

    await html.handlers[".aspir-select:change"](changeEv("1", "motivation:8"));

    expect(actor.system.aspirations.slots[1]).toEqual({ id: "" });
    expect(clear).toHaveBeenCalledWith(actor, 1);
  });

  it("«Изменить выбор» и отмена окна — слот и прежняя выдача целы", async () => {
    grant.mockResolvedValue("cancelled");
    const actor = actorWith([{ id: "" }, { id: "motivation:8" }, { id: "" }]);
    const html = listenerHtml({});
    activateAspirationListeners(html, actor);

    await html.handlers[".aspir-repick:click"](clickEv("1"));

    expect(grant).toHaveBeenCalledWith(actor, 1, "motivation:8");
    expect(actor.system.aspirations.slots[1]).toEqual({ id: "motivation:8" });
    expect(clear).not.toHaveBeenCalled();
  });

  it("перевыбор не запускается в слоте «без модификаторов» и в «Своём»", async () => {
    const actor = actorWith([{ id: "motivation:8", noMods: true }, { custom: true, name: "X" }, { id: "" }]);
    const html = listenerHtml({});
    activateAspirationListeners(html, actor);

    await html.handlers[".aspir-repick:click"](clickEv("0"));
    await html.handlers[".aspir-repick:click"](clickEv("1"));

    expect(grant).not.toHaveBeenCalled();
  });

  it("выдача идёт через обёртку-коллектор Мастера", async () => {
    grant.mockResolvedValue("granted");
    const actor = actorWith([{ id: "" }, { id: "" }, { id: "" }]);
    const wrap = vi.fn(fn => fn());
    const html = listenerHtml({});
    activateAspirationListeners(html, actor, wrap);

    await html.handlers[".aspir-select:change"](changeEv("0", "pride:2"));

    expect(wrap).toHaveBeenCalledTimes(1);
    expect(grant).toHaveBeenCalledWith(actor, 0, "pride:2");
  });
});
