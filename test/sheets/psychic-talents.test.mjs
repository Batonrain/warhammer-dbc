// test/sheets/psychic-talents.test.mjs
//
// Таланты Псайканы главы 3 в самой манифестации (Sahara 3-28): Фокус Техники,
// Психическая Злоба, Необременённый, Психическое Возрождение, Варповый Шёпот,
// Исчисления, Любимец Варпа, Проводник Варпа, Взгляд в Бездну. Чистая логика —
// rules/psyker-talents.mjs; здесь проверено, что executePsychotest и окно её
// зовут и что число в окне совпадает с числом на карточке.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { executePsychotest, showManifestDialog, wirePsyManifestPreview } from "../../module/sheets/tabs/psychic.mjs";
import { raceTarget } from "../../module/rules/talent-targets.mjs";

const talent = (name, system = {}) => ({ id: name, type: "talent", name, system, flags: {}, getFlag: () => undefined });
const hatred = (...targets) => talent("Hatred / Ненависть", { targets });
const ORK = raceTarget("ork", "Орк");

function power(extra = {}) {
  const it = { id: "p1", name: "Взор Варпа / Warp Gaze", type: "psychicPower",
    system: { testChar: "wp", powerType: "utility", testMod: 0, ...extra }, updates: [],
    update: async d => { it.updates.push(d); return d; } };
  return it;
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  let o = obj;
  for (const k of keys.slice(0, -1)) o = (o[k] ??= {});
  o[keys.at(-1)] = value;
}

function actor(items = [], { psyker = {}, fate = 3, cls = "bound" } = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const flags = {};
  const a = {
    id: "actor-1", name: "Псайкер", uuid: "Actor.actor-1", type: "character", items: list, updates: [],
    getFlag: (s, k) => flags[`${s}.${k}`], setFlag: async (s, k, v) => { flags[`${s}.${k}`] = v; },
    unsetFlag: async (s, k) => { delete flags[`${s}.${k}`]; },
    system: {
      race: "human", fatigue: { value: 0 }, fate: { value: fate, max: 5 },
      psyker: { rating: 9, currentRating: 9, sustain: 0, class: cls, ...psyker },
      skills: {}, corruption: { value: 0 }, corruptionBonus: 0,
      actionPoints: { value: 9, max: 9 },   // манифестация в бою списывает ОД по действию силы (пачка I3)
      wounds: { value: 8, max: 10, critical: 0 },
      characteristics: { wp: { total: 40, value: 40, bonus: 4 }, int: { total: 40, bonus: 4 } }
    },
    update: async d => { a.updates.push(d); for (const [k, v] of Object.entries(d)) setPath(a, k, v); return d; },
    updateEmbeddedDocuments: async () => []
  };
  return a;
}

const opts = (mPR, mode, extra = {}) => ({ mPR, prMod: 0, mode, path: "", modifier: 0, eldar: false, pushChoice: 1,
  damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1, ...extra });

const chatText = () => captured.chat.map(m => String(m.content ?? "")).join("\n");
/** Порог психотеста, как его печатает карточка. */
const shownThreshold = () => Number(/<label>Порог<\/label><b>(-?\d+)<\/b>/.exec(chatText())?.[1] ?? NaN);
/** Модификатор броска Феномена: формула «1d100 + N». */
const phenMods = () => captured.rolls.map(f => /^1d100 \+ (-?\d+)$/.exec(f)?.[1]).filter(v => v != null).map(Number);

async function cast(a, p, o) {
  captured.chat.length = 0;
  captured.rolls.length = 0;
  captured.nextRoll = 1;
  await executePsychotest(a, p, o);
}
const epr = p => p.updates.find(u => "system.sustainedEpr" in u)?.["system.sustainedEpr"];

beforeEach(() => { resetCaptured(); globalThis.game.user = { targets: new Set() }; globalThis.game.combat = undefined; });

