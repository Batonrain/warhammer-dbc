// module/combat/draw-action.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Взять» (стр. 27): Полудействие, Физическое. Персонаж берёт в руки оружие
//  или предмет с разгрузки/кобуры/подсумка/ножен/магнитного замка. В движке
//  это НЕ отдельная кнопка/диалог — предмет СЧИТАЕТСЯ взятым, как только
//  становится equipped=true (переход false→true списывает 1 ОД, физическое —
//  см. sheets/tabs/gear.mjs::equipItem, единственный путь смены equipped на
//  листе). Взять предмет с земли или стола не моделируется (в системе нет
//  отдельных «предметов на сцене») — честно объявленная урезка книжного текста.
//
//  Тем же действием можно ВМЕСТО обычного взятия сорвать чеку с ОДНОЙ гранаты
//  прямо на своей разгрузке и детонировать её на месте — этому случаю нужна
//  отдельная функция ниже (не просто equipped=true): «это не считается как
//  атака, и персонаж не может Избегать от этого взрыва». В движке это значит
//  буквально — здесь нет броска атаки и нет предложения Уклонения/Парирования
//  вовсе (в отличие от обычного брошенного оружия, где Уклонение — Реакция
//  ЦЕЛИ на чужой бросок атаки; раз броска атаки нет, предлагать её неоткуда).
//
//  Тот же расчёт урона/шаблона/кнопки применения (resolveGrenadeSelfDamage
//  ниже) переиспользует и Критический Промах рукопашной атаки гранатой
//  (стр. 40, wdbc-x1nz.2.59, module/combat/attack.mjs) — там гранату роняет
//  не решение игрока, а сам провал броска, поэтому ОД за это не берётся.
//
//  Кнопки чата — «Разместить шаблон» (.wh-place-template-btn) и «Применить
//  урон» (.wh-apply-dmg-btn) — переиспользуют уже готовые делегированные
//  обработчики hooks.mjs (те же классы, что у обычной атаки Взрывным оружием,
//  combat/attack-card.mjs::applyDamageSection) — второй копии этой machinery
//  здесь нет, только сборка тех же data-* атрибутов для гранаты без броска
//  атаки. rollExtremeDamage — тот же общий расчёт Экстремального урона/Крит.
//  эффекта, что у обычного броска (combat/attack.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { spendActionPoints } from "./action-economy.mjs";
import { resolveWeaponProps, aggregateAuto } from "./weapon-properties.mjs";
import { rollExtremeDamage } from "./attack.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

/**
 * Общее ядро «граната взрывается прямо на/у стрелка»: один бросок урона,
 * шаблон/кнопка применения, расход гранаты (Количество −1, либо удаление
 * предмета). Общее между «Вырвать чеку» (стр. 27, решение игрока, 1 ОД) и
 * Критическим Промахом рукопашной атаки гранатой (стр. 40, не решение
 * игрока — ОД не берётся, см. combat/attack.mjs).
 * @param {Actor} actor
 * @param {Item}  item
 * @param {{title:string, warnLine:string, sound?:boolean}} card
 */
