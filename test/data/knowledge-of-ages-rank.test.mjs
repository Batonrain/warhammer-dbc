// test/data/knowledge-of-ages-rank.test.mjs
//
// wdbc-1rno.23: книга (core.json, «Знания Веков»): «изучает любой Навык по
// своему выбору до +30» — пак давал +10 (rank "trained").
import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";

// Knowledge_of_Ages___Знания_Веков_0Mc6b4RhLPO4ruoU.json
const doc = () => packDocById("packs-src/mutations/Общие_мутации", "0Mc6b4RhLPO4ruoU");

describe("Знания Веков: Навык до +30", () => {
  it("запись выдачи Навыка — ранг expert (+30), текст говорит +30", () => {
    const d = doc();
    const skills = d.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).filter(e => e.kind === "skill");
    expect(skills.map(e => e.rank)).toEqual(["expert"]);
    expect(d.system.benefit).toContain("до +30");
  });
});
