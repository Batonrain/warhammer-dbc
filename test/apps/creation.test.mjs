import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { splitTopLevel } from "../../module/helpers/utils.mjs";
import { grantCreationSkills, grantCultureSkills, grantCreationGear }
  from "../../module/apps/creation.mjs";

/** Обновление по плоскому пути: Foundry меняет документ на месте, тесты — тоже. */
function applyPath(target, path, value) {
  const keys = path.split(".");
  let cur = target;
  for (const key of keys.slice(0, -1)) cur = (cur[key] ??= {});
  cur[keys.at(-1)] = value;
}

function actor({ skills = {}, groupSkills = {} } = {}) {
  const a = {
    name: "Подставной",
    system: { skills, groupSkills },
    updates: [],
    created: [],
    update: async data => {
      a.updates.push(data);
      for (const [path, value] of Object.entries(data)) applyPath(a, path, value);
      return data;
    },
    createEmbeddedDocuments: async (_type, docs) => { a.created.push(...docs); return docs; }
  };
  return a;
}

/** Диалог выбора резолвится не сам: даём промису дойти до `new Dialog`. */
const tick = () => new Promise(r => setTimeout(r, 0));

/** Ответ на диалог выбора: значения по индексу строки. */
function answerDialog(values) {
  const selects = values.map((value, i) => ({ dataset: { i: String(i) }, value }));
  captured.dialog.buttons.ok.callback(fakeHtml({}, { "select[data-i]": selects }));
}

beforeEach(resetCaptured);

describe("splitTopLevel", () => {
  it("режет по запятым верхнего уровня, скобки не трогает", () => {
    expect(splitTopLevel("Awareness, Trade (Armourer, Weaponsmith), Dodge"))
      .toEqual(["Awareness", "Trade (Armourer, Weaponsmith)", "Dodge"]);
  });

  it("пустые куски выбрасывает", () => {
    expect(splitTopLevel("Dodge, , Parry")).toEqual(["Dodge", "Parry"]);
  });
});

