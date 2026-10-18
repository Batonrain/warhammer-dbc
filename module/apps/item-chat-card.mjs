// module/apps/item-chat-card.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Постинг предмета в чат (wdbc-6rj) — по образцу Dark Heresy (кнопки «В чат»/
//  «Send To Chat» на листе): два режима —
//    • «Карточка» — название + ключевые игровые цифры по типу предмета
//      (Оружие/Броня/снаряжение/Таланты-Черты-Мутации) + Описание;
//    • «Только описание» — только название и Описание (как короткая GM-
//      заметка, без цифр).
//  Остальные ~30 типов (психосилы, корабельные компоненты, расы и т.п.) своего
//  блока цифр не получают — честный генерик: только Качество/Доступность/Вес,
//  если они у типа вообще есть, плюс Описание. Не попытка свести все типы
//  предмета в одну грандиозную таблицу.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { WEAPON_CLASSES, DAMAGE_TYPES, ARMOR_PROPERTIES } from "../constants/items.mjs";
import { RARITY_LABELS } from "../constants/craft.mjs";
import { qualityInfo, buildQualityChatBlock } from "../constants/quality.mjs";
import { resolveWeaponProps } from "../combat/weapon-properties.mjs";

const row = (label, value) => (value === "" || value == null) ? "" : `<div class="roll-threshold">${esc(label)}: <b>${esc(String(value))}</b></div>`;

/** «Качество/Доступность/Вес» — общие для почти всего приобретаемого снаряжения. */
function commonGearLines(sys) {
  const lines = [];
  if (typeof sys.weight === "number" && sys.weight) lines.push(row("Вес", `${sys.weight} кг`));
  if (sys.quality) lines.push(row("Качество", `${qualityInfo(sys.quality).label} (${qualityInfo(sys.quality).abbr})`));
  if (typeof sys.availability === "number") {
    const label = RARITY_LABELS[String(sys.availability)];
    if (label) lines.push(row("Доступность", label));
  }
  return lines;
}

function weaponLines(item) {
  const sys = item.system;
  const props = resolveWeaponProps(item).map(p => p.def.label).join(", ");
  return [
    row("Класс", WEAPON_CLASSES[sys.weaponClass] || sys.weaponClass),
    row("Дальность", sys.range),
    row("СКС", `${sys.rof_single}/${sys.rof_semi}/${sys.rof_full}`),
    row("Урон", `${sys.damage} ${DAMAGE_TYPES[sys.damageType] || sys.damageType || ""}`.trim()),
    row("Пробитие", sys.penetration),
    row("Магазин", sys.magazineMax || ""),
    ...commonGearLines(sys),
    row("Особое", props)
  ];
}

const AP_LABELS = { head: "Голова", body: "Корпус", leftArm: "Л. Рука", rightArm: "П. Рука", leftLeg: "Л. Нога", rightLeg: "П. Нога" };

function armorLines(item) {
  const sys = item.system;
  const ap = Object.entries(AP_LABELS).map(([k, label]) => `${label} ${sys[k] || 0}`).join(", ");
  const props = (sys.properties || []).map(k => ARMOR_PROPERTIES[k]?.label).filter(Boolean).join(", ");
  return [
    row("AP", ap),
    ...commonGearLines(sys),
    row("Особенности", sys.special),
    row("Свойства", props)
  ];
}

function talentLikeLines(item) {
  const sys = item.system;
  return [
    row("Требование", sys.requirement),
    typeof sys.tier === "number" ? row("Тир", sys.tier) : "",
    row("Польза", sys.benefit)
  ];
}

const TALENT_LIKE_TYPES = new Set(["talent", "ability", "mutation", "trait", "mentalDisorder", "mentalTrauma"]);
const GEAR_WITH_COMMON_FIELDS = new Set(["gear", "tool", "cybernetic", "drug", "ammo", "forcefield", "weaponMod", "armorMod"]);

/** Строки-«цифры» карточки по типу предмета — "" там, где для типа ничего не заведено. */
function statLines(item) {
  if (item.type === "weapon") return weaponLines(item);
  if (item.type === "armor") return armorLines(item);
  if (TALENT_LIKE_TYPES.has(item.type)) return talentLikeLines(item);
  if (GEAR_WITH_COMMON_FIELDS.has(item.type)) return commonGearLines(item.system);
  return [];
}

async function postItemCard(item, { fullCard }) {
  const sections = [];
  if (fullCard) {
    sections.push(...statLines(item).filter(Boolean));
    const qBlock = typeof item.system?.quality === "string" ? buildQualityChatBlock(item) : "";
    if (qBlock) sections.push(qBlock);
  }
  const description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system?.description || "", { relativeTo: item });

  return postTestCard(item.actor ?? null, {
    icon: `<img src="${esc(item.img)}" class="roll-item-icon" width="20" height="20"/>`,
    title: esc(item.name),
    lines: sections,
    sections: description ? [`<div class="roll-item-description">${description}</div>`] : [],
    classes: "wh-item-chat-card"
  }, { ignoreRollMode: true, sound: false });
}

/** Полная карточка: ключевые цифры по типу предмета + Описание. */
export function postItemFullCard(item) { return postItemCard(item, { fullCard: true }); }

/** Короткая карточка: только название и Описание, без цифр. */
export function postItemShortCard(item) { return postItemCard(item, { fullCard: false }); }
