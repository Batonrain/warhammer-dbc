// module/sheets/tabs/combat.mjs
//
// Вкладка БОЙ: стойка, приёмы рукопашной, кнопка атаки у оружия, лечение и
// Очки Боли Друкхари. Сами расчёты живут по своим модулям (attack-dialog.mjs,
// combat/techniques.mjs, healing.mjs, pain.mjs) — здесь только их кнопки.
//
// Функции принимают актора, а не лист. Свёртка «Стойки» и «Приёмов» осталась на
// листе: это состояние окна, а не актора.

import { MELEE_STANCES, MELEE_TECHNIQUES } from "../../constants/combat.mjs";
import { showAttackDialog, showAttackDialogWithTechnique,
         showAttackDialogNoWeapon } from "../attack-dialog.mjs";
import { _showContestDialog } from "../../combat/techniques.mjs";
import { beginTargeting } from "../../combat/aim.mjs";
import { showHealingDialog } from "./healing.mjs";
import { painChange, openPainSoulBurnDialog } from "./pain.mjs";
import { on } from "../../helpers/utils.mjs";

export function activateCombatListeners(root, actor) {

  on(root, ".weapon-attack-roll", "click", ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (!item) return;
    // Стрельба по клику: у стрелкового/метательного оружия без уже выбранной
    // цели — сперва прицеливание перекрестием, диалог откроется по выбору цели.
    // Ближний бой и уже назначенная цель — сразу диалог (прежнее поведение).
    const isRanged = item.system?.weaponClass && item.system.weaponClass !== "melee";
    const hasTarget = (game.user?.targets?.size ?? 0) > 0;
    if (isRanged && !hasTarget && canvas?.ready) {
      beginTargeting(actor, item, () => showAttackDialog(actor, item));
    } else {
      showAttackDialog(actor, item);
    }
  });

  // ── Лечение и Очки Боли ──────────────────────────────────────────────────
  on(root, ".wounds-heal-btn", "click", () => showHealingDialog(actor));

  on(root, ".pain-absorb-btn", "click", () => painChange(actor, +1, "absorb"));
  on(root, ".pain-spend-btn", "click", () => painChange(actor, -1, "spend"));
  on(root, ".pain-soulburn-btn", "click", () => openPainSoulBurnDialog(actor));

  // ── Стойка ───────────────────────────────────────────────────────────────
  on(root, ".stance-radio", "change", ev => {
    actor.update({ "system.meleeStance": ev.currentTarget.value });
  });

  // ── Приёмы ───────────────────────────────────────────────────────────────
  on(root, ".technique-btn", "click", ev => {
    const tech    = ev.currentTarget.dataset.technique;
    const techDef = MELEE_TECHNIQUES[tech];
    if (!techDef) return;

    const meleeItem = actor.items.find(i =>
      i.type === "weapon" && i.system.equipped &&
      (i.system.weaponClass === "melee" || i.system.weaponClass === "thrown")
    );
    const stance    = actor.system.meleeStance || "standard";
    const stanceDef = MELEE_STANCES[stance];

    if (tech === "knockdown" || tech === "feint" || tech === "press") {
      _showContestDialog(actor, techDef);
    } else if (meleeItem) {
      showAttackDialogWithTechnique(actor, meleeItem, techDef, stanceDef, tech);
    } else {
      showAttackDialogNoWeapon(actor, techDef);
    }
  });
}
