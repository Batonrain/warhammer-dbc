// Анатомия showAttackDialog по настоящему разбору (wdbc-uh56).
// Самописный подсчёт скобок врал; здесь acorn, который уже в зависимостях.
import { readFileSync } from "node:fs";
import { parse } from "acorn";

const FILE = "module/sheets/attack-dialog.mjs";
const src = readFileSync(FILE, "utf8");
const ast = parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true });

const lineOf = (node) => [node.loc.start.line, node.loc.end.line];
const size = (node) => node.loc.end.line - node.loc.start.line + 1;

const fn = ast.body
  .map(n => (n.type === "ExportNamedDeclaration" ? n.declaration : n))
  .find(n => n?.type === "FunctionDeclaration" && n.id?.name === "showAttackDialog");

const [from, to] = lineOf(fn);
console.log(`showAttackDialog: строки ${from}–${to} (${to - from + 1})`);

const stmts = fn.body.body.map(s => ({ size: size(s), line: s.loc.start.line, type: s.type,
  head: src.split("\n")[s.loc.start.line - 1].trim().slice(0, 62) }));
console.log(`операторов верхнего уровня: ${stmts.length}\n`);
console.log("самые крупные:");
for (const s of [...stmts].sort((a, b) => b.size - a.size).slice(0, 12))
  console.log(`  ${String(s.size).padStart(5)} строк  стр.${String(s.line).padStart(5)}  ${s.head}`);

// Сколько строк занято шаблонными литералами — по узлам, а не по кавычкам.
const tplLines = new Set();
const walk = (n) => {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach(walk);
  if (n.type === "TemplateLiteral" && n.loc) {
    for (let l = n.loc.start.line; l <= n.loc.end.line; l++)
      if (l >= from && l <= to) tplLines.add(l);
  }
  for (const k of Object.keys(n)) if (k !== "loc" && k !== "start" && k !== "end") walk(n[k]);
};
walk(fn);
console.log(`\nстрок внутри шаблонных литералов: ${tplLines.size} из ${to - from + 1}`);

// Вложенные функции — сколько строк живёт в них.
const nested = [];
const walkFn = (n, depth = 0) => {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach(x => walkFn(x, depth));
  if (depth > 0 && (n.type === "FunctionDeclaration" || n.type === "FunctionExpression"
                    || n.type === "ArrowFunctionExpression") && n.loc && size(n) > 8)
    nested.push({ size: size(n), line: n.loc.start.line, name: n.id?.name ?? "(без имени)" });
  for (const k of Object.keys(n)) if (k !== "loc" && k !== "start" && k !== "end") walkFn(n[k], depth + 1);
};
walkFn(fn);
nested.sort((a, b) => b.size - a.size);
console.log(`\nвложенных функций длиннее 8 строк: ${nested.length}`);
for (const f of nested.slice(0, 10)) console.log(`  ${String(f.size).padStart(5)} строк  стр.${String(f.line).padStart(5)}  ${f.name}`);
