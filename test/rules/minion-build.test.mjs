// test/rules/minion-build.test.mjs
//
// Счёт при создании Миньона (корбук стр. 111-113). Проверяется то, что игрок
// увидит в генераторе: бюджеты уровней, потолки групп, слоты купленных
// Талантов, максимум Миньонов и производные величины готового слуги.
//
// Ни одной проверки на Foundry: расчёты живут отдельно от листа именно затем,
// чтобы таблицы книги можно было сверять глазами, не поднимая мир.

import { describe, it, expect } from "vitest";
import { MINION_GROUPS, MINION_TIERS, MINION_TIER_ORDER, tierBudget } from "../../module/constants/minions.mjs";
import {
  isMinionTalent, minionSlotOf, minionSlots, slotUsage,
  minionCapacity, groupTally, talentRequirements,
  charLimits, charIssues, charPointsLeft, rollHumanChars,
  skillPointsLeft, talentPointsLeft, traitPointsLeft,
  minionWounds, hordeMagnitude, minionInfamy, minionCorruption, minionLoyalty, speechNote
} from "../../module/rules/minion-build.mjs";

/** Талант Миньона с выбранной парой «группа + сила». */
const talent = (group, tier, id = "t1") => ({
  id, type: "talent", name: "Minion of Chaos / Миньон Хаоса",
  flags: { "warhammer-dbc": { minionSlot: { group, tier } } }
});

/** Миньон как актор: генератору важны только группа, сила и система. */
const minion = (group, tier, name = "Слуга") => ({ name, system: { minionGroup: group, minionTier: tier } });

/** Хозяин с нужными значениями Характеристик и Бесчестия. */
// Бесчестие в системе — Характеристика inf, а не отдельное поле.
const master = ({ fel = 40, per = 30, int = 50, wp = 35, infamy = 60 } = {}) => ({
  system: {
    characteristics: {
      fel: { total: fel }, per: { total: per }, int: { total: int }, wp: { total: wp },
      inf: { total: infamy }
    }
  }
});

describe("таблицы книги", () => {
  it("у каждой группы своя характеристика Хозяина и свой Навык требования", () => {
    expect(Object.keys(MINION_GROUPS)).toEqual(["human", "beast", "machine", "daemon"]);
    expect(MINION_GROUPS.human.masterChar).toBe("fel");
    expect(MINION_GROUPS.beast.masterChar).toBe("per");
    expect(MINION_GROUPS.machine.masterChar).toBe("int");
    expect(MINION_GROUPS.daemon.masterChar).toBe("wp");
    expect(new Set(Object.values(MINION_GROUPS).map(g => g.reqSkill)).size).toBe(4);
  });

  it("уровни силы идут порядком книги, а не алфавитом ключей", () => {
    expect(MINION_TIER_ORDER).toEqual(["lesser", "standard", "greater", "superior", "horde"]);
  });

  // «Генерируется как Высший» и «как Низший» — не копия чисел, а ссылка:
  // правка таблицы бюджетов не должна разъезжаться по двум местам.
  it("Превосходящий строится как Высший, Орда — как Низший, но уровень Таланта свой", () => {
    expect(tierBudget("superior").chars).toBe(MINION_TIERS.greater.chars);
    expect(tierBudget("horde").talents).toBe(MINION_TIERS.lesser.talents);
    expect(tierBudget("horde").talentTier).toBe(3);
  });

  it("бюджеты уровней — как в книге", () => {
    expect(tierBudget("lesser").chars.points).toBe(120);
    expect(tierBudget("standard").chars.points).toBe(175);
    expect(tierBudget("greater").chars.points).toBe(250);
    expect([tierBudget("lesser").skills.points, tierBudget("standard").skills.points, tierBudget("greater").skills.points])
      .toEqual([4, 6, 9]);
    expect([tierBudget("lesser").talents.points, tierBudget("standard").talents.points, tierBudget("greater").talents.points])
      .toEqual([5, 7, 11]);
    expect([tierBudget("lesser").traits.points, tierBudget("standard").traits.points, tierBudget("greater").traits.points])
      .toEqual([3, 5, 7]);
  });
});

