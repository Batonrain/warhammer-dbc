// ════════════════════════════════════════════════════════════════════════
//  Библиотека корабельных узлов (Warhammer DBC) для компендиума
//  "warhammer-dbc.ship-components". Раскладывается по папкам категорий.
//  Свойства (Aspects) парсятся в структурные system.shipProps[].
//  Энергия: двигатели вырабатывают (power < 0), прочие потребляют (power > 0).
//  Пустотные щиты дают VS через modChar=voidShields, modValue=Щиты.
// ════════════════════════════════════════════════════════════════════════

import { SHIP_PROPERTIES } from "./ship-properties.mjs";

const IMG = "icons/svg/item-bag.svg";

// Имя свойства (как в книге, en без рейтинга) → ключ реестра.
const SHIP_PROP_ALIASES = {};
for (const def of Object.values(SHIP_PROPERTIES)) {
  const base = def.en.replace(/\s*\(.*\)\s*$/, "").trim();
  SHIP_PROP_ALIASES[base] = def.key;
}

// Строка свойств → { shipProps:[{key,rating,rating2}], notes:[...] }
function parseShipProps(str) {
  if (!str || /^нет$/i.test(str.trim())) return { shipProps: [], notes: [] };
  const tokens = []; let depth = 0, cur = "";
  for (const ch of str) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { tokens.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) tokens.push(cur.trim());

  const shipProps = [], notes = [];
  for (const tok of tokens) {
    if (!tok) continue;
    const m = tok.match(/^(.*?)\s*\((.*)\)\s*$/);
    let name = tok, rating = null;
    if (m) { name = m[1].trim(); rating = m[2].trim(); }
    const key = SHIP_PROP_ALIASES[name];
    if (!key) { notes.push(tok); continue; }       // «Особое», неизвестное → памятка
    const entry = { key };
    if (rating != null) {
      // Два разделителя: «X/Y» (оба числовые) и «X; Y» — во втором Y это категория
      // текстом («Devastating (2; лэнсы)»), поэтому она уходит в памятку.
      const slash = rating.includes(";") ? rating.split(";") : rating.split("/");
      // «+5» и «-3» — тоже числа: Effective Distance (+5; авгуры), Scent in Warp (-3).
      const num = (t) => {
        const v = String(t ?? "").trim().replace(/^\+/, "");
        return /^-?\d+$/.test(v) ? Number(v) : NaN;
      };
      const r1 = num(slash[0]);
      if (Number.isInteger(r1)) {
        entry.rating = r1;
        if (slash[1] != null) {
          const r2 = num(slash[1]);
          if (Number.isInteger(r2)) entry.rating2 = r2;
          else notes.push(`${name} (2): ${slash[1].trim()}`);
        }
      } else {
        notes.push(`${name}: ${rating}`);          // нечисловой рейтинг (1d5 недель и т.п.)
      }
    }
    shipProps.push(entry);
  }
  return { shipProps, notes };
}

// Сборка узла. o: { kind, hulls, props, pgen, p, spc, sp, r, shields }
// Извлекает суммарный бонус Грузоподъёмности (LC) / Пассажировместимости (PC)
// из строки свойств. Для нескольких альтернативных значений берёт максимум
// (например, «LC (6; открытый), LC (4; тайный)» → 6).
function sumCapacity(str, code) {
  const re = new RegExp(`\\b${code}\\s*\\(\\s*(\\d+)`, "g");
  let m, best = 0;
  while ((m = re.exec(str || "")) !== null) best = Math.max(best, Number(m[1]) || 0);
  return best;
}

function C(folder, name, o) {
  const { shipProps, notes } = parseShipProps(o.props || "");
  if (o.note) notes.push(o.note);
  const isDrive = o.kind === "drive";
  const power = isDrive ? -(o.pgen || 0) : (o.p || 0);
  const sys = {
    kind: o.kind, power, space: o.spc ?? 0, sp: o.sp ?? 0,
    rarity: o.r ?? 0, quality: "common",
    hulls: o.hulls || "", aspects: notes.join(". "), description: "", notes: "",
    essential: !!o.essential, external: false, damaged: false,
    lcBonus: sumCapacity(o.props, "LC"), pcBonus: sumCapacity(o.props, "PC"),
    modChar: "", modValue: 0, shipProps,
    hull: { spaceMax: 0, powerGen: 0, turnArc: "90°", weaponCapacity: "", hullIntegrity: 0 },
    chars: { speed: 0, manoeuvrability: 0, detection: 0, voidShields: 0, armour: 0, turretRating: 0 },
    weapon: { wType: "macrobattery", strength: 0, damage: "", crit: 0, range: 0, arc: "" }
  };
  if (o.kind === "hull") {
    sys.power = 0; sys.space = 0;        // корпус не потребляет/не занимает пространство — он его даёт
    sys.hull = {
      spaceMax: o.spc ?? 0, powerGen: o.pgen ?? 0,
      turnArc: o.turn || "90°", weaponCapacity: o.wc || "", hullIntegrity: o.hi ?? 0
    };
    sys.chars = {
      speed: o.spd ?? 0, manoeuvrability: o.mn ?? 0, detection: o.dt ?? 0,
      voidShields: 0, armour: o.arm ?? 0, turretRating: o.tr ?? 0
    };
  }
  if (o.kind === "voidShield") { sys.modChar = "voidShields"; sys.modValue = o.shields ?? 0; }
  if (o.kind === "weapon") {
    sys.weapon = {
      wType: o.wtype || "macrobattery", strength: o.s ?? 0, damage: o.dmg || "",
      crit: o.crit ?? 0, range: o.rng ?? 0, arc: o.arc || ""
    };
  }
  return { name, type: "component", img: IMG, folder, system: sys };
}

const PLASMA = ["Плазменные двигатели"];
const WARP   = ["Варп-двигатели"];
const VOID   = ["Пустотные щиты"];
const GELLAR = ["Поля Геллера"];
const LIFE   = ["Жизнеобеспечение"];
const QUART  = ["Жилые отсеки"];
const BRIDGE = ["Мостики"];
const AUGUR  = ["Ауспики и авгуры"];
const W_MACRO  = ["Орудия", "Макро"];
const W_PLASMA = ["Орудия", "Плазменные"];
const W_ENERGY = ["Орудия", "Энергетические"];
const W_MISSILE= ["Орудия", "Ракетные"];
const W_EXOTIC = ["Орудия", "Экзотические"];
const W_LANCE  = ["Орудия", "Лэнсы"];
const W_NOVA   = ["Орудия", "Нова"];
const W_TORP   = ["Орудия", "Торпеды"];
const H_TRANS  = ["Корпуса", "Транспорты"];
const H_RAID   = ["Корпуса", "Рейдеры"];
const H_FRIG   = ["Корпуса", "Фрегаты"];
const H_LIGHT  = ["Корпуса", "Лёгкие крейсеры"];
const H_CRUIS  = ["Корпуса", "Крейсеры"];
const H_BCRUIS = ["Корпуса", "Линейные крейсеры"];
const H_GRAND  = ["Корпуса", "Гранд-крейсеры"];
const H_BSHIP  = ["Корпуса", "Линкоры"];
// Дополнительные узлы
const HANGAR  = ["Дополнительные", "Ангарные отсеки"];
const CARGO   = ["Дополнительные", "Грузовые отсеки"];
const PASS    = ["Дополнительные", "Пассажирские отсеки"];
const SUPPLY  = ["Дополнительные", "Припасы и провизия"];
const MANOEUV = ["Дополнительные", "Манёвренность"];
const STURDY  = ["Дополнительные", "Крепость"];
const DEFENSE = ["Дополнительные", "Оборонные меры"];
const DAMAGE  = ["Дополнительные", "Ликвидация повреждений"];
const ARMAMNT = ["Дополнительные", "Вооружение"];
const CREW    = ["Дополнительные", "Экипаж и украшения"];
const FAITH   = ["Дополнительные", "Вера"];
const SCHOOL  = ["Дополнительные", "Схоластика"];
const MEDICAE = ["Дополнительные", "Медика"];
const PWRSCAN = ["Дополнительные", "Энергия и сканеры"];
const STEALTH = ["Дополнительные", "Незаметность"];
const WARPADD = ["Дополнительные", "Варп"];
const RESOURCE= ["Дополнительные", "Ресурсы и промышленность"];
const OTHER   = ["Дополнительные", "Другое"];

