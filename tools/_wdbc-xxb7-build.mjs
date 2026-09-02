// tools/_wdbc-xxb7-build.mjs — одноразовый скрипт сборки контента
// wdbc-xxb7 (Шаман Зверолюдей): 2 Черты, 6 Талантов, 1 Ритуал. Запуск:
//   node tools/_wdbc-xxb7-build.mjs --write
// Удалить после мерджа — не часть постоянного конвейера.

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const NS = "warhammer-dbc";
const BOOK_SOURCE = "DoomBC — Психокеры-Жабы (Toad Psykers), стр. 102-104";

const idOf = (prefix, name) => createHash("sha1").update(`${prefix}:${name}`).digest("base64")
  .replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);

const safe = (name) => String(name).replace(/[^a-zA-Z0-9А-я]/g, "_");
const NAME_LIMIT = 40;
const packFileName = (name, id) => `${safe(name).slice(0, NAME_LIMIT)}_${id}.json`;

const stats = () => ({
  compendiumSource: null, duplicateSource: null, exportSource: null,
  coreVersion: "14.365", systemId: NS, systemVersion: "0.1.0",
  createdTime: null, modifiedTime: null, lastModifiedBy: null
});

function folderDoc(name, id, parent) {
  return {
    name, type: "Item", sorting: "m", folder: parent, _id: id,
    description: "", sort: 0, color: null, flags: {},
    _stats: { compendiumSource: null, duplicateSource: null, exportSource: null,
              coreVersion: "13.346", systemId: NS, systemVersion: "0.1.0", lastModifiedBy: null },
    _key: `!folders!${id}`
  };
}

// ── Шаблон записи Механики (Конструктор, module/apps/mechanics.mjs) ────────
// Полный плоский набор полей — как хранит сам движок (все поля есть у любой
// записи независимо от kind, лишние остаются на умолчаниях).
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
    scriptThrottleUnit: "", scriptThrottleMax: 1,
    auraRadius: "", auraSelfToo: false,
    when: { negate: false, conditions: [] },
    kind, id
  };
}

function mechGroup(entries) {
  return { id: idOf("mechgroup", entries.map(e => e.id).join("|")), operator: "AND", entries };
}

/** kind:"capability" — честная запись без готового ридера (реестр в
 * capabilities.mjs), опционально с гейтом Покровителя (wdbc-xxb7). */
function capEntry(capabilityKey, patronGod = null, negate = false) {
  const e = blankMechEntry("capability", idOf("mech", capabilityKey + (patronGod ? ":" + patronGod.join(",") : "")));
  e.capabilityKey = capabilityKey;
  if (patronGod) e.when = { negate: false, conditions: [], patronGod, negatePatronGod: negate };
  return e;
}

const OUT = [];
function emit(path, doc) { OUT.push({ path, doc }); }

// ════════════════════════════════════════════════════════════════════════
//  ПАПКИ
// ════════════════════════════════════════════════════════════════════════
const TRAIT_ROOT_FOLDER = "H1OyQ4WABPmBCIib";   // packs-src/traits/Элитные_архетипы/_Folder.json
const TALENT_ROOT_FOLDER = "Xlmt0vNMtK47xqJ7";  // packs-src/talents/Элитные_архетипы/_Folder.json

const traitFolderId = idOf("folder", "traits:Шаман Зверолюдей");
const talentFolderId = idOf("folder", "talents:Шаман Зверолюдей");

emit("packs-src/traits/Элитные_архетипы/Шаман_Зверолюдей/_Folder.json",
  folderDoc("Шаман Зверолюдей", traitFolderId, TRAIT_ROOT_FOLDER));
emit("packs-src/talents/Элитные_архетипы/Шаман_Зверолюдей/_Folder.json",
  folderDoc("Шаман Зверолюдей", talentFolderId, TALENT_ROOT_FOLDER));

