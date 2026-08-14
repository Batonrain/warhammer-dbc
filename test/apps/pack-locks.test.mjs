// test/apps/pack-locks.test.mjs
//
// Замки библиотек системы держит одна настройка — «Разблокировать библиотеки
// для правки». Её ключ остался от прежнего смысла (protectCompendiumEdits,
// «защищать правки»), а поведение с тех пор перевернулось: включена — паки
// открыты, выключена — закрыты. Поэтому направление проверяется здесь, а не
// вычитывается из имени ключа.
//
// Приводить состояние к настройке приходится в обе стороны: до этого выключение
// настройки паки обратно не закрывало, и однажды открытая библиотека оставалась
// открытой навсегда (configure пишет в game.settings и переживает перезапуск).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { setSystemPackLocks } from "../../module/apps/pack-locks.mjs";

/** Пак-заглушка: помнит состояние замка и все его смены. */
function packStub(collection, locked, { packageName = "warhammer-dbc", broken = false } = {}) {
  const pack = {
    collection, locked, metadata: { packageName }, calls: [],
    configure: async ({ locked: l }) => {
      if (broken) throw new Error("пак недоступен");
      pack.calls.push(l);
      pack.locked = l;
    }
  };
  return pack;
}

/** game.packs у Foundry перебирается по самим пакам, а не по парам, как Map. */
const withPacks = (...packs) => { globalThis.game.packs = packs; return packs; };

describe("замки компендиумов системы по настройке", () => {
  it("выключенная настройка закрывает открытые библиотеки", async () => {
    const open   = packStub("warhammer-dbc.talents", false);
    const closed = packStub("warhammer-dbc.traits", true);
    withPacks(open, closed);

    expect(await setSystemPackLocks(true)).toBe(1);

    expect(open.calls).toEqual([true]);
    // Уже закрытый не трогаем: иначе каждый запуск мира писал бы в настройки
    // впустую и сообщал ГМу о смене, которой не было.
    expect(closed.calls).toEqual([]);
  });

  it("включённая — открывает закрытые", async () => {
    const closed = packStub("warhammer-dbc.talents", true);
    const open   = packStub("warhammer-dbc.traits", false);
    withPacks(closed, open);

    expect(await setSystemPackLocks(false)).toBe(1);

    expect(closed.calls).toEqual([false]);
    expect(open.calls).toEqual([]);
  });

  it("чужие компендиумы не трогает вовсе", async () => {
    const foreign = packStub("dnd5e.items", false, { packageName: "dnd5e" });
    const world   = packStub("world.my-notes", false, { packageName: "world" });
    withPacks(foreign, world);

    expect(await setSystemPackLocks(true)).toBe(0);

    expect(foreign.calls).toEqual([]);
    expect(world.calls).toEqual([]);
  });

  it("упавший пак не срывает остальные", async () => {
    const broken = packStub("warhammer-dbc.talents", false, { broken: true });
    const ok     = packStub("warhammer-dbc.traits", false);
    withPacks(broken, ok);

    expect(await setSystemPackLocks(true)).toBe(1);

    expect(ok.calls).toEqual([true]);
  });
});
