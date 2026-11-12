// test/rules/patron-lock-elite.test.mjs
//
// «Не может потерять покровительство <Бога>» у ЭЛИТНЫХ АРХЕТИПОВ (Шумовой
// Десантник, Чумной, Берсерк Кхорна, Колдун Рубрики, Воин Ноты, Ворон и т. д.).
// Замок (rules/patron-lock.mjs) придумывался для субрас Зверолюда, а у архетипов
// его набрали записью Конструктора kind:"capability" patron.locked.<бог>.
// Тест проверяет НАСТОЯЩУЮ запись из packs-src: что предмет типа eliteArchetype
// с такой записью даёт актору флаг, который читает хук preUpdateActor, и что
// смена Покровителя откатывается.

import "../support/foundry-stub.mjs";
import { stubDocument } from "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { lockedPatron, enforcedPatron, patronLockMessage } from "../../module/rules/patron-lock.mjs";

// Noise Marine / Шумовой Десантник (по идентификатору, не по имени файла).
const NOISE_MARINE_ID = "i3Uz3OiHGq3UwMcK";

function archetypeItemFromPack(id) {
  const rec = packDocById("packs-src/elite-archetypes/Космодесантник", id);
  return stubDocument({
    id: "arch1", name: rec.name, type: "eliteArchetype", isOwner: true,
    system: rec.system, flags: rec.flags
  });
}

function flagsOf(items) {
  const set = new Set();
  for (const rule of rulesFromItemMechanics(items)) {
    for (const e of rule.effects ?? []) if (e.kind === "grantFlag") set.add(String(e.target).replace(/^flag:/, ""));
  }
  return set;
}

describe("замок Покровительства у предмета Элитного архетипа", () => {
  it("запись Шумового Десантника даёт замок patron.locked.slaanesh", () => {
    const flags = flagsOf([archetypeItemFromPack(NOISE_MARINE_ID)]);
    expect(lockedPatron(flags)).toBe("slaanesh");
  });

  it("попытка сменить Покровителя на Кхорна откатывается к Слаанеш", () => {
    const locked = lockedPatron(flagsOf([archetypeItemFromPack(NOISE_MARINE_ID)]));
    expect(enforcedPatron("khorne", locked)).toBe("slaanesh");
    expect(enforcedPatron("slaanesh", locked)).toBe("slaanesh");
  });
});

describe("patronLockMessage — текст предупреждения", () => {
  it("называет источник замка, а не только «субраса»", () => {
    const msg = patronLockMessage("Гаррик", ["Noise Marine / Шумовой Десантник"]);
    expect(msg).toContain("Гаррик");
    expect(msg).toContain("Noise Marine / Шумовой Десантник");
    expect(msg).not.toMatch(/субраса не может/);
  });

  it("без подписей источника — нейтральный текст", () => {
    expect(patronLockMessage("Гаррик", [])).toContain("Покровитель оставлен прежним");
  });
});
