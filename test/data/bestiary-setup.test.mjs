// test/data/bestiary-setup.test.mjs
//
// Вариации существ бестиария описаны данными во флаге `warhammer-dbc.setup`
// (см. module/rules/actor-setup.mjs). Ссылки в них — UUID компендиумов, и
// битая ссылка молча оставит ГМа без предмета: диалог покажет «⚠ не найдено»
// уже за столом. Поэтому данные проверяются на настоящих packs-src, а не на
// выдуманном примере.

import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LIBRARY_PACKS, abs } from "../../tools/packs.mjs";
import { readSetup, defaultAnswers, buildSetupPlan } from "../../module/rules/actor-setup.mjs";
import { SKILL_RANKS } from "../../module/constants/characteristics.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../../module/constants/skills.mjs";

/** Все документы паков: UUID компендиума → тип. */
function packIndex() {
  const byUuid = new Map();
  for (const pack of LIBRARY_PACKS) {
    const dir = abs(pack.src);
    if (!existsSync(dir)) continue;
    for (const e of readdirSync(dir, { withFileTypes: true, recursive: true })) {
      if (e.isDirectory() || !e.name.endsWith(".json") || e.name.startsWith("_")) continue;
      const doc = JSON.parse(readFileSync(join(e.parentPath ?? e.path, e.name), "utf8"));
      byUuid.set(`Compendium.warhammer-dbc.${pack.name}.${doc._id}`, doc.type);
    }
  }
  return byUuid;
}

/** Акторы бестиария с описанием вариаций. */
function actorsWithSetup() {
  const dir = abs("packs-src/bestiary");
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (e.isDirectory() || !e.name.endsWith(".json") || e.name.startsWith("_")) continue;
    const doc = JSON.parse(readFileSync(join(e.parentPath ?? e.path, e.name), "utf8"));
    const setup = readSetup(doc);
    if (setup) out.push({ name: doc.name, doc, setup });
  }
  return out;
}

const INDEX = packIndex();
const ACTORS = actorsWithSetup();

/** Все UUID описания: и прямые выдачи, и вложенные списки выбора. */
function uuidsOf(setup) {
  const out = [];
  for (const g of setup.groups) {
    for (const o of g.options) {
      out.push(...o.add);
      for (const p of o.pick) out.push(...p.from);
    }
  }
  return out;
}

describe("вариации бестиария: данные паков", () => {
  it("описания вообще есть — иначе проверка ничего не проверяет", () => {
    expect(ACTORS.length).toBeGreaterThan(0);
  });

  it.each(ACTORS.map(a => [a.name, a]))("%s: ссылки ведут в паки", (_n, actor) => {
    const broken = uuidsOf(actor.setup).filter(u => !INDEX.has(u));
    expect(broken).toEqual([]);
  });

  it.each(ACTORS.map(a => [a.name, a]))("%s: ключи групп и вариантов уникальны", (_n, actor) => {
    const groups = actor.setup.groups.map(g => g.key);
    expect(groups).toEqual([...new Set(groups)]);
    for (const g of actor.setup.groups) {
      const keys = g.options.map(o => o.key);
      expect(keys).toEqual([...new Set(keys)]);
    }
  });

  it.each(ACTORS.map(a => [a.name, a]))("%s: вариант по умолчанию существует", (_n, actor) => {
    for (const g of actor.setup.groups) {
      if (g.mode === "many" || !g.default) continue;
      expect(g.options.map(o => o.key)).toContain(g.default);
    }
  });

  it.each(ACTORS.map(a => [a.name, a]))("%s: базовый выбор ничего не меняет", (_n, actor) => {
    const plan = buildSetupPlan(actor.setup, defaultAnswers(actor.setup));
    expect(plan.warnings).toEqual([]);
    expect(plan.isEmpty).toBe(true);
  });

  it.each(ACTORS.map(a => [a.name, a]))("%s: снимаемое оружие на листе есть", (_n, actor) => {
    const items = actor.doc.items || [];
    const missing = [];
    for (const g of actor.setup.groups) {
      for (const o of g.options) {
        for (const r of o.remove) {
          const found = items.some(i => (!r.type || i.type === r.type)
            && String(i.name).trim().toLowerCase() === String(r.name).trim().toLowerCase());
          if (!found) missing.push(`${o.key} → ${r.name}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it.each(ACTORS.map(a => [a.name, a]))("%s: правки полей ведут в живые поля актора", (_n, actor) => {
    const bad = [];
    for (const g of actor.setup.groups) {
      for (const o of g.options) {
        for (const path of Object.keys(o.system)) {
          // Навыки правятся рангом: ключ навыка обязан быть из реестра, иначе
          // правка молча ляжет мимо схемы (грабли из AGENTS.md).
          const skill = path.match(/^skills\.([^.]+)\./);
          if (skill && !SKILLS_DEF[skill[1]]) { bad.push(path); continue; }
          if (path.endsWith(".rank") && !SKILL_RANKS[o.system[path]]) bad.push(`${path}=${o.system[path]}`);
        }
        for (const gs of o.groupSkills) {
          if (!GROUP_SKILLS_DEF[gs.group]) bad.push(`groupSkills.${gs.group}`);
          if (!SKILL_RANKS[gs.rank]) bad.push(`${gs.group}:${gs.rank}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
