// test/combat/plasma-captions.test.mjs
//
// Sahara task-e6d5 (dbc-75): подписи Максимального режима плазмы и Перегрева
// в карточке атаки, устаревшие по нынешним правилам:
//  1. Мастерство Плазмы: радиус Взрыва выбирается галочкой окна атаки
//     (opts.plasmaBlast → rules/maximal-mode.mjs), а карточка велела
//     «на выбор стрелка, вручную»;
//  2. Надёжное на оружии с Перегревом (Фазированная Плазменная Фузея,
//     Плазменный Бластер): по порогу оружие не клинит, а бьёт по стрелку
//     (combat/overheats.mjs) — подпись «заклинивает на N+» врала;
//  3. Эксперт Плазмы: «Перегрев не понижает её» — по нынешнему правилу
//     Перегрев не только −1 Надёжность, но и урон по стрелку вместо Клина;
//     Талант делает Перегрев реже, а не отменяет его.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { buildPropertyChatBlock, resolveWeaponPropsList } from "../../module/combat/weapon-properties.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const talentByName = name => ({ id: "t-" + name, name, type: "talent", system: {} });
const fighter = items =>
  actorFor({ items, characteristics: { ws: char(45), bs: char(45), s: char(30), t: char(40), ag: char(35) } });

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Мастерство Плазмы: карточка не велит выбирать радиус вручную", () => {
  it("радиус выбирается галочкой окна — в карточке нет «вручную»", async () => {
    const weapon = weaponFor({ weaponType: "plasma", damage: "1d10", penetration: 4,
      weaponProps: [{ key: "maximal" }, { key: "blast", rating: 3 }] });
    const actor = fighter([weapon, talentByName("Plasma Mastery / Мастерство Плазмы")]);
    captured.dice = [23, 5, 4];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { maximal: true, plasmaBlast: true });
    const html = card();
    expect(html).toContain("Мастерство Плазмы");
    expect(html).not.toContain("вручную");
  });
});

describe("Надёжное + Перегрев: подпись порога говорит о Перегреве, не о Клине", () => {
  const props = resolveWeaponPropsList([{ key: "reliable" }, { key: "overheats" }]);

  it("порог 96+ — «Перегрев на 96+»", () => {
    const html = buildPropertyChatBlock(props, { jamAt: 96 });
    expect(html).toContain("Надёжное: Перегрев на 96+");
    expect(html).not.toContain("заклинивает");
  });

  it("порог 100 и без порога — «Перегрев только на 100»", () => {
    expect(buildPropertyChatBlock(props, { jamAt: 100 })).toContain("Надёжное: Перегрев только на 100");
    expect(buildPropertyChatBlock(props)).toContain("Надёжное: Перегрев только на 100");
  });

  it("порога нет вовсе — «не перегревается»", () => {
    expect(buildPropertyChatBlock(props, { jamAt: null })).toContain("Надёжное: не перегревается");
  });

  it("Надёжное без Перегрева — прежняя подпись о Клине", () => {
    const plain = resolveWeaponPropsList([{ key: "reliable" }]);
    expect(buildPropertyChatBlock(plain, { jamAt: 96 })).toContain("Надёжное: заклинивает на 96+");
  });
});

describe("Эксперт Плазмы: подпись не обещает, что Перегрева нет", () => {
  it("карточка говорит о сдвиге порога Перегрева, а не «Перегрев не понижает её»", async () => {
    const weapon = weaponFor({ weaponType: "plasma", damage: "1d10", weaponProps: [{ key: "overheats" }] });
    const actor = fighter([weapon, talentByName("Plasma Expertise / Эксперт Плазмы")]);
    captured.dice = [23, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    const html = card();
    expect(html).toContain("Эксперт Плазмы");
    expect(html).not.toContain("Перегрев не понижает");
    expect(html).toContain("Перегрев с 96+");
  });
});
