// test/sheets/tech-coil-transfers.test.mjs
//
// Пачка J, Техномистик (Sahara 3-2501): Катушка Апокрифа (перенос и зарядка),
// Облачная Когниция и Мотивное Причастие (запись в чужого актора через ГМ-релей).
// Чистая арифметика — rules/technomystic-resources.mjs; здесь проверено, что
// лист (sheets/tabs/tech.mjs) и релей (combat/gm-relay.mjs) её зовут и платят
// ровно столько, сколько реально перешло.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { apocryphaTransfer, coilCharge, cloudCognition, motiveEucharist } from "../../module/sheets/tabs/tech.mjs";
import { checkTargetWrite, performTargetWrite, writeToTarget } from "../../module/combat/gm-relay.mjs";
import { TURN_SCOPED_FLAG_KEYS } from "../../module/rules/turn-flags.mjs";

const talent = name => ({ id: name, type: "talent", name, system: {}, flags: {}, getFlag: () => undefined });
const APOC = "Apocrypha Coil / Катушка Апокрифа";
const CLOUD = "Cloud Cognition / Облачная Когниция";
const MOTIVE = "Motive Eucharist / Мотивное Причастие";

/** Подставной актор: update раскладывает «a.b.c» по вложенным объектам, флаги — в таблице. */
function actor({ name = "Техножрец", items = [], system = {}, uuid = "Actor.a", token = null } = {}) {
  const flags = {};
  const a = {
    id: uuid, name, uuid, type: "character", items, isOwner: true, updates: [],
    system: {
      cognition: { value: 6, max: 10, regen: 2 },
      energy: { value: 5, max: 0, maxTotal: 8 },
      apocryphaEnergy: { value: 1, max: 4 },
      noosphereConnected: true,
      characteristics: { int: { total: 40, bonus: 4 } },
      skills: { techUse: { total: 40 } },
      ...system
    },
    getFlag: (s, k) => flags[`${s}.${k}`],
    setFlag: async (s, k, v) => { flags[`${s}.${k}`] = v; },
    unsetFlag: async (s, k) => { delete flags[`${s}.${k}`]; },
    getActiveTokens: () => (token ? [token] : []),
    update: async u => {
      a.updates.push(u);
      for (const [k, v] of Object.entries(u)) {
        if (k.startsWith("flags.")) { flags[k.slice(6).replace(/^([^.]+)\./, "$1.")] = v; continue; }
        const keys = k.split("."); let o = a;
        for (const kk of keys.slice(0, -1)) o = (o[kk] ??= {});
        o[keys.at(-1)] = v;
      }
    }
  };
  return a;
}
const chatText = () => captured.chat.map(m => String(m.content ?? "")).join("\n");
const okRoll = async () => ({ success: true, deg: 1 });
const failRoll = async () => ({ success: false, deg: 1 });
// Координаты — в клетках (1 клетка = 1 м, сетка 100 px).
const tokenAt = (cx, cy, a) => { const x = cx * 100, y = cy * 100;
  return { x, y, width: 1, height: 1, actor: a, document: { x, y, width: 1, height: 1, actor: a } }; };

beforeEach(() => {
  resetCaptured();
  globalThis.game.user = { targets: new Set(), isGM: false };
  globalThis.game.combat = undefined;
  globalThis.game.users = { activeGM: { id: "gm" } };
  captured.socket = [];
  globalThis.game.socket = { emit: (_event, p) => captured.socket.push(p) };
  globalThis.canvas = { grid: { size: 100, distance: 1 }, scene: { grid: { distance: 1 } } };
});

