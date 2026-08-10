// module/migrations/weapon-grips.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Разовая миграция: заполняет ХВАТЫ (system.grips) и ПРОФИЛИ (system.profiles,
//  system.profileLabel) рукопашному оружию — из канон-текста system.special.
//
//  Формат special (как в корбуке, стр. 39, 207-221):
//    «<Базовый профиль>; Хват <осн> [<альт>]; Досягаемость <N>. <Альт-профиль>
//     (<Rng>): <урон> <ТИП>(Pen), <свойства>. …»
//  Пример: «Топор; Хват 2р [1р, Бл, 1р+Кл]; Досягаемость 4. Молот: 2d10+6 E,
//           Concussive (1), Imprecise, Power Field. Посох (2–4): 1d10-2 I(Cr),
//           Imprecise, Primitive.» → grips «2р (1р, Бл, 1р+Кл)», база «Топор»,
//           профили Молот + Посох со своими уроном/типом/пробитием/свойствами.
//
//  Неразрушающе: ручные правки (без флага auto) не трогает. Авто-значения от
//  прошлых прогонов (флаги gripsAuto/profilesAuto) перезаписывает свежим каноном.
// ════════════════════════════════════════════════════════════════════════════

import { WEAPON_PROPERTIES } from "../constants/weapon-properties.mjs";

const SYSTEM = "warhammer-dbc";

// Английское имя свойства → ключ реестра (+ пара алиасов из текста корбука).
const EN_TO_KEY = (() => {
  const m = {};
  for (const [key, def] of Object.entries(WEAPON_PROPERTIES)) if (def.en) m[def.en.toLowerCase()] = key;
  m["graviton"] = m["graviton"] || m["grav"];
  return m;
})();

// Код типа урона в профиле (E/I/R/X, лат. и кир.) → канон-ключ.
const DTYPE = { e: "energy", i: "impact", r: "rending", x: "blast",
                "е": "energy", "и": "impact", "р": "rending", "х": "blast" };

// ── Резервная эвристика хвата по названию (если в special нет «Хват …») ──────
export function deriveGrips(name, damage) {
  const n = String(name || "").toLowerCase();
  const twoDice = /^\s*[2-9]d/.test(String(damage || ""));
  if (/щит|баклер|гоплон/.test(n))                    return "1р";
  if (/штык/.test(n))                                 return "2р";
  if (/кнут|плеть|хлыст|стрекал/.test(n))             return "1р";
  if (/запястн|наручн/.test(n))                       return "П";
  if (/руки-лезв|рука-ножниц/.test(n))                return "Л";
  if (/перчатк|кулак/.test(n))                        return "П+Л";
  if (/коготь|когти/.test(n))                         return "П+Л";
  if (/клешн/.test(n))                                return "П";
  if (/мехадендрит|мехатендрил|серво-рук|серво-коготь|servo|mecha|dendrite|дендрит|манипулятор/.test(n))
                                                      return "1р";
  if (/копь[её]|пика|пилокоп/.test(n))                return "1р (2р)";
  if (/глеф|алебард|секир|кос[аеуы]|клэйв|клэв|полукл|билл|пронзател|люцернск/.test(n))
                                                      return "2р (1р)";
  if (/клевец/.test(n))                               return "1р (2р)";
  if (/посох/.test(n))                                return "2р (1р)";
  if (/двуручн|кувалд|таран|эвисцератор|камнепил|камнерез|камнедрел/.test(n))
                                                      return "2р";
  if (/крозиус/.test(n))                              return "1р (2р)";
  if (/молот|булав|палиц|кистен|кирк|дубин|цеп|метеоритн/.test(n))
                                                      return twoDice ? "2р" : "1р (2р)";
  if (/нож|кинжал|бритв|жало|атам|клык|осколок|стилет/.test(n))
                                                      return "1р (Об)";
  if (/топор/.test(n))                                return twoDice ? "2р" : "1р (2р)";
  if (/меч|клинок|сабл|рапир|гладий|фальшион|фальчион|кортик|тесак|хопеш|крюкомеч/.test(n)) {
    if (twoDice)          return "2р (1р)";
    if (/длинн/.test(n))  return "1р (2р)";
    return "1р (2р, Об)";
  }
  return twoDice ? "2р (1р)" : "1р";
}

