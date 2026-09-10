import { describe, it, expect, beforeEach } from "vitest";
import { listenerRoot, resetCaptured } from "../support/foundry-stub.mjs";
import {
  activateBodyListeners,
  adjustVital,
  satisfyVital,
  setDeceased,
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
    setFlag: async (_scope, key, value) => { flags[key] = value; return value; },
    getFlag: (_scope, key) => flags[key]
  };
  return a;
}

beforeEach(() => { resetCaptured(); game.time = { worldTime: 0 }; });

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

  it("satisfyVital обнуляет стадию И метку времени последнего удовлетворения (wdbc-jnqj)", async () => {
    const a = actor({ vitals: { hunger: 2 } });
    game.time = { worldTime: 123456 };

    await satisfyVital(a, "hunger");

    expect(a.updates).toEqual([
      { "system.vitals.hunger": 0, "system.vitals.lastFed": 123456 }
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

// wdbc-t4m/wdbc-665: setDeceased — ЕДИНСТВЕННАЯ точка, где система признаёт
// смерть (ручная галочка на вкладке Тело и кнопка в крит-строке приходят
// сюда). Раньше зачёт убийства Кровавому Пламени висел на обработчике кнопки:
// обычная смерть счётчик не трогала вовсе, а второй клик по тому же трупу
// давал ещё одно убийство (кнопку видят и ГМ, и владелец цели, каждый на
// своём клиенте, а el.disabled живёт до перерисовки карточки).
describe("setDeceased засчитывает убийство Кровавому Пламени", () => {
  const NS = "warhammer-dbc";

  function burningWeapon() {
    const store = { bloodFlameActive: true, bloodFlameKills: 0 };
    return {
      uuid: "Item.weapon-1", type: "weapon", name: "Цепной топор",
      getFlag: (_s, k) => store[k],
      setFlag: async (_s, k, v) => { store[k] = v; },
      _store: store
    };
  }

  it("обычная смерть (галочка на вкладке Тело) — убийство засчитано", async () => {
    const weapon = burningWeapon();
    globalThis.fromUuid = async uuid => (uuid === weapon.uuid ? weapon : null);
    const a = actor();
    a.flags.lastDamageWeaponUuid = weapon.uuid;

    await setDeceased(a, true);

    expect(weapon._store.bloodFlameKills).toBe(1);
  });

  it("повторная констатация того же трупа убийство НЕ удваивает", async () => {
    const weapon = burningWeapon();
    globalThis.fromUuid = async uuid => (uuid === weapon.uuid ? weapon : null);
    const a = actor();
    a.flags.lastDamageWeaponUuid = weapon.uuid;

    await setDeceased(a, true);
    await setDeceased(a, true);
    await setDeceased(a, true);

    expect(weapon._store.bloodFlameKills).toBe(1);
  });

  it("воскресили и убили снова — засчитывается второе убийство", async () => {
    const weapon = burningWeapon();
    globalThis.fromUuid = async uuid => (uuid === weapon.uuid ? weapon : null);
    const a = actor();
    a.flags.lastDamageWeaponUuid = weapon.uuid;

    await setDeceased(a, true);
    await setDeceased(a, false);
    await setDeceased(a, true);

    expect(weapon._store.bloodFlameKills).toBe(2);
  });

  it("умер не от оружия (падение, яд) — счётчику нечего засчитывать", async () => {
    globalThis.fromUuid = async () => null;
    const a = actor();

    await setDeceased(a, true);

    expect(a.flags.deceased).toBe(true);
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

    expect(a.flags.bodyType).toBe("female");
    expect(surgeonCalls).toEqual([a]);
    expect(a.updates).toEqual([
      { "system.vitals.hunger": 2 },
      { "system.vitals.hunger": 0, "system.vitals.lastFed": 0 }
    ]);
    expect(a.flags.deceased).toBe(true);
    expect(eye.flags.bodySide).toBe("left");
  });
});
