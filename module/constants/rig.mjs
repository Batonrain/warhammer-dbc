// ════════════════════════════════════════════════════════════════════════
//  Разгрузки: размеры предметов, слоты, проверка вместимости.
//  Модель — слотовая (как в первоисточнике): у разгрузки набор именованных
//  слотов фикс-размера (rig.slots / rig.magLocks). Предмет занимает слот,
//  если его «отпечаток» (WxH) помещается в слот. Размещение хранится на акторе
//  во флаге warhammer-dbc.stowage = { <itemId>: <location> }, где location:
//    "<slotId>"        — конкретный слот разгрузки,
//    "bp:<rigItemId>"  — в контейнере-рюкзаке.
// ════════════════════════════════════════════════════════════════════════

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
    case "weapon":     return WEAPON_SIZE[s.weaponClass] || "4x1";
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
  const base = { key: "", label: entry.note || entry.size, size: entry.size, awkward: false };
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
