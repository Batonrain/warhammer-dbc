// test/sheets/tech-talents.test.mjs
//
// Таланты Техномистика главы 3 (Sahara 3-2501), считающие Когницию и
// Славословия: Проблеск Всеведенья, Омнимнезис, Декомпиляция, Разгон,
// Рекомпиляция, Вотивная Месса, Цифровое Откровение, Ноосферная Набожность.
// Чистая арифметика — rules/technomystic-talents.mjs; здесь проверено, что
// лист (sheets/tabs/tech.mjs) её зовёт и платит ровно столько, сколько сказано.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { activateTechMiracle, rollTechScan, overclock } from "../../module/sheets/tabs/tech.mjs";
import { processCostTotal, processCostOf, votiveMassCost, recompileSources, overclockMax, slavoRating, settleProcessCost }
  from "../../module/rules/technomystic-talents.mjs";

const talent = name => ({ id: name, type: "talent", name, system: {}, flags: {}, getFlag: () => undefined });

function miracle(extra = {}, id = "m1") {
  const it = { id, name: "Тестовое Чудо", type: "techPower",
    system: { miracleType: "imperative", rating: 1, cognitionCost: 3, energyCost: 0, testSkill: "techUse", testMod: 0,
      iron: "", damage: "", weaponProps: [], ...extra }, updates: [],
    update: async d => { it.updates.push(d); for (const [k, v] of Object.entries(d)) it.system[k.replace(/^system\./, "")] = v; } };
  return it;
}
const slavo = (id, rating, compiled = false, name = `Славословие ${id}`) =>
  Object.assign(miracle({ miracleType: "slavoslovie", rating, compiled, cognitionCost: 1 }, id), { name });

function mage({ cog = 10, energy = 5, items = [], intB = 4, techUse = 40 } = {}) {
  const flags = {};
  const updates = [];
  const a = {
    id: "m1", name: "Техножрец", uuid: "Actor.m1", type: "character", items, updates,
    getFlag: (s, k) => flags[`${s}.${k}`], setFlag: async (s, k, v) => { flags[`${s}.${k}`] = v; },
    unsetFlag: async (s, k) => { delete flags[`${s}.${k}`]; },
    system: {
      cognition: { value: cog, max: 10, regen: 2 }, energy: { value: energy, max: 10 },
      characteristics: { t: { total: 50 }, int: { total: intB * 10, bonus: intB } },
      skills: { techUse: { total: techUse } }, techFocus: [], techCompBonus: 0, corruptionBonus: 0
    },
    update: async u => {
      updates.push(u);
      for (const [k, v] of Object.entries(u)) {
        const keys = k.split("."); let o = a;
        for (const kk of keys.slice(0, -1)) o = (o[kk] ??= {});
        o[keys.at(-1)] = v;
      }
    }
  };
  return a;
}
const chatText = () => captured.chat.map(m => String(m.content ?? "")).join("\n");

beforeEach(() => { resetCaptured(); globalThis.game.user = { targets: [] }; globalThis.game.combat = undefined; });

describe("Омнимнезис: переброс активации за 1 ⚙ после провала", () => {
  it("провал → вопрос → переброс успешен: цена +1 ⚙, результат заменён", async () => {
    captured.dice = [90, 10]; captured.confirmAnswer = true;
    const a = mage({ items: [talent("Omnimnesis / Омнимнезис")] });
    await activateTechMiracle(a, miracle());
    expect(a.system.cognition.value).toBe(10 - 3 - 1);
    expect(chatText()).toContain("Омнимнезис");
    expect(chatText()).toContain("Активировано");
  });

  it("отказ — платится только цена активации, провал остаётся", async () => {
    captured.dice = [90]; captured.confirmAnswer = false;
    const a = mage({ items: [talent("Omnimnesis / Омнимнезис")] });
    await activateTechMiracle(a, miracle());
    expect(a.system.cognition.value).toBe(7);
    expect(chatText()).toContain("Сбой");
  });

  it("успех с первого раза, нет Таланта или не хватает ⚙ на переброс — вопроса нет", async () => {
    captured.dice = [10]; captured.dialog = null;
    await activateTechMiracle(mage({ items: [talent("Omnimnesis / Омнимнезис")] }), miracle());
    expect(captured.dialog).toBeNull();
    captured.dice = [90];
    await activateTechMiracle(mage(), miracle());
    expect(captured.dialog).toBeNull();
    captured.dice = [90];
    await activateTechMiracle(mage({ cog: 3, items: [talent("Omnimnesis / Омнимнезис")] }), miracle());
    expect(captured.dialog).toBeNull();
  });
});

