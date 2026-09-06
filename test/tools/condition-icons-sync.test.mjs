// test/tools/condition-icons-sync.test.mjs
//
// Иконки Состояний на токене (wdbc-ahtb.1) — статические файлы
// assets/conditions/<key>.svg, сгенерированные tools/build-condition-
// icons.mjs из body/color в module/constants/conditions.mjs. Файлы
// коммитятся как артефакт (тот же приём, что packs/, собранные из
// packs-src/) — этот тест ловит, если кто-то поправил body/color в
// constants/conditions.mjs и забыл перегенерировать файлы: движок тогда
// продолжит показывать СТАРЫЙ глиф на токене, тег на листе — новый.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CONDITIONS } from "../../module/constants/conditions.mjs";
import { conditionIconSvg, conditionIconAssetPath, CONDITIONS_ICON_DIR } from "../../tools/build-condition-icons.mjs";

describe("assets/conditions/*.svg не расходятся с constants/conditions.mjs", () => {
  const keys = Object.keys(CONDITIONS);

  it("реестр не выродился в пустышку", () => {
    expect(keys.length).toBeGreaterThan(20);
  });

  it("у каждого Состояния есть файл на диске, и он дословно совпадает со свежесгенерированным", () => {
    const problems = [];
    for (const key of keys) {
      const file = join(CONDITIONS_ICON_DIR, `${key}.svg`);
      if (!existsSync(file)) { problems.push(`нет файла: ${file}`); continue; }
      const onDisk = readFileSync(file, "utf8");
      const fresh  = conditionIconSvg(key);
      if (onDisk !== fresh) problems.push(`${key}.svg устарел — перегенерировать: node tools/build-condition-icons.mjs`);
    }
    expect(problems).toEqual([]);
  });

  it("лишних файлов на диске нет (снятый ключ должен снять и файл)", () => {
    const onDisk = readdirSync(CONDITIONS_ICON_DIR).map(f => f.replace(/\.svg$/, ""));
    const extra = onDisk.filter(k => !keys.includes(k));
    expect(extra).toEqual([]);
  });

  it("conditionIconAssetPath отдаёт путь, который проходит FilePathField Foundry (есть расширение, не data:)", () => {
    const p = conditionIconAssetPath("bleeding");
    expect(p).toBe("systems/warhammer-dbc/assets/conditions/bleeding.svg");
    expect(p).not.toMatch(/^data:/);
  });
});
