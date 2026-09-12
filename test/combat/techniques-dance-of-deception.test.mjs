// test/combat/techniques-dance-of-deception.test.mjs
//
// Dance of Deception / Танец Обмана (wdbc-1rno, Слаанеш): у Финта — доп.
// варианты Acrobatics(A)+0/Trade(Танцор)+20 вместо WS+0, и галочка «потратить
// Очко Бесчестия — Финт свободным действием». Только для техники «Финт»,
// только с Даром.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { actorFor } from "../support/combat-fixtures.mjs";
import { _showContestDialog } from "../../module/combat/techniques.mjs";
import { MELEE_CONTESTS } from "../../module/constants/combat.mjs";

// Заглушка foundry.utils.getProperty в стенде всегда отдаёт undefined —
// свободное действие Танца Обмана читает через неё текущий пул Бесчестия
// (foundry.utils.getProperty(actor, poolPath)), нужна настоящая реализация
// по пути через точку (тот же приём, что test/apps/infamy-points-gods.test.mjs).
foundry.utils.getProperty = (object, key) =>
  String(key).split(".").reduce((o, k) => o?.[k], object);

beforeEach(() => resetCaptured());

const giftItem = { type: "mutation", name: "Dance of Deception / Танец Обмана", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: "gift.slaanesh.danceOfDeception", label: "" }
  ] }] } } };

function danceActor(over = {}) {
  const a = actorFor({
    items: [giftItem],
    skills: { acrobatics: { total: 25 } },
    groupSkills: { trade: [{ specialty: "Танцор", specKey: "dancer", total: 50 }] },
    fate: { value: 3 },
    ...over
  });
  a.updates = [];
  a.update = async data => { a.updates.push(data); return data; };
  return a;
}

describe("_showContestDialog — Dance of Deception, разметка", () => {
  it("Финт с Даром — варианты Acrobatics и Trade(Танцор) в списке, галочка свободного действия есть", async () => {
    const actor = danceActor();
    await _showContestDialog(actor, MELEE_CONTESTS.feint);
    const html = captured.dialog.content;
    expect(html).toContain("dance:acrobatics");
    expect(html).toContain("Acrobatics(A)+0 (25)");
    expect(html).toContain("dance:trade:0");
    expect(html).toContain("Trade (Танцор)+20 (70)"); // 50 + 20
    expect(html).toContain("dance-free-action");
    expect(html).toContain("Танец Обмана");
  });

  it("без Trade(Танцор) на листе — только Acrobatics в списке", async () => {
    const actor = danceActor({ groupSkills: { trade: [] } });
    await _showContestDialog(actor, MELEE_CONTESTS.feint);
    expect(captured.dialog.content).not.toContain("dance:trade:");
  });

  it("без Дара — ни вариантов, ни галочки, даже у Финта", async () => {
    const actor = actorFor({ skills: { acrobatics: { total: 25 } } });
    await _showContestDialog(actor, MELEE_CONTESTS.feint);
    const html = captured.dialog.content;
    expect(html).not.toContain("dance:acrobatics");
    expect(html).not.toContain("dance-free-action");
  });

  it("Давление/Повалить — не Финт, книга не даёт им замену, варианты не показываются даже с Даром", async () => {
    const actor = danceActor();
    await _showContestDialog(actor, MELEE_CONTESTS.press);
    expect(captured.dialog.content).not.toContain("dance:acrobatics");
    await _showContestDialog(actor, MELEE_CONTESTS.knockdown);
    expect(captured.dialog.content).not.toContain("dance:acrobatics");
  });
});

describe("_showContestDialog — Dance of Deception, бросок с выбранным Навыком", () => {
  it("выбор Acrobatics — Порог считается от него, не от WS", async () => {
    const actor = danceActor();
    await _showContestDialog(actor, MELEE_CONTESTS.feint);
    await captured.dialog.buttons.roll.callback(
      fakeHtml({ "#contest-char": "dance:acrobatics", "#contest-self": "25", "#contest-mod": "0" }));
    expect(captured.chat.at(-1).content).toContain("Acrobatics(A)+0");
  });
});

describe("_showContestDialog — Dance of Deception, свободное действие за Очко Бесчестия", () => {
  it("галочка отмечена, Бесчестие есть — списывает 1 Очко, карточка подтверждает бесплатное действие", async () => {
    const actor = danceActor({ fate: { value: 3 } });
    await _showContestDialog(actor, MELEE_CONTESTS.feint);
    await captured.dialog.buttons.roll.callback(fakeHtml({
      "#contest-char": "ws", "#contest-self": "45", "#contest-mod": "0", "#dance-free-action": true
    }));
    expect(actor.updates).toContainEqual({ "system.fate.value": 2 });
    expect(captured.chat.at(-1).content).toContain("Танец Обмана: потрачено 1 Очко Бесчестия");
  });

  it("галочка не отмечена — Бесчестие не трогается", async () => {
    const actor = danceActor({ fate: { value: 3 } });
    await _showContestDialog(actor, MELEE_CONTESTS.feint);
    await captured.dialog.buttons.roll.callback(fakeHtml({
      "#contest-char": "ws", "#contest-self": "45", "#contest-mod": "0"
    }));
    expect(actor.updates).toEqual([]);
  });

  it("галочка отмечена, но Бесчестия нет — предупреждает, ничего не списывает", async () => {
    const actor = danceActor({ fate: { value: 0 } });
    await _showContestDialog(actor, MELEE_CONTESTS.feint);
    await captured.dialog.buttons.roll.callback(fakeHtml({
      "#contest-char": "ws", "#contest-self": "45", "#contest-mod": "0", "#dance-free-action": true
    }));
    expect(actor.updates).toEqual([]);
    expect(captured.warnings.some(w => w.includes("нет Очков Бесчестия"))).toBe(true);
  });

  it("без Дара — галочки в разметке нет, ничего списать нельзя", async () => {
    const actor = actorFor({ fate: { value: 3 } });
    actor.updates = [];
    actor.update = async d => { actor.updates.push(d); };
    await _showContestDialog(actor, MELEE_CONTESTS.feint);
    expect(captured.dialog.content).not.toContain("dance-free-action");
  });
});