async function resolveGrenadeSelfDamage(actor, item, { title, warnLine, sound = true }) {
  const wp = aggregateAuto(resolveWeaponProps(item));
  const damageType = item.system.damageType || "impact";
  const damageSubtype = item.system.damageSubtype || "";
  const pen = Number(item.system.penetration) || 0;
  const hitLocation = "Торс";
  const weaponName = esc(item.name);
  const actorName = esc(actor.name);

  const dmgRoll = await new Roll(item.system.damage || "0").evaluate();
  const { hasExtreme, extremeLevel, critEffect, exRoll } = await rollExtremeDamage(dmgRoll, {
    wp, damageType, hitLocation, attacker: actor
  });
  const rolls = exRoll ? [dmgRoll, exRoll] : [dmgRoll];

  const templateBtn = wp.blastRating > 0 ? `
    <button class="wh-place-template-btn" type="button"
      data-shape="circle" data-meters="${wp.blastRating}"
      data-weapon-name="${weaponName}" data-attacker-uuid="${actor.uuid}" data-item-uuid="${item.uuid}">
      🎯 Разместить шаблон и отметить цели
    </button>` : "";

  const dmgBtn = `
    <button class="wh-apply-dmg-btn" type="button"
      data-damage="${dmgRoll.total}" data-penetration="${pen}"
      data-damage-type="${damageType}" data-damage-subtype="${damageSubtype}"
      data-hit-location="${hitLocation}" data-weapon-name="${weaponName}"
      data-weapon-uuid="${item.uuid}" data-attacker="${actorName}" data-attacker-uuid="${actor.uuid}"
      data-felling="${wp.fellingRating ?? 0}" data-primitive="${wp.primitive ? 1 : 0}"
      data-ignore-shield="${wp.ignoreShield ? 1 : 0}" data-warp-soak="${wp.warpSoak ? 1 : 0}"
      data-lance="${wp.lance ? 1 : 0}" data-sanctified="${wp.sanctified ? 1 : 0}"
      data-blast="${wp.blastRating ?? 0}" data-flame="${wp.flame ? 1 : 0}"
      data-power-field="${wp.powerField ? 1 : 0}" data-spray="0"
      data-devastating="${wp.devastatingRating ?? 0}" data-weapon-range="0"
      data-melee="0" data-burst="0"
      data-corrosive="${wp.corrosiveRating ?? 0}" data-entropy="0" data-touch-of-pain="0"
      data-crippling="${wp.cripplingRating ?? 0}" data-piercing="${wp.piercing ? 1 : 0}"
      data-haywire="${wp.haywire ? (wp.haywireRating ?? 0) : ""}" data-haywire-dmg2="${wp.haywireDamage2 || ""}"
      data-through-shot="0" data-has-extreme="${hasExtreme ? 1 : 0}">
      Применить урон: <b>${dmgRoll.total}</b> → ${hitLocation}${wp.blastRating > 0
        ? ` <span class="roll-hit-extra">(отметьте всех в радиусе ${wp.blastRating}м — «Всем»)</span>` : ""}
    </button>`;

  const critHtml = critEffect ? `<div class="roll-crit-effect">${critEffect}</div>` : "";
  const dice = await dmgRoll.render();

  await postTestCard(actor, {
    icon: rollIcon("burst", "#ff8a4d"),
    title,
    lines: [
      `<div class="roll-threshold" style="color:#ffb86b;">⚠️ ${warnLine}</div>`,
      `<div class="roll-threshold">Урон ${dmgRoll.total} ${damageType} Pen ${pen}${hasExtreme ? `, Экстремальный d5: ${extremeLevel}` : ""}</div>`,
      critHtml
    ],
    sections: [
      `<div class="roll-apply-dmg-section">${templateBtn}${dmgBtn}</div>`,
      `<details class="roll-dice-details"><summary>${rollIcon("chart", "#8fd0ff")}Показать кубы</summary>${dice}</details>`
    ]
  }, { rolls, sound });

  const qty = Number(item.system?.quantity) || 1;
  if (qty > 1) await item.update({ "system.quantity": qty - 1 });
  else await item.delete();
}

/**
 * Сорвать чеку с гранаты на своей разгрузке и детонировать её на месте
 * (стр. 27): Полудействие, не атака, Уклонения нет. Один бросок урона,
 * дальше — общие кнопки места/применения урона (см. заголовок файла).
 * Граната расходуется как боеприпас (Количество −1, либо удаление предмета).
 */
export async function useDetonateGrenadeInRig(actor, item) {
  if (!actor || !item || item.type !== "weapon" || item.system?.weaponType !== "grenade") return;
  if (!await spendActionPoints(actor, 1, { physical: true })) {
    return ui.notifications.warn("⚠️ Не хватает ОД, чтобы вырвать чеку.");
  }
  await resolveGrenadeSelfDamage(actor, item, {
    title: `${esc(actor.name)} — Вырвать чеку: ${item.name}`,
    warnLine: "Не считается атакой — Уклонение недоступно (стр. 27). Полудействие."
  });
}

/**
 * Критический Промах рукопашной атаки гранатой (стр. 40, wdbc-x1nz.2.59):
 * «граната падает персонажу под ноги и взрывается» — тот же расчёт урона и
 * те же кнопки, что у «Вырвать чеку», но без цены ОД (действие уже оплачено
 * самой атакой) и с другой карточкой. Вызывается из combat/attack.mjs.
 */
export async function resolveGrenadeMeleeFumble(actor, item) {
  if (!actor || !item) return;
  await resolveGrenadeSelfDamage(actor, item, {
    title: `${esc(actor.name)} — Критический Промах: граната падает под ноги!`,
    warnLine: "Граната не долетела до цели — упала под ноги атакующему и взорвалась (стр. 40)."
  });
}
