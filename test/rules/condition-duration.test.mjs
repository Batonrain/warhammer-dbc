// Срок Состояния штатной Duration эффекта (wdbc-uqco) — чистая арифметика:
// срок автора → объект duration, и обратно, сколько осталось. Заглушка Foundry
// не нужна и не должна понадобиться.

import { describe, it, expect } from "vitest";
import { SECONDS_PER_ROUND, DURATION_UNITS, durationLabel, durationDataFor,
         remainingSeconds, remainingCombatRounds, remainingRounds,
         isDurationExpired, remainingLabel } from "../../module/rules/condition-duration.mjs";

describe("durationLabel: русское согласование", () => {
  it("раунды", () => {
    expect(durationLabel(1, "rounds")).toBe("1 раунд");
    expect(durationLabel(2, "rounds")).toBe("2 раунда");
    expect(durationLabel(5, "rounds")).toBe("5 раундов");
    expect(durationLabel(11, "rounds")).toBe("11 раундов");
    expect(durationLabel(21, "rounds")).toBe("21 раунд");
  });

  it("минуты и часы", () => {
    expect(durationLabel(1, "minutes")).toBe("1 минута");
    expect(durationLabel(3, "minutes")).toBe("3 минуты");
    expect(durationLabel(1, "hours")).toBe("1 час");
    expect(durationLabel(12, "hours")).toBe("12 часов");
  });

  it("нет срока — пустая подпись, а не «0 раундов»", () => {
    expect(durationLabel(0, "rounds")).toBe("");
    expect(durationLabel(3, "")).toBe("");
    expect(durationLabel(3, "неизвестно")).toBe("");
  });
});

describe("durationDataFor: срок автора → duration эффекта", () => {
  it("раунды привязываются к бою, а не к worldTime", () => {
    const d = durationDataFor(2, "rounds", { round: 4, turn: 1, combatId: "c1", worldTime: 9000 });
    expect(d).toEqual({ rounds: 2, turns: null, combat: "c1", startRound: 4, startTurn: 1 });
    // Секунд у раундового срока нет намеренно: вне боя Раундов не существует,
    // и перевод в секунды сделал бы их «идущими» там, где боя нет.
    expect(d.seconds).toBeUndefined();
  });

  it("минуты и часы привязываются к worldTime", () => {
    expect(durationDataFor(1, "minutes", { worldTime: 100 })).toEqual({ seconds: 60, startTime: 100 });
    expect(durationDataFor(2, "hours", { worldTime: 0 })).toEqual({ seconds: 7200, startTime: 0 });
    expect(durationDataFor(1, "days", { worldTime: 5 })).toEqual({ seconds: 86400, startTime: 5 });
  });

  it("нет срока — null: Состояние висит до ручного снятия, как раньше", () => {
    expect(durationDataFor(2, "", {})).toBeNull();
    expect(durationDataFor(0, "rounds", {})).toBeNull();
    expect(durationDataFor("", "rounds", {})).toBeNull();
    expect(durationDataFor(2, "недели", {})).toBeNull();
  });

  it("все единицы списка UI разбираются (кроме «без срока»)", () => {
    for (const u of DURATION_UNITS.filter(x => x.key)) {
      expect(durationDataFor(1, u.key, { worldTime: 0, round: 0 })).not.toBeNull();
    }
  });
});

describe("остаток срока", () => {
  it("раунды считаются от Раунда наложения", () => {
    const d = durationDataFor(3, "rounds", { round: 4, combatId: "c1" });
    expect(remainingCombatRounds(d, { round: 4 })).toBe(3);
    expect(remainingCombatRounds(d, { round: 6 })).toBe(1);
    expect(remainingCombatRounds(d, { round: 7 })).toBe(0);
    expect(remainingCombatRounds(d, { round: 99 })).toBe(0);   // не уходит в минус
  });

  it("секунды считаются от worldTime наложения", () => {
    const d = durationDataFor(1, "minutes", { worldTime: 1000 });
    expect(remainingSeconds(d, { worldTime: 1000 })).toBe(60);
    expect(remainingSeconds(d, { worldTime: 1030 })).toBe(30);
    expect(remainingSeconds(d, { worldTime: 9999 })).toBe(0);
  });

  it("геттеры не путают два вида срока между собой", () => {
    const rounds = durationDataFor(3, "rounds", { round: 0 });
    const secs   = durationDataFor(1, "minutes", { worldTime: 0 });
    expect(remainingSeconds(rounds, {})).toBeNull();
    expect(remainingCombatRounds(secs, {})).toBeNull();
  });
});

describe("remainingRounds: то число, что видит игрок вместо прежнего счётчика", () => {
  it("раундовый срок отдаётся как есть", () => {
    const d = durationDataFor(2, "rounds", { round: 1 });
    expect(remainingRounds(d, { round: 2 })).toBe(1);
  });

  it("секунды переводятся ВВЕРХ — неполный Раунд ещё идёт, а не пропал", () => {
    const d = durationDataFor(1, "minutes", { worldTime: 0 });
    expect(remainingRounds(d, { worldTime: 0 })).toBe(60 / SECONDS_PER_ROUND);
    // 55 секунд осталось — это ещё целых 10 Раундов, а не 9
    expect(remainingRounds(d, { worldTime: 5 })).toBe(10);
    expect(remainingRounds(d, { worldTime: 59 })).toBe(1);
  });

  it("срока нет вовсе — null, а не 0", () => {
    expect(remainingRounds(null, {})).toBeNull();
    expect(remainingRounds({}, {})).toBeNull();
  });
});

describe("isDurationExpired", () => {
  it("бессрочное не истекает НИКОГДА — иначе подметание сняло бы всё разом", () => {
    expect(isDurationExpired(null, { round: 999, worldTime: 1e9 })).toBe(false);
    expect(isDurationExpired({}, { round: 999, worldTime: 1e9 })).toBe(false);
  });

  it("раундовый срок истекает ровно на своём Раунде, не раньше", () => {
    const d = durationDataFor(2, "rounds", { round: 3 });
    expect(isDurationExpired(d, { round: 4 })).toBe(false);
    expect(isDurationExpired(d, { round: 5 })).toBe(true);
  });

  it("срок в секундах истекает по worldTime", () => {
    const d = durationDataFor(1, "hours", { worldTime: 0 });
    expect(isDurationExpired(d, { worldTime: 3599 })).toBe(false);
    expect(isDurationExpired(d, { worldTime: 3600 })).toBe(true);
  });
});

describe("remainingLabel: остаток словами", () => {
  it("секунды показываются своими единицами, а не сотнями Раундов", () => {
    const hour = durationDataFor(1, "hours", { worldTime: 0 });
    expect(remainingLabel(hour, { worldTime: 0 })).toBe("1 час");
    expect(remainingLabel(hour, { worldTime: 3000 })).toBe("10 минут");
    expect(remainingLabel(hour, { worldTime: 3595 })).toBe("1 раунд");
  });

  it("раундовый срок — в раундах", () => {
    const d = durationDataFor(3, "rounds", { round: 0 });
    expect(remainingLabel(d, { round: 1 })).toBe("2 раунда");
  });

  it("бессрочное — пустая строка", () => {
    expect(remainingLabel(null, {})).toBe("");
  });
});
