// module/combat/bronenosets-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Кнопки Талантов Броненосца (правила и числа — rules/bronenosets-talents.mjs).
//  Скрипты Конструктора зовут их по имени из combat/elite-api/astartes.mjs.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { expectedPhase } from "../constants/effect-keys.mjs";
import { hasItemNamed } from "../rules/req-atom.mjs";
import {
  CHAOS_GREATBOW_FLAG, DIVINE_SHIELD_FLAG, SIN_EATER_FLAG,
  isBowWeapon, isChaosGreatbow, divineShieldAP, sinEaterNext
} from "../rules/bronenosets-talents.mjs";
import { halfCorB } from "../rules/astartes-elite-common.mjs";
import { unnaturalRating } from "../rules/unnatural-characteristic.mjs";
import { chooseOne, confirmBox, infoCard, targetedActors } from "./astartes-elite-ui.mjs";
import { mountOf } from "./mount.mjs";

const NS = "warhammer-dbc";
const TRAITS = "Compendium.warhammer-dbc.traits.Item.";
const UNNATURAL_S4 = `${TRAITS}jRAPHbIufYAu030e`;
const UNNATURAL_T4 = `${TRAITS}0lmXXFGAoQlffxGQ`;
const NATURAL_ARMOUR = `${TRAITS}bvO8S59a6fOSBXcK`;

