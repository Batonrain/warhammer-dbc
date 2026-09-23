// test/migrations/unlinked-tokens.test.mjs
//
// wdbc-gbd3. Проход миграций по несвязанным токенам (стопка #478-#481) не
// доезжал до живых миров: версия каждой миграции там уже стояла, гейт выходил
// на первой строке. Поднять версию нельзя — повторный полный прогон переворачивал
// бы знак Мод. характеристик обратно и заново надевал снятое снаряжение.
//
// И хуже: даже в первом прогоне проход по токену читал tokenDoc.actor — это
// синтетический актор, базовый актор + дельта. К этому моменту базовый уже
// мигрирован, и унаследованное токеном значение обрабатывалось второй раз.
// Отсюда два правила, и тесты ниже — на них:
//   1. токен трогается только в том, что лежит в его собственной дельте;
//   2. проход по токенам — под своим ключом версии, отдельно от миграции.

import { describe, it, expect, afterEach, vi } from "vitest";
import { deltaItemIds, deltaOwnedItems, runMigrationGate } from "../../module/migrations/unlinked-tokens.mjs";
import { migrateCharDamageSign } from "../../module/migrations/char-damage-sign.mjs";
import { migrateGearEquipped } from "../../module/migrations/gear-equipped.mjs";

afterEach(() => { delete globalThis.game; delete globalThis.ui; vi.restoreAllMocks(); });

const quietUi = () => { globalThis.ui = { notifications: { info: () => {}, warn: () => {} } }; };

describe("предметы из дельты токена", () => {
  it("надгробие — предмет базового актора, удалённый на токене, — не предмет токена", () => {
    const tokenDoc = { delta: { _source: { items: [{ _id: "a" }, { _id: "b", _tombstone: true }] } } };
    expect([...deltaItemIds(tokenDoc)]).toEqual(["a"]);
  });

  it("унаследованные от базового актора предметы в проход не попадают", () => {
    const own = { id: "own" }, inherited = { id: "base" };
    const tokenDoc = { actor: { items: [own, inherited] }, delta: { _source: { items: [{ _id: "own" }] } } };
    expect(deltaOwnedItems(tokenDoc)).toEqual([own]);
  });

  it("дельты нет — своих предметов у токена нет", () => {
    expect(deltaOwnedItems({ actor: { items: [{ id: "x" }] } })).toEqual([]);
  });
});

describe("runMigrationGate — два ключа версии", () => {
  function settings(values) {
    const store = { ...values };
    game.settings = {
      get: (_scope, k) => store[k] ?? 0,
      set: async (_scope, k, v) => { store[k] = v; }
    };
    return store;
  }
  const opts = (full, tokensOnly) => ({ key: "xVersion", tokensKey: "xTokensVersion", label: "X", full, tokensOnly });
  const ok = () => vi.fn(async () => ({ failed: 0 }));

  it("свежий мир: полный прогон ставит оба ключа — второй раз по токенам не идём", async () => {
    globalThis.game = {};
    const store = settings({});
    const full = ok(), tokens = ok();
    expect(await runMigrationGate(opts(full, tokens))).toBe("full");
    expect(full).toHaveBeenCalledOnce();
    expect(tokens).not.toHaveBeenCalled();
    expect(store).toEqual({ xVersion: 1, xTokensVersion: 1 });
  });

  it("играющий мир, миграция уже прошла: только проход по токенам", async () => {
    globalThis.game = {};
    const store = settings({ xVersion: 1 });
    const full = ok(), tokens = ok();
    expect(await runMigrationGate(opts(full, tokens))).toBe("tokens");
    expect(full).not.toHaveBeenCalled();
    expect(tokens).toHaveBeenCalledOnce();
    expect(store.xTokensVersion).toBe(1);
  });

  it("оба ключа стоят — ничего не запускается", async () => {
    globalThis.game = {};
    settings({ xVersion: 1, xTokensVersion: 1 });
    const full = ok(), tokens = ok();
    expect(await runMigrationGate(opts(full, tokens))).toBe("skip");
    expect(full).not.toHaveBeenCalled();
    expect(tokens).not.toHaveBeenCalled();
  });

  it("частичный сбой прохода по токенам — ключ не ставится, повторится при загрузке", async () => {
    globalThis.game = {};
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = settings({ xVersion: 1 });
    await runMigrationGate(opts(ok(), async () => ({ failed: 2 })));
    expect(store.xTokensVersion).toBeUndefined();
  });
});

describe("migrateCharDamageSign: токен обращает только своё (wdbc-gbd3)", () => {
  function synthetic(system) {
    return {
      system,
      update: vi.fn(async (upd) => {
        for (const [key, val] of Object.entries(upd)) system.charDamage[key.split(".").pop()] = val;
      })
    };
  }

  it("унаследованный от уже обращённого базового актора знак не переворачивается обратно", async () => {
    // Базовый актор обращён: было +10 (штраф), стало −10. Дельта токена
    // charDamage не переопределяет — синтетический актор показывает −10.
    const actor = synthetic({ charDamage: { s: -10 } });
    globalThis.game = { user: { isGM: true }, actors: [], scenes: [{ name: "С", tokens: { contents: [
      { id: "t", name: "Т", actorLink: false, actor, delta: { _source: { system: {} } } }
    ] } }] };
    quietUi();

    await migrateCharDamageSign({ tokensOnly: true });

    expect(actor.update).not.toHaveBeenCalled();
    expect(actor.system.charDamage.s).toBe(-10);
  });

  it("значение, записанное в самой дельте токена, обращается", async () => {
    const actor = synthetic({ charDamage: { s: 10 } });
    globalThis.game = { user: { isGM: true }, actors: [], scenes: [{ name: "С", tokens: { contents: [
      { id: "t", name: "Т", actorLink: false, actor, delta: { _source: { system: { charDamage: { s: 10 } } } } }
    ] } }] };
    quietUi();

    const res = await migrateCharDamageSign({ tokensOnly: true });

    expect(actor.system.charDamage.s).toBe(-10);
    expect(res.actorCount).toBe(1);
  });

  it("tokensOnly не трогает мировых акторов — они пройдены прошлой версией", async () => {
    const world = synthetic({ charDamage: { s: -10 } });
    globalThis.game = { user: { isGM: true }, actors: [world], scenes: [] };
    quietUi();

    await migrateCharDamageSign({ tokensOnly: true });

    expect(world.update).not.toHaveBeenCalled();
  });
});

describe("migrateGearEquipped: снятое на токене не надевается заново (wdbc-gbd3)", () => {
  it("вещь, унаследованная от базового актора, не трогается; своя — надевается", async () => {
    const inherited = { id: "base", type: "gear", system: { worn: "Плащ", equipped: false } };
    const own = { id: "own", type: "gear", system: { worn: "Плащ", equipped: false } };
    const actor = {
      items: [inherited, own],
      updateEmbeddedDocuments: vi.fn(async (_type, updates) => {
        for (const u of updates) actor.items.find(i => i.id === u._id).system.equipped = u["system.equipped"];
      })
    };
    globalThis.game = { user: { isGM: true }, actors: [], scenes: [{ name: "С", tokens: { contents: [
      { id: "t", name: "Т", actorLink: false, actor, delta: { _source: { items: [{ _id: "own" }] } } }
    ] } }] };
    quietUi();

    await migrateGearEquipped({ tokensOnly: true });

    expect(inherited.system.equipped).toBe(false);
    expect(own.system.equipped).toBe(true);
  });
});
