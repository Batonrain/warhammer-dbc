// test/migrations/plague-marine-rot.test.mjs
//
// wdbc-jb0zt: Чумной Десантник, созданный до появления записи Конструктора,
// не получил Гниль Нургла. Проход выдаёт её. Данные — настоящие JSON packs-src.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import {
  buildRotContext, plagueMarineRotData, hasPlagueMarineArchetype, hasNurglesRot
} from "../../module/migrations/plague-marine-rot.mjs";

const DISEASE_ID = "hfck3ePSodX4RmUD";
const ARCH_ID = "uz6NPu1w7EsBmYM2";
const find = (pack, id) => allPackDocuments(pack).find(d => d.doc._id === id).doc;
const disease = { ...find("diseases", DISEASE_ID), uuid: `Compendium.warhammer-dbc.diseases.Item.${DISEASE_ID}` };
const archetype = { ...find("elite-archetypes", ARCH_ID), id: ARCH_ID };
const CTX = buildRotContext([disease, archetype]);
const arch = () => ({ id: "A1", type: "eliteArchetype", name: archetype.name, system: {}, flags: {} });

describe("Гниль Нургла у Чумных Десантников", () => {
  it("контекст находит болезнь и запись Конструктора, которая её выдаёт", () => {
    expect(CTX).not.toBeNull();
    expect(CTX.entryId).toBe("zLVckpia4vCBsVRE");
  });

  it("нет болезни или архетипа в паке — контекста нет", () => {
    expect(buildRotContext([disease])).toBeNull();
    expect(buildRotContext([archetype])).toBeNull();
  });

  it("актор с архетипом и без болезни получает её включённой, с метками выдачи", () => {
    const data = plagueMarineRotData([arch()], CTX);
    expect(data.type).toBe("disease");
    expect(data.system.active).toBe(true);
    expect(data._id).toBeUndefined();
    expect(data.flags["warhammer-dbc"]).toMatchObject({ grantedByItem: "A1", equipEntryId: "zLVckpia4vCBsVRE" });
  });

  it("образец в паке не мутируется", () => {
    plagueMarineRotData([arch()], CTX);
    expect(disease.system.active).toBe(false);
  });

  it("идемпотентно: болезнь уже есть — ничего", () => {
    const items = [arch(), { id: "D1", type: "disease", name: disease.name, system: {}, flags: {} }];
    expect(hasNurglesRot(items)).toBe(true);
    expect(plagueMarineRotData(items, CTX)).toBeNull();
  });

  it("не Чумной Десантник — ничего", () => {
    const other = { id: "B", type: "eliteArchetype", name: "Berzerker / Берсерк Кхорна", system: {}, flags: {} };
    expect(hasPlagueMarineArchetype([other])).toBe(false);
    expect(plagueMarineRotData([other], CTX)).toBeNull();
  });

  it("одноимённая психосила Гнили Нургла болезнью не считается", () => {
    const power = { id: "P", type: "psychicPower", name: disease.name, system: {}, flags: {} };
    expect(plagueMarineRotData([arch(), power], CTX)).not.toBeNull();
  });
});