// ── Парсер канон-текста special → { grips, baseLabel, profiles[] } ───────────
export function parseWeaponSpecial(special) {
  const sp = String(special || "");
  const out = { grips: "", baseLabel: "", profiles: [] };
  if (!sp.trim()) return out;

  // Хват: основной [альтернативные]
  const gm = sp.match(/Хват\s+([^;.\[\n]+?)(?:\s*\[([^\]]+)\])?\s*(?:;|\.|Досягаемость)/);
  if (gm) {
    const prim = gm[1].trim();
    const alts = (gm[2] || "").trim();
    out.grips = alts ? `${prim} (${alts})` : prim;
  }

  // Базовый ярлык профиля — первое слово до первого «;»
  const bl = sp.match(/^\s*([А-ЯЁA-Za-z][А-ЯЁа-яёA-Za-z.]*)\s*;/);
  if (bl) out.baseLabel = bl[1].replace(/\.$/, "").trim();

  // Альтернативные профили: «Ярлык (Rng): урон ТИП(Pen), свойства …»
  const re = /([А-ЯЁ][а-яё]+)\s*(?:\(([^)]*)\))?:\s*(\d*d\d+(?:[+\-]\d+)?)\s*([EIRXЕИРХ])\s*(?:\(([^)]*)\))?((?:\s*,\s*[^.;]+?)*)(?=\s*[.;]|\s*$)/g;
  let m;
  while ((m = re.exec(sp)) !== null) {
    const label = m[1];
    const range = (m[2] || "").replace(/[–—]/g, "-").trim();
    const damage = m[3];
    const damageType = DTYPE[(m[4] || "").toLowerCase()] || "impact";
    const tail = m[6] || "";
    let penetration = 0;
    const weaponProps = [];
    for (let raw of tail.split(",")) {
      raw = raw.trim(); if (!raw) continue;
      const penM = raw.match(/^Pen\s*(\d+)/i);
      if (penM) { penetration = parseInt(penM[1]) || 0; continue; }
      const nameM = raw.match(/^([A-Za-z][A-Za-z\s]*?)(?:\s*\((\d+)\))?$/);
      if (!nameM) continue;
      const en = nameM[1].trim().toLowerCase();
      const key = EN_TO_KEY[en];
      if (!key) continue;
      weaponProps.push({ key, rating: nameM[2] != null ? parseInt(nameM[2]) : 0, rating2: 0 });
    }
    out.profiles.push({ label, range, damage, damageType, penetration, weaponProps });
  }
  return out;
}

// Флаг «значение проставлено автоматически» — можно перезаписывать при обновлении.
function autoFlag(doc, key) {
  return !!doc.getFlag?.(SYSTEM, key);
}

// Патч одного оружия. force — переписать даже ручные значения.
function weaponPatch(doc, force) {
  const s = doc.system || {};
  if (s.weaponClass !== "melee") return null;

  const parsed  = parseWeaponSpecial(s.special);
  const patch   = { _id: doc.id };
  let   touched = false;

  // Хваты: канон из special, иначе эвристика по названию.
  const canonGrips = parsed.grips || deriveGrips(doc.name, s.damage);
  const gripsManual = String(s.grips || "").trim() && !autoFlag(doc, "gripsAuto");
  if (canonGrips && (force || !String(s.grips || "").trim() || (!gripsManual && s.grips !== canonGrips))) {
    patch["system.grips"] = canonGrips;
    patch[`flags.${SYSTEM}.gripsAuto`] = true;
    touched = true;
  }

  // Имя основного профиля + альтернативные профили.
  const profManual = (Array.isArray(s.profiles) && s.profiles.length) && !autoFlag(doc, "profilesAuto");
  if (!profManual || force) {
    if (parsed.baseLabel && (force || !String(s.profileLabel || "").trim() || autoFlag(doc, "profilesAuto"))) {
      patch["system.profileLabel"] = parsed.baseLabel;
      touched = true;
    }
    if (parsed.profiles.length && (force || !(Array.isArray(s.profiles) && s.profiles.length) || autoFlag(doc, "profilesAuto"))) {
      patch["system.profiles"] = parsed.profiles;
      patch[`flags.${SYSTEM}.profilesAuto`] = true;
      touched = true;
    }
  }

  return touched ? patch : null;
}

// Основная миграция. force — переписать даже заполненные вручную поля.
export async function migrateWeaponGrips({ force = false } = {}) {
  if (!game.user?.isGM) { ui.notifications?.warn("Миграция оружия: только для ГМа."); return; }
  let packCount = 0, worldCount = 0, actorCount = 0;

  // 1) Компендиум warhammer-dbc.weapons
  const pack = game.packs.get(`${SYSTEM}.weapons`);
  if (pack) {
    const wasLocked = pack.locked;
    try {
      if (wasLocked) await pack.configure({ locked: false });
      const docs    = await pack.getDocuments();
      const updates = docs.map(d => weaponPatch(d, force)).filter(Boolean);
      if (updates.length) await Item.updateDocuments(updates, { pack: pack.collection });
      packCount = updates.length;
    } catch (e) {
      console.error("Warhammer DBC | Миграция оружия (компендиум):", e);
    } finally {
      if (wasLocked) await pack.configure({ locked: true });
    }
  }

  // 2) Оружие в мире
  try {
    const updates = game.items.filter(i => i.type === "weapon")
      .map(i => weaponPatch(i, force)).filter(Boolean);
    if (updates.length) await Item.updateDocuments(updates);
    worldCount = updates.length;
  } catch (e) { console.error("Warhammer DBC | Миграция оружия (мир):", e); }

  // 3) Оружие у акторов
  try {
    for (const actor of game.actors) {
      const updates = actor.items.filter(i => i.type === "weapon")
        .map(i => weaponPatch(i, force)).filter(Boolean);
      if (updates.length) { await actor.updateEmbeddedDocuments("Item", updates); actorCount += updates.length; }
    }
  } catch (e) { console.error("Warhammer DBC | Миграция оружия (акторы):", e); }

  const msg = `Хваты/профили проставлены: компендиум ${packCount}, мир ${worldCount}, акторы ${actorCount}.`;
  console.log("Warhammer DBC |", msg);
  ui.notifications?.info("Warhammer DBC: " + msg);
  return { packCount, worldCount, actorCount };
}
