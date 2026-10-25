// module/combat/sabotage.mjs
// ════════════════════════════════════════════════════════════════════════
//  САБОТАЖ / Sabotage (Талант Разбойника, стр. 62; задача Sahara 3-bfbf,
//  решения владельца 24.10.2026).
//
//  «Он может совершать ножом Избирательные атаки по оружию противника (обычно
//  –10 для тяжелого оружия, –20 для любых винтовок и рукопашного оружия с Хватом
//  П+Л, –30 для пистолетов и рукопашного оружия, и –40 для ножей и компактных
//  пистолетов). При попадании он Клинит (не Перегревает) стрелковое оружие или
//  отключает обратно высокотехнологичное рукопашное (его можно включить обратно
//  Расклином, как стрелковое). На комбинированном оружии он должен выбрать
//  саботировать либо все рукопашные профили, либо один из стрелковых. Он может
//  при этом оставить нож в оружии – пока нож не вынуть (полудействием), оружие
//  нельзя Расклинивать. Атаки по оружию с питанием по проводам, лентам, или
//  шлангам получают бонус +20, и после Расклина оружие нужно будет зарядить или
//  подсоединить к кабелю заново (как при Перезарядке). От таких атак можно
//  Избегать как обычно.»
//
//  ЧТО АВТОМАТИЗИРОВАНО
//  • Цель «Оружие цели: <имя>» в прицеле Избирательной атаки ножом (окно атаки,
//    по строке на экипированное оружие цели) с штрафом по КЛАССУ ЕГО оружия —
//    rules/rogue-talents.mjs::sabotagePenalty (Compact — установленная модификация).
//  • Бросок идёт как обычная Избирательная атака; урона существу НЕТ (удар по
//    оружию), Избегание цели — как обычно.
//  • После попадания (и неудачного Избегания цели) — кнопка «Саботаж» на карточке:
//    стрелковое оружие цели Клинит (system.jammed; Расклин — combat/clear-jam.mjs),
//    высокотехнологичное (электрическое, rules/null-zones.mjs::weaponTechClass)
//    рукопашное «отключается» тем же признаком system.jammed до Расклина; прочее
//    рукопашное эффекта не получает. У комбинированного оружия спрашивается, что
//    именно саботируется.
//
//  НЕ автоматизировано (решение владельца): «нож остаётся в оружии» (блок Расклина
//  до вынимания ножа) и питание проводами/лентами/шлангами (+20 к атаке и повторная
//  зарядка после Расклина) — стол. У комбинированного оружия Клин ложится на
//  ВЕСЬ предмет (флаг system.jammed один на оружие): выбор профиля определяет, есть
//  ли эффект, но не оставляет «чистыми» остальные стволы.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { relayItemUpdate } from "../helpers/utils.mjs";
import { sabotageEffectKind, sabotageProfileChoices } from "../rules/rogue-talents.mjs";

/** Кнопка на карточке попавшего Саботажа. */
export function sabotageButtonHtml({ actor, targetActor, weapon }) {
  if (!actor || !targetActor || !weapon) return "";
  return `
    <div class="roll-damage-section roll-sabotage">
      <div class="roll-damage-label">Саботаж (Талант)</div>
      <button class="wh-sabotage-btn" type="button"
        data-attacker-uuid="${esc(actor.uuid ?? "")}" data-target-uuid="${esc(targetActor.uuid ?? "")}"
        data-weapon-uuid="${esc(weapon.uuid ?? "")}"
        title="Нажмите, если цель не Избежала удара: стрелковое оружие цели Клинит, высокотехнологичное рукопашное отключается до Расклина.">
        ${rollIcon("sword")}Испортить «${esc(weapon.name)}» (Клин / отключение)
      </button>
    </div>`;
}

/** Диалог выбора профиля комбинированного оружия; null — окно закрыто. */
async function askProfile(weapon, choices) {
  const key = await foundry.applications.api.DialogV2.wait({
    window: { title: `Саботаж — ${weapon.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<p style="padding:4px 6px;">Комбинированное оружие: что саботировать — все рукопашные профили или один из стрелковых?</p>`,
    rejectClose: false,
    buttons: choices.map((c, i) => ({ action: c.key, label: c.label, default: i === 0, callback: () => c.key }))
  });
  return choices.find(c => c.key === key) ?? null;
}

/**
 * Испортить оружие цели после попавшего Саботажа.
 * @returns {Promise<boolean>} true — действие состоялось (карточка гасится)
 */
export async function applySabotage(attacker, weapon, { ask = askProfile } = {}) {
  if (!attacker || !weapon) return false;
  const owner = weapon.parent ?? weapon.actor ?? null;
  let kind = sabotageEffectKind(weapon);
  let profileLabel = "";
  const choices = sabotageProfileChoices(weapon);
  if (choices.length > 1) {
    const picked = await ask(weapon, choices);
    if (!picked) return false;
    kind = picked.kind;
    profileLabel = picked.label;
  }
  if (kind === "none") {
    await postTestCard(attacker, {
      icon: rollIcon("sword", "#e08a3a"), title: `Саботаж — ${esc(weapon.name)}`,
      sections: [`<div class="roll-threshold">Удар попал, но ${profileLabel ? `«${esc(profileLabel)}» — ` : ""}это обычное оружие: Клинить нечего, отключать нечем. Эффекта нет.</div>`]
    }, { sound: false });
    return true;
  }
  // Чужое оружие пишет ГМ через сокет; Мастера нет — relayItemUpdate предупредит, а карточку не гасим.
  if (!weapon.isOwner && !game.users?.activeGM) {
    ui.notifications?.warn("Саботаж не применён: оружие не ваше, а Мастера нет в игре — записать Клин некому.");
    return false;
  }
  await relayItemUpdate(weapon, { "system.jammed": true });
  const what = kind === "disable"
    ? `высокотехнологичное оружие <b>отключено</b> (Расклин включит его обратно, как стрелковое)`
    : `оружие <b>заклинило</b> (Клин, не Перегрев; снимается Расклином)`;
  await postTestCard(attacker, {
    icon: rollIcon("sword", "#e08a3a"), title: `Саботаж — ${esc(weapon.name)}`,
    sections: [
      `<div class="roll-threshold">${esc(owner?.name ?? "Цель")}: ${what}${profileLabel ? ` — «${esc(profileLabel)}»` : ""}.</div>`,
      `<div class="roll-threshold" style="font-size:0.85em;">Вручную: оставил ли нож в оружии (тогда Расклин невозможен, пока нож не вынут полудействием) и питание проводами/лентами/шлангами (+20 к атаке, после Расклина заряжать заново).</div>`
    ]
  }, { sound: false });
  return true;
}
