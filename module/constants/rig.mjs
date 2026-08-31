// ════════════════════════════════════════════════════════════════════════
//  Разгрузки: размеры предметов, слоты, проверка вместимости.
//  Модель — слотовая (как в первоисточнике): у разгрузки набор именованных
//  слотов фикс-размера (rig.slots / rig.magLocks). Предмет занимает слот,
//  если его «отпечаток» (WxH) помещается в слот. Размещение хранится на акторе
//  во флаге warhammer-dbc.stowage = { <itemId>: <location> }, где location:
//    "<slotId>"        — конкретный слот разгрузки,
//    "bp:<rigItemId>"  — в контейнере-рюкзаке.
//  Разгрузкой (isRig/rig) может быть gear (Ремень, Рюкзак) ИЛИ armor —
//  у силовой брони (стр. 27) 12 магнитных замков и пояс лежат на самом
//  предмете брони, а не на отдельном снаряжении.
// ════════════════════════════════════════════════════════════════════════

import { ITEM_TYPES } from "./items.mjs";

// Что можно разместить на разгрузке (броня носится, не стоуится; моды — часть оружия/брони).
export const STOWABLE_TYPES = ["weapon", "ammo", "gear", "tool", "drug", "forcefield"];

// Размер по классу оружия (первоисточник, таблица размеров).
const WEAPON_SIZE = {
  pistol: "2x1", basic: "4x1", heavy: "5x2", launcher: "5x2",
  thrown: "2x1", melee: "4x1", stationary: "5x2"
};

// «Отпечаток» предмета "WxH". У снаряжения/инструментов — своё поле itemSize;
// иначе выводим по типу/классу.
export function itemSizeStr(item) {
  const s = item?.system || {};
  if (s.itemSize) return String(s.itemSize).toLowerCase().replace(/\s/g, "");
  switch (item?.type) {
    // Граната — отдельный случай класса "thrown": книга (стр. 243, таблица
    // «Размеры предметов») даёт ей 1×1, тогда как остальной «thrown»
    // (бомбы, метательные ножи/топоры и т.п.) остаётся на общих 2×1.
    case "weapon":     return s.weaponType === "grenade" ? "1x1" : (WEAPON_SIZE[s.weaponClass] || "4x1");
    case "ammo":       return "1x1";
    case "forcefield": return "3x3";
    default:           return "1x1"; // gear/tool/drug без явного размера
  }
}

export function parseSize(str) {
  const m = String(str || "1x1").toLowerCase().match(/(\d+)\s*[x×]\s*(\d+)/);
  return m ? { w: +m[1], h: +m[2] } : { w: 1, h: 1 };
}

// Помещается ли предмет в слот (учитываем поворот на 90°).
export function fits(itemSize, slotSize) {
  const i = parseSize(itemSize), s = parseSize(slotSize);
  return (i.w <= s.w && i.h <= s.h) || (i.h <= s.w && i.w <= s.h);
}

// Флаг предмета-разгрузки, где лежит выбранный вариант каждого слота:
// { "<slotId>": "<variantKey>" }. Хранится на самой разгрузке, а не на акторе:
// переставили Ремень другому персонажу — кобуры остались ножнами.
export const RIG_VARIANT_FLAG = "rigVariants";

/**
 * Варианты одного слота: сам слот как он описан плюс его замены (e.variants).
 * Ремень, Бандольер и подобные разрешают заменить слот на другой — ножны,
 * неудобную петлю, ряд патронных петель, — и от замены меняется размер слота
 * и удобство, поэтому вариант выбирается, а не описывается словами в тексте.
 */