describe("выдача стартовых навыков", () => {
  it("«+10» даёт ранг Обученный бесплатно", async () => {
    const a = actor();
    await grantCreationSkills(a, { race: { skills: "Awareness +10" } });
    expect(a.system.skills.awareness).toMatchObject({
      grantedRank: "trained", rank: "trained", cost: 0
    });
  });

  it("уже купленный ранг не понижается", async () => {
    const a = actor({ skills: { awareness: { rank: "expert", cost: 550 } } });
    await grantCreationSkills(a, { race: { skills: "Awareness" } });
    expect(a.system.skills.awareness.rank).toBe("expert");
    expect(a.system.skills.awareness.grantedRank).toBe("knows");
  });

  it("специализации через запятую становятся отдельными записями", async () => {
    const a = actor();
    await grantCreationSkills(a, { arch: { skills: "Trade (Armourer, Weaponsmith)" } });
    expect(a.system.groupSkills.trade.map(e => e.specialty)).toEqual(["Бронник", "Оружейник"]);
    expect(a.system.groupSkills.trade.every(e => e.cost === 0)).toBe(true);
  });

  it("«Warp, Daemons and Psykers» — одна специализация, запятая внутри имени", async () => {
    const a = actor();
    await grantCreationSkills(a, { race: { skills: "Forbidden Lore (Warp, Daemons and Psykers)" } });
    expect(a.system.groupSkills.forbiddenLore.map(e => e.specialty))
      .toEqual(["Варп, Демоны и Псайкеры"]);
  });

  it("«(War, любое 1)» даёт названную специализацию и один свободный слот", async () => {
    const a = actor();
    await grantCreationSkills(a, { race: { skills: "Common Lore (War, любое 1) +10" } });
    const arr = a.system.groupSkills.commonLore;
    expect(arr.map(e => e.specialty)).toEqual(["Война", "— выбери —"]);
    expect(arr.find(e => e.wildSlot)).toMatchObject({ rank: "trained", grantedRank: "trained" });
  });

  it("повторный прогон Мастера не удваивает свободные слоты", async () => {
    const a = actor();
    const src = { race: { skills: "Common Lore (любое 2)" } };
    await grantCreationSkills(a, src);
    await grantCreationSkills(a, src);
    expect(a.system.groupSkills.commonLore.filter(e => e.wildSlot)).toHaveLength(2);
  });

  it("выбранная игроком специализация переживает повторный прогон", async () => {
    const a = actor();
    await grantCreationSkills(a, { race: { skills: "Common Lore (любое 1)" } });
    a.system.groupSkills.commonLore[0].specialty = "Империум";
    a.system.groupSkills.commonLore[0].wild = false;
    await grantCreationSkills(a, { race: { skills: "Common Lore (любое 1)" } });
    expect(a.system.groupSkills.commonLore.map(e => e.specialty)).toEqual(["Империум"]);
  });

  it("нераспознанная запись не теряется молча — ГМ получает предупреждение", async () => {
    const a = actor();
    await grantCreationSkills(a, { race: { skills: "Ловля бабочек" } });
    expect(captured.warnings.join(" ")).toContain("Ловля бабочек");
  });

  it("«или» спрашивает игрока и выдаёт только выбранное", async () => {
    const a = actor();
    const done = grantCreationSkills(a, { arch: { skills: "Awareness или Dodge" } });
    await tick();
    answerDialog(["Dodge"]);
    await done;
    expect(a.system.skills.dodge?.grantedRank).toBe("knows");
    expect(a.system.skills.awareness).toBeUndefined();
  });

  it("выбор внутри скобок — одна специализация из трёх, а не все три", async () => {
    const a = actor();
    const done = grantCreationSkills(a, { arch: { skills: "For. Lore (Archeotech/Xenos/Warp)" } });
    await tick();
    expect(captured.dialog.content).toContain("Ксеносы");
    answerDialog(["For. Lore (Xenos)"]);
    await done;
    expect(a.system.groupSkills.forbiddenLore.map(e => e.specialty)).toEqual(["Ксеносы"]);
  });
});

describe("навыки культуры легиона", () => {
  it("без культуры не трогает актора", async () => {
    const a = actor();
    expect(await grantCultureSkills(a, null)).toBe(0);
    expect(a.updates).toHaveLength(0);
  });

  it("список культуры выдаётся тем же разбором, что и навыки создания", async () => {
    const a = actor();
    await grantCultureSkills(a, { grantSkills: ["Intimidate +10", "Common Lore (Chaos)"] });
    expect(a.system.skills.intimidate.grantedRank).toBe("trained");
    expect(a.system.groupSkills.commonLore.map(e => e.specialty)).toEqual(["Хаос"]);
  });
});

describe("стартовое снаряжение", () => {
  // Компендиумы в тестах не открыты: проверяем разбор строки и карту в чат,
  // а не поиск предметов.
  beforeEach(() => { game.packs = { get: () => null }; });

  it("постит ГМу список того, что выдать вручную", async () => {
    const a = actor();
    await grantCreationGear(a, { arch: { name: "Тактик", gear: "Болт-пистолет, Цепной меч" } });
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Болт-пистолет");
    expect(html).toContain("Цепной меч");
  });

  it("Астартес получает приписку про Системы силовой брони", async () => {
    const a = actor();
    await grantCreationGear(a, { race: { label: "Астартес" }, isAstartes: true });
    expect(captured.chat.at(-1).content).toContain("Системы силовой брони");
  });

  it("«A или B» спрашивает игрока и в список идёт выбранное", async () => {
    const a = actor();
    const done = grantCreationGear(a, { arch: { gear: "Болтер или Плазма-пистолет" } });
    await tick();
    answerDialog(["Плазма-пистолет"]);
    await done;
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Плазма-пистолет");
    expect(html).not.toContain("Болтер");
  });
});