describe("Фокус Техники", () => {
  it("+10 к психотесту выбранной силы (по скобкам в имени) и −10 к её Феноменам", async () => {
    const plain = actor();
    await cast(plain, power(), opts(9, "push"));
    const baseThr = shownThreshold(), baseMod = phenMods()[0];

    const a = actor([talent("Technique Focus (Warp Gaze)")]);
    await cast(a, power(), opts(9, "push"));
    expect(shownThreshold()).toBe(baseThr + 10);
    expect(phenMods()[0]).toBe(baseMod - 10);
    expect(chatText()).toContain("Фокус Техники");
  });

  it("выбранная сила — из поля Специализация; чужая сила Талант не получает", async () => {
    await cast(actor([talent("Technique Focus / Фокус Техники", { specialization: "Warp Gaze" })]), power(), opts(9, "normal"));
    expect(shownThreshold()).toBe(95);
    await cast(actor([talent("Technique Focus / Фокус Техники", { specialization: "Smite" })]), power(), opts(9, "normal"));
    expect(shownThreshold()).toBe(85);
  });

  it("выбор не сделан (пустая специализация) — Талант ничего не даёт", async () => {
    await cast(actor([talent("Technique Focus / Фокус Техники")]), power(), opts(9, "normal"));
    expect(shownThreshold()).toBe(85);
  });
});

describe("Психическая Злоба", () => {
  const spiteActor = () => actor([talent("Psychic Spite / Психическая Злоба"), hatred(ORK)]);
  const onOrk = () => { globalThis.game.user = { targets: new Set([{ actor: { type: "character", system: { race: "ork" } } }]) }; };
  const dmgPower = () => power({ powerType: "attack", damage: "1d10+PR", damageType: "energy", penetration: 0 });
  const dmgFormula = () => captured.rolls.find(f => /^1d10\+\d+$/.test(f));

  it("на Ненавистной цели «в психотесте»: порог +10 (2×5), эPR эффектов прежний", async () => {
    onOrk();
    const p = power();
    await cast(spiteActor(), p, opts(9, "normal", { spite: "test" }));
    expect(shownThreshold()).toBe(95);
    expect(epr(p)).toBe(9);
  });

  it("«в Dmg и Pen»: урон считается от эPR+2, порог прежний", async () => {
    onOrk();
    await cast(spiteActor(), dmgPower(), opts(9, "normal", { spite: "damage" }));
    expect(shownThreshold()).toBe(85);
    expect(dmgFormula()).toBe("1d10+11");
  });

  it("«в Dmg и Pen»: рейтинги свойств (Blast PR) надбавку Злобы НЕ получают", async () => {
    onOrk();
    const blastText = async spite => {
      await cast(spiteActor(), power({ powerType: "attack", damage: "1d10", damageType: "energy", penetration: 0,
        weaponProps: [{ key: "blast", rating: "PR" }] }), opts(9, "normal", { spite }));
      return /Взрывное \((\d+)\)/.exec(chatText().replace(/<[^>]+>/g, " "))?.[1];
    };
    const without = await blastText("");
    const withSpite = await blastText("damage");
    expect(withSpite).toBe(without);
    expect(without).toBe("9");
  });

  it("«в дальности»: Dmg прежний, а дальность считается от эPR+2", async () => {
    onOrk();
    await cast(spiteActor(), power({ range: "PR*10 м" }), opts(9, "normal", { spite: "range" }));
    expect(chatText()).toContain("Дальность: 11*10");
    expect(shownThreshold()).toBe(85);
  });

  it("не Ненавистная цель — надбавки нет, карточка говорит об этом", async () => {
    globalThis.game.user = { targets: new Set([{ actor: { type: "character", system: { race: "human" } } }]) };
    await cast(spiteActor(), power(), opts(9, "normal", { spite: "test" }));
    expect(shownThreshold()).toBe(85);
    expect(chatText()).toContain("не применена");
  });

  it("без Таланта — выбор из окна игнорируется", async () => {
    onOrk();
    await cast(actor([hatred(ORK)]), power(), opts(9, "normal", { spite: "test" }));
    expect(shownThreshold()).toBe(85);
  });
});

describe("Варповый Шёпот", () => {
  it("снимает X эPR и показывает −10×X на засекание; порог считается от сниженного эPR", async () => {
    const a = actor([talent("Warp Whisper / Варповый Шёпот")]);
    const p = power();
    await cast(a, p, opts(9, "normal", { whisper: 3 }));
    expect(epr(p)).toBe(6);
    expect(shownThreshold()).toBe(70);
    expect(chatText()).toContain("-30");
  });

  it("эPR не опускается ниже 1", async () => {
    const a = actor([talent("Warp Whisper / Варповый Шёпот")]);
    const p = power();
    await cast(a, p, opts(3, "normal", { whisper: 9 }));
    expect(epr(p)).toBe(1);
  });

  it("Безопасный режим — отдельная пометка: успешные тесты на засекание перебрасываются", async () => {
    const a = actor([talent("Warp Whisper / Варповый Шёпот")]);
    const p = power();
    await cast(a, p, opts(9, "safe", { whisper: 3 }));
    expect(epr(p)).toBe(2); // ½ от 9 вверх = 5, минус 3
    expect(chatText()).toContain("перебрасываются");
  });

  it("без Таланта X игнорируется", async () => {
    const p = power();
    await cast(actor(), p, opts(9, "normal", { whisper: 3 }));
    expect(epr(p)).toBe(9);
  });
});

