// tools/_gift-mechanics-batch1.mjs — первая партия Механики для Даров Богов
// (после Мутаций, см. чат: «оформи в механику все мутации»). Одноразовый —
// можно удалить после запуска.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { blankMechEntry, blankMechGroup } from "../module/apps/mechanics.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
globalThis.foundry.utils.randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");

const TRAIT_ICON = "systems/warhammer-dbc/assets/item-icons/trait.svg";
const TALENT_ICON = "systems/warhammer-dbc/assets/item-icons/talent.svg";

function traitEntry({ id, uuid, name, rating = "" }) {
  const e = blankMechEntry("trait");
  e.id = id;
  e.sourceUuid = `Compendium.warhammer-dbc.traits.Item.${uuid}`;
  e.sourceName = name;
  e.sourceImg = TRAIT_ICON;
  e.sourceHasRating = rating !== "";
  e.rating = String(rating);
  return e;
}

function talentEntry({ id, uuid, name }) {
  const e = blankMechEntry("talent");
  e.id = id;
  e.sourceUuid = `Compendium.warhammer-dbc.talents.Item.${uuid}`;
  e.sourceName = name;
  e.sourceImg = TALENT_ICON;
  return e;
}

function equipmentEntry({ id, uuid, name }) {
  const e = blankMechEntry("equipment");
  e.id = id;
  e.equipMode = "direct";
  e.equipSourceUuid = `Compendium.warhammer-dbc.gear.Item.${uuid}`;
  e.equipSourceName = name;
  return e;
}

const patches = [
  {
    file: "packs-src/mutations/Дары_Богов/Кхорн/Collar_of_Khorne___Ошейник_Кхорна_oNBOnD7o0cKKKAir.json",
    // Предмет-ошейник + Талант Shield of Contempt — оба прямо названы в
    // тексте. Снятие Трейта Psyker при получении (если чемпион был псайкером)
    // — разовая правка постороннего предмета, не выдача самому себе, не
    // кодируется (нет вида записи «отобрать чужой Трейт»).
    groups: [{ entries: [
      equipmentEntry({ id: "collar-gear", uuid: "gckT8Q33aPM9EBwC", name: "Collar of Khorne / Ошейник Кхорна" }),
      talentEntry({ id: "collar-shield", uuid: "dLuTRdSxOPSNUBrm", name: "Shield of Contempt / Щит Презрения" })
    ] }]
  },
  {
    file: "packs-src/mutations/Дары_Богов/Тзинч/Warpweaver___Варпопл_т_lan0BYC2WGH8tLNn.json",
    // Daemonic(+2) и Warp Gifted — обе Черты прямо названы, рейтинг Daemonic
    // указан числом. Ограничение дисциплин психосил и правило теста
    // манифестации — не про Черту, не кодируются.
    groups: [{ entries: [
      traitEntry({ id: "warpweaver-daemonic", uuid: "brwXUX5nKFR5tOjG", name: "Daemonic / Демонический (X)", rating: 2 }),
      traitEntry({ id: "warpweaver-gifted", uuid: "SDkAbCYsgbM1sa3B", name: "Warp Gifted / Одарённый Варпом" })
    ] }]
  },
  {
    file: "packs-src/mutations/Дары_Богов/Нургл/Unbreakable___Нерушимый_lrH2XhV5r6gd0Wz1.json",
    // Trait Sturdy — только базовая часть. Активный иммунитет к сбиванию с
    // ног/тарану (полудействие/реакция до начала следующего Хода) — живой
    // запрос за пределами текущих видов записи, не кодируется.
    groups: [{ entries: [
      traitEntry({ id: "unbreakable-sturdy", uuid: "ZPrppKroO0nNHfMf", name: "Sturdy / Надёжный" })
    ] }]
  }
];

for (const patch of patches) {
  const raw = fs.readFileSync(patch.file, "utf8");
  const doc = JSON.parse(raw);
  const groups = patch.groups.map(g => {
    const grp = blankMechGroup("AND");
    grp.entries = g.entries;
    if (g.when) for (const e of grp.entries) e.when = g.when;
    return grp;
  });
  doc.flags ??= {};
  doc.flags["warhammer-dbc"] ??= {};
  doc.flags["warhammer-dbc"].mechanics = groups;
  fs.writeFileSync(patch.file, JSON.stringify(doc, null, 2) + "\n");
  console.log("OK:", patch.file);
}