describe("Ноосферное Сканирование: Проблеск Всеведенья и Декомпиляция", () => {
  const scanner = (results) => { let i = 0; const calls = []; const fn = async (...args) => { calls.push(args); return results[i++]; }; fn.calls = calls; return fn; };

  it("провал + Проблеск: −1 ⚙, второе Сканирование", async () => {
    captured.confirmAnswer = true;
    const a = mage({ items: [talent("Glimpse of Omniscience / Проблеск Всеведенья")] });
    const roll = scanner([{ success: false, deg: 1 }, { success: true, deg: 2 }]);
    const r = await rollTechScan(a, roll);
    expect(roll.calls.length).toBe(2);
    expect(r.success).toBe(true);
    expect(a.system.cognition.value).toBe(9);
    expect(a.getFlag("warhammer-dbc", "unseenDetectedUntilNextTurn")).toBe(true);
  });

  it("без Таланта или при успехе — второго броска нет", async () => {
    captured.confirmAnswer = true;
    const roll1 = scanner([{ success: false, deg: 1 }]);
    await rollTechScan(mage(), roll1);
    expect(roll1.calls.length).toBe(1);
    const roll2 = scanner([{ success: true, deg: 1 }]);
    await rollTechScan(mage({ items: [talent("Glimpse of Omniscience / Проблеск Всеведенья")] }), roll2);
    expect(roll2.calls.length).toBe(1);
  });

  it("отказ от переброса — Когниция цела", async () => {
    captured.confirmAnswer = false;
    const a = mage({ items: [talent("Glimpse of Omniscience / Проблеск Всеведенья")] });
    const roll = scanner([{ success: false, deg: 1 }]);
    await rollTechScan(a, roll);
    expect(a.system.cognition.value).toBe(10);
    expect(roll.calls.length).toBe(1);
  });

  it("Декомпиляция: успешное Сканирование + согласие → −1 ⚙ и запись в чат", async () => {
    captured.confirmAnswer = true;
    const a = mage({ items: [talent("Decompile / Декомпиляция")] });
    await rollTechScan(a, scanner([{ success: true, deg: 1 }]));
    expect(a.system.cognition.value).toBe(9);
    expect(chatText()).toContain("Декомпиляция");
  });

  it("Декомпиляция: провал Сканирования или отказ — ничего не списывается", async () => {
    captured.confirmAnswer = true;
    const a = mage({ items: [talent("Decompile / Декомпиляция")] });
    await rollTechScan(a, scanner([{ success: false, deg: 1 }]));
    expect(a.system.cognition.value).toBe(10);
    captured.confirmAnswer = false;
    await rollTechScan(a, scanner([{ success: true, deg: 1 }]));
    expect(a.system.cognition.value).toBe(10);
  });
});

describe("Разгон", () => {
  const run = async (a, n) => {
    const p = overclock(a);
    await captured.press("go", fakeForm({ '[name="n"]': String(n) }));
    await p;
  };
  const withTalent = (extra = {}) => mage({ cog: 4, energy: 3, items: [talent("Overclock / Разгон")], ...extra });

  it("−1 ⚡, +n ⚙ (до I.b и до свободного места), 2 урона в I за каждую ⚙", async () => {
    const a = withTalent();
    // стенд не знает характеристик в charLoss — смотрим на update и карточку
    await run(a, 3);
    expect(a.system.energy.value).toBe(2);
    expect(a.system.cognition.value).toBe(7);
    expect(chatText()).toContain("Разгон");
    expect(chatText()).toMatch(/<b>6<\/b> урона в Интеллект \(40 → 34\)/); // 3 ⚙ × 2 урона
    const dmgUpdate = a.updates.find(u => Object.keys(u).some(k => /charLoss|characteristics/.test(k)));
    expect(dmgUpdate).toBeTruthy();
  });

  it("n зажимается в пределах I.b и места в пуле", async () => {
    const a = withTalent({ cog: 9 }); // места 1
    await run(a, 4);
    expect(a.system.cognition.value).toBe(10);
  });

  it("вне боя Хода нет: ограничения «раз в Ход» нет, метка не ставится", async () => {
    const a = withTalent({ cog: 2, energy: 5 });
    await run(a, 1);
    await run(a, 1);
    expect(a.system.cognition.value).toBe(4);
    expect(a.getFlag("warhammer-dbc", "overclockThisTurn")).toBeUndefined();
  });

  it("раз в Ход (в бою): второй Разгон отклоняется", async () => {
    globalThis.game.combat = { started: true };
    const a = withTalent();
    await run(a, 1);
    captured.warnings.length = 0;
    await overclock(a);
    expect(captured.warnings.join()).toContain("уже использован");
  });

  it("нет ⚡ — отказ с объяснением; без Таланта — ничего", async () => {
    const a = withTalent({ energy: 0 });
    await overclock(a);
    expect(captured.warnings.join()).toContain("⚡");
    const b = mage();
    captured.dialog = null;
    await overclock(b);
    expect(captured.dialog).toBeNull();
  });

  it("overclockMax: min(I.b, место), 0 без ⚡", () => {
    expect(overclockMax(mage({ cog: 4, energy: 3 }))).toBe(4);
    expect(overclockMax(mage({ cog: 9, energy: 3 }))).toBe(1);
    expect(overclockMax(mage({ cog: 4, energy: 0 }))).toBe(0);
  });
});