// ════════════════════════════════════════════════════════════════════════
//  ЧЕРТЫ
// ════════════════════════════════════════════════════════════════════════
function traitDoc(name, { description, benefit, mechanics = [] }) {
  const id = idOf("trait", name);
  const doc = {
    name, type: "trait", img: "systems/warhammer-dbc/assets/item-icons/trait.svg",
    system: {
      description, notes: "", benefit,
      source: "Beastman Shaman / Шаман Зверолюдей", bookSource: BOOK_SOURCE,
      requirement: "", hasRating: false, rating: 0, hasRating2: false, rating2: 0,
      effects: { charBonuses: [], charValueBonuses: [], armourAll: 0, fearRating: 0, sizeMod: 0, initMod: 0, speedMod: 0 }
    },
    _id: id, effects: [], folder: traitFolderId, sort: 0, ownership: { default: 0 },
    flags: mechanics.length ? { [NS]: { mechanics: [mechGroup(mechanics)] } } : {},
    _stats: stats(), _key: `!items!${id}`
  };
  emit(`packs-src/traits/Элитные_архетипы/Шаман_Зверолюдей/${packFileName(name, id)}`, doc);
  return id;
}

const ritualBloodlettingId = traitDoc("Ritual Bloodletting / Ритуал Кровопускания", {
  description: "<p>Шаман постиг древнее искусство обмена: жизнь — на силу, кровь — на благосклонность.</p>",
  benefit: "В пылу боя шаман способен проливать кровь врагов и сразу же обращать её в свою силу. Когда персонаж убивает любое живое существо с душой, он может Свободным действием активировать этот трейт. Он проводит короткий, грубый ритуал подношения, делая надрез на теле жертвы или окуная свои рога в её кровь. В этот момент персонаж и все зверолюди-союзники, что видят или слышат его в радиусе F метров от персонажа, получают +5 ко всем тестам и иммунитет к Страху и Подавлению до начала его следующего Хода. Этот параметр модифицируется талантами из группы Лидерства. Если он провёл ритуал над кем-то особо важным, вроде вражеского чемпиона или офицера, бонус к тестам удваивается. Это не складывается от разных источников. Кроме того, сам персонаж может манифестировать психосилу с Путём Силы Жертва без приготовления жертвы.",
  mechanics: [capEntry("trigger.beastmanShaman.ritualBloodletting.onKillBuff")]
});

const symbolOfPowerId = traitDoc("Symbol of Power / Символ Власти", {
  description: "<p>Рога зверолюда-шамана — не просто костяные наросты, а его символ власти, символ приближённости к Богам Хаоса и их милости по отношению к нему.</p>",
  benefit: "Персонаж может отломить кусок своего рога и потратить 10 минут на исчерчение его оккультными символами когтями или ритуальным ножом. Рог превращается в Good.Q пси-фокус, а также через него можно манифестировать, как через Нечестивые Символы. Персонаж всегда имеет при себе естественный Comm.Q пси-фокус (в лице своих рогов). Более того, он научился вплетать боль в свою магию. При любой манифестации психосилы он может добровольно получить 1d5+2 R Dmg, Pen ∞, чтобы увеличить свой эPR на 2 для этой манифестации. Если он использует это усиление, любая манифестация (даже успешная) автоматически вызывает варп-феномен с бонусом +10. Его трейт Natural Weapons меняется на Deadly Natural Weapons, и он получает отдельный трейт для своих рогов: Deadly Natural Weapons (бPR, Рога), а также получает свойство Tainted на них, пока у него есть покровительство хотя бы одного бога Хаоса.\n\nИз-за близости к оккультным практикам и прохождения уже начальных трудностей персонаж перестаёт считать навыки групп Lore и Trade враждебными из-за трейта Aversion to Order и рассчитывает их по обычным правилам, а также не получает штрафов от кибернетики и имплантов.\n\nЯвляясь одной из интересных игрушек среди зверолюдей, персонаж лишается трейта Stepchildren of the Gods.",
  mechanics: [
    capEntry("psyfocus.beastmanShaman.symbolOfPower.hornFocusAndPainBoost"),
    capEntry("skill.beastmanShaman.symbolOfPower.aversionAndCyberneticsExemption"),
    capEntry("trait.beastmanShaman.symbolOfPower.loseStepchildrenOfTheGods")
  ]
});

// ════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ
// ════════════════════════════════════════════════════════════════════════
function talentDoc(name, { tier, requirement, benefit, mechanics = [] }) {
  const id = idOf("talent", name);
  const doc = {
    name, type: "talent", img: "systems/warhammer-dbc/assets/item-icons/talent.svg",
    system: {
      description: "", notes: "", benefit, bookSource: BOOK_SOURCE,
      tier, requirement, aptitudes: [], aptSource: "", aspirations: [],
      god: "Неделимый", specialization: "",
      hasRating: false, rating: 0, targets: [],
      cost: 0, costManual: false, purchased: false, granted: false,
      effects: { initMod: 0, fearRating: 0, speedMod: 0,
                 weaponBuff: { enabled: false, scope: "equipped", damageMod: 0, penMod: 0, rangeMod: 0, addProps: [] } }
    },
    _id: id, effects: [], folder: talentFolderId, sort: 0, ownership: { default: 0 },
    flags: mechanics.length ? { [NS]: { mechanics: [mechGroup(mechanics)] } } : {},
    _stats: stats(), _key: `!items!${id}`
  };
  emit(`packs-src/talents/Элитные_архетипы/Шаман_Зверолюдей/${packFileName(name, id)}`, doc);
  return id;
}