export const SHIP_COMPONENTS = [

  // ─────────────────────────── ПЛАЗМЕННЫЕ ДВИГАТЕЛИ ───────────────────────────
  C(PLASMA, "Модель Юпитер класса 1", { kind:"drive", essential:true, hulls:"Транспорты", props:"Нет", pgen:35, spc:8, sp:0, r:0 }),
  C(PLASMA, "Модель Монс «Энерго»", { kind:"drive", essential:true, hulls:"Транспорты", props:"Slowed (1), Clumsy (3)", pgen:50, spc:12, sp:1, r:0 }),
  C(PLASMA, "Модель Марс класса 1", { kind:"drive", essential:true, hulls:"Транспорты", props:"Нет", pgen:35, spc:5, sp:1, r:1 }),
  C(PLASMA, "Модель Станки класса 1", { kind:"drive", essential:true, hulls:"Транспорты", props:"Нет", pgen:40, spc:12, sp:1, r:1 }),
  C(PLASMA, "Модель Кипра класса 1", { kind:"drive", essential:true, hulls:"Транспорты", props:"Archeotech, Void Shadow (15/15)", pgen:30, spc:10, sp:2, r:5 }),
  C(PLASMA, "Модель Мезия Тета-7", { kind:"drive", essential:true, hulls:"Транспорты", props:"Maneuverable (5), Fast (2), Fragile Engine", pgen:44, spc:18, sp:1, r:1 }),
  C(PLASMA, "Модель Станков класса 2а", { kind:"drive", essential:true, hulls:"Транспорты", props:"Maneuverable (3), Fast (1)", pgen:40, spc:14, sp:2, r:2 }),
  C(PLASMA, "Мимикрирующий двигатель (Транспорты)", { kind:"drive", essential:true, hulls:"Транспорты", props:"Xenotech, Особое", pgen:40, spc:12, sp:3, r:4 }),
  C(PLASMA, "Мимикрирующий двигатель (Рейдеры/Фрегаты)", { kind:"drive", essential:true, hulls:"Рейдеры, Фрегаты", props:"Xenotech, Особое", pgen:45, spc:10, sp:3, r:4 }),
  C(PLASMA, "Мимикрирующий двигатель (Лёгкие крейсеры)", { kind:"drive", essential:true, hulls:"Лёгкие крейсеры", props:"Xenotech, Особое", pgen:60, spc:12, sp:3, r:4 }),
  C(PLASMA, "Мимикрирующий двигатель (Крейсеры/Линейные)", { kind:"drive", essential:true, hulls:"Крейсеры, Линейные крейсеры", props:"Xenotech, Особое", pgen:75, spc:14, sp:3, r:4 }),
  C(PLASMA, "Мимикрирующий двигатель (Гранд/Линкоры)", { kind:"drive", essential:true, hulls:"Гранд-крейсеры, Линкоры", props:"Xenotech, Особое", pgen:85, spc:16, sp:3, r:4 }),
  C(PLASMA, "Модель Юпитер класса 2", { kind:"drive", essential:true, hulls:"Рейдеры, Фрегаты", props:"Нет", pgen:45, spc:10, sp:0, r:0 }),
  C(PLASMA, "Модель Кипра класса 2", { kind:"drive", essential:true, hulls:"Рейдеры, Фрегаты", props:"Archeotech, Void Shadow (15/15)", pgen:40, spc:12, sp:2, r:5 }),
  C(PLASMA, "Модель Марс класса 2", { kind:"drive", essential:true, hulls:"Рейдеры, Фрегаты", props:"Нет", pgen:45, spc:7, sp:1, r:1 }),
  C(PLASMA, "Сегразианский пиратский двигатель «Гадюка»", { kind:"drive", essential:true, hulls:"Рейдеры, Фрегаты", props:"Fast (2), Maneuverable (5), Fragile Engine", pgen:45, spc:16, sp:3, r:4 }),
  C(PLASMA, "Модель Станков класса 2в «Эскорт»", { kind:"drive", essential:true, hulls:"Рейдеры, Фрегаты", props:"Maneuverable (3), Fast (1)", pgen:47, spc:14, sp:2, r:2 }),
  C(PLASMA, "Безынерционный двигатель некронов (Рейдеры/Фрегаты)", { kind:"drive", essential:true, hulls:"Рейдеры, Фрегаты", props:"Xenotech, Inertialess", pgen:46, spc:9, sp:4, r:5 }),
  C(PLASMA, "Безынерционный двигатель некронов (Лёгкие крейсеры)", { kind:"drive", essential:true, hulls:"Лёгкие крейсеры", props:"Xenotech, Inertialess", pgen:63, spc:10, sp:4, r:5 }),
  C(PLASMA, "Безынерционный двигатель некронов (Крейсера)", { kind:"drive", essential:true, hulls:"Крейсера", props:"Xenotech, Inertialess", pgen:78, spc:10, sp:4, r:5 }),
  C(PLASMA, "Солнечные паруса эльдар «Аконит» (Рейдеры/Фрегаты)", { kind:"drive", essential:true, hulls:"Рейдеры, Фрегаты", props:"Xenotech, External, Shooting On The Move", pgen:50, spc:0, sp:5, r:5 }),
  C(PLASMA, "Солнечные паруса эльдар «Аконит» (Лёгкие крейсера)", { kind:"drive", essential:true, hulls:"Лёгкие крейсера", props:"Xenotech, External, Shooting On The Move", pgen:70, spc:0, sp:5, r:5 }),
  C(PLASMA, "Солнечные паруса эльдар «Аконит» (Крейсера)", { kind:"drive", essential:true, hulls:"Крейсера", props:"Xenotech, External, Shooting On The Move", pgen:90, spc:0, sp:5, r:5 }),
  C(PLASMA, "Модель Юпитер класса 8.1", { kind:"drive", essential:true, hulls:"Фрегаты", props:"Robust Design (4)", pgen:44, spc:11, sp:1, r:1 }),
  C(PLASMA, "Модель Марс класса 8.1", { kind:"drive", essential:true, hulls:"Фрегаты", props:"Robust Design (4)", pgen:44, spc:9, sp:2, r:2 }),
  C(PLASMA, "Модель Юпитер класса 3", { kind:"drive", essential:true, hulls:"Лёгкие крейсеры", props:"Нет", pgen:60, spc:12, sp:0, r:0 }),
  C(PLASMA, "Модель Марс класса 3", { kind:"drive", essential:true, hulls:"Лёгкие крейсеры", props:"Нет", pgen:60, spc:9, sp:0, r:1 }),
  C(PLASMA, "Модель Юпитер класса 8.2", { kind:"drive", essential:true, hulls:"Лёгкие крейсеры", props:"Robust Design (4)", pgen:59, spc:10, sp:1, r:2 }),
  C(PLASMA, "Модель Марс класса 8.2", { kind:"drive", essential:true, hulls:"Лёгкие крейсеры", props:"Robust Design (4)", pgen:59, spc:13, sp:1, r:1 }),
  C(PLASMA, "Модель Юпитер класса 4.5 «Боевой крейсер» (Лёгкие крейсеры)", { kind:"drive", essential:true, hulls:"Лёгкие крейсеры", props:"Нет", pgen:65, spc:14, sp:2, r:2 }),
  C(PLASMA, "Модель Юпитер класса 4.5 «Боевой крейсер» (Крейсеры/Линейные)", { kind:"drive", essential:true, hulls:"Крейсеры, Линейные крейсеры", props:"Нет", pgen:85, spc:17, sp:2, r:2 }),
  C(PLASMA, "Модель Юпитер класса 4.5 «Боевой крейсер» (Гранд/Линкоры)", { kind:"drive", essential:true, hulls:"Гранд-крейсеры, Линкоры", props:"Нет", pgen:95, spc:19, sp:2, r:2 }),
  C(PLASMA, "Модель Марса класса 4.5 (Лёгкие крейсеры)", { kind:"drive", essential:true, hulls:"Лёгкие крейсеры", props:"Нет", pgen:65, spc:11, sp:3, r:3 }),
  C(PLASMA, "Модель Марса класса 4.5 (Крейсеры/Линейные)", { kind:"drive", essential:true, hulls:"Крейсеры, Линейные крейсеры", props:"Нет", pgen:85, spc:14, sp:3, r:3 }),
  C(PLASMA, "Модель Марса класса 4.5 (Гранд/Линкоры)", { kind:"drive", essential:true, hulls:"Гранд-крейсеры, Линкоры", props:"Нет", pgen:95, spc:16, sp:3, r:3 }),
  C(PLASMA, "Модель Юпитер класса 4 (Крейсеры/Линейные)", { kind:"drive", essential:true, hulls:"Крейсеры, Линейные крейсеры", props:"Нет", pgen:75, spc:14, sp:0, r:0 }),
  C(PLASMA, "Модель Юпитер класса 4 (Гранд/Линкоры)", { kind:"drive", essential:true, hulls:"Гранд-крейсеры, Линкоры", props:"Нет", pgen:85, spc:16, sp:0, r:0 }),
  C(PLASMA, "Модель Марс класса 4 (Крейсеры/Линейные)", { kind:"drive", essential:true, hulls:"Крейсеры, Линейные крейсеры", props:"Нет", pgen:75, spc:11, sp:1, r:1 }),
  C(PLASMA, "Модель Марс класса 4 (Гранд/Линкоры)", { kind:"drive", essential:true, hulls:"Гранд-крейсеры, Линкоры", props:"Нет", pgen:85, spc:13, sp:1, r:1 }),
  C(PLASMA, "Модель Юпитер класса 8.3", { kind:"drive", essential:true, hulls:"Крейсеры, Линейные крейсеры", props:"Robust Design (4)", pgen:74, spc:15, sp:1, r:1 }),
  C(PLASMA, "Модель Марс класса 8.3", { kind:"drive", essential:true, hulls:"Крейсеры, Линейные крейсеры", props:"Robust Design (4)", pgen:74, spc:12, sp:2, r:2 }),
  C(PLASMA, "Модель Юпитер класса 8.4", { kind:"drive", essential:true, hulls:"Гранд-крейсеры", props:"Robust Design (4)", pgen:93, spc:20, sp:1, r:1 }),
  C(PLASMA, "Модель Марс класса 8.4", { kind:"drive", essential:true, hulls:"Гранд-крейсеры", props:"Robust Design (4)", pgen:93, spc:17, sp:2, r:2 }),
  C(PLASMA, "Модель Сатурн класса 5", { kind:"drive", essential:true, hulls:"Гранд-крейсеры", props:"Нет", pgen:95, spc:18, sp:0, r:0 }),
  C(PLASMA, "Модель Сатурн класса 4а «Ультра»", { kind:"drive", essential:true, hulls:"Линейные крейсеры", props:"Нет", pgen:90, spc:14, sp:0, r:0 }),
  C(PLASMA, "Модель Марса класса 5.В", { kind:"drive", essential:true, hulls:"Линкоры", props:"Нет", pgen:97, spc:22, sp:1, r:3 }),
  C(PLASMA, "Модель Люциус класса 6", { kind:"drive", essential:true, hulls:"Линкоры", props:"Robust Design (4)", pgen:100, spc:20, sp:0, r:2 }),
  C(PLASMA, "Модель Сатурн класса 6", { kind:"drive", essential:true, hulls:"Линкоры", props:"Нет", pgen:120, spc:22, sp:3, r:3 }),
  C(PLASMA, "Модель Юпитер класса 5", { kind:"drive", essential:true, hulls:"Линкоры", props:"Нет", pgen:97, spc:20, sp:2, r:4 }),
  C(PLASMA, "Модель Марс класса 5", { kind:"drive", essential:true, hulls:"Линкоры", props:"Нет", pgen:97, spc:17, sp:3, r:5 }),
  C(PLASMA, "Модель Юпитер класса 8.5", { kind:"drive", essential:true, hulls:"Линкоры", props:"Нет", pgen:135, spc:16, sp:3, r:3 }),
  C(PLASMA, "Модель Марс класса 8.5", { kind:"drive", essential:true, hulls:"Линкоры", props:"Нет", pgen:135, spc:13, sp:4, r:4 }),
  C(PLASMA, "Модель Юпитер класса 8.6", { kind:"drive", essential:true, hulls:"Линкоры", props:"Нет", pgen:230, spc:22, sp:3, r:4 }),
  C(PLASMA, "Модель Марс класса 8.6", { kind:"drive", essential:true, hulls:"Линкоры", props:"Нет", pgen:230, spc:19, sp:5, r:5 }),
  C(PLASMA, "Модель Грайя класс 8", { kind:"drive", essential:true, hulls:"Линкоры", props:"Нет", pgen:105, spc:20, sp:1, r:0 }),

  // ─────────────────────────── ВАРП-ДВИГАТЕЛИ ───────────────────────────
  C(WARP, "Путешественник", { kind:"warp", essential:true, hulls:"Все", props:"Scent in Warp (-3), Особое", p:8, spc:12, sp:1, r:2 }),
  C(WARP, "Потоки Впередсмотрящего Глаза стриксис", { kind:"warp", essential:true, hulls:"Все", props:"Xenotech, Scent in Warp (1), Особое", p:12, spc:7, sp:4, r:4 }),
  C(WARP, "Стрелов-1", { kind:"warp", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"Нет", p:10, spc:10, sp:0, r:0 }),
  C(WARP, "Марков-1", { kind:"warp", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"Warp Speed (-1d5 недель)", p:12, spc:12, sp:1, r:1 }),
  C(WARP, "Милослав Джи-616.6", { kind:"warp", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"Нет", p:8, spc:10, sp:0, r:0 }),
  C(WARP, "Албанов-1", { kind:"warp", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"Warp Speed (x2), Scent in Warp (-20), Control Features (+10/Выход из варпа)", p:10, spc:11, sp:1, r:1 }),
  C(WARP, "Кленова класса М", { kind:"warp", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"Warp Luring (1), Limited (способности Проводников; узлы, влияющие на варп-навигацию), Особое", p:10, spc:10, sp:0, r:0 }),
  C(WARP, "Марков-2", { kind:"warp", essential:true, hulls:"Лёгкие крейсеры", props:"Warp Speed (-1d10 дней)", p:13, spc:13, sp:1, r:1 }),
  C(WARP, "Стрелов-2", { kind:"warp", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Нет", p:12, spc:12, sp:0, r:0 }),
  C(WARP, "Милослав ш-616.6", { kind:"warp", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Warp Luring (3), Warp Speed (/2), Vicious Design (1)", p:10, spc:12, sp:2, r:0 }),
  C(WARP, "Стрелов-3", { kind:"warp", essential:true, hulls:"Линкоры", props:"Нет", p:14, spc:14, sp:0, r:0 }),

  // ─────────────────────────── ПУСТОТНЫЕ ЩИТЫ ───────────────────────────
  C(VOID, "Одиночный комплекс щитов", { kind:"voidShield", essential:true, hulls:"Все", props:"Нет", shields:1, p:5, spc:1, sp:0, r:0 }),
  C(VOID, "Блок щитов Восс «Мерцание»", { kind:"voidShield", essential:true, hulls:"Все", props:"Flickering Shield", shields:1, p:3, spc:2, sp:0, r:0 }),
  C(VOID, "Репульсорный щит", { kind:"voidShield", essential:true, hulls:"Все", props:"Repulsion Effect", shields:1, p:6, spc:1, sp:0, r:0 }),
  C(VOID, "Щит «Кастелян»", { kind:"voidShield", essential:true, hulls:"Все", props:"Archeotech, Energy on Shields", shields:1, p:5, spc:1, sp:2, r:5 }),
  C(VOID, "Проекторы квантового щита некронов (Рейдеры…Линейные)", { kind:"voidShield", essential:true, hulls:"Рейдеры, Фрегаты, Лёгкие крейсеры, Крейсеры, Линейные крейсеры", props:"Xenotech, Robust Design (6)", shields:0, p:6, spc:2, sp:3, r:5 }),
  C(VOID, "Проекторы квантового щита некронов (Гранд/Линкоры)", { kind:"voidShield", essential:true, hulls:"Гранд-крейсеры, Линкоры", props:"Xenotech, Robust Design (6)", shields:0, p:10, spc:2, sp:3, r:5 }),
  C(VOID, "Массив призрачного поля стриксис", { kind:"voidShield", essential:true, hulls:"Лёгкие крейсеры, Крейсеры", props:"Xenotech", shields:3, p:7, spc:2, sp:4, r:4 }),
  C(VOID, "Множественный комплекс щитов", { kind:"voidShield", essential:true, hulls:"Крейсеры, Линейные крейсеры", props:"Нет", shields:2, p:7, spc:2, sp:0, r:0 }),
  C(VOID, "Множественный блок щитов модели Восс «Мерцание»", { kind:"voidShield", essential:true, hulls:"Крейсеры, Линейные крейсеры, Гранд-крейсеры", props:"Flickering Shield", shields:2, p:5, spc:1, sp:0, r:0 }),
  C(VOID, "Множественный блок репульсорных щитов", { kind:"voidShield", essential:true, hulls:"Крейсеры, Линейные крейсеры, Гранд-крейсеры", props:"Repulsion Effect", shields:2, p:8, spc:1, sp:0, r:0 }),
  C(VOID, "Множественный блок пустотных щитов «Кастелян»", { kind:"voidShield", essential:true, hulls:"Крейсеры, Линейные крейсеры", props:"Archeotech, Energy on Shields", shields:2, p:7, spc:2, sp:2, r:5 }),
  C(VOID, "Вибрирующий пустотный щит", { kind:"voidShield", essential:true, hulls:"Крейсеры, Линейные крейсеры", props:"Нет", shields:4, p:10, spc:4, sp:3, r:5 }),
  C(VOID, "Сегментированный блок пустотных щитов", { kind:"voidShield", essential:true, hulls:"Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Особое", shields:3, p:6, spc:3, sp:1, r:2 }),
  C(VOID, "Тройной блок пустотных щитов", { kind:"voidShield", essential:true, hulls:"Гранд-крейсеры, Линкоры", props:"Нет", shields:3, p:9, spc:3, sp:0, r:0 }),
  C(VOID, "Блок пустотных щитов Бастион", { kind:"voidShield", essential:true, hulls:"Линкоры", props:"Нет", shields:4, p:12, spc:4, sp:0, r:0 }),
  C(VOID, "Блок пустотных щитов линкора класса «Марс»", { kind:"voidShield", essential:true, hulls:"Линкоры", props:"Нет", shields:4, p:16, spc:6, sp:3, r:5 }),
  C(VOID, "Усиленный массив репульсорных щитов", { kind:"voidShield", essential:true, hulls:"Линкоры", props:"Repulsion Effect", shields:4, p:18, spc:4, sp:3, r:5 }),
  C(VOID, "Массив вибрирующих пустотных щитов", { kind:"voidShield", essential:true, hulls:"Линкоры", props:"Нет", shields:5, p:15, spc:5, sp:5, r:4 }),
  C(VOID, "Множественный массив вибрирующих пустотных щитов", { kind:"voidShield", essential:true, hulls:"Линкоры", props:"Нет", shields:6, p:20, spc:6, sp:4, r:5 }),

  // ─────────────────────────── ПОЛЯ ГЕЛЛЕРА ───────────────────────────
  C(GELLAR, "Поле Геллера: Стандартное", { kind:"gellar", essential:true, hulls:"Все", props:"Нет", p:1, spc:0, sp:0, r:0 }),
  C(GELLAR, "Поле Геллера: Корпус Варпмор", { kind:"gellar", essential:true, hulls:"Все", props:"Control Features (Navigation (Warp)/+10), Scent in Warp (-15), Sacred (3/1)", p:1, spc:0, sp:2, r:2 }),
  C(GELLAR, "Поле Геллера: Модель Белекан 90.р", { kind:"gellar", essential:true, hulls:"Все", props:"Scent in Warp (20), Control Features (Navigation (Warp)/+10)", p:1, spc:0, sp:2, r:2 }),
  C(GELLAR, "Поле Геллера: Аварийное поле", { kind:"gellar", essential:true, hulls:"Все", props:"Особое", p:2, spc:0, sp:0, r:0 }),
  C(GELLAR, "Поле проклятия варпа уровня йота", { kind:"gellar", essential:true, hulls:"Все", props:"Scent in Warp (10), Vicious Design (1), Heretech (Warp)", p:0, spc:0, sp:2, r:3 }),
  C(GELLAR, "Интегрированное пустотное поле Геллера Мезоа", { kind:"gellar", essential:true, hulls:"Транспорты, Рейдеры", props:"Scent in Warp (5), Особое", p:0, spc:0, sp:0, r:0 }),

  // ─────────────────────────── ЖИЗНЕОБЕСПЕЧЕНИЕ ───────────────────────────
  C(LIFE, "СЖО «Марк 1.г» (Транспорты/Рейдеры/Фрегаты)", { kind:"lifeSustainer", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"Weak Spirit (1)", p:3, spc:1, sp:0, r:2 }),
  C(LIFE, "СЖО «Марк 1.г» (Крейсеры+)", { kind:"lifeSustainer", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Weak Spirit (1)", p:4, spc:2, sp:0, r:2 }),
  C(LIFE, "СЖО Схема Витэ (Транспорты/Рейдеры/Фрегаты)", { kind:"lifeSustainer", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"Нет", p:4, spc:2, sp:0, r:0 }),
  C(LIFE, "СЖО Схема Витэ (Крейсеры+)", { kind:"lifeSustainer", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Нет", p:5, spc:3, sp:0, r:0 }),
  C(LIFE, "СЖО Модель Клеменси (Транспорты/Рейдеры/Фрегаты)", { kind:"lifeSustainer", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"High Spirit (1), Enduring Spirit (4), Tempered Flesh (4)", p:4, spc:4, sp:0, r:2 }),
  C(LIFE, "СЖО Модель Клеменси (Крейсеры+)", { kind:"lifeSustainer", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"High Spirit (1), Enduring Spirit (4), Tempered Flesh (4)", p:5, spc:5, sp:0, r:2 }),
  C(LIFE, "СЖО Эфирическая система (Транспорты/Рейдеры/Фрегаты)", { kind:"lifeSustainer", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"Особое", p:4, spc:4, sp:1, r:4 }),
  C(LIFE, "СЖО Эфирическая система (Крейсеры+)", { kind:"lifeSustainer", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Особое", p:5, spc:5, sp:1, r:4 }),
  C(LIFE, "Древняя система жизнеобеспечения (Транспорты/Рейдеры/Фрегаты)", { kind:"lifeSustainer", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"Archeotech, High Spirit (2), Tempered Flesh (1)", p:2, spc:1, sp:2, r:5 }),
  C(LIFE, "Древняя система жизнеобеспечения (Крейсеры+)", { kind:"lifeSustainer", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Archeotech, High Spirit (2), Tempered Flesh (1)", p:2, spc:2, sp:2, r:5 }),

  // ─────────────────────────── ЖИЛЫЕ ОТСЕКИ ───────────────────────────
  C(QUART, "Отсеки насильно набранных (Транспорты/Рейдеры/Фрегаты)", { kind:"quarters", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"Low Spirit (2)", p:1, spc:2, sp:0, r:0 }),
  C(QUART, "Отсеки насильно набранных (Крейсеры/Гранд)", { kind:"quarters", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры", props:"Low Spirit (2)", p:2, spc:3, sp:0, r:0 }),
  C(QUART, "Отсеки насильно набранных (Линкоры)", { kind:"quarters", essential:true, hulls:"Линкоры", props:"Low Spirit (2)", p:3, spc:4, sp:0, r:0 }),
  C(QUART, "Каюты пустоходов (Транспорты/Рейдеры/Фрегаты)", { kind:"quarters", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"Нет", p:1, spc:3, sp:0, r:0 }),
  C(QUART, "Каюты пустоходов (Лёгкие крейсеры/Крейсеры/Линейные)", { kind:"quarters", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры", props:"Нет", p:2, spc:4, sp:0, r:0 }),
  C(QUART, "Каюты пустоходов (Гранд/Линкоры)", { kind:"quarters", essential:true, hulls:"Гранд-крейсеры, Линкоры", props:"Нет", p:3, spc:5, sp:0, r:0 }),
  C(QUART, "Каюты трюмных крыс (Транспорты/Рейдеры/Фрегаты)", { kind:"quarters", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"Low Spirit (3), Tempered Flesh (2)", p:1, spc:1, sp:0, r:0 }),
  C(QUART, "Каюты трюмных крыс (Крейсеры+)", { kind:"quarters", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Low Spirit (3), Tempered Flesh (2)", p:2, spc:3, sp:0, r:0 }),
  C(QUART, "Каюты родовых кланов (Транспорты/Рейдеры/Фрегаты)", { kind:"quarters", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"Enduring Spirit (1), Internal Defense (5)", p:1, spc:4, sp:1, r:1 }),
  C(QUART, "Каюты родовых кланов (Крейсеры+)", { kind:"quarters", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Enduring Spirit (1), Internal Defense (5)", p:2, spc:5, sp:1, r:1 }),
  C(QUART, "Каюты с крио-камерами (Транспорты/Рейдеры/Фрегаты)", { kind:"quarters", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"Особое", p:3, spc:4, sp:1, r:1 }),
  C(QUART, "Каюты с крио-камерами (Лёгкие крейсеры/Крейсеры/Линейные)", { kind:"quarters", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры", props:"Особое", p:4, spc:5, sp:1, r:1 }),
  C(QUART, "Каюты с крио-камерами (Гранд/Линкоры)", { kind:"quarters", essential:true, hulls:"Гранд-крейсеры, Линкоры", props:"Особое", p:5, spc:6, sp:2, r:1 }),
  C(QUART, "Каюты рабов (Транспорты/Рейдеры/Фрегаты)", { kind:"quarters", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"Low Spirit (5)", p:1, spc:1, sp:0, r:0 }),
  C(QUART, "Каюты рабов (Гранд/Линкоры)", { kind:"quarters", essential:true, hulls:"Гранд-крейсеры, Линкоры", props:"Low Spirit (5)", p:2, spc:4, sp:0, r:0 }),
  C(QUART, "Просторные каюты (Транспорты/Рейдеры/Фрегаты)", { kind:"quarters", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"High Spirit (3), Paucity (2)", p:1, spc:3, sp:1, r:1 }),
  C(QUART, "Просторные каюты (Лёгкие крейсеры/Крейсеры/Линейные)", { kind:"quarters", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры", props:"High Spirit (3), Paucity (2)", p:2, spc:4, sp:1, r:1 }),
  C(QUART, "Просторные каюты (Гранд/Линкоры)", { kind:"quarters", essential:true, hulls:"Гранд-крейсеры, Линкоры", props:"High Spirit (3), Paucity (2)", p:3, spc:5, sp:1, r:1 }),
  C(QUART, "Роскошные апартаменты (Транспорты/Рейдеры/Фрегаты)", { kind:"quarters", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"High Spirit (5), Paucity (4)", p:2, spc:5, sp:2, r:1 }),
  C(QUART, "Роскошные апартаменты (Гранд/Линкоры)", { kind:"quarters", essential:true, hulls:"Гранд-крейсеры, Линкоры", props:"High Spirit (5), Paucity (4)", p:3, spc:6, sp:2, r:1 }),
  C(QUART, "Каюты резерва", { kind:"quarters", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты, Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Control Features (Пополнение CP/+10)", p:4, spc:7, sp:3, r:3 }),

  // ─────────────────────────── МОСТИКИ ───────────────────────────
  C(BRIDGE, "Торговый мостик", { kind:"bridge", essential:true, hulls:"Транспорты", props:"Особое", p:1, spc:1, sp:0, r:0 }),
  C(BRIDGE, "Мостик контрабандиста", { kind:"bridge", essential:true, hulls:"Транспорты", props:"Особое", p:1, spc:1, sp:0, r:0 }),
  C(BRIDGE, "Боевой мостик (Транспорты/Рейдеры/Фрегаты)", { kind:"bridge", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"Особое", p:1, spc:1, sp:0, r:0 }),
  C(BRIDGE, "Боевой мостик (Крейсеры+)", { kind:"bridge", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Особое", p:2, spc:2, sp:0, r:0 }),
  C(BRIDGE, "Старинный мостик (Транспорты/Рейдеры/Фрегаты)", { kind:"bridge", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"Archeotech, Maneuverable (5), Control Features (Command, Charm, Intimidation, Deceive/+10)", p:1, spc:1, sp:2, r:5 }),
  C(BRIDGE, "Старинный мостик (Крейсеры+)", { kind:"bridge", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Archeotech, Maneuverable (5), Control Features (Command, Charm, Intimidation, Deceive/+10)", p:2, spc:1, sp:2, r:5 }),
  C(BRIDGE, "Исследовательский мостик (Транспорты/Рейдеры/Фрегаты)", { kind:"bridge", essential:true, hulls:"Транспорты, Рейдеры, Фрегаты", props:"Особое", p:4, spc:1, sp:1, r:1 }),
  C(BRIDGE, "Исследовательский мостик (Крейсеры+)", { kind:"bridge", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Особое", p:4, spc:2, sp:1, r:0 }),
  C(BRIDGE, "Мостик командующего звеном эскорта", { kind:"bridge", essential:true, hulls:"Рейдеры, Фрегаты", props:"Особое", p:3, spc:2, sp:3, r:1 }),
  C(BRIDGE, "Командный мостик (Рейдеры/Фрегаты)", { kind:"bridge", essential:true, hulls:"Рейдеры, Фрегаты", props:"Aimer (5), Control Features (Command/+5), Robust Design (3)", p:2, spc:1, sp:1, r:2 }),
  C(BRIDGE, "Командный мостик (Крейсеры+)", { kind:"bridge", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Aimer (5), Control Features (Command/+5), Robust Design (3)", p:3, spc:2, sp:1, r:2 }),
  C(BRIDGE, "Бронированный мостик (Рейдеры/Фрегаты)", { kind:"bridge", essential:true, hulls:"Рейдеры, Фрегаты", props:"Robust Design (4)", p:2, spc:2, sp:0, r:0 }),
  C(BRIDGE, "Бронированный мостик (Крейсеры+)", { kind:"bridge", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Robust Design (4)", p:3, spc:2, sp:0, r:0 }),
  C(BRIDGE, "Мостик управления полётами", { kind:"bridge", essential:true, hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Особое", p:2, spc:4, sp:0, r:0 }),
  C(BRIDGE, "Мостик хозяина корабля", { kind:"bridge", essential:true, hulls:"Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Aimer (10)", p:4, spc:3, sp:0, r:0 }),
  C(BRIDGE, "Мостик вторжения", { kind:"bridge", essential:true, hulls:"Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Особое, Orbital Strike (10)", p:4, spc:3, sp:0, r:0 }),
  C(BRIDGE, "Флагманский мостик", { kind:"bridge", essential:true, hulls:"Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Особое", p:4, spc:4, sp:0, r:0 }),

  // ─────────────────────────── АУСПИКИ И АВГУРЫ ───────────────────────────
  C(AUGUR, "Комплекс авгуров «Марк-100»", { kind:"augur", essential:true, hulls:"Все", props:"External", p:3, spc:0, sp:0, r:0 }),
  C(AUGUR, "Комплекс авгуров «Марк-201.b»", { kind:"augur", essential:true, hulls:"Все", props:"External, Sensitive (5)", p:5, spc:0, sp:0, r:0 }),
  C(AUGUR, "Многополосный Ауспик R-50", { kind:"augur", essential:true, hulls:"Все", props:"External, Unseeing (2), Особое", p:4, spc:0, sp:0, r:0 }),
  C(AUGUR, "Комплекс глубококосмических авгуров", { kind:"augur", essential:true, hulls:"Все", props:"External, Sensitive (10)", p:7, spc:0, sp:1, r:1 }),
  C(AUGUR, "Десантный сканер Бг-15", { kind:"augur", essential:true, hulls:"Все", props:"External, Orbital Strike (5)", p:5, spc:0, sp:0, r:0 }),
  C(AUGUR, "Массив X-470 ультимо", { kind:"augur", essential:true, hulls:"Все", props:"External, Sensitive (10), Особое", p:6, spc:0, sp:0, r:0 }),
  C(AUGUR, "Массивы пассивного обнаружения W-240", { kind:"augur", essential:true, hulls:"Все", props:"External, Особое", p:3, spc:0, sp:1, r:0 }),
  C(AUGUR, "Авто-стабилизируемый логис-целеуказатель", { kind:"augur", essential:true, hulls:"Все", props:"Archeotech, External, Sensitive (5), Aimer (5)", p:5, spc:0, sp:2, r:5 }),
  C(AUGUR, "Сканер дальней пустоты «Призрачный глаз» стриксис", { kind:"augur", essential:true, hulls:"Все", props:"External, Xenotech, Sensitive (5), Effective Distance (5; авгуры), Особое", p:6, spc:0, sp:4, r:5 }),

  // ─────────────────────────── ОРУДИЯ — МАКРО ───────────────────────────
  C(W_MACRO, "Макроорудия «Удар грома»", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Нет", p:2, spc:2, sp:1, s:3, dmg:"1d10+1", crit:6, rng:4, r:0 }),
  C(W_MACRO, "Макроорудия «Марс»", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Нет", p:4, spc:2, sp:1, s:3, dmg:"1d10+2", crit:5, rng:6, r:0 }),
  C(W_MACRO, "Макроорудия модели Стигия", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Нет", p:4, spc:3, sp:1, s:3, dmg:"1d10+2", crit:5, rng:5, r:0 }),
  C(W_MACRO, "Макроорудия системы Мезоа", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Нет", p:4, spc:4, sp:1, s:4, dmg:"1d10+3", crit:5, rng:5, r:0 }),
  C(W_MACRO, "Бортовые макроорудия «Хеллус»", { kind:"weapon", wtype:"macrobattery", hulls:"Лёгкие крейсеры, Крейсеры", props:"Location Requirements (ПБ, ЛБ)", p:5, spc:6, sp:2, s:6, dmg:"1d10+3", crit:4, rng:6, r:4 }),
  C(W_MACRO, "Бортовые макроорудия модели Мезоа", { kind:"weapon", wtype:"macrobattery", hulls:"Лёгкие крейсеры, Крейсеры", props:"Location Requirements (ПБ, ЛБ)", p:4, spc:6, sp:5, s:6, dmg:"1d10+3", crit:5, rng:5, r:3 }),
  C(W_MACRO, "Макроорудие «Хеллус»", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Нет", p:4, spc:2, sp:2, s:4, dmg:"1d10+3", crit:4, rng:6, r:2 }),
  C(W_MACRO, "Бортовые макроорудия «Марс»", { kind:"weapon", wtype:"macrobattery", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Location Requirements (ПБ, ЛБ)", p:4, spc:5, sp:1, s:6, dmg:"1d10+2", crit:5, rng:6, r:0 }),
  C(W_MACRO, "Бомбардировочное орудие «Стигия»", { kind:"weapon", wtype:"macrobattery", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Death From the Sky", p:5, spc:5, sp:3, s:3, dmg:"1d10+6", crit:2, rng:4, r:2 }),
  C(W_MACRO, "Бортовые грав-пушки модели Станки", { kind:"weapon", wtype:"macrobattery", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Location Requirements (ПБ, ЛБ)", p:5, spc:5, sp:1, s:6, dmg:"1d10+3", crit:6, rng:5, r:0 }),
  C(W_MACRO, "Бомбардировочное орудие «Молот Черепов»", { kind:"weapon", wtype:"macrobattery", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Death From the Sky", p:5, spc:5, sp:3, s:3, dmg:"1d10+6", crit:2, rng:3, r:3 }),
  C(W_MACRO, "Турели защиты эскадры (Лёгкие крейсеры/Крейсеры)", { kind:"weapon", wtype:"macrobattery", hulls:"Лёгкие крейсеры, Крейсеры", props:"Location Requirements (Н, НП, К), Limited (Зенитные турели), Особое", p:2, spc:2, sp:2, s:0, dmg:"—", crit:0, rng:10, r:2 }),
  C(W_MACRO, "Турели защиты эскадры (Гранд/Линкоры)", { kind:"weapon", wtype:"macrobattery", hulls:"Гранд-крейсеры, Линкоры", props:"Location Requirements (Н, НП, К), Limited (Зенитные турели), Особое", p:3, spc:2, sp:2, s:0, dmg:"—", crit:0, rng:10, r:2 }),
  C(W_MACRO, "Батарея орудий «Разрушитель»", { kind:"weapon", wtype:"macrobattery", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Нет", p:9, spc:6, sp:1, s:6, dmg:"1d10+3", crit:5, rng:5, r:2 }),
  C(W_MACRO, "Бомбардировочное орудие модели Люций", { kind:"weapon", wtype:"macrobattery", hulls:"Гранд-крейсеры, Линкоры", props:"Location Requirements (Н, НП, К), Death From the Sky, Havoc (1)", p:8, spc:8, sp:4, s:4, dmg:"1d10+5", crit:2, rng:6, r:4 }),

  // ─────────────────────────── ОРУДИЯ — ПЛАЗМЕННЫЕ ───────────────────────────
  C(W_PLASMA, "Плазменная батарея системы «Риза»", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Vapourisation", p:8, spc:4, sp:2, s:4, dmg:"1d10+4", crit:4, rng:5, r:1 }),
  C(W_PLASMA, "Бортовая плазменная батарея модели Ризы", { kind:"weapon", wtype:"macrobattery", hulls:"Лёгкие крейсеры, Крейсеры", props:"Chain Reaction (1), Location Requirements (ПБ, ЛБ)", p:12, spc:6, sp:3, s:6, dmg:"1d10+4", crit:4, rng:4, r:4 }),
  C(W_PLASMA, "Бортовая фазированная плазменная батарея", { kind:"weapon", wtype:"macrobattery", hulls:"Лёгкие крейсеры, Крейсеры", props:"Chain Reaction (1), Location Requirements (ПБ, ЛБ)", p:12, spc:7, sp:3, s:6, dmg:"1d10+2", crit:4, rng:12, r:4 }),
  C(W_PLASMA, "Плазменная батарея Гекатер", { kind:"weapon", wtype:"macrobattery", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Vapourisation", p:8, spc:3, sp:2, s:3, dmg:"1d10+2", crit:4, rng:11, r:1 }),
  C(W_PLASMA, "Бортовая батарея Гекатер", { kind:"weapon", wtype:"macrobattery", hulls:"Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Vapourisation, Location Requirements (ПБ, ЛБ)", p:12, spc:5, sp:2, s:2, dmg:"1d10+2", crit:4, rng:11, r:1 }),
  C(W_PLASMA, "Орудийная осколочная батарея", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Xenotech", p:0, spc:3, sp:6, s:2, dmg:"1d10+2", crit:3, rng:6, r:4 }),
  C(W_PLASMA, "Фазированная плазменная батарея", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Chain Reaction (1)", p:8, spc:5, sp:3, s:4, dmg:"1d10+2", crit:4, rng:12, r:4 }),
  C(W_PLASMA, "Батарея звёздных пушек эльдар", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Xenotech, Aimer (10)", p:5, spc:3, sp:6, s:4, dmg:"1d10+2", crit:4, rng:6, r:4 }),

  // ─────────────────────────── ОРУДИЯ — ЭНЕРГЕТИЧЕСКИЕ ───────────────────────────
  C(W_ENERGY, "«Солнечный ожог»", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Нет", p:6, spc:4, sp:1, s:4, dmg:"1d10+2", crit:4, rng:9, r:0 }),
  C(W_ENERGY, "Мельта-пушки Пирос", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Нет", p:9, spc:6, sp:1, s:6, dmg:"1d10+4", crit:4, rng:4, r:0 }),
  C(W_ENERGY, "Бортовая батарея «Солнечный Ожог»", { kind:"weapon", wtype:"macrobattery", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Location Requirements (ПБ, ЛБ)", p:9, spc:6, sp:1, s:6, dmg:"1d10+2", crit:4, rng:9, r:0 }),
  C(W_ENERGY, "Батарея волкитных бомбард", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Archeotech, Volkite", p:6, spc:3, sp:4, s:3, dmg:"1d10+2", crit:5, rng:4, r:3 }),
  C(W_ENERGY, "Турболазерные разрушители", { kind:"weapon", wtype:"macrobattery", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Нет", p:4, spc:2, sp:1, s:4, dmg:"1d10+2", crit:5, rng:6, r:2 }),
  C(W_ENERGY, "Лазерная батарея «Гелиос»", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Robust Design (4)", p:4, spc:3, sp:2, s:4, dmg:"1d10+1", crit:3, rng:6, r:1 }),
  C(W_ENERGY, "Лазерная батарея «Гелиос» Мк. 2", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Robust Design (4)", p:4, spc:2, sp:3, s:3, dmg:"1d10+2", crit:4, rng:5, r:2 }),
  C(W_ENERGY, "Бортовая батарея волкитных бомбард", { kind:"weapon", wtype:"macrobattery", hulls:"Лёгкие крейсеры, Крейсеры", props:"Archeotech, Volkite, Location Requirements (ПБ, ЛБ)", p:10, spc:5, sp:4, s:4, dmg:"1d10+2", crit:5, rng:4, r:4 }),
  C(W_ENERGY, "Лазерная макробатерия «Старавар»", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Archeotech", p:4, spc:4, sp:3, s:4, dmg:"1d10+2", crit:4, rng:12, r:5 }),

  // ─────────────────────────── ОРУДИЯ — РАКЕТНЫЕ ───────────────────────────
  C(W_MISSILE, "Ракетная батарея системы Юпитер", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Slow Reload", p:3, spc:1, sp:1, s:5, dmg:"1d10+1", crit:6, rng:6, r:0 }),
  C(W_MISSILE, "Ракетная батарея «Смертельный Удар»", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Нет", p:3, spc:2, sp:3, s:3, dmg:"1d10+3", crit:5, rng:5, r:3 }),
  C(W_MISSILE, "Бортовая ракетная батарея «Смертельный Удар»", { kind:"weapon", wtype:"macrobattery", hulls:"Лёгкие крейсеры, Крейсеры", props:"Location Requirements (ПБ, ЛБ)", p:3, spc:5, sp:3, s:6, dmg:"1d10+3", crit:5, rng:5, r:4 }),

  // ─────────────────────────── ОРУДИЯ — ЭКЗОТИЧЕСКИЕ ───────────────────────────
  C(W_EXOTIC, "Дестабилизирующие", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Нет", p:4, spc:2, sp:2, s:3, dmg:"1d10", crit:0, rng:5, r:1 }),
  C(W_EXOTIC, "Матрица утечки энергии", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Xenotech", p:3, spc:1, sp:2, s:4, dmg:"—", crit:0, rng:4, r:4 }),
  C(W_EXOTIC, "Тёмная пушка", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Xenotech", p:3, spc:2, sp:3, s:3, dmg:"1d10+1", crit:6, rng:6, r:4 }),
  C(W_EXOTIC, "Кинетический лэнс", { kind:"weapon", wtype:"lance", hulls:"Все", props:"Archeotech, Penetrating (Armour)", p:8, spc:4, sp:4, s:3, dmg:"1d5+1", crit:4, rng:6, r:3 }),
  C(W_EXOTIC, "Батарея рельсотронов тау", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Xenotech, Особое", p:8, spc:4, sp:4, s:4, dmg:"1d10+4", crit:4, rng:12, r:4 }),
  C(W_EXOTIC, "Макроорудия Призрачного Света стриксис", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Xenotech, Lifetaker (1)", p:8, spc:3, sp:4, s:4, dmg:"1d10+2", crit:6, rng:5, r:4 }),
  C(W_EXOTIC, "Воющие пушки рак'гол", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Xenotech, Особое", p:5, spc:3, sp:3, s:7, dmg:"1d5+3", crit:5, rng:4, r:4 }),
  C(W_EXOTIC, "Молниевая дуга некронов", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Xenotech, Особое, Penetrating (Holofields)", p:6, spc:3, sp:4, s:4, dmg:"1d10+4", crit:4, rng:6, r:5 }),
  C(W_EXOTIC, "Генератор звёздных импульсов некронов", { kind:"weapon", wtype:"macrobattery", hulls:"Все", props:"Xenotech, Особое, Location Requirements (К)", p:8, spc:5, sp:6, s:1, dmg:"1d10", crit:3, rng:4, r:4 }),
  C(W_EXOTIC, "Гарпунные орудия", { kind:"weapon", wtype:"other", hulls:"Рейдеры", props:"Особое", p:2, spc:2, sp:1, s:0, dmg:"—", crit:0, rng:1, r:0 }),
  C(W_EXOTIC, "Бортовые кинетические лэнсы", { kind:"weapon", wtype:"lance", hulls:"Лёгкие крейсеры, Крейсеры", props:"Archeotech, Penetrating (Armour), Location Requirements (ПБ, ЛБ)", p:12, spc:6, sp:4, s:5, dmg:"1d5+1", crit:4, rng:6, r:4 }),
  C(W_EXOTIC, "Бортовые макроорудия Призрачного Света стриксис", { kind:"weapon", wtype:"macrobattery", hulls:"Лёгкие крейсеры, Крейсеры", props:"Xenotech, Lifetaker (1), Location Requirements (ПБ, ЛБ)", p:12, spc:5, sp:3, s:6, dmg:"1d10+2", crit:6, rng:4, r:4 }),
  C(W_EXOTIC, "Бортовые дестабилизирующие макробатареи", { kind:"weapon", wtype:"macrobattery", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Location Requirements (ПБ, ЛБ)", p:6, spc:5, sp:2, s:3, dmg:"1d10+1", crit:0, rng:5, r:1 }),

  // ─────────────────────────── ОРУДИЯ — ЛЭНСЫ ───────────────────────────
  C(W_LANCE, "Излучатель «Звездолом»", { kind:"weapon", wtype:"lance", hulls:"Все", props:"Penetrating (Armour)", p:6, spc:4, sp:2, s:1, dmg:"1d10+2", crit:3, rng:5, r:1 }),
  C(W_LANCE, "Излучатель «Кузница Титана»", { kind:"weapon", wtype:"lance", hulls:"Все", props:"Penetrating (Armour)", p:9, spc:4, sp:2, s:1, dmg:"1d10+4", crit:3, rng:6, r:1 }),
  C(W_LANCE, "Гибридный лэнс-излучатель «Мезоа»", { kind:"weapon", wtype:"lance", hulls:"Все", props:"Penetrating (Armour)", p:9, spc:4, sp:3, s:1, dmg:"1d10+5", crit:4, rng:4, r:2 }),
  C(W_LANCE, "Лэнс-излучатель «Молот Солнца»", { kind:"weapon", wtype:"lance", hulls:"Все", props:"Penetrating (Armour)", p:9, spc:4, sp:2, s:1, dmg:"1d10+3", crit:3, rng:9, r:1 }),
  C(W_LANCE, "Лэнс-батарея «Молот Солнца»", { kind:"weapon", wtype:"lance", hulls:"Все", props:"Penetrating (Armour)", p:13, spc:6, sp:2, s:2, dmg:"1d10+3", crit:3, rng:9, r:1 }),
  C(W_LANCE, "Лэнс-батарея «Проклятый огонь»", { kind:"weapon", wtype:"lance", hulls:"Все", props:"Penetrating (Armour)", p:13, spc:6, sp:3, s:2, dmg:"1d10+2", crit:3, rng:12, r:4 }),
  C(W_LANCE, "Лэнс-излучатель «Проклятый огонь»", { kind:"weapon", wtype:"lance", hulls:"Все", props:"Penetrating (Armour)", p:9, spc:4, sp:2, s:1, dmg:"1d10+2", crit:3, rng:12, r:4 }),
  C(W_LANCE, "Лэнс-излучатель «Молотилка»", { kind:"weapon", wtype:"lance", hulls:"Все", props:"Penetrating (Armour)", p:10, spc:2, sp:3, s:1, dmg:"1d10+2", crit:4, rng:5, r:2 }),
  C(W_LANCE, "Спасательные лаз-резаки", { kind:"weapon", wtype:"lance", hulls:"Все", props:"Location Requirements (К, НП), Особое, Penetrating (Armour)", p:7, spc:3, sp:3, s:2, dmg:"1d5+1", crit:3, rng:3, r:1 }),
  C(W_LANCE, "Пульсарный лэнс эльдар", { kind:"weapon", wtype:"lance", hulls:"Все", props:"Xenotech, Особое, Penetrating (Armour)", p:10, spc:3, sp:4, s:1, dmg:"1d10+4", crit:3, rng:3, r:4 }),
  C(W_LANCE, "Лэнс-излучатель «Дыхание дракона»", { kind:"weapon", wtype:"lance", hulls:"Все", props:"Location Requirements (Н), Penetrating (Armour)", p:9, spc:4, sp:3, s:1, dmg:"1d10+6", crit:3, rng:3, r:3 }),
  C(W_LANCE, "Кричащий луч рак'гол", { kind:"weapon", wtype:"lance", hulls:"Все", props:"Xenotech, Penetrating (Armour), Особое, Location Requirements (Н)", p:10, spc:5, sp:3, s:3, dmg:"1d10", crit:3, rng:5, r:3 }),
  C(W_LANCE, "Фантомный лэнс эльдар", { kind:"weapon", wtype:"lance", hulls:"Все", props:"Xenotech, Penetrating (Armour), Особое", p:6, spc:5, sp:5, s:1, dmg:"1d10+2", crit:3, rng:4, r:4 }),
  C(W_LANCE, "Ионное орудие тау", { kind:"weapon", wtype:"lance", hulls:"Все", props:"Xenotech, Penetrating (Armour), Chain Reaction (1)", p:9, spc:4, sp:4, s:1, dmg:"1d10+3", crit:3, rng:14, r:4 }),
  C(W_LANCE, "Некронский корпускулярный кнут", { kind:"weapon", wtype:"lance", hulls:"Все", props:"Xenotech, Penetrating (Armour, Holofields), Особое", p:10, spc:4, sp:5, s:2, dmg:"1d10", crit:2, rng:9, r:5 }),
  C(W_LANCE, "Лаз-резаки", { kind:"weapon", wtype:"lance", hulls:"Транспорты, Рейдеры, Фрегаты", props:"Location Requirements (НП, К), Penetrating (Armour)", p:7, spc:3, sp:2, s:2, dmg:"1d5+1", crit:3, rng:3, r:1 }),
  C(W_LANCE, "Батарея «Кузница Титана»", { kind:"weapon", wtype:"lance", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Penetrating (Armour)", p:13, spc:6, sp:2, s:2, dmg:"1d10+4", crit:3, rng:6, r:1 }),
  C(W_LANCE, "Лэнс-излучатель «Звёздная вспышка»", { kind:"weapon", wtype:"lance", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Archeotech, Penetrating (Armour)", p:12, spc:6, sp:3, s:3, dmg:"1d10+3", crit:3, rng:7, r:5 }),
  C(W_LANCE, "Лэнс-батарея «Разрыватель Бездны» (Лёгкие/Крейсеры/Линейные)", { kind:"weapon", wtype:"lance", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры", props:"Location Requirements (Н), Penetrating (Armour)", p:15, spc:8, sp:3, s:3, dmg:"1d10+4", crit:3, rng:6, r:2 }),
  C(W_LANCE, "Лэнс-батарея «Разрыватель Бездны» (Гранд/Линкоры)", { kind:"weapon", wtype:"lance", hulls:"Гранд-крейсеры, Линкоры", props:"Location Requirements (Н, НП), Penetrating (Armour)", p:15, spc:8, sp:3, s:3, dmg:"1d10+4", crit:3, rng:6, r:2 }),
  C(W_LANCE, "Гибридная лэнс-батарея «Мезоа»", { kind:"weapon", wtype:"lance", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Penetrating (Armour)", p:13, spc:6, sp:2, s:2, dmg:"1d10+5", crit:4, rng:4, r:2 }),
  C(W_LANCE, "Батарея лэнсов «Молотилка»", { kind:"weapon", wtype:"lance", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Penetrating (Armour)", p:14, spc:4, sp:3, s:2, dmg:"1d10+2", crit:4, rng:5, r:3 }),
  C(W_LANCE, "Лэнс-батарея «Дыхание дракона»", { kind:"weapon", wtype:"lance", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Location Requirements (Н), Penetrating (Armour)", p:13, spc:8, sp:4, s:3, dmg:"1d10+6", crit:3, rng:3, r:3 }),
  C(W_LANCE, "Лэнс-излучатель «Рапира»", { kind:"weapon", wtype:"lance", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Penetrating (Armour)", p:10, spc:5, sp:3, s:1, dmg:"1d10+4", crit:3, rng:10, r:2 }),
  C(W_LANCE, "Излучатель «Погибель Богов»", { kind:"weapon", wtype:"lance", hulls:"Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Penetrating (Armour)", p:9, spc:4, sp:3, s:2, dmg:"1d10+2", crit:3, rng:12, r:2 }),
  C(W_LANCE, "Батарея «Погибель Богов»", { kind:"weapon", wtype:"lance", hulls:"Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Penetrating (Armour)", p:13, spc:6, sp:3, s:3, dmg:"1d10+2", crit:3, rng:12, r:2 }),
  C(W_LANCE, "Экзолазер", { kind:"weapon", wtype:"lance", hulls:"Гранд-крейсеры, Линкоры", props:"Особое, Penetrating (Armour)", p:15, spc:7, sp:5, s:4, dmg:"1d10+12", crit:1, rng:20, r:4 }),
  C(W_LANCE, "Лэнс-батарея «Рапира»", { kind:"weapon", wtype:"lance", hulls:"Гранд-крейсеры, Линкоры", props:"Penetrating (Armour)", p:14, spc:6, sp:3, s:3, dmg:"1d10+4", crit:3, rng:10, r:3 }),

  // ─────────────────────────── ОРУДИЯ — НОВА ───────────────────────────
  C(W_NOVA, "Нова-орудие модели Марс", { kind:"weapon", wtype:"nova", hulls:"Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Location Requirements (Н), Slow Reload, Core Architecture", p:3, spc:7, sp:3, s:0, dmg:"2d5+4", crit:0, rng:40, r:2 }),
  C(W_NOVA, "Нова-орудие модели Риза", { kind:"weapon", wtype:"nova", hulls:"Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Location Requirements (Н), Slow Reload, Core Architecture", p:4, spc:7, sp:4, s:0, dmg:"2d5+5", crit:0, rng:36, r:3 }),
  C(W_NOVA, "Нова-орудие модели Юпитер", { kind:"weapon", wtype:"nova", hulls:"Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Archeotech, Location Requirements (Н), Slow Reload, Core Architecture, Explosive", p:6, spc:7, sp:5, s:0, dmg:"2d5+7", crit:0, rng:35, r:5 }),
  C(W_NOVA, "Нова-орудие модели Инферно", { kind:"weapon", wtype:"nova", hulls:"Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Core Architecture, Location Requirements (Н), Особое", p:5, spc:8, sp:6, s:0, dmg:"2d5+3", crit:0, rng:35, r:5 }),

  // ─────────────────────────── ОРУДИЯ — ТОРПЕДЫ ───────────────────────────
  C(W_TORP, "Торпедный аппарат «Грифон»", { kind:"weapon", wtype:"torpedo", hulls:"Все", props:"Location Requirements (Н, К), Explosive, Penetrating (Void Shields)", p:2, spc:6, sp:1, s:4, dmg:"", crit:0, rng:0, r:0 }),
  C(W_TORP, "Торпедный аппарат «Восс»", { kind:"weapon", wtype:"torpedo", hulls:"Все", props:"Location Requirements (Н, К), Explosive, Penetrating (Void Shields)", p:1, spc:5, sp:1, s:2, dmg:"", crit:0, rng:0, r:1 }),
  C(W_TORP, "Плазменно ускоренный торпедный аппарат", { kind:"weapon", wtype:"torpedo", hulls:"Все", props:"Location Requirements (Н, К), Archeotech, Explosive, Penetrating (Void Shields)", p:2, spc:4, sp:4, s:4, dmg:"", crit:0, rng:0, r:5 }),
  C(W_TORP, "Торпедный аппарат «Фортис»", { kind:"weapon", wtype:"torpedo", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Location Requirements (Н, К), Explosive, Penetrating (Void Shields)", p:2, spc:8, sp:3, s:6, dmg:"", crit:0, rng:0, r:2 }),
  C(W_TORP, "Торпедный аппарат «Марс»", { kind:"weapon", wtype:"torpedo", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Location Requirements (Н, К), Explosive, Penetrating (Void Shields)", p:2, spc:8, sp:2, s:6, dmg:"", crit:0, rng:0, r:1 }),

  // ═══════════════════════════ КОРПУСА ═══════════════════════════
  // ─────────────────────────── ТРАНСПОРТЫ ───────────────────────────
  C(H_TRANS, "Иерихон", { kind:"hull", spd:3, mn:-10, dt:5, hi:50, arm:12, tr:1, spc:45, sp:20, wc:"Н1, ПБ1, ЛБ1", turn:"90°", props:"In-build (Главный грузовой трюм, 1/2)" }),
  C(H_TRANS, "Бродяга", { kind:"hull", spd:4, mn:10, dt:-5, hi:40, arm:13, tr:1, spc:40, sp:20, wc:"Н1, НП1", turn:"90°", props:"In-build (Главный грузовой трюм, 1/2)" }),
  C(H_TRANS, "Локи", { kind:"hull", spd:4, mn:-5, dt:10, hi:40, arm:13, tr:1, spc:44, sp:21, wc:"Н1, НП1", turn:"90°", props:"In-build (Главный грузовой трюм, 1/2), In-build (Маскирующая система «Локи», 1/3)" }),
  C(H_TRANS, "Слон", { kind:"hull", spd:3, mn:-5, dt:8, hi:25, arm:12, tr:1, spc:30, sp:10, wc:"НП1", turn:"90°", props:"In-build (Главный грузовой трюм, 1/2)" }),
  C(H_TRANS, "Носорог", { kind:"hull", spd:3, mn:-5, dt:8, hi:20, arm:10, tr:1, spc:35, sp:20, wc:"Нет", turn:"90°", props:"In-build (Главный грузовой трюм, 1/2)" }),
  C(H_TRANS, "Галеон", { kind:"hull", spd:2, mn:-20, dt:15, hi:35, arm:18, tr:1, spc:40, sp:26, wc:"НП1, ПБ1, ЛБ1", turn:"90°", props:"In-build (Главный грузовой трюм, 1/2)" }),
  C(H_TRANS, "Джон Бахмейер", { kind:"hull", spd:2, mn:-30, dt:0, hi:25, arm:10, tr:1, spc:35, sp:10, wc:"Нет", turn:"90°", props:"In-build (Главный грузовой трюм, 1/2)" }),
  C(H_TRANS, "Мул", { kind:"hull", spd:2, mn:-20, dt:12, hi:70, arm:14, tr:1, spc:60, sp:20, wc:"Н1, ПБ1, ЛБ1", turn:"45°", props:"In-build (Главный грузовой трюм, 1/2)" }),
  C(H_TRANS, "Купец", { kind:"hull", spd:2, mn:-30, dt:0, hi:25, arm:9, tr:1, spc:35, sp:10, wc:"Нет", turn:"90°", props:"In-build (Главный грузовой трюм, 1/2)" }),
  C(H_TRANS, "Титан", { kind:"hull", spd:2, mn:-20, dt:10, hi:90, arm:16, tr:2, spc:100, sp:55, wc:"НП1, ПБ1, ЛБ1", turn:"45°", props:"In-build (Главный грузовой трюм, 1/2), Hybrid Ship (плазменные двигатели/гранд-крейсера), Hybrid Ship (пустотные щиты, варп-двигатели, системы жизнеобеспечения, жилые отсеки/крейсера)" }),
  C(H_TRANS, "Колосс", { kind:"hull", spd:2, mn:-20, dt:8, hi:110, arm:14, tr:2, spc:125, sp:55, wc:"НП1, ПБ1, ЛБ1", turn:"45°", props:"In-build (Главный грузовой трюм, 1/2), Hybrid Ship (плазменные двигатели/гранд-крейсера), Hybrid Ship (пустотные щиты, варп-двигатели, системы жизнеобеспечения, жилые отсеки/крейсера), Limited (Fast), Dreadnought" }),
  C(H_TRANS, "Мундус Вектурэ", { kind:"hull", spd:4, mn:0, dt:0, hi:32, arm:11, tr:1, spc:42, sp:15, wc:"НП1", turn:"90°", props:"Нет" }),
  C(H_TRANS, "Открытие", { kind:"hull", spd:3, mn:-10, dt:8, hi:55, arm:17, tr:2, spc:35, sp:45, wc:"Н1, ПБ1, ЛБ1", turn:"90°", props:"In-build (Главный грузовой трюм, 1/2), Hybrid Ship (плазменные двигатели, варп-двигатели, системы жизнеобеспечения, жилые отсеки/лёгкие крейсера), Hybrid Ship (пустотные щиты/крейсера), In-build (Мануфакторум, 1/2)" }),
  C(H_TRANS, "Каравелла", { kind:"hull", spd:10, mn:30, dt:3, hi:5, arm:9, tr:0, spc:25, sp:8, wc:"Н1", turn:"90°", props:"Limited (Armored, варп-двигатели)" }),
  C(H_TRANS, "Газель", { kind:"hull", spd:11, mn:30, dt:8, hi:15, arm:12, tr:1, spc:28, sp:20, wc:"Нет", turn:"90°", props:"Limited (Armored)" }),
  C(H_TRANS, "Орион", { kind:"hull", spd:10, mn:25, dt:10, hi:35, arm:12, tr:1, spc:40, sp:25, wc:"НП1, К1", turn:"90°", props:"In-build (Главный грузовой трюм, 1/2), Limited (Armored)" }),
  C(H_TRANS, "Дева", { kind:"hull", spd:2, mn:-15, dt:10, hi:30, arm:15, tr:2, spc:33, sp:25, wc:"НП1", turn:"90°", props:"In-build (Трюмный ангарный отсек, 1/1)" }),
  C(H_TRANS, "Кобольд", { kind:"hull", spd:2, mn:-10, dt:5, hi:45, arm:11, tr:1, spc:45, sp:18, wc:"НП1", turn:"90°", props:"In-build (Главный грузовой трюм, 1/2)" }),
  C(H_TRANS, "Цверг", { kind:"hull", spd:1, mn:-30, dt:0, hi:5, arm:12, tr:1, spc:35, sp:5, wc:"Нет", turn:"90°", props:"In-build (Главный грузовой трюм, 1/2)" }),
  C(H_TRANS, "Тараск", { kind:"hull", spd:6, mn:-5, dt:5, hi:15, arm:10, tr:1, spc:40, sp:20, wc:"НП1", turn:"90°", props:"Нет" }),
  C(H_TRANS, "Каррака", { kind:"hull", spd:4, mn:-5, dt:10, hi:45, arm:15, tr:1, spc:38, sp:25, wc:"НП2", turn:"90°", props:"In-build (Главный грузовой трюм, 1/2)" }),
  C(H_TRANS, "Голиаф", { kind:"hull", spd:3, mn:-10, dt:4, hi:50, arm:14, tr:1, spc:40, sp:25, wc:"ПБ1, ЛБ1, НП1", turn:"90°", props:"In-build (Главный грузовой трюм, 2/4), In-build (Переработчик плазмы, 1/3), Breathing Heat (10)" }),
  C(H_TRANS, "Вселенная", { kind:"hull", spd:2, mn:-20, dt:5, hi:65, arm:12, tr:1, spc:94, sp:45, wc:"ПБ1, ЛБ1, НП1", turn:"45°", props:"In-build (Fast), In-build (Главный грузовой трюм, 4/8), Limited (Энергогенераторум, 1/0)" }),
  C(H_TRANS, "Душеклеть", { kind:"hull", spd:3, mn:-10, dt:5, hi:35, arm:15, tr:1, spc:40, sp:35, wc:"НП1, Н1", turn:"90°", props:"In-build (Главный грузовой трюм, 1/2), Vicious Design (1), In-build (Крик душ)" }),

  // ─────────────────────────── РЕЙДЕРЫ ───────────────────────────
  C(H_RAID, "Асироф", { kind:"hull", spd:10, mn:23, dt:12, hi:32, arm:14, tr:1, spc:35, sp:30, wc:"Н1, НП1", turn:"90°", props:"Нет" }),
  C(H_RAID, "Опустошение", { kind:"hull", spd:9, mn:25, dt:10, hi:30, arm:16, tr:1, spc:40, sp:34, wc:"Н1, НП1", turn:"90°", props:"Нет" }),
  C(H_RAID, "Кобра", { kind:"hull", spd:10, mn:30, dt:10, hi:30, arm:14, tr:1, spc:35, sp:34, wc:"Н1, НП1", turn:"90°", props:"Нет" }),
  C(H_RAID, "Сорокопут", { kind:"hull", spd:10, mn:25, dt:20, hi:30, arm:14, tr:2, spc:35, sp:34, wc:"Н1, НП1", turn:"90°", props:"Aimer (5)" }),
  C(H_RAID, "Иконоборец", { kind:"hull", spd:10, mn:25, dt:10, hi:28, arm:19, tr:1, spc:32, sp:29, wc:"НП2", turn:"90°", props:"Easy to Repair (2), Vicious Design (1)" }),
  C(H_RAID, "Язычник", { kind:"hull", spd:10, mn:25, dt:10, hi:33, arm:17, tr:1, spc:33, sp:33, wc:"Н1, НП1", turn:"90°", props:"In-build (Внутренние переборки, 1/0), Easy to Repair (1), Vicious Design (1)" }),
  C(H_RAID, "Гадюка", { kind:"hull", spd:11, mn:30, dt:25, hi:25, arm:12, tr:1, spc:29, sp:27, wc:"НП1", turn:"90°", props:"Vicious Design (1)" }),
  C(H_RAID, "Идолопоклонник", { kind:"hull", spd:8, mn:20, dt:12, hi:30, arm:14, tr:1, spc:40, sp:30, wc:"Н1, НП1", turn:"90°", props:"Vicious Design (1)" }),
  C(H_RAID, "Барон", { kind:"hull", spd:10, mn:30, dt:20, hi:30, arm:15, tr:1, spc:34, sp:35, wc:"1НП, 1Н", turn:"90°", props:"Нет" }),
  C(H_RAID, "Гарпия", { kind:"hull", spd:12, mn:35, dt:20, hi:20, arm:13, tr:1, spc:30, sp:30, wc:"1Н", turn:"90°", props:"Нет" }),
  C(H_RAID, "Оплот", { kind:"hull", spd:9, mn:25, dt:10, hi:30, arm:20, tr:1, spc:30, sp:30, wc:"1НП", turn:"90°", props:"In-build (Постановщик минных полей, 3/3)" }),
  C(H_RAID, "Спектр", { kind:"hull", spd:14, mn:50, dt:25, hi:20, arm:13, tr:1, spc:30, sp:31, wc:"1Н", turn:"90°", props:"Warp Speed (/4), Void Shadow (0/15)" }),

  // ─────────────────────────── ФРЕГАТЫ ───────────────────────────
  C(H_FRIG, "Меч", { kind:"hull", spd:8, mn:20, dt:15, hi:35, arm:18, tr:2, spc:40, sp:40, wc:"НП2", turn:"90°", props:"Нет" }),
  C(H_FRIG, "Буря", { kind:"hull", spd:8, mn:18, dt:12, hi:36, arm:19, tr:1, spc:42, sp:40, wc:"НП2", turn:"90°", props:"Нет" }),
  C(H_FRIG, "Огненный шторм", { kind:"hull", spd:7, mn:20, dt:15, hi:38, arm:18, tr:1, spc:41, sp:41, wc:"Н1, НП1", turn:"90°", props:"Нет" }),
  C(H_FRIG, "Фальшион", { kind:"hull", spd:8, mn:17, dt:14, hi:36, arm:17, tr:1, spc:34, sp:42, wc:"Н1, НП2", turn:"90°", props:"In-build (Торпедный аппарат Восс (Н), 1/1)" }),
  C(H_FRIG, "Клеймор", { kind:"hull", spd:8, mn:18, dt:15, hi:38, arm:17, tr:2, spc:38, sp:38, wc:"НП2", turn:"90°", props:"Нет" }),
  C(H_FRIG, "Буйный", { kind:"hull", spd:7, mn:18, dt:15, hi:40, arm:20, tr:1, spc:40, sp:20, wc:"1НП", turn:"90°", props:"Control Features (Command/-5), Breathing Heat (2)" }),
  C(H_FRIG, "Упорный", { kind:"hull", spd:6, mn:18, dt:14, hi:38, arm:18, tr:1, spc:44, sp:38, wc:"1НП", turn:"90°", props:"In-build (Главный грузовой трюм, 1/2)" }),
  C(H_FRIG, "Тор", { kind:"hull", spd:9, mn:20, dt:14, hi:36, arm:16, tr:1, spc:40, sp:40, wc:"2Н, 1НП", turn:"90°", props:"In-build (Торпедный аппарат Грифон (Н), 2/4), Aimer (20)" }),
  C(H_FRIG, "Молния", { kind:"hull", spd:9, mn:20, dt:20, hi:30, arm:16, tr:1, spc:36, sp:40, wc:"1НП, 1Н", turn:"90°", props:"Нет" }),
  C(H_FRIG, "Бдение", { kind:"hull", spd:5, mn:5, dt:30, hi:20, arm:17, tr:1, spc:50, sp:50, wc:"1Н", turn:"90°", props:"In-build (Нова-орудие модели Марс (Н), 1/3)" }),

  // ─────────────────────────── ЛЁГКИЕ КРЕЙСЕРЫ ───────────────────────────
  C(H_LIGHT, "Неустрашимый", { kind:"hull", spd:7, mn:15, dt:20, hi:60, arm:19, tr:1, spc:60, sp:55, wc:"Н1, ПБ1, ЛБ1", turn:"45°", props:"Нет" }),
  C(H_LIGHT, "Защитник", { kind:"hull", spd:7, mn:15, dt:20, hi:52, arm:17, tr:2, spc:57, sp:55, wc:"Н1, ПБ1, ЛБ1, НП1", turn:"45°", props:"Нет" }),
  C(H_LIGHT, "Станки", { kind:"hull", spd:5, mn:12, dt:15, hi:63, arm:20, tr:1, spc:60, sp:55, wc:"Н1, ПБ1, ЛБ1", turn:"45°", props:"Нет" }),
  C(H_LIGHT, "Сектор", { kind:"hull", spd:5, mn:12, dt:15, hi:60, arm:20, tr:2, spc:58, sp:58, wc:"Н1, ПБ1, НП1", turn:"45°", props:"Hybrid Ship (Пустотные щиты/только крейсера)" }),
  C(H_LIGHT, "Стремление", { kind:"hull", spd:6, mn:12, dt:15, hi:60, arm:20, tr:2, spc:56, sp:54, wc:"Н2, ПБ1, ЛБ1", turn:"45°", props:"In-build (Торпедный аппарат системы Восс (нос), 1/1)" }),
  C(H_LIGHT, "Непокорный", { kind:"hull", spd:6, mn:12, dt:15, hi:60, arm:20, tr:1, spc:55, sp:50, wc:"Н1, ПБ1, ЛБ1", turn:"45°", props:"In-build (Ангарный отсек системы Юпитера (ПБ и ЛБ), 2/2)" }),
  C(H_LIGHT, "Гонец Кузни", { kind:"hull", spd:4, mn:-5, dt:12, hi:50, arm:18, tr:2, spc:42, sp:50, wc:"Н1, ПБ1, НП1", turn:"45°", props:"Нет" }),
  C(H_LIGHT, "Силовик", { kind:"hull", spd:7, mn:15, dt:18, hi:58, arm:17, tr:1, spc:50, sp:50, wc:"Н1, ПБ1, ЛБ1", turn:"45°", props:"In-build (Ангарный отсек системы Юпитера (ПБ и ЛБ), 2/2)" }),
  C(H_LIGHT, "Силурия", { kind:"hull", spd:6, mn:13, dt:24, hi:56, arm:17, tr:1, spc:58, sp:45, wc:"Н1, ПБ1, ЛБ1", turn:"45°", props:"In-build (Ангарный отсек системы Юпитера (ПБ и ЛБ), 2/2)" }),
  C(H_LIGHT, "Несущий ад", { kind:"hull", spd:8, mn:15, dt:20, hi:56, arm:18, tr:1, spc:50, sp:50, wc:"Н1, НП1, ПБ1, ЛБ1", turn:"45°", props:"Orbital Strike (10), In-build (Молот Черепов (нос), 1/5), Особое" }),
  C(H_LIGHT, "Тлетворный", { kind:"hull", spd:5, mn:5, dt:10, hi:60, arm:22, tr:1, spc:60, sp:50, wc:"Н1, ПБ1, ЛБ1", turn:"45°", props:"Vicious Design (2), In-build (Гнездо демонов (Чумоносцы)), Easy to Repair (3), Особое" }),
  C(H_LIGHT, "Тетсудзин", { kind:"hull", spd:9, mn:25, dt:15, hi:55, arm:20, tr:1, spc:60, sp:55, wc:"1К, 1НП, 1Н", turn:"45°", props:"Нет" }),

  // ─────────────────────────── КРЕЙСЕРЫ ───────────────────────────
  C(H_CRUIS, "Лунный", { kind:"hull", spd:5, mn:10, dt:10, hi:70, arm:20, tr:2, spc:75, sp:60, wc:"Н1, ПБ2, ЛБ2", turn:"45°", props:"Нет" }),
  C(H_CRUIS, "Тиран", { kind:"hull", spd:5, mn:10, dt:10, hi:70, arm:20, tr:2, spc:75, sp:61, wc:"Н1, ПБ2, ЛБ2", turn:"45°", props:"Нет" }),
  C(H_CRUIS, "Завоевание", { kind:"hull", spd:4, mn:5, dt:10, hi:65, arm:16, tr:1, spc:67, sp:52, wc:"Н1, ПБ2, ЛБ2", turn:"45°", props:"In-build (Главный грузовой трюм, 2/4), Hybrid Ship (все/транспорты)" }),
  C(H_CRUIS, "Амбиция", { kind:"hull", spd:5, mn:12, dt:15, hi:66, arm:17, tr:2, spc:75, sp:58, wc:"Н1, ПБ2, ЛБ2", turn:"45°", props:"Нет" }),
  C(H_CRUIS, "Диктатор", { kind:"hull", spd:5, mn:8, dt:10, hi:70, arm:20, tr:2, spc:65, sp:63, wc:"Н1, ПБ2, ЛБ2", turn:"45°", props:"In-build (Ангар системы Юпитера (ПБ и ЛБ), 2/2)" }),
  C(H_CRUIS, "Просветление", { kind:"hull", spd:5, mn:7, dt:20, hi:74, arm:20, tr:2, spc:65, sp:63, wc:"Н1, ПБ2, ЛБ1, НП1", turn:"45°", props:"In-build (Бронированный нос, 1/0)" }),
  C(H_CRUIS, "Полёт Ястреба", { kind:"hull", spd:7, mn:15, dt:25, hi:57, arm:16, tr:3, spc:58, sp:60, wc:"Н1, ПБ1, ЛБ1, НП1", turn:"45°", props:"Нет" }),
  C(H_CRUIS, "Смелость", { kind:"hull", spd:4, mn:8, dt:20, hi:70, arm:18, tr:2, spc:57, sp:59, wc:"ЛБ2, ПБ2, НП1", turn:"45°", props:"In-build (Позолоченный корпус, 1/0)" }),
  C(H_CRUIS, "Доминатор", { kind:"hull", spd:5, mn:10, dt:10, hi:70, arm:20, tr:2, spc:64, sp:60, wc:"Н1, ПБ2, ЛБ2", turn:"45°", props:"In-build (Бронированный нос, 1/0), In-build (Нова-орудие Марс (нос), 1/3)" }),
  C(H_CRUIS, "Готика", { kind:"hull", spd:4, mn:10, dt:10, hi:70, arm:20, tr:2, spc:68, sp:61, wc:"Н1, ПБ2, ЛБ2", turn:"45°", props:"In-build (Бронированный нос, 1/0), In-build (Торпедный аппарат Марс (нос), 1/2)" }),
  C(H_CRUIS, "Опустошение", { kind:"hull", spd:7, mn:10, dt:10, hi:70, arm:25, tr:2, spc:75, sp:60, wc:"НП1, ПБ2, ЛБ2", turn:"45°", props:"In-build (Ангар системы Опустошение (ПБ и ЛБ), 2/2), Vicious Design (1)" }),
  C(H_CRUIS, "Бойня", { kind:"hull", spd:9, mn:5, dt:5, hi:68, arm:20, tr:2, spc:75, sp:60, wc:"Н1, ПБ2, ЛБ2", turn:"45°", props:"Vicious Design (1), In-build (Катушка Скартикс, 1/6)" }),
  C(H_CRUIS, "Резня", { kind:"hull", spd:7, mn:5, dt:10, hi:73, arm:20, tr:2, spc:65, sp:60, wc:"НП1, ПБ2, ЛБ2", turn:"45°", props:"In-build (Плазмопровода, 1/0), Vicious Design (1), Aimer (5)" }),
  C(H_CRUIS, "Убийство", { kind:"hull", spd:7, mn:10, dt:10, hi:70, arm:20, tr:2, spc:75, sp:65, wc:"НП1, ПБ2, ЛБ2", turn:"45°", props:"Особое, In-build (Продвинутые плазменные батареи ×4), Vicious Design (1)" }),
  C(H_CRUIS, "Оружносец", { kind:"hull", spd:8, mn:0, dt:10, hi:70, arm:16, tr:3, spc:64, sp:50, wc:"1Н, 1ПБ, 1ЛБ, 1НП", turn:"45°", props:"In-build (Ангар системы Юпитера (ПБ и ЛБ), 2/2), Repair Deck" }),
  C(H_CRUIS, "Эксклюзатор", { kind:"hull", spd:8, mn:15, dt:20, hi:60, arm:16, tr:2, spc:65, sp:67, wc:"2К, 1НП, 1Н", turn:"45°", props:"Нет" }),

  // ─────────────────────────── ЛИНЕЙНЫЕ КРЕЙСЕРЫ ───────────────────────────
  C(H_BCRUIS, "Владыка", { kind:"hull", spd:5, mn:10, dt:10, hi:70, arm:20, tr:2, spc:78, sp:64, wc:"Н1, ПБ2, ЛБ2, НП1", turn:"45°", props:"Нет" }),
  C(H_BCRUIS, "Марс", { kind:"hull", spd:5, mn:10, dt:10, hi:70, arm:20, tr:2, spc:54, sp:71, wc:"Н1, ПБ2, ЛБ2, НП1", turn:"45°", props:"In-build (Ангарный отсек системы Юпитера (ПБ и ЛБ), 2/2), In-build (нова-орудие системы Марса (нос), 1/3), In-build (Бронированный нос, 1/0)" }),
  C(H_BCRUIS, "Чаша", { kind:"hull", spd:6, mn:10, dt:10, hi:76, arm:19, tr:2, spc:75, sp:60, wc:"Н1, ПБ2, ЛБ2, НП1", turn:"45°", props:"In-build (Additional Plasma Conduits, 1/0)" }),
  C(H_BCRUIS, "Армагеддон", { kind:"hull", spd:5, mn:10, dt:10, hi:70, arm:20, tr:2, spc:73, sp:60, wc:"Н1, ПБ2, ЛБ2, НП1", turn:"45°", props:"Travel Supplies (3)" }),
  C(H_BCRUIS, "Кардинал", { kind:"hull", spd:5, mn:5, dt:10, hi:75, arm:20, tr:2, spc:84, sp:64, wc:"Н1, ПБ2, ЛБ2, НП1", turn:"45°", props:"Нет" }),
  C(H_BCRUIS, "Аид", { kind:"hull", spd:5, mn:5, dt:10, hi:75, arm:20, tr:2, spc:78, sp:70, wc:"Н1, ПБ2, ЛБ2", turn:"45°", props:"In-build (Флагманский мостик, 1/4), Vicious Design (2), Enduring Spirit (1)" }),
  C(H_BCRUIS, "Стикс", { kind:"hull", spd:7, mn:10, dt:10, hi:80, arm:21, tr:3, spc:100, sp:80, wc:"Н1, НП1, ПБ2, ЛБ2", turn:"45°", props:"Нет" }),
  C(H_BCRUIS, "Ахерон", { kind:"hull", spd:7, mn:10, dt:10, hi:80, arm:20, tr:2, spc:100, sp:72, wc:"Н1, ПБ1, ЛБ1", turn:"45°", props:"Особое" }),
  C(H_BCRUIS, "Беллерофон", { kind:"hull", spd:7, mn:5, dt:5, hi:75, arm:22, tr:2, spc:75, sp:58, wc:"ПБ3, ЛБ3", turn:"45°", props:"Нет" }),
  C(H_BCRUIS, "Гульгор", { kind:"hull", spd:7, mn:10, dt:0, hi:70, arm:23, tr:1, spc:50, sp:72, wc:"Н1, НП2", turn:"45°", props:"Нет" }),
  C(H_BCRUIS, "Адское пламя", { kind:"hull", spd:7, mn:0, dt:0, hi:75, arm:18, tr:2, spc:75, sp:58, wc:"ЛБ3, ПБ3", turn:"45°", props:"Low Spirit (5), Особое" }),
  C(H_BCRUIS, "Гоплон", { kind:"hull", spd:6, mn:10, dt:15, hi:75, arm:19, tr:2, spc:75, sp:65, wc:"2К, 2НП, 1Н", turn:"45°", props:"Нет" }),
  C(H_BCRUIS, "Одиссея", { kind:"hull", spd:3, mn:0, dt:10, hi:70, arm:17, tr:2, spc:75, sp:65, wc:"ПБ3, ЛБ3", turn:"45°", props:"Hybrid Ship (все/транспорты), In-build (Главный грузовой трюм, 4/8), Warp Speed (/2)" }),

  // ─────────────────────────── ГРАНД-КРЕЙСЕРЫ ───────────────────────────
  C(H_GRAND, "Мститель", { kind:"hull", spd:5, mn:-5, dt:10, hi:90, arm:22, tr:4, spc:90, sp:70, wc:"ПБ3, ЛБ3", turn:"45°", props:"Нет" }),
  C(H_GRAND, "Отвергающий", { kind:"hull", spd:5, mn:8, dt:10, hi:85, arm:19, tr:3, spc:90, sp:69, wc:"Н1, ПБ2, ЛБ2, НП1", turn:"45°", props:"Limited (Armored), Control Features (Navigation (Warp)/-10), Vicious Design (2)" }),
  C(H_GRAND, "Экзорцист", { kind:"hull", spd:4, mn:4, dt:9, hi:85, arm:20, tr:3, spc:75, sp:71, wc:"ПБ3, ЛБ3", turn:"45°", props:"In-build (Ангарный отсек системы Юпитера (ПБ, ЛБ), 2/2)" }),
  C(H_GRAND, "Воздаятель", { kind:"hull", spd:5, mn:5, dt:5, hi:95, arm:22, tr:3, spc:75, sp:58, wc:"ПБ3, ЛБ3", turn:"45°", props:"Vicious Design (1)" }),
  C(H_GRAND, "Экзекутор", { kind:"hull", spd:8, mn:0, dt:15, hi:100, arm:19, tr:3, spc:110, sp:70, wc:"ПБ3, ЛБ3", turn:"45°", props:"Нет" }),
  C(H_GRAND, "Дагон", { kind:"hull", spd:4, mn:0, dt:15, hi:90, arm:20, tr:3, spc:85, sp:82, wc:"1ПБ, 1ЛБ, 1Н", turn:"45°", props:"In-build (нова-орудие модели Юпитер (Н), 1/6)" }),
  C(H_GRAND, "Несгибаемый", { kind:"hull", spd:3, mn:-20, dt:20, hi:130, arm:24, tr:4, spc:110, sp:85, wc:"1Н, 2К, 2НП", turn:"45°", props:"Нет" }),

  // ─────────────────────────── ЛИНКОРЫ ───────────────────────────
  C(H_BSHIP, "Апокалипсис", { kind:"hull", spd:3, mn:10, dt:25, hi:120, arm:22, tr:4, spc:120, sp:90, wc:"Н1, ПБ3, ЛБ3, НП1", turn:"45°", props:"In-build (Бронированный нос, 1/0), In-build (Нова-орудие модели Марс (Н), 1/3), All Power On (лэнсы; Rng ×2; не двигаться в свой ход)" }),
  C(H_BSHIP, "Император", { kind:"hull", spd:3, mn:10, dt:35, hi:120, arm:21, tr:5, spc:86, sp:90, wc:"Н1, ПБ3, ЛБ3, НП1", turn:"45°", props:"In-build (Ангарный отсек системы Юпитера (ПБ и ЛБ), 2/2), Limited (усиление брони носа)" }),
  C(H_BSHIP, "Возмездие", { kind:"hull", spd:5, mn:-5, dt:10, hi:110, arm:22, tr:4, spc:130, sp:85, wc:"Н1, ПБ3, ЛБ3, НП1", turn:"45°", props:"In-build (Бронированный нос, 1/0)" }),
  C(H_BSHIP, "Оберон", { kind:"hull", spd:3, mn:-10, dt:20, hi:120, arm:22, tr:4, spc:120, sp:90, wc:"Н1, ПБ3, ЛБ3", turn:"45°", props:"Travel Supplies (12)" }),
  C(H_BSHIP, "Победа", { kind:"hull", spd:3, mn:-10, dt:20, hi:120, arm:22, tr:4, spc:120, sp:98, wc:"Н1, ПБ3, ЛБ3, НП1", turn:"45°", props:"In-build (усиление брони носа; НП только лэнсы; борт — 1 лэнс и 2 не-ангара; Н — торпеды/нова-орудие)" }),
  C(H_BSHIP, "Разоритель", { kind:"hull", spd:4, mn:-5, dt:12, hi:120, arm:21, tr:4, spc:110, sp:90, wc:"Н1, НП1, ПБ3, ЛБ3", turn:"45°", props:"In-build (Ангарный отсек Доминация (ПБ, ЛБ), 2/4), Warp Luring (2), Vicious Design (1)" }),
  C(H_BSHIP, "Разрушитель", { kind:"hull", spd:5, mn:0, dt:14, hi:100, arm:20, tr:4, spc:100, sp:95, wc:"2НП, 1Н, 2ПБ, 2ЛБ", turn:"45°", props:"In-build (Торпедный аппарат Марс (Н), 1/2)" }),
  C(H_BSHIP, "Осквернитель", { kind:"hull", spd:4, mn:0, dt:14, hi:100, arm:20, tr:4, spc:88, sp:95, wc:"2НП, 1Н, 2ПБ, 2ЛБ", turn:"45°", props:"In-build (Торпедный аппарат Марс (Н), 1/2), In-build (Ангарный отсек системы Юпитера (ПБ и ЛБ), 2/2)" }),
  C(H_BSHIP, "Диктат", { kind:"hull", spd:7, mn:0, dt:20, hi:100, arm:24, tr:2, spc:120, sp:70, wc:"2НП, 1Н, 2ПБ, 2ЛБ", turn:"45°", props:"Нет" }),
  C(H_BSHIP, "Глориана", { kind:"hull", spd:6, mn:10, dt:10, hi:225, arm:30, tr:4, spc:165, sp:110, wc:"3Н, 6НП, 6К", turn:"45°", props:"Dreadnought" }),
  C(H_BSHIP, "Голиаф", { kind:"hull", spd:3, mn:-20, dt:0, hi:150, arm:30, tr:4, spc:150, sp:80, wc:"3К, 3ПБ, 3ЛБ", turn:"45°", props:"Dreadnought" }),
  C(H_BSHIP, "Легат", { kind:"hull", spd:4, mn:10, dt:10, hi:200, arm:25, tr:4, spc:175, sp:130, wc:"2Н, 2К, 2НП, 2ПБ, 2ЛБ", turn:"45°", props:"Deadly Ramming (1d10), Особое, Dreadnought" }),
  C(H_BSHIP, "Инфернус", { kind:"hull", spd:4, mn:-20, dt:10, hi:150, arm:23, tr:5, spc:135, sp:90, wc:"3ЛБ, 3ПБ, 3НП", turn:"45°", props:"In-build (Экзолазер (НП), 1/15), Dreadnought" }),
  C(H_BSHIP, "Боевой ковчег", { kind:"hull", spd:4, mn:10, dt:30, hi:140, arm:24, tr:4, spc:150, sp:90, wc:"2ПБ, 2ЛБ", turn:"45°", props:"Dreadnought" }),
  C(H_BSHIP, "Мортис Рекс", { kind:"hull", spd:3, mn:0, dt:20, hi:160, arm:24, tr:4, spc:160, sp:100, wc:"3К, 3НП, 2Н", turn:"45°", props:"Dreadnought" }),
  C(H_BSHIP, "Тиамат", { kind:"hull", spd:4, mn:-20, dt:10, hi:160, arm:40, tr:4, spc:130, sp:80, wc:"1НП, 1ПБ, 1ЛБ", turn:"45°", props:"Dreadnought" }),
  C(H_BSHIP, "Бездна", { kind:"hull", spd:4, mn:-20, dt:10, hi:350, arm:40, tr:8, spc:200, sp:120, wc:"12НП, 12К, 6Н", turn:"45°", props:"Dreadnought" }),

  // ─────────────────────────── ДОПОЛНИТЕЛЬНЫЕ: АНГАРНЫЕ ОТСЕКИ ───────────────────────────
  // Профиль орудия типа «Ангар»: S — число эскадрилий (Strength); Урон/Крит/Дальность неприменимы.
  C(HANGAR, "Грузовой ангар", { kind:"weapon", wtype:"bay", hulls:"Все", props:"Location Requirements (ПБ, ЛБ), Особое", p:1, spc:2, sp:2, s:1, r:1 }),
  C(HANGAR, "Трюмный ангарный отсек", { kind:"weapon", wtype:"bay", hulls:"Транспорты", props:"Clumsy (5)", p:1, spc:0, sp:2, s:2, r:1 }),
  C(HANGAR, "Эскортный отсек Юпитер", { kind:"weapon", wtype:"bay", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Location Requirements (ПБ, ЛБ)", p:1, spc:4, sp:1, s:1, r:0 }),
  C(HANGAR, "Ангарный отсек Юпитер", { kind:"weapon", wtype:"bay", hulls:"Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Location Requirements (ПБ, ЛБ)", p:1, spc:6, sp:2, s:2, r:1 }),
  C(HANGAR, "Ангарный отсек Станки", { kind:"weapon", wtype:"bay", hulls:"Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Location Requirements (ПБ, ЛБ)", p:1, spc:5, sp:2, s:2, r:1 }),
  C(HANGAR, "Ангарный отсек Опустошение", { kind:"weapon", wtype:"bay", hulls:"Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Location Requirements (ПБ, ЛБ), Repair Deck, Control Features (Переоснастить Ордонанс; +10)", p:1, spc:5, sp:3, s:2, r:3 }),
  C(HANGAR, "Ангарные отсеки Отмщение", { kind:"weapon", wtype:"bay", hulls:"Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Location Requirements (ПБ, ЛБ)", p:1, spc:3, sp:3, s:2, r:2 }),
  C(HANGAR, "Ангарные отсеки Разрушение", { kind:"weapon", wtype:"bay", hulls:"Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Location Requirements (ПБ, ЛБ), Control Features (+10; Command миссии эскадрилий)", p:1, spc:4, sp:3, s:2, r:3 }),
  C(HANGAR, "Ангарный отсек Доминация", { kind:"weapon", wtype:"bay", hulls:"Линкоры", props:"Location Requirements (ПБ, ЛБ), Limited (усиление брони носа), Особое", p:2, spc:10, sp:2, s:4, r:2 }),

  // ─────────────────────────── ДОПОЛНИТЕЛЬНЫЕ: ГРУЗОВЫЕ ОТСЕКИ ───────────────────────────
  C(CARGO, "Грузовой трюм и лихтерный отсек", { kind:"hold", hulls:"Все", props:"Clumsy (3), LC (10)", p:1, spc:2, sp:1, r:0 }),
  C(CARGO, "Раздельный грузовой трюм", { kind:"hold", hulls:"Все", props:"LC (10), Особое", p:2, spc:5, sp:1, r:0 }),
  C(CARGO, "Скрытые отсеки", { kind:"hold", hulls:"Все", props:"Особое, LC (6; открытый), LC (4; тайный)", p:3, spc:4, sp:2, r:1 }),
  C(CARGO, "Отсек быстрого сброса", { kind:"hold", hulls:"Все", props:"LC (10), Особое", p:2, spc:4, sp:1, r:0 }),
  C(CARGO, "Главный грузовой трюм", { kind:"hold", hulls:"Транспорты", props:"LC (20), Особое", p:2, spc:4, sp:1, r:0 }),
  C(CARGO, "Стазис-трюм", { kind:"hold", hulls:"Транспорты", props:"Archeotech, Robust Design (6), LC (4)", p:5, spc:6, sp:2, r:2 }),
  C(CARGO, "Корабельный склад (Лёгкие крейсеры/Крейсеры)", { kind:"hold", hulls:"Лёгкие крейсеры, Крейсеры", props:"Особое, LC (15)", p:1, spc:5, sp:2, r:1 }),
  C(CARGO, "Корабельный склад (Транспорты/Гранд/Линейные/Линкоры)", { kind:"hold", hulls:"Транспорты, Гранд-крейсеры, Линейные крейсеры, Линкоры", props:"Особое, LC (15)", p:1, spc:10, sp:2, r:1 }),
  C(CARGO, "Пси-защищённое хранилище", { kind:"hold", hulls:"Все", props:"Heretech (Psykers), Особое", p:0, spc:4, sp:0, r:2 }),
  C(CARGO, "Титаноносный отсек", { kind:"hold", hulls:"Транспорты (SPC 50+), Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Нет", p:4, spc:10, sp:3, r:3 }),

  // ─────────────────────────── ДОПОЛНИТЕЛЬНЫЕ: ПАССАЖИРСКИЕ ОТСЕКИ ───────────────────────────
  C(PASS, "Роскошные пассажирские покои", { kind:"hold", hulls:"Все", props:"Low Spirit (3), PC (5; богачи и знать)", p:2, spc:1, sp:1, r:0 }),
  C(PASS, "Бараки", { kind:"hold", hulls:"Все", props:"Особое, PC (10; солдаты)", p:2, spc:4, sp:2, r:1 }),
  C(PASS, "Гауптвахта", { kind:"hold", hulls:"Все", props:"High Spirit (1), PC (10; рабы/заключённые)", p:1, spc:1, sp:1, r:0 }),
  C(PASS, "Среды обитания ксеносов", { kind:"hold", hulls:"Все", props:"Weak Spirit (2), PC (2; ксеносы)", p:2, spc:1, sp:1, r:0 }),
  C(PASS, "Десантный трюм", { kind:"hold", hulls:"Транспорты, Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Особое, LC (20; техника)", p:3, spc:6, sp:3, r:0 }),
  C(PASS, "Кельи Астартес", { kind:"hold", hulls:"Все", props:"Особое, PC (1; астартес)", p:2, spc:5, sp:3, r:4 }),
  C(PASS, "Нуль-отсеки", { kind:"hold", hulls:"Все", props:"Archeotech, Особое, PC (1; псайкеры)", p:1, spc:2, sp:1, r:5 }),
  C(PASS, "Камеры астропатического хора", { kind:"hold", hulls:"Все", props:"Особое, PC (1; псайкеры)", p:1, spc:1, sp:1, r:4 }),

  // ─────────────────────────── ДОПОЛНИТЕЛЬНЫЕ: ПРИПАСЫ И ПРОВИЗИЯ ───────────────────────────
  C(SUPPLY, "Расширенные хранилища припасов", { kind:"supplemental", hulls:"Все", props:"High Spirit (1), Travel Supplies (x2), Easy to Repair (1), LC (20)", p:1, spc:4, sp:2, r:1 }),
  C(SUPPLY, "Дендрарий (Транспорты/Рейдеры/Фрегаты)", { kind:"supplemental", hulls:"Транспорты, Рейдеры, Фрегаты", props:"Crowded (2), Travel Supplies (+2)", p:2, spc:2, sp:1, r:0 }),
  C(SUPPLY, "Дендрарий (крейсеры+)", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Crowded (2), Travel Supplies (+2)", p:2, spc:3, sp:1, r:0 }),
  C(SUPPLY, "Гидропонный отсек", { kind:"supplemental", hulls:"Все", props:"High Spirit (1), Travel Supplies (+3), Особое", p:5, spc:4, sp:3, r:1 }),
  C(SUPPLY, "Загоны скота", { kind:"supplemental", hulls:"Все", props:"High Spirit (1), Travel Supplies (+2)", p:1, spc:2, sp:1, r:1 }),
  C(SUPPLY, "Винокурня", { kind:"supplemental", hulls:"Все", props:"High Spirit (2)", p:1, spc:1, sp:2, r:2 }),
  C(SUPPLY, "Рыбная ферма", { kind:"supplemental", hulls:"Все", props:"High Spirit (1), Travel Supplies (+1)", p:2, spc:2, sp:1, r:2 }),

  // ─────────────────────────── ДОПОЛНИТЕЛЬНЫЕ: МАНЁВРЕННОСТЬ ───────────────────────────
  C(MANOEUV, "Форсажные камеры", { kind:"supplemental", hulls:"Все", props:"Особое", p:2, spc:2, sp:1, r:1 }),
  C(MANOEUV, "Энергетическая матрица преобразования", { kind:"supplemental", hulls:"Все", props:"Archeotech, Особое", p:1, spc:1, sp:1, r:5 }),
  C(MANOEUV, "Гиростабилизационная матрица", { kind:"supplemental", hulls:"Все", props:"Archeotech, Особое", p:1, spc:1, sp:1, r:5 }),
  C(MANOEUV, "Улучшенные тормозные двигатели (Рейдеры/Фрегаты)", { kind:"supplemental", hulls:"Рейдеры, Фрегаты", props:"External, Maneuverable (5)", p:3, spc:0, sp:2, r:1 }),
  C(MANOEUV, "Улучшенные тормозные двигатели (Транспорты/Лёгкие крейсеры)", { kind:"supplemental", hulls:"Транспорты, Лёгкие крейсеры", props:"External, Maneuverable (5)", p:4, spc:0, sp:2, r:4 }),
  C(MANOEUV, "Улучшенные тормозные двигатели (Крейсеры+)", { kind:"supplemental", hulls:"Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"External, Maneuverable (5)", p:5, spc:0, sp:3, r:2 }),
  C(MANOEUV, "Катушка Скартикс (Фрегаты/Рейдеры)", { kind:"supplemental", hulls:"Фрегаты, Рейдеры", props:"Archeotech, Fast (+25% SPD корпуса, округление вверх), Integral (Plasma Drive)", p:4, spc:1, sp:3, r:4 }),
  C(MANOEUV, "Катушка Скартикс (крейсеры+)", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Archeotech, Fast (+25% SPD корпуса, округление вверх), Integral (Plasma Drive)", p:6, spc:2, sp:3, r:4 }),
  C(MANOEUV, "Массивы аварийных маневровых двигателей", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры", props:"Особое", p:1, spc:1, sp:1, r:2 }),
  C(MANOEUV, "Антигравитационный генератор", { kind:"supplemental", hulls:"Все", props:"Archeotech, Maneuverable (5), Особое", p:5, spc:1, sp:4, r:4 }),
  C(MANOEUV, "Гравитационные паруса (Транспорты/Рейдеры/Фрегаты)", { kind:"supplemental", hulls:"Транспорты, Рейдеры, Фрегаты", props:"Xenotech, External, Fast (1), Maneuverable (5)", p:3, spc:0, sp:4, r:4 }),
  C(MANOEUV, "Гравитационные паруса (крейсеры+)", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Xenotech, External, Fast (1), Maneuverable (5)", p:5, spc:0, sp:4, r:4 }),
  C(MANOEUV, "Модифицированный плазменный двигатель", { kind:"supplemental", hulls:"Все", props:"Archeotech, Fast (1)", p:0, spc:-4, sp:3, r:4, note:"Энергопотребление: X (особое, см. справочник). Уменьшает занимаемое двигателем пространство на 4." }),

  // ─────────────────────────── ДОПОЛНИТЕЛЬНЫЕ: КРЕПОСТЬ ───────────────────────────
  C(STURDY, "Улучшенные накопители щита", { kind:"supplemental", hulls:"Все", props:"Особое", p:2, spc:0, sp:3, r:4 }),
  C(STURDY, "Укрепляющее поле", { kind:"supplemental", hulls:"Все", props:"Особое", p:0, spc:1, sp:2, r:3, note:"Энергопотребление: 1–3 (особое)." }),
  C(STURDY, "Фронтальный щит", { kind:"supplemental", hulls:"Все", props:"Xenotech, Armored (4; нос)", p:2, spc:0, sp:3, r:3 }),
  C(STURDY, "Усиленные внутренние переборки (Транспорты/Рейдеры/Фрегаты)", { kind:"supplemental", hulls:"Транспорты, Рейдеры, Фрегаты", props:"Rugged Hull (3)", p:0, spc:2, sp:2, r:1 }),
  C(STURDY, "Усиленные внутренние переборки (крейсеры+)", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Rugged Hull (3)", p:0, spc:3, sp:2, r:0 }),
  C(STURDY, "Бронированная обшивка (Транспорты/Рейдеры/Фрегаты)", { kind:"supplemental", hulls:"Транспорты, Рейдеры, Фрегаты", props:"Armored (1), Clumsy (2)", p:0, spc:1, sp:2, r:0 }),
  C(STURDY, "Бронированная обшивка (крейсеры+)", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Armored (1), Clumsy (2)", p:0, spc:2, sp:2, r:0 }),
  C(STURDY, "Дополнительная пустотная броня (Транспорты/Рейдеры/Фрегаты)", { kind:"supplemental", hulls:"Транспорты, Рейдеры, Фрегаты", props:"Armored (3), Clumsy (3), Slowed (2)", p:0, spc:2, sp:3, r:2 }),
  C(STURDY, "Дополнительная пустотная броня (Лёгкие/Крейсеры/Линейные)", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры", props:"Armored (3), Clumsy (3), Slowed (2)", p:0, spc:3, sp:3, r:2 }),
  C(STURDY, "Дополнительная пустотная броня (Гранд/Линкоры)", { kind:"supplemental", hulls:"Гранд-крейсеры, Линкоры", props:"Armored (3), Clumsy (3), Slowed (2)", p:0, spc:4, sp:3, r:2 }),
  C(STURDY, "Защитный кожух плазменного двигателя (Фрегаты/Лёгкие/Крейсеры/Линейные)", { kind:"supplemental", hulls:"Фрегаты, Лёгкие крейсеры, Крейсеры, Линейные крейсеры", props:"Robust Design (4; плазменный двигатель), Integral (Plasma Drive)", p:-1, spc:1, sp:1, r:2 }),
  C(STURDY, "Защитный кожух плазменного двигателя (Гранд/Линкоры)", { kind:"supplemental", hulls:"Гранд-крейсеры, Линкоры", props:"Robust Design (4; плазменный двигатель), Integral (Plasma Drive)", p:-2, spc:2, sp:1, r:2 }),
  C(STURDY, "Бронированный нос", { kind:"supplemental", hulls:"Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Deadly Ramming (1d10), Limited (носовые орудия), Armored (4; нос)", p:0, spc:4, sp:2, r:1 }),
  C(STURDY, "Граврепульсоры", { kind:"supplemental", hulls:"Все", props:"Xenotech, External, Особое", p:0, spc:0, sp:3, r:4, note:"Энергопотребление: 1–3 (особое)." }),

  // ─────────────────────────── ДОПОЛНИТЕЛЬНЫЕ: ОБОРОННЫЕ МЕРЫ ───────────────────────────
  C(DEFENSE, "Оборонительные меры", { kind:"supplemental", hulls:"Все", props:"Особое", p:1, spc:1, sp:2, r:1 }),
  C(DEFENSE, "Зенитные турели", { kind:"supplemental", hulls:"Все", props:"Особое", p:1, spc:1, sp:1, r:1 }),
  C(DEFENSE, "Продвинутая система безопасности", { kind:"supplemental", hulls:"Все", props:"Internal Defense (10), Tempered Flesh (1)", p:1, spc:1, sp:3, r:1 }),
  C(DEFENSE, "Тенебро-лабиринт (Транспорты/Рейдеры/Фрегаты)", { kind:"supplemental", hulls:"Транспорты, Рейдеры, Фрегаты", props:"Internal Defense (10), Limited (система скоростного транспорта), Особое", p:1, spc:2, sp:2, r:2 }),
  C(DEFENSE, "Тенебро-лабиринт (крейсеры+)", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Internal Defense (10), Limited (система скоростного транспорта), Особое", p:2, spc:3, sp:1, r:2 }),
  C(DEFENSE, "Защитная решётка микролазеров", { kind:"supplemental", hulls:"Все", props:"Xenotech, External, Особое", p:2, spc:0, sp:2, r:4 }),

  // ─────────────────────────── ДОПОЛНИТЕЛЬНЫЕ: ЛИКВИДАЦИЯ ПОВРЕЖДЕНИЙ ───────────────────────────
  C(DAMAGE, "Световая сеть", { kind:"supplemental", hulls:"Все", props:"Особое", p:-10, spc:2, sp:2, r:2, note:"Солнечные панели: вырабатывают +10 энергии." }),
  C(DAMAGE, "Система авторемонта", { kind:"supplemental", hulls:"Все", props:"Archeotech, Особое", p:1, spc:1, sp:2, r:3 }),
  C(DAMAGE, "Система пожаротушения (Транспорты/Рейдеры/Фрегаты)", { kind:"supplemental", hulls:"Транспорты, Рейдеры, Фрегаты", props:"Особое", p:1, spc:1, sp:2, r:-1 }),
  C(DAMAGE, "Система пожаротушения (Лёгкие крейсеры/Крейсеры)", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры", props:"Особое", p:2, spc:2, sp:2, r:-1 }),
  C(DAMAGE, "Система пожаротушения (Линейные/Гранд/Линкоры)", { kind:"supplemental", hulls:"Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Особое", p:3, spc:3, sp:2, r:-1 }),
  C(DAMAGE, "Аварийные резервуары энергии (Транспорты/Рейдеры/Фрегаты)", { kind:"supplemental", hulls:"Транспорты, Рейдеры, Фрегаты", props:"Archeotech, Особое", p:2, spc:1, sp:2, r:5 }),
  C(DAMAGE, "Аварийные резервуары энергии (крейсеры+)", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Archeotech, Особое", p:3, spc:2, sp:2, r:5 }),
  C(DAMAGE, "Вспомогательная СЖО «M-1.r»", { kind:"supplemental", hulls:"Все", props:"Weak Spirit (1), Особое", p:3, spc:1, sp:2, r:1 }),
  C(DAMAGE, "Резервный мостик", { kind:"supplemental", hulls:"Крейсеры, Тяжёлые крейсеры, Гранд-крейсеры, Линкоры", props:"Особое", p:1, spc:1, sp:2, r:1 }),

  // ─────────────────────────── ДОПОЛНИТЕЛЬНЫЕ: ВООРУЖЕНИЕ ───────────────────────────
  C(ARMAMNT, "Пусковые установки десантных капсул «Шторм»", { kind:"supplemental", hulls:"Все", props:"Особое", p:1, spc:3, sp:2, r:1 }),
  C(ARMAMNT, "Дополнительная система охлаждения", { kind:"supplemental", hulls:"Все", props:"Devastating (1; лэнсы)", p:0, spc:1, sp:1, r:2 }),
  C(ARMAMNT, "Просветлённые фокусирующие линзы", { kind:"supplemental", hulls:"Все", props:"Effective Distance (2; лэнсы)", p:2, spc:0, sp:1, r:2 }),
  C(ARMAMNT, "Продвинутые плазменные батареи", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Devastating (2; плазменное), Effective Distance (3; плазменное)", p:4, spc:2, sp:2, r:4 }),
  C(ARMAMNT, "Матрица наведения", { kind:"supplemental", hulls:"Все", props:"Aimer (5)", p:1, spc:0, sp:1, r:2 }),
  C(ARMAMNT, "Турбобатареи", { kind:"supplemental", hulls:"Все", props:"Особое", p:1, spc:0, sp:2, r:2 }),
  C(ARMAMNT, "Дополнительные плазменные реле", { kind:"supplemental", hulls:"Все", props:"Devastating (2; плазменное)", p:2, spc:1, sp:2, r:2 }),
  C(ARMAMNT, "Электромагнитные катапульты", { kind:"supplemental", hulls:"Все", props:"Особое", p:1, spc:0, sp:1, r:2 }),
  C(ARMAMNT, "Дополнительные отсеки хранения", { kind:"supplemental", hulls:"Все", props:"Особое", p:0, spc:1, sp:1, r:1 }),
  C(ARMAMNT, "Постановщик минных полей", { kind:"supplemental", hulls:"Транспорты, Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Особое", p:1, spc:4, sp:1, r:0 }),
  C(ARMAMNT, "Усиленный нос (Транспорты/Рейдеры/Фрегаты)", { kind:"supplemental", hulls:"Транспорты, Рейдеры, Фрегаты", props:"Deadly Ramming (1d5), Armored (2; нос)", p:0, spc:2, sp:1, r:1 }),
  C(ARMAMNT, "Усиленный нос (крейсеры+)", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Deadly Ramming (1d5), Armored (2; нос)", p:0, spc:3, sp:1, r:1 }),
  C(ARMAMNT, "Автомат заряжания (Транспорты/Рейдеры/Фрегаты)", { kind:"supplemental", hulls:"Транспорты, Рейдеры, Фрегаты", props:"Особое", p:1, spc:1, sp:2, r:1 }),
  C(ARMAMNT, "Автомат заряжания (Лёгкие/Крейсеры/Линейные)", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры", props:"Особое", p:1, spc:2, sp:2, r:1 }),
  C(ARMAMNT, "Автомат заряжания (Гранд/Линкоры)", { kind:"supplemental", hulls:"Гранд-крейсеры, Линкоры", props:"Особое", p:1, spc:3, sp:2, r:1 }),
  C(ARMAMNT, "Силовой таран", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"External, Deadly Ramming (1d10)", p:2, spc:0, sp:2, r:2 }),
  C(ARMAMNT, "Стратегиум", { kind:"supplemental", hulls:"Все", props:"Особое", p:2, spc:2, sp:2, r:0 }),
  C(ARMAMNT, "Муниториум (Транспорты/Рейдеры/Фрегаты)", { kind:"supplemental", hulls:"Транспорты, Рейдеры, Фрегаты", props:"Explosive, Особое", p:2, spc:3, sp:1, r:1 }),
  C(ARMAMNT, "Муниториум (крейсеры+)", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Explosive, Особое", p:3, spc:4, sp:1, r:1 }),

  // ─────────────────────────── ДОПОЛНИТЕЛЬНЫЕ: ЭКИПАЖ И УКРАШЕНИЯ ───────────────────────────
  C(CREW, "Носовое украшение", { kind:"supplemental", hulls:"Все", props:"External", p:1, spc:0, sp:2, r:0 }),
  C(CREW, "Позолоченный корпус (Транспорты/Рейдеры/Фрегаты)", { kind:"supplemental", hulls:"Транспорты, Рейдеры, Фрегаты", props:"Weak Armor (3), Control Features (+10/Fellowship)", p:0, spc:1, sp:3, r:3 }),
  C(CREW, "Позолоченный корпус (Лёгкие/Крейсеры/Линейные)", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры", props:"Weak Armor (3), Control Features (+10/Fellowship)", p:0, spc:2, sp:3, r:3 }),
  C(CREW, "Цепное звено когитаторов", { kind:"supplemental", hulls:"Все", props:"Archeotech, Особое", p:1, spc:1, sp:2, r:5 }),
  C(CREW, "Сервиторизация команды", { kind:"supplemental", hulls:"Все", props:"Control Features (-10/Command и Стрельба), Enduring Flesh (/2), Особое", p:0, spc:0, sp:3, r:2 }),
  C(CREW, "Силика Анимус", { kind:"supplemental", hulls:"Все", props:"Heretech (Archeotech), Особое", p:2, spc:0, sp:4, r:5 }),
  C(CREW, "Улучшенные тактические когитаторы", { kind:"supplemental", hulls:"Рейдеры, Фрегаты, Лёгкие крейсеры, Крейсеры", props:"Control Features (+5/Command)", p:1, spc:0, sp:1, r:2 }),
  C(CREW, "Улучшенный проект жилых помещений", { kind:"supplemental", hulls:"Все", props:"Особое", p:0, spc:0, sp:2, r:2 }),
  C(CREW, "Комплекс утилизации команды", { kind:"supplemental", hulls:"Все", props:"Tempered Flesh (3), Weak Spirit (1)", p:1, spc:1, sp:1, r:0 }),
  C(CREW, "Сервиторы-убийцы", { kind:"supplemental", hulls:"Все", props:"Особое", p:1, spc:1, sp:2, r:1 }),
  C(CREW, "Мелодиум", { kind:"supplemental", hulls:"Все", props:"High Spirit (1), Особое", p:2, spc:1, sp:1, r:0 }),
  C(CREW, "Меркато-палуба", { kind:"supplemental", hulls:"Все", props:"High Spirit (3), Особое", p:1, spc:4, sp:3, r:1 }),
  C(CREW, "Комната трофеев", { kind:"supplemental", hulls:"Все", props:"Особое", p:1, spc:1, sp:1, r:0 }),
  C(CREW, "Купол обсервации", { kind:"supplemental", hulls:"Все", props:"High Spirit (1)", p:0, spc:1, sp:1, r:0 }),
  C(CREW, "Сенсориум", { kind:"supplemental", hulls:"Все", props:"High Spirit (2), Особое", p:1, spc:1, sp:2, r:1 }),
  C(CREW, "Залы пилотов", { kind:"supplemental", hulls:"Все", props:"Особое", p:1, spc:1, sp:1, r:0 }),
  C(CREW, "Суспензивные каюты (Транспорты/Рейдеры/Фрегаты)", { kind:"supplemental", hulls:"Транспорты, Рейдеры, Фрегаты", props:"Archeotech, Особое", p:2, spc:1, sp:2, r:5 }),
  C(CREW, "Суспензивные каюты (крейсеры+)", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Archeotech, Особое", p:3, spc:2, sp:3, r:5 }),
  C(CREW, "Система скоростного транспорта (Транспорты/Рейдеры/Фрегаты)", { kind:"supplemental", hulls:"Транспорты, Рейдеры, Фрегаты", props:"Limited (Тенебро-лабиринт), Control Features (10/Срочный ремонт; Отражение Абордажа; Тушение Пожара), Tempered Flesh (1)", p:2, spc:2, sp:3, r:3 }),
  C(CREW, "Система скоростного транспорта (Лёгкие/Крейсеры/Линейные)", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры", props:"Limited (Тенебро-лабиринт), Control Features (10/Срочный ремонт; Отражение Абордажа; Тушение Пожара), Tempered Flesh (1)", p:3, spc:3, sp:3, r:3 }),
  C(CREW, "Система скоростного транспорта (Тяжёлые/Гранд/Линкоры)", { kind:"supplemental", hulls:"Тяжёлые крейсеры, Гранд-крейсеры, Линкоры", props:"Limited (Тенебро-лабиринт), Control Features (10/Срочный ремонт; Отражение Абордажа; Тушение Пожара), Tempered Flesh (1)", p:4, spc:4, sp:3, r:3 }),

  // ─────────────────────────── ДОПОЛНИТЕЛЬНЫЕ: ВЕРА ───────────────────────────
  C(FAITH, "Храм-святилище", { kind:"supplemental", hulls:"Все", props:"High Spirit (3), Особое", p:1, spc:1, sp:1, r:0 }),
  C(FAITH, "Автохрам", { kind:"supplemental", hulls:"Все", props:"High Spirit (2)", p:1, spc:1, sp:0, r:0, note:"SP в таблице = X (особое)." }),
  C(FAITH, "Пустотный собор", { kind:"supplemental", hulls:"Все", props:"High Spirit (5), Enduring Spirit (1), Control Features (+10/SL(Imperial Creed) или FL(Heresy)), Особое", p:2, spc:4, sp:5, r:2 }),
  C(FAITH, "Святилище Машины", { kind:"supplemental", hulls:"Все", props:"Control Features (+10/Срочный ремонт)", p:1, spc:1, sp:2, r:1 }),
  C(FAITH, "Технособор", { kind:"supplemental", hulls:"Все", props:"Control Features (+10/Tech-Use, FL(Mechanicus, Archeotech)), Особое", p:2, spc:4, sp:5, r:3 }),

  // ─────────────────────────── ДОПОЛНИТЕЛЬНЫЕ: СХОЛАСТИКА ───────────────────────────
  C(SCHOOL, "Хранилище либрариума", { kind:"supplemental", hulls:"Все", props:"Особое", p:1, spc:1, sp:1, r:0 }),
  C(SCHOOL, "Либрариум ксеносов", { kind:"supplemental", hulls:"Все", props:"Xenotech, Особое", p:1, spc:1, sp:3, r:4 }),
  C(SCHOOL, "Тренировочный симулятор экипажей", { kind:"supplemental", hulls:"Все", props:"Особое", p:2, spc:1, sp:3, r:2 }),
  C(SCHOOL, "Лекторий", { kind:"supplemental", hulls:"Все", props:"Особое", p:1, spc:1, sp:1, r:0 }),
  C(SCHOOL, "Тренировочный комплекс", { kind:"supplemental", hulls:"Все", props:"Особое", p:3, spc:3, sp:2, r:1 }),
  C(SCHOOL, "Голографический тактический симулятор", { kind:"supplemental", hulls:"Все", props:"Особое", p:3, spc:1, sp:2, r:1 }),
  C(SCHOOL, "Лабораториум", { kind:"supplemental", hulls:"Все", props:"Особое", p:2, spc:1, sp:3, r:2 }),

  // ─────────────────────────── ДОПОЛНИТЕЛЬНЫЕ: МЕДИКА ───────────────────────────
  C(MEDICAE, "Медика-палуба", { kind:"supplemental", hulls:"Все", props:"Особое", p:2, spc:1, sp:1, r:0 }),
  C(MEDICAE, "Фармациум", { kind:"supplemental", hulls:"Все", props:"Особое", p:1, spc:2, sp:2, r:1 }),
  C(MEDICAE, "Камеры восстановления", { kind:"supplemental", hulls:"Все", props:"Xenotech, Особое", p:3, spc:1, sp:3, r:4 }),
  C(MEDICAE, "Апотекарион", { kind:"supplemental", hulls:"Все", props:"Особое", p:2, spc:2, sp:2, r:2 }),
  C(MEDICAE, "Апотекарион астартес", { kind:"supplemental", hulls:"Все", props:"Особое", p:2, spc:2, sp:3, r:3 }),
  C(MEDICAE, "Лаборатория Биологис", { kind:"supplemental", hulls:"Все", props:"Особое", p:3, spc:3, sp:4, r:4 }),

  // ─────────────────────────── ДОПОЛНИТЕЛЬНЫЕ: ЭНЕРГИЯ И СКАНЕРЫ ───────────────────────────
  C(PWRSCAN, "Энергогенераториум", { kind:"supplemental", hulls:"Все", props:"Нет", p:-10, spc:3, sp:3, r:3, note:"Вырабатывает +10 энергии." }),
  C(PWRSCAN, "Вспомогательные плазменные банки (Транспорты/Рейдеры/Фрегаты)", { kind:"supplemental", hulls:"Транспорты, Рейдеры, Фрегаты", props:"Особое", p:-8, spc:5, sp:1, r:3, note:"Вырабатывает +8 энергии." }),
  C(PWRSCAN, "Вспомогательные плазменные банки (Лёгкие/Крейсеры/Линейные)", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры", props:"Особое", p:-10, spc:6, sp:1, r:3, note:"Вырабатывает +10 энергии." }),
  C(PWRSCAN, "Вспомогательные плазменные банки (Гранд/Линкоры)", { kind:"supplemental", hulls:"Гранд-крейсеры, Линкоры", props:"Особое", p:-12, spc:7, sp:1, r:3, note:"Вырабатывает +12 энергии." }),
  C(PWRSCAN, "Продвинутый сканер минералов", { kind:"supplemental", hulls:"Все", props:"External, Особое", p:6, spc:0, sp:1, r:0 }),
  C(PWRSCAN, "Антенный блок дальнего действия", { kind:"supplemental", hulls:"Все", props:"External, Особое, Limited (Бронированный нос, Силовой таран)", p:2, spc:0, sp:1, r:2 }),
  C(PWRSCAN, "Плазмопровода", { kind:"supplemental", hulls:"Все", props:"Нет", p:-4, spc:0, sp:3, r:5, note:"Вырабатывает +4 энергии." }),
  C(PWRSCAN, "Пусковые шахты авгур-зондов", { kind:"supplemental", hulls:"Все", props:"Особое", p:1, spc:1, sp:3, r:2 }),

  // ─────────────────────────── ДОПОЛНИТЕЛЬНЫЕ: НЕЗАМЕТНОСТЬ ───────────────────────────
  C(STEALTH, "Мантия эмпирей (Транспорты/Рейдеры/Фрегаты)", { kind:"supplemental", hulls:"Транспорты, Рейдеры, Фрегаты", props:"External, Void Shadow (0/20)", p:3, spc:0, sp:2, r:3 }),
  C(STEALTH, "Мантия эмпирей (крейсеры+)", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"External, Void Shadow (0/20)", p:5, spc:0, sp:2, r:3 }),
  C(STEALTH, "Теневой транспондер", { kind:"supplemental", hulls:"Все", props:"Особое", p:1, spc:0, sp:2, r:3 }),
  C(STEALTH, "Маскирующая система «Локи»", { kind:"supplemental", hulls:"Все", props:"Особое", p:3, spc:1, sp:3, r:3 }),
  C(STEALTH, "Голополе эльдар", { kind:"supplemental", hulls:"Все", props:"Xenotech, Особое", p:8, spc:4, sp:3, r:4 }),
  C(STEALTH, "Теневое поле друкхари", { kind:"supplemental", hulls:"Все", props:"Xenotech, Void Shadow (20/20), Особое", p:8, spc:4, sp:4, r:4 }),
  C(STEALTH, "Хамелеоновый корпус", { kind:"supplemental", hulls:"Рейдеры, Фрегаты", props:"Xenotech, External, Особое", p:3, spc:0, sp:4, r:4 }),
  C(STEALTH, "Гравитоные вспышки", { kind:"supplemental", hulls:"Рейдеры, Фрегаты", props:"Archeotech, External, Особое", p:2, spc:0, sp:3, r:5 }),
  C(STEALTH, "Гидрафурианский постановщик помех КЛ-247", { kind:"supplemental", hulls:"Все", props:"External, Особое", p:4, spc:0, sp:1, r:0 }),

  // ─────────────────────────── ДОПОЛНИТЕЛЬНЫЕ: ВАРП ───────────────────────────
  C(WARPADD, "Крик душ", { kind:"supplemental", hulls:"Все", props:"Особое", p:0, spc:0, sp:1, r:2 }),
  C(WARPADD, "Варп-волнорез", { kind:"supplemental", hulls:"Все", props:"Особое", p:1, spc:1, sp:1, r:2 }),
  C(WARPADD, "Варп-гончая", { kind:"supplemental", hulls:"Все", props:"Особое", p:1, spc:1, sp:1, r:2 }),
  C(WARPADD, "Установка микропрыжков (Транспорты/Рейдеры/Фрегаты)", { kind:"supplemental", hulls:"Транспорты, Рейдеры, Фрегаты", props:"Integral (Warp Drive), Особое", p:1, spc:1, sp:2, r:3 }),
  C(WARPADD, "Установка микропрыжков (Лёгкие крейсеры/Крейсеры)", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры", props:"Integral (Warp Drive), Особое", p:2, spc:2, sp:2, r:3 }),
  C(WARPADD, "Варп-секстант", { kind:"supplemental", hulls:"Все", props:"Archeotech, Особое", p:4, spc:0, sp:2, r:5 }),
  C(WARPADD, "Варп-антенна", { kind:"supplemental", hulls:"Все", props:"Archeotech, External, Особое", p:1, spc:0, sp:2, r:5 }),
  C(WARPADD, "Гравиметрический варп-компас", { kind:"supplemental", hulls:"Все", props:"Archeotech, Control Features (+20/Выход из варпа), Control Features (+10/Поиск маяка)", p:1, spc:1, sp:3, r:3 }),
  C(WARPADD, "Рунотолкователь", { kind:"supplemental", hulls:"Все", props:"Xenotech, Warp Speed (/2), Control Features (+20/Navigation (Warp)), Особое", p:0, spc:1, sp:2, r:4 }),
  C(WARPADD, "Ведьмин авгур", { kind:"supplemental", hulls:"Все", props:"Archeotech, External, Особое", p:1, spc:0, sp:2, r:5 }),
  C(WARPADD, "Варп-синхронизатор", { kind:"supplemental", hulls:"Все", props:"Archeotech, Особое", p:1, spc:1, sp:10, r:4 }),
  C(WARPADD, "Глушитель варпа", { kind:"supplemental", hulls:"Все", props:"Xenotech, Особое", p:3, spc:0, sp:2, r:4 }),
  C(WARPADD, "Карта варп-врат", { kind:"supplemental", hulls:"Все", props:"Xenotech, Особое", p:2, spc:1, sp:5, r:4 }),
  C(WARPADD, "Гравитационный нулификатор", { kind:"supplemental", hulls:"Все", props:"Heretech (Warp), Особое", p:2, spc:1, sp:3, r:4 }),

  // ─────────────────────────── ДОПОЛНИТЕЛЬНЫЕ: РЕСУРСЫ И ПРОМЫШЛЕННОСТЬ ───────────────────────────
  C(RESOURCE, "Комплекс разработки астероидов", { kind:"supplemental", hulls:"Все", props:"Особое", p:6, spc:10, sp:3, r:2 }),
  C(RESOURCE, "Обогатительный комплекс", { kind:"supplemental", hulls:"Все", props:"Особое", p:5, spc:4, sp:3, r:3 }),
  C(RESOURCE, "Установка химического синтеза", { kind:"supplemental", hulls:"Все", props:"Особое", p:5, spc:8, sp:3, r:3 }),
  C(RESOURCE, "Литейный цех", { kind:"supplemental", hulls:"Все", props:"Особое", p:8, spc:6, sp:4, r:2, note:"Выплавка металлов и изготовление проката." }),
  C(RESOURCE, "Плазмозаборник", { kind:"supplemental", hulls:"Транспорты (Простр. 50+)", props:"Особое", p:3, spc:4, sp:4, r:3 }),
  C(RESOURCE, "Средства разработки комет", { kind:"supplemental", hulls:"Транспорты", props:"Особое", p:3, spc:4, sp:1, r:0 }),
  C(RESOURCE, "Мануфакторум", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Особое", p:2, spc:1, sp:2, r:1 }),
  C(RESOURCE, "Системы сбора трофеев", { kind:"supplemental", hulls:"Транспорты, Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Clumsy (5), Особое", p:3, spc:4, sp:3, r:2 }),
  C(RESOURCE, "Ремонтная палуба малых судов", { kind:"supplemental", hulls:"Лёгкие крейсеры, Крейсеры, Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Repair Deck", p:2, spc:2, sp:1, r:1 }),

  // ─────────────────────────── ДОПОЛНИТЕЛЬНЫЕ: ДРУГОЕ ───────────────────────────
  C(OTHER, "Причал космического дока", { kind:"supplemental", hulls:"Транспорты (Простр. 50+), Гранд-крейсеры, Линкоры", props:"Особое", p:7, spc:14, sp:4, r:3 }),
  C(OTHER, "Буксировочный захват", { kind:"supplemental", hulls:"Все", props:"Особое, External", p:2, spc:0, sp:2, r:0 }),
  C(OTHER, "Стратегиум адмирала", { kind:"supplemental", hulls:"Линейные крейсеры, Гранд-крейсеры, Линкоры", props:"Особое, Integral (Мостик)", p:2, spc:0, sp:2, r:2 }),
  C(OTHER, "Телепортариум", { kind:"supplemental", hulls:"Все", props:"Archeotech, Особое", p:1, spc:1, sp:1, r:5 }),
  C(OTHER, "Широкополосные гимн-трансляторы", { kind:"supplemental", hulls:"Все", props:"External, Особое", p:3, spc:0, sp:1, r:0 })
];
