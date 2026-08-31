// module/combat/aim.mjs
// Прицеливание по клику (в духе Fallout/сталкерского HUD): жмёшь атаку —
// курсор становится перекрестием, наводишь на токен и щёлкаешь, выбранный
// токен становится целью (game.user.targets), после чего открывается диалог
// стрельбы, который эту цель и подхватывает.
//
// Вся возня с канвасом и мышью здесь; боёвке про неё знать незачем — она
// получает уже назначенную цель через game.user.targets.
import { esc } from "../helpers/utils.mjs";
import { showWeaponRangeRings, clearRangeRings } from "./range-rings.mjs";

const AIMING = "wh-aiming";
const HINT_ID = "wh-aim-hint";

let _active = null;   // { off } пока целимся

/** Идёт ли прицеливание. */
export const aiming = () => !!_active;

/**
 * Токен под курсором — через мировые координаты, а не token.hover: во время
 * прицеливания мы перехватываем события до ядра, на hover полагаться нельзя.
 */
function tokenAt(ev) {
  const view = canvas?.app?.view;
  if (!view || !canvas.stage) return null;
  const rect = view.getBoundingClientRect();
  const world = canvas.stage.toLocal({ x: ev.clientX - rect.left, y: ev.clientY - rect.top });
  const hits = canvas.tokens.placeables.filter(t =>
    t.visible && t.actor && t.bounds.contains(world.x, world.y));
  // Токены могут лежать друг на друге — берём верхний.
  return hits.sort((a, b) => (b.document.sort ?? 0) - (a.document.sort ?? 0))[0] ?? null;
}

/** Убрать перекрестие и вернуть мышь канвасу. */
export function endTargeting() {
  if (!_active) return;
  _active.off();
  _active = null;
  document.body.classList.remove(AIMING);
  document.getElementById(HINT_ID)?.remove();
  clearRangeRings();
}

/**
 * Начать прицеливание.
 * @param {Actor}    actor   кто стреляет (чтобы не целиться в себя)
 * @param {Item}     weapon  из чего (для подписи-подсказки)
 * @param {Function} onPick  колбэк(token) с выбранной целью
 * @param {string}   label   подпись, если оружия нет
 */
export function beginTargeting(actor, weapon, onPick, label = "") {
  if (!canvas?.ready) { ui.notifications?.warn("Сцена не готова."); return; }
  endTargeting();   // второй раз — начинаем заново, а не копим слушателей

  // Кольца полос дальности вокруг стрелка — только для дальнобойного оружия
  // (у ближнего/безоружного system.range нет или 0, кольца не рисуются).
  const attackerToken = actor?.getActiveTokens?.(true)?.[0] ?? null;
  const rng = Number(weapon?.system?.range) || 0;
  if (attackerToken && rng > 0) showWeaponRangeRings(attackerToken, rng);

  document.body.classList.add(AIMING);

  const hint = document.createElement("div");
  hint.id = HINT_ID;
  hint.innerHTML = `<b>${esc(weapon?.name || label || "Атака")}</b> — выбери цель · `
    + `<button type="button" id="wh-aim-notarget">Без цели (Пробел)</button> · `
    + `<span>ПКМ или Esc — отмена</span>`;
  document.body.appendChild(hint);

  const pick = (ev) => {
    if (ev.button !== 0) return;
    if (ev.target?.closest?.(`#${HINT_ID}`)) return;   // клик по подсказке — не прицеливание
    const token = tokenAt(ev);
    if (!token) return;                       // мимо — целимся дальше
    ev.preventDefault();
    ev.stopPropagation();
    if (actor && token.actor?.id === actor.id) {
      ui.notifications?.warn("Нельзя выбрать себя целью.");
      return;
    }
    token.setTarget(true, { releaseOthers: true });
    endTargeting();
    onPick?.(token);
  };
  const cancel = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    endTargeting();
  };
  // Бросок БЕЗ цели (тестовый/по декорациям): снимаем выделение целей и открываем
  // диалог как обычно — он сам работает с пустым game.user.targets.
  const noTarget = (ev) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false, groupSelection: true }));
    endTargeting();
    onPick?.(null);
  };
  const onKey = (ev) => {
    if (ev.key === "Escape") cancel(ev);
    else if (ev.key === " " || ev.key === "Spacebar" || ev.key === "Enter") noTarget(ev);
  };

  // Ловим на погружении (capture): иначе канвас первым утащит клик в выделение
  // токена и прицеливание не сработает.
  window.addEventListener("pointerdown", pick, true);
  window.addEventListener("contextmenu", cancel, true);
  window.addEventListener("keydown", onKey, true);
  hint.querySelector("#wh-aim-notarget")?.addEventListener("pointerdown", noTarget, true);

  _active = {
    off: () => {
      window.removeEventListener("pointerdown", pick, true);
      window.removeEventListener("contextmenu", cancel, true);
      window.removeEventListener("keydown", onKey, true);
    }
  };
}
