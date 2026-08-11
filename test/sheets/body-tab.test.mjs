import { describe, it, expect, beforeEach } from "vitest";
import { resetCaptured } from "../support/foundry-stub.mjs";
import {
  activateBodyListeners,
  adjustVital,
  setDeceased,
  setVital,
  toggleBodyType,
  toggleImplantSide
} from "../../module/sheets/tabs/body.mjs";

function item({ id = "imp-1", side } = {}) {
  const flags = side === undefined ? {} : { bodySide: side };
  return {
    id,
    flags,
    getFlag: (_scope, key) => flags[key],
    setFlag: async (_scope, key, value) => { flags[key] = value; return value; },
    unsetFlag: async (_scope, key) => { delete flags[key]; }
  };
}

function actor({ vitals = {}, items = [] } = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const flags = {};
  const a = {
    id: "actor-1",
    name: "Пациент",
    system: { vitals },
    items: list,
    updates: [],
    flags,
    update: async data => { a.updates.push(data); return data; },
    setFlag: async (_scope, key, value) => { flags[key] = value; return value; }
  };
  return a;
}

beforeEach(resetCaptured);

describe("body tab helpers", () => {
  it("toggleBodyType переключает фигуру в обе стороны", async () => {
    const a = actor();

    expect(await toggleBodyType(a, "male")).toBe("female");
    expect(await toggleBodyType(a, "female")).toBe("male");
    expect(a.flags.bodyType).toBe("male");
  });

  it("setVital держит стадию в границах 0…3", async () => {
    const a = actor();

    await setVital(a, "hunger", -5);
    await setVital(a, "thirst", 9);
    await setVital(a, "sleep", 2.4);

    expect(a.updates).toEqual([
      { "system.vitals.hunger": 0 },
      { "system.vitals.thirst": 3 },
      { "system.vitals.sleep": 2 }
    ]);
  });

  it("adjustVital считает от текущей стадии и не уходит за потолок", async () => {
    const a = actor({ vitals: { hunger: 3, thirst: 0 } });

    await adjustVital(a, "hunger", 1);
    await adjustVital(a, "thirst", -1);

    expect(a.updates).toEqual([
      { "system.vitals.hunger": 3 },
      { "system.vitals.thirst": 0 }
    ]);
  });

  it("toggleImplantSide снимает сторону при повторном выборе той же", async () => {
    const eye = item({ side: "left" });

    await toggleImplantSide(eye, "right");
    expect(eye.flags.bodySide).toBe("right");

    await toggleImplantSide(eye, "right");
    expect(eye.flags.bodySide).toBeUndefined();
  });

  it("setDeceased пишет флаг констатации смерти", async () => {
    const a = actor();

    await setDeceased(a, true);

    expect(a.flags.deceased).toBe(true);
  });
});

describe("body tab listeners", () => {
  it("activateBodyListeners привязывает обработчики с actor-only API", async () => {
    const handlers = {};
    const html = {
      find: selector => {
        const api = {
          click: fn => { handlers[`${selector}:click`] = fn; },
          change: fn => { handlers[`${selector}:change`] = fn; },
          on: (eventName, fn) => { handlers[`${selector}:${eventName}`] = fn; }
        };
        return api; // [0] === undefined: .bc-figure-panel нет, подсказки не вешаются
      }
    };
    const eye = item({ id: "eye-1" });
    const a = actor({ vitals: { hunger: 1 }, items: [eye] });
    const surgeonCalls = [];

    activateBodyListeners(html, a, { openSurgeonWindow: actorArg => surgeonCalls.push(actorArg) });

    const ev = dataset => ({
      preventDefault: () => {},
      stopPropagation: () => {},
      currentTarget: { dataset, checked: true }
    });

    await handlers[".bc-sex-toggle:click"](ev({ bodytype: "male" }));
    handlers[".bc-surgeon-btn:click"](ev({}));
    await handlers["[data-vital-adj]:click"](ev({ vitalAdj: "hunger", dir: "1" }));
    await handlers["[data-vital-reset]:click"](ev({ vitalReset: "hunger" }));
    await handlers[".bc-death-toggle:change"](ev({}));
    await handlers[".bc-side-btn:click"](ev({ itemId: "eye-1", side: "left" }));

    expect(a.flags.bodyType).toBe("female");
    expect(surgeonCalls).toEqual([a]);
    expect(a.updates).toEqual([
      { "system.vitals.hunger": 2 },
      { "system.vitals.hunger": 0 }
    ]);
    expect(a.flags.deceased).toBe(true);
    expect(eye.flags.bodySide).toBe("left");
  });
});
