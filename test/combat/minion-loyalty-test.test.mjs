// test/combat/minion-loyalty-test.test.mjs
//
// Бросок теста Лояльности и карточка (combat/minion-loyalty-test.mjs):
// Монозависимый бросает второй раз только после провала, Обожание Толпы
// тратит Реакцию и начисляет Хозяину Очко Бесчестия, провал в бою пишет
// перехват контроля ГМом. Кнопки на листе Миньона и у Хозяина.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { resetCaptured, captured } from "../support/foundry-stub.mjs";
import { rollLoyaltyTest } from "../../module/combat/minion-loyalty-test.mjs";

const named = (type, name) => ({ id: `${type}-${name}`, type, name, system: {} });
const minion = ({ loyalty = 40, items = [] } = {}) => ({
  uuid: "Actor.m", id: "m", name: "Слуга", isOwner: true,
  system: { loyalty: { value: loyalty, max: loyalty }, minionType: "human", masterUuid: "Actor.h" },
  items, flags: {}
});
const master = (items = []) => ({ uuid: "Actor.h", name: "Хозяин", isOwner: true, system: {}, items, flags: {} });

/** Очередь значений d100. */
function dice(...values) {
  const queue = [...values];
  const calls = [];
  const fn = async () => { const total = queue.shift(); calls.push(total); return { roll: { total }, total }; };
  fn.calls = calls;
  return fn;
}

const lastCard = () => String(captured.chat.at(-1)?.content ?? "");

beforeEach(() => resetCaptured());

