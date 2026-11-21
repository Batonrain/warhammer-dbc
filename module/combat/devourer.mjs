// module/combat/devourer.mjs
// ════════════════════════════════════════════════════════════════════════
//  Поглотитель / Devourer (Чемпион-Терминатор).
//   • «Совершая Напролом, может проноситься сквозь укреплённые стены и
//     игнорирует Трудный Ландшафт» — успешный Напролом ставит метку
//     DEVOURER_RAM_FLAG и переключает токен на своё действие движения ядра
//     «Таран» (стены не блокируют, ландшафт сложности 1). Метка и действие
//     снимаются после первого же своего сдвига токена.
//   • «Противники, которых сбил с ног Напролом или Повалить, получают урон
//     этим оружием вместо обычного урона от приёма» — секция урона оружием
//     Rng 0–1 с кнопкой «Применить урон» (devourerDamageSection).
//   • +1 Размер в Борьбе — rules/terminator-talents.mjs::devourerGrappleSize.
// ════════════════════════════════════════════════════════════════════════

import { esc, resolveCharFormula } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { resolveWeaponProps, aggregateAuto } from "./weapon-properties.mjs";
import { meleeStrengthBonus } from "./attack-outcome.mjs";
import {
  hasDevourer, devourerWeapon, devourerRamming, DEVOURER_RAM_FLAG, DEVOURER_RAM_ACTION
} from "../rules/terminator-talents.mjs";

const NS = "warhammer-dbc";

/** Действие движения «Таран»: только у Поглотителя с меткой Напролома. */
export function registerDevourerMovementAction() {
  const actions = globalThis.CONFIG?.Token?.movement?.actions;
  if (!actions || actions[DEVOURER_RAM_ACTION]) return;
  actions[DEVOURER_RAM_ACTION] = {
    label: "Таран (Поглотитель)",
    icon: "fa-solid fa-person-falling-burst",
    order: 90,
    walls: null,
    deriveTerrainDifficulty: () => 1,
    canSelect: token => {
      const actor = token?.actor ?? token?.document?.actor;
      return hasDevourer(actor) && devourerRamming(actor);
    }
  };
}

/** Успешный Напролом Поглотителя: метка и переключение токена на «Таран». */
export async function startDevourerRam(actor) {
  if (!hasDevourer(actor)) return "";
  await actor.setFlag(NS, DEVOURER_RAM_FLAG, true);
  const tokenDoc = actor.getActiveTokens?.(true)?.[0]?.document ?? null;
  if (tokenDoc && globalThis.CONFIG?.Token?.movement?.actions?.[DEVOURER_RAM_ACTION]) {
    await tokenDoc.update({ movementAction: DEVOURER_RAM_ACTION }).catch(() => null);
  }
  return "Поглотитель: проход Напролом идёт сквозь укреплённые стены и без Трудного Ландшафта (действие движения «Таран»).";
}

/** Сдвиг токена Поглотителя завершён — метка и «Таран» снимаются. */
export async function endDevourerRam(tokenDoc) {
  const actor = tokenDoc?.actor;
  if (!devourerRamming(actor)) return;
  await actor.unsetFlag(NS, DEVOURER_RAM_FLAG);
  if (tokenDoc.movementAction === DEVOURER_RAM_ACTION) await tokenDoc.update({ movementAction: "walk" }).catch(() => null);
}

/**
 * Урон оружием Поглотителя вместо урона приёма (Напролом/Повалить): формула
 * оружия + S.b (Могучее/Сдержанное учтены), Pen оружия, кнопка «Применить».
 * "" — у актора нет Таланта или подходящего оружия.
 */
export async function devourerDamageSection(actor, target, technique) {
  const weapon = devourerWeapon(actor);
  if (!weapon) return "";
  const sys = weapon.system ?? {};
  const base = resolveCharFormula(sys.damage || "0", actor.system?.characteristics, actor.system?.corruptionBonus ?? 0);
  const wp = aggregateAuto(resolveWeaponProps(weapon));
  const sb = meleeStrengthBonus({ sb: Number(actor.system?.characteristics?.s?.bonus) || 0, wp });
  const roll = await new Roll(sb ? `${base} + ${sb}` : base).evaluate();
  const pen = Number(sys.penetration) || 0;
  return `<div class="roll-damage-section">
      <div class="roll-damage-label">${rollIcon("blood", "#ff6b6b")}Поглотитель (${esc(technique)}): ${esc(weapon.name)} — ${esc(base)}${sb ? ` + S.b ${sb}` : ""}, Pen ${pen} — <b>${roll.total}</b></div>
      <button class="wh-apply-dmg-btn" type="button"
        data-damage="${roll.total}" data-penetration="${pen}" data-damage-type="${esc(sys.damageType || "impact")}" data-damage-subtype=""
        data-hit-location="Торс" data-weapon-name="${esc(weapon.name)} (Поглотитель)" data-attacker="${esc(actor.name)}"
        data-felling="0" data-primitive="0" data-ignore-shield="0" data-warp-soak="0" data-melee="1">
        Применить ${roll.total} урона${target ? ` — ${esc(target.name)}` : ""}
      </button>
      <div class="roll-threshold" style="font-size:0.85em;opacity:0.8;">Вместо обычного урона приёма.</div>
    </div>`;
}