const primalHowlId = talentDoc("Primal Howl / Первобытный Вой", {
  tier: 1, requirement: "Cor 20, Command+10",
  benefit: "Шаман издаёт многоголосый, утробный вой, который эхом разносится по имматериуму, задевая саму суть душ. Все союзные зверолюди и мутанты со звериными чертами в радиусе Cor.b×10 метров слышат зов стада и ощетиниваются яростью, а враги цепенеют от первобытного ужаса. Раз в бой Полным Действием персонаж может воззвать к духам предков-зверей. Союзники в радиусе получают +10 к S и T до начала его следующего Хода, а враги считают персонажа источником Fear (+1).\n\nКхорн: бонус к T заменяется на бонус к WS, а весь урон от рукопашных атак увеличивается на +4. Вой звучит как лязг цепных клинков, и союзники, что не обладают талантом Frenzy, немедленно входят в Ярость, а союзники с талантом могут входить в Ярость за Свободное Действие.\n\nНургл: вой наполнен влажным кашлем и жужжанием мух. Вместо бонуса к S союзники получают +1d10 аблативных ран и могут перебрасывать проваленные тесты на сопротивление движению в любой из форм.\n\nСлаанеш: вой переливается неестественно красивыми обертонами. Вместо обычных бонусов союзники получают +10 к A до конца следующего Хода и снимают 1 Усталость. Враги, провалившие тест на Страх, получают 1 Усталость.\n\nТзинч: вой полон искажённых шёпотов, предрекающих гибель. Вместо обычных бонусов союзники получают +10 к P, а враги получают неизбегаемое попадание со свойством Hallucinogenic (1). Все варп-феномены до конца следующего хода получают +20.",
  mechanics: [
    capEntry("aura.beastmanShaman.primalHowl.base"),
    capEntry("aura.beastmanShaman.primalHowl.khorneVariant", ["khorne"]),
    capEntry("aura.beastmanShaman.primalHowl.nurgleVariant", ["nurgle"]),
    capEntry("aura.beastmanShaman.primalHowl.slaaneshVariant", ["slaanesh"]),
    capEntry("aura.beastmanShaman.primalHowl.tzeentchVariant", ["tzeentch"])
  ]
});

const hexMarkedPreyId = talentDoc("Hex-Marked Prey / Проклятая Метка", {
  tier: 2, requirement: "Cor 25, W 45, Schol.Lore (Occult)+10",
  benefit: "Шаман помечает одного врага в радиусе видимости скверной варпа, нашёптывая его имя духам. Как Полудействие персонаж может кинуть в цель горсть пепла, сгусток крови или просто указать на неё рогом, совершив Соревновательный тест W+0 vs W+10. Существа с очками судьбы могут потратить 1 и получить иммунитет к таланту до конца боя. При успехе персонажа цель получает Метку Проклятого до конца боя. Пока метка активна, все зверолюди-союзники получают +15 на атаки против этой цели. В одном бою персонаж может наложить только одну метку, а при накладывании новой старая рассыпается прахом.\n\nКхорн: атаки союзников по цели дополнительно получают свойство Proven (3), а если они наносят R тип урона и вызывают критический эффект, они также вызывают и кровотечение.\n\nНургл: атаки союзников по цели дополнительно получают свойство Toxic (1). Если цель выжила после попадания этим оружием и получила непоглощённый урон, то в конце боя она должна пройти тест T+10 или заразиться Гнилью Нургла.\n\nСлаанеш: цель испытывает болезненное наслаждение от близости шамана — она не может добровольно удаляться от него дальше чем на 20 м и получает штраф −10 на Dodge и Parry против атак шамана. Если шаман наносит ей урон, он восстанавливает 1d3 Раны.\n\nТзинч: при наложении метки шаман может выбрать одну характеристику цели (S, T, A, I, W). Пока активна метка, выбранная характеристика снижается на 10. Кроме того, каждый раз, когда цель проваливает тест, связанный с этой характеристикой, шаман получает +5 к своей следующей манифестации психосилы.",
  mechanics: [
    capEntry("mark.beastmanShaman.hexMarkedPrey.base"),
    capEntry("mark.beastmanShaman.hexMarkedPrey.khorneVariant", ["khorne"]),
    capEntry("mark.beastmanShaman.hexMarkedPrey.nurgleVariant", ["nurgle"]),
    capEntry("mark.beastmanShaman.hexMarkedPrey.slaaneshVariant", ["slaanesh"]),
    capEntry("mark.beastmanShaman.hexMarkedPrey.tzeentchVariant", ["tzeentch"])
  ]
});