describe("Вотивная Месса и Рекомпиляция", () => {
  async function activate(a, item, action) {
    const p = activateTechMiracle(a, item);
    await captured.press(action, fakeForm());
    await p;
  }

  it("Вотивная Месса: X×4 ⚙ и Славословие скомпилировано сразу", async () => {
    const s = slavo("s1", 2);
    const a = mage({ cog: 10, items: [talent("Votive Mass / Вотивная Месса"), s] });
    await activate(a, s, "votive");
    expect(a.system.cognition.value).toBe(10 - 8);
    expect(s.system.compiled).toBe(true);
    expect(chatText()).toContain("Вотивная Месса");
  });

  it("Вотивная Месса недоступна, если ⚙ меньше X×4 — окно не открывается", async () => {
    const s = slavo("s1", 3);
    const a = mage({ cog: 11, items: [talent("Votive Mass / Вотивная Месса"), s] });
    captured.dialog = null;
    await activateTechMiracle(a, s);
    expect(captured.dialog).toBeNull();
    expect(chatText()).toContain("Компиляция Славословия");
  });

  it("Рекомпиляция: −1 ⚙, старое Славословие снято, новое скомпилировано; рейтинг нового не выше", async () => {
    const old = slavo("old", 3, true), neu = slavo("neu", 2), tooBig = slavo("big", 4);
    const a = mage({ cog: 10, items: [talent("Recompile / Рекомпиляция"), old, neu, tooBig] });
    await activate(a, neu, "recompile:old");
    expect(a.system.cognition.value).toBe(9);
    expect(old.system.compiled).toBe(false);
    expect(neu.system.compiled).toBe(true);
    // Славословие рейтинга 4 нельзя поставить на место рейтинга 3.
    captured.dialog = null;
    await activateTechMiracle(mage({ cog: 10, items: [talent("Recompile / Рекомпиляция"), slavo("o2", 3, true), tooBig] }), tooBig);
    expect(captured.dialog).toBeNull();
  });

  it("отказ (обычная компиляция) — ничего не списано", async () => {
    const s = slavo("s1", 1);
    const a = mage({ cog: 10, items: [talent("Votive Mass / Вотивная Месса"), s] });
    await activate(a, s, "manual");
    expect(a.system.cognition.value).toBe(10);
    expect(s.system.compiled).toBe(false);
    expect(chatText()).toContain("Компиляция Славословия");
  });

  it("recompileSources: только скомпилированные и не слабее нового", () => {
    const old = slavo("old", 3, true), same = slavo("same", 2, true), small = slavo("small", 1, true), neu = slavo("neu", 2);
    expect(recompileSources([old, same, small, neu], neu).map(p => p.id).sort()).toEqual(["old", "same"]);
  });
});

