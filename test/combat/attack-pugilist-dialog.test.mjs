// test/combat/attack-pugilist-dialog.test.mjs
//
// Окно атаки и Таланты Пугилиста (Sahara 3-eddb): живой «Бросок!» через captured.press.
//   Направляющий Удар — штраф −20 попадает в порог;
//   Тяжёлый Хук — «Обе руки» несовместимы с ним, а после него в этом Ходу закрыты;
//   Удар с Колена — пинок Стандартной Базой, автоматическое попадание, место торс/голова, бесплатно,
//   отметка «раз на карточку» ставится броском.
// Логика — rules/pugilist-talents.mjs, combat/pugilist-strikes.mjs; здесь только то, что делает сам диалог.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { HAYMAKER_FORFEIT_FLAG } from "../../module/rules/pugilist-talents.mjs";
import { KNEE_STRIKE_CARD_FLAG } from "../../module/combat/pugilist-strikes.mjs";

const NS = "warhammer-dbc";
const byName = name => ({ id: "t-" + name, name, type: "talent", system: {} });
const HAY = "Haymaker / Тяжёлый Хук";
const GOAD = "Goading Strike / Направляющий Удар";
const KNEE = "Knee Strike / Удар с Колена";

const foe = { id: "foe", uuid: "Actor.foe", name: "Враг", system: {}, items: [], getFlag: () => undefined };

function boxer(items, { flags = {} } = {}) {
  const fist = weaponFor({ weaponClass: "melee", meleeCategory: "Кулаки", grips: "Кист", damage: "1d5", balance: -1, equipped: true },
    { id: "fist", name: "Fist / Удар кулаком", flags: { [`${NS}.integralAttack`]: true } });
  const kick = weaponFor({ weaponClass: "melee", meleeCategory: "", grips: "Ног", damage: "1d5-1", balance: -2, equipped: true },
    { id: "kick", name: "Kick / Пинок", flags: { [`${NS}.integralAttack`]: true } });
  const a = actorFor({ items: [fist, kick, ...items], fatigue: { value: 0 }, aiming: "none",
    actionPoints: { value: 4, max: 4 },
    characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35) } });
  a.type = "character"; a.uuid = "Actor.boxer"; a.name = "Боксёр";
  const store = { ...flags };
  a.getFlag = (s, k) => store[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete store[`${s}.${k}`]; };
  a.update = async data => {
    for (const [path, value] of Object.entries(data)) {
      const keys = path.split("."); let n = a;
      for (const k of keys.slice(0, -1)) n = (n[k] ??= {});
      n[keys.at(-1)] = value;
    }
  };
  return { a, fist, kick };
}

const toggle = (key, checked = true) => ({ type: "checkbox", checked, value: "", dataset: { key }, addEventListener: () => {} });
const form = (toggles = [], extra = {}) => fakeForm(
  { "#atk-char": "ws", "#atk-modifier": "0", "#atk-aim": "", ...extra },
  toggles.length ? { ".atk-talent-toggle": toggles.map(k => toggle(k)) } : {});
const lastAttack = () => captured.chat.filter(m => /roll-technique-block|roll-threshold/.test(m.content ?? "")).at(-1)?.content ?? "";
const thresholdOf = html => Number(html.match(/<label>Порог<\/label><b>(-?\d+)<\/b>/)?.[1]);

beforeEach(() => {
  resetCaptured(); setTargets([foe]);
  globalThis.game.combat = { started: true, id: "c1", round: 1 };
  globalThis.game.time = { worldTime: 0 };
});
afterEach(() => { globalThis.game.combat = undefined; globalThis.game.messages = undefined; });

async function roll(a, weapon, opts, f) {
  const p = showAttackDialog(a, weapon, opts);
  captured.dice = [10, 3, 4, 4, 4];
  await captured.press("roll", f);
  captured.dismiss();
  await p;
}

describe("Направляющий Удар: −20 в пороге", () => {
  it("с галочкой порог на 20 ниже, чем без неё", async () => {
    const plain = boxer([byName(GOAD)]);
    await roll(plain.a, plain.fist, {}, form());
    const base = thresholdOf(lastAttack());
    resetCaptured(); setTargets([foe]);
    const goad = boxer([byName(GOAD)]);
    await roll(goad.a, goad.fist, {}, form(["goadingStrike"]));
    expect(thresholdOf(lastAttack())).toBe(base - 20);
  });

  it("без Таланта галочка в форме ничего не меняет", async () => {
    const plain = boxer([]);
    await roll(plain.a, plain.fist, {}, form());
    const base = thresholdOf(lastAttack());
    resetCaptured(); setTargets([foe]);
    const none = boxer([]);
    await roll(none.a, none.fist, {}, form(["goadingStrike"]));
    expect(thresholdOf(lastAttack())).toBe(base);
  });
});