const riteOfSelfSacrificeId = talentDoc("Rite of Self-Sacrifice / Ритуал Самопожертвования", {
  tier: 2, requirement: "Cor 30, T 40, Corpus Conversion",
  benefit: "Шаман понимает, что самая ценная валюта во время жертвоприношений — это живая плоть. Совершив Полудействие, персонаж может нанести себе 1d5+1 непоглощаемого R Dmg в руку, чтобы напитать свои следующие действия силой варпа. Взамен до конца своего следующего Хода он получает +2 к эPR. Кроме того, кровь на его оружии и рогах загорается колдовским огнём, давая всему его ближнему бою свойство Tainted на тот же срок.\n\nКхорн: урон, полученный от ритуала, напрямую питает ярость. Вместо бонуса к эPR персонаж получает бонус к Dmg, равный полученному непоглощённому урону, умноженному на 2. Вместо броска он может нанести себе максимальное количество урона (6).\n\nНургл: шаман наносит себе урон, но его тело тут же начинает регенерировать и высвобождать токсины. Персонаж снижает бонус к эPR на 1, но в начале следующего хода восстанавливает бPR ран (но не больше полученного урона от таланта) и центрирует на себе шаблон 1d10+T.b C(Tx), Pen 0, Blast (T.b), Toxic (1).\n\nСлаанеш: боль переполняет его неестественной живостью. Персонаж снижает бонус к эPR на 1, но получает +10 к A, +2 Реакции и может проводить тесты Атаки за Реакцию, получая штраф −15 к атаке. Атаки за реакцию не входят в общий лимит; проводить их можно только утончённым оружием (рапира, копьё, лук, метательные ножи) или Bl 2 (ГМ и персонаж могут договориться посвятить Слаанеш иное оружие).\n\nТзинч: кровь, вытекая, чертит мимолётные руны на земле. Персонаж, помимо бонуса к эPR, получает +20 к манифестации следующей психосилы. Он может применить этот талант во время ритуала, чтобы ускорить его создание в несколько раз и получить бонус +20 на сам ритуал.",
  mechanics: [
    capEntry("selfSacrifice.beastmanShaman.riteOfSelfSacrifice.base"),
    capEntry("selfSacrifice.beastmanShaman.riteOfSelfSacrifice.khorneVariant", ["khorne"]),
    capEntry("selfSacrifice.beastmanShaman.riteOfSelfSacrifice.nurgleVariant", ["nurgle"]),
    capEntry("selfSacrifice.beastmanShaman.riteOfSelfSacrifice.slaaneshVariant", ["slaanesh"]),
    capEntry("selfSacrifice.beastmanShaman.riteOfSelfSacrifice.tzeentchVariant", ["tzeentch"])
  ]
});

