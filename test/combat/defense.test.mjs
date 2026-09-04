// test/combat/defense.test.mjs
//
// Контратака (стр. 12, Талант Counter Attack): успешное Парирование
// предлагает кнопку тут же ударить в ответ тем же оружием — только с
// Талантом (capability technique.counterAttack) и не чаще раза в Раунд.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { _performParry, _performDodge, _performSprayCancel, COUNTER_ATTACK_CAPABILITY } from "../../module/combat/defense.mjs";
import { getEvasionPool } from "../../module/combat/evasion-pool.mjs";

const DEFAULT_SOURCES = getRuleSources();

/** weaponFor() не ставит type/equipped — actor.items.find(i=>i.type==="weapon"
 *  && i.system.equipped) их и требует (тот же приём, что в sheet-listeners.test.mjs). */
function equippedMelee(overrides = {}, meta = {}) {
  const w = weaponFor({ weaponClass: "melee", balance: 0, equipped: true, ...overrides }, meta);
  w.type = "weapon";
  return w;
}

/** Актор с getFlag/setFlag — «раз-в-Раунд» метка хранится флагом на акторе. */
function attacker(overrides = {}) {
  const a = actorFor(overrides);
  const store = {};
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  return a;
}

beforeEach(() => {
  resetCaptured();
  captured.dice = [10];               // WS 45 по умолчанию у actorFor() — гарантированный успех
  globalThis.game.combat = undefined;
});
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

function grantCounterAttack() {
  registerRuleSource("test", () => [{ id: "a", label: "Тест",
    effects: [{ kind: "grantFlag", target: COUNTER_ATTACK_CAPABILITY }] }]);
}

/** Экипирует меч с overrides/meta, заводит актора, зовёт _performParry и отдаёт текст карточки. */
async function parryCard(weaponOverrides = {}, meta = {}, hitsCount) {
  const sword = equippedMelee(weaponOverrides, meta);
  const actor = attacker({ items: [sword] });
  await _performParry(actor, 0, "Actor.attacker-1", hitsCount);
  return captured.chat.at(-1).content;
}

describe("_performParry: кнопка Контратаки", () => {
  it("без Таланта — кнопки нет, даже при удачном Парировании", async () => {
    const card = await parryCard();
    expect(card).toContain("Парирование успешно");
    expect(card).not.toContain("wh-counter-attack-btn");
  });

  it("с Талантом — кнопка есть, несёт id оружия и uuid атаковавшего", async () => {
    grantCounterAttack();
    const sword = equippedMelee({}, { id: "w-parry" });
    const actor = attacker({ items: [sword] });

    await _performParry(actor, 0, "Actor.attacker-1");

    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-counter-attack-btn");
    expect(card).toContain('data-weapon-id="w-parry"');
    expect(card).toContain('data-attacker-uuid="Actor.attacker-1"');
  });

  it("без оружия (нет мелейного на акторе) — кнопки нет, даже с Талантом", async () => {
    grantCounterAttack();
    const actor = attacker({ items: [] });

    await _performParry(actor, 0, "Actor.attacker-1");

    expect(captured.chat.at(-1).content).not.toContain("wh-counter-attack-btn");
  });

  it("Парирование провалено — кнопки нет", async () => {
    grantCounterAttack();
    captured.dice = [96];
    const sword = equippedMelee();
    const actor = attacker({ items: [sword] });

    await _performParry(actor, 0, "Actor.attacker-1");

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Парирование провалено");
    expect(card).not.toContain("wh-counter-attack-btn");
  });

  // isRoundCapabilityAvailable сама читает флаг «раз-в-Раунд» — здесь
  // достаточно убедиться, что _performParry её спрашивает: без активного
  // Combat возможность всегда доступна (раунд отследить нечем), а если
  // потрачена в ТЕКУЩЕМ раунде — кнопка пропадает.
  it("уже потрачена в этом Раунде (game.combat активен) — кнопки нет", async () => {
    grantCounterAttack();
    globalThis.game.combat = { round: 2 };
    const sword = equippedMelee();
    const actor = attacker({ items: [sword] });
    await actor.setFlag("warhammer-dbc",
      `usageLimits.${COUNTER_ATTACK_CAPABILITY.replace(/\./g, "-")}`, { scope: "round", used: true, round: 2 });

    await _performParry(actor, 0, "Actor.attacker-1");

    expect(captured.chat.at(-1).content).not.toContain("wh-counter-attack-btn");
  });

  it("без активного Combat — доступна всегда (раунд отследить нечем)", async () => {
    grantCounterAttack();
    const sword = equippedMelee();
    const actor = attacker({ items: [sword] });
    await actor.setFlag("warhammer-dbc",
      `usageLimits.${COUNTER_ATTACK_CAPABILITY.replace(/\./g, "-")}`, { scope: "round", used: true, round: 2 });

    await _performParry(actor, 0, "Actor.attacker-1");

    expect(captured.chat.at(-1).content).toContain("wh-counter-attack-btn");
  });
});

