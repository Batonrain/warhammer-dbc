// test/combat/demon-destabilize.test.mjs
//
// Foundry-обвязка дестабилизации формы демона (module/combat/demon-
// destabilize.mjs, wdbc-1rno) — тик по updateWorldTime: пауза, пока Хозяин
// верхом, иначе истечение срока даёт ГМу карточку с кнопкой удаления (само
// удаление НЕ автоматическое).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { beforeEach, describe, it, expect } from "vitest";
import { startDestabilizeCountdown, processDestabilizeTick, isRiddenByMaster, DESTABILIZE_FLAG }
  from "../../module/combat/demon-destabilize.mjs";

function fakeActor(over = {}) {
  const flags = {};
  return {
    uuid: "Actor.demon", name: "Джаггернаут",
    system: {},
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; },
    unsetFlag: async (_s, k) => { delete flags[k]; },
    ...over
  };
}

beforeEach(() => { resetCaptured(); globalThis.game.actors = []; });

describe("startDestabilizeCountdown", () => {
  it("ставит дедлайн = worldTime + durationSeconds", async () => {
    const actor = fakeActor();
    await startDestabilizeCountdown(actor, 1000, 60);
    expect(actor.getFlag("warhammer-dbc", DESTABILIZE_FLAG))
      .toEqual({ deadlineAt: 1060, combatId: null, deadlineRound: null });
  });

  it("durationSeconds:null (Неограниченно) — флаг не ставится/снимается", async () => {
    const actor = fakeActor();
    await startDestabilizeCountdown(actor, 1000, null);
    expect(actor.getFlag("warhammer-dbc", DESTABILIZE_FLAG)).toBeUndefined();
  });

  it("durationSeconds:null поверх уже стоящего срока — снимает его", async () => {
    const actor = fakeActor();
    await startDestabilizeCountdown(actor, 1000, 60);
    await startDestabilizeCountdown(actor, 1000, null);
    expect(actor.getFlag("warhammer-dbc", DESTABILIZE_FLAG)).toBeUndefined();
  });
});

describe("isRiddenByMaster", () => {
  it("Хозяин сидит верхом ИМЕННО на этом демоне — true", () => {
    const demon = fakeActor({ system: { masterUuid: "Actor.master" } });
    globalThis.game.actors = [{ uuid: "Actor.master", system: { mount: { uuid: "Actor.demon" } } }];
    expect(isRiddenByMaster(demon)).toBe(true);
  });

  it("Хозяин верхом на ДРУГОМ существе — false", () => {
    const demon = fakeActor({ system: { masterUuid: "Actor.master" } });
    globalThis.game.actors = [{ uuid: "Actor.master", system: { mount: { uuid: "Actor.other" } } }];
    expect(isRiddenByMaster(demon)).toBe(false);
  });

  it("нет masterUuid или Хозяин не найден — false", () => {
    expect(isRiddenByMaster(fakeActor({ system: {} }))).toBe(false);
    const demon = fakeActor({ system: { masterUuid: "Actor.gone" } });
    globalThis.game.actors = [];
    expect(isRiddenByMaster(demon)).toBe(false);
  });
});

describe("processDestabilizeTick", () => {
  it("нет флага — ничего не делает", async () => {
    await processDestabilizeTick(fakeActor(), 5000, 10);
    expect(captured.chat).toEqual([]);
  });

  it("срок ещё не вышел — ничего не делает", async () => {
    const actor = fakeActor();
    await startDestabilizeCountdown(actor, 1000, 60);
    await processDestabilizeTick(actor, 1030, 10); // 1030 < 1060
    expect(captured.chat).toEqual([]);
    expect(actor.getFlag("warhammer-dbc", DESTABILIZE_FLAG))
      .toEqual({ deadlineAt: 1060, combatId: null, deadlineRound: null });
  });

  it("Хозяин верхом — срок отодвигается ровно на dt, карточки нет", async () => {
    const actor = fakeActor({ system: { masterUuid: "Actor.master" } });
    globalThis.game.actors = [{ uuid: "Actor.master", system: { mount: { uuid: "Actor.demon" } } }];
    await startDestabilizeCountdown(actor, 1000, 60); // deadlineAt 1060
    await processDestabilizeTick(actor, 1055, 10);    // 1055 < 1060, но ridden — +10 всё равно

    expect(actor.getFlag("warhammer-dbc", DESTABILIZE_FLAG))
      .toEqual({ deadlineAt: 1070, combatId: null, deadlineRound: null });
    expect(captured.chat).toEqual([]);
  });

  it("срок вышел, не верхом — карточка ГМу с кнопкой удаления, флаг снят", async () => {
    const actor = fakeActor();
    await startDestabilizeCountdown(actor, 1000, 60);
    await processDestabilizeTick(actor, 1060, 5);

    expect(actor.getFlag("warhammer-dbc", DESTABILIZE_FLAG)).toBeUndefined();
    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("Джаггернаут");
    expect(captured.chat[0].content).toContain("wh-destabilize-delete-btn");
    expect(captured.chat[0].content).toContain("Actor.demon");
  });
});

