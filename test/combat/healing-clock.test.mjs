// test/combat/healing-clock.test.mjs
//
// Естественное лечение по Календарю (wdbc-x1nz.2.104): таблица режимов книги
// (rules/healing-clock.mjs) и обработчик часов (combat/healing-clock.mjs).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import {
  regimenHeal, astartesRegimen, healPeriodSeconds, effectiveHealKey, isWounded
} from "../../module/rules/healing-clock.mjs";
import { healingClock } from "../../module/combat/healing-clock.mjs";
import { CONDITION_CLOCK_HANDLERS } from "../../module/combat/condition-clock.mjs";

const DAY = 86400;
const HOUR = 3600;

function makeActor({ value = 5, max = 10, critical = 0, tb = 4, regimen = "active", nextAt = 0, caregiver = "", careOk = false } = {}) {
  const a = {
    name: "Раненый", uuid: "Actor.patient", items: [], flags: {}, hasPlayerOwner: true,
    system: {
      wounds: { value, max, critical },
      healing: { regimen, caregiver, nextAt, careOk },
      characteristics: { t: { bonus: tb, total: tb * 10 } },
      conditions: {}, skills: {}
    },
    getFlag: () => undefined,
    update: async data => {
      for (const [path, v] of Object.entries(data)) {
        const parts = path.split(".");
        let node = a;
        for (const p of parts.slice(0, -1)) node = (node[p] ??= {});
        node[parts.at(-1)] = v;
      }
    }
  };
  return a;
}

beforeEach(() => {
  resetCaptured();
  game.combat = null;
  globalThis.fromUuidSync = () => null;
});

describe("таблица режимов (книга, «Лечение»)", () => {
  it("Пассивное: лёгкое 1, тяжёлое — тест T, критическое — нет", () => {
    expect(regimenHeal("active", "light", 4)).toEqual({ amount: 1, needT: false });
    expect(regimenHeal("active", "heavy", 4)).toEqual({ amount: 0, needT: true });
    expect(regimenHeal("active", "critical", 4)).toEqual({ amount: 0, needT: false });
  });
  it("Отдых: ½T.b (вниз), 1, тест T", () => {
    expect(regimenHeal("rest", "light", 5)).toEqual({ amount: 2, needT: false });
    expect(regimenHeal("rest", "heavy", 5)).toEqual({ amount: 1, needT: false });
    expect(regimenHeal("rest", "critical", 5)).toEqual({ amount: 0, needT: true });
  });
  it("Постельный: T.b, ½T.b (окр.▲), 1", () => {
    expect(regimenHeal("bedRest", "light", 5)).toEqual({ amount: 5, needT: false });
    expect(regimenHeal("bedRest", "heavy", 5)).toEqual({ amount: 3, needT: false });
    expect(regimenHeal("bedRest", "critical", 5)).toEqual({ amount: 1, needT: false });
  });
  it("Астартес: занят делом — Отдых, отдыхает — Постельный, Постельный не ускоряет", () => {
    expect(astartesRegimen("active", true)).toBe("rest");
    expect(astartesRegimen("rest", true)).toBe("bedRest");
    expect(astartesRegimen("bedRest", true)).toBe("bedRest");
    expect(astartesRegimen("active", false)).toBe("active");
  });
  it("уход: 8 ч лёгкому/тяжёлому; критическому — как тяжёлый, но сутки", () => {
    expect(healPeriodSeconds("light", true)).toBe(8 * HOUR);
    expect(healPeriodSeconds("critical", true)).toBe(DAY);
    expect(healPeriodSeconds("heavy", false)).toBe(DAY);
    expect(effectiveHealKey("critical", true)).toBe("heavy");
    expect(effectiveHealKey("light", true)).toBe("light");
  });
  it("ранен — потеряны Раны или они в минусе", () => {
    expect(isWounded({ value: 10, max: 10, critical: 0 })).toBe(false);
    expect(isWounded({ value: 9, max: 10, critical: 0 })).toBe(true);
    expect(isWounded({ value: 5, max: 10, effectiveMax: 5, critical: 0 })).toBe(false);
  });
});

describe("часы лечения", () => {
  it("в списке часов Состояний", () => {
    expect(CONDITION_CLOCK_HANDLERS.map(h => h.id)).toContain("healing");
  });

  it("первый проход по раненому — период начинается, лечения ещё нет", async () => {
    const a = makeActor();
    await healingClock(a, { from: 1000, to: 1000 + HOUR });
    expect(a.system.healing.nextAt).toBe(1000 + DAY);
    expect(a.system.wounds.value).toBe(5);
    expect(captured.chat).toHaveLength(0);
  });

  it("сутки прошли — Пассивное лечит 1 Рану лёгкому, период сдвигается", async () => {
    const a = makeActor({ value: 7, nextAt: DAY }); // потеряно 3 ≤ T.b×2
    await healingClock(a, { from: DAY - 10, to: DAY + 10 });
    expect(a.system.wounds.value).toBe(8);
    expect(a.system.healing.nextAt).toBe(2 * DAY);
    expect(captured.chat[0].content).toContain("Пассивное лечение");
  });

  it("прыжок на трое суток Постельного — три периода одной карточкой", async () => {
    const a = makeActor({ value: 1, max: 20, tb: 4, regimen: "bedRest", nextAt: DAY });
    await healingClock(a, { from: 0, to: 3 * DAY });
    // потеряно 19 > 8 — тяжёлое: ½T.b = 2 за сутки, три периода → 1+2×3 = 7 (всё время тяжёлое)
    expect(a.system.wounds.value).toBe(7);
    expect(captured.chat).toHaveLength(1);
  });

  it("вылечился — счёт периодов гаснет", async () => {
    const a = makeActor({ value: 9, max: 10, regimen: "bedRest", nextAt: DAY });
    await healingClock(a, { from: 0, to: 5 * DAY });
    expect(a.system.wounds.value).toBe(10);
    expect(a.system.healing.nextAt).toBe(0);
  });

  it("в начатом бою Отдых засчитывается как Пассивное", async () => {
    const a = makeActor({ value: 7, regimen: "bedRest", nextAt: DAY });
    game.combat = { started: true, combatants: [{ actor: a }] };
    await healingClock(a, { from: 0, to: DAY });
    expect(a.system.wounds.value).toBe(8); // Пассивное 1, а не T.b 4
  });

  it("медик на уходе: успех Medicae — следующий период 8 ч", async () => {
    const medic = { documentName: "Actor", name: "Апотекарий", items: [], system: { skills: { medicae: { total: 60 } } }, getFlag: () => undefined };
    globalThis.fromUuidSync = () => medic;
    const a = makeActor({ value: 7, nextAt: DAY, caregiver: "Actor.medic" });
    captured.nextRoll = 10;
    await healingClock(a, { from: 0, to: DAY });
    expect(a.system.wounds.value).toBe(8);
    expect(a.system.healing.careOk).toBe(true);
    expect(a.system.healing.nextAt).toBe(DAY + 8 * HOUR);
  });
});
