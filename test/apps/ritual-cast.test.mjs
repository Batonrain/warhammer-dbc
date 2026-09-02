// test/apps/ritual-cast.test.mjs
//
// module/apps/ritual-cast.mjs — математика порога и бросок Ритуала, вынесенные
// из GM-консоли «Завеса и Мистика» (module/apps/veil.mjs), чтобы их мог звать
// и диалог «Провести ритуал» на листе персонажа (29.08.2026, см. план
// dazzling-weaving-taco). Вкладка «Ритуалы» в окне Завесы временно оставлена
// рядом с диалогом для сравнения (решение пользователя) — переписана как
// тонкая обёртка над этой же математикой, без своего дублирующего расчёта;
// последний блок ниже проверяет именно эту обёртку.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { beforeEach, describe, it, expect } from "vitest";
import { applyRitualItem, buildRitualSkills, ritualPathOptions } from "../../module/constants/rituals.mjs";
import { ritualThreshold, castRitual, confirmUnmetRequirements, psykerMaxBonus }
  from "../../module/apps/ritual-cast.mjs";
import { VeilMystic } from "../../module/apps/veil.mjs";

beforeEach(() => { resetCaptured(); globalThis.game.user = {}; });

/** Актор с групповыми навыками: у каждой специализации своя строка. */
function actorFor({ groupSkills = {}, skills = {}, ...rest } = {}) {
  return {
    system: {
      characteristics: { int: { total: 40 }, wp: { total: 35 }, per: { total: 30 } },
      skills, groupSkills, ...rest
    }
  };
}

const ritual = system => ({ id: "rit-1", name: "Зов Малефика", type: "ritual", system });
const skillsOf = actor => buildRitualSkills(actor);

describe("подстановка ритуала-предмета (applyRitualItem)", () => {
  const scholar = actorFor({
    groupSkills: {
      forbiddenLore: [
        { specialty: "Демоны", total: 38, rank: "knows",   char: "int" },
        { specialty: "Варп",   total: 45, rank: "adept",   char: "int" }
      ]
    },
    skills: { awareness: { total: 41, rank: "knows" } }
  });

  it("групповой навык берёт СВОЮ специализацию, а не первую попавшуюся", () => {
    const applied = applyRitualItem(scholar, ritual({
      testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Warp",
      testChar: "int", testMod: -20
    }), skillsOf);

    const chosen = skillsOf(scholar).find(s => s.value === applied.skillValue);
    expect(chosen.label).toContain("Варп");
  });

  it("нужной специализации у актора нет — берётся любая из той же группы", () => {
    const applied = applyRitualItem(scholar, ritual({
      testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Ересь"
    }), skillsOf);

    expect(applied.skillValue).toMatch(/^group:forbiddenLore:/);
  });

  it("группы у актора нет вовсе — навык не подставляется молча", () => {
    const applied = applyRitualItem(actorFor(), ritual({
      testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Warp"
    }), skillsOf);

    expect(applied.skillValue).toBe("");
  });

  it("обычный навык подставляется по ключу", () => {
    const applied = applyRitualItem(scholar, ritual({
      testSkillScope: "plain", testSkillKey: "awareness"
    }), skillsOf);

    expect(applied.skillValue).toBe("skill:awareness");
  });

  it("имя, характеристика и сложность переезжают в форму", () => {
    const applied = applyRitualItem(scholar, ritual({
      testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Warp",
      testChar: "wp", testMod: -30
    }), skillsOf);

    expect(applied.name).toBe("Зов Малефика");
    expect(applied.testChar).toBe("wp");
    expect(applied.gmMod).toBe(-30);
    expect(applied.itemId).toBe("rit-1");
  });

  it("пустой предмет даёт безопасные умолчания", () => {
    const applied = applyRitualItem(scholar, ritual({}), skillsOf);

    expect(applied.testChar).toBe("int");
    expect(applied.gmMod).toBe(0);
  });

  // Контентный тип предмета не определяет движковый сам по себе: у одной
  // категории книги встречаются и blessing, и summon, и binding.
  it("контентный тип ритуала (ritualType) движковый не подставляет", () => {
    const applied = applyRitualItem(scholar, ritual({ ritualType: "necromancy" }), skillsOf);

    expect(applied.type).toBeUndefined();
  });

  it("заполненный failureType подставляется как движковый тип", () => {
    const applied = applyRitualItem(scholar, ritual({ ritualType: "necromancy", failureType: "phenomenon" }), skillsOf);

    expect(applied.type).toBe("phenomenon");
  });

  it("модификатор Отвращения за Провал переезжает в форму, по умолчанию 5", () => {
    const withMod = applyRitualItem(scholar, ritual({ aversionPerFail: 10 }), skillsOf);
    expect(withMod.aversionPerFail).toBe(10);

    const withoutMod = applyRitualItem(scholar, ritual({}), skillsOf);
    expect(withoutMod.aversionPerFail).toBe(5);
  });

  it("extraMods предмета переезжают в форму как есть, по умолчанию пусто", () => {
    const withExtra = applyRitualItem(scholar, ritual({
      extraMods: [{ label: "С всадником", value: -20 }]
    }), skillsOf);
    expect(withExtra.extraMods).toEqual([{ label: "С всадником", value: -20 }]);

    const withoutExtra = applyRitualItem(scholar, ritual({}), skillsOf);
    expect(withoutExtra.extraMods).toEqual([]);
  });
});

