// test/data/homeworld-talents-in-pack.test.mjs
//
// Родной мир выдаёт Таланты ПО ИМЕНИ (apps/homeworlds.mjs::buildTalents: английская
// часть до «(» ищется в паке talents). Несуществующее имя («Peers (Criminals)» у
// Мира-тюрьмы, Sahara task-240a) не падает, а молча создаёт пустую заглушку без
// описания и механики — её не узнаёт ни один читатель Таланта. Сторож сверяет
// каждое выданное имя с настоящим паком.

import { describe, it, expect } from "vitest";
import { HOMEWORLDS } from "../../module/constants/homeworlds.mjs";
import { packDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";

const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

/** Все имена Талантов, которые мир может выдать: прямая выдача и варианты выбора. */
function grantedTalentNames(hw) {
  const out = [];
  for (const t of hw.grants?.talents ?? []) out.push(t);
  for (const ch of hw.choices ?? []) {
    for (const o of ch.options ?? []) for (const t of o.grants?.talents ?? []) out.push(t);
  }
  return out;
}

describe("Таланты Родных миров существуют в паке talents", () => {
  const known = new Set(packDocuments("talents", "talent").map(({ doc }) => norm(doc.name.split("/")[0])));

  it("каждое выданное по имени имя находит настоящий Талант", () => {
    const missing = [];
    for (const hw of HOMEWORLDS) {
      for (const full of grantedTalentNames(hw)) {
        const base = norm(/^([^(]+)/.exec(String(full).trim())?.[1]);
        if (!known.has(base)) missing.push(`${hw.key}: «${full}»`);
      }
    }
    expect(missing).toEqual([]);
  }, PACK_SCAN_TIMEOUT);

  it("Мир-тюрьма выдаёт Peer, а не несуществующих «Peers»", () => {
    const prison = HOMEWORLDS.find(h => h.key === "prison");
    expect(grantedTalentNames(prison)).toEqual(["Peer (Criminals)", "Peer (Pirates)"]);
  });
});
