import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith(".json")) out.push(p);
  }
  return out;
}

for (const root of ["packs-src/gear", "packs-src/tools"]) {
  const files = walk(root);
  const noNum = [];
  for (const f of files) {
    const doc = JSON.parse(fs.readFileSync(f, "utf8"));
    const hasFlag = doc.flags?.["warhammer-dbc"]?.mechanics?.length > 0;
    const text = doc.system?.effect ?? "";
    if (hasFlag) continue;
    if (/[0-9]/.test(text)) continue;
    noNum.push({ file: f.split(path.sep).join("/"), name: doc.name, text });
  }
  const outName = root.replace(/\//g, "_") + "_nonum.json";
  console.log(root, noNum.length, "->", outName);
  fs.writeFileSync(outName, JSON.stringify(noNum, null, 2));
}
