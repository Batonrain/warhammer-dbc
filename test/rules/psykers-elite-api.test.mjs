// Ленивый API кнопок пачки «psykers» (приёмка #597): elite-api/psykers.mjs
// разворачивал WILD_PSYKER_API и др. на верхнем уровне. Цикл
// combat/<модуль> → … → apps/mechanics.mjs → item-script.mjs → elite-api →
// combat/<модуль> давал в настоящем ESM «Cannot access 'WILD_PSYKER_API'
// before initialization», если модуль кнопок импортировали первым. Загрузчик
// vitest цикл прощает (отдаёт undefined, `...undefined` не падает), поэтому
// импорт проверяется отдельным процессом Node.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";
import "../support/foundry-stub.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const MODULES = {
  "wild-psyker": "WILD_PSYKER_API", archmagus: "ARCHMAGUS_API", insorcist: "INSORCIST_API",
  kenetai: "KENETAI_API", medusa: "MEDUSA_API", warlock: "WARLOCK_API"
};

describe("API пачки psykers", () => {
  it.each(Object.keys(MODULES))("combat/%s.mjs импортируется первым (Node ESM) без TDZ", name => {
    const out = execFileSync(process.execPath, ["--input-type=module", "-e",
      `await import("./test/support/foundry-stub.mjs");
       try { await import("./module/combat/${name}.mjs"); console.log("ok"); } catch (e) { console.log(e.message); }`],
    { cwd: ROOT, encoding: "utf8" }).trim().split("\n").pop();
    expect(out).toBe("ok");
  }, 60000);

  it("все ключи — функции, и каждая есть в своём модуле", async () => {
    const { API } = await import("../../module/combat/elite-api/psykers.mjs");
    const all = [];
    for (const [name, api] of Object.entries(MODULES)) {
      const keys = Object.keys((await import(`../../module/combat/${name}.mjs`))[api]);
      all.push(...keys);
      for (const k of keys) expect(typeof API[k], k).toBe("function");
    }
    expect(Object.keys(API).sort()).toEqual(all.sort());
  }, 120000);
});
