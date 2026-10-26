// module/combat/tandem.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Tandem / Тандем — действия «встроить» и «извлечь» (Sahara 3-9d40).
//  Правило и устройство профиля-тандема — rules/tandem.mjs. Здесь только то, что
//  трогает документы: предметы актора, окно выбора и карточка в чат.
//
//  Кнопки живут на листе Таланта (apps/talent-actions.mjs), как у Боевого клича.
//  «За ¼ смены» — время игры, его считает стол; система его не списывает.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { hasTandem, tandemHostOk, tandemGuestOk, tandemProfiles, buildTandemProfile } from "../rules/tandem.mjs";

const NS = "warhammer-dbc";

/**
 * Встроить оружие `guest` в тяжёлое `host`: в host появляется профиль-тандем, guest уходит с листа
 * (целиком хранится внутри профиля). Возвращает true, если встроено.
 */
export async function embedTandem(actor, host, guest) {
  if (!hasTandem(actor)) { ui.notifications?.warn("Тандем: у персонажа нет Таланта Tandem."); return false; }
  if (!tandemHostOk(host)) { ui.notifications?.warn("Тандем: встраивать можно только в Тяжёлое оружие."); return false; }
  if (!tandemGuestOk(guest) || guest.id === host.id) { ui.notifications?.warn("Тандем: встраивается пистолет или винтовка (не длинная), которые стреляют."); return false; }
  if (tandemProfiles(host).length) { ui.notifications?.warn(`Тандем: в «${host.name}» уже встроено оружие — сначала извлеките его.`); return false; }

  const source = guest.toObject();
  const profile = buildTandemProfile(guest.system, guest.name, source, guest.id);
  const profiles = [...(Array.isArray(host.system?.profiles) ? host.system.profiles : []), profile];
  await host.update({
    "system.profiles": profiles,
    "system.weight": (Number(host.system?.weight) || 0) + profile.tandemWeight
  });
  // Выводимый профиль «Ударить оружием» идёт после авторских: сохранённый выбор профиля мог съехать.
  await host.unsetFlag?.(NS, "hudProfile");
  await guest.delete();
  await postTestCard(actor, {
    icon: rollIcon("wrench", "#ffb84d"),
    title: `Тандем — ${esc(actor.name)}`,
    threshold: `<div class="roll-threshold"><b>${esc(guest.name)}</b> встроено в <b>${esc(host.name)}</b> (¼ смены работы). `
      + `Стрелять можно любым из двух профилей; встроенное считается тяжёлым в рукопашной, его Rld удвоена (${esc(profile.reload)}). `
      + `Без Таланта Tandem в руках установка получает −2 к Надёжности.</div>`
  }, { sound: false });
  return true;
}

/** Извлечь тандем из `host` обратно в отдельный предмет. Возвращает true, если извлечено. */
export async function extractTandem(actor, host, profileIdx) {
  const entry = tandemProfiles(host).find(t => t.idx === Number(profileIdx));
  if (!entry) { ui.notifications?.warn("Тандем: встроенного оружия нет."); return false; }
  const { profile } = entry;
  const data = profile.tandemSource ? structuredClone(profile.tandemSource) : null;
  if (!data) { ui.notifications?.warn("Тандем: исходное оружие не сохранено — вернуть нечего."); return false; }
  data.system = { ...(data.system ?? {}), magazineCur: Number(profile.magazineCur) || 0, loadedAmmoId: profile.loadedAmmoId || "", equipped: false };
  // Прежний _id сохраняется: модификации оружия привязаны к нему (system.installedOn), и пока оружие сидело в тандеме,
  // они остались на листе — после извлечения снова стоят на нём. Моды встроенного оружия действуют на выстрел из профиля-тандема (combat/weapon-mods.mjs::getActiveMods).
  await actor.createEmbeddedDocuments("Item", [data], { keepId: true });
  const profiles = (host.system?.profiles ?? []).filter((_, i) => i !== entry.idx);
  await host.update({
    "system.profiles": profiles,
    "system.weight": Math.max(0, (Number(host.system?.weight) || 0) - (Number(profile.tandemWeight) || 0))
  });
  await host.unsetFlag?.(NS, "hudProfile");
  await postTestCard(actor, {
    icon: rollIcon("wrench", "#ffb84d"),
    title: `Тандем снят — ${esc(actor.name)}`,
    threshold: `<div class="roll-threshold"><b>${esc(profile.tandemName || "Оружие")}</b> извлечено из <b>${esc(host.name)}</b> и вернулось на лист отдельным предметом (¼ смены работы).</div>`
  }, { sound: false });
  return true;
}

const optionsHtml = items => items.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join("");

/** Окно «Встроить»: выбрать тяжёлое и встраиваемое. */
export async function startTandemEmbed(actor) {
  const hosts = [...(actor?.items ?? [])].filter(i => tandemHostOk(i) && !tandemProfiles(i).length);
  const guests = [...(actor?.items ?? [])].filter(tandemGuestOk);
  if (!hosts.length) { ui.notifications?.warn("Тандем: нет Тяжёлого оружия без встроенного."); return false; }
  if (!guests.length) { ui.notifications?.warn("Тандем: нет пистолета или винтовки, которые можно встроить."); return false; }
  const res = await foundry.applications.api.DialogV2.wait({
    window: { title: "Тандем: встроить оружие" },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<div class="wh-holo-dialog">
      <p>Тяжёлое оружие:</p><select class="tandem-host" style="width:100%">${optionsHtml(hosts)}</select>
      <p>Встраивается (уйдёт с листа, вернуть можно кнопкой «Извлечь»):</p><select class="tandem-guest" style="width:100%">${optionsHtml(guests)}</select>
    </div>`,
    buttons: [
      { action: "ok", label: "Встроить", default: true,
        callback: (event, button) => ({ host: button.form.querySelector(".tandem-host")?.value, guest: button.form.querySelector(".tandem-guest")?.value }) },
      { action: "cancel", label: "Отмена", callback: () => false }
    ],
    rejectClose: false
  });
  if (!res || res === "cancel") return false;
  return embedTandem(actor, actor.items.get(res.host), actor.items.get(res.guest));
}

/** Окно «Извлечь»: выбрать тяжёлое, из которого вынуть встроенное. */
export async function startTandemExtract(actor) {
  const hosts = [...(actor?.items ?? [])].filter(i => tandemProfiles(i).length);
  if (!hosts.length) { ui.notifications?.warn("Тандем: ни в одном оружии нет встроенного."); return false; }
  const res = await foundry.applications.api.DialogV2.wait({
    window: { title: "Тандем: извлечь оружие" },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<div class="wh-holo-dialog"><p>Из какого оружия извлечь встроенное:</p>
      <select class="tandem-host" style="width:100%">${hosts.map(h => `<option value="${esc(h.id)}">${esc(h.name)} — ${esc(tandemProfiles(h)[0].profile.tandemName || "")}</option>`).join("")}</select></div>`,
    buttons: [
      { action: "ok", label: "Извлечь", default: true, callback: (event, button) => button.form.querySelector(".tandem-host")?.value || false },
      { action: "cancel", label: "Отмена", callback: () => false }
    ],
    rejectClose: false
  });
  if (!res || res === "cancel") return false;
  const host = actor.items.get(res);
  return extractTandem(actor, host, tandemProfiles(host)[0].idx);
}
