// test/combat/walker-defence-buttons.test.mjs
//
// wdbc-6wzt, п.5: Парирование и Уклонение Шагохода должны быть ДОСТУПНЫ там,
// где ими пользуются, — кнопкой на карточке атаки по машине, рядом с Виражом.
// Без этого правило остаётся текстом в подсказке листа: функция есть, а нажать
// её игроку негде.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { defenseSection } from "../../module/combat/attack-card.mjs";

const wp = { flexible: false, blastRating: 0, spray: false };

const section = (over = {}) =>
  defenseSection({ dodgeMod: -10, parryMod: 0, ...over },
    { wp, attackerUuid: "Actor.attacker", hitsCount: 1, isMelee: true });

describe("кнопки защиты Шагохода на карточке атаки", () => {
  it("цель — Шагоход: есть и Вираж, и обе его собственные кнопки", () => {
    const html = section({ targetIsVehicle: true, targetIsWalker: true });
    expect(html).toContain("wh-swerve-btn");
    expect(html).toContain("wh-walker-parry-btn");
    expect(html).toContain("wh-walker-dodge-btn");
  });

  it("прочая техника Шагоходьих кнопок не получает — у неё только Вираж", () => {
    const html = section({ targetIsVehicle: true, targetIsWalker: false });
    expect(html).toContain("wh-swerve-btn");
    expect(html).not.toContain("wh-walker-parry-btn");
    expect(html).not.toContain("wh-walker-dodge-btn");
  });

  it("цель-персонаж этих кнопок не видит вовсе", () => {
    const html = section({ targetIsVehicle: false, targetIsWalker: false });
    expect(html).not.toContain("wh-swerve-btn");
    expect(html).not.toContain("wh-walker-parry-btn");
  });

  it("кнопки несут модификаторы приёма и uuid атакующего — иначе бросок уйдёт без них", () => {
    const html = section({ targetIsVehicle: true, targetIsWalker: true, dodgeMod: 30, parryMod: -20 });
    const parry = html.match(/<button class="wh-walker-parry-btn[^>]*>/)[0];
    const dodge = html.match(/<button class="wh-walker-dodge-btn[^>]*>/)[0];
    expect(parry).toContain('data-extra-mod="-20"');
    expect(parry).toContain('data-attacker-uuid="Actor.attacker"');
    expect(dodge).toContain('data-extra-mod="30"');
    expect(dodge).toContain('data-hits-count="1"');
  });

  it("Очередь: число попаданий доезжает до обеих кнопок (снимается по одному за степень)", () => {
    const html = defenseSection({ dodgeMod: 0, parryMod: 0, targetIsVehicle: true, targetIsWalker: true },
      { wp, attackerUuid: "Actor.a", hitsCount: 4, isMelee: false });
    expect(html.match(/<button class="wh-walker-dodge-btn[^>]*>/)[0]).toContain('data-hits-count="4"');
  });
});