const warpTaintedAuraId = talentDoc("Warp-Tainted Aura / Аура Скверны", {
  tier: 2, requirement: "Cor 30, Fel 40",
  benefit: "Тело шамана постоянно сочится мутагенной аурой — у кого-то это феромоны, у кого-то зловоние, у кого-то мерцающее марево. Эта аура усиливает стойкость его подчинённых при помощи его мистической скверны и силы духа. Как Полудействие раз в час персонаж может сконцентрировать эту ауру в радиусе 20 метров до начала своего следующего Хода. Аура действует на всех не-еретиков: они должны пройти тест на W−10, иначе получают 1 Cor или особый эффект в зависимости от покровительства, а союзники получают бонус +20 на все тесты Сопротивления в этой ауре. Этот бонус работает только до тех пор, пока у персонажа нет метки.\n\nКхорн: провалившиеся враги впадают в панику; они должны немедленно пройти тест на Fear (4).\n\nНургл: враги, провалившие тест, начинают Задыхаться, считаются занятыми активными действиями и получают штраф −30 на тесты против Удушения, пока они в ауре. Если у врага есть герметичная броня, он получает попадание Corrosive (Cor.b персонажа).\n\nСлаанеш: провалившиеся враги очарованы — они не могут атаковать персонажа или его стадо, считая их «друзьями», на Провалы Раунда, если только персонаж или его союзники не нападут первым.\n\nТзинч: провалившиеся враги резко смещаются по воле шамана. Персонаж может переместить всех проваливших цели на PR метров по горизонтали в любую из сторон, при условии что существо будет стоять на твёрдой поверхности. Если существо оказалось внутри другого существа или объекта, оно получает 1d5 непоглощаемого X урона в торс и выталкивается в ближайшее свободное место.",
  mechanics: [
    capEntry("aura.beastmanShaman.warpTaintedAura.base"),
    capEntry("aura.beastmanShaman.warpTaintedAura.khorneVariant", ["khorne"]),
    capEntry("aura.beastmanShaman.warpTaintedAura.nurgleVariant", ["nurgle"]),
    capEntry("aura.beastmanShaman.warpTaintedAura.slaaneshVariant", ["slaanesh"]),
    capEntry("aura.beastmanShaman.warpTaintedAura.tzeentchVariant", ["tzeentch"])
  ]
});

const boneRuneEtchingId = talentDoc("Bone-Rune Etching / Костяная Рунопись", {
  tier: 3, requirement: "Cor 35, PR 6, Trade (Calligraphy или Jeweler или Scrimshawer)",
  benefit: "Шаман постиг искусство заключать психическую энергию в физические руны, вырезаемые на костях, рогах или зубах. Потратив 1 час и подходящий осколок из кости достойного врага или психоактивного материала, он создаёт руну, хранящую одну психосилу, которую он знает. В бою руну можно активировать за Свободное Действие (или Реакцию, если психосила имеет тип Реагирование) — манифестация происходит автоматически с Успехами, равными бPR персонажа на момент создания. Создание требует комбинированного теста Schol.Lore (Occult)−20 и Trade (из требования)−20 и траты 1 Очка Бесчестия. Носить с собой можно не более Cor.b таких рун.\n\nКхорн: вместо вложения психосилы руна вкладывает ненависть колдуна к нечестным методам, что есть у Кхорна. При активации персонаж создаёт на Cor.b раундов вокруг себя ауру радиусом Cor.b×3 метров, которая работает как нуль-поле божественного происхождения, не вредящее самому персонажу.\n\nНургл: в руну проникают силы из Сада Дедушки Нургла. Независимо от типа урона, психосила получает Toxic (2). Если психосила создаёт ауру или шаблон, все существа в нём получают одно попадание Toxic (1), если не покинули шаблон. Если руна воздействует на союзника, он получает +PR аблативных ран и столько же восстанавливает. Персонаж и его союзники иммунны к Toxic этой ауры.\n\nСлаанеш: руна обладает утончённой структурой, что позволяет восстановить её прямо во время боя. После использования руны персонаж может немедленно потратить Очко Бесчестия и восстановить руну.\n\nТзинч: создавая руну, шаман может вписать в неё не свои познания, а случайные течения варпа. При успешном завершении работы над руной персонаж может бросить на феномен с бонусом PR×3, а если феномен становится прорывом — с бонусом PR×2. Выпавший феномен или прорыв запираются в руне, и персонаж может высвободить его на дистанции PR+W.b+Cor.b метров от себя. Бросок на феномен и/или прорыв ГМ делает скрытно от игрока.",
  mechanics: [
    capEntry("rune.beastmanShaman.boneRuneEtching.base"),
    capEntry("rune.beastmanShaman.boneRuneEtching.khorneVariant", ["khorne"]),
    capEntry("rune.beastmanShaman.boneRuneEtching.nurgleVariant", ["nurgle"]),
    capEntry("rune.beastmanShaman.boneRuneEtching.slaaneshVariant", ["slaanesh"]),
    capEntry("rune.beastmanShaman.boneRuneEtching.tzeentchVariant", ["tzeentch"])
  ]
});

