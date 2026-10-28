// test/combat/disease-infection.test.mjs
//
// Тест заражения болезнью (wdbc-dbveg) — rollInfectionTest: настоящие болезни
// и Черты из packs-src, Порог T±N выбранного пути передачи, провал включает
// болезнь, успех — нет; Преимущество Крепкого как Камень и Живучести Сплайса;
// Метка Нургла не заражается. Кубы — очередь captured.dice.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { allPackDocuments } from "../support/pack-docs.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { rollInfectionTest } from "../../module/combat/disease-infection.mjs";

const enName = d => d.name.split("/")[0].trim();
const DISEASES = allPackDocuments("diseases").map(d => d.doc);
const TRAITS = allPackDocuments("traits").map(d => d.doc);
const ROT = DISEASES.find(d => enName(d) === "Nurgle's Rot");
const LIGHT = DISEASES.find(d => d.name.startsWith("Лёгкая"));
const NURGLE_MARK = TRAITS.find(d => enName(d) === "Mark of Nurgle");
const STONE = packDocById("packs-src/traits", "IsGR11cplUwRIuZv");
const SPLICE = packDocById("packs-src/traits/Трейты_рас/Адаптации_Сплайса", "MDXsZYrdMFUEcMUO");

function owned(doc, actor, id) {
  const item = {
    id, name: doc.name, type: doc.type, system: structuredClone(doc.system ?? {}),
    flags: structuredClone(doc.flags ?? {}), parent: actor
  };
  item.getFlag = (s, k) => item.flags?.[s]?.[k];
  item.update = async data => { for (const [p, v] of Object.entries(data)) { if (p === "system.active") item.system.active = v; } };
  return item;
}

function makeActor(docs = [], { t = 40 } = {}) {
  const actor = { type: "character", name: "Подставной", system: { characteristics: { t: { total: t } } }, items: [] };
  docs.forEach((d, i) => actor.items.push(owned(d, actor, `i${i}`)));
  actor.items.contents = actor.items;
  return actor;
}

beforeEach(() => resetCaptured());

describe("rollInfectionTest — Гниль Нургла (Кожа-к-коже T+20)", () => {
  const skin = { label: "Кожа-к-коже", char: "t", mod: 20 };

  it("провал (Порог 60, бросок 75) — болезнь включена, в карточке «заражён»", async () => {
    const a = makeActor([ROT]);
    const rot = a.items[0];
    expect(rot.system.active).toBe(false);
    captured.dice = [75];
    expect(await rollInfectionTest(a, rot, { vector: skin })).toBe("infected");
    expect(rot.system.active).toBe(true);
    expect(captured.chat[0].content).toContain("заражён");
  });

  it("успех (бросок 50 ≤ 60) — болезнь остаётся выключенной", async () => {
    const a = makeActor([ROT]);
    const rot = a.items[0];
    captured.dice = [50];
    expect(await rollInfectionTest(a, rot, { vector: skin })).toBe("resisted");
    expect(rot.system.active).toBe(false);
    expect(captured.chat[0].content).toContain("Успех");
  });

  it("жидкости T−10: тот же бросок 50 против Порога 30 — провал", async () => {
    const a = makeActor([ROT]);
    const rot = a.items[0];
    captured.dice = [50];
    const fluid = rot.system.vectorTests.find(v => v.mod === -10);
    expect(fluid, "вектор T−10 в данных Гнили").toBeTruthy();
    expect(await rollInfectionTest(a, rot, { vector: fluid })).toBe("infected");
  });

  it("уже действующая болезнь повторно не бросается", async () => {
    const a = makeActor([ROT]);
    const rot = a.items[0];
    rot.system.active = true;
    expect(await rollInfectionTest(a, rot, { vector: skin })).toBeNull();
    expect(captured.chat).toHaveLength(0);
  });
});

describe("rollInfectionTest — ActiveEffect болезни включается вместе с ней", () => {
  it("провал: болезнь включена, её отключённый эффект включён тоже; успех: ничего не тронуто", async () => {
    const vec = { label: "Дым", char: "t", mod: 0 };
    const a = makeActor([ROT]);
    const rot = a.items[0];
    const fx = { id: "fx1", disabled: true };
    rot.effects = [fx];
    rot.updateEmbeddedDocuments = async (_t, ups) => { for (const u of ups) fx.disabled = u.disabled; };

    captured.dice = [99]; // против Порога 40
    expect(await rollInfectionTest(a, rot, { vector: vec })).toBe("infected");
    expect(rot.system.active).toBe(true);
    expect(fx.disabled).toBe(false);

    const b = makeActor([ROT]);
    const rot2 = b.items[0];
    const fx2 = { id: "fx2", disabled: true };
    rot2.effects = [fx2];
    rot2.updateEmbeddedDocuments = async (_t, ups) => { for (const u of ups) fx2.disabled = u.disabled; };
    captured.dice = [5];
    expect(await rollInfectionTest(b, rot2, { vector: vec })).toBe("resisted");
    expect(rot2.system.active).toBe(false);
    expect(fx2.disabled).toBe(true);
  });
});