// Интегральные атаки (Кулак/Пинок/…, flags.warhammer-dbc.integralAttack)
// надеты всегда — «первое надетое рукопашное» без фильтра доставалось бы
// кулаку (Баланс −1 → −10) или пинку (Баланс −2 → «нельзя парировать»), а
// настоящий меч игнорировался. См. module/combat/equipped-melee.mjs.
describe("_performParry: интегральные атаки не перехватывают оружие", () => {
  const integral = (name, id, balance) =>
    equippedMelee({ balance }, { id, name,
      flags: { "warhammer-dbc.integralAttack": true } });

  it("надет меч и три интегральные — парирование выбирает меч", async () => {
    const fist     = integral("Fist / Удар кулаком", "w-fist", -1);
    const kick     = integral("Kick / Пинок", "w-kick", -2);
    const headbutt = integral("Headbutt / Удар головой", "w-head", -1);
    const sword    = equippedMelee({ balance: 0 }, { id: "w-sword", name: "Цепной меч" });
    const actor    = attacker({ items: [fist, kick, headbutt, sword] });

    await _performParry(actor, 0, "Actor.attacker-1");

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Оружие: Цепной меч");
    expect(card).not.toContain("нельзя парировать");
  });

  it("другого рукопашного нет — интегральная остаётся фолбэком", async () => {
    const fist  = integral("Fist / Удар кулаком", "w-fist", -1);
    const actor = attacker({ items: [fist] });

    await _performParry(actor, 0, "Actor.attacker-1");

    expect(captured.chat.at(-1).content).toContain("Оружие: Fist / Удар кулаком");
  });
});

// Очередь (semi/full-auto), Быстрая и Молниеносная Атака дают больше одного
// попадания за одну атаку. Стр. 12 «Избегание множественных попаданий»: Успех
// защиты снимает по одному попаданию за каждую свою степень, не больше их
// числа — это НЕ встречная проверка со степенью атакующего (см. defense.mjs).
describe("_performParry: несколько попаданий одной атаки (Очередь/Молниеносная)", () => {
  // WS 45 (actorFor), untrained −20, Баланс 0 → Порог 25; rv=10 → 2 степени.
  it("Успех меньше числа попаданий — снимает часть, остальные проходят", async () => {
    const card = await parryCard({}, {}, 5);
    expect(card).toContain("Парирование успешно");
    expect(card).toContain("снимает 2 из 5 попаданий");
    expect(card).toContain("3 попадания всё ещё проходит");
    expect(card).not.toContain("Атака отражена");
  });

  it("Успех покрывает или превышает число попаданий — вся атака отражена", async () => {
    const card = await parryCard({}, {}, 2);
    expect(card).toContain("снимает все 2 попадания");
    expect(card).toContain("Атака отражена");
  });

  it("Провал — ни одно из нескольких попаданий не снимается", async () => {
    captured.dice = [96];
    const card = await parryCard({}, {}, 5);
    expect(card).toContain("Парирование провалено");
    expect(card).toContain("Все 5 попаданий проходят");
  });

  it("одно попадание (по умолчанию) — текст как раньше, без счёта попаданий", async () => {
    const card = await parryCard();
    expect(card).toContain("Атака отражена");
    expect(card).not.toContain("снимает");
  });
});