const summonHerdSpiritsTalentId = talentDoc("Summon Herd Spirits / Призыв Духов Стада", {
  tier: 3, requirement: "Cor 45, W 50, Command+20, Forbidden Lore (Daemons, Warp)+20, Scholastic Lore (Occult)+20",
  benefit: "Высший шаманский ритуал, призывающий духов убитых зверей и предков из Имматериума. Персонаж открывает для себя ритуал Призыва Духов Стада.",
  mechanics: [capEntry("ritual.beastmanShaman.summonHerdSpirits.grantsRitual")]
});

// ════════════════════════════════════════════════════════════════════════
//  РИТУАЛ
// ════════════════════════════════════════════════════════════════════════
const RITUAL_FOLDER = null; // packs-src/rituals/Архетипа — плоская папка без подпапок
function ritualDoc(name) {
  const id = idOf("ritual", name);
  const doc = {
    name, type: "ritual", img: "systems/warhammer-dbc/assets/item-icons/ritual.svg",
    system: {
      description: "<p>Ритуал Элитного Архетипа «Шаман Зверолюдей» — открывается Талантом Summon Herd Spirits / Призыв Духов Стада.</p>",
      notes: "", source: "Beastman Shaman / Шаман Зверолюдей", bookSource: BOOK_SOURCE,
      ritualType: "archetype", failureType: "summon",
      record: 0, assistMin: 0, assistMax: 4, aversionPerFail: 5,
      procedure: "Требования: Forbidden Lore (Daemons)+20 и Forbidden Lore (Warp)+20.\nАссистенты: 0–4 | Forbidden Lore (Daemons)+0 и Forbidden Lore (Warp)+0.\nШаман и возможные ассистенты собираются вокруг постамента, посвящённого Богам Хаоса или Стаду, и начинают читать тёмные инкантации, рассыпать прах мёртвых и дарить подарки умершим, чтобы вернуть их в жизнь для предстоящей битвы. В течение 30−W.b−Inf.b−Cor.b часов ритуал должен продолжаться и не прерываться. В конце главный шаман закрепляет ритуал, проводя тест на Forbidden Lore (Daemons)(I)−20 или Forbidden Lore (Warp)(I)−30.",
      result: "Вокруг камня появляются духи умерших предков-зверолюдей — за каждые 3 успеха можно вызвать 1 Минотавра, за 5 успехов — Тролля, а за 8 успехов — Великана. Если у персонажа есть метка какого-либо бога, он может вызвать существо с соответствующей субрасой. Пока существа находятся на одной планете с шаманом, на одном пустотном объекте или не дальше Inf километров от него, они привязываются к материальному миру; также привязываются, если находятся на территории племени шамана. Один шаман может провести лишь три таких ритуала — при проведении четвёртого он должен отозвать предков одного из других ритуалов обратно в варп. Шаблоны существ смотреть в Бестиарии.",
      cost: "",
      failureCost: "Появляются предки другого племени, которые атакуют шамана и ритуалистов.",
      testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Daemons", testChar: "int", testMod: -20,
      rollPaths: [{ scope: "group", key: "forbiddenLore", specialty: "Warp", char: "int", mod: -30, label: "" }],
      extraMods: [],
      conditionsGranted: []
    },
    _id: id, effects: [], folder: RITUAL_FOLDER, sort: 0, ownership: { default: 0 },
    flags: {}, _stats: stats(), _key: `!items!${id}`
  };
  emit(`packs-src/rituals/Архетипа/${packFileName(name, id)}`, doc);
  return id;
}
const summonHerdSpiritsRitualId = ritualDoc("Summon Herd Spirits / Призыв Духов Стада");

// ════════════════════════════════════════════════════════════════════════
//  ЗАПИСЬ
// ════════════════════════════════════════════════════════════════════════
export function run({ write = false } = {}) {
  if (write) {
    for (const { path, doc } of OUT) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(doc, null, 2) + "\n");
    }
  }
  return {
    count: OUT.length,
    ids: {
      ritualBloodlettingId, symbolOfPowerId,
      primalHowlId, hexMarkedPreyId, riteOfSelfSacrificeId, warpTaintedAuraId, boneRuneEtchingId,
      summonHerdSpiritsTalentId, summonHerdSpiritsRitualId
    }
  };
}

if (process.argv[1]?.endsWith("_wdbc-xxb7-build.mjs")) {
  const res = run({ write: process.argv.includes("--write") });
  console.log(`Файлов: ${res.count}`);
  console.log(JSON.stringify(res.ids, null, 2));
}
