import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import {
  activateNavigatorPower,
  activatePsychicListeners,
  executePsychotest,
  resolvePsyCastAttr,
  rollPsyWpTest,
  rollPsyniscience,
  showManifestDialog
} from "../../module/sheets/tabs/psychic.mjs";

function item({ name = "Взор Варпа", type = "psychicPower", system = {} } = {}) {
  const it = {
    id: `${type}-1`,
    name,
    type,
    system,
    updates: [],
    update: async data => {
      it.updates.push(data);
      return data;
    }
  };
  return it;
}

function actor({ race = "human", items = [], fatigue = 0, system = {} } = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const a = {
    id: "actor-1",
    name: "Псайкер",
    items: list,
    updates: [],
    system: {
      race,
      fatigue: { value: fatigue },
      psyker: { rating: 3, currentRating: 3, sustain: 0, class: "bound" },
      skills: { psyniscience: { total: 52 } },
      corruption: { value: 12 },
      corruptionBonus: 1,
      wounds: { value: 8, max: 10, critical: 0 },
      characteristics: {
        wp: { total: 40, value: 40, bonus: 4 },
        per: { total: 35, value: 35, bonus: 3 },
        t: { total: 42, value: 42, bonus: 4 },
        s: { total: 30, value: 30, bonus: 3 }
      },
      ...system
    },
    update: async data => {
      a.updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let target = a;
        for (const part of parts.slice(0, -1)) {
          target[part] ??= {};
          target = target[part];
        }
        target[parts.at(-1)] = value;
      }
      return data;
    },
    updateEmbeddedDocuments: async (type, docs) => {
      a.updatedEmbedded = { type, docs };
      return docs;
    }
  };
  return a;
}

beforeEach(resetCaptured);

describe("psychic cast attribute resolver", () => {
  it("divination без явной характеристики кастуется через Псинауку", () => {
    expect(resolvePsyCastAttr(actor(), { discipline: "divination" })).toEqual({
      key: "psyniscience",
      val: 52,
      abbr: "Псинаука"
    });
  });

  it("явная Псинаука использует навык", () => {
    expect(resolvePsyCastAttr(actor(), { testChar: "psyniscience" }).val).toBe(52);
  });

  it("cor использует значение Порчи", () => {
    expect(resolvePsyCastAttr(actor(), { testChar: "cor" })).toEqual({
      key: "cor",
      val: 12,
      abbr: "Порча"
    });
  });

  it("обычная характеристика берёт total и аббревиатуру", () => {
    expect(resolvePsyCastAttr(actor(), { testChar: "wp" })).toMatchObject({
      key: "wp",
      val: 40,
      abbr: "WP"
    });
  });
});

describe("psychic manifestation", () => {
  it("showManifestDialog собирает диалог и сохраняет callback психотеста", () => {
    const a = actor({ system: { psyker: { rating: 2, currentRating: 0, sustain: 2, class: "bound" } } });

    showManifestDialog(a, item({ system: { discipline: "divination", powerType: "utility" } }));

    expect(captured.dialog.title).toBe("Манифестация: Взор Варпа");
    expect(captured.dialog.content).toContain("тPR = 0");
    expect(captured.dialog.content).toContain("Порог психотеста (Псинаука)");
    expect(captured.dialog.buttons.cast.label).toBe("Психотест!");
  });

  it("executePsychotest считает порог, бросает d100 и пишет карточку", async () => {
    const a = actor();
    const power = item({ system: { testChar: "wp", powerType: "utility", testMod: 5 } });
    captured.nextRoll = 30;

    await executePsychotest(a, power, {
      mPR: 2,
      prMod: 0,
      mode: "normal",
      path: "",
      modifier: 0,
      eldar: false,
      pushChoice: 1,
      damagePR: 0,
      rangePR: 0,
      profileIdx: -1,
      variantIdx: -1
    });

    expect(captured.rolls).toEqual(["1d100"]);
    expect(captured.chat[0].content).toContain("Порог: <b>55</b>");
    expect(captured.chat[0].content).toContain("Манифестация удалась");
  });

  it("callback диалога передаёт значения формы в психотест", async () => {
    const a = actor();
    showManifestDialog(a, item({ system: { testChar: "wp", powerType: "utility" } }));
    captured.nextRoll = 40;

    await captured.dialog.buttons.cast.callback(fakeHtml({
      "#psy-pr": "3",
      "#psy-pr-mod": "1",
      "#psy-mode": "normal",
      "#psy-path": "",
      "#psy-mod": "5",
      "#psy-push-bonus": "1",
      "#psy-pr-dmg": "0",
      "#psy-pr-range": "0",
      "#psy-profile": "-1",
      "#psy-variant": "-1"
    }));

    expect(captured.chat[0].content).toContain("mPR <b>3</b> +1 = <b>4</b>");
    expect(captured.chat[0].content).toContain("Порог: <b>65</b>");
  });
});

describe("psychic roll helpers", () => {
  it("rollPsyniscience делегирует общий бросок навыка", () => {
    const calls = [];

    rollPsyniscience(actor(), (...args) => calls.push(args));

    expect(calls[0]).toEqual(["Психонаука", 52, "per", { skill: "psyniscience" }]);
  });

  it("rollPsyWpTest пишет карточку W + PR×5", async () => {
    captured.nextRoll = 42;

    await rollPsyWpTest(actor(), "Пси-капюшон", "Заметка");

    expect(captured.rolls).toEqual(["1d100"]);
    expect(captured.chat[0].content).toContain("Порог: <b>55</b>");
    expect(captured.chat[0].content).toContain("Успех");
  });

  it("activateNavigatorPower применяет штраф усталости и не вызывает феномены", async () => {
    const a = actor({ fatigue: 1 });
    const power = item({
      name: "Третий глаз",
      type: "navigatorPower",
      system: { testChar: "per", testMod: 5, range: "30 м", effect: "Смещение" }
    });
    captured.nextRoll = 40;

    await activateNavigatorPower(a, power);

    expect(captured.chat[0].content).toContain("Порог: <b>30</b>");
    expect(captured.chat[0].content).toContain("Навигатор не бросает");
    expect(captured.chat[0].content).toContain("Провал");
  });
});

describe("psychic sheet listeners", () => {
  it("activatePsychicListeners привязывает кнопки Псайканы к actor-only API", () => {
    const handlers = {};
    const html = {
      find: selector => ({
        click: fn => { handlers[`${selector}:click`] = fn; },
        change: fn => { handlers[`${selector}:change`] = fn; }
      })
    };
    const calls = { rolls: [], soulBurn: [] };
    const a = actor();

    activatePsychicListeners(html, a, {
      rollSkill: (...args) => calls.rolls.push(args),
      resolveSoulBurn: id => calls.soulBurn.push(id)
    });

    handlers[".psy-sense-btn:click"]();
    handlers[".psy-soulburn-btn:click"]();
    handlers[".psy-rating-input:change"]({ currentTarget: { value: "4" } });

    expect(calls.rolls[0]).toEqual(["Психонаука", 52, "per", { skill: "psyniscience" }]);
    expect(calls.soulBurn).toEqual(["actor-1"]);
    expect(a.updates.at(-1)).toEqual({ "system.psyker.rating": 4 });
  });
});
