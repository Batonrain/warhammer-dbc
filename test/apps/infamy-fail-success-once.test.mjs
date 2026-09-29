// test/apps/infamy-fail-success-once.test.mjs
//
// «Провал → Очко Бесчестия → Успех» (Змеиный Язык, Выживальщик —
// module/apps/infamy-fail-success.mjs), wdbc-6rjtc.3(б). Флаг «уже заменён»
// проверялся до списания, а ставился после двух await — двойной клик списывал
// Очко дважды и писал две карточки. Если автор карточки не нажавший (ГМ
// бросил тест с листа игрока), setFlag падал уже ПОСЛЕ списания: Очко ушло,
// карточки нет, кнопка активна.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { spendInfamyForFailSuccess } from "../../module/apps/infamy-fail-success.mjs";

const NS = "warhammer-dbc";
const SERPENT = packDocById("packs-src/traits", "d3PBgi3D4Ye4e2Y6");
const CAP = "trait.serpentSTongue";

function fakeActor() {
  const all = [{ id: "t0", name: SERPENT.name, type: SERPENT.type, system: SERPENT.system, flags: SERPENT.flags }];
  return {
    id: "a1", uuid: "Actor.a1", name: "Отступник", type: "character",
    system: { fate: { value: 2, max: 3 }, conditions: {} },
    flags: { [NS]: {} }, updates: [],
    items: Object.assign([...all], { contents: all, get: id => all.find(i => i.id === id) }),
    getFlag(ns, k) { return this.flags[ns]?.[k]; },
    async setFlag(ns, k, v) { (this.flags[ns] ??= {})[k] = v; },
    async update(u) { this.updates.push(u); }
  };
}

let seq = 0;
function fakeMessage({ isOwner = true } = {}) {
  return {
    id: `fs${++seq}`, isOwner, flags: {},
    getFlag(ns, k) { return this.flags[ns]?.[k]; },
    async setFlag(ns, k, v) {
      if (!this.isOwner) throw new Error("нет прав на сообщение");
      await new Promise(r => setTimeout(r, 1));
      (this.flags[ns] ??= {})[k] = v;
    }
  };
}

const realGetProperty = globalThis.foundry.utils.getProperty;
let prev, emitted;
beforeEach(() => {
  resetCaptured();
  globalThis.foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);
  emitted = [];
  prev = { socket: game.socket, users: game.users, user: game.user };
  game.socket = { emit: (ch, d) => emitted.push(d) };
  game.users = Object.assign([], { activeGM: { id: "gm" } });
  game.user = { id: "u1" };
});
afterEach(() => {
  globalThis.foundry.utils.getProperty = realGetProperty;
  Object.assign(game, prev);
});

describe("провал → успех: одна карточка — одно Очко (wdbc-6rjtc.3б)", () => {
  it("двойной клик: Очко списано один раз, карточка-итог одна", async () => {
    const actor = fakeActor();
    const message = fakeMessage();
    const res = await Promise.all([
      spendInfamyForFailSuccess(actor, CAP, { testLabel: "Обаяние", message }),
      spendInfamyForFailSuccess(actor, CAP, { testLabel: "Обаяние", message })
    ]);
    expect(res.filter(Boolean)).toHaveLength(1);
    expect(actor.updates).toEqual([{ "system.fate.value": 1 }]);
    expect(captured.chat).toHaveLength(1);
    expect(message.flags[NS].infamyFailSuccessUsed).toBe(true);
  });

  it("карточка ГМа, жмёт игрок: Очко списано, итог есть, отметку ставит ГМ сокетом", async () => {
    const actor = fakeActor();
    const message = fakeMessage({ isOwner: false });
    expect(await spendInfamyForFailSuccess(actor, CAP, { message })).toBe(true);
    expect(actor.updates).toEqual([{ "system.fate.value": 1 }]);
    expect(captured.chat).toHaveLength(1);
    expect(emitted).toContainEqual({ action: "messageUsedFlag", messageId: message.id,
      key: "infamyFailSuccessUsed", userId: "u1" });
    // Повторный клик до прихода флага от ГМа — отбит, Очко цело.
    expect(await spendInfamyForFailSuccess(actor, CAP, { message })).toBe(false);
    expect(actor.updates).toHaveLength(1);
  });

  it("карточка чужая и Мастера нет — Очко не списывается вовсе", async () => {
    game.users = Object.assign([], { activeGM: null });
    const actor = fakeActor();
    expect(await spendInfamyForFailSuccess(actor, CAP, { message: fakeMessage({ isOwner: false }) })).toBe(false);
    expect(actor.updates).toEqual([]);
    expect(captured.chat).toHaveLength(0);
  });
});
