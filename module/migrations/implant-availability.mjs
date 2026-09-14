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

/**
 * Доливка книжных полей имплантам ОДНОГО актора. Бросает исключение наружу —
 * решение, что делать со сбоем (пропустить и продолжить остальных), принимает
 * вызывающий код в migrateImplantAvailability (тот же приём, что и в
 * module/migrations/gear-equipped.mjs).
 */
async function migrateOneActorImplantAvailability(actor, pack, byName) {
  const updates = [];
  for (const item of actor.items ?? []) {
    if (item.type !== "implant") continue;
    const src = await findSource(item, pack, byName);
    if (!src) continue;
    const full = src.system ? src : await pack.getDocument(src._id).catch(() => null);
    const patch = implantAvailabilityPatch(item, full);
    if (patch) updates.push({ _id: item.id, ...patch });
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  return updates.length;
}

/**
 * Доливает книжные поля имплантам всех акторов мира, а также несвязанным
 * токенам сцен (wdbc-059h, по образцу gear-equipped/wdbc-dyi): у токена с
 * actorLink:false импланты лежат в его собственной ActorDelta, а не в мировом
 * Actor — такой токен не входит в game.actors и без отдельного прохода
 * остался бы не замечен.
 *
 * Ошибка на одном акторе/токене логируется и пропускается, не прерывая
 * обработку следующих: импланты разных персонажей друг от друга не зависят.
 */
export async function migrateImplantAvailability() {
  if (!game.user?.isGM) { ui.notifications?.warn("Доливка полей биоимплантов: только для ГМа."); return; }
  const pack = game.packs?.get(FLAG_PACK);
  if (!pack) return { fixed: 0, failed: 0 };

  let fixed = 0;
  let failed = 0;

  // Индекс по имени — запасной путь для предметов без sourceId (созданных
  // до того, как Foundry начал его проставлять, или скопированных вручную).
  const index = await pack.getIndex();
  const byName = new Map();
  for (const e of index) byName.set(e.name, e);

  // Мировые акторы. Связанные токены (actorLink:true) используют тот же
  // документ Actor — им отдельный проход не нужен.
  for (const actor of game.actors ?? []) {
    try {
      fixed += await migrateOneActorImplantAvailability(actor, pack, byName);
    } catch (e) {
      failed++;
      console.error(`Warhammer DBC | Доливка полей биоимплантов: сбой на акторе «${actor.name}» (${actor.id}), пропущен:`, e);
    }
  }

  // Несвязанные токены сцен: их синтетический актор (tokenDoc.actor) пишет
  // прямо в ActorDelta токена.
  for (const scene of game.scenes ?? []) {
    for (const tokenDoc of scene.tokens?.contents ?? []) {
      if (tokenDoc.actorLink) continue;
      const actor = tokenDoc.actor;
      if (!actor) continue;
      try {
        fixed += await migrateOneActorImplantAvailability(actor, pack, byName);
      } catch (e) {
        failed++;
        console.error(`Warhammer DBC | Доливка полей биоимплантов: сбой на токене «${tokenDoc.name}» сцены «${scene.name}» (${tokenDoc.id}), пропущен:`, e);
      }
    }
  }

  const msg = failed
    ? `Биоимплантам долиты книжные Доступность/варианты Best.Q: ${fixed}; ${failed} акторов/токенов пропущено из-за ошибок — миграция повторится при следующей загрузке мира.`
    : `Биоимплантам долиты книжные Доступность/варианты Best.Q: ${fixed}.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed };
}
