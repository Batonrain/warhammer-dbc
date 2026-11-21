// test/rules/vampire-battle-form.test.mjs
//
// Боевая форма Вампира (Стадия Пакта 2, Sahara 583-deadly-natural-weapons-
// fear-flyer): «+10 к S, T и A, Трейты Deadly Natural Weapons (3, Когти,
// Укус), Fear (1) и Flyer (A.b×2) … после Cor.b×10 минут в боевой форме
// обязан вернуться». Трейты — записи kind:"trait" с гейтом «Когда включено»
// (выдаются включением и снимаются выключением, apps/mechanics.mjs), срок —
// activateItemUntil(…, { seconds }) по worldTime (rules/item-activation.mjs).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const STAGE2 = "packs-src/talents/Элитные_архетипы/Вампир/Pact_Stage_2___Стадия_Пакта_2_1vk7E1pan7QCL34X.json";
const doc = JSON.parse(readFileSync(STAGE2, "utf8"));
const entries = doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const traitBy = id => entries.find(e => e.kind === "trait" && e.sourceUuid === `Compendium.warhammer-dbc.traits.Item.${id}`);

describe("Стадия Пакта 2 — Трейты боевой формы", () => {
  it("Deadly Natural Weapons (3): Когти и Укус, только пока форма включена", () => {
    const e = traitBy("izr4BASd4MVkw3Cm");
    expect(e).toBeTruthy();
    expect(Number(e.rating)).toBe(3);
    expect(e.integralChosen).toEqual(["MdAKKPWWE2aYVHza", "5lMWKz2czZv3rhxk"]);
    expect(e.when?.requireActivated).toBe(true);
  });
  it("Fear (1) и Flyer (A.b×2) — тоже по включению", () => {
    const fear = traitBy("ntYh2fH5Tv8GH4qA");
    const flyer = traitBy("6PG9FuSMS13O6Ou8");
    expect(Number(fear.rating)).toBe(1);
    expect(flyer.rating).toBe("ag*2");
    for (const e of [fear, flyer]) expect(e.when?.requireActivated).toBe(true);
  });
  it("id записей — ровно 16 символов [A-Za-z0-9] и не повторяются", () => {
    const ids = entries.map(e => e.id);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9]{16}$/);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("кнопка «Боевая форма» включает форму на Cor.b×10 минут (seconds), а не до конца боя", () => {
    const btn = entries.find(e => e.kind === "script" && /Боевая форма/.test(e.label));
    expect(btn.code).toMatch(/seconds:/);
    expect(btn.code).toMatch(/corruptionBonus/);
  });
});
