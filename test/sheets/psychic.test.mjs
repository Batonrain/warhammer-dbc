import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { setPsychicVessel } from "../../module/rules/psychic-vessel.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
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
  const flags = {};
  const a = {
    id: "actor-1",
    name: "Псайкер",
    items: list,
    updates: [],
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; },
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

  // wdbc-jpmh: Путь Силы («Инкантация»/«Медитация»/«Жертва»/«Телесная
  // Конверсия» — PSY_PATHS, module/constants/psyker.mjs) уже даёт реальные
  // эффекты при выборе (ePR/phenMod/testMod и т.п. в самом расчёте) — не
  // хватало только видимости условия доступа (req) в самом списке.
  it("выпадающий список Путей Силы несёт требование доступа в title, помечает звёздочкой", () => {
    const a = actor({ system: { psyker: { rating: 2, currentRating: 0, sustain: 2, class: "bound" } } });

    showManifestDialog(a, item({ system: { discipline: "divination", powerType: "utility" } }));

    expect(captured.dialog.content).toContain('value="incantation" title="Талант Blasphemous Incantation">Инкантация *');
    expect(captured.dialog.content).toContain('value="meditation" title="Талант Meditation">Медитация *');
    // «— Без Пути —» — единственный пункт без req: без звёздочки и без title.
    expect(captured.dialog.content).toContain('<option value="">— Без Пути —</option>');
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

  // Путь «Псайбер-Фамильяр» (rules/psychic-vessel.mjs, wdbc-q30d): раньше
  // заметка была всегда одним и тем же текстом-напоминанием, теперь называет
  // текущего носителя по имени, если он назначен (Spirit Talk на время
  // захвата или связанный фамильяр).
  it("Путь «Псайбер-Фамильяр»: назначенный носитель называется по имени в заметке", async () => {
    const a = actor();
    await setPsychicVessel(a, { uuid: "Actor.v1", name: "Захваченный Призрачный Страж" });
    const power = item({ system: { testChar: "wp", powerType: "utility" } });
    captured.nextRoll = 30;

    await executePsychotest(a, power, {
      mPR: 1, prMod: 0, mode: "normal", path: "familiar", modifier: 0, eldar: false,
      pushChoice: 1, damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1
    });

    expect(captured.chat[0].content).toContain("Захваченный Призрачный Страж");
  });

  it("Путь «Псайбер-Фамильяр» без назначенного носителя — общая заметка без имени", async () => {
    const a = actor();
    const power = item({ system: { testChar: "wp", powerType: "utility" } });
    captured.nextRoll = 30;

    await executePsychotest(a, power, {
      mPR: 1, prMod: 0, mode: "normal", path: "familiar", modifier: 0, eldar: false,
      pushChoice: 1, damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1
    });

    expect(captured.chat[0].content).toContain("Дальность считается от фамильяра");
  });

  it("другой Путь (не familiar) — носитель в заметку не подмешивается", async () => {
    const a = actor();
    await setPsychicVessel(a, { uuid: "Actor.v1", name: "Захваченный Страж" });
    const power = item({ system: { testChar: "wp", powerType: "utility" } });
    captured.nextRoll = 30;

    await executePsychotest(a, power, {
      mPR: 1, prMod: 0, mode: "normal", path: "", modifier: 0, eldar: false,
      pushChoice: 1, damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1
    });

    expect(captured.chat[0].content).not.toContain("Захваченный Страж");
  });

  // Раньше урон психосилы бросался в обход движка свойств оружия: Рвущее не
  // добавляло куб, а Экстремальный урон не проверялся вовсе. Теперь атака
  // психосилы идёт через тот же rollExtremeDamage/applyDamageDiceMods, что и
  // обычное оружие (module/combat/attack.mjs).
  it("урон атакующей психосилы подхватывает Рвущее и Экстремальный урон, как у оружия", async () => {
    const a = actor();
    const power = item({ system: {
      testChar: "wp", powerType: "attack", testMod: 0,
      damage: "1d10+2", damageType: "energy",
      weaponProps: [{ key: "tearing", rating: 0, rating2: 0 }]
    } });
    // Очередь кубов: психотест (успех), затем 2 куба Рвущего (10 держим, 3 сбрасываем),
    // затем 1d5 Экстремального урона.
    captured.dice = [5, 10, 3, 4];

    await executePsychotest(a, power, {
      mPR: 1, prMod: 0, mode: "normal", path: "", modifier: 0, eldar: false,
      pushChoice: 1, damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1
    });

    // Формула получила лишний куб Рвущего и kh1 — то же, что делает
    // applyDamageDiceMods у обычного оружия.
    expect(captured.rolls).toContain("2d10kh1+2");
    expect(captured.rolls).toContain("1d5");
    expect(captured.chat[0].content).toContain("Урон (Энергетический, Проб. 0): <b>12</b>");
    expect(captured.chat[0].content).toContain("Экстремальный урон");
    expect(captured.chat[0].content).toContain("d5: 4");
  });

  // Жалоба игрока: «Варп-Оружие» на психосиле не срабатывает. wp (aggregateAuto)
  // и раньше считал warpSoak верно — но кнопка «Применить урон» его не несла:
  // клик уходил в applyDamageToActor с warpSoak по умолчанию false, и цель
  // защищалась бронёй/Стойкостью как обычно. Тест бьёт по самой кнопке.
  it("Варп-Оружие на психосиле кладёт warpSoak/ignoreShield в кнопку «Применить урон»", async () => {
    const a = actor();
    const power = item({ system: {
      testChar: "wp", powerType: "attack", testMod: 0,
      damage: "1d10+2", damageType: "energy",
      weaponProps: [{ key: "warpWeapon", rating: 0, rating2: 0 }]
    } });
    captured.dice = [5, 7];

    await executePsychotest(a, power, {
      mPR: 1, prMod: 0, mode: "normal", path: "", modifier: 0, eldar: false,
      pushChoice: 1, damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1
    });

    const card = captured.chat[0].content;
    expect(card).toContain('data-warp-soak="1"');
    expect(card).toContain('data-ignore-shield="1"');
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

// Тест Сопротивления ЦЕЛИ (wdbc-5vf4) — книжный «Психотест X vs Y+N»:
// resistChar/resistMod (module/data/item/psychic-power.mjs) читаются живьём
// прямо при манифестации, а не через Конструктор — testMod с этого предмета
// применялся бы к тестам ВЛАДЕЛЬЦА (см. заметки в 83 паках психосил), не к
// выбранной цели.
describe("тест Сопротивления цели (wdbc-5vf4)", () => {
  afterEach(() => { delete game.user.targets; });

  it("успешная манифестация + указан resistChar + есть наведённая цель — карточка несёт кнопку запроса с верными данными", async () => {
    const a = actor();
    a.uuid = "Actor.caster-1";
    game.user.targets = [{ actor: { uuid: "Actor.target-1", name: "Культист" } }];
    const power = item({ system: {
      testChar: "wp", powerType: "utility", testMod: 5,
      resistChar: "t", resistMod: -5
    } });
    captured.nextRoll = 30; // Порог 55 (как в соседнем тесте) — успех.

    await executePsychotest(a, power, {
      mPR: 2, prMod: 0, mode: "normal", path: "", modifier: 0, eldar: false,
      pushChoice: 1, damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1
    });

    const card = captured.chat[0].content;
    expect(card).toContain("Манифестация удалась");
    expect(card).toContain("Цель делает тест Сопротивления");
    expect(card).toContain("<b>T -5</b>");
    expect(card).toContain('class="psy-resist-request-btn"');
    expect(card).toContain('data-target-uuid="Actor.target-1"');
    expect(card).toContain('data-caster-uuid="Actor.caster-1"');
    expect(card).toContain('data-char-key="t"');
    expect(card).toContain('data-mod="-5"');
  });

  it("resistChar задан, но цель не наведена — подсказка вместо кнопки", async () => {
    const a = actor();
    const power = item({ system: { testChar: "wp", powerType: "utility", testMod: 5, resistChar: "wp", resistMod: 0 } });
    captured.nextRoll = 30;

    await executePsychotest(a, power, {
      mPR: 2, prMod: 0, mode: "normal", path: "", modifier: 0, eldar: false,
      pushChoice: 1, damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1
    });

    const card = captured.chat[0].content;
    expect(card).toContain("Наведите цель");
    expect(card).not.toContain('class="psy-resist-request-btn"');
  });

  it("resistChar пуст (сила без встречного теста) — секции Сопротивления в карточке нет вовсе", async () => {
    const a = actor();
    game.user.targets = [{ actor: { uuid: "Actor.target-1", name: "Культист" } }];
    const power = item({ system: { testChar: "wp", powerType: "utility", testMod: 5 } });
    captured.nextRoll = 30;

    await executePsychotest(a, power, {
      mPR: 2, prMod: 0, mode: "normal", path: "", modifier: 0, eldar: false,
      pushChoice: 1, damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1
    });

    expect(captured.chat[0].content).not.toContain("Цель делает тест Сопротивления");
  });

  it("манифестация провалена — Сопротивление цели не предлагается (до цели дело не доходит)", async () => {
    const a = actor();
    game.user.targets = [{ actor: { uuid: "Actor.target-1", name: "Культист" } }];
    const power = item({ system: { testChar: "wp", powerType: "utility", testMod: 5, resistChar: "t", resistMod: 0 } });
    captured.nextRoll = 99; // выше Порога 55 — провал.

    await executePsychotest(a, power, {
      mPR: 2, prMod: 0, mode: "normal", path: "", modifier: 0, eldar: false,
      pushChoice: 1, damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1
    });

    expect(captured.chat[0].content).toContain("Психотест провален");
    expect(captured.chat[0].content).not.toContain("Цель делает тест Сопротивления");
  });
});

// Психотест — такой же тест конвейера, как бросок навыка и атака: правила с
// областью `power:` должны доходить и до окна манифестации, и до броска.
// Правило подставляется своим источником, как в test/rules/collect.test.mjs.
describe("правила реестра в психотесте", () => {
  const DEFAULT_SOURCES = getRuleSources();

  const withRule = (target, value = 10) => {
    clearRuleSources();
    registerRuleSource("тест", () => [{
      id: "psy.test", label: "Правило силы",
      effects: [{ kind: "rollBonus", target, value }]
    }]);
  };

  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
  });

  it("правило области power доходит до окна манифестации", () => {
    withRule("power");
    showManifestDialog(actor(), item({ system: { testChar: "wp", powerType: "utility" } }));
    expect(captured.dialog.content).toContain("Правило силы");
    expect(captured.dialog.content).toContain('class="rule-mod"');
  });

  it("правило чужой силы в окно не попадает", () => {
    withRule("power:smite");
    showManifestDialog(actor(), item({ name: "Warp Sight / Взор Варпа" }));
    expect(captured.dialog.content).not.toContain("Правило силы");
  });

  it("правило своей силы попадает по любой половине имени", () => {
    withRule("power:порицание");
    showManifestDialog(actor(), item({ name: "Smite / Порицание" }));
    expect(captured.dialog.content).toContain("Правило силы");
  });

  it("отмеченная галочка меняет порог психотеста", async () => {
    withRule("power", 10);
    const a = actor();
    showManifestDialog(a, item({ system: { testChar: "wp", powerType: "utility" } }));
    captured.nextRoll = 30;

    // W 40 + 5×эPR 2 = 50, плюс +10 отмеченного правила.
    await captured.dialog.buttons.cast.callback(fakeHtml({
      "#psy-pr": "2", "#psy-pr-mod": "0", "#psy-mode": "normal", "#psy-path": "",
      "#psy-mod": "0", "#psy-push-bonus": "1", "#psy-pr-dmg": "0",
      "#psy-pr-range": "0", "#psy-profile": "-1", "#psy-variant": "-1"
    }, { ".rule-mod:checked": [{ dataset: { value: "10" } }] }));

    expect(captured.chat[0].content).toContain("Порог: <b>60</b>");
  });

  it("неотмеченная галочка порог не трогает", async () => {
    withRule("power", 10);
    const a = actor();
    showManifestDialog(a, item({ system: { testChar: "wp", powerType: "utility" } }));
    captured.nextRoll = 30;

    await captured.dialog.buttons.cast.callback(fakeHtml({
      "#psy-pr": "2", "#psy-pr-mod": "0", "#psy-mode": "normal", "#psy-path": "",
      "#psy-mod": "0", "#psy-push-bonus": "1", "#psy-pr-dmg": "0",
      "#psy-pr-range": "0", "#psy-profile": "-1", "#psy-variant": "-1"
    }));

    expect(captured.chat[0].content).toContain("Порог: <b>50</b>");
  });

  it("галочка «ополовинить штраф» делит штрафы, округляя в пользу игрока", async () => {
    withRule("power", 0);
    const a = actor();
    showManifestDialog(a, item({ system: { testChar: "wp", powerType: "utility" } }));
    captured.nextRoll = 30;

    // W 40 + 5×эPR 2 = 50, штраф −25 ополовинен до −12.
    await captured.dialog.buttons.cast.callback(fakeHtml({
      "#psy-pr": "2", "#psy-pr-mod": "0", "#psy-mode": "normal", "#psy-path": "",
      "#psy-mod": "-25", "#psy-push-bonus": "1", "#psy-pr-dmg": "0",
      "#psy-pr-range": "0", "#psy-profile": "-1", "#psy-variant": "-1"
    }, { ".rule-mod:checked": [{ dataset: { value: "0", halve: "1" } }] }));

    expect(captured.chat[0].content).toContain("Порог: <b>38</b>");
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
