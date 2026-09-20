// test/combat/attack-aoe-torso.test.mjs
//
// Стр. 34, wdbc-x1nz.2.48: «Атаки по площади всегда попадают в торс.»
// Взрывное (Blast) и Распыление (Spray, отдельный тест — spray-auto-hit)
// перезаписывают обычную реверс-таблицу места попадания; у техники своей
// «части тела» нет — ближайший аналог «центра масс» это Корпус.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Взрывное (Blast): место попадания всегда Торс (wdbc-x1nz.2.48)", () => {
  it("бросок реверсится не в Торс (17→71 «П. Нога»), но карточка печатает Торс", async () => {
    const weapon = weaponFor({ weaponProps: [{ key: "blast", rating: 3 }] });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [17, 6];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("Место попадания: <b>Торс</b>");
    expect(card()).not.toContain("П. Нога");
  });

  it("без Взрывного тот же бросок 17 даёт обычную реверс-локацию", async () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [17, 6];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("П. Нога");
    expect(card()).not.toContain("Место попадания: <b>Торс</b>");
  });

  it("цель — техника: Взрывное попадает в Корпус, а не в часть машины по таблице", async () => {
    const weapon = weaponFor({ weaponProps: [{ key: "blast", rating: 3 }] });
    const actor  = actorFor({ items: [weapon] });
    setTargets([{ type: "vehicle" }]);
    captured.dice = [17, 6];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("Место попадания: <b>Корпус</b>");
  });

  it("Взрывное, прицел «Под цель» (underfoot) — тоже Торс, не место прицела", async () => {
    const weapon = weaponFor({ weaponProps: [{ key: "blast", rating: 3 }] });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [17, 6];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", { value: "underfoot", label: "Под цель (Взрывное, −20)" }, {});

    expect(card()).toContain("Место попадания: <b>Торс</b>");
  });

  it("промах — правило не применяется вовсе (карточка не печатает место попадания)", async () => {
    // Reliable (стр. 41, wdbc-x1nz.2.61): без него обычное стрелковое клинит
    // уже на 96+, а тест здесь проверяет карточку обычного промаха.
    const weapon = weaponFor({ weaponProps: [{ key: "blast", rating: 3 }, { key: "reliable" }] });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [99, 6];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("Промах");
  });
});
