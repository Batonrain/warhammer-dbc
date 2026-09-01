// tools/_wdbc-xxb7-patch-archetype.mjs — добавляет flags.mechanics (авто-выдача
// 2 Черт + 3 бесплатных Талантов) и description на уже сгенерированный
// packs-src/elite-archetypes/Зверолюд/Beastman_Shaman___*.json.
// Одноразовый скрипт, удалить после мерджа. Запуск: node tools/_wdbc-xxb7-patch-archetype.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const PATH = "packs-src/elite-archetypes/Зверолюд/Beastman_Shaman___Шаман_Зверолюдей_lUjzXTKNxBVad86Q.json";
const idOf = (prefix, name) => createHash("sha1").update(`${prefix}:${name}`).digest("base64")
  .replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);

function blankMechEntry(kind, id) {
  return {
    corruptionValue: "1", woundsValue: "1", cohesionRole: "any", cohesionValue: "1",
    charKey: "s", field: "total", op: "add", value: 1,
    sourceUuid: "", sourceName: "", sourceImg: "", sourceHasRating: false, rating: "",
    specialization: "", minionGroup: "", minionTier: "",
    skillScope: "plain", skillKey: "", specKey: "", specialty: "",
    specChoiceKeys: [], specChoiceCount: 1, rank: "untrained",
    weightScope: "all", weightMode: "kg", weightValue: 1,
    movementTarget: "spd", movementValue: 1,
    armourLocation: "body", armourValue: 1, ignoreTerrainProps: [],
    rerollScope: "all", rerollChar: "ag", rerollMode: "keepBest", rerollWho: "self",
    modScope: "all", modValueMode: "flat", modCharBonus: "inf",
    capabilityKey: "",
    fatigueAction: "threshold", fatigueThresholdChar: "t",
    equipMode: "direct", equipQty: 1, equipSourceUuid: "", equipSourceName: "", equipSourceImg: "",
    equipCategoryPack: "weapons", equipWeaponType: "", equipWeaponProp: "", equipArmorType: "",
    equipMaxAvailability: 5, equipQuality: "common", equipTalentTier: "", equipMaxPsyRating: "",
    equipImplantCategory: "", equipBudgetMode: "count", equipBudgetValue: 1,
    loyaltyMinionType: "", loyaltyOp: "add", loyaltyValue: 1,
    weaponPropAction: "add", weaponPropKey: "", weaponPropLabel: "",
    weaponPropHasRating: false, weaponPropHasRating2: false,
    weaponPropValue: "1", weaponPropValue2: "0",
    weaponPropNewKey: "", weaponPropNewLabel: "", weaponPropNewHasRating: false, weaponPropNewHasRating2: false,
    weaponPropNewValue: "1", weaponPropNewValue2: "0",
    label: "", code: "",
    kind, id
  };
}

function grantEntry(kind, { sourceUuid, sourceName, sourceImg }) {
  const e = blankMechEntry(kind, idOf("mech", sourceUuid));
  e.sourceUuid = sourceUuid; e.sourceName = sourceName; e.sourceImg = sourceImg;
  return e;
}

const TRAIT_IMG = "systems/warhammer-dbc/assets/item-icons/trait.svg";
const TALENT_IMG = "systems/warhammer-dbc/assets/item-icons/talent.svg";

const entries = [
  grantEntry("trait", {
    sourceUuid: "Compendium.warhammer-dbc.traits.Item.Hu4spY7TozMum4uI",
    sourceName: "Ritual Bloodletting / Ритуал Кровопускания", sourceImg: TRAIT_IMG
  }),
  grantEntry("trait", {
    sourceUuid: "Compendium.warhammer-dbc.traits.Item.u0jc8WxcnXEmBswR",
    sourceName: "Symbol of Power / Символ Власти", sourceImg: TRAIT_IMG
  }),
  grantEntry("talent", {
    sourceUuid: "Compendium.warhammer-dbc.talents.Item.deJI1MbgioJjiWSv",
    sourceName: "Peer / Связи", sourceImg: TALENT_IMG
  }),
  grantEntry("talent", {
    sourceUuid: "Compendium.warhammer-dbc.talents.Item.KUrEsT190BtUwtW8",
    sourceName: "Resistance / Сопротивление", sourceImg: TALENT_IMG
  }),
  grantEntry("talent", {
    sourceUuid: "Compendium.warhammer-dbc.talents.Item.ZK7S17waJO9RRKXH",
    sourceName: "Sacrifice / Жертва", sourceImg: TALENT_IMG
  })
];

const doc = JSON.parse(readFileSync(PATH, "utf8"));
doc.system.bookSource = "DoomBC — Психокеры-Жабы (Toad Psykers), стр. 102-104";
doc.system.description = "<p>Некоторые воины Империума, ксеносы и последователи Хаоса поговаривают о могучих зверолюдях, способных повелевать ветрами варпа. Это одни из самых опасных видов врагов, встречающихся во время битвы со зверолюдьми, — из-за их врождённого потенциала псайкеров. Лишённые взора богов на них из-за высокомерных людей, их ненависть подпитывает их могущество, а глубокие познания ритуалов жертвоприношений позволяют им наделять себя могущественными способностями на короткие промежутки времени.</p><p>Шаманы Зверолюдей наделены невероятной хитростью. Чаще всего именно они возглавляют племена своих сородичей благодаря своей силе и приближённости к Богам Хаоса, но особо крупные племена возглавляются иными зверолюдьми, а шаманы составляют их свиту и советников, знающих, как правильно подойти к Богам Хаоса и получить их благословение.</p><p>В разных племенах есть разные особенности у шаманов. Племена Слаангоров часто используют своих шаманов, дабы те могли показать им музыку и духи из дворца Князя Удовольствий. Племена Пестигоров накладывают на своих шаманов ещё научную работу по изучению трав, растений и созданию болезней. Племена Кхорнгоров редко имеют шаманов в том же понимании — чаще всего это оккультисты магии крови и мастера по жертвоприношениям. Племена Тзаангоров всегда возглавляются хитрейшими шаманами, которые смогли вырвать свою позицию у прошлого шамана в интриге или дипломатии.</p><h3>Становление</h3><p>Персонаж должен завоевать право стать шаманом своего племени. В зависимости от племени традиция может отличаться, но обычно это либо поединок с другим шаманом, либо с вождём племени, либо принесение множества жертв и ожидание ответа от Богов Хаоса.</p>";
doc.flags = { "warhammer-dbc": { mechanics: [{ id: idOf("mechgroup", "beastmanShaman-free-grants"), operator: "AND", entries }] } };

writeFileSync(PATH, JSON.stringify(doc, null, 2) + "\n");
console.log("patched", PATH);
