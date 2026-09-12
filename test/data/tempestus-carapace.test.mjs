// test/data/tempestus-carapace.test.mjs
//
// wdbc-aq4c: Панцирь Темпестус по книге (core.json, стр. 229) — «встроенный
// нижний слой флак-пластин и флак-ткани, обеспечивающий AP 4 на сочленениях и
// AP 8 против X(Fr) урона» (второе уже механизировано, wdbc-q0q8, свойство
// flakLining), плюс «по умолчанию имеет модификации Backpack, Monoscope,
// Slate Monitron и когитатор Good.Q, а в её шлем встроены Vox-Bead и
// Photo-Visor, оба Good.Q».
//
// Этот тест — на СОДЕРЖИМОЕ пака (packDocById, не имя файла — см. пакет
// support/pack-doc.mjs) плюс на реальный движок свойств брони с этими же
// пропРейтингами: страж на то, что jointLining действительно даёт
// гарантированный минимум AP 4 на Сочленении/Шее у ЭТОГО конкретного
// предмета, а не только у синтетических фикстур в armor-properties.test.mjs.

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { resolveArmorProps, aggregateArmorAuto, resolveArmorAbsorptionAP }
  from "../../module/combat/armor-properties.mjs";

const DIR = "packs-src/armor/Имперское/Броня/Панцирная";
const ID  = "30ucKqAYlG27E4bR";

describe("Панцирь Темпестус — AP на сочленениях (wdbc-aq4c)", () => {
  const doc = packDocById(DIR, ID);

  it("несёт свойство jointLining с рейтингом 4", () => {
    expect(doc.system.properties).toContain("jointLining");
    expect(doc.system.propRatings.jointLining).toBe(4);
  });

  it("не потерял flakLining (wdbc-q0q8) — оба числа одной фразы книги остаются", () => {
    expect(doc.system.properties).toContain("flakLining");
    expect(doc.system.propRatings.flakLining).toBe(8);
  });

  it("реальные propRatings дают AP 4 при попадании в Сочленение/Шею вместо обычных ÷3", () => {
    const props = resolveArmorProps(doc);
    const flags = aggregateArmorAuto(props, doc.system.propRatings);
    // Тело — 7 AP; обычное floor(7/3) = 2, jointLining поднимает до 4.
    const ap = resolveArmorAbsorptionAP({
      baseArmorAP: doc.system.body, damageType: "impact",
      hitLocation: "Сочленение / Шея", flags
    });
    expect(ap).toBe(4);
  });

  it("попадание не в Сочленение/Шею — AP тела не тронут", () => {
    const props = resolveArmorProps(doc);
    const flags = aggregateArmorAuto(props, doc.system.propRatings);
    const ap = resolveArmorAbsorptionAP({
      baseArmorAP: doc.system.body, damageType: "impact",
      hitLocation: "Торс", flags
    });
    expect(ap).toBe(doc.system.body);
  });
});

describe("Панцирь Темпестус — встроенные модификации (wdbc-aq4c)", () => {
  const doc = packDocById(DIR, ID);
  const groups = doc.flags["warhammer-dbc"].mechanics;
  const entries = groups.flatMap(g => g.entries);

  const EXPECTED = [
    { uuid: "Compendium.warhammer-dbc.armor-mods.Item.XN5ZMaRjvMNBWGK2", name: "Backpack / Ранец", quality: "common" },
    { uuid: "Compendium.warhammer-dbc.armor-mods.Item.PZTKtdd0wobsxnlu", name: "Monoscope / Моноприцел", quality: "common" },
    { uuid: "Compendium.warhammer-dbc.armor-mods.Item.Njr3DvLGSPEAj9Ob", name: "Slate Monitron / Планшет Монитрон", quality: "common" },
    { uuid: "Compendium.warhammer-dbc.tools.Item.ztFWyXgZNBLih4Dw", name: "Cogitator / Когитатор", quality: "good" },
    { uuid: "Compendium.warhammer-dbc.gear.Item.ywCPMt5FrmM6nLUX", name: "Vox-Bead / Вокс Бусина", quality: "good" },
    { uuid: "Compendium.warhammer-dbc.gear.Item.PYS8JH2TKgmGAvqq", name: "Photo-Visor / Фото-Визор", quality: "good" }
  ];

  it("несёт ровно 6 записей kind:equipment (direct) — по одной на каждый встроенный предмет", () => {
    const equip = entries.filter(e => e.kind === "equipment");
    expect(equip).toHaveLength(6);
    expect(equip.every(e => e.equipMode === "direct")).toBe(true);
  });

  it.each(EXPECTED)("выдаёт «$name» ($quality) записью, ссылающейся на реальный предмет пака", ({ uuid, name, quality }) => {
    const entry = entries.find(e => e.kind === "equipment" && e.equipSourceUuid === uuid);
    expect(entry, `нет entry kind:equipment на ${uuid}`).toBeTruthy();
    expect(entry.equipSourceName).toBe(name);
    expect(entry.equipQuality).toBe(quality);
  });

  it("все 6 записей в одной И-группе — выдаются вместе, без выбора", () => {
    const group = groups.find(g => (g.entries || []).some(e => e.kind === "equipment"));
    expect(group.operator).toBe("AND");
    expect(group.entries.filter(e => e.kind === "equipment")).toHaveLength(6);
  });
});
