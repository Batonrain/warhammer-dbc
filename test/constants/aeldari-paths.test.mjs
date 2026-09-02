// test/constants/aeldari-paths.test.mjs
//
// module/constants/aeldari-paths.mjs — Пути Азуриан (заменяют Мировоззрение):
// каталог путей/градаций, HTML-опции селектов и суммарные пассивные
// авто-бонусы по достигнутым градациям (computePathPassives).

import { describe, it, expect } from "vitest";
import {
  AZURIANE_PATHS, PATH_GRADES, PATH_GRADE_ORDER, PATH_GROUPS,
  buildPathSelectOptions, buildGradeSelectOptions, computePathPassives
} from "../../module/constants/aeldari-paths.mjs";

describe("AZURIANE_PATHS: структурная целостность", () => {
  it("у каждого пути есть хотя бы градация «Новичок»", () => {
    for (const [key, p] of Object.entries(AZURIANE_PATHS)) {
      expect(p.grades.novice, key).toBeTruthy();
    }
  });

  it("все ключи градаций путей — подмножество PATH_GRADE_ORDER", () => {
    for (const [key, p] of Object.entries(AZURIANE_PATHS)) {
      for (const g of Object.keys(p.grades)) expect(PATH_GRADE_ORDER, `${key}.${g}`).toContain(g);
    }
  });

  it("PATH_GROUPS ссылаются на реально используемые группы путей", () => {
    const used = new Set(Object.values(AZURIANE_PATHS).map(p => p.group).filter(Boolean));
    for (const g of PATH_GROUPS) expect(used.has(g), g).toBe(true);
  });

  it("у каждой градации с auto.charBonus/corLimit значения положительные (это бонусы, не штрафы)", () => {
    for (const [key, p] of Object.entries(AZURIANE_PATHS)) {
      for (const [gradeKey, g] of Object.entries(p.grades)) {
        if (!g.auto) continue;
        if (g.auto.charBonus) {
          for (const v of Object.values(g.auto.charBonus)) expect(v, `${key}.${gradeKey}`).toBeGreaterThan(0);
        }
        if (g.auto.corLimit != null) expect(g.auto.corLimit, `${key}.${gradeKey}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("buildPathSelectOptions", () => {
  it("содержит опцию для каждого пути, отмечает выбранный selected", () => {
    const html = buildPathSelectOptions("warlock");
    for (const key of Object.keys(AZURIANE_PATHS)) expect(html).toContain(`value="${key}"`);
    expect(html).toContain('value="warlock" selected');
  });

  it("группирует пути по PATH_GROUPS плюс отдельная группа «Прочие Пути» для одиночных", () => {
    const html = buildPathSelectOptions();
    for (const grp of PATH_GROUPS) expect(html).toContain(`<optgroup label="${grp}">`);
    expect(html).toContain('<optgroup label="Прочие Пути">');
  });
});

describe("buildGradeSelectOptions", () => {
  it("перечисляет только реально заданные у пути градации, в книжном порядке", () => {
    const html = buildGradeSelectOptions(AZURIANE_PATHS.warlock, "next");
    for (const g of PATH_GRADE_ORDER) expect(html).toContain(`>${PATH_GRADES[g]}<`);
    expect(html).toContain('value="next" selected');
  });

  it("путь без градаций (undefined) — пустая строка, не бросает исключение", () => {
    expect(buildGradeSelectOptions(null, "novice")).toBe("");
  });
});

describe("computePathPassives", () => {
  it("не-массив на входе — нулевой результат", () => {
    expect(computePathPassives(null)).toEqual({ charBonus: {}, corLimit: 0 });
    expect(computePathPassives(undefined)).toEqual({ charBonus: {}, corLimit: 0 });
  });

  it("неизвестный путь/градация в списке — пропускается молча", () => {
    expect(computePathPassives([{ key: "no-such-path", grade: "novice" }])).toEqual({ charBonus: {}, corLimit: 0 });
    expect(computePathPassives([{ key: "warlock", grade: "no-such-grade" }])).toEqual({ charBonus: {}, corLimit: 0 });
  });

  it("charBonus суммируется по ВСЕМ градациям от Новичка до выбранной внутри пути", () => {
    // warlock: next и lost оба несут auto.charBonus.wp:2 — на градации lost
    // (индекс 3) должны учесться оба прохода (next тоже пройден по пути).
    expect(computePathPassives([{ key: "warlock", grade: "next" }]).charBonus).toEqual({ wp: 2 });
    expect(computePathPassives([{ key: "warlock", grade: "lost" }]).charBonus).toEqual({ wp: 4 });
  });

  it("corLimit внутри ОДНОГО пути берётся максимумом, не суммой (одно и то же стоячее значение книги)", () => {
    // damnation: novice/next/master все несут corLimit:25 — на градации master
    // (пройдены все три) результат должен остаться 25, а не 75.
    expect(computePathPassives([{ key: "damnation", grade: "novice" }]).corLimit).toBe(25);
    expect(computePathPassives([{ key: "damnation", grade: "master" }]).corLimit).toBe(25);
  });

  it("corLimit СУММИРУЕТСЯ между РАЗНЫМИ путями персонажа", () => {
    const r = computePathPassives([
      { key: "damnation", grade: "novice" },
      { key: "damnation", grade: "novice" }
    ]);
    // Тот же путь дважды в списке — не книжный сценарий, но функция не
    // дедуплицирует по paths[], только внутри одного пройденного пути.
    expect(r.corLimit).toBe(50);
  });

  it("charBonus СУММИРУЕТСЯ между разными путями персонажа", () => {
    const r = computePathPassives([
      { key: "warlock", grade: "next" },
      { key: "spiritseer", grade: "next" }
    ]);
    expect(r.charBonus).toEqual({ wp: 4 });
  });

  it("путь без auto ни на одной градации (например «Путь Игрока») — не добавляет ничего", () => {
    expect(computePathPassives([{ key: "player", grade: "lost" }])).toEqual({ charBonus: {}, corLimit: 0 });
  });
});
