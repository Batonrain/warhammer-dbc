// test/combat/attack-hidden-attack-no-evasion.test.mjs
//
// Стр. 12, wdbc-x1nz.2.29: «Избегание невозможно от атаки, о которой цель не
// знает, например со спины, из засады, или невидимым и неслышным снарядом.»
// Атакующий объявляет это галочкой «Скрытая атака» в окне (attack/mods.mjs,
// #atk-mod-hidden) — книга не даёт теста на автоопределение, тот же честный
// путь, что у «Застал Врасплох» (combat/devourer-of-time.mjs). Раньше галочка
// только добавляла +30 к попаданию и никак не трогала Уклонение/Парирование
// цели — теперь дополнительно гасит их вовсе (dodgeMod/parryMod ≤ -900, тот
// же порог, что attack-card.mjs читает как cannotDodge/cannotParry).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Скрытая атака: Уклонение/Парирование цели становятся недоступны", () => {
  it("без галочки — Уклонение доступно как обычно", async () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).toContain("wh-dodge-btn\"");
    expect(card()).not.toContain("Уклонение (невозможно)");
  });

  it("с галочкой hiddenAttack — Уклонение и Парирование недоступны", async () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { hiddenAttack: true });
    expect(card()).toContain("Уклонение (невозможно)");
    expect(card()).toContain("Парирование (невозможно");
  });

  it("рукопашная скрытая атака — тоже гасит Парирование", async () => {
    const weapon = weaponFor({ weaponClass: "melee", weaponType: "chain", damage: "1d10+2", damageType: "R" });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "ws", 45, "single", null, { hiddenAttack: true });
    expect(card()).toContain("Уклонение (невозможно)");
    expect(card()).toContain("Парирование (невозможно");
  });
});
