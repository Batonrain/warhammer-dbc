import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith(".json") && e.name !== "_Folder.json") out.push(p);
  }
  return out;
}

function clean(s) {
  return (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

for (const [root, kind] of [["packs-src/psychic-powers", "psy"], ["packs-src/tech-powers", "tech"]]) {
  const files = walk(root).sort();
  const rows = files.map(f => {
    const doc = JSON.parse(fs.readFileSync(f, "utf8"));
    const s = doc.system || {};
    const base = {
      f: f.split(path.sep).join("/"), n: doc.name,
      pt: kind === "psy" ? s.powerType : s.miracleType,
      sust: kind === "psy" ? !!s.sustainable : undefined,
      dmg: !!(s.damage || s.charDamageStat),
      eff: clean(s.effect)
    };
    return base;
  });
  fs.writeFileSync(`tools/_jw81_${kind}.jsonl`, rows.map(r => JSON.stringify(r)).join("\n") + "\n");
  console.log(root, rows.length, "-> tools/_jw81_" + kind + ".jsonl");
}
