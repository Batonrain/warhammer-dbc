// module/combat/obliterator-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Кнопки Черты и Талантов Облитератора (правила — rules/obliterator-talents.mjs).
//  Живой Арсенал — ассимиляция оружия; Пожиратель Пуль — магазин
//  спецбоеприпаса за Очко Бесчестия; Расчленитель — режим ближнего боя;
//  Самоперековывание — поглощение брони; Измельчитель — попадание по всем в
//  3 м; До Зубов — наплечное оружие.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { hasItemNamed } from "../rules/req-atom.mjs";
import { changeActorInfamy, actorInfamyValue } from "../apps/infamy-points.mjs";
import { activateItemUntil, deactivateItem } from "../apps/item-activation.mjs";
import { activationState } from "../rules/item-activation.mjs";
import { boonString, boonNow } from "../rules/astartes-elite-common.mjs";
import {
  ARSENAL_FLAG, SHOULDER_FLAG, assimilable, livingArsenalWeapon, shoulderSlotsLeft, isShoulderWeapon, shredderHordeHits
} from "../rules/obliterator-talents.mjs";
import {
  chooseOne, infoCard, payActions, tokensAround, setTargets, applyDamageButton
} from "./astartes-elite-ui.mjs";

const NS = "warhammer-dbc";

/** Living Arsenal / Живой Арсенал: полное действие — ассимилировать оружие из инвентаря касанием. */
export async function useLivingArsenal(actor) {
  if (!hasItemNamed(actor, "Living Arsenal", ["trait"])) return ui.notifications.warn("⚠️ У актора нет Черты Живой Арсенал.") && "нет Черты";
  const list = actor.items.filter(i => assimilable(i) && !i.getFlag(NS, ARSENAL_FLAG));
  if (!list.length) return ui.notifications.warn("⚠️ Нечего ассимилировать: положите оружие в инвентарь (гранаты, ракеты, Демоническое, Руническое, Наследие и психосиловое — нельзя).") && "нет предметов";
  const pick = await chooseOne("Живой Арсенал", list.map(i => ({ id: i.id, label: i.name })),
    { prompt: "Какое оружие ассимилировать? (технологии Орков и Некронов — нельзя, проверяет стол)" });
  if (!pick) return "отмена";
  if (!(await payActions(actor, 2, "Живой Арсенал"))) return "нет ОД";
  const item = actor.items.get(pick.id);
  await item.update({ [`flags.${NS}.${ARSENAL_FLAG}`]: true, "system.equipped": true });
  await infoCard(actor, "🦾", "Живой Арсенал: ассимиляция", [
    `<b>${esc(item.name)}</b> поглощено: Облитератор знает, как оно работает, и формирует его из тела.`,
    "Никогда не Заклинивает и не Перегревается (Крит. Провал — просто промах), стандартный боеприпас не тратится; винтовка и тяжёлое — одной рукой без штрафа.",
    "Пистолет/винтовку можно сформировать парой на одной руке со свойством Twin-Linked — добавьте свойство на оружие."
  ]);
  return undefined;
}