// ── Катушка Апокрифа ─────────────────────────────────────────────────────────
describe("Катушка Апокрифа: перенос ⚡ (полудействие)", () => {
  const run = async (a, direction, n) => {
    const p = apocryphaTransfer(a);
    await captured.press(direction, fakeForm({ '[name="n"]': String(n) }));
    await p;
  };

  it("в Апокрифу: основная теряет, Апокрифа получает; карточка в чате", async () => {
    const a = actor({ items: [talent(APOC)] });
    await run(a, "toApocrypha", 2);
    expect(a.system.energy.value).toBe(3);
    expect(a.system.apocryphaEnergy.value).toBe(3);
    expect(chatText()).toContain("Катушка Апокрифа");
  });

  it("из Апокрифы: ограничено её зарядом", async () => {
    const a = actor({ items: [talent(APOC)] });
    await run(a, "fromApocrypha", 9);
    expect(a.system.apocryphaEnergy.value).toBe(0);
    expect(a.system.energy.value).toBe(6);
  });

  it("в бою тратит 1 ОД; не хватает ОД — ничего не переносится", async () => {
    globalThis.game.combat = { started: true };
    const a = actor({ items: [talent(APOC)], system: { actionPoints: { value: 0, max: 2 } } });
    await run(a, "toApocrypha", 1);
    expect(a.system.energy.value).toBe(5);
    expect(a.system.apocryphaEnergy.value).toBe(1);
    const b = actor({ items: [talent(APOC)], system: { actionPoints: { value: 2, max: 2 } } });
    await run(b, "toApocrypha", 1);
    expect(b.system.actionPoints.value).toBe(1);
    expect(b.system.apocryphaEnergy.value).toBe(2);
  });

  it("без Таланта или без места — отказ с объяснением, ОД не списываются", async () => {
    const none = actor();
    await apocryphaTransfer(none);
    expect(captured.dialog).toBeNull();
    const full = actor({ items: [talent(APOC)], system: { apocryphaEnergy: { value: 4, max: 4 } } });
    const p = apocryphaTransfer(full);
    await captured.press("toApocrypha", fakeForm({ '[name="n"]': "1" }));
    await p;
    expect(captured.warnings.join()).toMatch(/полн|мест/i);
    expect(full.system.energy.value).toBe(5);
  });
});

describe("Катушка Апокрифа: зарядка Электу-Индукторами", () => {
  it("успех: заряд идёт в Апокрифу (до её максимума), основная не меняется", async () => {
    const a = actor({ items: [talent(APOC)] });
    await coilCharge(a, async () => ({ success: true, deg: 2 }), { apocrypha: true });
    expect(a.system.apocryphaEnergy.value).toBe(3);
    expect(a.system.energy.value).toBe(5);
    await coilCharge(a, async () => ({ success: true, deg: 9 }), { apocrypha: true });
    expect(a.system.apocryphaEnergy.value).toBe(4);
  });

  it("обычная зарядка по-прежнему идёт в основную", async () => {
    const a = actor({ items: [talent(APOC)] });
    await coilCharge(a, async () => ({ success: true, deg: 2 }));
    expect(a.system.energy.value).toBe(7);
    expect(a.system.apocryphaEnergy.value).toBe(1);
  });

  it("провал или нет Таланта — Апокрифа не меняется", async () => {
    const a = actor({ items: [talent(APOC)] });
    await coilCharge(a, failRoll, { apocrypha: true });
    expect(a.system.apocryphaEnergy.value).toBe(1);
    const b = actor();
    await coilCharge(b, okRoll, { apocrypha: true });
    expect(b.system.apocryphaEnergy.value).toBe(1);
  });
});