describe("Исчисления", () => {
  const a = () => actor([talent("Innumerations / Исчисления")]);

  it("при Феномене и согласии: эPR эффектов −1, бросок Феномена −2×I.b", async () => {
    const bp = power();
    await cast(actor(), bp, opts(9, "push"));
    const baseMod = phenMods()[0];
    captured.confirmAnswer = true;
    const p = power();
    await cast(a(), p, opts(9, "push"));
    expect(epr(p)).toBe(epr(bp) - 1);
    expect(phenMods()[0]).toBe(baseMod - 8);
    expect(chatText()).toContain("Исчисления");
  });

  it("отказ — ничего не меняется", async () => {
    const p = power(); const bp = power();
    await cast(actor(), bp, opts(9, "push"));
    const baseMod = phenMods()[0];
    captured.confirmAnswer = false;
    await cast(a(), p, opts(9, "push"));
    expect(epr(p)).toBe(epr(bp));
    expect(phenMods()[0]).toBe(baseMod);
  });

  it("Феномена нет — вопроса нет", async () => {
    captured.confirmAnswer = true;
    captured.dialog = null;
    await cast(a(), power(), opts(9, "normal"));
    expect(captured.dialog).toBeNull();
  });
});

describe("Любимец Варпа", () => {
  it("два броска на Феномен — берётся меньший, второй показан", async () => {
    captured.dice = [1, 70, 20];
    captured.chat.length = 0;
    const a = actor([talent("Favoured by the Warp / Любимец Варпа")]);
    await executePsychotest(a, power(), opts(9, "push"));
    const t = chatText();
    expect(t).toContain("Любимец Варпа");
    expect(t).toContain("взят меньший");
    // Выбранным должен оказаться МЕНЬШИЙ из двух бросков (20 + мод), а не первый/больший.
    const mod = phenMods()[0];
    expect(t).toContain(`бросок ${20 + mod}`);
    expect(t).toContain(`отброшен ${70 + mod}`);
  });

  it("без Таланта — один бросок", async () => {
    captured.dice = [1, 20];
    await executePsychotest(actor(), power(), opts(9, "push"));
    expect(chatText()).not.toContain("Любимец Варпа");
  });
});

describe("Проводник Варпа", () => {
  const a = () => actor([talent("Warp Conduit / Проводник Варпа")]);

  it("Усиленный режим: −1 ОБ, +1d5 к эPR эффектов (не порогу), +30 к Феномену", async () => {
    const bp = power();
    await cast(actor(), bp, opts(9, "push"));
    const baseThr = shownThreshold(), baseMod = phenMods()[0];
    captured.dice = [4, 1, 20]; // d5 Проводника бросается до психотеста
    captured.chat.length = 0; captured.rolls.length = 0;
    const ac = a(); const p = power();
    await executePsychotest(ac, p, opts(9, "push", { conduit: true }));
    expect(ac.system.fate.value).toBe(2);
    expect(shownThreshold()).toBe(baseThr);
    expect(epr(p)).toBe(epr(bp) + 4);
    expect(phenMods()[0] ?? 0).toBe(baseMod + 30);
  });

  it("не Усиленный режим — не применяется и Очко не тратится", async () => {
    const ac = a();
    await cast(ac, power(), opts(9, "normal", { conduit: true }));
    expect(ac.system.fate.value).toBe(3);
    expect(chatText()).toContain("только в Усиленном");
  });

  it("нет Очков Бесчестия — не применяется", async () => {
    const ac = actor([talent("Warp Conduit / Проводник Варпа")], { fate: 0 });
    const p = power();
    await cast(ac, p, opts(9, "push", { conduit: true }));
    expect(captured.warnings.length).toBeGreaterThan(0);
    expect(epr(p)).toBe(12); // 9 + Усиление 3, без d5
  });
});

