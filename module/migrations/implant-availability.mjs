// module/migrations/implant-availability.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Разовая доливка книжных полей биоимплантам, УЖЕ выданным персонажам
//  (wdbc-wc3, находка ревью стопки #441-#462).
//
//  PR #452 (wdbc-ukpu) добавил имплантам поле Доступности и список вариантов
//  Best.Q, но только в packs-src. Предмет на акторе — снимок момента выдачи:
//  он не перечитывает компендиум ни при рендере, ни при загрузке мира. У всех,
//  кому имплант уже выдали, поле Доступности осталось нулевым (умолчание
//  схемы, module/data/item/implant.mjs), а bestQualityEffects — пустым.
//
//  Пустой bestQualityEffects — это ещё и гейт диалога выбора эффекта
//  (apps/implant-bestq-choice.mjs::needsBestQChoice требует НЕПУСТОЙ список),
//  так что окно выбора таким имплантам не предлагалось ни автоматически, ни
//  кнопкой на листе: вся новинка доставалась только тем, кто получит имплант
//  заново.
//
//  Сопоставление с компендиумом — по _id исходного документа (flags.core.
//  sourceId у выданного предмета, либо совпадение имени как запасной путь):
//  тот же приём, что у apps/content-sync.mjs, только уже и безопаснее — правим
//  РОВНО два поля и только там, где своего значения нет. Осознанно НЕ трогаем
//  импланты, где Доступность уже проставлена вручную: ГМ мог поправить её под
//  свою партию, и молча вернуть книжное — та же ошибка, что «починка
//  рассинхрона» уже совершала с testMod (см. AGENTS.md).
// ════════════════════════════════════════════════════════════════════════════

const FLAG_PACK = "warhammer-dbc.implants";

/**
 * Что долить этому предмету — чистое решение, без Foundry и без записи.
 *
 * @param {object} item    выданный имплант (item.system)
 * @param {object} source  его исходник из компендиума (source.system)
 * @returns {?object} патч для item.update, либо null — доливать нечего
 */
export function implantAvailabilityPatch(item, source) {
  if (!item || !source) return null;
  if (item.type !== "implant") return null;
  const patch = {};

  // Доступность: только если своего значения нет (0 — умолчание схемы, то
  // есть «не заполнено»), а в книге оно есть.
  const own = Number(item.system?.availability) || 0;
  const book = Number(source.system?.availability) || 0;
  if (own === 0 && book !== 0) patch["system.availability"] = book;

  // Варианты Best.Q: доливаются, только если свой список пуст. Непустой —
  // значит имплант уже знает свои варианты (или ГМ их правил), не трогаем.
  const ownOpts = item.system?.bestQualityEffects;
  const bookOpts = source.system?.bestQualityEffects;
  if ((!Array.isArray(ownOpts) || !ownOpts.length) && Array.isArray(bookOpts) && bookOpts.length) {
    patch["system.bestQualityEffects"] = bookOpts;
  }

  return Object.keys(patch).length ? patch : null;
}

/** Исходник импланта из компендиума: по sourceId, иначе по имени. */
async function findSource(item, pack, byName) {
  const sourceId = item.flags?.core?.sourceId || item._stats?.compendiumSource || "";
  const id = String(sourceId).split(".").pop();
  if (id) {
    const doc = await pack.getDocument(id).catch(() => null);
    if (doc) return doc;
  }
  return byName.get(item.name) ?? null;
}

/** Доливает книжные поля имплантам всех акторов мира. */
export async function migrateImplantAvailability() {
  if (!game.user?.isGM) { ui.notifications?.warn("Доливка полей биоимплантов: только для ГМа."); return; }
  const pack = game.packs?.get(FLAG_PACK);
  if (!pack) return { fixed: 0 };

  let fixed = 0;
  try {
    // Индекс по имени — запасной путь для предметов без sourceId (созданных
    // до того, как Foundry начал его проставлять, или скопированных вручную).
    const index = await pack.getIndex();
    const byName = new Map();
    for (const e of index) byName.set(e.name, e);

    for (const actor of game.actors ?? []) {
      const updates = [];
      for (const item of actor.items ?? []) {
        if (item.type !== "implant") continue;
        const src = await findSource(item, pack, byName);
        if (!src) continue;
        const full = src.system ? src : await pack.getDocument(src._id).catch(() => null);
        const patch = implantAvailabilityPatch(item, full);
        if (patch) updates.push({ _id: item.id, ...patch });
      }
      if (updates.length) {
        await actor.updateEmbeddedDocuments("Item", updates);
        fixed += updates.length;
      }
    }
  } catch (e) { console.error("Warhammer DBC | Доливка полей биоимплантов:", e); }

  const msg = `Биоимплантам долиты книжные Доступность/варианты Best.Q: ${fixed}.`;
  console.log("Warhammer DBC |", msg);
  if (fixed) ui.notifications?.info("Warhammer DBC: " + msg);
  return { fixed };
}