describe("Тяжёлый Хук: отказ от второй руки", () => {
  it("Хук вместе с «Обе руки» — отказ, атаки нет, метка не ставится", async () => {
    const { a, fist } = boxer([byName(HAY), { id: "fist2", name: "Fist 2", type: "weapon", system: { weaponClass: "melee", equipped: true } }]);
    const p = showAttackDialog(a, fist, {});
    await captured.press("roll", form(["haymaker"], { "#atk-dual-wield": true, "#atk-off-hand": "fist2" }));
    expect(captured.chat.filter(m => /roll-technique-block/.test(m.content ?? ""))).toHaveLength(0);
    expect(a.getFlag(NS, HAYMAKER_FORFEIT_FLAG)).toBeUndefined();
    captured.dismiss();
    await p;
  });

  it("после Хука в этом Ходу «Обе руки» закрыты", async () => {
    const { a, fist } = boxer([byName(HAY), { id: "fist2", name: "Fist 2", type: "weapon", system: { weaponClass: "melee", equipped: true } }],
      { flags: { [`${NS}.${HAYMAKER_FORFEIT_FLAG}`]: true } });
    const p = showAttackDialog(a, fist, {});
    await captured.press("roll", form([], { "#atk-dual-wield": true, "#atk-off-hand": "fist2" }));
    expect(captured.chat.filter(m => /roll-technique-block/.test(m.content ?? ""))).toHaveLength(0);
    captured.dismiss();
    await p;
  });

  it("сам Хук одной рукой проходит и ставит метку отказа", async () => {
    const { a, fist } = boxer([byName(HAY)]);
    await roll(a, fist, {}, form(["haymaker"]));
    expect(a.getFlag(NS, HAYMAKER_FORFEIT_FLAG)).toBe(true);
    expect(lastAttack()).toContain("Тяжёлый Хук");
  });
});

describe("Удар с Колена: окно атаки пинком", () => {
  // Локальная отметка card-once живёт в модуле между тестами — id карточки у каждого теста свой.
  let seq = 0;
  const sourceCard = () => {
    const flags = {};
    const m = { id: "m-knee-" + (++seq), isOwner: true, getFlag: (s, k) => flags[k], setFlag: async (s, k, v) => { flags[k] = v; } };
    globalThis.game.messages = new Map([[m.id, m]]);
    return m;
  };
  const pay = m => ({ label: "Удар с Колена", cardId: m.id, cardKey: KNEE_STRIKE_CARD_FLAG });

  it("авто-попадание при заведомо промазывающем броске, бесплатно: ОД не тратятся, лимит Атак не нужен", async () => {
    const { a, kick } = boxer([byName(KNEE)]);
    a.setFlag = a.setFlag.bind(a);
    await a.setFlag(NS, "attackActionsThisTurn", 1);
    const m = sourceCard();
    const p = showAttackDialog(a, kick, { forceBase: "standard", kneeStrike: { head: false }, payOnRoll: pay(m) });
    captured.dice = [99, 3, 4, 4, 4];
    await captured.press("roll", form());
    await p;
    const html = lastAttack();
    expect(html).toContain("Применить урон 1");
    expect(a.system.actionPoints.value).toBe(4);
    expect(m.getFlag(NS, KNEE_STRIKE_CARD_FLAG)).toBe(true);
    expect(html).toContain("Торс");
  });

  it("в голову: место попадания — Голова, свойство Оглушающее (0)", async () => {
    const { a, kick } = boxer([byName(KNEE)]);
    const m = sourceCard();
    const p = showAttackDialog(a, kick, { forceBase: "standard", kneeStrike: { head: true }, payOnRoll: pay(m) });
    captured.dice = [99, 3, 4, 4, 4];
    await captured.press("roll", form());
    await p;
    const html = lastAttack();
    expect(html).toContain("Голова");
    expect(html).toContain("Оглушающее (0)");
  });

  it("повторное окно с той же карточки — отказ (отметка уже стоит)", async () => {
    const { a, kick } = boxer([byName(KNEE)]);
    const m = sourceCard();
    await m.setFlag(NS, KNEE_STRIKE_CARD_FLAG, true);
    const p = showAttackDialog(a, kick, { forceBase: "standard", kneeStrike: { head: false }, payOnRoll: pay(m) });
    await captured.press("roll", form());
    expect(captured.chat.filter(m2 => /roll-technique-block/.test(m2.content ?? ""))).toHaveLength(0);
    captured.dismiss();
    await p;
  });
});