describe("Необременённый и Психическое Возрождение: потолок mPR", () => {
  const sustained = { psyker: { rating: 9, currentRating: 6, sustain: 3 } };

  it("окно: без Талантов предел тPR 6; Необременённый на эту силу — весь бПР 9", () => {
    showManifestDialog(actor([], sustained), power());
    const without = captured.dialog.content;
    expect(without).not.toContain('<option value="7"');
    showManifestDialog(actor([talent("Unburdened / Необременённый", { specialization: "Warp Gaze" })], sustained), power());
    expect(captured.dialog.content).toContain('<option value="9" selected');
    expect(captured.dialog.content).toContain("Необременённый");
  });

  it("Необременённый не работает, если эта сила уже поддерживается", () => {
    showManifestDialog(actor([talent("Unburdened / Необременённый", { specialization: "Warp Gaze" })], sustained),
      power({ isSustained: true }));
    expect(captured.dialog.content).not.toContain('<option value="9"');
  });

  it("Возрождение: пункты выше тPR помечены ценой", () => {
    showManifestDialog(actor([talent("Psychic Resurgence / Психическое Возрождение")], sustained), power());
    expect(captured.dialog.content).toContain("Психическое Возрождение (−1 ОБ)");
  });

  it("вне боя Возрождение действует только на эту манифестацию: метки нет", async () => {
    const a = actor([talent("Psychic Resurgence / Психическое Возрождение")], sustained);
    await cast(a, power(), opts(8, "normal"));
    expect(a.system.fate.value).toBe(2);
    expect(a.getFlag("warhammer-dbc", "psychicResurgenceActive")).toBeUndefined();
    expect(chatText()).toContain("только для этой манифестации");
  });

  it("в бою манифестация выше тPR платит Очко Бесчестия и ставит метку на Ход", async () => {
    globalThis.game.combat = { started: true, id: "c1" };
    const a = actor([talent("Psychic Resurgence / Психическое Возрождение")], sustained);
    await cast(a, power(), opts(8, "normal"));
    expect(a.system.fate.value).toBe(2);
    expect(a.getFlag("warhammer-dbc", "psychicResurgenceActive")).toBeTruthy();
    // Пока метка стоит — потолок бПР, второго Очка не нужно.
    await cast(a, power(), opts(9, "normal"));
    expect(a.system.fate.value).toBe(2);
  });

  // Ревью #554: метку гасит только начало своего Хода в бою; бой кончился раньше — она оставалась
  // и поднимала потолок бесплатно навсегда.
  it("метка Возрождения живёт только в том бою, где куплена: после боя и в новом бою потолок снова тPR", async () => {
    globalThis.game.combat = { started: true, id: "c1" };
    const a = actor([talent("Psychic Resurgence / Психическое Возрождение")], sustained);
    await cast(a, power(), opts(8, "normal"));
    expect(a.system.fate.value).toBe(2);
    globalThis.game.combat = undefined;
    await cast(a, power(), opts(8, "normal"));
    expect(a.system.fate.value).toBe(1);
    globalThis.game.combat = { started: true, id: "c2" };
    showManifestDialog(a, power());
    expect(captured.dialog.content).toContain("Психическое Возрождение (−1 ОБ)");
  });

  it("в пределах тPР Очко не тратится", async () => {
    const a = actor([talent("Psychic Resurgence / Психическое Возрождение")], sustained);
    await cast(a, power(), opts(6, "normal"));
    expect(a.system.fate.value).toBe(3);
    expect(a.getFlag("warhammer-dbc", "psychicResurgenceActive")).toBeUndefined();
  });

  it("нет Очков Бесчестия — манифестации нет", async () => {
    const a = actor([talent("Psychic Resurgence / Психическое Возрождение")], { ...sustained, fate: 0 });
    await cast(a, power(), opts(8, "normal"));
    expect(captured.chat.length).toBe(0);
    expect(captured.warnings.length).toBeGreaterThan(0);
  });
});

