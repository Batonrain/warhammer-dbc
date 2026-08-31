// test/combat/defense.test.mjs
//
// Контратака (стр. 12, Талант Counter Attack): успешное Парирование
// предлагает кнопку тут же ударить в ответ тем же оружием — только с
// Талантом (capability technique.counterAttack) и не чаще раза в Раунд.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { _performParry, _performDodge, COUNTER_ATTACK_CAPABILITY } from "../../module/combat/defense.mjs";
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

describe("_performParry: кнопка Контратаки", () => {
  it("без Таланта — кнопки нет, даже при удачном Парировании", async () => {
    const sword = equippedMelee();
    const actor = attacker({ items: [sword] });

    await _performParry(actor, 0, "Actor.attacker-1");

    const card = captured.chat.at(-1).content;
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
    const sword = equippedMelee();
    const actor = attacker({ items: [sword] });

    await _performParry(actor, 0, "Actor.attacker-1", 5);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Парирование успешно");
    expect(card).toContain("снимает 2 из 5 попаданий");
    expect(card).toContain("3 попадания всё ещё проходит");
    expect(card).not.toContain("Атака отражена");
  });

  it("Успех покрывает или превышает число попаданий — вся атака отражена", async () => {
    const sword = equippedMelee();
    const actor = attacker({ items: [sword] });

    await _performParry(actor, 0, "Actor.attacker-1", 2);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("снимает все 2 попадания");
    expect(card).toContain("Атака отражена");
  });

  it("Провал — ни одно из нескольких попаданий не снимается", async () => {
    captured.dice = [96];
    const sword = equippedMelee();
    const actor = attacker({ items: [sword] });

    await _performParry(actor, 0, "Actor.attacker-1", 5);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Парирование провалено");
    expect(card).toContain("Все 5 попаданий проходят");
  });

  it("одно попадание (по умолчанию) — текст как раньше, без счёта попаданий", async () => {
    const sword = equippedMelee();
    const actor = attacker({ items: [sword] });

    await _performParry(actor, 0, "Actor.attacker-1");

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Атака отражена");
    expect(card).not.toContain("снимает");
  });
});

// Дуэлянтское (стр. 73 Книги Аэльдари): +10 к Парированию — отдельная строка
// разбивки, не подписанная как «Защитное» (той же defBonus раньше делили на
// двоих без разметки источника).
describe("_performParry: бонус Дуэлянтского", () => {
  it("Дуэлянтское оружие добавляет +10 отдельной строкой «Дуэлянтское +10»", async () => {
    const sword = equippedMelee({ weaponProps: [{ key: "duelingWeapon", rating: 0, rating2: 0 }] });
    const actor = attacker({ items: [sword] });

    await _performParry(actor, 0, "Actor.attacker-1");

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Дуэлянтское +10");
    expect(card).not.toContain("Защитное");
  });

  it("Защитное и Дуэлянтское на одном оружии складываются и показаны раздельно", async () => {
    const sword = equippedMelee({ weaponProps: [
      { key: "duelingWeapon", rating: 0, rating2: 0 },
      { key: "defensive",     rating: 0, rating2: 0 }
    ] });
    const actor = attacker({ items: [sword] });

    await _performParry(actor, 0, "Actor.attacker-1");

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Защитное +15");
    expect(card).toContain("Дуэлянтское +10");
  });

  it("без Дуэлянтского строки в разбивке нет", async () => {
    const sword = equippedMelee();
    const actor = attacker({ items: [sword] });

    await _performParry(actor, 0, "Actor.attacker-1");

    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("Дуэлянтское");
  });
});

// Шаг За Шагом (стр. 73 Книги Аэльдари): +10 к Парированию безусловно —
// сам факт Парирования уже означает «в рукопашном бою».
describe("_performParry: бонус Шаг За Шагом", () => {
  it("оружие со Шаг За Шагом добавляет +10 отдельной строкой", async () => {
    const sword = equippedMelee({ weaponProps: [{ key: "stepByStep", rating: 0, rating2: 0 }] });
    const actor = attacker({ items: [sword] });

    await _performParry(actor, 0, "Actor.attacker-1");

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Шаг За Шагом +10");
  });

  it("Дуэлянтское и Шаг За Шагом на одном оружии складываются (+20) и показаны раздельно", async () => {
    const sword = equippedMelee({ weaponProps: [
      { key: "duelingWeapon", rating: 0, rating2: 0 },
      { key: "stepByStep",    rating: 0, rating2: 0 }
    ] });
    const actor = attacker({ items: [sword] });

    await _performParry(actor, 0, "Actor.attacker-1");

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Дуэлянтское +10");
    expect(card).toContain("Шаг За Шагом +10");
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