// Дуэлянтское (стр. 73 Книги Аэльдари): +10 к Парированию — отдельная строка
// разбивки, не подписанная как «Защитное» (той же defBonus раньше делили на
// двоих без разметки источника).
describe("_performParry: бонус Дуэлянтского", () => {
  it.each([
    ["Дуэлянтское оружие добавляет +10 отдельной строкой «Дуэлянтское +10»",
      [{ key: "duelingWeapon", rating: 0, rating2: 0 }],
      ["Дуэлянтское +10"], ["Защитное"]],
    ["Защитное и Дуэлянтское на одном оружии складываются и показаны раздельно",
      [{ key: "duelingWeapon", rating: 0, rating2: 0 }, { key: "defensive", rating: 0, rating2: 0 }],
      ["Защитное +15", "Дуэлянтское +10"], []],
    ["без Дуэлянтского строки в разбивке нет", [], [], ["Дуэлянтское"]]
  ])("%s", async (_title, weaponProps, contains, notContains) => {
    const card = await parryCard({ weaponProps });
    for (const text of contains) expect(card).toContain(text);
    for (const text of notContains) expect(card).not.toContain(text);
  });
});

// Шаг За Шагом (стр. 73 Книги Аэльдари): +10 к Парированию безусловно —
// сам факт Парирования уже означает «в рукопашном бою».
describe("_performParry: бонус Шаг За Шагом", () => {
  it.each([
    ["оружие со Шаг За Шагом добавляет +10 отдельной строкой",
      [{ key: "stepByStep", rating: 0, rating2: 0 }],
      ["Шаг За Шагом +10"]],
    ["Дуэлянтское и Шаг За Шагом на одном оружии складываются (+20) и показаны раздельно",
      [{ key: "duelingWeapon", rating: 0, rating2: 0 }, { key: "stepByStep", rating: 0, rating2: 0 }],
      ["Дуэлянтское +10", "Шаг За Шагом +10"]]
  ])("%s", async (_title, weaponProps, contains) => {
    const card = await parryCard({ weaponProps });
    for (const text of contains) expect(card).toContain(text);
  });
});

describe("_performDodge: несколько попаданий одной атаки", () => {
  // Ag 35 (actorFor), untrained −20 → Порог 15; rv=10 → 1 степень.
  it("Успех меньше числа попаданий — снимает часть, остальные проходят", async () => {
    const actor = attacker();

    await _performDodge(actor, 0, "", 3);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Уклонение успешно");
    expect(card).toContain("снимает 1 из 3 попадания");
    expect(card).toContain("2 попадания всё ещё проходит");
    expect(card).not.toContain("Атака промахивается");
  });

  it("Провал — все попадания очереди проходят", async () => {
    captured.dice = [96];
    const actor = attacker();

    await _performDodge(actor, 0, "", 4);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Уклонение провалено");
    expect(card).toContain("Все 4 попадания проходят");
  });
});

// Повален (стр. 30-31, wdbc-r5o7.2): −20 на Уклонение — Ag 35, untrained −20
// → Порог 15 без Состояния, −5 с ним.
describe("_performDodge: Повален (wdbc-r5o7.2)", () => {
  it("Порог падает на 20, чип «повален» в карточке", async () => {
    const actor = attacker();
    actor.system.conditions = { prone: true };
    captured.dice = [90]; // выше нового (отрицательного) порога — провал, но карточка всё равно пишет порог

    await _performDodge(actor, 0, "", 1);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("→ Порог: <b>-5</b>");
    expect(card).toContain("🧎 повален -20");
  });

  it("не Повален — штрафа и чипа нет", async () => {
    const actor = attacker();

    await _performDodge(actor, 0, "", 1);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("→ Порог: <b>15</b>");
    expect(card).not.toContain("повален");
  });
});

