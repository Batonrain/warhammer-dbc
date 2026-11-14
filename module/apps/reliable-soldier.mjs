// module/apps/reliable-soldier.mjs
// Надёжный Вояка: кнопка «Выбрать типы» на Черте — типы берутся из оружия актора (рукопашная категория,
// тип стрелкового). Правило и бонус — rules/reliable-soldier.mjs, читает combat/attack.mjs.
import { hasRuleFlag } from "../rules/flags.mjs";
import { RELIABLE_SOLDIER_CAP, RELIABLE_MELEE_FLAG, RELIABLE_RANGED_FLAG, reliableTypeOf } from "../rules/reliable-soldier.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";

export function reliableSoldierChoice(actor) {
  return {
    chosenMelee: actor?.flags?.[NS]?.[RELIABLE_MELEE_FLAG] ?? actor?.getFlag?.(NS, RELIABLE_MELEE_FLAG) ?? "",
    chosenRanged: actor?.flags?.[NS]?.[RELIABLE_RANGED_FLAG] ?? actor?.getFlag?.(NS, RELIABLE_RANGED_FLAG) ?? ""
  };
}

export async function chooseReliableTypes(actor) {
  if (!actor || !hasRuleFlag(actor, RELIABLE_SOLDIER_CAP)) return ui.notifications.warn("Надёжный Вояка: у персонажа нет такой Черты.");
  const weapons = [...(actor.items ?? [])].filter(i => i.type === "weapon");
  const melee = [...new Set(weapons.filter(w => w.system?.weaponClass === "melee").map(w => reliableTypeOf(w, true)).filter(Boolean))];
  const ranged = [...new Set(weapons.filter(w => w.system?.weaponClass !== "melee").map(w => reliableTypeOf(w, false)).filter(Boolean))];
  const cur = reliableSoldierChoice(actor);
  const opts = (list, selected) => ["", ...list].map(v => `<option value="${esc(v)}"${v === selected ? " selected" : ""}>${v ? esc(v) : "— не выбрано —"}</option>`).join("");
  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Надёжный Вояка — ${actor.name}` },
    content: `<form>
      <p>Типы берутся из оружия персонажа. +2 Dmg и +1 Pen — автоматически; +1 к надёжности — вручную.</p>
      <div class="form-group"><label>Рукопашное (категория)</label><select name="melee">${opts(melee, cur.chosenMelee)}</select></div>
      <div class="form-group"><label>Стрелковое (тип)</label><select name="ranged">${opts(ranged, cur.chosenRanged)}</select></div>
    </form>`,
    ok: { label: "Сохранить", callback: (ev, button) => ({ melee: button.form.elements.melee.value, ranged: button.form.elements.ranged.value }) },
    rejectClose: false
  });
  if (!result) return;
  await actor.update({ [`flags.${NS}.${RELIABLE_MELEE_FLAG}`]: result.melee, [`flags.${NS}.${RELIABLE_RANGED_FLAG}`]: result.ranged });
  ui.notifications.info(`${actor.name}: Надёжный Вояка — рукопашное «${result.melee || "—"}», стрелковое «${result.ranged || "—"}».`);
}
