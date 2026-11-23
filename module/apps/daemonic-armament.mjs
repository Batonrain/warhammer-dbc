// module/apps/daemonic-armament.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Кнопка Черты «Демоническое Вооружение (X/Y)» (запись kind:"script", задача
//  Studio 55-15). Правило и превращение оружия — rules/daemonic-armament.mjs.
//
//  • Оружия в руке нет → призвать: при первом нажатии выбрать образец из
//    «стандартного примитивного» арсенала компендиума (выбор запоминается на
//    Черте), в бою списать полудействие (с Quick Draw — бесплатно), положить
//    на лист экипированное оружие +X Dmg, +Y Pen, Reinforced, без Primitive.
//  • Оружие в руке → развоплотить (бесплатно).
//  • Shift+нажатие → сменить выбранный образец.
//  Выронил/выбили (снял галочку «Снаряжено» или убрал с листа) — оружие
//  растворяется само: хук updateItem в module/hooks.mjs.
// ════════════════════════════════════════════════════════════════════════════

import {
  DAEMONIC_ARMAMENT_CHOICE_FLAG, isDaemonicArmamentCandidate,
  isDaemonicArmamentTrait, summonedDaemonicArmament, daemonicArmamentWeaponData,
  daemonicArmamentSummonAp, daemonicArmamentRatings
} from "../rules/daemonic-armament.mjs";
import { hasSpeedTalent } from "../rules/speed-talents.mjs";
import { canSpendActionPoints, spendActionPoints } from "../combat/action-economy.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";

async function candidates() {
  const pack = game.packs?.get(`${NS}.weapons`);
  if (!pack) return [];
  const docs = await pack.getDocuments();
  return docs.filter(d => isDaemonicArmamentCandidate({ type: d.type, system: d.system, folderName: d.folder?.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

async function chooseWeapon(actor, trait) {
  const list = await candidates();
  if (!list.length) { ui.notifications.warn("Демоническое Вооружение: в компендиуме оружия нет примитивного оружия."); return null; }
  const current = trait.getFlag(NS, DAEMONIC_ARMAMENT_CHOICE_FLAG) ?? "";
  const opts = list.map(d => `<option value="${esc(d.uuid)}"${d.uuid === current ? " selected" : ""}>`
    + `${esc(d.name)} — ${esc(d.system.damage)}, Pen ${Number(d.system.penetration) || 0}</option>`).join("");
  const uuid = await foundry.applications.api.DialogV2.wait({
    window: { title: `Демоническое Вооружение — ${actor.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<form style="padding:4px 6px;">
      <p style="margin:4px 0;">Одно стандартное примитивное рукопашное, метательное или стрелковое оружие — часть сущности демона. Выбор запоминается; сменить — Shift+нажатие кнопки.</p>
      <select name="weapon" style="width:100%;">${opts}</select></form>`,
    rejectClose: false,
    buttons: [
      { action: "ok", label: "Выбрать", default: true,
        callback: (_e, button) => button.form.querySelector('select[name="weapon"]')?.value ?? "" },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
  if (!uuid) return null;
  await trait.setFlag(NS, DAEMONIC_ARMAMENT_CHOICE_FLAG, uuid);
  return uuid;
}

function card(actor, lines) {
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("burst", "#b04040")}Демоническое Вооружение — ${esc(actor.name)}</div>
      ${lines.filter(Boolean).map(l => `<div class="roll-threshold">${l}</div>`).join("")}
    </div>`
  });
}

/**
 * Призвать или развоплотить оружие Черты.
 * @param {Actor} actor
 * @param {Item} [trait]  сама Черта (в скрипте — item)
 * @param {{change?:boolean}} [opts]  change — сначала сменить образец
 */
export async function toggleDaemonicArmament(actor, trait, { change = false } = {}) {
  if (!actor) return null;
  trait = isDaemonicArmamentTrait(trait) ? trait : [...actor.items].find(isDaemonicArmamentTrait);
  if (!trait) { ui.notifications.warn("Демоническое Вооружение: у персонажа нет такой Черты."); return null; }
  change ||= !!globalThis.event?.shiftKey;

  const summoned = summonedDaemonicArmament(actor);
  if (summoned.length && !change) {
    await actor.deleteEmbeddedDocuments("Item", summoned.map(i => i.id));
    await card(actor, [`${esc(summoned.map(i => i.name).join(", "))} растворяется в воздухе.`]);
    return "dismissed";
  }

  let uuid = trait.getFlag(NS, DAEMONIC_ARMAMENT_CHOICE_FLAG) ?? "";
  if (!uuid || change) uuid = await chooseWeapon(actor, trait);
  if (!uuid) return null;
  const base = await fromUuid(uuid).catch(() => null);
  if (!base) { ui.notifications.warn("Демоническое Вооружение: выбранное оружие не найдено в компендиуме — выберите заново (Shift+нажатие)."); return null; }

  const quickDraw = hasSpeedTalent(actor, "quickDraw");
  const ap = daemonicArmamentSummonAp({ quickDraw });
  if (ap && !canSpendActionPoints(actor, ap, { physical: true })) {
    ui.notifications.warn(`${actor.name}: на призыв оружия нужно полудействие — Очков Действия не хватает.`);
    return null;
  }
  if (summoned.length) await actor.deleteEmbeddedDocuments("Item", summoned.map(i => i.id));
  const { x, y } = daemonicArmamentRatings(trait);
  const data = daemonicArmamentWeaponData(base.toObject(), { x, y, traitId: trait.id, sourceUuid: uuid });
  const [created] = await actor.createEmbeddedDocuments("Item", [data]);
  if (ap) await spendActionPoints(actor, ap, { physical: true });
  await card(actor, [
    `В руке — <b>${esc(data.name)}</b>: ${esc(data.system.damage)}, Pen ${data.system.penetration} (+${x} Dmg, +${y} Pen), Reinforced, без Primitive.`,
    "Не тратит стандартные боеприпасы. Выронил или выбили — растворяется (снимите «Снаряжено»).",
    ap ? "Полудействие." : (quickDraw ? "Свободное действие (Quick Draw)." : "")
  ]);
  return created ?? null;
}
