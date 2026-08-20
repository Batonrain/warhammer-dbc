// module/apps/minion-talent.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Покупка Таланта «Миньон Хаоса» (корбук стр. 111).
//
//  Талант один, а Миньонов, которых он даёт, — двадцать разных: четыре группы
//  на пять уровней силы. Уровень Таланта, требования к Хозяину и, значит,
//  цена зависят от выбранной пары, поэтому пара спрашивается ПРИ ПОКУПКЕ, а не
//  вписывается потом руками: купленный «просто Миньон» не сказал бы ни во
//  сколько он обошёлся, ни кого по нему создавать.
//
//  Выбор ложится в два места. В system.specialization — для глаз: там он виден
//  в списке Талантов на листе. В флаг warhammer-dbc.minionSlot — для машины: по
//  нему считаются слоты в блоке СОЦИУМа и предлагается генератор.
//
//  Тот же приём, что у Mastery и Beyond Human (promptDynamicAptTalent рядом):
//  Талант, у которого цена зависит от выбора, спрашивает выбор до оплаты.
// ════════════════════════════════════════════════════════════════════════════

import { MINION_GROUPS, MINION_TIERS, MINION_TIER_ORDER,
         MINION_TALENT_FLAG } from "../constants/minions.mjs";
import { talentRequirements } from "../rules/minion-build.mjs";
import { esc } from "../helpers/utils.mjs";

/** Подпись пары для списка Талантов: «Демон, Высший». */
export function minionSlotLabel(group, tier) {
  const g = MINION_GROUPS[group]?.label || "?";
  const t = MINION_TIERS[tier]?.label   || "?";
  return `${g}, ${t}`;
}

/**
 * Диалог выбора группы и силы. Возвращает { group, tier, talentTier, label } или
 * null, если покупку отменили.
 *
 * Требования показываются рядом с выбором и не запирают кнопку: книга даёт ГМу
 * право разрешить исключение, а система в таких местах предупреждает, но не
 * запрещает.
 */
export function promptMinionSlot(actor, doc) {
  const groupRows = Object.entries(MINION_GROUPS)
    .map(([key, def]) => `<option value="${key}">${esc(def.label)}</option>`).join("");
  const tierRows = MINION_TIER_ORDER
    .map(key => `<option value="${key}">${esc(MINION_TIERS[key].label)}</option>`).join("");

  return new Promise(resolve => {
    new Dialog({
      title: `${doc?.name || "Миньон Хаоса"}: какой Миньон`,
      content: `
        <form class="wh-minion-slot">
          <p class="dyn-hint">Талант берётся отдельно на каждого слугу (стр. 111). Группа задаёт
             Характеристику Хозяина, от которой идут Лояльность и максимум Миньонов, а сила —
             уровень Таланта, бюджеты создания и Редкость снаряжения.</p>
          <div class="atk-dlg-row">
            <label>Группа:</label>
            <select id="minion-group" class="pm-input pm-wide">${groupRows}</select>
          </div>
          <div class="atk-dlg-row">
            <label>Сила:</label>
            <select id="minion-tier" class="pm-input pm-wide">${tierRows}</select>
          </div>
          <div class="minion-slot-preview" id="minion-slot-preview"></div>
        </form>`,
      buttons: {
        ok: {
          label: "Купить",
          callback: html => {
            const group = String(html.find("#minion-group").val() || "");
            const tier  = String(html.find("#minion-tier").val()  || "");
            if (!MINION_GROUPS[group] || !MINION_TIERS[tier]) return resolve(null);
            resolve({
              group, tier,
              talentTier: MINION_TIERS[tier].talentTier,
              label: minionSlotLabel(group, tier)
            });
          }
        },
        cancel: { label: "Отмена", callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null),
      render: html => {
        const upd = () => {
          const group = String(html.find("#minion-group").val() || "");
          const tier  = String(html.find("#minion-tier").val()  || "");
          const def   = MINION_TIERS[tier];
          const req   = talentRequirements(actor, group, tier);
          const miss  = req.missing?.length
            ? `<div class="minion-slot-miss">Не хватает: ${esc(req.missing.join("; "))}</div>`
            : `<div class="minion-slot-ok">Требования выполнены</div>`;
          html.find("#minion-slot-preview").html(`
            <div class="minion-slot-line">Уровень Таланта: <b>${def?.talentTier ?? "?"}</b>
              · Требование: <b>${esc(req.skillNote || "")}</b></div>
            <div class="minion-slot-line">${esc(MINION_GROUPS[group]?.hint || "")}</div>
            ${miss}`);
        };
        html.find("#minion-group, #minion-tier").on("change", upd);
        upd();
      }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-minion-slot-dialog"], width: 480 }).render(true);
  });
}

/**
 * Записать выбор в копию предмета перед созданием на листе. Уровень Таланта
 * подменяется выбранным: цена считается по нему, а не по единице из пака.
 */
export function applyMinionSlot(obj, pick) {
  obj.system = obj.system || {};
  obj.system.specialization = pick.label;
  obj.system.tier = pick.talentTier;
  obj.flags = obj.flags || {};
  obj.flags["warhammer-dbc"] = {
    ...(obj.flags["warhammer-dbc"] || {}),
    [MINION_TALENT_FLAG]: { group: pick.group, tier: pick.tier }
  };
  return obj;
}