describe("слоты купленных Талантов", () => {
  it("Талант узнаётся по флагу и по имени", () => {
    expect(isMinionTalent(talent("human", "lesser"))).toBe(true);
    expect(isMinionTalent({ type: "talent", name: "Миньон Хаоса" })).toBe(true);
    expect(isMinionTalent({ type: "talent", name: "Крепкое Телосложение" })).toBe(false);
    expect(isMinionTalent({ type: "trait", name: "Миньон Хаоса" })).toBe(false);
  });

  it("каждый экземпляр Таланта — отдельный слот", () => {
    const slots = minionSlots([talent("human", "lesser", "a"), talent("daemon", "greater", "b"), { type: "talent", name: "Другой" }]);
    expect(slots).toHaveLength(2);
    expect(slots.map(s => `${s.group}/${s.tier}`)).toEqual(["human/lesser", "daemon/greater"]);
  });

  it("миньон занимает слот своей пары, лишний уходит в «сверх плана»", () => {
    const items = [talent("human", "lesser", "a"), talent("beast", "standard", "b")];
    const { slots, free, extra } = slotUsage(items, [minion("beast", "standard"), minion("daemon", "greater")]);

    expect(slots.find(s => s.group === "beast").minion).not.toBeNull();
    expect(free.map(s => s.group)).toEqual(["human"]);
    expect(extra).toHaveLength(1);
  });

  it("слот без выбранной пары принимает любого миньона", () => {
    const { free } = slotUsage([{ id: "x", type: "talent", name: "Миньон Хаоса" }], [minion("machine", "greater")]);
    expect(free).toHaveLength(0);
  });

  it("без Талантов слотов нет вовсе — блок Миньонов не показывается", () => {
    expect(minionSlots([{ type: "talent", name: "Дуэлист" }])).toEqual([]);
  });
});

describe("максимум Миньонов", () => {
  it("одна группа — бонус её характеристики", () => {
    expect(minionCapacity(master({ int: 55 }), ["machine"])).toBe(5);
  });

  // Пример книги: I.b 5 и F.b 3 дают максимум 3, а без человека — снова 5.
  it("разные группы — наименьший из бонусов", () => {
    const m = master({ int: 55, fel: 35 });
    expect(minionCapacity(m, ["machine", "human"])).toBe(3);
    expect(minionCapacity(m, ["machine"])).toBe(5);
  });

  it("без миньонов максимум не считается", () => {
    expect(minionCapacity(master(), [])).toBe(0);
  });

  it("счётчик по группам — для шапки блока", () => {
    expect(groupTally([minion("human", "lesser"), minion("human", "greater"), minion("daemon", "horde")]))
      .toEqual({ human: 2, daemon: 1 });
  });
});

describe("требования Таланта", () => {
  it("хватает характеристики и Бесчестия — требование выполнено", () => {
    const req = talentRequirements(master({ wp: 55, infamy: 60 }), "daemon", "greater");
    expect(req.ok).toBe(true);
    expect(req.skillNote).toBe("Forbidden Lore (Daemons) +20");
  });

  it("не хватает — сказано, чего именно", () => {
    const req = talentRequirements(master({ fel: 40, infamy: 10 }), "human", "standard");
    expect(req.ok).toBe(false);
    expect(req.missing).toHaveLength(2);
    expect(req.missing[0]).toMatch(/FEL 40/);
    expect(req.missing[1]).toMatch(/Бесчестие 10/);
  });
});