export function slotVariants(entry) {
  // Слот без замен наследует своё собственное неудобство (голени/пояс сзади/
  // ранец силовой брони — стр. 27): entry.awkward может быть true
  // ("неудобный") или "veryAwkward" ("очень неудобный"), не только false.
  const base = { key: "", label: entry.note || entry.size, size: entry.size, awkward: entry.awkward || false };
  const rest = (entry.variants || []).map((v, i) => ({
    key:     v.key || `v${i}`,
    label:   v.label || v.size,
    size:    v.size || entry.size,
    awkward: !!v.awkward
  }));
  return [base, ...rest];
}

// Разворачивает конфиг разгрузки в плоский список слотов (с уникальными id).
// Учитывает выбранный вариант слота: у него свой размер и своё удобство.
export function expandSlots(rigItem) {
  const r = rigItem?.system?.rig || {};
  const chosen = rigItem?.flags?.["warhammer-dbc"]?.[RIG_VARIANT_FLAG] || {};
  const out = [];
  const push = (e, ei, c, isMag) => {
    const id       = `${rigItem.id}:${isMag ? "m" : "s"}:${ei}:${c}`;
    const variants = slotVariants(e);
    const picked   = variants.find(v => v.key === (chosen[id] || "")) || variants[0];
    out.push({
      id, size: picked.size, note: e.note || "", isMag,
      awkward: picked.awkward,
      variantKey: picked.key,
      // Список для выпадающего выбора — пустой, если замен у слота нет.
      variants: variants.length > 1
        ? variants.map(v => ({ ...v, selected: v.key === picked.key })) : []
    });
  };
  (r.slots || []).forEach((e, ei) => {
    for (let c = 0; c < (e.count || 1); c++) push(e, ei, c, false);
  });
  (r.magLocks || []).forEach((e, ei) => {
    for (let c = 0; c < (e.count || 1); c++) push(e, ei, c, true);
  });
  return out;
}

// Разгрузка-контейнер (рюкзак): занимает спину и не имеет размерных слотов —
// вмещает произвольные предметы, но доставание = полное действие.
export function isContainerRig(rigItem) {
  const r = rigItem?.system?.rig || {};
  return !!r.backSlot && !(r.slots?.length) && !(r.magLocks?.length);
}

export const RIG_COMFORT_HINT = {
  normal:      "",
  awkward:     "Неудобная: не даёт пользоваться Quick Draw.",
  veryAwkward: "Очень неудобная: не даёт Quick Draw и перемещаться в Ход снятия/укладки."
};

const NS = "warhammer-dbc";
const FLAG = "stowage";

// Мелочь, надетая прямо на другой предмет (визор на шлеме, крепление на
// броне) — system.wornOn у gear указывает на существующий предмет-носитель
// (оружие/броню того же актора). Пока носитель на месте, вещь не нужно
// класть в разгрузку — она физически закреплена на нём, а не лежит в кармане.
export function wornOnHost(item, items) {
  const hostId = item?.system?.wornOn;
  if (!hostId) return null;
  const host = items?.get?.(hostId);
  return (host && (host.type === "armor" || host.type === "weapon")) ? host : null;
}

// Валидна ли локация (слот существующей разгрузки или её рюкзак).
export function isValidStowLoc(loc, rigs) {
  if (!loc) return false;
  if (loc.startsWith("bp:")) return rigs.some(r => r.id === loc.slice(3));
  const rigId = loc.split(":")[0];
  return rigs.some(r => r.id === rigId);
}

/**
 * Данные окна Разгрузки — вынесено из RigManager.getData(), чтобы работать
 * и проверяться без Foundry (актору достаточно .items с .filter/.get и
 * .getFlag/.name).
 *
 * Кандидаты слота (opts) и рюкзака (addable) включают ЛЮБОЙ подходящий
 * предмет, а не только неразмещённый: раньше вещь, уже лежащую в другом
 * слоте, нельзя было переложить в один шаг — сперва «Убрать», потом
 * заново «Положить». _assign переносит предмет между локациями атомарно
 * (флаг у него один, ключ — id предмета), но список выбора отсекал этот
 * путь фильтром !_isValidLoc, оставляя лишь неразмещённые вещи. Слот
 * текущего occ по-прежнему исключён явно — своим же содержимым его не
 * «заменить».
 */
