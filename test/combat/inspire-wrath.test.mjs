// test/combat/inspire-wrath.test.mjs
//
// Inspire Wrath / Вдохновить Гнев (Слаанеш, Sahara inspire-wrath-cannon-fodder,
// решение владельца 24.10.2026): кнопка на листе Таланта, Charm+0, лимит аудитории
// F.b×10 (×100 с Demagogue), временная Ненависть выцеленным слушателям до конца сцены.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor } from "../support/combat-fixtures.mjs";
import {
  startInspireWrath, grantInspiredHatred, audienceActors, endInspiredWrathOnSceneEnd
} from "../../module/combat/inspire-wrath.mjs";
import {
  inspireWrathAudience, hasInspireWrath, isInspiredHatred, inspiredHatredData, INSPIRED_WRATH_FLAG, isInspireWrathItem
} from "../../module/rules/inspire-wrath.mjs";
import { hatredTargetsOf } from "../../module/rules/predicates.mjs";
import { hatredRules } from "../../module/rules/hatred.mjs";
import { talentActionsHtml, runTalentAction } from "../../module/apps/talent-actions.mjs";
import { factionTarget, raceTarget } from "../../module/rules/talent-targets.mjs";

const NS = "warhammer-dbc";
const talentWithKey = (name, key) => ({
  id: name, name, type: "talent", system: {},
  flags: { [NS]: { mechanics: [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const INSPIRE = talentWithKey("ИСПОРЧЕННОЕ ИМЯ", "social.core.inspireWrath");
const DEMAGOGUE = { id: "d", name: "Demagogue / Демагог", type: "talent", system: {}, flags: {} };

function speaker({ felBonus = 4, items = [INSPIRE], charm = 40 } = {}) {
  const a = actorFor({ items, skills: { charm: { total: charm } } });
  a.system.characteristics.fel = { total: felBonus * 10, bonus: felBonus };
  a.name = "Оратор"; a.uuid = "Actor.speaker"; a.type = "character";
  return a;
}

/** Слушатель: пишет предметы в себя (isOwner — GM/владелец, без релея). */
function listener(name, uuid) {
  const created = [];
  const a = actorFor({ items: [] });
  a.name = name; a.uuid = uuid; a.type = "npc"; a.isOwner = true;
  a.createEmbeddedDocuments = async (type, docs) => {
    for (const d of docs) {
      const item = { ...d, id: `i${a.items.length}`, getFlag: (ns, k) => d.flags?.[ns]?.[k] };
      a.items.push(item); created.push(item);
    }
    return created;
  };
  a.deleteEmbeddedDocuments = async (type, ids) => {
    for (const id of ids) { const i = a.items.findIndex(x => x.id === id); if (i >= 0) a.items.splice(i, 1); }
  };
  a._created = created;
  return a;
}
const token = actor => ({ actor });
const XENOS = factionTarget({ key: "xenos", name: "Ксеносы" });

let prev;
beforeEach(() => {
  resetCaptured();
  prev = { user: globalThis.game.user, combat: globalThis.game.combat, actors: globalThis.game.actors };
  globalThis.game.user = { id: "u1", isGM: true, targets: new Set() };
  globalThis.game.combat = undefined;
  globalThis.game.actors = [];
  globalThis.fromUuid = async () => null;
});
afterEach(() => { Object.assign(globalThis.game, prev); });

describe("rules/inspire-wrath: лимит аудитории", () => {
  it("F.b×10, а с Demagogue F.b×100", () => {
    expect(inspireWrathAudience(speaker({ felBonus: 4 }))).toBe(40);
    expect(inspireWrathAudience(speaker({ felBonus: 4, items: [INSPIRE, DEMAGOGUE] }))).toBe(400);
    expect(inspireWrathAudience(speaker({ felBonus: 0 }))).toBe(0);
  });

  it("Талант опознаётся по ключу и по имени (предметы у игроков — снимки)", () => {
    expect(hasInspireWrath(speaker())).toBe(true);
    expect(isInspireWrathItem({ type: "talent", name: "Inspire Wrath / Вдохновить Гнев", flags: {} })).toBe(true);
    expect(hasInspireWrath(speaker({ items: [DEMAGOGUE] }))).toBe(false);
  });

  it("выданная Ненависть — отдельный Талант Hatred с одной целью, который читает rules/hatred.mjs", () => {
    const ORKS = raceTarget("ork", "Орки");
    const data = inspiredHatredData(ORKS, { uuid: "Actor.speaker", name: "Оратор" });
    expect(isInspiredHatred(data)).toBe(true);
    expect(data.flags[NS][INSPIRED_WRATH_FLAG]).toEqual({ sourceUuid: "Actor.speaker", sourceName: "Оратор" });
    // Слушатель с этим предметом получает правила Ненависти против группы:
    const l = { items: [data] };
    expect(hatredTargetsOf(l)).toEqual([ORKS]);
    expect(hatredRules(l, { targetActor: { system: { race: "ork" } } }).map(r => r.id)).toContain("hatred.meleeBonus");
    expect(hatredRules(l, { targetActor: { system: { race: "human" } } })).toEqual([]);
  });
});

describe("audienceActors", () => {
  it("уникальные акторы выцеленных токенов, без самого оратора", () => {
    const s = speaker(), a = listener("А", "Actor.a"), b = listener("Б", "Actor.b");
    const set = new Set([token(a), token(a), token(b), token(s)]);
    expect(audienceActors(s, set).map(x => x.name)).toEqual(["А", "Б"]);
  });
});

describe("grantInspiredHatred", () => {
  it("лимит аудитории режет список: лишние без Ненависти и в счётчике over", async () => {
    const s = speaker();
    const ls = [listener("А", "Actor.a"), listener("Б", "Actor.b"), listener("В", "Actor.c")];
    const res = await grantInspiredHatred(s, XENOS, ls, 2);
    expect(res.granted).toEqual(["А", "Б"]);
    expect(res.over).toBe(1);
    expect(ls[2]._created).toHaveLength(0);
    expect(ls[0]._created[0].name).toContain("Ксеносы");
  });

  it("слушатель, уже вдохновлённый этой же речью против этой группы, второй копии не получает", async () => {
    const s = speaker(), a = listener("А", "Actor.a");
    await grantInspiredHatred(s, XENOS, [a], 5);
    const again = await grantInspiredHatred(s, XENOS, [a], 5);
    expect(again.already).toEqual(["А"]);
    expect(a._created).toHaveLength(1);
    // другая группа — новая Ненависть
    await grantInspiredHatred(s, raceTarget("ork", "Орки"), [a], 5);
    expect(a._created).toHaveLength(2);
  });
});

describe("startInspireWrath", () => {
  it("без выцеленных слушателей ничего не происходит (ОД не тратятся)", async () => {
    expect(await startInspireWrath(speaker(), { target: XENOS, rv: 10 })).toBeNull();
    expect(captured.warnings.at(-1)).toContain("выцельте");
  });

  it("успех: карточка и Ненависть всем выцеленным", async () => {
    const s = speaker(), a = listener("А", "Actor.a"), b = listener("Б", "Actor.b");
    globalThis.game.user.targets = new Set([token(a), token(b)]);
    expect(await startInspireWrath(s, { target: XENOS, rv: 10 })).toBe("granted");
    expect(a._created).toHaveLength(1);
    expect(b._created).toHaveLength(1);
    expect(a._created[0].system.targets).toEqual([XENOS]);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Charm+0");
    expect(html).toContain("до конца сцены");
  });

  it("провал Charm+0: ничего не выдаётся", async () => {
    const s = speaker({ charm: 40 }), a = listener("А", "Actor.a");
    globalThis.game.user.targets = new Set([token(a)]);
    expect(await startInspireWrath(s, { target: XENOS, rv: 90 })).toBe("failed");
    expect(a._created).toHaveLength(0);
  });

  it("порог — Charm без поправок; граница 40 → успех, 41 → провал", async () => {
    const s = speaker({ charm: 40 }), a = listener("А", "Actor.a");
    globalThis.game.user.targets = new Set([token(a)]);
    expect(await startInspireWrath(s, { target: XENOS, rv: 40 })).toBe("granted");
    a._created.length = 0; a.items.length = 0;
    expect(await startInspireWrath(s, { target: XENOS, rv: 41 })).toBe("failed");
  });

  it("без Таланта не начинается", async () => {
    expect(await startInspireWrath(speaker({ items: [] }), { target: XENOS, rv: 1 })).toBeNull();
  });
});

describe("конец сцены", () => {
  it("снимает только временную Ненависть, своя Ненависть слушателя остаётся", async () => {
    const s = speaker(), a = listener("А", "Actor.a");
    a.items.push({ id: "own", type: "talent", name: "Hatred / Ненависть", system: { targets: [XENOS] }, flags: {} });
    await grantInspiredHatred(s, XENOS, [a], 5);
    expect(a.items).toHaveLength(2);
    globalThis.game.actors = [a];
    expect(await endInspiredWrathOnSceneEnd()).toBe(1);
    expect(a.items.map(i => i.id)).toEqual(["own"]);
  });
});

describe("кнопка на листе Таланта", () => {
  it("есть у Inspire Wrath на акторе, нет у прочих и вне актора", () => {
    expect(talentActionsHtml(INSPIRE, speaker())).toContain('data-talent-action="inspireWrath"');
    expect(talentActionsHtml(INSPIRE, null)).toBe("");
    expect(talentActionsHtml(DEMAGOGUE, speaker())).toBe("");
  });

  it("чужой предмет кнопку не запускает", async () => {
    expect(await runTalentAction("inspireWrath", DEMAGOGUE, speaker())).toBe(false);
  });
});