describe("бюджеты создания", () => {
  it("очки Характеристик тратятся и уходят в минус видимо", () => {
    expect(charPointsLeft({ ws: 30, bs: 30, s: 30, t: 30 }, "beast", "lesser")).toBe(0);
    expect(charPointsLeft({ ws: 40, bs: 40, s: 40, t: 40 }, "beast", "lesser")).toBe(-40);
  });

  it("Человек очков не тратит — он бросает кубы", () => {
    expect(charPointsLeft({ ws: 40 }, "human", "lesser")).toBeNull();
  });

  it("бросок Человека: лишние результаты отбрасываются, остаётся девять", () => {
    let n = 0;
    const kubi = () => [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 3][n++];   // 2d10 наперёд

    const lesser = rollHumanChars("lesser", kubi);
    expect(lesser).toHaveLength(9);
    expect(lesser[0]).toBe(15 + 18);   // 15 + 2d10, по убыванию

    n = 0;
    expect(rollHumanChars("greater", kubi)).toHaveLength(9);
  });

  it("потолок уровня и рамки группы", () => {
    expect(charLimits("beast", "lesser")).toEqual({ cap: 30, max: { int: 10, fel: 10 }, min: {} });
    expect(charIssues({ ws: 35 }, "beast", "lesser")[0]).toMatch(/потолок 30/);
    expect(charIssues({ int: 20 }, "beast", "lesser")[0]).toMatch(/не выше 10/);
    expect(charIssues({ wp: 20 }, "daemon", "greater")[0]).toMatch(/не ниже 25/);
    expect(charIssues({ wp: 30, ws: 30 }, "daemon", "greater")).toEqual([]);
  });

  it("Навыки: взятие по очку, подъём по два, число подъёмов ограничено", () => {
    const four = [{}, {}, {}, {}];
    expect(skillPointsLeft(four, "lesser").left).toBe(0);

    const withUp = [{ upgraded: true }, {}];
    const res = skillPointsLeft(withUp, "lesser");
    expect(res.left).toBe(0);          // 4 − (2 навыка + 1 подъём × 2)
    expect(res.ups).toBe(1);
    expect(res.upLimit).toBe(1);
  });

  it("Таланты: свой потолок уровня, перебор виден по именам", () => {
    const res = talentPointsLeft([{ name: "Сильный Удар", tier: 2 }], "lesser");
    expect(res.left).toBe(4);
    expect(res.maxTier).toBe(1);
    expect(res.overTier).toEqual(["Сильный Удар"]);
    // У Высшего потолка уровня нет вовсе.
    expect(talentPointsLeft([{ tier: 3 }], "greater").overTier).toEqual([]);
  });

  it("обмен очков идёт только в одну сторону", () => {
    // Талант → Навык: у Навыков прибыло, у Талантов убыло.
    expect(skillPointsLeft([], "lesser", 2).left).toBe(6);
    expect(talentPointsLeft([], "lesser", { toSkills: 2 }).left).toBe(3);
    // Трейт → Талант: так же.
    expect(talentPointsLeft([], "lesser", { fromTraits: 1 }).left).toBe(6);
    expect(traitPointsLeft([], "lesser", { toTalents: 1 })).toBe(2);
    // Зверь и демон отдают снаряжение за Очки Трейтов.
    expect(traitPointsLeft([], "lesser", { fromGear: 2 })).toBe(5);
  });

  it("Трейты считаются по своей цене, а не по штуке", () => {
    expect(traitPointsLeft([{ cost: 2 }, { cost: 1 }], "standard")).toBe(2);
    // Трейт с ценой −1 (Blind, Stampede, Warp Instability) очки возвращает.
    expect(traitPointsLeft([{ cost: -1 }], "lesser")).toBe(4);
  });
});

describe("готовый Миньон", () => {
  it("Раны: T.b × 2 + 2 × Уровень", () => {
    expect(minionWounds({ toughness: 35, tier: "lesser" })).toBe(8);    // 3×2 + 2×1
    expect(minionWounds({ toughness: 35, tier: "greater" })).toBe(12);  // 3×2 + 2×3
  });

  it("хрупкий Трейт даёт +5 Ран и только один раз", () => {
    expect(minionWounds({ toughness: 35, tier: "lesser", traits: ["Swarm"] })).toBe(13);
    expect(minionWounds({ toughness: 35, tier: "lesser", traits: ["Swarm", "Warp Instability"] })).toBe(13);
  });

  it("у Орды Ран нет, у неё Магнитуда от Бесчестия Хозяина", () => {
    expect(minionWounds({ toughness: 40, tier: "horde" })).toBe(0);
    expect(hordeMagnitude(master({ infamy: 62 }))).toBe(30);            // 6 × 5
  });

  it("Бесчестие: половина хозяйского, но не выше 30", () => {
    expect(minionInfamy(master({ infamy: 40 }), "lesser")).toBe(20);
    expect(minionInfamy(master({ infamy: 90 }), "lesser")).toBe(30);
    // Превосходящий потолка не знает — у него две трети хозяйского.
    expect(minionInfamy(master({ infamy: 90 }), "superior")).toBe(60);
  });

  it("у демона Порча сотня, у прочих её ставит ГМ", () => {
    expect(minionCorruption("daemon")).toBe(100);
    expect(minionCorruption("machine")).toBe(0);
  });

  it("Лояльность — значение характеристики Хозяина, а не бонус", () => {
    expect(minionLoyalty(master({ fel: 42 }), "human")).toBe(42);
    expect(minionLoyalty(master({ per: 31 }), "beast")).toBe(31);
    expect(minionLoyalty(master(), "")).toBe(0);
  });

  it("речь: молчание при низкой Общительности, команды — при низком Интеллекте", () => {
    expect(speechNote({ fel: 5, int: 30 })).toMatch(/говорить не может/i);
    expect(speechNote({ fel: 20, int: 5 })).toMatch(/только команды/i);
    expect(speechNote({ fel: 30, int: 30 })).toBe("");
  });
});