describe("альтернативные пути проведения (ritualPathOptions)", () => {
  const scholar = actorFor({
    groupSkills: {
      forbiddenLore: [
        { specialty: "Demons", total: 38, rank: "knows", char: "int" },
        { specialty: "Warp",   total: 45, rank: "adept", char: "int" }
      ]
    }
  });

  it("нет rollPaths — только основной путь предмета", () => {
    const item = ritual({ testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Demons", testChar: "int", testMod: -20 });
    const paths = ritualPathOptions(scholar, item, skillsOf);

    expect(paths).toHaveLength(1);
    expect(paths[0].key).toBe("default");
    expect(paths[0].skillValue).toContain("forbiddenLore");
    expect(paths[0].gmMod).toBe(-20);
  });

  it("rollPaths добавляет альтернативы под РЕАЛЬНЫЕ навыки актёра", () => {
    const item = ritual({
      testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Demons", testChar: "int", testMod: -20,
      rollPaths: [{ scope: "group", key: "forbiddenLore", specialty: "Warp", char: "int", mod: -30 }]
    });
    const paths = ritualPathOptions(scholar, item, skillsOf);

    expect(paths).toHaveLength(2);
    expect(paths[1].key).toBe("alt:0");
    expect(paths[1].gmMod).toBe(-30);
    expect(paths[1].skillValue).toContain("1"); // индекс строки Warp у актёра
  });
});

describe("порог и гейт требований (ritualThreshold)", () => {
  const raceGroup = (...raceKeys) => ({
    id: "g", operator: "AND",
    entries: raceKeys.map((raceKey, n) => ({ id: `e${n}`, kind: "reqRace", raceKey }))
  });
  const ritualItem = (id, name, flags = {}) => ({
    id, name, type: "ritual", system: { testChar: "int", testMod: -20 },
    getFlag: (_scope, key) => flags[key]
  });
  const actor = (race = "human") => ({
    id: "act-1", name: "Каэль Ворн", type: "character",
    system: { race, characteristics: { int: { total: 40 } }, skills: {}, groupSkills: {} }
  });
  const baseR = over => ({
    name: "", type: "summon", skillValue: "", testChar: "int", gmMod: -20,
    assistants: 0, assistBonus: 10, summon: {}, curseFam: "close", curseSymp: {},
    numerology: {}, numMod: 0, psyker: false, psykerBonus: 0, aversionPerFail: 5, ...over
  });

  it("предмет не передан — гейта нет", () => {
    const d = ritualThreshold(baseR(), actor(), null);
    expect(d.reqOk).toBe(true);
  });

  it("требования не выполнены — гейт называет причину", () => {
    const item = ritualItem("r1", "Зов", { req: [raceGroup("drukhari")] });
    const d = ritualThreshold(baseR(), actor("human"), item);

    expect(d.reqOk).toBe(false);
    expect(d.reqFailed).toEqual(["Раса: Друкхари"]);
  });

  it("требования выполнены — гейт молчит", () => {
    const item = ritualItem("r1", "Зов", { req: [raceGroup("human")] });
    const d = ritualThreshold(baseR(), actor("human"), item);

    expect(d.reqOk).toBe(true);
  });

  // Требования к ассистентам проверяются по каждому помощнику отдельно, а не по
  // ритуалисту: гейт проведения на них не смотрит.
  it("требования к ассистентам порог не гейтят", () => {
    const item = ritualItem("r1", "Зов", { assistReq: [raceGroup("drukhari")] });
    const d = ritualThreshold(baseR(), actor("human"), item);

    expect(d.reqOk).toBe(true);
  });

  it("жертва ассистентов/призыв/псайкер/нумерология складываются в порог и в разбивку", () => {
    const a = actor();
    a.system.psyker = { rating: 4 };
    const d = ritualThreshold(baseR({
      gmMod: -20, assistants: 2, assistSacrificed: 2, assistBonus: 10, psyker: true, psykerBonus: 5, numMod: 15,
      summon: { trueName: true }
    }), a, null);

    // −20 (нет навыка) + −20 (сложность) + 20 (жертва 2×10) + 30 (Истинное
    // Имя, RITUAL_SUMMON_MODS.trueName) + 5 (псайкер, не выше 2×4) + 15 (нумерология).
    expect(d.threshold).toBe(-20 - 20 + 20 + 30 + 5 + 15);
    expect(d.rows.some(r => r.label.includes("Жертва ассистентов"))).toBe(true);
  });

  // Ассистенты — те, кто присутствует; в жертву приносят не больше, чем их
  // вообще участвовало (стр. 393-425: бонус только за ПРИНЕСЁННЫХ в жертву).
  it("присутствие ассистентов без жертвы бонуса не даёт", () => {
    const d = ritualThreshold(baseR({ assistants: 3, assistSacrificed: 0, assistBonus: 10 }), actor(), null);
    expect(d.threshold).toBe(-20 - 20);
    expect(d.rows.some(r => r.label.includes("Жертва ассистентов"))).toBe(false);
  });

  it("жертва не может превысить число присутствующих ассистентов", () => {
    const d = ritualThreshold(baseR({ assistants: 1, assistSacrificed: 5, assistBonus: 10 }), actor(), null);
    // 1 (клампится к числу ассистентов) × 10, не 5×10.
    expect(d.threshold).toBe(-20 - 20 + 10);
  });

  it("псайкер-бонус клампится к 2×PR", () => {
    const a = actor();
    a.system.psyker = { rating: 2 };
    const d = ritualThreshold(baseR({ psyker: true, psykerBonus: 99 }), a, null);
    expect(d.prMax).toBe(4);
    expect(d.rows.find(r => r.label.includes("Псайкер")).val).toBe(4);
  });

  // extraMods — ситуативные модификаторы КОНКРЕТНОГО ритуала (из его же
  // прозы), поверх общих списков движка; extraSel — какие отмечены в форме.
  it("отмеченный extraMods добавляется в порог и в разбивку", () => {
    const d = ritualThreshold(baseR({
      extraMods: [{ label: "Ассистент принесён в жертву", value: 10 }, { label: "С всадником", value: -20 }],
      extraSel: { 0: true }
    }), actor(), null);

    // −20 (нет навыка) + −20 (сложность, умолчание baseR) + 10 (extraMods[0]).
    expect(d.threshold).toBe(-20 - 20 + 10);
    expect(d.rows.find(r => r.label === "Модификаторы ритуала").val).toBe(10);
  });

  it("невыбранный extraMods в порог не идёт", () => {
    const d = ritualThreshold(baseR({
      extraMods: [{ label: "С всадником", value: -20 }], extraSel: {}
    }), actor(), null);
    expect(d.threshold).toBe(-20 - 20);
    expect(d.rows.some(r => r.label === "Модификаторы ритуала")).toBe(false);
  });

  // Бестиарий скрыт от игрока — Inf демона вписывается вручную (ГМ называет
  // его за столом), но модификатор всё равно должен уйти в порог и подпись.
  it("Inf призываемого демона уходит штрафом −Inf в порог и в разбивку с именем", () => {
    const d = ritualThreshold(baseR({ demonName: "Кровожад", demonInf: 45 }), actor(), null);
    expect(d.threshold).toBe(-20 - 20 - 45);
    expect(d.rows.find(r => r.label.includes("−Inf")).label).toContain("Кровожад");
  });

  it("не summon-like тип — Inf демона в порог не идёт", () => {
    const d = ritualThreshold(baseR({ type: "circle", demonInf: 45 }), actor(), null);
    expect(d.threshold).toBe(-20 - 20);
    expect(d.rows.some(r => r.label.includes("−Inf"))).toBe(false);
  });

  it("демон не назван — модификатора нет даже при summon-like типе", () => {
    const d = ritualThreshold(baseR({ demonInf: 0 }), actor(), null);
    expect(d.rows.some(r => r.label.includes("−Inf"))).toBe(false);
  });
});

describe("максимум псайкер-бонуса (psykerMaxBonus)", () => {
  it("нет псайкера — 0", () => {
    expect(psykerMaxBonus({ system: {} })).toBe(0);
    expect(psykerMaxBonus(null)).toBe(0);
  });
  it("псайкер с PR даёт 2×PR", () => {
    expect(psykerMaxBonus({ system: { psyker: { rating: 3 } } })).toBe(6);
  });
});

describe("проведение ритуала (castRitual)", () => {
  const actor = () => ({ id: "act-1", name: "Каэль Ворн", type: "character",
    system: { characteristics: { int: { total: 40 } }, skills: {}, groupSkills: {} } });
  const baseR = over => ({
    name: "Тест", type: "summon", skillValue: "", testChar: "int", gmMod: -20,
    assistants: 0, assistBonus: 10, summon: {}, curseFam: "close", curseSymp: {},
    numerology: {}, numMod: 0, psyker: false, psykerBonus: 0, aversionPerFail: 5, ...over
  });

  it("актора нет — предупреждает и не бросает", async () => {
    const res = await castRitual(baseR(), null);
    expect(res).toBeNull();
    expect(captured.warnings.length).toBe(1);
    expect(captured.rolls).toEqual([]);
  });

  it("требования не выполнены и отклонены подтверждением — бросок не идёт", async () => {
    const item = { id: "r1", getFlag: (_s, k) => (k === "req"
      ? [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "reqRace", raceKey: "drukhari" }] }]
      : undefined) };
    const confirmUnmet = async () => false;
    const res = await castRitual(baseR(), actor(), { item, confirmUnmet });

    expect(res).toBeNull();
    expect(captured.rolls).toEqual([]);
    expect(captured.chat).toEqual([]);
  });

  it("требования не выполнены, но подтверждены — бросок идёт", async () => {
    const item = { id: "r1", getFlag: (_s, k) => (k === "req"
      ? [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "reqRace", raceKey: "drukhari" }] }]
      : undefined) };
    // Порог отрицателен (нет навыка), бросок провалится — на провал уходит
    // второй кубик (Отвращение Варпа по умолчанию), очередь на оба.
    captured.dice = [10, 10];
    const res = await castRitual(baseR(), actor(), { item, confirmUnmet: async () => true });

    expect(res).not.toBeNull();
    expect(captured.chat.length).toBe(1);
  });

  it("успех — карточка в чат, без Отвращения Варпа", async () => {
    // Нет навыка → база −20; при gmMod +50 порог +30, роль 1 гарантированно проходит.
    captured.dice = [1];
    const res = await castRitual(baseR({ gmMod: 50 }), actor());

    expect(res.success).toBe(true);
    expect(captured.chat[0].content).toContain("Ритуал удался");
    expect(captured.chat[0].content).not.toContain("Отвращение Варпа");
  });

  // Бестиарий скрыт от игрока — токен размещает ГМ (module/apps/demon-summon.mjs),
  // здесь проверяется только что castRitual зовёт переданный spawnDemonFn
  // ровно когда нужно: успех + движковый тип "summon" + названный демон.
  it("успех типа summon с demonName зовёт spawnDemonFn и подписывает карточку", async () => {
    captured.dice = [1];
    const calls = [];
    const spawnDemonFn = async (name, ritualistUuid) => calls.push({ name, ritualistUuid });
    const a = actor(); a.uuid = "Actor.act-1";
    const res = await castRitual(baseR({ gmMod: 50, type: "summon", demonName: "Кровожад" }), a, { spawnDemonFn });

    expect(res.success).toBe(true);
    expect(calls).toEqual([{ name: "Кровожад", ritualistUuid: "Actor.act-1" }]);
    expect(captured.chat[0].content).toContain("Кровожад");
    expect(captured.chat[0].content).toContain("токен размещён");
  });

  it("успех типа dominion с demonName подписывает карточку, но токен не спавнит", async () => {
    captured.dice = [1];
    const calls = [];
    const spawnDemonFn = async (name) => calls.push(name);
    const res = await castRitual(baseR({ gmMod: 50, type: "dominion", demonName: "Кровожад" }), actor(), { spawnDemonFn });

    expect(res.success).toBe(true);
    expect(calls).toEqual([]);
    expect(captured.chat[0].content).toContain("Кровожад");
    expect(captured.chat[0].content).not.toContain("токен размещён");
  });

  // Dominator / Покоритель (wdbc-u0by): «Преимущество на тесты Демонического
  // Владычества» — только type==="dominion" И есть Талант, roll×2 + keepBest,
  // тот же приём, что у Уклонения/Парирования/OneAgainstAHundred/Electrovigour.
  const dominator = () => ({ type: "talent", name: "Dominator / Покоритель", system: {} });

  it("тип dominion + Талант Покоритель — два броска, лучший (меньший) взят", async () => {
    const a = actor();
    a.items = [dominator()];
    captured.dice = [80, 20];
    const res = await castRitual(baseR({ gmMod: 50, type: "dominion" }), a);

    expect(res.roll).toBe(20);
    expect(captured.chat[0].content).toContain("Покоритель: Преимущество, отброшено 80");
  });

  it("тип dominion, но нет Таланта — один бросок как раньше", async () => {
    const a = actor();
    captured.dice = [20];
    const res = await castRitual(baseR({ gmMod: 50, type: "dominion" }), a);

    expect(res.roll).toBe(20);
    expect(captured.chat[0].content).not.toContain("Покоритель");
  });

  it("есть Талант, но тип не dominion — Преимущество не применяется", async () => {
    const a = actor();
    a.items = [dominator()];
    captured.dice = [20];
    const res = await castRitual(baseR({ gmMod: 50, type: "summon" }), a);

    expect(res.roll).toBe(20);
    expect(captured.chat[0].content).not.toContain("Покоритель");
  });

  it("провал типа summon с demonName — spawnDemonFn не зовётся", async () => {
    captured.dice = [95, 40];
    const calls = [];
    const spawnDemonFn = async (name) => calls.push(name);
    const res = await castRitual(baseR({ gmMod: 0, type: "summon", demonName: "Кровожад" }), actor(), { spawnDemonFn });

    expect(res.success).toBe(false);
    expect(calls).toEqual([]);
  });

  it("демон не назван — spawnDemonFn не зовётся, подписи демона в карточке нет", async () => {
    captured.dice = [1];
    const calls = [];
    const spawnDemonFn = async (name) => calls.push(name);
    await castRitual(baseR({ gmMod: 50, type: "summon" }), actor(), { spawnDemonFn });

    expect(calls).toEqual([]);
    expect(captured.chat[0].content).not.toContain("Демон:");
  });

  // Состояния, наложенные ритуалом (item.system.conditionsGranted) — пилюли
  // draggable=true, чтобы ГМ перенёс их на лист подверженного актора; не
  // применяются автоматически (см. заголовок ritual-cast.mjs).
  it("успех с conditionsGranted — пилюли состояний в карточке, draggable", async () => {
    captured.dice = [1];
    const item = {
      id: "r1", getFlag: () => undefined,
      system: { conditionsGranted: [{ key: "blinded", level: 3, note: "на 1 час" }, { key: "deafened", level: 0, note: "" }] }
    };
    const res = await castRitual(baseR({ gmMod: 50 }), actor(), { item });

    expect(res.success).toBe(true);
    expect(captured.chat[0].content).toContain("Накладывает");
    expect(captured.chat[0].content).toContain('draggable="true"');
    expect(captured.chat[0].content).toContain("Ослеплён");
    expect(captured.chat[0].content).toContain("на 1 час");
    expect(captured.chat[0].content).toContain("data-payload=");
    expect(captured.chat[0].content).toContain("blinded");
    expect(captured.chat[0].content).toContain("Оглох");
  });

  it("провал — пилюли состояний не показаны, даже если conditionsGranted заполнен", async () => {
    captured.dice = [95, 40];
    const item = { id: "r1", getFlag: () => undefined, system: { conditionsGranted: [{ key: "blinded", level: 1 }] } };
    const res = await castRitual(baseR({ gmMod: 0, type: "summon" }), actor(), { item });

    expect(res.success).toBe(false);
    expect(captured.chat[0].content).not.toContain("Накладывает");
  });

  it("нет conditionsGranted — блока «Накладывает» нет", async () => {
    captured.dice = [1];
    const res = await castRitual(baseR({ gmMod: 50 }), actor());
    expect(captured.chat[0].content).not.toContain("Накладывает");
  });

  it("провал с типом «summon» вызывает Отвращение Варпа и инжектированный сдвиг Завесы", async () => {
    // Порог = −20 (нет навыка) + 0 (сложность) = −20; провал на 95 → 12 Провалов,
    // extra = 11×5 = 55; аверсия 40 → 95 = «Сражён» (81-90)? 40+55=95 → «Нападение» (91-100), veil 2.
    captured.dice = [95, 40];
    const shifts = [];
    const res = await castRitual(baseR({ gmMod: 0, type: "summon" }), actor(),
      { veilShiftFn: async (delta, note) => shifts.push({ delta, note }) });

    expect(res.success).toBe(false);
    expect(captured.chat[0].content).toContain("Отвращение Варпа");
    expect(shifts).toEqual([{ delta: 2, note: expect.stringContaining("Отвращение Варпа") }]);
  });

  it("провал с типом «circle» (failure:none) не бросает Отвращение и не двигает Завесу", async () => {
    captured.dice = [95];
    const shifts = [];
    const res = await castRitual(baseR({ gmMod: 0, type: "circle" }), actor(),
      { veilShiftFn: async (delta, note) => shifts.push({ delta, note }) });

    expect(res.success).toBe(false);
    expect(captured.chat[0].content).not.toContain("Отвращение Варпа");
    expect(shifts).toEqual([]);
    expect(captured.rolls.length).toBe(1); // только основной бросок, без второго на провал
  });

  it("провал с типом «curse» (failure:curse) — фиксированный текст, без второго броска", async () => {
    captured.dice = [95];
    const res = await castRitual(baseR({ gmMod: 0, type: "curse" }), actor());

    expect(res.success).toBe(false);
    expect(captured.chat[0].content).toContain("Что Посеешь");
    expect(captured.rolls.length).toBe(1);
  });
});

