// dbc-152: записи Конструктора, выдающие Peer/Hatred/Enemy/Good Reputation, несут цели.
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../packs-src");
const find = (dir, prefix) => {
  const d = path.join(ROOT, dir);
  return JSON.parse(fs.readFileSync(path.join(d, fs.readdirSync(d).find(f => f.startsWith(prefix))), "utf8"));
};
const talents = (doc, name) => {
  const out = [];
  const v = o => {
    if (Array.isArray(o)) o.forEach(v);
    else if (o && typeof o === "object") {
      if (o.kind === "talent" && String(o.sourceName ?? "").startsWith(name + " ")) out.push(o); else for (const k in o) v(o[k]);
    }
  };
  v(doc.flags);
  return out;
};
const keys = e => (e.targets ?? []).map(t => `${t.kind}:${t.ref || t.value}`);

describe("цели Талантов, выданных Архетипами", () => {
  it("Азурианские архетипы целятся в покровителей и Хаос по книге", () => {
    expect(keys(talents(find("elite-archetypes/Азуриане", "Chosen_of_Isha"), "Hatred")[0])).toEqual(["patron:nurgle"]);
    expect(keys(talents(find("elite-archetypes/Азуриане", "Prince_of_Khaine"), "Hatred")[0])).toEqual(["patron:khorne"]);
    expect(keys(talents(find("elite-archetypes/Азуриане", "Vaul_s_Smith"), "Hatred")[0])).toEqual(["patron:tzeentch"]);
    expect(keys(talents(find("elite-archetypes/Азуриане", "Wanderer_of_Hoec"), "Enemy")[0])).toEqual(["patron:slaanesh", "patron:tzeentch"]);
    expect(keys(talents(find("elite-archetypes/Азуриане", "Agent_of_the_Cabal"), "Hatred")[0])).toEqual(["faction:chaos"]);
    expect(keys(talents(find("elite-archetypes/Азуриане", "Hunter_of_Kurnous"), "Peer")[0])).toEqual(["race:beastman", "race:mutant"]);
  });
  it("Благородный — Знать; Мир-тюрьма — Пираты и Преступники; Локус Гнева — Все!", () => {
    expect(keys(talents(find("archetypes/Люди", "Noble___"), "Peer")[0])).toEqual(["faction:nobility"]);
    const prison = talents(find("homeworlds/Происхождения", "Мир_тюрьма"), "Peer").map(keys).flat().sort();
    expect(prison).toEqual(["faction:criminals", "faction:pirates"]);
    expect(keys(talents(find("traits/Локусы_Герольдов", "Locus_of_Wrath"), "Hatred")[0])).toEqual(["all:"]);
  });
  it("«на выбор» записи просят выбрать цели при выдаче", () => {
    expect(talents(find("archetypes/Друкхари", "Courtier___"), "Peer")[0].targetChoiceCount).toBe(3);
    expect(talents(find("archetypes/Люди", "Apostate___"), "Hatred")[0].targetChoiceCount).toBe(2);
    expect(talents(find("archetypes/Люди", "Apostate___"), "Peer")[0].targetChoiceCount).toBe(2);
  });
  it("Космическая станция, Герольд, Шаман Зверолюдей и Предсказание просят выбрать цель при выдаче", () => {
    // Книга не называет группу: «Peer (Собственная банда)» (core), «Peer (Племя)» (toad-psykers),
    // Good Reputation «связанный с тем, кто владел станцией», Peer «повязанные с персонажем».
    const one = (doc, name) => talents(doc, name).filter(e => e.targetChoiceCount === 1);
    expect(one(find("homeworlds/Происхождения", "Космическая_станция"), "Good Reputation")).toHaveLength(1);
    expect(one(find("elite-archetypes/Космодесантник", "Herald___"), "Peer")).toHaveLength(1);
    expect(one(find("elite-archetypes/Зверолюд", "Beastman_Shaman"), "Peer")).toHaveLength(1);
    expect(one(find("divinations", "Be_a_Boon"), "Peer")).toHaveLength(1);
    expect(one(find("divinations", "Be_a_Boon"), "Hatred")).toHaveLength(1);
  });
  it("фракции «Преступники» и «Пираты» есть в каталоге", () => {
    const dir = path.join(ROOT, "factions/Роли");
    const ks = fs.readdirSync(dir).filter(f => !f.startsWith("_")).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).system.key);
    expect(ks).toEqual(expect.arrayContaining(["criminals", "pirates", "nobility"]));
  });
});
