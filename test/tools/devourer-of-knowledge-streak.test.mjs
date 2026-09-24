// test/tools/devourer-of-knowledge-streak.test.mjs
//
// wdbc-63fe, сквозной прогон НАСТОЯЩЕГО скрипта Пожирателя Знаний из
// packs-src: девять суток подряд, каждый раз «Календарь» переводится на
// полные сутки, и тик истечения (hooks.mjs, блок DEVOURER_THEFTS_FLAG)
// стирает вчерашнюю кражу и возвращает Ступени — как в живом мире. Раньше
// серия жила в записи кражи и сбрасывалась в 1 именно на этом тике.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { runMechScriptEntry } from "../../module/apps/mechanics.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { DAY, DEVOURER_THEFTS_FLAG, DEVOURER_PERMANENT_FLAG } from "../../module/rules/devourer-of-knowledge.mjs";

const doc = packDocById("packs-src/mutations/Дары_Богов/Тзинч", "Zg1gf5tW3hvw3HVW");

function scriptEntry() {
  for (const group of doc.flags["warhammer-dbc"].mechanics) {
    const entry = group.entries.find(e => e.kind === "script");
    if (entry) return { groupId: group.id, entry };
  }
  throw new Error("нет записи-скрипта");
}

function actorOf(name, uuid, skills) {
  const a = { name, uuid, type: "character", system: { skills } };
  const flags = {};
  a.getFlag = (scope, key) => flags[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { flags[`${scope}.${key}`] = value; return value; };
  a.update = async changes => {
    for (const [p, v] of Object.entries(changes)) {
      const keys = p.split(".");
      let node = a;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = v;
    }
  };
  return a;
}

const itemFor = actor => {
  const store = { "warhammer-dbc.mechanics": doc.flags["warhammer-dbc"].mechanics };
  return { name: doc.name, actor, getFlag: (s, k) => store[`${s}.${k}`], setFlag: async (s, k, v) => { store[`${s}.${k}`] = v; } };
};

afterEach(() => { resetCaptured(); delete globalThis.game.time; });

describe("Пожиратель Знаний: 9 дней подряд при обычном ходе Календаря (wdbc-63fe)", () => {
  it("девятый день подряд делает кражу навсегда, хотя каждую ночь кража истекала", async () => {
    const bearer = actorOf("Чемпион", "Actor.bearer", { awareness: { rank: "untrained" } });
    const victim = actorOf("Жертва", "Actor.victim", { awareness: { rank: "trained" } });
    globalThis.game.user.targets = new Set([{ actor: victim }]);
    const { groupId, entry } = scriptEntry();

    for (let day = 0; day < 9; day++) {
      globalThis.game.time = { worldTime: 1000 * DAY + day * DAY + 3600 };
      await runMechScriptEntry(itemFor(bearer), groupId, entry.id);
      await captured.dialog.buttons.go.callback({ find: () => ({ val: () => "awareness" }) });
      if (day < 8) {
        // Тик истечения: вчерашняя кража снята, Ступени обеих сторон вернулись.
        expect(bearer.getFlag("warhammer-dbc", DEVOURER_THEFTS_FLAG)).toHaveLength(1);
        await bearer.setFlag("warhammer-dbc", DEVOURER_THEFTS_FLAG, []);
        victim.system.skills.awareness.rank = "trained";
        bearer.system.skills.awareness.rank = "untrained";
      }
    }

    expect(bearer.getFlag("warhammer-dbc", DEVOURER_PERMANENT_FLAG)).toEqual(["awareness"]);
    expect(victim.system.skills.awareness.rank).toBe("untrained");
    expect(bearer.system.skills.awareness.rank).toBe("trained");
    expect(captured.chat.at(-1).content).toContain("9 дней подряд");
  });
});