// ── Второй, РАУНДНЫЙ срок (приём стопки #441-#462) ────────────────────────
//
// При Завесе ниже единицы книга меряет дестабилизацию Раундами, а боевые
// Раунды в этой системе игровое время не двигают: CONFIG.time.roundTime не
// задан, worldTime меняют только виджет «Летоисчисление» и авто-течение. По
// одному worldTime срок в бою не истекал вовсе — ровно та грабля, что уже
// чинилась у Ока Вызова (wdbc-6dk), и там же взят приём: писать ОБА срока.

describe("срок в Раундах (Завеса < 1) — истекает по Раунду того же боя", () => {
  const combat = (id, round) => ({ id, round });

  it("запуск в бою пишет и combatId, и deadlineRound", async () => {
    const actor = fakeActor();
    // 10 Раундов × 6 с = 60 с, Завеса 0 — ступень «Раунды».
    await startDestabilizeCountdown(actor, 1000, 60, { veilTotal: 0, combat: combat("c1", 3) });
    expect(actor.getFlag("warhammer-dbc", DESTABILIZE_FLAG))
      .toEqual({ deadlineAt: 1060, combatId: "c1", deadlineRound: 13 });
  });

  it("Завеса ≥ 1 (ступень Минуты и выше) — раундного срока нет, он там не нужен", async () => {
    const actor = fakeActor();
    await startDestabilizeCountdown(actor, 1000, 600, { veilTotal: 1, combat: combat("c1", 3) });
    expect(actor.getFlag("warhammer-dbc", DESTABILIZE_FLAG))
      .toEqual({ deadlineAt: 1600, combatId: null, deadlineRound: null });
  });

  it("вне боя — только срок по времени, как раньше", async () => {
    const actor = fakeActor();
    await startDestabilizeCountdown(actor, 1000, 60, { veilTotal: 0, combat: null });
    expect(actor.getFlag("warhammer-dbc", DESTABILIZE_FLAG))
      .toEqual({ deadlineAt: 1060, combatId: null, deadlineRound: null });
  });

  it("настал Раунд срока — карточка ГМу, хотя игровое время не сдвинулось ни на секунду", async () => {
    const actor = fakeActor();
    await startDestabilizeCountdown(actor, 1000, 60, { veilTotal: 0, combat: combat("c1", 3) });
    await processDestabilizeTick(actor, 1000, 0, combat("c1", 13));
    expect(captured.chat.at(-1).content).toContain("должен быть изгнан");
    expect(actor.getFlag("warhammer-dbc", DESTABILIZE_FLAG)).toBeUndefined();
  });

  it("Раунд ещё не настал — молчит", async () => {
    const actor = fakeActor();
    await startDestabilizeCountdown(actor, 1000, 60, { veilTotal: 0, combat: combat("c1", 3) });
    await processDestabilizeTick(actor, 1000, 0, combat("c1", 12));
    expect(captured.chat).toHaveLength(0);
    expect(actor.getFlag("warhammer-dbc", DESTABILIZE_FLAG)).toBeDefined();
  });

  it("ДРУГОЙ бой — раундный срок не считается (метка привязана к своему бою)", async () => {
    const actor = fakeActor();
    await startDestabilizeCountdown(actor, 1000, 60, { veilTotal: 0, combat: combat("c1", 3) });
    await processDestabilizeTick(actor, 1000, 0, combat("c2", 99));
    expect(captured.chat).toHaveLength(0);
  });

  it("пауза верхом не теряет раундный срок при сдвиге срока по времени", async () => {
    const actor = fakeActor({ system: { masterUuid: "Actor.master" } });
    globalThis.game.actors = [{ uuid: "Actor.master", system: { mount: { uuid: "Actor.demon" } } }];
    await startDestabilizeCountdown(actor, 1000, 60, { veilTotal: 0, combat: combat("c1", 3) });
    await processDestabilizeTick(actor, 1010, 10, combat("c1", 4));
    expect(actor.getFlag("warhammer-dbc", DESTABILIZE_FLAG))
      .toEqual({ deadlineAt: 1070, combatId: "c1", deadlineRound: 13 });
  });
});