describe("rollInfectionTest — болезни без Порога книги", () => {
  it("«Лёгкая болезнь» — на усмотрение МИ: ничего не катается, ГМ включает вручную", async () => {
    const a = makeActor([LIGHT]);
    expect(await rollInfectionTest(a, a.items[0])).toBeNull();
    expect(captured.chat).toHaveLength(0);
  });
});

describe("rollInfectionTest — Метка Нургла не заражается", () => {
  it("носитель Метки: бросок не нужен, болезнь не включается", async () => {
    const a = makeActor([NURGLE_MARK, ROT]);
    const rot = a.items.find(i => i.type === "disease");
    captured.dice = [99];
    expect(await rollInfectionTest(a, rot, { vector: { label: "x", char: "t", mod: 20 } })).toBe("blocked");
    expect(rot.system.active).toBe(false);
    expect(captured.dice).toHaveLength(1); // кубик не брали
    expect(captured.chat[0].content).toContain("не заражается");
  });
});

describe("rollInfectionTest — Сопротивление (Disease) +10", () => {
  const resistance = spec => ({ id: "r1", type: "talent", name: `Resistance / Сопротивление (${spec})`, system: { specialization: spec } });
  const vec = { label: "Дым", char: "t", mod: 0 };

  it("Resistance (Disease): Порог 40+10 — бросок 50 уже успех", async () => {
    const a = makeActor([ROT]);
    a.items.push(resistance("Disease"));
    captured.dice = [50];
    expect(await rollInfectionTest(a, a.items[0], { vector: vec })).toBe("resisted");
  });

  it("без Таланта (или с чужой специализацией) тот же бросок 50 против 40 — провал", async () => {
    const a = makeActor([ROT]);
    a.items.push(resistance("Poison"));
    captured.dice = [50];
    expect(await rollInfectionTest(a, a.items[0], { vector: vec })).toBe("infected");
  });
});

describe("rollInfectionTest — Преимущество", () => {
  const skin = { label: "Кожа-к-коже", char: "t", mod: 20 };

  it("Крепкий как Камень: два броска, лучший спасает (90 и 20 против Порога 60)", async () => {
    const a = makeActor([STONE, ROT]);
    const rot = a.items.find(i => i.type === "disease");
    captured.dice = [90, 20];
    expect(await rollInfectionTest(a, rot, { vector: skin })).toBe("resisted");
    expect(captured.chat[0].content).toContain("Крепкий как Камень");
  });

  it("Живучесть Сплайса — то же самое", async () => {
    const a = makeActor([SPLICE, ROT]);
    const rot = a.items.find(i => i.type === "disease");
    captured.dice = [90, 20];
    expect(await rollInfectionTest(a, rot, { vector: skin })).toBe("resisted");
    expect(captured.chat[0].content).toContain("против болезней");
  });

  it("без Черт один бросок: 90 против Порога 60 — заражён", async () => {
    const a = makeActor([ROT]);
    captured.dice = [90];
    expect(await rollInfectionTest(a, a.items[0], { vector: skin })).toBe("infected");
    expect(captured.dice).toHaveLength(0);
  });
});

// ── Последствия заражения (Sahara task-3ab7, решение владельца 26.10.2026) ──────────

const WEAKNESS = DISEASES.find(d => d.name.startsWith("Хворь Слабости"));
const POX = DISEASES.find(d => d.name.startsWith("Ходячая Оспа"));

/** Актор с Ловкостью, пулом Очков и записью урона в Характеристики (update пишет на лету). */
function makeVictim(docs, { t = 40, ag = 40, fate = 0, tempInfamy = 0 } = {}) {
  const actor = makeActor(docs, { t });
  actor.system.characteristics.ag = { total: ag, bonus: Math.floor(ag / 10) };
  actor.system.fate = { value: fate, max: 3 };
  actor.system.charLoss = {};
  actor.updates = [];
  actor.flags = { "warhammer-dbc": tempInfamy ? { tempInfamy: { amount: tempInfamy } } : {} };
  actor.getFlag = (_s, k) => actor.flags["warhammer-dbc"][k];
  actor.setFlag = async (_s, k, v) => { actor.flags["warhammer-dbc"][k] = v; };
  actor.unsetFlag = async (_s, k) => { delete actor.flags["warhammer-dbc"][k]; };
  actor.update = async data => {
    actor.updates.push(data);
    for (const [path, value] of Object.entries(data)) {
      const parts = path.split(".");
      let node = actor;
      for (const part of parts.slice(0, -1)) { node[part] ??= {}; node = node[part]; }
      node[parts.at(-1)] = value;
    }
    return data;
  };
  return actor;
}

