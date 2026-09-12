// test/apps/imperial-calendar-watch-triggers.test.mjs
//
// wdbc-daz (п.4): checkCalendarWatchTriggers сравнивала текущий id деления с
// предыдущим по каждому ВКЛЮЧЁННОМУ пресету, но отличала «это первый прогон
// вообще» только одним общим флагом, а не «этот КОНКРЕТНЫЙ пресет отслежен
// впервые». ГМ включает второй пресет вахт уже посреди сессии (после первого
// вызова) — для него ещё нет своего prevId, но общий флаг isFirst уже false,
// и деление, в котором пресет застали, тут же стреляло триггером — как будто
// оно только что наступило. Реальная смена деления у уже отслеживаемого
// пресета должна стрелять по-прежнему.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { checkCalendarWatchTriggers } from "../../module/apps/imperial-calendar.mjs";

const CUST_A = { key: "custA", watches: [{ id: "a1", label: "A1", hours: 1 }, { id: "a2", label: "A2", hours: 1 }] };
const CUST_B = { key: "custB", watches: [{ id: "b1", label: "B1", hours: 1 }] };

function setImperialCalendarConfig(cfg) {
  const stored = cfg;
  const orig = game.settings.get;
  game.settings.get = (scope, key) => (scope === "warhammer-dbc" && key === "imperialCalendar") ? stored : orig(scope, key);
}

describe("checkCalendarWatchTriggers — новый пресет не стреляет триггером сразу", () => {
  beforeEach(() => {
    resetCaptured();
    game.users = { activeGM: { id: "gm-1" } };
    game.user = { id: "gm-1" };
  });

  it("реальная смена деления у отслеживаемого пресета стреляет; впервые увиденный пресет — нет", () => {
    setImperialCalendarConfig({
      enabledPresets: ["custA"],
      customPresets: [CUST_A],
      watchTriggers: {
        a1: { chatMessage: "custA: наступил A1" },
        a2: { chatMessage: "custA: наступил A2" },
        b1: { chatMessage: "custB: наступил B1" }
      }
    });

    // Первый вызов вообще — custA впервые на счету, деление a1 не должно
    // считаться «сменой».
    checkCalendarWatchTriggers(0);
    expect(captured.chat).toHaveLength(0);

    // Час спустя ГМ включает второй пресет custB (обычный сценарий — открыл
    // настройки календаря и добавил галку посреди сессии). custA реально
    // сменил деление (a1 → a2) — это ожидаемый триггер. custB видим здесь
    // впервые — его текущее деление (b1) не должно стрелять.
    setImperialCalendarConfig({
      enabledPresets: ["custA", "custB"],
      customPresets: [CUST_A, CUST_B],
      watchTriggers: {
        a1: { chatMessage: "custA: наступил A1" },
        a2: { chatMessage: "custA: наступил A2" },
        b1: { chatMessage: "custB: наступил B1" }
      }
    });
    checkCalendarWatchTriggers(3600);

    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("custA: наступил A2");

    // Ещё час спустя custA возвращается на a1 (реальная смена — должна
    // стрелять), а custB остаётся на b1 (деление не менялось — стрелять не
    // должна, это не связано с багом, но проверяет что фикс не сломал
    // обычное сравнение).
    checkCalendarWatchTriggers(7200);

    expect(captured.chat).toHaveLength(2);
    expect(captured.chat[1].content).toContain("custA: наступил A1");
  });
});
