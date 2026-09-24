// test/sheets/tabs/mount-panel-od.test.mjs
//
// Стр. 477, wdbc-x1nz.2.35: «Оседлать/Спешиться — Полудействие». Раньше
// setMount/clearMount меняли flags.mount.uuid бесплатно, без расхода ОД.

import "../../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setMount, clearMount } from "../../../module/sheets/tabs/mount-panel.mjs";

function actorFor({ actionPoints = { value: 2, max: 2 }, mount = {} } = {}) {
  const doc = { name: "Седок", type: "character", uuid: "Actor.rider1", system: { actionPoints, mount } };
  doc.update = async data => {
    for (const [path, value] of Object.entries(data)) {
      const keys = path.split(".");
      let node = doc;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = value;
    }
    return doc;
  };
  return doc;
}

function mountFor({ type = "character", uuid = "Actor.horse1", size = 0, name = "Скакун" } = {}) {
  return { name, type, uuid, system: { size } };
}

beforeEach(resetCaptured);
afterEach(() => { globalThis.game.combat = undefined; });

describe("setMount (Оседлать)", () => {
  it("вне боя — ОД не проверяются, связь заводится", async () => {
    const rider = actorFor();
    await setMount(rider, mountFor());
    expect(rider.system.mount.uuid).toBe("Actor.horse1");
  });

  it("в бою хватает ОД — списывает 1 ОД, связь заводится", async () => {
    globalThis.game.combat = { started: true };
    const rider = actorFor({ actionPoints: { value: 2, max: 2 } });
    await setMount(rider, mountFor());
    expect(rider.system.actionPoints.value).toBe(1);
    expect(rider.system.mount.uuid).toBe("Actor.horse1");
  });

  it("в бою без ОД — блокируется, связь не заводится", async () => {
    globalThis.game.combat = { started: true };
    const rider = actorFor({ actionPoints: { value: 0, max: 2 } });
    await setMount(rider, mountFor());
    expect(rider.system.actionPoints.value).toBe(0);
    expect(rider.system.mount.uuid).toBeUndefined();
    expect(captured.warnings.some(w => w.includes("Оседлать"))).toBe(true);
  });
});

describe("clearMount (Спешиться)", () => {
  it("вне боя — ОД не проверяются, связь снимается", async () => {
    const rider = actorFor({ mount: { uuid: "Actor.horse1" } });
    await clearMount(rider);
    expect(rider.system.mount.uuid).toBe("");
  });

  it("в бою хватает ОД — списывает 1 ОД, связь снимается", async () => {
    globalThis.game.combat = { started: true };
    const rider = actorFor({ actionPoints: { value: 2, max: 2 }, mount: { uuid: "Actor.horse1" } });
    await clearMount(rider);
    expect(rider.system.actionPoints.value).toBe(1);
    expect(rider.system.mount.uuid).toBe("");
  });

  it("в бою без ОД — блокируется, связь остаётся", async () => {
    globalThis.game.combat = { started: true };
    const rider = actorFor({ actionPoints: { value: 0, max: 2 }, mount: { uuid: "Actor.horse1" } });
    await clearMount(rider);
    expect(rider.system.mount.uuid).toBe("Actor.horse1");
    expect(captured.warnings.some(w => w.includes("Спешиться"))).toBe(true);
  });
});

// wdbc-bjy1.12: ГМ, по ошибке посадивший персонажа в седло, должен суметь
// откатить это без ОД — но только явным подтверждением, иначе ГМ за НПЦ
// молча обходил бы правило в честной игре.
describe("clearMount: аварийный выход ГМа без ОД", () => {
  let savedUser;
  beforeEach(() => { savedUser = globalThis.game.user; captured.dialog = null; });
  afterEach(() => { globalThis.game.user = savedUser; captured.confirmAnswer = undefined; });

  it("ГМ подтвердил исправление — связь снята, ОД не тронуты", async () => {
    globalThis.game.combat = { started: true };
    globalThis.game.user = { ...savedUser, isGM: true };
    captured.confirmAnswer = true;
    const rider = actorFor({ actionPoints: { value: 0, max: 2 }, mount: { uuid: "Actor.horse1" } });
    await clearMount(rider);
    expect(captured.dialog).toBeTruthy();
    expect(rider.system.mount.uuid).toBe("");
    expect(rider.system.actionPoints.value).toBe(0);
  });

  it("ГМ отказался — связь остаётся", async () => {
    globalThis.game.combat = { started: true };
    globalThis.game.user = { ...savedUser, isGM: true };
    captured.confirmAnswer = false;
    const rider = actorFor({ actionPoints: { value: 0, max: 2 }, mount: { uuid: "Actor.horse1" } });
    await clearMount(rider);
    expect(rider.system.mount.uuid).toBe("Actor.horse1");
  });

  it("игроку без ОД диалог не предлагается — только предупреждение", async () => {
    globalThis.game.combat = { started: true };
    globalThis.game.user = { ...savedUser, isGM: false };
    captured.confirmAnswer = true;
    const rider = actorFor({ actionPoints: { value: 0, max: 2 }, mount: { uuid: "Actor.horse1" } });
    await clearMount(rider);
    expect(captured.dialog).toBeNull();
    expect(rider.system.mount.uuid).toBe("Actor.horse1");
  });
});