describe("Тест Лояльности: бросок и карточка", () => {
  it("успех: один бросок, порог — Лояльность с модификатором ГМа", async () => {
    const rollFn = dice(35);
    const r = await rollLoyaltyTest(minion(), { master: master(), reason: "risk", mod: -5, rollFn });
    expect(r).toMatchObject({ success: true, threshold: 35, rerolled: false, gmControl: false });
    expect(rollFn.calls).toEqual([35]);
    expect(lastCard()).toMatch(/Тест Лояльности/);
    expect(lastCard()).toMatch(/Рискнуть жизнью/);
  });

  it("провал в бою — строка о перехвате контроля ГМом", async () => {
    const r = await rollLoyaltyTest(minion(), { master: master(), reason: "mission", inCombat: true, rollFn: dice(80) });
    expect(r).toMatchObject({ success: false, gmControl: true });
    expect(lastCard()).toMatch(/перехватывает контроль/);
  });

  it("провал в бою: бросил ГМ — Миньон перехвачен сразу, бросил игрок — кнопка для ГМа", async () => {
    const seized = [];
    await rollLoyaltyTest(minion(), { master: master(), reason: "mission", inCombat: true, rollFn: dice(80),
      seizeFn: async a => { seized.push(a.uuid); return true; } });
    expect(seized).toEqual(["Actor.m"]);
    expect(lastCard()).toContain("под контролем ГМа");
    await rollLoyaltyTest(minion(), { master: master(), reason: "mission", inCombat: true, rollFn: dice(80),
      seizeFn: async () => false });
    expect(lastCard()).toContain("wh-loyalty-seize-btn");
  });

  it("Связан душой (Ритуал Связывания Души): провальный бросок засчитан успехом, без переброса", async () => {
    const bound = { ...minion({ items: [named("trait", "Monodevotant / Монозависимый")] }), flags: { "warhammer-dbc": { soulBound: true } } };
    const rollFn = dice(95, 10);
    const r = await rollLoyaltyTest(bound, { master: master(), reason: "mission", inCombat: true, rollFn });
    expect(r).toMatchObject({ success: true, rerolled: false, gmControl: false });
    expect(rollFn.calls).toEqual([95]);
    expect(lastCard()).toMatch(/Связан душой/);
  });

  it("Монозависимый: второй бросок только после провала, и он окончательный", async () => {
    const mono = minion({ items: [named("trait", "Monodevotant / Монозависимый")] });
    const ok = dice(20, 99);
    expect(await rollLoyaltyTest(mono, { master: master(), rollFn: ok })).toMatchObject({ success: true, rerolled: false });
    expect(ok.calls).toEqual([20]);

    const rr = dice(70, 15);
    expect(await rollLoyaltyTest(mono, { master: master(), rollFn: rr })).toMatchObject({ success: true, rerolled: true, rv: 15 });
    expect(rr.calls).toEqual([70, 15]);
    expect(lastCard()).toMatch(/Монозависимый: провал на 70 переброшен/);
  });

  it("Обожание Толпы: Реакция Миньона и +1 Очко Бесчестия Хозяину при Успехе", async () => {
    const h = master([named("trait", "Adoring Crowds / Обожание Толпы")]);
    const spent = [];
    const restored = [];
    const r = await rollLoyaltyTest(minion(), {
      master: h, reason: "adoringCrowds", rollFn: dice(10),
      spendReactionFn: async a => { spent.push(a.uuid); return true; },
      restoreInfamyFn: async (a, d) => { restored.push([a.uuid, d]); return { changed: true, before: 1, after: 2, max: 3 }; }
    });
    expect(spent).toEqual(["Actor.m"]);
    expect(restored).toEqual([["Actor.h", 1]]);
    expect(r).toMatchObject({ success: true, infamyRestored: 1, gmControl: false });
    expect(lastCard()).toMatch(/Очки Бесчестия <b>2<\/b>\/3/);
  });

  // Ревью #581 п.4: кнопка на листе Хозяина берёт мирового актора; в бою
  // Реакцию надо списывать с актора участника (у несвязанного токена — свой).
  it("Обожание Толпы в бою: Реакция списывается с актора участника боя", async () => {
    const h = master([named("trait", "Adoring Crowds / Обожание Толпы")]);
    const tokenActor = { uuid: "Scene.s.Token.t.Actor.m" };
    const prev = globalThis.game.combat;
    globalThis.game.combat = { started: true, combatants: [{ actorId: "m", actor: tokenActor }] };
    const spent = [];
    try {
      await rollLoyaltyTest(minion(), {
        master: h, reason: "adoringCrowds", rollFn: dice(10),
        spendReactionFn: async a => { spent.push(a.uuid); return true; },
        restoreInfamyFn: async () => ({ changed: true, before: 1, after: 2, max: 3 })
      });
    } finally { globalThis.game.combat = prev; }
    expect(spent).toEqual(["Scene.s.Token.t.Actor.m"]);
  });

  it("Обожание Толпы без Реакции — теста нет", async () => {
    const h = master([named("trait", "Adoring Crowds / Обожание Толпы")]);
    const rollFn = dice(10);
    const r = await rollLoyaltyTest(minion(), { master: h, reason: "adoringCrowds", rollFn, spendReactionFn: async () => false });
    expect(r).toBeNull();
    expect(rollFn.calls).toEqual([]);
  });

  it("Обожание Толпы у Хозяина без Черты — отказ", async () => {
    const r = await rollLoyaltyTest(minion(), { master: master(), reason: "adoringCrowds", rollFn: dice(10), spendReactionFn: async () => true });
    expect(r).toBeNull();
  });
});

describe("Кнопки теста Лояльности", () => {
  it("на листе Миньона рядом с Лояльностью", () => {
    const hbs = fs.readFileSync("templates/actor/parts/minion-header.hbs", "utf8");
    expect(hbs).toMatch(/data-action="minionLoyaltyTest"/);
    const js = fs.readFileSync("module/sheets/minion-sheet.mjs", "utf8");
    expect(js).toMatch(/minionLoyaltyTest:\s*onLoyaltyTest/);
  });

  it("на карточке слуги у Хозяина", () => {
    const hbs = fs.readFileSync("templates/actor/parts/tab-social.hbs", "utf8");
    expect(hbs).toMatch(/class="minion-loyalty-roll" data-uuid="\{\{m\.uuid\}\}"/);
    const js = fs.readFileSync("module/sheets/tabs/minions-panel.mjs", "utf8");
    expect(js).toMatch(/\.minion-loyalty-roll[\s\S]*openLoyaltyTest/);
  });
});
