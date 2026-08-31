// test/module-link-check.test.mjs
//
// Настоящая линковка ES-модулей всего графа входа. vitest (vite SSR)
// резолвит импорты ЛЕНИВО: отсутствующий именованный экспорт всплывает только
// при использовании привязки, поэтому «export забыли» проходит все гейты, а
// живой Foundry падает на загрузке белым экраном (найдено на WC_CODE,
// wdbc-jr93: SyntaxError до выполнения, ни один тест не красный).
// Здесь модуль линкует сам node: ошибки линковки/резолва — провал, ошибки
// ВЫПОЛНЕНИЯ (нет глобалей Foundry: Hooks, game…) — норма, их гасим.

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import process from "node:process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

describe("линковка ES-модулей", () => {
  it("warhammer-dbc.mjs линкуется целиком (все именованные экспорты существуют)", () => {
    const script = `
      import(${JSON.stringify(path.join(ROOT, "warhammer-dbc.mjs"))})
        .then(() => { console.log("LINK_OK"); process.exit(0); })
        .catch(e => {
          const msg = String(e && e.message || e);
          const linkError = msg.includes("does not provide an export")
            || msg.includes("Cannot find module")
            || msg.includes("Unexpected token");
          console.error(msg);
          process.exit(linkError ? 1 : 0);   // рантайм (ReferenceError: Hooks…) — не линковка
        });
    `;
    let out = "";
    try {
      out = execFileSync(process.execPath, ["--input-type=module", "-e", script],
        { encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      throw new Error(`граф модулей не линкуется:\n${e.stderr || e.stdout || e.message}`);
    }
    expect(out).toBeDefined();
  }, 60000);
});
