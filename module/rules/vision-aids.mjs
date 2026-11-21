// module/rules/vision-aids.mjs
// ════════════════════════════════════════════════════════════════════════
//  ЗРЯЩИЕ РОГА (Majestic Horns, субмутация 9, Тзинч) — wdbc-1rno.10:
//  «Персонаж … не может пользоваться авточувствами или визорами».
//
//  Как собрано: запрет — возможность мутации (kind:"capability",
//  VISION_AIDS_BLOCKED_CAP, под when.submutations ["9"]). Вещи, которые
//  в книге названы «авточувствами» и «визорами», перечислены ниже по
//  именам; isItemActive (apps/effects.mjs) для них отвечает «не действует»,
//  пока такая мутация на акторе, — вся их механика (бонус к Внимательности,
//  Ночное зрение и т.п.) гаснет тем же рубильником, что и у снятых вещей.
//
//  Возможность здесь читается НАПРЯМУЮ с предметов актора, а не через
//  hasRuleFlag: isItemActive вызывают из самого сбора правил, и запрос
//  правил изнутри него замкнул бы круг.
//
//  Перечень — книжные имена, а не «любая оптика»: прицелы оружия, магнокуляры
//  и бископея книга под запрет не называет.
//
//  Без Foundry: только данные предметов.
// ════════════════════════════════════════════════════════════════════════

export const VISION_AIDS_BLOCKED_CAP = "mutation.majesticHorns.noVisionAids";

const NS = "warhammer-dbc";

/** Имена (каждая половина двуязычного имени, нижний регистр), под запрет не подпадающие иначе. */
const VISION_AID_NAMES = new Set([
  "autosenses", "авточувства",
  "y-visor", "y-визор",
  "photo-visor", "фото-визор",
  "preysense visor", "охотничий визор",
  "sonar visor", "сонарный визор",
  "ranger visors", "визоры рейнджера"
].map(n => n.toLowerCase()));

const TYPES = new Set(["armorMod", "gear", "implant", "tool"]);

const halves = name => String(name ?? "").split("/").map(p => p.trim().toLowerCase()).filter(Boolean);

/** Вещь — авточувства или визор в книжном смысле. */
export function isVisionAid(item) {
  if (!item || !TYPES.has(item.type)) return false;
  return halves(item.name).some(h => VISION_AID_NAMES.has(h));
}

/**
 * Глаза Хаоса (субмутация 1, «Пламенные Глазницы») и Глаза-Стебельки
 * (Sahara task-b65d): «не получает преимуществ … ретинального дисплея».
 * Возможность мутации; читает гейт прицелов «бесполезен без ретинального
 * дисплея» (combat/weapon-mods.mjs::modWornRequirementMet) — и отдельный
 * Ретинальный Дисплей, и встроенный в шлем/броню.
 */
export const RETINAL_DISPLAY_BLOCKED_CAP = "mutation.noRetinalDisplay";

/** На акторе есть не подавленная мутация с этой возможностью (субмутация совпадает). */
function mutationCapActive(actor, key) {
  for (const it of actor?.items ?? []) {
    if (it?.type !== "mutation" || it.getFlag?.(NS, "suppressed")) continue;
    const groups = it.getFlag?.(NS, "mechanics") ?? it.flags?.[NS]?.mechanics ?? [];
    const label = it.system?.submutation?.label || "";
    for (const g of groups) {
      for (const e of g?.entries ?? []) {
        if (e?.kind !== "capability" || e.capabilityKey !== key) continue;
        const subs = e.when?.submutations ?? [];
        if (!subs.length || subs.includes(label)) return true;
      }
    }
  }
  return false;
}

/** На акторе есть не подавленная мутация, запрещающая авточувства и визоры (субмутация совпадает). */
export const visionAidsBlocked = actor => mutationCapActive(actor, VISION_AIDS_BLOCKED_CAP);

/** Ретинальный дисплей (отдельный или встроенный) пользы не даёт. */
export const retinalDisplayBlocked = actor => mutationCapActive(actor, RETINAL_DISPLAY_BLOCKED_CAP);

/** Предмет актора, который запрет сейчас гасит. */
export function visionAidBlocked(item) {
  return isVisionAid(item) && !!item.parent && visionAidsBlocked(item.parent);
}