describe("Процессы: Цифровое Откровение и Ноосферная Набожность", () => {
  const sustained = (id, cost) => Object.assign(miracle({ sustained: true, sustainCost: cost }, id), { name: `Процесс ${id}` });

  it("цена одного Процесса: скомпилированное Славословие — ½X вверх, держимое — своя цена", () => {
    expect(processCostOf(slavo("a", 3, true))).toBe(1.5); // половины не округляются поштучно
    expect(processCostOf(slavo("a", 1, true))).toBe(0.5);
    expect(processCostOf(slavo("a", 3, false))).toBe(0);
    expect(processCostOf(sustained("s", 2))).toBe(2);
    expect(slavoRating(sustained("s", 2))).toBe(0);
    expect(votiveMassCost(3)).toBe(12);
  });

  it("округление вверх — на СУММЕ, а не на каждом Славословии (книга: «суммарная цена … округляется вверх»)", () => {
    expect(processCostTotal(mage({ items: [slavo("a", 1, true), slavo("b", 1, true)] })).total).toBe(1);
    expect(processCostTotal(mage({ items: [slavo("a", 3, true), slavo("b", 1, true)] })).total).toBe(2);
    expect(processCostTotal(mage({ items: [slavo("a", 1, true)] })).total).toBe(1);
  });

  it("без Талантов — сумма как есть", () => {
    const a = mage({ items: [sustained("s", 2), slavo("c", 3, true)] });
    expect(processCostTotal(a)).toMatchObject({ base: 4, total: 4, revelation: 0, piety: 0 });
  });

  it("Цифровое Откровение: −1 за взятие, до 3, общая сумма, не ниже 0", () => {
    const rev = () => talent("Digital Revelation / Цифровое Откровение");
    expect(processCostTotal(mage({ items: [sustained("s", 2), rev()] })).total).toBe(1);
    expect(processCostTotal(mage({ items: [sustained("s", 5), rev(), rev(), rev(), rev()] })).total).toBe(2); // 4-е взятие не считается
    expect(processCostTotal(mage({ items: [sustained("s", 1), rev(), rev()] })).total).toBe(0);
  });

  it("Ноосферная Набожность снимает только со скомпилированных Славословий, не с активных Процессов", () => {
    const piety = () => talent("Noospheric Piety / Ноосферная Набожность");
    const onlySustained = mage({ items: [sustained("s", 3), piety()] });
    expect(processCostTotal(onlySustained)).toMatchObject({ base: 3, piety: 0, total: 3 });
    const mixed = mage({ items: [sustained("s", 3), slavo("c", 4, true), piety(), piety()] });
    expect(processCostTotal(mixed)).toMatchObject({ base: 5, compiledBase: 2, piety: 2, total: 3 });
  });

  const pressRest = async a => {
    const { activateTechListeners } = await import("../../module/sheets/tabs/tech.mjs");
    const handlers = {};
    const html = { find: sel => ({ click: fn => { handlers[sel] = fn; }, change: () => {} }) };
    activateTechListeners(html, a, {});
    await handlers[".cognition-rest-btn"]({ preventDefault() {} });
  };

  it("кнопка «↻»: +½ I.b ⚙, затем сама списывает цену Процессов с учётом Талантов (решение владельца 25.10.2026)", async () => {
    const a = mage({ cog: 3, items: [sustained("s", 3), talent("Digital Revelation / Цифровое Откровение")] });
    await pressRest(a);
    // 3 + регенерация 2 = 5, цена Процессов 3 − Откровение 1 = 2 → остаётся 3
    expect(a.system.cognition.value).toBe(3);
    expect(chatText()).toContain("Цена Процессов");
    expect(chatText()).toContain("Цифровое Откровение −1");
    expect(chatText()).toContain("Списано");
  });

  it("без Процессов Когниция только восстанавливается", async () => {
    const a = mage({ cog: 3, items: [] });
    await pressRest(a);
    expect(a.system.cognition.value).toBe(5);
  });

  it("в бою цена списывается ОДИН раз за Ход: повторное «↻» плату не берёт и метка стоит", async () => {
    globalThis.game.combat = { started: true };
    const a = mage({ cog: 3, items: [sustained("s", 2)] });
    await pressRest(a);
    expect(a.system.cognition.value).toBe(3); // 3 + 2 − 2
    expect(a.getFlag("warhammer-dbc", "processCostPaidThisTurn")).toBe(true);
    await pressRest(a);
    expect(a.system.cognition.value).toBe(3); // ни второй платы, ни второго восстановления
    expect(chatText()).toContain("уже списана");
  });

  it("в бою без Процессов «↻» тоже раз за Ход: второе нажатие Когницию не восстанавливает", async () => {
    globalThis.game.combat = { started: true };
    const a = mage({ cog: 3, items: [] });
    await pressRest(a);
    expect(a.system.cognition.value).toBe(5);
    await pressRest(a);
    expect(a.system.cognition.value).toBe(5);
  });

  it("вне боя Хода нет: метки нет, каждое «↻» — новый Ход со своей платой", async () => {
    const a = mage({ cog: 3, items: [sustained("s", 2)] });
    await pressRest(a);
    await pressRest(a);
    expect(a.system.cognition.value).toBe(3); // 3 → 3 → 3
    expect(a.getFlag("warhammer-dbc", "processCostPaidThisTurn")).toBeUndefined();
  });

  it("не хватает ⚙ на все Процессы — списывается сколько есть, остаток назван в карточке (лишние отключает игрок)", async () => {
    const a = mage({ cog: 0, items: [sustained("s", 5)] });
    await pressRest(a);
    expect(a.system.cognition.value).toBe(0); // 0 + 2 − 2 (всё, что было)
    expect(chatText()).toMatch(/Не хватило <b>3<\/b>/);
  });

  it("settleProcessCost: чистая арифметика", () => {
    expect(settleProcessCost(5, 2)).toEqual({ pay: 2, after: 3, shortfall: 0 });
    expect(settleProcessCost(1, 4)).toEqual({ pay: 1, after: 0, shortfall: 3 });
    expect(settleProcessCost(5, 0)).toEqual({ pay: 0, after: 5, shortfall: 0 });
  });
});