// ── Облачная Когниция ────────────────────────────────────────────────────────
describe("Облачная Когниция: до 2 ⚙ подключённому союзнику", () => {
  const setup = (giverOver = {}, targetOver = {}) => {
    const giverTok = tokenAt(0, 0, null);
    const giver = actor({ items: [talent(CLOUD)], token: giverTok, ...giverOver });
    const target = actor({ name: "Союзник", uuid: "Actor.t", system: { cognition: { value: 1, max: 9, regen: 1 } }, ...targetOver });
    const tTok = tokenAt(1, 0, target);
    globalThis.game.user.targets = new Set([tTok]);
    return { giver, target };
  };
  const run = async (giver, roll = okRoll, n = 2) => {
    const p = cloudCognition(giver, roll);
    await captured.press("go", fakeForm({ '[name="n"]': String(n) }));
    await p;
  };

  it("успех: цель получает, передающий платит ровно переданное, метка «раз в Ход» не ставится вне боя", async () => {
    const { giver, target } = setup();
    await run(giver);
    expect(target.system.cognition.value).toBe(3);
    expect(giver.system.cognition.value).toBe(4);
    expect(chatText()).toContain("Облачная Когниция");
  });

  it("в бою: раз в Ход и ½I.b (окр.▲) в Раунд цели", async () => {
    globalThis.game.combat = { started: true };
    const { giver, target } = setup();
    await run(giver);                                   // 2 ⚙, I.b 4 → потолок 2
    expect(target.system.cognition.value).toBe(3);
    expect(target.getFlag("warhammer-dbc", "cloudCognitionReceived")).toEqual({ combat: "", n: 2 });
    expect(giver.getFlag("warhammer-dbc", "cloudCognitionThisTurn")).toBe(true);
    captured.warnings.length = 0;
    await cloudCognition(giver, okRoll);                // повтор в том же Ходу
    expect(captured.warnings.join()).toContain("уже использована");
    expect(giver.system.cognition.value).toBe(4);
  });

  it("цель уже получила потолок за Раунд — отказ до броска, ничего не списывается", async () => {
    globalThis.game.combat = { started: true };
    const { giver, target } = setup();
    await target.setFlag("warhammer-dbc", "cloudCognitionReceived", { combat: "", n: 2 });
    await cloudCognition(giver, okRoll);
    expect(captured.warnings.join()).toMatch(/Раунд/);
    expect(giver.system.cognition.value).toBe(6);
    expect(target.system.cognition.value).toBe(1);
  });

  it("потолок — ½I.b ЦЕЛИ (решение 27.10.2026): I.b цели 2 → за Раунд не больше 1, хоть у передающего I.b 4", async () => {
    globalThis.game.combat = { started: true };
    const { giver, target } = setup({}, { system: { cognition: { value: 1, max: 9, regen: 1 }, characteristics: { int: { total: 20, bonus: 2 } } } });
    await run(giver);
    expect(target.system.cognition.value).toBe(2);
    expect(giver.system.cognition.value).toBe(5);
  });

  it("счётчик прошлого боя не переживает конец боя: метка чужого боя не считается", async () => {
    globalThis.game.combat = { started: true, id: "new" };
    const { giver, target } = setup();
    await target.setFlag("warhammer-dbc", "cloudCognitionReceived", { combat: "old", n: 2 });
    await run(giver);
    expect(target.system.cognition.value).toBe(3);
    expect(target.getFlag("warhammer-dbc", "cloudCognitionReceived")).toEqual({ combat: "new", n: 2 });
  });

  it("пока шёл тест, у цели осталось места на 1 — платится ровно 1 ⚙, а не заказанные 2", async () => {
    const { giver, target } = setup();
    await run(giver, async () => { target.system.cognition.value = 8; return { success: true, deg: 1 }; });
    expect(target.system.cognition.value).toBe(9);
    expect(giver.system.cognition.value).toBe(5);
  });

  it("провал теста Tech-Use+0 — ничего не передано, а попытка в бою потрачена", async () => {
    globalThis.game.combat = { started: true };
    const { giver, target } = setup();
    await run(giver, failRoll);
    expect(target.system.cognition.value).toBe(1);
    expect(giver.system.cognition.value).toBe(6);
    expect(giver.getFlag("warhammer-dbc", "cloudCognitionThisTurn")).toBe(true);
  });

  it("не подключён к Ноосфере (он или цель), цель вне радиуса I×2 м, нет цели/Таланта — отказ", async () => {
    let s = setup({ system: { noosphereConnected: false } });
    await cloudCognition(s.giver, okRoll);
    expect(captured.warnings.join()).toContain("Ноосфер");
    s = setup({}, { system: { noosphereConnected: false } });
    captured.warnings.length = 0;
    await cloudCognition(s.giver, okRoll);
    expect(captured.warnings.join()).toContain("Ноосфер");
    // I = 40 → радиус 80 м; цель в 200 клетках по 1 м
    const far = setup();
    globalThis.game.user.targets = new Set([tokenAt(200, 0, far.target)]);
    captured.warnings.length = 0;
    await cloudCognition(far.giver, okRoll);
    expect(captured.warnings.join()).toMatch(/радиус/);
    expect(far.target.system.cognition.value).toBe(1);
    const lone = actor({ items: [talent(CLOUD)] });
    globalThis.game.user.targets = new Set();
    captured.warnings.length = 0;
    await cloudCognition(lone, okRoll);
    expect(captured.warnings.join()).toMatch(/цел/i);
    const no = actor();
    captured.dialog = null;
    await cloudCognition(no, okRoll);
    expect(captured.dialog).toBeNull();
  });

  it("чужая цель (не владелец): запись уходит ГМу сокетом, передающий платит", async () => {
    const { giver, target } = setup();
    target.isOwner = false;
    await run(giver);
    expect(target.system.cognition.value).toBe(1);        // здесь не записано
    expect(captured.socket).toHaveLength(1);
    expect(captured.socket[0].op).toEqual({ kind: "grantCognition", amount: 2 });
    expect(captured.socket[0].targetUuid).toBe("Actor.t");
    expect(giver.system.cognition.value).toBe(4);
  });

  it("чужая цель, а ГМа в игре нет — запись невозможна: передающий не платит", async () => {
    const { giver, target } = setup();
    target.isOwner = false;
    globalThis.game.users = { activeGM: null };
    await run(giver);
    expect(giver.system.cognition.value).toBe(6);
  });
});

