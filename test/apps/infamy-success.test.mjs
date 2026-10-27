// test/apps/infamy-success.test.mjs
//
// Трата Очка Бесчестия «Успех» из меню карточки теста (решение владельца 27.10.2026): «+1 Успех к
// успешному тесту» дописывается в саму карточку (как «Переброс» и «+10»), а не остаётся строкой на полосе.
// С Сфокусированным Гневом рукопашная атака по Ненавистной цели получает ещё +1 Успех.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { successTarget, spendSuccessOnCard } from "../../module/apps/infamy-success.mjs";
import { successBonusOutcome } from "../../module/rules/fate-bonus.mjs";
import { raceTarget } from "../../module/rules/talent-targets.mjs";
import { CARD_ONCE_FLAGS } from "../../module/combat/card-once.mjs";

const NS = "warhammer-dbc";
const hatred = (...t) => ({ type: "talent", name: "Hatred / Ненависть", system: { targets: t } });
const wrath = () => ({ type: "talent", name: "Focused Wrath / Сфокусированный Гнев", system: {} });

/** Подставная карточка чата: флаги, getFlag/setFlag, свои права. */
let seq = 0;   // метка «уже сделано» помнится по id карточки между тестами — у каждой свой id
function card({ flags = {}, content = "", rolls = [] } = {}) {
  const store = { ...flags };
  return {
    id: `msg${++seq}`, isOwner: true, content, rolls, speaker: {}, flags: { [NS]: store },
    getFlag: (s, k) => (s === NS ? store[k] : undefined),
    setFlag: async (s, k, v) => { if (s === NS) store[k] = v; }
  };
}
const text = () => captured.chat.map(m => String(m.content)).join("\n");
const degreesInAttackCard = () => (text().match(/Попадание — (\d+) степ/) ?? [])[1];

const realGetProperty = foundry.utils.getProperty;
beforeEach(() => {
  resetCaptured(); setTargets([]);
  foundry.utils.getProperty = (o, path) => path.split(".").reduce((a, k) => a?.[k], o);
  globalThis.game.users = { activeGM: { id: "gm" } };
});
afterEach(() => { foundry.utils.getProperty = realGetProperty; });

describe("чистая часть: Успех только к УСПЕШНОМУ тесту", () => {
  it("успех: степени + Успехи; провал не лечится", () => {
    expect(successBonusOutcome({ rv: 30, threshold: 45, extra: 1 })).toMatchObject({ success: true, degrees: 3 });
    expect(successBonusOutcome({ rv: 30, threshold: 45, extra: 0 })).toMatchObject({ degrees: 2 });
    expect(successBonusOutcome({ rv: 60, threshold: 45, extra: 1 })).toBeNull();
    expect(successBonusOutcome({ rv: null, threshold: 45 })).toBeNull();
  });
  it("ключ отметки карточки есть в белом списке сокета", () => {
    expect(CARD_ONCE_FLAGS).toContain("infamySuccessAdded");
  });
});

describe("какие карточки принимают Успех", () => {
  it("успешная атака и успешный тест — да; провал, неизвестный порог, повтор — нет", () => {
    expect(successTarget(card({ flags: { attack: { rv: 30, threshold: 45 } } }))).toMatchObject({ kind: "attack", deg: 2 });
    expect(successTarget(card({ flags: { attack: { rv: 80, threshold: 45 } } }))).toBeNull();
    expect(successTarget(card({ content: "Порог: <b>45</b>", rolls: [{ total: 20 }] }))).toMatchObject({ kind: "test", deg: 3 });
    expect(successTarget(card({ content: "Порог: <b>45</b>", rolls: [{ total: 90 }] }))).toBeNull();
    expect(successTarget(card({ content: "без порога", rolls: [{ total: 20 }] }))).toBeNull();
    expect(successTarget(card({ flags: { attack: { rv: 30, threshold: 45 }, infamySuccessAdded: true } }))).toBeNull();
  });
});

describe("атака: попадание берётся с самой карточки, устаревшие карточки не принимают Успех", () => {
  it("flags.attack.hit главнее куба: Длань Кхорна (куб ≤ порога, но промах) — нет; Атака Ненависти (куб выше порога, но попадание) — да", () => {
    expect(successTarget(card({ flags: { attack: { rv: 30, threshold: 45, hit: false } } }))).toBeNull();
    expect(successTarget(card({ flags: { attack: { rv: 80, threshold: 45, hit: true } } }))).toMatchObject({ kind: "attack" });
  });
  it("карточка, с которой атаку уже переиграли (attackRerolled), Успех не принимает", () => {
    expect(successTarget(card({ flags: { attack: { rv: 30, threshold: 45, hit: true }, attackRerolled: true } }))).toBeNull();
  });
});