/** Bullet Eater / Пожиратель Пуль: Очко Бесчестия — полный магазин спецбоеприпасом. */
export async function useBulletEater(actor) {
  if (!hasItemNamed(actor, "Bullet Eater", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Пожиратель Пуль.") && "нет Таланта";
  const ammo = actor.items.filter(i => i.type === "ammo" && !/inferno|инферно/i.test(i.name));
  if (!ammo.length) return ui.notifications.warn("⚠️ Нет поглощённых спецбоеприпасов (мистические вроде Инферно-болтов размножать нельзя).") && "нет боеприпаса";
  const guns = actor.items.filter(i => i.type === "weapon" && (Number(i.system?.magazineMax) || 0) > 0);
  if (!guns.length) return ui.notifications.warn("⚠️ Нет оружия с магазином.") && "нет оружия";
  const a = await chooseOne("Пожиратель Пуль", ammo.map(i => ({ id: i.id, label: i.name })), { prompt: "Какой боеприпас размножить?" });
  if (!a) return "отмена";
  const g = await chooseOne("Пожиратель Пуль", guns.map(i => ({ id: i.id, label: `${i.name} (${i.system.magazineCur}/${i.system.magazineMax})` })), { prompt: "В какое оружие?" });
  if (!g) return "отмена";
  if (actorInfamyValue(actor) <= 0) return ui.notifications.warn("⚠️ Нет Очков Бесчестия.") && "нет Очков";
  await changeActorInfamy(actor, -1);
  const gun = actor.items.get(g.id);
  const am = actor.items.get(a.id);
  await gun.update({ "system.magazineCur": Number(gun.system.magazineMax) || 0, "system.loadedAmmoId": am.id });
  await infoCard(actor, "🔩", "Пожиратель Пуль", [
    `Очко Бесчестия потрачено: <b>${esc(gun.name)}</b> заряжено полным магазином (${gun.system.magazineMax}) — ${esc(am.name)}.`,
    "Сменить боеприпас в оружии — как селектором патронов (поле «Заряженный боеприпас» на оружии)."
  ]);
  return undefined;
}

/** Mutilator / Расчленитель: полудействие — включить или выключить режим ближнего боя. */
export async function useMutilator(actor, item) {
  if (!hasItemNamed(actor, "Mutilator", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Расчленитель.") && "нет Таланта";
  if (!(await payActions(actor, 1, "Расчленитель"))) return "нет ОД";
  if (activationState(item)) {
    await deactivateItem(item, { silent: true });
    await infoCard(actor, "🪚", "Расчленитель", ["Режим ближнего боя выключен: Auto-Stabilized и ограничения Бега/Натиска вернулись, перебросов нет."]);
    return undefined;
  }
  return activateItemUntil(item, { label: "Расчленитель: режим ближнего боя",
    text: "Auto-Stabilized потерян, Бег и скорость Натиска без ограничений. Успешные тесты BS и проваленные WS перебрасываются (строки переброса в окне броска)." });
}

/** Self-Forging / Самоперековывание: поглотить броню (5 минут). */
export async function useSelfForging(actor) {
  if (!hasItemNamed(actor, "Self-Forging", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Самоперековывание.") && "нет Таланта";
  const list = actor.items.filter(i => i.type === "armor" && !i.getFlag(NS, ARSENAL_FLAG));
  if (!list.length) return ui.notifications.warn("⚠️ Нет брони в инвентаре.") && "нет брони";
  const pick = await chooseOne("Самоперековывание", list.map(i => ({ id: i.id, label: i.name })), { prompt: "Какую броню поглотить? (5 минут)" });
  if (!pick) return "отмена";
  const armor = actor.items.get(pick.id);
  await armor.setFlag(NS, ARSENAL_FLAG, true);
  const terminator = /terminator|терминатор/i.test(armor.name);
  await infoCard(actor, "🛠️", "Самоперековывание", [
    `<b>${esc(armor.name)}</b> поглощена (5 минут): модификации и системы этой брони (кроме ранцевых) отращиваются за полудействие каждая.`,
    terminator ? "Терминаторская броня: Облитератор получает её сверхброню и силовой щит — отметьте их на листе." : ""
  ]);
  return undefined;
}

/** Shredder / Измельчитель: полное действие — 1 попадание ассимилированным пистолетом по каждому в 3 м. */
export async function useShredder(actor) {
  if (!hasItemNamed(actor, "Shredder", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Измельчитель.") && "нет Таланта";
  const pistols = actor.items.filter(i => i.type === "weapon" && i.system?.weaponClass === "pistol" && livingArsenalWeapon(actor, i));
  if (!pistols.length) return ui.notifications.warn("⚠️ Нет ассимилированных пистолетов (Живой Арсенал).") && "нет пистолетов";
  const pick = await chooseOne("Измельчитель", pistols.map(i => ({ id: i.id, label: i.name })), { prompt: "Какие пистолеты отрастить?" });
  if (!pick) return "отмена";
  const gun = actor.items.get(pick.id);
  const all = tokensAround(actor, 3);
  if (!all.length) return ui.notifications.warn("⚠️ В 3 м никого нет.") && "нет целей";
  if (!(await payActions(actor, 2, "Измельчитель"))) return "нет ОД";
  setTargets(all);
  const formula = String(gun.system?.damage || "1d10");
  const pen = Number(gun.system?.penetration) || 0;
  const rolls = [];
  const btns = [];
  for (const t of all) {
    const horde = t.actor?.type === "horde";
    const hits = horde ? shredderHordeHits(t.actor.system?.magnitude?.value) : 1;
    for (let h = 0; h < hits; h++) {
      const roll = await new Roll(formula).evaluate();
      rolls.push(roll);
      btns.push(applyDamageButton({ damage: roll.total, pen, type: gun.system?.damageType || "impact", label: gun.name,
        attacker: actor, forceTarget: t.actor?.uuid ?? "",
        text: `${esc(t.name)}${hits > 1 ? ` (${h + 1}/${hits})` : ""}: ${roll.total}, Pen ${pen}` }));
    }
  }
  await infoCard(actor, "🌀", "Измельчитель", [
    `Десятки стволов (${esc(gun.name)}, ${esc(formula)}): по 1 попаданию каждому в 3 м, в т.ч. союзникам; Орды — 1 за полные 5 Магнитуды (не больше 6).`
  ], { rolls, sections: btns.length ? [btns.join("")] : [] });
  return undefined;
}

/** To the Teeth / До Зубов: полудействие + Очко Бесчестия — винтовка или пистолет наплечным оружием до конца боя/сцены. */
export async function useToTheTeeth(actor) {
  if (!hasItemNamed(actor, "To the Teeth", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта До Зубов.") && "нет Таланта";
  const list = actor.items.filter(i => i.type === "weapon" && ["pistol", "basic"].includes(i.system?.weaponClass));
  if (!list.length) return ui.notifications.warn("⚠️ Нет винтовок и пистолетов.") && "нет оружия";
  const free = shoulderSlotsLeft(actor);
  const pick = await chooseOne("До Зубов", list.map(i => ({ id: i.id, label: `${i.name}${isShoulderWeapon(i) ? " — уже на плече (снять)" : ""}` })),
    { prompt: `Наплечное оружие (свободно мест: ${free} из 2). Менять отращённое — без Очка Бесчестия.` });
  if (!pick) return "отмена";
  const gun = actor.items.get(pick.id);
  if (isShoulderWeapon(gun)) {
    await gun.unsetFlag(NS, SHOULDER_FLAG);
    return void await infoCard(actor, "🦾", "До Зубов", [`${esc(gun.name)} убрано с плеча.`]);
  }
  if (free <= 0) return ui.notifications.warn("⚠️ Уже два наплечных оружия — сначала уберите одно.") && "нет места";
  if (!(await payActions(actor, 1, "До Зубов"))) return "нет ОД";
  // Очко Бесчестия — только за первое отращивание в этом бою/сцене (дальше «меняет как обычно»).
  const paidKey = "toTheTeethPaid";
  const now = boonNow(actor);
  const paidStr = actor.getFlag(NS, paidKey);
  const alreadyPaid = paidStr && paidStr === boonString({ combatId: now.combatId, sceneId: now.sceneId });
  if (!alreadyPaid) {
    if (actorInfamyValue(actor) <= 0) return ui.notifications.warn("⚠️ Нет Очков Бесчестия.") && "нет Очков";
    await changeActorInfamy(actor, -1);
    await actor.setFlag(NS, paidKey, boonString({ combatId: now.combatId, sceneId: now.sceneId }));
  }
  await gun.update({ [`flags.${NS}.${SHOULDER_FLAG}`]: boonString({ combatId: now.combatId, sceneId: now.sceneId }), "system.equipped": true });
  await infoCard(actor, "🦾", "До Зубов", [
    `${esc(gun.name)} отращено наплечным оружием до конца ${now.combatId ? "боя" : "сцены"} — рук не занимает.${alreadyPaid ? "" : " Очко Бесчестия потрачено."}`
  ]);
  return undefined;
}