// ── Мотивное Причастие ───────────────────────────────────────────────────────
describe("Мотивное Причастие: до 3 ⚡ в Катушки цели в базовом контакте", () => {
  const setup = (giverOver = {}, targetOver = {}) => {
    const giver = actor({ items: [talent(MOTIVE)], token: tokenAt(0, 0, null), ...giverOver });
    const target = actor({ name: "Брат", uuid: "Actor.t",
      system: { energy: { value: 1, max: 0, maxTotal: 4 }, apocryphaEnergy: { value: 0, max: 0 } }, ...targetOver });
    globalThis.game.user.targets = new Set([tokenAt(1, 0, target)]);
    return { giver, target };
  };
  const run = async (giver, n = 3) => {
    const p = motiveEucharist(giver);
    await captured.press("go", fakeForm({ '[name="n"]': String(n) }));
    await p;
  };

  it("своя Энергия ⚡ (не Когниция) переходит в основную Катушку цели", async () => {
    const { giver, target } = setup();
    await run(giver);
    expect(target.system.energy.value).toBe(4);
    expect(giver.system.energy.value).toBe(2);
    expect(giver.system.cognition.value).toBe(6);       // Когниция не тронута
    expect(chatText()).toContain("Мотивное Причастие");
  });

  it("излишек уходит в Апокрифу цели", async () => {
    const { giver, target } = setup({}, { items: [talent(APOC)],
      system: { energy: { value: 3, max: 0, maxTotal: 4 }, apocryphaEnergy: { value: 0, max: 4 } } });
    await run(giver);
    expect(target.system.energy.value).toBe(4);
    expect(target.system.apocryphaEnergy.value).toBe(2);
    expect(giver.system.energy.value).toBe(2);
  });

  it("в бою — раз в Ход", async () => {
    globalThis.game.combat = { started: true };
    const { giver } = setup();
    await run(giver, 1);
    captured.warnings.length = 0;
    await motiveEucharist(giver);
    expect(captured.warnings.join()).toContain("уже использовано");
    expect(giver.system.energy.value).toBe(4);
  });

  it("цель не в базовом контакте / нет Катушки у цели / нет своих ⚡ — отказ", async () => {
    const far = setup();
    globalThis.game.user.targets = new Set([tokenAt(5, 0, far.target)]);
    await motiveEucharist(far.giver);
    expect(captured.warnings.join()).toMatch(/контакт/);
    expect(far.target.system.energy.value).toBe(1);

    const full = setup({}, { system: { energy: { value: 4, max: 0, maxTotal: 4 }, apocryphaEnergy: { value: 0, max: 0 } } });
    captured.warnings.length = 0;
    await motiveEucharist(full.giver);
    expect(captured.warnings.join()).toMatch(/полн|мест/i);

    const dry = setup({ system: { energy: { value: 0, max: 0, maxTotal: 8 } } });
    captured.warnings.length = 0;
    await motiveEucharist(dry.giver);
    expect(captured.warnings.join()).toContain("⚡");
  });

  it("чужая цель: запись уходит ГМу сокетом, свои ⚡ списаны", async () => {
    const { giver, target } = setup();
    target.isOwner = false;
    await run(giver, 2);
    expect(captured.socket[0].op).toEqual({ kind: "grantEnergy", amount: 2 });
    expect(giver.system.energy.value).toBe(3);
    expect(target.system.energy.value).toBe(1);
  });
});

