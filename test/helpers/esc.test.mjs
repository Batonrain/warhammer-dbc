import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import "../support/foundry-stub.mjs";
import { esc } from "../../module/helpers/utils.mjs";

const root = path.resolve(import.meta.dirname, "../..");

/** Все .mjs модуля — по ним идут инварианты ниже. */
function moduleFiles(dir = path.join(root, "module"), out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) moduleFiles(p, out);
    else if (e.name.endsWith(".mjs")) out.push(p);
  }
  return out;
}
const FILES = moduleFiles();
const rel = p => path.relative(root, p);

describe("esc", () => {
  it("экранирует всё, чем можно выйти из текста и из атрибута", () => {
    expect(esc(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#x27;");
  });

  // Локальные копии писали String(s ?? ""): без этого пустое поле выводилось
  // бы словом «null», а Foundry в escapeHTML такого не делает.
  it("пустое значение даёт пустую строку, а не «null»", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
    expect(esc(0)).toBe("0");
  });
});

// ── Инвариант 1: экранирование одно на проект ────────────────────────────────
// Двадцать четыре локальные копии разошлись: часть не закрывала ">", часть '"',
// а creation.mjs — только "<". Пока копию легко завести, разойдутся и новые.
describe("своих экранировщиков в module/ нет", () => {
  it("нигде не собирают HTML-сущности через .replace", () => {
    const guilty = FILES.filter(f => {
      const flat = fs.readFileSync(f, "utf8").replace(/\s+/g, "");
      return /\.replace\([^;]{0,200}?(&amp;|&lt;|&gt;|&quot;)/.test(flat);
    }).map(rel);
    expect(guilty, "заменить на esc из helpers/utils.mjs").toEqual([]);
  });
});

// ── Инвариант 2: имена в диалогах экранированы ───────────────────────────────
// content диалога разбирается как HTML, а имена предметов и акторов задаёт
// игрок у себя на листе — разметка в названии исполняется у того, кто диалог
// видит, обычно у ГМа (wdbc-84g).
describe("Dialog.confirm", () => {
  /** Строки одного вызова confirm: до строки, закрывающей его «})». */
  function confirmBlocks(src) {
    const lines = src.split("\n");
    const blocks = [];
    for (let i = 0; i < lines.length; i++) {
      const at = lines[i].search(/\b(Dialog|DialogV2)\.confirm\(/);
      if (at < 0) continue;
      if (lines[i].slice(at).includes("})")) { blocks.push(lines[i]); continue; }
      const rest = [lines[i]];
      while (++i < lines.length) { rest.push(lines[i]); if (/^\s*\}\)/.test(lines[i])) break; }
      blocks.push(rest.join("\n"));
    }
    return blocks;
  }

  /** Только content: заголовок окна рисуется текстом, экранировать его нельзя —
   *  в шапке появится сам «&amp;». */
  const contentOf = block => block.slice(Math.max(0, block.indexOf("content:")));

  it("имена и названия подставляются только через esc", () => {
    const guilty = [];
    for (const f of FILES) {
      for (const block of confirmBlocks(fs.readFileSync(f, "utf8"))) {
        for (const [, expr] of contentOf(block).matchAll(/\$\{([^}]*)\}/g)) {
          if (!/\b\w*(name|label)\b/i.test(expr)) continue;
          if (/\besc\(|escapeHTML\(/.test(expr)) continue;
          guilty.push(`${rel(f)}: \${${expr}}`);
        }
      }
    }
    expect(guilty).toEqual([]);
  });

  // Проверка самой проверки: без неё блоки могли бы разбираться пустыми и
  // инвариант выше был бы зелёным всегда.
  it("разбор находит все вызовы confirm в проекте", () => {
    const n = FILES.reduce((s, f) => s + confirmBlocks(fs.readFileSync(f, "utf8")).length, 0);
    expect(n).toBe(FILES.reduce(
      (s, f) => s + (fs.readFileSync(f, "utf8").match(/\b(Dialog|DialogV2)\.confirm\(/g) || []).length, 0));
    expect(n).toBeGreaterThan(10);
  });
});
