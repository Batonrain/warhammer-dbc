// test/combat/bulldoze-roadkill.test.mjs
//
// Roadkill / Переехать (Всадник, Sahara 3-cross-actor-5482; DoomBC — Основная
// книга): «Успешно проводя Напролом байком, цель всегда сбивается с ног и вместо
// обычного урона получает 2d10+A.b R Dmg, Pen P.b, Tearing. Не работает с байком,
// над которым персонаж не потрудился хотя бы ¼ смены.»

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, char } from "../support/combat-fixtures.mjs";
import { resolveBulldozeSuccess } from "../../module/combat/bulldoze.mjs";
import { roadkillDamage } from "../../module/rules/mount.mjs";

const realFromUuid = globalThis.fromUuid;
const bike = () => ({ type: "vehicle", uuid: "Actor.bike", name: "Байк", items: [], system: {} });
const roadkill = () => ({ id: "rk", name: "Roadkill / Переехать", type: "talent", system: {} });

function rider({ items = [], onBike = true } = {}) {
  const actor = actorFor({
    items, characteristics: { ag: char(35), per: char(42), ws: char(45), s: char(40), t: char(40) },
    mount: onBike ? { uuid: "Actor.bike", role: "rider", speed: "charge" } : { uuid: "", role: "rider", speed: "still" }
  });
  const store = {};
  actor.getFlag = (s, k) => store[`${s}.${k}`];
  actor.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  return actor;
}
function victim() {
  const t = actorFor({ conditions: {} });
  t.update = async f => { Object.assign(t.system.conditions, { prone: f["system.conditions.prone"] }); t.lastUpdate = f; };
  return t;
}

beforeEach(() => { resetCaptured(); globalThis.fromUuid = async () => bike(); });
afterEach(() => { globalThis.fromUuid = realFromUuid; });

describe("Roadkill: расчёт урона", () => {
  it("2d10 + A.b, Pen = P.b, Рвущий (R), Tearing", () => {
    const d = roadkillDamage(rider());
    expect(d).toMatchObject({ dice: 3, keep: 2, bonus: 3, penetration: 4, damageType: "rending", tearing: true });
  });
});

describe("Roadkill в Напролом (resolveBulldozeSuccess)", () => {
  it("байк + Талант: цель сбита при ЛЮБОЙ победе, вместо Пинка — кнопка урона 2d10+A.b R, Pen P.b", async () => {
    captured.dice = [3, 9, 6];                      // 3d10, оставить два лучших: 9 + 6 = 15, + A.b 3
    const t = victim();
    await resolveBulldozeSuccess(rider({ items: [roadkill()] }), { deg: 1, target: t });
    expect(t.system.conditions.prone).toBe(true);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Переехать");
    expect(html).toMatch(/data-damage="18"/);
    expect(html).toMatch(/data-penetration="4"/);
    expect(html).toMatch(/data-damage-type="rending"/);
    expect(html).not.toContain("Пинком");
  });

  it("чужая цель (NPC игроку не принадлежит): «Ничком» уходит ГМу, кнопка урона Переехать на месте", async () => {
    const prev = { socket: game.socket, users: game.users, user: game.user };
    const emitted = [];
    Object.assign(game, { socket: { emit: (_c, p) => emitted.push(p) }, users: { activeGM: { id: "gm" } }, user: { id: "u1", isGM: false } });
    try {
      const t = victim();
      t.isOwner = false;
      t.update = async () => { throw new Error("lacks permission"); };
      await resolveBulldozeSuccess(rider({ items: [roadkill()] }), { deg: 1, target: t });
      expect(emitted[0].op.data["system.conditions.prone"]).toBe(true);
      expect(captured.chat.at(-1).content).toContain("wh-apply-dmg-btn");
    } finally { Object.assign(game, prev); }
  });

  it("с Талантом, но не на байке — обычный Напролом (1 Успех не сбивает)", async () => {
    const t = victim();
    t.update = async f => { t.lastUpdate = f; };
    await resolveBulldozeSuccess(rider({ items: [roadkill()], onBike: false }), { deg: 1, target: t });
    expect(t.lastUpdate).toBeUndefined();
    expect(captured.chat.at(-1).content).not.toContain("Переехать");
  });

  it("не байк, а живой скакун — Талант молчит", async () => {
    globalThis.fromUuid = async () => ({ type: "character", uuid: "Actor.bike", name: "Конь", items: [], system: {} });
    const t = victim();
    t.update = async f => { t.lastUpdate = f; };
    await resolveBulldozeSuccess(rider({ items: [roadkill()] }), { deg: 1, target: t });
    expect(t.lastUpdate).toBeUndefined();
  });

  it("байк без Таланта — обычный Напролом", async () => {
    const t = victim();
    t.update = async f => { t.lastUpdate = f; };
    await resolveBulldozeSuccess(rider(), { deg: 1, target: t });
    expect(t.lastUpdate).toBeUndefined();
  });
});