// ── ГМ-релей ─────────────────────────────────────────────────────────────────
describe("ГМ-релей: grantCognition / grantEnergy", () => {
  const ini = (...names) => ({ items: names.map(talent), system: { noosphereConnected: true, characteristics: { int: { bonus: 4 } } } });
  const tgt = (over = {}) => actor({ uuid: "Actor.t", name: "Цель", ...over });

  it("пропускает только своему Таланту, целое число в пределах и подключённую цель", () => {
    const ok = { initiatorOwned: true, initiator: ini(CLOUD), target: tgt() };
    expect(checkTargetWrite({ kind: "grantCognition", amount: 2 }, ok).ok).toBe(true);
    expect(checkTargetWrite({ kind: "grantCognition", amount: 3 }, ok).ok).toBe(false);
    expect(checkTargetWrite({ kind: "grantCognition", amount: 0 }, ok).ok).toBe(false);
    expect(checkTargetWrite({ kind: "grantCognition", amount: 1.5 }, ok).ok).toBe(false);
    expect(checkTargetWrite({ kind: "grantCognition", amount: 1, extra: 1 }, ok).ok).toBe(false);
    expect(checkTargetWrite({ kind: "grantCognition", amount: 1 }, { ...ok, initiator: ini(MOTIVE) }).ok).toBe(false);
    expect(checkTargetWrite({ kind: "grantCognition", amount: 1 }, { ...ok, target: tgt({ system: { noosphereConnected: false } }) }).ok).toBe(false);
    expect(checkTargetWrite({ kind: "grantCognition", amount: 1 }, { ...ok, initiatorOwned: false }).ok).toBe(false);

    const okE = { initiatorOwned: true, initiator: ini(MOTIVE), target: tgt() };
    expect(checkTargetWrite({ kind: "grantEnergy", amount: 3 }, okE).ok).toBe(true);
    expect(checkTargetWrite({ kind: "grantEnergy", amount: 4 }, okE).ok).toBe(false);
    expect(checkTargetWrite({ kind: "grantEnergy", amount: 1 }, { ...okE, initiator: ini(CLOUD) }).ok).toBe(false);
  });

  it("инициатор не в Ноосфере — Облачная Когниция отклонена", () => {
    const bad = { ...ini(CLOUD), system: { noosphereConnected: false, characteristics: { int: { bonus: 4 } } } };
    expect(checkTargetWrite({ kind: "grantCognition", amount: 1 }, { initiatorOwned: true, initiator: bad, target: tgt() }).ok).toBe(false);
  });

  it("ГМ сам пересчитывает по данным цели: потолок Раунда и свободное место", async () => {
    globalThis.game.combat = { started: true };
    const t = tgt({ system: { cognition: { value: 8, max: 9, regen: 1 } } });
    await performTargetWrite(t, { kind: "grantCognition", amount: 2 }, ini(CLOUD));
    expect(t.system.cognition.value).toBe(9);           // место для одной
    expect(t.getFlag("warhammer-dbc", "cloudCognitionReceived")).toEqual({ combat: "", n: 1 });
    await performTargetWrite(t, { kind: "grantCognition", amount: 2 }, ini(CLOUD));
    expect(t.system.cognition.value).toBe(9);
    const e = tgt({ system: { energy: { value: 3, max: 0, maxTotal: 4 } } });
    await performTargetWrite(e, { kind: "grantEnergy", amount: 3 }, ini(MOTIVE));
    expect(e.system.energy.value).toBe(4);
  });

  it("ГМ: цель уже набрала потолок Раунда — ⚙ не добавляются, хоть место есть", async () => {
    globalThis.game.combat = { started: true };
    const t = tgt({ system: { cognition: { value: 1, max: 9, regen: 1 } } });
    await t.setFlag("warhammer-dbc", "cloudCognitionReceived", { combat: "", n: 2 });
    await performTargetWrite(t, { kind: "grantCognition", amount: 2 }, ini(CLOUD));
    expect(t.system.cognition.value).toBe(1);
  });

  it("ГМ: потолок считается от I.b цели, а не передающего", async () => {
    globalThis.game.combat = { started: true };
    const t = tgt({ system: { cognition: { value: 1, max: 9, regen: 1 }, characteristics: { int: { bonus: 2 } } } });
    await performTargetWrite(t, { kind: "grantCognition", amount: 2 }, ini(CLOUD));
    expect(t.system.cognition.value).toBe(2);
  });

  it("свой/ГМ пишет сам, без сокета", async () => {
    const t = tgt({ system: { cognition: { value: 1, max: 9, regen: 1 } } });
    expect(await writeToTarget(t, { kind: "grantCognition", amount: 2 }, ini(CLOUD))).toBe(true);
    expect(t.system.cognition.value).toBe(3);
    expect(captured.socket).toHaveLength(0);
  });
});

describe("метки Хода гаснут сами", () => {
  it("cloudCognitionThisTurn, motiveEucharistThisTurn и cloudCognitionReceived есть в реестре сроков", () => {
    for (const k of ["cloudCognitionThisTurn", "motiveEucharistThisTurn", "cloudCognitionReceived"])
      expect(TURN_SCOPED_FLAG_KEYS).toContain(k);
  });
});
