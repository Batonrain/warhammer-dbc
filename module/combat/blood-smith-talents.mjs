// module/combat/blood-smith-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Кнопки Черты и Талантов Кузнеца Крови (правила — rules/blood-smith-talents.mjs).
//  Кольцо Крови — исход ритуального поединка; Демонические Латы — вселить
//  порабощённого демона в доспех; Расковать — взорвать демоническое оружие.
//  Связанный Кровью — без кнопки, в окне ритуала (apps/ritual-cast.mjs).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { hasItemNamed } from "../rules/req-atom.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";
import { addFlatDamage } from "../constants/demon-weapon.mjs";
import {
  ENSLAVED_FLAG, RING_OF_BLOOD_FLAG, DAEMON_PLATE_FLAG, UNFORGE_RADIUS,
  enslavedList, addEnslaved, removeEnslaved, daemonKey, unforgeable, unforgeFormula, ringOfBloodWeaponUpdate
} from "../rules/blood-smith-talents.mjs";
import {
  chooseOne, confirmBox, infoCard, targetedActors, tokensAround, setTargets, applyDamageButton
} from "./astartes-elite-ui.mjs";

const NS = "warhammer-dbc";

/** Имя и W.b демона: из выделенной цели, иначе — вводом. */
async function askDemon(title) {
  const t = targetedActors()[0];
  const tName = t?.name ?? "";
  const tWb = Number(t?.system?.characteristics?.wp?.bonus) || 0;
  const html = `<p>${t ? `Цель: ${esc(tName)}.` : "Цель не выделена — впишите демона."}</p>
    <div class="form-group"><label>Демон</label><input type="text" name="dn" value="${esc(tName)}"></div>
    <div class="form-group"><label>W.b демона</label><input type="number" name="dwb" value="${tWb || 4}"></div>`;
  const res = await foundry.applications.api.DialogV2.prompt({
    window: { title }, classes: ["warhammer-dbc", "wh-holo"], content: html,
    ok: { label: "Дальше", callback: (_ev, button) => ({ name: String(button.form.elements.dn.value || "").trim(), wb: Number(button.form.elements.dwb.value) || 0 }) },
    rejectClose: false
  }).catch(() => null);
  return res?.name ? res : null;
}

/** Ring of Blood / Кольцо Крови: исход поединка в кругу. */
export async function useRingOfBlood(actor) {
  if (!hasItemNamed(actor, "Ring of Blood", ["trait"])) return ui.notifications.warn("⚠️ У актора нет Черты Кольцо Крови.") && "нет Черты";
  const outcome = await chooseOne("Кольцо Крови", [
    { id: "win", label: "Кузнец победил — поработить демона" },
    { id: "lose", label: "Демон победил, Кузнец покинул круг или вмешался третий" }
  ], { prompt: "Чем кончился поединок?" });
  if (!outcome) return "отмена";
  if (outcome.id === "lose") {
    const roll = await new Roll("2d10").evaluate();
    const res = await applyWoundLoss(actor, roll.total);
    await infoCard(actor, "🩸", "Кольцо Крови: демон пожирает часть души", [
      `<b>${roll.total}</b> непоглощаемого R урона Кузнецу — уже списано (Раны: ${res?.newWounds ?? "?"} / ${res?.maxWounds ?? "?"}).`,
      "Демон может покинуть круг, сохраняя Истинную Форму и без Warp Instability 8 дней."
    ], { rolls: [roll] });
    return undefined;
  }
  const demon = await askDemon("Кольцо Крови: порабощённый демон");
  if (!demon) return "отмена";
  const weapons = actor.items.filter(i => i.type === "weapon" && !i.system?.legacy?.active);
  const pick = await chooseOne("Кольцо Крови", [
    { id: "", label: "Не вселять в оружие — только поработить" },
    ...weapons.map(w => ({ id: w.id, label: `${w.name}${w.system?.daemonWeapon?.bound ? " (уже демоническое — второй демон)" : ""}` }))
  ], { prompt: `В какое оружие вселить ${demon.name}?` });
  if (!pick) return "отмена";
  await actor.setFlag(NS, ENSLAVED_FLAG, addEnslaved(enslavedList(actor), demon));
  const lines = [`<b>${esc(demon.name)}</b> (W.b ${demon.wb}) — перманентный раб Кузнеца; тесты Демонического Владычества против него проходятся автоматически.`];
  if (pick.id) {
    const weapon = actor.items.get(pick.id);
    const { second, update } = ringOfBloodWeaponUpdate(weapon.system, demon, addFlatDamage);
    await weapon.update({ ...update, [`flags.${NS}.${RING_OF_BLOOD_FLAG}`]: true });
    lines.push(second
      ? `${esc(weapon.name)}: второй демон — W.b обоих суммируется в Dmg и Pen (+${demon.wb}). Дух обвивается вокруг оружия ещё восемь часов; вселить его в другое оружие — полное действие.`
      : `${esc(weapon.name)} стало демоническим: +${demon.wb} к Dmg и Pen, Reinforced, без Primitive/Sanctified. Демонические свойства Кузнец выбирает сам — во вкладке «Осквернение» оружия.`);
  }
  await infoCard(actor, "🩸", "Кольцо Крови: демон порабощён", lines);
  return undefined;
}

