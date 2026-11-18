// tools/world-item-usage.mjs
// ════════════════════════════════════════════════════════════════════════
//  СКОЛЬКО ПЕРСОНАЖЕЙ МИРА НЕСУТ КАЖДЫЙ ТАЛАНТ И ЧЕРТУ.
//
//  Нужен замеру tools/automation-coverage.mjs (--usage): чтобы очередь
//  автоматизации начиналась с того, что уже стоит на листах, а не с того,
//  что лежит в компендиуме и никем не взято.
//
//  Читает базу актёров мира (LevelDB, `<мир>/data/actors`). Пока мир открыт в
//  Foundry, база заперта — укажите КОПИЮ папки. Считаются только актёры типа
//  character; служебные «ТЕСТ_…» пропускаются. Один персонаж с двумя копиями
//  предмета считается один раз.
//
//  Запуск: node tools/world-item-usage.mjs <папка actors> [out.json]
// ════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import { ClassicLevel } from "classic-level";

export async function itemUsage(dir, { types = ["talent", "trait"] } = {}) {
  const db = new ClassicLevel(dir, { valueEncoding: "json" });
  const actors = new Map();
  const items = [];
  try {
    for await (const [k, v] of db.iterator()) {
      if (k.startsWith("!actors!")) actors.set(v._id, v);
      else if (k.startsWith("!actors.items!")) items.push({ actor: k.split("!")[2].split(".")[0], name: v?.name, type: v?.type });
    }
  } finally {
    await db.close();
  }
  const counted = new Set(
    [...actors.values()].filter(a => a.type === "character" && !/^ТЕСТ/i.test(a.name || "")).map(a => a._id));
  const seen = new Map();
  for (const it of items) {
    if (!counted.has(it.actor) || !types.includes(it.type) || !it.name) continue;
    if (!seen.has(it.name)) seen.set(it.name, new Set());
    seen.get(it.name).add(it.actor);
  }
  return {
    characters: counted.size,
    usage: Object.fromEntries([...seen].map(([n, s]) => [n, s.size]).sort((a, b) => b[1] - a[1]))
  };
}

if (process.argv[1] && process.argv[1].endsWith("world-item-usage.mjs")) {
  const [dir, out] = process.argv.slice(2);
  if (!dir) { console.error("укажите папку actors (копию, если мир открыт)"); process.exit(1); }
  const r = await itemUsage(dir);
  if (out) fs.writeFileSync(out, JSON.stringify(r.usage, null, 1));
  console.log(`персонажей: ${r.characters}, разных Талантов и Черт: ${Object.keys(r.usage).length}`);
}
