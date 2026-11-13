// module/apps/psyber-link.mjs
// ═══════════════════════════════════════════════════════════════════════════
//  Трейт «Psyber / Псайбер (X)»: «Душа связана с хозяином (пси-матрица)».
//  Запись kind:"script" на Черте вызывает linkPsyberToMaster(actor) — кнопка
//  «Связать с хозяином» (dbc-114 / 55-15, 13.11.2026).
//
//  Что даёт связь: хозяин получает носителем манифестации своего псайбера
//  (rules/psychic-vessel.mjs: флаг psychicVessel ставится на ХОЗЯИНЕ — как у
//  Spirit Talk), и в окне манифестации по Пути «Псайбер-Фамильяр»
//  (sheets/tabs/psychic.mjs) заметка называет псайбера по имени. Чувства,
//  телепатия и «всегда знают направление и расстояние» в игре не считаются —
//  остаются текстом Черты; дальность система не меряет вовсе.
//  Не путать со связью Голема Рубрики (combat/rubric-sorcerer.mjs, свой флаг).
// ═══════════════════════════════════════════════════════════════════════════

import { setPsychicVessel, clearPsychicVessel, getPsychicVessel } from "../rules/psychic-vessel.mjs";
import { esc } from "../helpers/utils.mjs";

const MASTER_TYPES = ["character", "minion", "daemon"];

/**
 * Кого можно назвать хозяином псайбера: персонажи/миньоны/демоны мира, кроме
 * самого псайбера; псайкеры (system.isPsyker) — первыми. Чистая функция.
 * @param {Iterable<Actor>} actors
 * @param {Actor} psyber
 */
export function psyberMasterCandidates(actors, psyber) {
  const list = [...(actors ?? [])].filter(a => a && a !== psyber && a.id !== psyber?.id
    && MASTER_TYPES.includes(a.type));
  return list.sort((a, b) => (Number(!!b.system?.isPsyker) - Number(!!a.system?.isPsyker))
    || String(a.name).localeCompare(String(b.name), "ru"));
}

/** Хозяева, у которых этот псайбер сейчас назначен носителем. */
export function mastersOf(actors, psyber) {
  return [...(actors ?? [])].filter(a => psyber?.uuid && getPsychicVessel(a)?.uuid === psyber.uuid);
}

/**
 * Окно выбора хозяина → привязка. Выбор «разорвать» снимает связь у всех
 * хозяев этого псайбера. Предыдущий носитель у нового хозяина заменяется.
 */
export async function linkPsyberToMaster(psyber) {
  if (!psyber) return;
  const actors = game.actors?.contents ?? [];
  const candidates = psyberMasterCandidates(actors, psyber);
  const current = mastersOf(actors, psyber);
  if (!candidates.length && !current.length) {
    return ui.notifications.warn("Псайбер: в мире нет персонажей, которых можно назвать хозяином.");
  }
  const opts = candidates.map((a, i) =>
    `<option value="${i}" ${current.includes(a) ? "selected" : ""}>${esc(a.name)}${a.system?.isPsyker ? " (псайкер)" : ""}</option>`).join("");
  const now = current.length ? `Сейчас хозяин: ${esc(current.map(a => a.name).join(", "))}.` : "Хозяин не назначен.";
  const pick = await foundry.applications.api.DialogV2.wait({
    window: { title: `Псайбер — ${psyber.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<form style="padding:4px 6px;">
      <p style="margin:4px 0;">${now} Хозяин получит ${esc(psyber.name)} носителем манифестации
      (Путь «Псайбер-Фамильяр»). Чувства и телепатия считаются на столе.</p>
      <select name="master" style="width:100%;">${opts}</select></form>`,
    rejectClose: false,
    buttons: [
      { action: "ok", label: "Связать", default: true,
        callback: (_e, button) => ({ link: Number(button.form.querySelector('select[name="master"]')?.value) }) },
      ...(current.length ? [{ action: "clear", label: "Разорвать связь", callback: () => ({ clear: true }) }] : []),
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
  if (!pick) return;
  if (pick.clear) {
    for (const m of current) await clearPsychicVessel(m);
    return ui.notifications.info(`Псайбер: связь ${psyber.name} разорвана.`);
  }
  const master = candidates[pick.link];
  if (!master) return;
  // Один псайбер — один хозяин: прежних хозяев этого псайбера отвязываем.
  for (const m of current) if (m !== master) await clearPsychicVessel(m);
  await setPsychicVessel(master, psyber, { label: psyber.name });
  ui.notifications.info(`Псайбер: ${psyber.name} связан с хозяином ${master.name}.`);
}