/** Daemon Plate / Демонические Латы: вселить порабощённого демона в полный доспех. */
export async function useDaemonPlate(actor) {
  if (!hasItemNamed(actor, "Daemon Plate", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Демонические Латы.") && "нет Таланта";
  const armours = actor.items.filter(i => i.type === "armor" && !i.getFlag(NS, DAEMON_PLATE_FLAG));
  if (!armours.length) return ui.notifications.warn("⚠️ Нет доспеха без демона.") && "нет доспеха";
  const list = enslavedList(actor);
  const d = await chooseOne("Демонические Латы", [
    ...list.map((x, i) => ({ id: String(i), label: `${x.name} (W.b ${x.wb})` })),
    { id: "other", label: "Другой порабощённый демон — вписать" }
  ], { prompt: "Какого порабощённого демона вселить?" });
  if (!d) return "отмена";
  const demon = d.id === "other" ? await askDemon("Демонические Латы") : list[Number(d.id)];
  if (!demon) return "отмена";
  const a = await chooseOne("Демонические Латы", armours.map(x => ({ id: x.id, label: x.name })), { prompt: "В какой полный доспех?" });
  if (!a) return "отмена";
  const armour = actor.items.get(a.id);
  const { blankMechEntry } = await import("../apps/mechanics.mjs");
  const rid = () => foundry.utils.randomID(16);
  const wb = String(Math.max(0, Number(demon.wb) || 0));
  const label = `Демонические Латы (${demon.name})`;
  const entries = [
    { ...blankMechEntry("trait"), id: rid(), label, sourceUuid: "Compendium.warhammer-dbc.traits.Item.brwXUX5nKFR5tOjG",
      sourceName: "Daemonic / Демонический (X)", sourceImg: "systems/warhammer-dbc/assets/item-icons/trait.svg", sourceHasRating: true, rating: wb },
    { ...blankMechEntry("characteristic"), id: rid(), label: `${label}: Unnatural S (${wb})`, charKey: "s", field: "bonus", op: "add", value: wb },
    { ...blankMechEntry("characteristic"), id: rid(), label: `${label}: Unnatural A (${wb})`, charKey: "ag", field: "bonus", op: "add", value: wb },
    { ...blankMechEntry("capability"), id: rid(), label: `${label}: иммунитет к Haywire`, capabilityKey: "weaponPropertyImmunity.haywire" }
  ];
  const groups = foundry.utils.deepClone(armour.getFlag(NS, "mechanics") ?? []);
  groups.push({ id: rid(), operator: "AND", entries });
  await armour.update({ [`flags.${NS}.mechanics`]: groups, [`flags.${NS}.${DAEMON_PLATE_FLAG}`]: { name: demon.name, wb: Number(wb) } });
  await infoCard(actor, "👹", "Демонические Латы", [
    `${esc(demon.name)} вселён в <b>${esc(armour.name)}</b>: носитель получает Daemonic (${wb}), Unnatural S (${wb}) и Unnatural A (${wb}), доспех иммунен к Haywire — пока надет.`,
    "Другой носитель при надевании и каждые сутки — тест Демонического Владычества (демон +40), при Провале под контролем демона на сутки. Кузнец проходит его автоматически, пока держит порабощение."
  ]);
  return undefined;
}

/** Unforge / Расковать: раз в Ход, свободным действием — взорвать демоническое оружие с порабощённым демоном. */
export async function useUnforge(actor) {
  if (!hasItemNamed(actor, "Unforge", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Расковать.") && "нет Таланта";
  const list = actor.items.filter(unforgeable);
  if (!list.length) return ui.notifications.warn("⚠️ Нет демонического оружия с порабощённым демоном.") && "нет оружия";
  const pick = await chooseOne("Расковать", list.map(w => ({ id: w.id, label: `${w.name} — ${w.system.daemonWeapon.demonName || "демон"} (W.b ${w.system.daemonWeapon.demonWb || 0})` })));
  if (!pick) return "отмена";
  const weapon = actor.items.get(pick.id);
  if (!(await confirmBox("Расковать", `Уничтожить <b>${esc(weapon.name)}</b>? Оружие взорвётся, демон выйдет в Истинной Форме.`, "Расковать", "Нет"))) return "отмена";
  const dw = weapon.system.daemonWeapon;
  const formula = unforgeFormula(dw.demonWb);
  const roll = await new Roll(formula).evaluate();
  // Кроме самого Кузнеца (tokensAround его не берёт) и его порабощённых демонов (по имени).
  const slaves = new Set(enslavedList(actor).map(x => daemonKey(x.name)));
  const toks = tokensAround(actor, UNFORGE_RADIUS).filter(t => !slaves.has(daemonKey(t.actor?.name)));
  setTargets(toks);
  const btns = toks.map(t => applyDamageButton({ damage: roll.total, pen: 0, type: "energy", label: `Расковать: ${weapon.name}`,
    attacker: actor, forceTarget: t.actor?.uuid ?? "", warp: true, text: `${esc(t.name)}: ${roll.total} E (Warp Weapon)` }));
  const demonName = dw.demonName || "демон";
  await weapon.delete();
  await actor.setFlag(NS, ENSLAVED_FLAG, removeEnslaved(enslavedList(actor), demonName));
  await infoCard(actor, "💥", "Расковать", [
    `${esc(weapon.name)} взрывается: <b>${roll.total}</b> E (${esc(formula)}), Warp Weapon — всем в ${UNFORGE_RADIUS} м (цели выделены), кроме самого Кузнеца.`,
    `${esc(demonName)} материализуется в Истинной Форме на месте оружия (выставляет ГМ). Порабощённые Кузнецом демоны в радиусе не задеты.`
  ], { rolls: [roll], sections: btns.length ? [btns.join("")] : [] });
  return undefined;
}
