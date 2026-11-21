// module/combat/valourous-accord.mjs
// ════════════════════════════════════════════════════════════════════════
//  Соглашение Доблести (Черта Кузнеца Крови) — Foundry-сторона.
//  Чистая логика — rules/archetype-suppression.mjs.
//
//  Нарушение обета ловится там, где оно происходит:
//   • проявление психосилы — combat/psyker-elite-hooks.mjs::eliteManifestAfter;
//   • ритуал (кроме Призыва) — apps/ritual-cast.mjs::castRitual;
//   • атака психосиловым или чужим оружием — combat/attack.mjs;
//   • надетая чужая броня — хук updateItem (warhammer-dbc.mjs).
//  «Чужое» — оружие и броня без метки «своё» (VALOUR_OWN_FLAG): её ставит
//  кнопка Черты для созданного им лично и взятого с побеждённых в честном бою.
//  Встроенное оружие тела и выданное его же способностями — своё всегда.
//
//  Нарушение гасит Таланты и Черты Архетипа на 8 дней мирового времени
//  (apps/mechanics.mjs::syncArchetypeSuppression). Повторное нарушение во время
//  срока продлевает его на 8 дней от этого момента и освобождает всех демонов
//  Кольца Крови. Повтором считается нарушение не раньше чем через час после
//  начала срока — одна схватка с чужим клинком это одно нарушение, а не серия.
//  «Или дольше по решению ГМа»: в окне Черты ГМ продлевает текущий срок на
//  любое число дней или снимает его досрочно (Sahara 587-fd8b).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import {
  valourViolation, valourPenalty, valourExtension, timedSuppressions, hasValourousAccord,
  TIMED_FLAG, BLOOD_SMITH, VALOUR_DAYS, VALOUR_OWN_FLAG, isValourOwn
} from "../rules/archetype-suppression.mjs";
import { enslavedList, ENSLAVED_FLAG } from "../rules/blood-smith-talents.mjs";

const NS = "warhammer-dbc";
/** Нарушение раньше этого срока от начала наказания — то же самое нарушение. */
export const REPEAT_GAP_SECONDS = 3600;

const worldNow = () => Number(game?.time?.worldTime) || 0;

async function resync(actor) {
  const { syncArchetypeSuppression } = await import("../apps/mechanics.mjs");
  return syncArchetypeSuppression(actor);
}

/**
 * Проверить действие на нарушение и, если оно есть, наказать.
 * @returns {Promise<string>} строка для карточки ("" — нарушения нет)
 */
export async function checkValourViolation(actor, kind, item = null) {
  const why = valourViolation(actor, kind, item);
  if (!why || !actor?.isOwner) return "";
  const now = worldNow();
  const cur = timedSuppressions(actor, now)[BLOOD_SMITH];
  const sameOccasion = !!cur && now - (Number(cur.since) || 0) < REPEAT_GAP_SECONDS;
  const { until, repeat } = valourPenalty(actor, now);
  const all = { ...(actor.getFlag(NS, TIMED_FLAG) ?? {}) };
  all[BLOOD_SMITH] = sameOccasion ? cur : { until, since: now, reason: why };
  await actor.setFlag(NS, TIMED_FLAG, all);
  const changed = await resync(actor);

  const lines = [];
  if (sameOccasion) return "";
  lines.push(`<div class="roll-threshold">${esc(actor.name)} ${esc(why)} — обет нарушен. Таланты и Черты Кузнеца Крови не действуют ${VALOUR_DAYS} дней${repeat ? " (срок начат заново)" : ""}.</div>`);
  if (changed.length) lines.push(`<div class="roll-threshold" style="font-size:0.85em;opacity:0.8;">Погашено: ${changed.map(esc).join(", ")}.</div>`);
  if (repeat) {
    const freed = enslavedList(actor);
    if (freed.length) {
      await actor.unsetFlag(NS, ENSLAVED_FLAG);
      lines.push(`<div class="roll-threshold"><b>Повторное нарушение:</b> демоны Кольца Крови освобождены — ${freed.map(d => esc(d.name)).join(", ")}.</div>`);
    }
  }
  await postTestCard(actor, { icon: "⚖", title: `Соглашение Доблести: ${esc(actor.name)}`, lines }, { sound: false });
  return `Соглашение Доблести нарушено: ${why}.`;
}

/** Хук updateItem: надетая чужая броня нарушает обет. */
export async function valourOnEquip(item, changes) {
  const actor = item?.parent;
  if (item?.type !== "armor" || !hasValourousAccord(actor)) return;
  if (changes?.system?.equipped !== true) return;
  await checkValourViolation(actor, "equip", item);
}

