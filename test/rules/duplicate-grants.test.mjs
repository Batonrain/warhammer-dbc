// test/rules/duplicate-grants.test.mjs
//
// Один и тот же Навык или Талант из разных источников (Архетип, Раса, Элитный
// архетип, Субраса, Происхождение, Предсказание, Стремления, Черты, Культура
// Астартес). Совпадения там обычны, и второй источник пропадал впустую.
//
// Правило стола: Навык выше — заменяет; такой же или ниже — не даёт ничего, но
// возвращает опыт, как если бы игрок качал ЭТОТ уровень с нуля; Талант, который
// уже есть, возвращает свою цену.

import { describe, it, expect, vi } from "vitest";
import {
  RANK_ORDER, rankIndex, nextRank, higherOf, stepsUpTo,
  skillGrantOutcome, isSameTalent, findSameTalent,
  repeatableTalentTarget, createOrRankTalent
} from "../../module/rules/duplicate-grants.mjs";

const talent = (name, specialization = "") => ({ type: "talent", name, system: { specialization } });

describe("ступени Навыка", () => {
  it("порядок роста — от нетренированного до +30", () => {
    expect(RANK_ORDER).toEqual(["untrained", "knows", "trained", "veteran", "expert"]);
  });

  it("следующая ступень, а на потолке её нет", () => {
    expect(nextRank("knows")).toBe("trained");
    expect(nextRank("expert")).toBeNull();
  });

  it("сравнение рангов не зависит от порядка аргументов", () => {
    expect(higherOf("knows", "veteran")).toBe("veteran");
    expect(higherOf("veteran", "knows")).toBe("veteran");
    expect(rankIndex("нет-такого")).toBe(0);
  });

  // Цена считается «с нуля»: за +10 платятся обе ступени — «+0» и «+10».
  it("ступени до ранга — те, что пришлось бы оплатить с нуля", () => {
    expect(stepsUpTo("untrained")).toEqual([]);
    expect(stepsUpTo("knows")).toEqual([0]);
    expect(stepsUpTo("trained")).toEqual([0, 1]);
    expect(stepsUpTo("veteran")).toEqual([0, 1, 2]);
    expect(stepsUpTo("expert")).toEqual([0, 1, 2, 3]);
  });
});

describe("Навык из второго источника", () => {
  it("первая выдача — просто выдача, без возврата", () => {
    expect(skillGrantOutcome("untrained", "knows"))
      .toEqual({ rank: "knows", refundSteps: [], duplicate: false });
  });

  it("выше имеющегося — заменяет, персонаж стал лучше", () => {
    expect(skillGrantOutcome("knows", "veteran"))
      .toEqual({ rank: "veteran", refundSteps: [], duplicate: false });
  });

  // Главное правило: совпадение или уровень ниже ранг не трогают, но
  // возвращают цену выдаваемого уровня, посчитанную с нуля.
  it("такой же — ранг на месте, возврат за этот уровень", () => {
    const res = skillGrantOutcome("trained", "trained");
    expect(res.rank).toBe("trained");
    expect(res.refundSteps).toEqual([0, 1]);
    expect(res.duplicate).toBe(true);
  });

  it("ниже имеющегося — тоже возврат, и ровно за выдаваемый уровень", () => {
    const res = skillGrantOutcome("expert", "knows");
    expect(res.rank).toBe("expert");
    // Дают «+0» — возвращается цена одной ступени, а не всей прокачки до +30.
    expect(res.refundSteps).toEqual([0]);
  });

  it("выдача +20 поверх +30 возвращает три ступени", () => {
    expect(skillGrantOutcome("expert", "veteran").refundSteps).toEqual([0, 1, 2]);
  });
});

describe("Талант из второго источника", () => {
  it("тот же Талант узнаётся по имени", () => {
    expect(isSameTalent(talent("Дуэлист"), talent("дуэлист"))).toBe(true);
    expect(isSameTalent(talent("Дуэлист"), talent("Меткий выстрел"))).toBe(false);
  });

  it("специализация различает Таланты", () => {
    expect(isSameTalent(talent("Weapon Training", "Bolt"), talent("Weapon Training", "Las"))).toBe(false);
    expect(isSameTalent(talent("Weapon Training", "Bolt"), talent("Weapon Training", "bolt"))).toBe(true);
  });

  it("совпадение ищется только среди Талантов", () => {
    const items = [{ type: "trait", name: "Дуэлист", system: {} }, talent("Дуэлист")];
    expect(findSameTalent(items, talent("Дуэлист"))?.type).toBe("talent");
    expect(findSameTalent([], talent("Дуэлист"))).toBeNull();
    expect(findSameTalent(items, talent("Меткий выстрел"))).toBeNull();
  });

  it("безымянный Талант ни с чем не совпадает", () => {
    expect(isSameTalent(talent(""), talent(""))).toBe(false);
  });
});

// Пикер (module/sheets/item-picker.mjs, kind:"equipment" Конструктора) не
// должен плодить второй предмет при повторной покупке многократного Таланта
// (system.hasRating — Enemy, стр. 62, и т.п.): вместо копии поднимается
// system.rating уже лежащего. Признак стоит на КОНКРЕТНОЙ записи пака, не на
// имени вообще — это отдельная функция от findSameTalent/skillGrantOutcome,
// которые решают судьбу СЛУЧАЙНОГО совпадения из разных источников.
describe("Талант с накоплением ранга (system.hasRating)", () => {
  const rateable = (name, rating = 1) =>
    ({ type: "talent", name, system: { hasRating: true, rating } });

  it("цель для повышения ранга находится только у отмеченных hasRating", () => {
    const items = [talent("Sound Constitution"), rateable("Enemy")];
    expect(repeatableTalentTarget(items, rateable("Enemy"))?.name).toBe("Enemy");
    // Обычный Талант (без hasRating в НОВОЙ покупке) — не цель, даже если на
    // листе уже есть одноимённый: это не тот случай, который чинили.
    expect(repeatableTalentTarget(items, talent("Sound Constitution"))).toBeNull();
  });

  it("не-Талант или ещё не купленный многократный Талант — не цель", () => {
    expect(repeatableTalentTarget([], rateable("Enemy"))).toBeNull();
    expect(repeatableTalentTarget([{ type: "trait", name: "Enemy", system: { hasRating: true, rating: 1 } }],
      rateable("Enemy"))).toBeNull();
  });

  it("повторная покупка поднимает ранг существующему предмету, не создаёт второй", async () => {
    const existing = rateable("Enemy", 1);
    existing.update = vi.fn(async upd => { existing.system.rating = upd["system.rating"]; });
    const actor = { items: [existing], createEmbeddedDocuments: vi.fn() };

    const res = await createOrRankTalent(actor, rateable("Enemy"));

    expect(res).toEqual({ item: existing, ranked: true, rating: 2 });
    expect(existing.update).toHaveBeenCalledWith({ "system.rating": 2 });
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("первая покупка (или обычный Талант) создаёт предмет как раньше", async () => {
    const created = rateable("Enemy", 1);
    const actor = { items: [], createEmbeddedDocuments: vi.fn(async () => [created]) };

    const res = await createOrRankTalent(actor, rateable("Enemy"));

    expect(res).toEqual({ item: created, ranked: false, rating: 1 });
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [rateable("Enemy")]);
  });
});
