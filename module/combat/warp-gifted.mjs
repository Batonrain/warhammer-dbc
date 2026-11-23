// module/combat/warp-gifted.mjs
// Одарённый Варпом (rules/warp-gifted.mjs): кнопка Черты — выбрать свою
// психосилу и Характеристику теста (W по книге, другая — по решению ГМа) и
// манифестировать её тестом Характеристика+5×X с PR X, без Феноменов.
// Без Daemonic Черта не положена — кнопка спрашивает подтверждение.

import { esc } from "../helpers/utils.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { warpGiftedRating, warpGiftedPowers, warpGiftedCastOpts, warpGiftedAllowed,
         WARP_GIFTED_MAX_POWER_PR, WARP_GIFTED_CAST_CHARS } from "../rules/warp-gifted.mjs";

export async function useWarpGifted(actor) {
  if (!actor) return false;
  const x = warpGiftedRating(actor);
  if (!x) {
    ui.notifications.warn(`${actor.name}: у Черты «Одарённый Варпом» не задан рейтинг X — впишите его на листе Черты.`);
    return false;
  }
  const powers = warpGiftedPowers(actor);
  if (!powers.length) {
    ui.notifications.warn(`${actor.name}: нет психосилы до PR${WARP_GIFTED_MAX_POWER_PR} — перетащите её на лист.`);
    return false;
  }
  if (!warpGiftedAllowed(actor)) {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Одарённый Варпом" },
      content: `<p>Черту «Одарённый Варпом» может иметь только персонаж с Трейтом Daemonic, а у «${esc(actor.name)}» его нет.</p><p>Манифестировать всё равно (решение ГМа)?</p>`,
      rejectClose: false
    });
    if (!ok) return false;
  }
  const powerOpts = powers.map((p, i) => `<option value="${esc(p.id)}"${i === 0 ? " selected" : ""}>${esc(p.name)}</option>`).join("");
  const charOpts = WARP_GIFTED_CAST_CHARS.map(k =>
    `<option value="${k}"${k === "wp" ? " selected" : ""}>${esc(CHARACTERISTICS[k]?.label ?? k)}${k === "wp" ? " (по книге)" : ""}</option>`).join("");
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: "Одарённый Варпом" },
    content: `<p>Психотест: Характеристика + ${5 * x}, PR ${x}, без Феноменов.</p>
      <div class="form-group"><label>Психосила</label><select name="power">${powerOpts}</select></div>
      <div class="form-group"><label title="По книге — W; другую, если она лучше подходит, назначает ГМ">Характеристика теста</label><select name="castChar">${charOpts}</select></div>`,
    buttons: [
      { action: "ok", label: "Манифестировать", default: true,
        callback: (event, button) => {
          const form = button.form;
          return { power: form?.querySelector("[name=power]")?.value ?? "", castChar: form?.querySelector("[name=castChar]")?.value ?? "wp" };
        } },
      { action: "cancel", label: "Отмена", callback: () => null }
    ],
    rejectClose: false
  }).catch(() => null);
  if (!picked || typeof picked !== "object") return false;
  const power = powers.find(p => p.id === picked.power) ?? powers[0];
  const { executePsychotest } = await import("../sheets/tabs/psychic.mjs");
  await executePsychotest(actor, power, {
    ...warpGiftedCastOpts(x, picked.castChar),
    modifier: 0, eldar: false, pushChoice: 1, damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1
  });
  return true;
}