describe("Психическая Точность", () => {
  const shoot = () => power({ powerType: "psychicShoot", damage: "1d10+PR", damageType: "energy", penetration: 0 });
  const a = () => actor([talent("Psychic Precision / Психическая Точность")]);

  it("часть тела: −2 эPR, попадание в выбранное место", async () => {
    const p = shoot();
    await cast(a(), p, opts(9, "normal", { precision: "part", precisionLoc: "Голова" }));
    expect(epr(p)).toBe(7);
    expect(chatText()).toContain('data-hit-location="Голова"');
    expect(captured.rolls.some(f => f === "1d10+7")).toBe(true);
  });

  it("сочленения/глаза: −4 эPR", async () => {
    const p = shoot();
    await cast(a(), p, opts(9, "normal", { precision: "fine", precisionLoc: "П. Рука" }));
    expect(epr(p)).toBe(5);
    expect(chatText()).toContain('data-hit-location="П. Рука"');
  });

  it("не хватает эPR (после снятия меньше 1) — выбор не применяется, место Торс", async () => {
    const p = shoot();
    await cast(a(), p, opts(2, "normal", { precision: "part", precisionLoc: "Голова" }));
    expect(epr(p)).toBe(2);
    expect(chatText()).toContain('data-hit-location="Торс"');
    expect(chatText()).toContain("не применена");
  });

  it("не стрелковая сила и сила без Таланта — Торс, эPR прежний", async () => {
    const p1 = power({ powerType: "attack", damage: "1d10+PR", damageType: "energy", penetration: 0 });
    await cast(a(), p1, opts(9, "normal", { precision: "part", precisionLoc: "Голова" }));
    expect(epr(p1)).toBe(9);
    const p2 = shoot();
    await cast(actor(), p2, opts(9, "normal", { precision: "part", precisionLoc: "Голова" }));
    expect(epr(p2)).toBe(9);
    expect(chatText()).toContain('data-hit-location="Торс"');
  });
});

describe("Взгляд в Бездну: Варп-Шок", () => {
  it("−1 Порчи за взятие (но не ниже нуля)", async () => {
    const plain = actor();
    await cast(plain, power(), opts(9, "push"));
    expect(plain.updates.some(u => u["system.corruption.value"] === 1)).toBe(true);

    const gaze = actor([talent("Gaze Into Abyss / Взгляд в Бездну")]);
    await cast(gaze, power(), opts(9, "push"));
    expect(gaze.updates.some(u => "system.corruption.value" in u)).toBe(false);
    expect(chatText()).toContain("Взгляд в Бездну −1");
  });
});

describe("окно манифестации: число в предпросмотре = число на карточке", () => {
  function html(vals) {
    const nodes = {};
    const node = sel => (nodes[sel] ??= { value: vals[sel] ?? "", textContent: "", style: {}, classList: { toggle() {}, remove() {}, add() {} },
      addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, checked: false, dataset: {} });
    return { root: { querySelector: node, querySelectorAll: () => [], closest: () => null }, nodes };
  }
  const meta = extra => ({ charVal: 40, charAbbr: "WP", powerMod: 0, natData: { pushBonusType: "fixed", pushBonus: 3, pushFormula: "", pushPhenType: "flat", pushPhenValue: 10, normalPhenMod: 0 },
    pathData: {}, dynBonus: {}, variantMods: [], isEldar: false, fatigue: 0, runeBase: 0, spiteBonus: 2, conduitFormula: "1d5", ...extra });
  const base = { "#psy-pr": "9", "#psy-pr-mod": "0", "#psy-mod": "0", "#psy-path": "", "#psy-variant": "-1", "#psy-push-bonus": "1", "#psy-rune-strike": "0" };

  function shown(vals, m, mode = "normal") {
    const { root, nodes } = html({ ...base, ...vals });
    nodes["#psy-mode"] = { value: mode, addEventListener() {} };
    wirePsyManifestPreview(root, m);
    return { thr: Number(nodes["#pm-thr"].textContent), epr: nodes["#pm-epr"].textContent };
  }

  it("Фокус Техники: +10 к порогу", () => {
    expect(shown({}, meta({})).thr).toBe(85);
    expect(shown({}, meta({ techFocus: true })).thr).toBe(95);
  });

  it("Шёпот снимает эPR, Злоба «в тесте» поднимает порог", () => {
    expect(shown({ "#psy-whisper": "3" }, meta({})).epr).toBe("6");
    expect(shown({ "#psy-whisper": "3" }, meta({})).thr).toBe(70);
    const spite = shown({ "#psy-spite": "test" }, meta({}));
    expect(spite.thr).toBe(95);
    expect(spite.epr).toContain("тест 11");
  });

  it("в окне и на карточке порог одинаков (Фокус + Шёпот + Злоба)", async () => {
    globalThis.game.user = { targets: new Set([{ actor: { type: "character", system: { race: "ork" } } }]) };
    const a = actor([talent("Technique Focus / Фокус Техники", { specialization: "Warp Gaze" }),
      talent("Warp Whisper / Варповый Шёпот"), talent("Psychic Spite / Психическая Злоба"), hatred(ORK)]);
    await cast(a, power(), opts(9, "normal", { whisper: 2, spite: "test" }));
    const fromCard = shownThreshold();
    const fromWindow = shown({ "#psy-whisper": "2", "#psy-spite": "test" }, meta({ techFocus: true })).thr;
    expect(fromCard).toBe(fromWindow);
  });
});
