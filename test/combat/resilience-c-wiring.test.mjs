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

  it("свойства оружия спрашивают Стальную Челюсть / Стену только на реально накладываемых Состояниях", () => {
    expect(hooks).toContain("await offerStatusResist(actor, cond, { source: label });");
  });
});

describe("единая точка наложения подключена к источникам", () => {
  const WIRED = {
    "module/combat/damage.mjs": 'statusApplyFields(actor, "stunned"',
    "module/combat/knockdown.mjs": 'statusApplyFields(target, "prone"',
    "module/combat/bulldoze.mjs": 'statusApplyFields(target, "prone"',
    "module/combat/grapple.mjs": 'statusApplyFields(partner, "prone"',
    "module/combat/mount.mjs": 'statusApplyFields(rider, "prone"',
    "module/combat/dread-wail.mjs": 'statusApplyFields(targetActor, "stunned"',
    "module/combat/crit-effect-parser.mjs": "offerStatusResist(actor, key",
    "module/rules/on-target-fail.mjs": "offerStatusResist(effectTargetActor, key",
    "module/hooks.mjs": "offerStatusResist(actor, cond"
  };
  for (const [file, needle] of Object.entries(WIRED)) {
    it(`${file} спрашивает единую точку`, () => expect(read(file)).toContain(needle));
  }

  it("добровольные и самонанесённые падения в единую точку НЕ ходят (Лечь, Залечь, Падай и Перекатывайся, падение с высоты, бросок без опоры)", () => {
    for (const file of ["module/combat/extinguish.mjs", "module/combat/suppression.mjs",
      "module/combat/improvised-item.mjs"]) expect(read(file), file).not.toContain("status-resist.mjs");
    const move = read("module/combat/movement-actions.mjs");
    expect(move).not.toContain("status-resist.mjs");
    expect(move).toContain('conditionApplyFields("prone", null, actor)');
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
      "module/combat/bulldoze.mjs", "module/combat/crit-effect-parser.mjs", "module/combat/damage.mjs",
      "module/combat/dread-wail.mjs", "module/combat/grapple.mjs", "module/combat/knockdown.mjs",
      "module/combat/mount.mjs", "module/hooks.mjs", "module/rules/on-target-fail.mjs"
    ].sort());
  });
});

describe("кнопки Талантов вставлены в оба блока Критического Эффекта", () => {
  for (const file of ["module/combat/damage.mjs", "module/combat/secondary-crit.mjs"]) {
    it(`${file}: кнопки Талантов и тест «смерть от шока»`, () => {
      const src = read(file);
      expect(src).toContain("critTalentsHtml(actor");
      expect(src).toContain("shockDeathButtonHtml(critEffect, actor.uuid");
    });
  }
});

describe("данные паков и реестр Возможностей", () => {
  const FOLDER = "packs-src/talents/Стойкость";
  const PACK_C = ["ironJaw", "stonewall", "finalPush", "neverDie", "painIsAnIllusion", "dieHard"];

  const docOf = key => {
    const name = fs.readdirSync(path.join(ROOT, FOLDER)).find(n => n.includes(RESILIENCE_TALENTS[key].name.replace(/ /g, "_")));
    return JSON.parse(read(`${FOLDER}/${name}`));
  };

  for (const key of PACK_C) {
    it(`${RESILIENCE_TALENTS[key].name}: запись Конструктора, notes «МЕХАНИЗИРОВАНО», читатель в реестре`, () => {
      const doc = docOf(key);
      const entries = doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
      expect(entries).toHaveLength(1);
      expect(entries[0].kind).toBe("capability");
      expect(entries[0].capabilityKey).toBe(RESILIENCE_TALENTS[key].key);
      expect(entries[0].capabilityMode).toBe("flag");
      expect(entries[0].id).toMatch(/^[A-Za-z0-9]{16}$/);
      expect(doc.flags["warhammer-dbc"].mechanics[0].id).toMatch(/^[A-Za-z0-9]{16}$/);
      expect(doc.system.notes).toMatch(/^МЕХАНИЗИРОВАНО/);
      const cap = CAPABILITIES[RESILIENCE_TALENTS[key].key];
      expect(cap.reader).toBeTruthy();
      expect(cap.label).toMatch(/^Реализовано/);
    });
  }

  it("файлы, названные читателями, существуют", () => {
    for (const key of PACK_C) {
      const reader = CAPABILITIES[RESILIENCE_TALENTS[key].key].reader;
      for (const file of reader.match(/module\/[\w/.-]+\.mjs/g)) {
        expect(fs.existsSync(path.join(ROOT, file)), file).toBe(true);
      }
    }
  });

  it("Стена честно названа частично реализованной: «насильно перемещают» не автоматизировано", () => {
    const label = CAPABILITIES["resilience.core.stonewall"].label;
    expect(label).toMatch(/^Реализовано частично/);
    expect(label).toContain("НЕ автоматизировано: «насильно перемещают»");
    expect(docOf("stonewall").system.notes).toContain("НЕ АВТОМАТИЗИРОВАНО");
  });

  it("текст benefit Талантов не тронут (сверка главы 3 — вне пакета C)", () => {
    expect(docOf("ironJaw").system.benefit).toContain("тест на Т+0");
    expect(docOf("stonewall").system.benefit).toContain("S+0");
  });
});