export function rigManagerData(actor) {
  const stow = actor.getFlag(NS, FLAG) || {};
  const items = actor.items;

  const stowable = items.filter(i => STOWABLE_TYPES.includes(i.type) && !wornOnHost(i, items));
  // Разгрузка бывает не только снаряжением (Ремень) — у силовой брони (стр. 27)
  // свои 12 магнитных замков на самом предмете брони.
  const rigs = items.filter(i => (i.type === "gear" || i.type === "armor") && i.system?.isRig);

  const locOf = (id) => stow[id];

  const wt = (i) => Number(i.system?.weight) || 0;
  const wsum = (arr) => Math.round(arr.reduce((a, i) => a + wt(i), 0) * 100) / 100;

  const rigViews = rigs.map(rig => {
    const comfort = rig.system?.rig?.comfort || "normal";
    const comfortHint = RIG_COMFORT_HINT[comfort] || "";
    const canQuickDraw = comfort === "normal";        // неудобные не дают Quick Draw
    const backSlot = !!rig.system?.rig?.backSlot;
    if (isContainerRig(rig)) {
      const loc = `bp:${rig.id}`;
      const inBp = stowable.filter(i => locOf(i.id) === loc);
      const contents = inBp.map(i => ({ id: i.id, name: i.name, size: itemSizeStr(i), weight: wt(i) }));
      const addable = stowable
        .filter(i => i.id !== rig.id && locOf(i.id) !== loc)
        .map(i => ({ id: i.id, name: i.name, size: itemSizeStr(i) }));
      return { id: rig.id, name: rig.name, type: rig.type, container: true, comfortHint, canQuickDraw, backSlot,
        contents, addable, count: contents.length, weight: wsum(inBp) };
    }
    const inRig = [];
    const slots = expandSlots(rig).map(sl => {
      const occId = Object.keys(stow).find(iid => stow[iid] === sl.id);
      const occ = occId ? items.get(occId) : null;
      if (occ) inRig.push(occ);
      // Свободные И уже размещённые в другом месте предметы, что влезают в
      // слот. Считаются и для занятого слота: заменить лежащее (или
      // переложить сюда вещь из другого слота) должно быть можно одним
      // выбором, не убирая предмет заранее.
      const opts = stowable
        .filter(i => i.id !== rig.id && i.id !== occ?.id && fits(itemSizeStr(i), sl.size))
        .map(i => ({ id: i.id, name: i.name, size: itemSizeStr(i) }));
      return { id: sl.id, size: sl.size, note: sl.note, isMag: sl.isMag,
        awkward: sl.awkward, variants: sl.variants,
        item: occ ? { id: occ.id, name: occ.name, weight: wt(occ) } : null, opts };
    });
    return { id: rig.id, name: rig.name, type: rig.type, container: false, comfortHint, canQuickDraw, backSlot,
      slots, count: inRig.length, total: slots.length, weight: wsum(inRig),
      isMagAny: slots.some(s => s.isMag) };
  });

  // Не размещено: стоуимые предметы без валидной локации.
  const unassigned = stowable
    .filter(i => !isValidStowLoc(locOf(i.id), rigs))
    .map(i => ({ id: i.id, name: i.name, type: ITEM_TYPES[i.type] || i.type, size: itemSizeStr(i), weight: wt(i) }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  // Спину можно занять только одной разгрузкой — предупреждаем при конфликте.
  const backCount = rigs.filter(r => r.system?.rig?.backSlot).length;

  return {
    actorName: actor.name, hasRigs: rigViews.length > 0, rigs: rigViews, unassigned,
    backConflict: backCount > 1,
    unassignedWeight: wsum(stowable.filter(i => !isValidStowLoc(locOf(i.id), rigs)))
  };
}