// Пул Избегания (стр. 12, module/combat/evasion-pool.mjs): излишек Успехов
// сверх того, что нужно ЭТОЙ атаке, банкуется на попадания ДРУГИХ атак того
// же противника в этом Ходу — но только пока «Ход» отследим (активный бой).
describe("_performDodge/_performParry: банк излишка Успехов в пул Избегания", () => {
  it("вне боя — излишек не банкуется, заметки в карточке нет", async () => {
    // Ag 35, untrained −20 → Порог 15; rv=10 → 1 степень, при hitsCount=1 — 0 излишка,
    // но hitsCount меньше, чем deg, тут не нужен: важно, что game.combat не задан.
    const actor = attacker();
    await _performDodge(actor, 0, "", 1, "Actor.attacker-1");
    expect(captured.chat.at(-1).content).not.toContain("Остаётся");
  });

  it("в бою — Уклонение с излишком степеней банкует остаток и пишет об этом", async () => {
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
// Ag 35, untrained −20 → Порог 15; rv=10 → 1 степень. hitsCount=1 → снимает
    // единственное попадание, излишка нет — возьмём deg побольше перебросом порога.
    captured.dice = [1]; // Порог 15, rv=1 → deg = floor(14/10)+1 = 2
    const actor = attacker();

    await _performDodge(actor, 0, "", 1, "Actor.attacker-1");

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Остаётся 1 неизрасходованный Успех");
    expect(getEvasionPool(actor, "Actor.attacker-1")).toMatchObject({ successes: 1 });
  });

  it("в бою — Парирование с излишком степеней банкует остаток", async () => {
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
// WS 45, untrained −20, Баланс 0 → Порог 25; rv=10 → deg=2, hitsCount=1 → излишек 1.
    const sword = equippedMelee();
    const actor = attacker({ items: [sword] });

    await _performParry(actor, 0, "Actor.attacker-1");

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Остаётся 1 неизрасходованный Успех");
    expect(getEvasionPool(actor, "Actor.attacker-1")).toMatchObject({ successes: 1 });
  });
});

// Распыление/Spray (wdbc-p06s, стр. 166-170): отдельный от Уклонения тест —
// Acrobatics(A)+0, без Реакции. Ag 35 (actorFor), untrained −20 → Порог 15,
// те же числа, что у _performDodge (одна и та же характеристика).
describe("_performSprayCancel: тест на отмену Распыления (wdbc-p06s)", () => {
  it("Успех — попадание отменено, предложена кнопка Отскока", async () => {
    captured.dice = [10]; // Порог 15, rv=10 → 1 степень, успех
    const actor = attacker();

    await _performSprayCancel(actor);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Тест на отмену (Распыление, Acrobatics A+0)");
    expect(card).toContain("→ Порог: <b>15</b>");
    expect(card).toContain("Успех");
    expect(card).toContain("Попадание отменено");
    expect(card).toContain("wh-recoil-btn");
  });

  it("Провал — попадание проходит, кнопки Отскока нет", async () => {
    captured.dice = [96];
    const actor = attacker();

    await _performSprayCancel(actor);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Провал");
    expect(card).toContain("Попадание проходит");
    expect(card).not.toContain("wh-recoil-btn");
  });

  // Реакция здесь не тратится (RAW: «без Реакции») — выключенная силовая
  // броня поэтому даёт обычный −10 физическому действию (charKey), а не −40
  // Реакции (skillKey Dodge/Parry, см. armor-mods.mjs::REACTION_SKILLS).
  it("выключенная силовая броня — −10 (физическое действие), не −40 (Реакция)", async () => {
    const armor = { type: "armor", system: { equipped: true, armorType: "power", active: false, weight: 10 } };
    const actor = attacker({ items: [armor], encumbrance: { carry: 1000, lift: 2000, push: 4000 } });

    await _performSprayCancel(actor);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("броня выключена -10");
    expect(card).not.toContain("-40");
  });
});

// Dancing Among The Fire / Танец Среди Огня (wdbc-u0by): Преимущество на
// Уклонение/Парирование против Короткой/Длинной Очереди (burst) — только
// с Талантом И против Очереди сразу, roll×2 + keepBest.
const dancer = () => ({ type: "talent", name: "Dancing Among The Fire / Танец Среди Огня", system: {} });

