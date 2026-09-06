// test/constants/capability-forms.test.mjs
//
// Форма возможности — что именно игрок обязан помнить (wdbc-m7we).
//
// Панель «ВОЗМОЖНОСТИ СЕЙЧАС» писала у возможности без читателя одно слово:
// «вручную». Честно, но за столом бесполезно: «вручную» у иммунитета и
// «вручную» у способности «раз за бой потратить Очко Бесчестия» — две разные
// заботы, и первая ГМа вообще не касается, пока по персонажу не бьют.
//
// Форма считается ИЗ ПОДПИСИ, а не хранится отдельным полем: поле рядом с
// подписью разъехалось бы с ней при первой правке.

import { describe, it, expect } from "vitest";
import { capabilityForm, capabilityAutoHint } from "../../module/constants/capability-forms.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

describe("capabilityForm — разбор подписи на типовую форму", () => {
  it("иммунитет", () => {
    expect(capabilityForm("Иммунитет к экстремальным температурам").key).toBe("immunity");
  });

  it("раз в X — сделать Y", () => {
    expect(capabilityForm("Полное действие: заражает до 3 трупов в 2м").key).toBe("oncePer");
  });

  it("переброс", () => {
    expect(capabilityForm("Противник должен перебрасывать Успехи").key).toBe("reroll");
  });

  it("модификатор к тесту", () => {
    expect(capabilityForm("+20 к тестам Запугивания против смертных").key).toBe("testMod");
  });

  it("аура", () => {
    expect(capabilityForm("Аура 3м: попадание Rad(1d10) всем в начале Хода").key).toBe("aura");
  });

  it("призыв", () => {
    expect(capabilityForm("Демонический скакун в услужении — призыв ритуалом").key).toBe("summon");
  });

  it("автор прямо написал, что механики нет — это важнее любой другой формы", () => {
    // Подпись нарочно подходит СРАЗУ под две формы. Порядок правил здесь и
    // проверяется: уйди она в immunity, панель пообещала бы игроку, что
    // достаточно ничего не делать, — а на деле механики нет вовсе и всё
    // держится на ГМе.
    const label = "Иммунитет к старению и болезням — не автоматизировано";
    expect(capabilityForm(label).key).toBe("notModelled");
  });

  it("число уже вынесено записью рядом — тоже важнее прочих форм", () => {
    const label = "+20/+30 социальные тесты механизированы тремя записями kind:\"testMod\" на этом же предмете. Capability покрывает ТОЛЬКО остаток";
    expect(capabilityForm(label).key).toBe("partlyMechanized");
  });

  it("сложная нарративная способность формы не получает — врать не надо", () => {
    expect(capabilityForm("Похищает воспоминание жертвы на один день")).toBe(null);
  });

  it("пустая подпись — нет формы", () => {
    expect(capabilityForm("")).toBe(null);
    expect(capabilityForm(null)).toBe(null);
  });
});

describe("capabilityAutoHint — подпись колонки «Считает»", () => {
  it("с читателем: авто, и форма не показывается", () => {
    const hint = capabilityAutoHint(true, "Иммунитет к радиации");
    expect(hint.text).toBe("авто");
    expect(hint.hint).not.toMatch(/иммунитет/i);
  });

  it("без читателя: вручную плюс что именно делать", () => {
    const hint = capabilityAutoHint(false, "Иммунитет к радиации");
    expect(hint.text).toBe("вручную");
    expect(hint.hint).toContain("ГМ не применяет");
  });

  it("без читателя и без узнанной формы — общая, но честная подсказка", () => {
    const hint = capabilityAutoHint(false, "Похищает воспоминание жертвы");
    expect(hint.text).toBe("вручную");
    expect(hint.hint).toContain("по тексту способности");
  });
});

describe("разметка реального реестра", () => {
  const noReader = Object.values(CAPABILITIES)
    .filter(c => !String(c.reader ?? "").trim())
    .map(c => c.label ?? "");

  it("разбор форм не выродился — порог держится", () => {
    // Не декоративный порог: если разбор сломается (например, кто-то поправит
    // регулярку и наступит на кириллическое , см. AGENTS.md), подсказка
    // тихо выродится обратно в бесполезное «вручную», и краснотой это не
    // проявится никак.
    //
    // По ВСЕМУ реестру опознаётся 28% — и это честно: 1369 имён никем не
    // выданы, они заготовка каталога, и половина их подписей — длинный
    // книжный текст про сложную нарративную способность, которая ни на одну
    // типовую форму не ложится. Показательна другая цифра: среди 144
    // возможностей, реально выданных предметами паков (то есть тех, что игрок
    // может встретить), форму получают 76%.
    const known = noReader.filter(l => capabilityForm(l)).length;
    expect(noReader.length).toBeGreaterThan(1000);
    expect(known / noReader.length).toBeGreaterThan(0.2);
  });

  it("каждая форма реестра называет, что делать за столом", () => {
    const empty = noReader.map(capabilityForm).filter(f => f && !f.label.trim());
    expect(empty).toEqual([]);
  });
});
