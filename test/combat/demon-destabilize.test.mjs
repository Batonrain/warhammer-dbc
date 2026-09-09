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
    expect(actor.getFlag("warhammer-dbc", DESTABILIZE_FLAG)).toEqual({ deadlineAt: 1060 });
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
    expect(actor.getFlag("warhammer-dbc", DESTABILIZE_FLAG)).toEqual({ deadlineAt: 1060 });
  });

  it("Хозяин верхом — срок отодвигается ровно на dt, карточки нет", async () => {
    const actor = fakeActor({ system: { masterUuid: "Actor.master" } });
    globalThis.game.actors = [{ uuid: "Actor.master", system: { mount: { uuid: "Actor.demon" } } }];
    await startDestabilizeCountdown(actor, 1000, 60); // deadlineAt 1060
    await processDestabilizeTick(actor, 1055, 10);    // 1055 < 1060, но ridden — +10 всё равно

    expect(actor.getFlag("warhammer-dbc", DESTABILIZE_FLAG)).toEqual({ deadlineAt: 1070 });
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
