// test/sheets/tabs/psychic-fruit-lock.test.mjs
//
// Заточение Силы (Fruit of Flesh/Плод Плоти, Тзинч, wdbc-1rno): психосила с
// flags.warhammer-dbc.fruitOfFleshLockUuid не может быть развеяна, пока
// предмет-Плод по этому uuid ещё резолвится через fromUuid. Уничтоженный
// Плод просто не резолвится — блок сам перестаёт срабатывать.

import "../../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, listenerHtml } from "../../support/foundry-stub.mjs";
import { activatePsychicListeners } from "../../../module/sheets/tabs/psychic.mjs";

const realFromUuid = globalThis.fromUuid;

function makeActor() {
  return { uuid: "Actor.victim", id: "victim1", name: "Жертва", system: { psyker: {}, characteristics: {} } };
}

function makeItem(flags = {}) {
  const item = {
    id: "p1", system: { isSustained: true },
    getFlag: (_s, k) => flags[k],
    update: async data => Object.assign(item.system, {
      isSustained: data["system.isSustained"] ?? item.system.isSustained
    })
  };
  return item;
}

beforeEach(resetCaptured);
afterEach(() => { globalThis.fromUuid = realFromUuid; delete globalThis.game.actors; });

describe("fruitOfFleshLockUuid — заточённую психосилу нельзя развеять, пока плод существует", () => {
  it("плод существует (fromUuid резолвится) — снятие поддержания отменяется, галочка возвращается", async () => {
    globalThis.game.actors = [];
    globalThis.fromUuid = async uuid => (uuid === "Item.fruit1" ? { id: "fruit1" } : null);
    const item = makeItem({ fruitOfFleshLockUuid: "Item.fruit1" });
    const actor = makeActor();
    actor.items = { get: id => (id === "p1" ? item : null) };

    const html = listenerHtml();
    activatePsychicListeners(html, actor, {});
    const ev = { currentTarget: { dataset: { itemId: "p1" }, checked: false } };
    await html.handlers[".psy-sustain-cb:change"](ev);

    expect(item.system.isSustained).toBe(true); // не снято
    expect(ev.currentTarget.checked).toBe(true); // галочка возвращена
    expect(captured.warnings.at(-1)).toContain("Заточена в Плоде Плоти");
  });

  it("плод уничтожен (fromUuid не резолвится) — снятие поддержания проходит как обычно", async () => {
    globalThis.game.actors = [];
    globalThis.fromUuid = async () => null;
    const item = makeItem({ fruitOfFleshLockUuid: "Item.fruit1" });
    const actor = makeActor();
    actor.items = { get: id => (id === "p1" ? item : null) };

    const html = listenerHtml();
    activatePsychicListeners(html, actor, {});
    const ev = { currentTarget: { dataset: { itemId: "p1" }, checked: false } };
    await html.handlers[".psy-sustain-cb:change"](ev);

    expect(item.system.isSustained).toBe(false);
  });

  it("без флага заточения — снятие поддержания как обычно, fromUuid не спрашивается", async () => {
    globalThis.game.actors = [];
    let asked = false;
    globalThis.fromUuid = async () => { asked = true; return null; };
    const item = makeItem({});
    const actor = makeActor();
    actor.items = { get: id => (id === "p1" ? item : null) };

    const html = listenerHtml();
    activatePsychicListeners(html, actor, {});
    const ev = { currentTarget: { dataset: { itemId: "p1" }, checked: false } };
    await html.handlers[".psy-sustain-cb:change"](ev);

    expect(item.system.isSustained).toBe(false);
    expect(asked).toBe(false);
  });
});