describe("_performDodge: Танец Среди Огня (wdbc-u0by)", () => {
  it("Талант + burst — два броска, лучший (меньший) взят", async () => {
    const actor = attacker({ items: [dancer()] });
    captured.dice = [80, 20];

    await _performDodge(actor, 0, "", 1, "", false, true);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Танец Среди Огня: Преимущество, отброшено 80");
    expect(card).toContain("<b>20</b>");
  });

  it("Талант, но не burst — один бросок как раньше", async () => {
    const actor = attacker({ items: [dancer()] });
    captured.nextRoll = 10;

    await _performDodge(actor, 0, "", 1, "", false, false);

    expect(captured.chat.at(-1).content).not.toContain("Танец Среди Огня");
  });

  it("burst, но нет Таланта — один бросок", async () => {
    const actor = attacker();
    captured.nextRoll = 10;

    await _performDodge(actor, 0, "", 1, "", false, true);

    expect(captured.chat.at(-1).content).not.toContain("Танец Среди Огня");
  });

  it("навязанный переброс (forcedReroll) приоритетнее собственного Преимущества", async () => {
    const actor = attacker({ items: [dancer()] });
    captured.dice = [80, 20];

    await _performDodge(actor, 0, "keepWorst", 1, "", false, true);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("навязанный переброс, отброшено 20");
    expect(card).not.toContain("Танец Среди Огня");
  });
});

describe("_performParry: Танец Среди Огня (wdbc-u0by)", () => {
  it("Талант + burst — два броска, лучший взят", async () => {
    const sword = equippedMelee();
    const actor = attacker({ items: [sword, dancer()] });
    captured.dice = [80, 20];

    await _performParry(actor, 0, "", 1, true);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Танец Среди Огня: Преимущество, отброшено 80");
    expect(card).toContain("<b>20</b>");
  });

  it("без burst — один бросок как раньше", async () => {
    const sword = equippedMelee();
    const actor = attacker({ items: [sword, dancer()] });
    captured.nextRoll = 10;

    await _performParry(actor, 0, "", 1, false);

    expect(captured.chat.at(-1).content).not.toContain("Танец Среди Огня");
  });
});

// One Against A Hundred / Один Против Сотни (wdbc-u0by): Преимущество на
// Уклонение/Парирование, когда атакующий — Орда (actor.type === "horde") —
// только с Талантом И против Орды сразу, roll×2 + keepBest. Низшие Миньоны
// не смоделированы (нет поля «тир» на акторе миньона).
const bladeHost = () => ({ type: "talent", name: "One Against A Hundred / Один Против Сотни", system: {} });

describe("_performDodge: Один Против Сотни (wdbc-u0by)", () => {
  it("Талант + атакующий Орда — два броска, лучший взят", async () => {
    const actor = attacker({ items: [bladeHost()] });
    captured.dice = [80, 20];

    await _performDodge(actor, 0, "", 1, "", false, false, true);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Один Против Сотни: Преимущество, отброшено 80");
    expect(card).toContain("<b>20</b>");
  });

  it("Талант, но атакующий не Орда — один бросок", async () => {
    const actor = attacker({ items: [bladeHost()] });
    captured.nextRoll = 10;

    await _performDodge(actor, 0, "", 1, "", false, false, false);

    expect(captured.chat.at(-1).content).not.toContain("Один Против Сотни");
  });

  it("атакующий Орда, но нет Таланта — один бросок", async () => {
    const actor = attacker();
    captured.nextRoll = 10;

    await _performDodge(actor, 0, "", 1, "", false, false, true);

    expect(captured.chat.at(-1).content).not.toContain("Один Против Сотни");
  });
});

describe("_performParry: Один Против Сотни (wdbc-u0by)", () => {
  it("Талант + атакующий Орда — два броска, лучший взят", async () => {
    const sword = equippedMelee();
    const actor = attacker({ items: [sword, bladeHost()] });
    captured.dice = [80, 20];

    await _performParry(actor, 0, "", 1, false, true);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Один Против Сотни: Преимущество, отброшено 80");
    expect(card).toContain("<b>20</b>");
  });

  it("атакующий не Орда — один бросок как раньше", async () => {
    const sword = equippedMelee();
    const actor = attacker({ items: [sword, bladeHost()] });
    captured.nextRoll = 10;

    await _performParry(actor, 0, "", 1, false, false);

    expect(captured.chat.at(-1).content).not.toContain("Один Против Сотни");
  });
});