describe("Хворь Слабости: «заражается и немедленно получает 2d10 урона в А»", () => {
  const blood = { label: "Кровь", char: "t", mod: -20 };

  it("провал: болезнь включена и 2d10 урона легли в Ловкость (бросок 3+4 = 7)", async () => {
    const a = makeVictim([WEAKNESS]);
    captured.dice = [95, 3, 4];                       // d100 = 95 против Порога 20, затем 2d10
    expect(await rollInfectionTest(a, a.items[0], { vector: blood })).toBe("infected");
    expect(a.items[0].system.active).toBe(true);
    expect(captured.dice).toHaveLength(0);
    expect(a.system.charLoss.ag).toBe(7);
    const text = captured.chat.map(m => m.content).join("\n");
    expect(text).toContain("Урон в Характеристики");
    expect(text).toContain("2d10");
  });

  it("успех: болезнь не прижилась и урона в Ловкость нет", async () => {
    const a = makeVictim([WEAKNESS]);
    captured.dice = [10];                             // 10 ≤ 20 — успех
    expect(await rollInfectionTest(a, a.items[0], { vector: blood })).toBe("resisted");
    expect(a.items[0].system.active).toBe(false);
    expect(a.system.charLoss.ag ?? 0).toBe(0);
  });

  it("иммунитет к болезням: ни броска, ни урона", async () => {
    const a = makeVictim([NURGLE_MARK, WEAKNESS]);
    const w = a.items.find(i => i.type === "disease");
    captured.dice = [95];
    expect(await rollInfectionTest(a, w, { vector: blood })).toBe("blocked");
    expect(a.system.charLoss.ag ?? 0).toBe(0);
  });
});

describe("Ходячая Оспа: Очко Бесчестия/Судьбы после провала — авто-успех", () => {
  const skin = { label: "Кожа-к-коже", char: "t", mod: 0 };

  // Заглушка Foundry возвращает undefined из getProperty — а точка списания пула
  // (apps/infamy-points.mjs::spendFromInfamyPool) читает значение именно им.
  // Подставляем настоящее чтение по пути (как у ядра), после теста возвращаем.
  const realGetProperty = (obj, path) => String(path).split(".").reduce((o, k) => o?.[k], obj);
  let prevGet;
  beforeEach(() => { prevGet = foundry.utils.getProperty; foundry.utils.getProperty = realGetProperty; });
  afterEach(() => { foundry.utils.getProperty = prevGet; });

  it("провал, игрок тратит Очко: тест засчитан, болезнь не включена, Очко списано", async () => {
    const a = makeVictim([POX], { fate: 2 });
    captured.dice = [90];                             // 90 > 40 — провал
    captured.confirmAnswer = true;
    expect(await rollInfectionTest(a, a.items[0], { vector: skin })).toBe("resisted");
    expect(a.items[0].system.active).toBe(false);
    expect(a.system.fate.value).toBe(1);
    expect(captured.dialog.content).toContain("Очко Бесчестия/Судьбы");
    expect(captured.chat[0].content).toContain("Потрачено Очко");
    expect(captured.chat[0].content).toContain("Авто-успех");
  });

  it("игрок отказался: заражён, Очко цело", async () => {
    const a = makeVictim([POX], { fate: 2 });
    captured.dice = [90];
    captured.confirmAnswer = false;
    expect(await rollInfectionTest(a, a.items[0], { vector: skin })).toBe("infected");
    expect(a.items[0].system.active).toBe(true);
    expect(a.system.fate.value).toBe(2);
  });

  it("Очков нет: вопроса нет, заражён", async () => {
    const a = makeVictim([POX], { fate: 0 });
    captured.dice = [90];
    expect(await rollInfectionTest(a, a.items[0], { vector: skin })).toBe("infected");
    expect(captured.dialog).toBeNull();
  });

  it("временное Очко (Глас Бога и т.п.) тратится первым, пул не трогается", async () => {
    const a = makeVictim([POX], { fate: 2, tempInfamy: 1 });
    captured.dice = [90];
    expect(await rollInfectionTest(a, a.items[0], { vector: skin })).toBe("resisted");
    expect(a.system.fate.value).toBe(2);
  });

  it("успех броска: Очко не предлагается", async () => {
    const a = makeVictim([POX], { fate: 2 });
    captured.dice = [20];
    expect(await rollInfectionTest(a, a.items[0], { vector: skin })).toBe("resisted");
    expect(captured.dialog).toBeNull();
    expect(a.system.fate.value).toBe(2);
  });

  it("болезнь без такого последствия (Гниль Нургла) Очко не предлагает", async () => {
    const a = makeVictim([ROT], { fate: 2 });
    captured.dice = [99];
    expect(await rollInfectionTest(a, a.items[0], { vector: { label: "Кожа", char: "t", mod: 20 } })).toBe("infected");
    expect(captured.dialog).toBeNull();
  });
});