describe("обычный тест: Успех дописывается новой карточкой", () => {
  const berserk = (items = []) => ({ id: "a1", name: "Берсерк", type: "character", items, update: async () => {},
    system: { fate: { value: 3, max: 3 }, corruption: { value: 30 }, characteristics: { inf: { bonus: 3 } } } });

  it("тратит Очко, дописывает +1 Успех: степени 3 → 4, карточка помечена", async () => {
    const msg = card({ content: "Порог: <b>45</b>", rolls: [{ total: 20 }], flags: { skillTest: { success: true, deg: 3 } } });
    const actor = berserk();
    expect(await spendSuccessOnCard(actor, msg)).toBe(true);
    expect(text()).toMatch(/Успех — 4 /);
    expect(msg.getFlag(NS, "infamySuccessAdded")).toBe(true);
    // второй раз с той же карточки — отказ, второе Очко не уходит
    captured.chat.length = 0;
    expect(await spendSuccessOnCard(actor, msg)).toBe(false);
    expect(text()).not.toContain("Успех — ");
  });

  it("второй «Успех» подряд складывается со вторым: с новой карточки степени 4 → 5 (Очко не горит)", async () => {
    const msg = card({ content: "Порог: <b>45</b>", rolls: [{ total: 20 }], flags: { skillTest: { success: true, deg: 3 } } });
    const actor = berserk();
    await spendSuccessOnCard(actor, msg);
    const posted = captured.chat.at(-1);
    const msg2 = card({ flags: posted.flags[NS], content: posted.content, rolls: [{ total: 20 }] });
    captured.chat.length = 0;
    expect(await spendSuccessOnCard(actor, msg2)).toBe(true);
    expect(text()).toMatch(/Успех — 5 /);
  });

  it("карточка «+10»: порог берётся поднятый («база → поднятый»), а не база", async () => {
    // порог 40 → 50, бросок 45: по базе провал, с +10 успех в 1 степень
    const m1 = card({ content: "Порог: <b>40</b> → <b>50</b>", rolls: [{ total: 45 }] });
    expect(successTarget(m1)).toMatchObject({ kind: "test", threshold: 50, deg: 1 });
    const m2 = card({ content: "Порог: <b>40</b> → <b>50</b>", rolls: [{ total: 35 }] });
    expect(successTarget(m2)).toMatchObject({ deg: 2 });
  });

  it("Тзинч на Cor 20+: «Вспышка Гения» — бросок 1d5 Успехов вместо +1", async () => {
    const actor = berserk(); actor.system.alignment = "heretic"; actor.system.patronGod = "tzeentch";
    const msg = card({ content: "Порог: <b>45</b>", rolls: [{ total: 20 }], flags: { skillTest: { success: true, deg: 3 } } });
    captured.dice = [4];
    expect(await spendSuccessOnCard(actor, msg)).toBe(true);
    expect(text()).toMatch(/Успех — 7 /);       // 3 степени + 4
  });

  it("провалённый тест — Очко не тратится", async () => {
    const msg = card({ content: "Порог: <b>45</b>", rolls: [{ total: 90 }] });
    expect(await spendSuccessOnCard(berserk(), msg)).toBe(false);
    expect(captured.chat).toHaveLength(0);
  });

  it("Порчи не хватает (Cor < 20) — трата отказана, карточка не меняется и не помечена", async () => {
    const actor = berserk(); actor.system.corruption.value = 5;
    const msg = card({ content: "Порог: <b>45</b>", rolls: [{ total: 20 }] });
    expect(await spendSuccessOnCard(actor, msg)).toBe(false);
    expect(msg.getFlag(NS, "infamySuccessAdded")).toBeFalsy();
    expect(text()).not.toContain("Успех — ");
  });
});

describe("атака: переигрывается тем же кубом с дописанными Успехами", () => {
  async function run(items, race = "ork") {
    setTargets([{ type: "character", uuid: "Actor.victim", system: { race } }]);
    const sword = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", damage: "1d10", penetration: 0 }, { name: "Меч" });
    const actor = actorFor({ items: [sword, ...items], alignment: "heretic", patronGod: "khorne",
      fate: { value: 3, max: 3 }, corruption: { value: 30 },
      characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35), inf: char(32) } });
    actor.id = "a1"; actor.update = async () => {};
    const roster = [actor]; roster.get = id => (id === "a1" ? actor : null);
    globalThis.game.actors = roster;
    const msg = card({ flags: { attack: { actorId: "a1", itemId: sword.id, charKey: "ws", rv: 30, threshold: 45,
      rofMode: "melee", aimTarget: null, opts: {}, targetUuid: "Actor.victim" } } });
    captured.dice = [30, 5];
    globalThis.fromUuid = async () => ({ system: { race } });
    const ok = await spendSuccessOnCard(actor, msg);
    return { ok, msg };
  }

  it("без Таланта: +1 Успех (базовые 2 степени → 3), тот же куб 30", async () => {
    const { ok, msg } = await run([]);
    expect(ok).toBe(true);
    expect(degreesInAttackCard()).toBe("3");
    expect(msg.getFlag(NS, "infamySuccessAdded")).toBe(true);
    expect(msg.getFlag(NS, "attackRerolled")).toBe(true);                       // старая карточка переиграна
    expect(captured.chat.at(-1).flags[NS].attack.hit).toBe(true);               // новая несёт фактическое попадание
  });

  it("Сфокусированный Гнев + Ненавистная цель: ещё +1 Успех (итого +2 → 4 степени)", async () => {
    const { ok } = await run([hatred(raceTarget("ork", "Орк")), wrath()]);
    expect(ok).toBe(true);
    expect(degreesInAttackCard()).toBe("4");
  });

  it("Сфокусированный Гнев, но цель не Ненавистная — только +1", async () => {
    await run([hatred(raceTarget("ork", "Орк")), wrath()], "human");
    expect(degreesInAttackCard()).toBe("3");
  });
});

describe("проводка в hooks.mjs", () => {
  it("меню карточки несёт пункт «Успех» и вызывает spendSuccessOnCard", async () => {
    const fs = await import("node:fs");
    const hooks = fs.readFileSync(new URL("../../module/hooks.mjs", import.meta.url), "utf8");
    expect(hooks).toContain("successTarget(message)");
    expect(hooks).toContain("spendSuccessOnCard(actor, message)");
  });
});