/** Chaos Greatbow: преобразить лук (минута концентрации) или вернуть ему прежний вид. */
export async function useChaosGreatbow(actor) {
  if (!hasItemNamed(actor, "Chaos Greatbow", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Великий Лук Хаоса.");
  const bows = [...actor.items].filter(isBowWeapon);
  if (!bows.length) return ui.notifications.warn("⚠️ В снаряжении нет лука — нечего преображать.");
  const pick = await chooseOne("Великий Лук Хаоса", bows.map(b => ({
    id: b.id, label: `${b.name}${isChaosGreatbow(b) ? " — преображён (вернуть обычный вид)" : ""}`
  })), { prompt: "Какой лук преобразить?" });
  if (!pick) return "отмена";
  const bow = actor.items.get(pick.id);
  if (isChaosGreatbow(bow)) {
    await bow.unsetFlag(NS, CHAOS_GREATBOW_FLAG);
    return void await infoCard(actor, "🏹", "Великий Лук Хаоса", [`«${esc(bow.name)}» снова обычный лук.`]);
  }
  await bow.setFlag(NS, CHAOS_GREATBOW_FLAG, true);
  const half = halfCorB(actor);
  await infoCard(actor, "🏹", "Великий Лук Хаоса", [
    `Минута концентрации — «${esc(bow.name)}» преображён.`,
    `Каждая атака им сама получает: +S.b к урону без предела, +${half} (½Cor.b) к урону и Pen, без Primitive. Стрелы — огромные, как у обычного великого лука.`
  ]);
}

/** Удерживаемый щит актора (оружие с AP щита, экипированное). */
function equippedShields(actor) {
  return [...actor.items].filter(i => i.type === "weapon" && i.system?.shieldAP != null && i.system?.equipped);
}

/**
 * Divine Shield: преобразить щит (+½Cor.b AP и Reinforced), разбить его,
 * чтобы проигнорировать попадание в закрытую часть тела, или вернуть исходную форму.
 */
export async function useDivineShield(actor) {
  if (!hasItemNamed(actor, "Divine Shield", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Божественный Щит.");
  const transformed = [...actor.items].find(i => i.getFlag?.(NS, DIVINE_SHIELD_FLAG));
  if (transformed) {
    const pick = await chooseOne("Божественный Щит", [
      { id: "shatter", label: "Разбить щит — полностью проигнорировать урон по закрытой щитом части тела" },
      { id: "revert", label: "Щит снят надолго — вернуть исходную форму" }
    ]);
    if (!pick) return "отмена";
    if (pick.id === "shatter") {
      const name = transformed.name;
      await transformed.delete();
      return void await infoCard(actor, "🛡️", "Божественный Щит", [
        `«${esc(name)}» разлетается во вспышке Варп-пламени: урон этого попадания проигнорирован полностью — не применяйте его.`
      ]);
    }
    const orig = transformed.getFlag(NS, DIVINE_SHIELD_FLAG) ?? {};
    await transformed.update({ "system.shieldAP": orig.ap ?? transformed.system.shieldAP, "system.weaponProps": orig.props ?? transformed.system.weaponProps });
    await transformed.unsetFlag(NS, DIVINE_SHIELD_FLAG);
    return void await infoCard(actor, "🛡️", "Божественный Щит", [`«${esc(transformed.name)}» вернулся к исходной форме.`]);
  }
  const shields = equippedShields(actor);
  if (!shields.length) return ui.notifications.warn("⚠️ Нет экипированного щита — Божественный Щит преображает щит в руке.");
  const pick = await chooseOne("Божественный Щит", shields.map(s => ({ id: s.id, label: s.name })));
  if (!pick) return "отмена";
  const shield = actor.items.get(pick.id);
  const add = divineShieldAP(actor);
  const props = foundry.utils.deepClone(shield.system.weaponProps ?? []);
  const hadReinforced = props.some(p => (p?.key ?? p) === "reinforced");
  await shield.setFlag(NS, DIVINE_SHIELD_FLAG, { ap: shield.system.shieldAP, props });
  await shield.update({
    "system.shieldAP": (Number(shield.system.shieldAP) || 0) + add,
    "system.weaponProps": hadReinforced ? props : [...props, { key: "reinforced" }]
  });
  await infoCard(actor, "🛡️", "Божественный Щит", [
    `Минута концентрации — «${esc(shield.name)}» перенимает дизайн лат: AP щита +${add} (½Cor.b), свойство Reinforced. Броненосец видит сквозь щит.`,
    "Пропустил попадание в закрытую щитом часть тела? Нажмите кнопку Таланта ещё раз — «Разбить щит»."
  ]);
}

/** Rider of Chaos: посвятить скакуна — Unnatural S/T (4), Natural Armour (8), +10 Ран. */
export async function dedicateChaosSteed(actor) {
  if (!hasItemNamed(actor, "Rider of Chaos", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Всадник Хаоса.");
  const steed = (await mountOf(actor)) ?? targetedActors()[0] ?? null;
  if (!steed || steed === actor) return ui.notifications.warn("⚠️ Сядьте на скакуна или выделите его целью.");
  if (!steed.isOwner) return ui.notifications.warn(`⚠️ Нет прав на «${steed.name}» — посвящение проводит ГМ или владелец скакуна.`);
  if (!(await confirmBox("Всадник Хаоса", `Восемь часов ритуала: посвятить <b>${esc(steed.name)}</b> себе на службу?`))) return "отмена";
  const docs = [];
  const got = [];
  for (const [uuid, char] of [[UNNATURAL_S4, "s"], [UNNATURAL_T4, "t"]]) {
    if (unnaturalRating(steed, char) >= 4) continue;
    const src = await fromUuid(uuid).catch(() => null);
    if (src) { docs.push(src.toObject()); got.push(src.name); }
  }
  const na = [...steed.items].find(i => i.type === "trait" && /natural armour/i.test(i.name));
  if (!na || (Number(na.system?.rating) || 0) < 8) {
    const src = await fromUuid(NATURAL_ARMOUR).catch(() => null);
    if (src) {
      const data = src.toObject();
      data.name = "Natural Armour / Естественная Броня (8)";
      data.system.rating = 8;
      if (data.system.effects) data.system.effects.armourAll = 8;
      if (na) await na.delete();
      docs.push(data); got.push(data.name);
    }
  }
  docs.push({
    name: "Посвящённый Скакун / Chaos Steed", type: "trait", img: "icons/svg/pawprint.svg",
    system: { description: `<p>Скакун ${esc(actor.name)} (Всадник Хаоса): латы вживлены в плоть, +10 Ран. Без контакта со своим всадником хотя бы раз в неделю мутации дестабилизируются и убивают скакуна.</p>` },
    flags: { [NS]: { riderOfChaos: actor.uuid } }
  });
  await steed.createEmbeddedDocuments("Item", docs);
  await steed.update({ "system.wounds.max": (Number(steed.system?.wounds?.max) || 0) + 10 });
  await infoCard(actor, "🐎", "Всадник Хаоса", [
    `${esc(steed.name)} мутирует под массивного Броненосца: ${got.length ? got.map(esc).join(", ") : "Трейты уже не ниже"}; +10 Ран.`,
    "Скакуну нужен контакт с всадником хотя бы раз в неделю — следит стол."
  ]);
}

/** Действующий рейтинг Unnatural Cor от Пожирателя Греха (эффект на акторе). */
function sinEaterEffect(actor) {
  return [...(actor.effects ?? [])].find(e => e.getFlag?.(NS, SIN_EATER_FLAG));
}

/** Sin Eater: убит чемпион Хаоса — Unnatural Cor +1, если его Cor выше рейтинга ×10. */
export async function useSinEater(actor) {
  if (!hasItemNamed(actor, "Sin Eater", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Пожиратель Греха.");
  const victim = targetedActors()[0];
  if (!victim || victim === actor) return ui.notifications.warn("⚠️ Выделите целью сражённого чемпиона Хаоса.");
  const eff = sinEaterEffect(actor);
  const rating = Number(eff?.getFlag(NS, SIN_EATER_FLAG)) || 0;
  const cor = Number(victim.system?.corruption?.value) || 0;
  const next = sinEaterNext(rating, cor);
  if (next === rating) {
    return void await infoCard(actor, "💀", "Пожиратель Греха", [
      `${esc(victim.name)}: Cor ${cor} не выше ${rating * 10} (рейтинг ${rating} ×10) — сила его души не прибавляется.`]);
  }
  const changes = [{ key: "system.corruptionBonus", type: "add", value: String(next), phase: expectedPhase("system.corruptionBonus"), priority: 0 }];
  if (eff) await eff.update({ "system.changes": changes, name: `Пожиратель Греха — Unnatural Cor (${next})`, [`flags.${NS}.${SIN_EATER_FLAG}`]: next });
  else await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: `Пожиратель Греха — Unnatural Cor (${next})`, img: "icons/svg/skull.svg",
    system: { changes }, flags: { [NS]: { [SIN_EATER_FLAG]: next } }
  }]);
  await infoCard(actor, "💀", "Пожиратель Греха", [
    `Душа ${esc(victim.name)} (Cor ${cor}) поглощена: Unnatural Cor ${rating} → <b>${next}</b> (+${next} к Cor.b, уже на листе).`]);
}