/** Мировое время ушло вперёд: истёкшие сроки снимаются, Архетип возвращается. */
export async function sweepValourExpiry() {
  if (game.users?.activeGM !== game.user) return;
  const now = worldNow();
  for (const actor of game.actors ?? []) {
    const raw = actor.getFlag?.(NS, TIMED_FLAG);
    if (!raw || !Object.keys(raw).length) continue;
    const live = timedSuppressions(actor, now);
    if (Object.keys(live).length === Object.keys(raw).length) continue;
    if (Object.keys(live).length) await actor.setFlag(NS, TIMED_FLAG, live);
    else await actor.unsetFlag(NS, TIMED_FLAG);
    const back = await resync(actor);
    if (back.length) {
      await postTestCard(actor, { icon: "⚖", title: `Соглашение Доблести: ${esc(actor.name)}`,
        lines: [`<div class="roll-threshold">Срок покаяния истёк — Таланты и Черты Кузнеца Крови снова действуют.</div>`] }, { sound: false });
    }
  }
}

/**
 * Кнопка Черты: отметить своё снаряжение (создано лично или взято с
 * побеждённого в честном бою) и посмотреть срок. ГМ может снять срок досрочно.
 */
export async function useValourousAccord(actor) {
  if (!hasValourousAccord(actor)) return ui.notifications.warn("⚠️ У актора нет Черты Соглашение Доблести.");
  const gear = actor.items.filter(i => i.type === "weapon" || i.type === "armor")
    .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  const cur = timedSuppressions(actor, worldNow())[BLOOD_SMITH];
  const days = cur ? Math.ceil((Number(cur.until) - worldNow()) / 86400) : 0;
  const rows = gear.map(i => `<label style="display:block"><input type="checkbox" name="own" value="${i.id}" ${isValourOwn(i) ? "checked" : ""}> ${esc(i.name)}</label>`).join("");
  const content = `<p>${cur ? `<b>Обет нарушен</b> (${esc(cur.reason || "")}): Архетип погашен ещё ~${days} дн.` : "Обет соблюдён."}</p>
    <p>Отметьте снаряжение, созданное лично или взятое с побеждённого в честном бою:</p>
    <div style="max-height:300px;overflow:auto">${rows || "<i>Оружия и брони нет.</i>"}</div>
    ${cur && game.user?.isGM ? `<label style="display:block;margin-top:6px"><input type="checkbox" name="lift"> Снять срок досрочно (решение ГМа)</label>
    <label style="display:block;margin-top:4px">Продлить на <input type="number" name="extend" min="0" step="0.5" value="0" style="width:4em"> дн. («или дольше по решению ГМа»)</label>` : ""}`;
  const res = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Соглашение Доблести" }, content,
    ok: { label: "Сохранить", callback: (_e, btn) => {
      const f = btn.form;
      return { own: [...f.querySelectorAll('input[name="own"]:checked')].map(x => x.value), lift: !!f.querySelector('input[name="lift"]')?.checked,
        extend: Number(f.querySelector('input[name="extend"]')?.value) || 0 };
    } }
  }).catch(() => null);
  if (!res) return;
  const own = new Set(res.own);
  for (const i of gear) {
    if (isValourOwn(i) !== own.has(i.id)) await i.setFlag(NS, VALOUR_OWN_FLAG, own.has(i.id));
  }
  if (res.lift) {
    const all = { ...(actor.getFlag(NS, TIMED_FLAG) ?? {}) };
    delete all[BLOOD_SMITH];
    if (Object.keys(all).length) await actor.setFlag(NS, TIMED_FLAG, all);
    else await actor.unsetFlag(NS, TIMED_FLAG);
    await resync(actor);
  } else if (res.extend > 0 && game.user?.isGM) {
    // Произвольное удлинение ГМом: тот же флаг срока, только until дальше.
    const next = valourExtension(cur, res.extend);
    if (next) {
      await actor.setFlag(NS, TIMED_FLAG, { ...(actor.getFlag(NS, TIMED_FLAG) ?? {}), [BLOOD_SMITH]: next });
      await postTestCard(actor, { icon: "⚖", title: `Соглашение Доблести: ${esc(actor.name)}`,
        lines: [`<div class="roll-threshold">ГМ продлил срок покаяния на ${res.extend} дн.: Архетип погашен ещё ~${Math.ceil((next.until - worldNow()) / 86400)} дн.</div>`] }, { sound: false });
    }
  }
  ui.notifications.info(`Соглашение Доблести: своё снаряжение — ${own.size} шт.`);
}
