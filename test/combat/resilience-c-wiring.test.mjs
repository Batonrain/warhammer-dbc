// test/combat/resilience-c-wiring.test.mjs
//
// Таланты Стойкости (глава 3, пакет C): проводка — обработчики кнопок и хуки смены Хода,
// подключение единой точки наложения Состояний к источникам, данные паков и реестр
// Возможностей. Что НЕ подключено, тоже закреплено: тест падает, если кто-то подключит
// добровольное падение к Стене, не пересмотрев описание.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";
import { RESILIENCE_TALENTS } from "../../module/rules/resilience-talents.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const read = p => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("обработчики кнопок и хуки (module/hooks.mjs)", () => {
  const hooks = read("module/hooks.mjs");

  it("кнопки Талантов Критического Эффекта навешены, состояние карточки восстанавливается при показе", () => {
    for (const cls of [".wh-final-push-btn", ".wh-never-die-btn", ".wh-pain-illusion-btn",
      ".wh-final-push-apply-btn", ".wh-shock-death-btn"]) expect(hooks, cls).toContain(`"${cls}"`);
    expect(hooks).toContain("applyCritTalentState(message, html);");
  });

  it("конец Хода носителя и конец боя выкладывают отложенное Последним Рывком", () => {
    expect(hooks).toContain("await finalPushTurnEnd(prevActor);");
    expect(hooks).toContain("await finalPushCombatEnd(combat);");
  });
});

describe("единая точка наложения подключена к источникам", () => {
  // Остальные источники (damage, knockdown, bulldoze, grapple, mount, dread-wail, пилюли, onTargetFail,
  // свойства оружия в hooks.mjs) проверены поведением в test/combat/resilience-c-status.test.mjs.
  const WIRED = {
    // Вырубание (Takedown): «сбить с ног» с карточки урона — чужой эффект, Стена должна спрашиваться.
    "module/combat/takedown.mjs": 'statusApplyFields(target, "prone"',
    // Подрезать Сухожилья (Талант «Рукопашных», 3-8dc5): победа во встречном тесте сбивает с ног — Стена спрашивается.
    "module/combat/hamstring.mjs": 'statusApplyFields(target, "prone"',
    // Пинок с Разворота (Пугилист, 3-eddb): отброс дальше ¼A.b — чужое падение, Стена должна спрашиваться.
    "module/combat/roundhouse.mjs": 'statusApplyFields(target, "prone"',
    // Тяжёлый Хук (Пугилист, 3-eddb): проигрыш во встречном S+0 vs S+0 сбивает с ног — Стена спрашивается.
    "module/combat/pugilist-strikes.mjs": 'statusApplyFields(target, "prone"',
    // Поколотить (Талант Метания, 3-8318): Провал S-теста от тяжёлого метательного сбивает с ног — Стена спрашивается.
    "module/combat/clobber.mjs": 'statusApplyFields(target, "prone"'
  };
  for (const [file, needle] of Object.entries(WIRED)) {
    it(`${file} спрашивает единую точку`, () => expect(read(file)).toContain(needle));
  }

  // Что добровольные падения (Лечь, Залечь, Падай и Перекатывайся, падение с высоты, бросок без опоры)
  // в единую точку не ходят, держит закрытый список её импортёров в тесте ниже.
  it("добровольное падение из меню движения кладёт «Повален» напрямую, без вопроса Стены", () => {
    expect(read("module/combat/movement-actions.mjs")).toContain('conditionApplyFields("prone", null, actor)');
  });

  it("единая точка не ходит в тики, пересчёты и снятия: её зовут только перечисленные файлы", () => {
    const users = [];
    const walk = dir => {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (e.name.endsWith(".mjs") && /from\s+"[^"]*status-resist\.mjs"/.test(read(rel))) users.push(rel);
      }
    };
    walk("module");
    expect(users.sort()).toEqual([
      "module/combat/bulldoze.mjs", "module/combat/clobber.mjs", "module/combat/crit-effect-parser.mjs", "module/combat/damage.mjs",
      "module/combat/dread-wail.mjs", "module/combat/grapple.mjs", "module/combat/hamstring.mjs", "module/combat/knockdown.mjs",
      "module/combat/mount.mjs", "module/combat/pugilist-strikes.mjs", "module/combat/roundhouse.mjs", "module/combat/takedown.mjs", "module/hooks.mjs",
      "module/rules/on-target-fail.mjs"
    ].sort());
  });
});

// Блок в damage.mjs проверен поведением: resilience-c-crit.test.mjs › «карточка урона: кнопки появляются сами».
describe("кнопки Талантов вставлены во вторичный блок Критического Эффекта", () => {
  it("module/combat/secondary-crit.mjs: кнопки Талантов и тест «смерть от шока»", () => {
    const src = read("module/combat/secondary-crit.mjs");
    expect(src).toContain("critTalentsHtml(actor");
    expect(src).toContain("shockDeathButtonHtml(critEffect, actor.uuid");
  });
});

describe("данные паков и реестр Возможностей", () => {
  const FOLDER = "packs-src/talents/Стойкость";

  const docOf = key => {
    const name = fs.readdirSync(path.join(ROOT, FOLDER)).find(n => n.includes(RESILIENCE_TALENTS[key].name.replace(/ /g, "_")));
    return JSON.parse(read(`${FOLDER}/${name}`));
  };

  it("Стена честно названа частично реализованной: «насильно перемещают» не автоматизировано", () => {
    const label = CAPABILITIES["resilience.core.stonewall"].label;
    expect(label).toMatch(/^Реализовано частично/);
    expect(label).toContain("НЕ автоматизировано: «насильно перемещают»");
    expect(docOf("stonewall").system.notes).toContain("НЕ АВТОМАТИЗИРОВАНО");
  });
});