describe("confirmUnmetRequirements", () => {
  it("спрашивает подтверждение через Dialog.confirm и возвращает ответ", async () => {
    captured.confirmAnswer = false;
    const ok = await confirmUnmetRequirements({ name: "Каэль" }, ["Раса: Друкхари"]);
    expect(ok).toBe(false);
    expect(captured.dialog.title).toContain("не выполнены");
  });
});

// Вкладка «Ритуалы» окна Завесы — тонкая обёртка над ritualThreshold/castRitual
// (см. заголовок файла): проверяем только то, что своё у обёртки (выбор
// Ритуалиста/его предмета, гейт требований через тот же checkRequirements),
// не переповторяя саму математику порога — та уже покрыта выше.
describe("вкладка «Ритуалы» (VeilMystic._ritualData/_castRitual)", () => {
  const raceGroup = (...raceKeys) => ({
    id: "g", operator: "AND",
    entries: raceKeys.map((raceKey, n) => ({ id: `e${n}`, kind: "reqRace", raceKey }))
  });
  const ritualItem = (id, name, flags = {}) => ({
    id, name, type: "ritual", system: { testChar: "int", testMod: -20 },
    getFlag: (_scope, key) => flags[key]
  });

  /** Ритуалист на сцене: раса человек, один-два ритуала на листе. */
  function ritualist(items) {
    const list = [...items];
    list.get = id => list.find(i => i.id === id) ?? null;
    return {
      id: "act-1", name: "Каэль Ворн", type: "character",
      system: { race: "human", characteristics: { int: { total: 40 } }, skills: {}, groupSkills: {} },
      items: list
    };
  }

  /** Консоль без приложения: только то, что читают _ritualData/_castRitual. */
  function consoleFor(actor, ritual = {}) {
    globalThis.game.actors = { get: id => (actor.id === id ? actor : null) };
    return {
      ritual: { ritualistId: actor.id, itemId: "", name: "", type: "summon",
                skillValue: "", testChar: "", gmMod: -20, assistants: 0, assistBonus: 10,
                summon: {}, curseFam: "close", curseSymp: {}, numerology: {}, numMod: 0,
                psyker: false, psykerBonus: 0, aversionPerFail: 5, ...ritual },
      _ritualActors: () => [{ id: actor.id, name: actor.name }],
      render: () => {}
    };
  }

  const dataOf = ctx => VeilMystic.prototype._ritualData.call(ctx);
  const castOf = ctx => VeilMystic.prototype._castRitual.call(ctx);

  it("ритуал не выбран — гейта нет, ведём вручную", () => {
    const actor = ritualist([ritualItem("r1", "Зов", { req: [raceGroup("drukhari")] })]);
    const d = dataOf(consoleFor(actor));

    expect(d.reqOk).toBe(true);
    expect(d.ritualItems.map(r => r.name)).toEqual(["Зов"]);
  });

  it("выбран ритуал, требования не выполнены — гейт называет причину", () => {
    const actor = ritualist([ritualItem("r1", "Зов", { req: [raceGroup("drukhari")] })]);
    const d = dataOf(consoleFor(actor, { itemId: "r1" }));

    expect(d.reqOk).toBe(false);
    expect(d.reqFailed).toEqual(["Раса: Друкхари"]);
  });

  it("ритуал чужого актора выбранным не остаётся", () => {
    const actor = ritualist([ritualItem("r1", "Зов")]);
    const ctx = consoleFor(actor, { itemId: "чужой-ритуал" });
    const d = dataOf(ctx);

    expect(ctx.ritual.itemId).toBe("");
    expect(d.ritualItems.every(r => !r.selected)).toBe(true);
  });

  it("_castRitual делегирует в castRitual с выбранным предметом — карточка в чат", async () => {
    const actor = ritualist([ritualItem("r1", "Зов")]);
    const ctx = consoleFor(actor, { itemId: "r1", gmMod: 50 });
    captured.dice = [1]; // порог заведомо высокий (gmMod +50) — гарантированный успех

    await castOf(ctx);

    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("Ритуал удался");
  });

  it("без выбранного Ритуалиста _castRitual предупреждает и не бросает", async () => {
    const ctx = consoleFor(ritualist([]));
    ctx.ritual.ritualistId = "";
    globalThis.game.actors = { get: () => null };

    await castOf(ctx);

    expect(captured.warnings.length).toBe(1);
    expect(captured.rolls).toEqual([]);
  });
});
