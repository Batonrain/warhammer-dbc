// Вынос куска showAttackDialog в отдельный файл (wdbc-uh56), по разбору acorn.
//
//   node tools/_uh56-cut.mjs <первая строка> <последняя> <файл> <имя функции> \
//        '["вход",...]' '["выход",...]'
//
// Границы проверяются: концы диапазона обязаны совпадать с границами целых
// операторов верхнего уровня — иначе вырез уносит половину выражения. Шапка
// комментариев перед первым оператором забирается вместе с ним. Повторный
// запуск отменяется, если файл уже есть: однажды второй прогон вынес наружу
// собственный вызов и оставил пустую заглушку.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parse } from "acorn";

const FILE = "module/sheets/attack-dialog.mjs";
const [FROM, TO, OUT, NAME, INJ, OUTJ] = process.argv.slice(2);
const [from, to] = [Number(FROM), Number(TO)];
const IN = JSON.parse(INJ), OUTN = JSON.parse(OUTJ);
if (existsSync(OUT)) throw new Error(`${OUT} уже существует — повторный запуск отменён`);

const src = readFileSync(FILE, "utf8");
const NL = src.includes("\r\n") ? "\r\n" : "\n";
const lines = src.split(NL);
const ast = parse(src, { ecmaVersion: "latest", sourceType: "module", locations: true });
const fn = ast.body.map(n => (n.type === "ExportNamedDeclaration" ? n.declaration : n))
  .find(n => n?.type === "FunctionDeclaration" && n.id?.name === "showAttackDialog");

const inside = fn.body.body.filter(s => s.loc.start.line >= from && s.loc.end.line <= to);
if (!inside.length) throw new Error("в диапазоне нет целых операторов");
if (inside[0].loc.start.line !== from || inside.at(-1).loc.end.line !== to)
  throw new Error(`границы не по операторам: ${inside[0].loc.start.line}–${inside.at(-1).loc.end.line}`);

// Шапка комментариев: назад от начала, пока строки — комментарий или пусто и
// пока не упёрлись в конец предыдущего оператора.
const prevEnd = Math.max(0, ...fn.body.body
  .filter(s => s.loc.end.line < from).map(s => s.loc.end.line));
let head = from;
while (head - 1 > prevEnd && /^\s*(\/\/|$)/.test(lines[head - 2])) head--;

const dedent = l => (l.startsWith("  ") ? l.slice(2) : l);
const body = lines.slice(head - 1, to).map(dedent);

writeFileSync(OUT, [
  `// ${OUT}`,
  "",
  `export function ${NAME}(v) {`,
  "  const {",
  ...IN.map(n => `    ${n},`),
  "  } = v;",
  "",
  ...body.map(l => (l ? "  " + l : l)),
  "",
  `  return { ${OUTN.join(", ")} };`,
  "}",
  ""
].join(NL), "utf8");

const call = [
  `  const { ${OUTN.join(", ")} } = ${NAME}({`,
  ...IN.map(n => `    ${n},`),
  "  });"
];
const res = [...lines];
res.splice(head - 1, to - head + 1, ...call);
writeFileSync(FILE, res.join(NL), "utf8");
console.log(`вынесено строк ${to - head + 1} (с шапкой с ${head}); вход ${IN.length}, выход ${OUTN.length}`);
