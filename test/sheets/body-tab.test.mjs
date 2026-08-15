import { describe, it, expect, beforeEach } from "vitest";
import { listenerRoot, resetCaptured } from "../support/foundry-stub.mjs";
import {
  activateBodyListeners,
  adjustVital,
  openOrganSheet,
  setDeceased,
  setOrganState,
  setVital,
  toggleBodyType,
  toggleImplantSide
} from "../../module/sheets/tabs/body.mjs";

function item({ id = "imp-1", side, effectDisabled } = {}) {
  const flags = side === undefined ? {} : { bodySide: side };
  const effects = effectDisabled === undefined
    ? []
    : [{ id: "fx-1", disabled: effectDisabled }];
  const it = {
    id,
    type: "implant",
    system: {},
    flags,
    effects: { contents: effects },
    effectUpdates: [],
    sheet: { rendered: 0, render: () => { it.sheet.rendered += 1; } },
    getFlag: (_scope, key) => flags[key],
    setFlag: async (_scope, key, value) => { flags[key] = value; return value; },
    unsetFlag: async (_scope, key) => { delete flags[key]; },
    updateEmbeddedDocuments: async (_type, updates) => { it.effectUpdates.push(...updates); }
  };
  return it;
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

describe("реестр органов Геносемени", () => {
  // Каждое состояние проверяется на свежем органе: иначе флаг, оставшийся от
  // прошлого перехода, скрыл бы его пропажу в новом.
  async function stateFlags(state, from = {}) {
    const organ = item({ id: "organ-1" });
    Object.assign(organ.flags, from);
    await setOrganState(actor({ items: [organ] }), "organ-1", state);
    return organ.flags;
  }

  it("три состояния органа дают три набора флагов", async () => {
    expect(await stateFlags("on")).toEqual({ installed: true });
    expect(await stateFlags("broken")).toEqual({ installed: true, disabled: true });
    expect(await stateFlags("off")).toEqual({});
  });

  it("вживление снимает поломку, изъятие снимает оба флага", async () => {
    const broken = { installed: true, disabled: true };

    expect(await stateFlags("on", broken)).toEqual({ installed: true });
    expect(await stateFlags("off", broken)).toEqual({});
  });

  it("неработающий орган гасит свои эффекты, вживлённый — включает", async () => {
    const organ = item({ id: "organ-1", effectDisabled: false });
    const a = actor({ items: [organ] });

    await setOrganState(a, "organ-1", "broken");
    expect(organ.effectUpdates).toEqual([{ _id: "fx-1", disabled: true }]);

    organ.effects.contents[0].disabled = true;
    await setOrganState(a, "organ-1", "on");
    expect(organ.effectUpdates[1]).toEqual({ _id: "fx-1", disabled: false });
  });

  it("клик по названию открывает лист органа, отсутствующий id молчит", () => {
    const organ = item({ id: "organ-1" });
    const a = actor({ items: [organ] });

    openOrganSheet(a, "organ-1");
    openOrganSheet(a, "нет-такого");

    expect(organ.sheet.rendered).toBe(1);
  });
});

describe("body tab listeners", () => {
  it("activateBodyListeners привязывает обработчики с actor-only API", async () => {
    // Узлы не объявлены, поэтому .bc-figure-panel не найдётся и подсказки
    // не навешиваются — проверяются обработчики, а не DOM.
    const root = listenerRoot();
    const handlers = root.handlers;
    const eye = item({ id: "eye-1" });
    const a = actor({ vitals: { hunger: 1 }, items: [eye] });
    const surgeonCalls = [];

    activateBodyListeners(root, a, { openSurgeonWindow: actorArg => surgeonCalls.push(actorArg) });

    const ev = (dataset, value) => ({
      preventDefault: () => {},
      stopPropagation: () => {},
      currentTarget: { dataset, value, checked: true }
    });

    await handlers[".bc-sex-toggle:click"](ev({ bodytype: "male" }));
    handlers[".bc-surgeon-btn:click"](ev({}));
    await handlers["[data-vital-adj]:click"](ev({ vitalAdj: "hunger", dir: "1" }));
    await handlers["[data-vital-reset]:click"](ev({ vitalReset: "hunger" }));
    await handlers[".bc-death-toggle:change"](ev({}));
    await handlers[".bc-side-btn:click"](ev({ itemId: "eye-1", side: "left" }));
    handlers[".geneseed-name-link:click"](ev({ itemId: "eye-1" }));
    await handlers[".geneseed-state-select:change"](ev({ itemId: "eye-1" }, "on"));

    expect(a.flags.bodyType).toBe("female");
    expect(surgeonCalls).toEqual([a]);
    expect(a.updates).toEqual([
      { "system.vitals.hunger": 2 },
      { "system.vitals.hunger": 0 }
    ]);
    expect(a.flags.deceased).toBe(true);
    expect(eye.flags.bodySide).toBe("left");
    expect(eye.sheet.rendered).toBe(1);
    expect(eye.flags.installed).toBe(true);
  });
});
