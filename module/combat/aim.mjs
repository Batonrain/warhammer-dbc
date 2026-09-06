// module/combat/aim.mjs
// Прицеливание по клику (в духе Fallout/сталкерского HUD): жмёшь атаку —
// курсор становится перекрестием, наводишь на токен и щёлкаешь, выбранный
// токен становится целью (game.user.targets), после чего открывается диалог
// стрельбы, который эту цель и подхватывает.
//
// Вся возня с канвасом и мышью здесь; боёвке про неё знать незачем — она
// получает уже назначенную цель через game.user.targets.
import { esc } from "../helpers/utils.mjs";
import { showWeaponRangeRing, showMeleeReachRing, clearRangeRings } from "./range-rings.mjs";
import { showWeaponRangeCells, showMeleeRangeCells, clearRangeCells } from "./range-cells.mjs";
import { clearReachableCells } from "./reachable-cells.mjs";
import { measureTokens } from "./tactical-map.mjs";
import { tokenRect } from "./horde-tokens.mjs";
import { pxPerMeter } from "./templates.mjs";
import { rangeBandKey, RANGE_BANDS, edgeDistanceMeters } from "../rules/tactical-map.mjs";

const AIMING = "wh-aiming";
const HINT_ID = "wh-aim-hint";
const RANGE_HINT_ID = "wh-aim-range-hint";

// Те же цвета, что у колец дальности на канвасе (combat/range-rings.mjs) —
// подсказка у курсора и кольцо одной полосы дальности должны читаться как
// одно целое.
const BAND_COLOR = {
  pointBlank: "#ff5555", short: "#ffaa33", combat: "#7bd858",
  long: "#ffaa33", extreme: "#ff5555", out: "#888888"
};

let _active = null;   // { off } пока целимся

/** Идёт ли прицеливание. */
export const aiming = () => !!_active;

/** Точка канваса под курсором в мировых координатах. */
function _worldPoint(ev) {
  const view = canvas?.app?.view;
  if (!view || !canvas.stage) return null;
  const rect = view.getBoundingClientRect();
  return canvas.stage.toLocal({ x: ev.clientX - rect.left, y: ev.clientY - rect.top });
}

/**
 * Токен под курсором — через мировые координаты, а не token.hover: во время
 * прицеливания мы перехватываем события до ядра, на hover полагаться нельзя.
 */
function tokenAt(ev) {
  const world = _worldPoint(ev);
  if (!world) return null;
  const hits = canvas.tokens.placeables.filter(t =>
    t.visible && t.actor && t.bounds.contains(world.x, world.y));
  // Токены могут лежать друг на друге — берём верхний.
  return hits.sort((a, b) => (b.document.sort ?? 0) - (a.document.sort ?? 0))[0] ?? null;
}

/**
 * Дистанция «край Базы стрелка → курсор», м — та же метрика (edgeM), что
 * покажет диалог атаки после клика. Под курсором реальный токен — точный
 * расчёт через measureTokens (учитывает и его Базу); иначе курсор — База
 * нулевого размера (w=h=0), edgeDistanceMeters сам вычтет только радиус
 * стрелка.
 */
function _edgeDistanceToCursor(attackerToken, ev) {
  const hovered = tokenAt(ev);
  if (hovered && hovered !== attackerToken) {
    return measureTokens(attackerToken, hovered)?.edgeM ?? null;
  }
  const world = _worldPoint(ev);
  const size  = canvas?.grid?.size || canvas?.scene?.grid?.size || 100;
  const rectA = tokenRect(attackerToken);
  if (!world || !rectA || !size) return null;
  const cellMeters = size / pxPerMeter();
  const pointRect  = { x: world.x / size, y: world.y / size, w: 0, h: 0 };
  return edgeDistanceMeters(rectA, pointRect, cellMeters);
}

/** Обновить текст+положение подсказки полосы дальности у курсора. */
function _updateRangeHint(el, attackerToken, rng, ev) {
  const edgeM = _edgeDistanceToCursor(attackerToken, ev);
  if (edgeM == null) { el.style.display = "none"; return; }
  const key   = rangeBandKey(edgeM, rng);
  const band  = RANGE_BANDS.find(b => b.key === key);
  const label = key === "out" ? "Вне дальности" : (band?.label ?? "");
  if (!label) { el.style.display = "none"; return; }
  const modTxt = band ? ` · ${band.mod >= 0 ? "+" : ""}${band.mod}` : "";
  el.textContent = `${label} · ${edgeM} м${modTxt}`;
  el.style.borderColor = BAND_COLOR[key] || BAND_COLOR.out;
  el.style.left = `${ev.clientX + 18}px`;
  el.style.top  = `${ev.clientY + 18}px`;
  el.style.display = "block";
}

/** Убрать перекрестие и вернуть мышь канвасу. */
export function endTargeting() {
  if (!_active) return;
  _active.off();
  _active = null;
  document.body.classList.remove(AIMING);
  document.getElementById(HINT_ID)?.remove();
  document.getElementById(RANGE_HINT_ID)?.remove();
  clearRangeRings();
  clearRangeCells();
  clearReachableCells();
}

/**
 * Начать прицеливание.
 * @param {Actor}    actor   кто стреляет (чтобы не целиться в себя)
 * @param {Item}     weapon  из чего (для подписи-подсказки)
 * @param {Function} onPick  колбэк(token) с выбранной целью
 * @param {string}   label   подпись, если оружия нет
 * @param {{forceMelee?: boolean}} [opts]  forceMelee — оружие дальнобойное,
 *   но бьём им как рукопашным (приклад/пистолет в упор, apps/hud.mjs
 *   data-melee-gun): показать кольцо досягаемости, а не полосы дальности.
 */
export function beginTargeting(actor, weapon, onPick, label = "", { forceMelee = false } = {}) {
  if (!canvas?.ready) { ui.notifications?.warn("Сцена не готова."); return; }
  endTargeting();   // второй раз — начинаем заново, а не копим слушателей

  // Рукопашная — подсветка клеток «кто рядом» (та же isMelee-логика, что и у
  // самого броска, см. combat/attack.mjs:100); дальнобойная — клетки в
  // пределах дальности, и только если у оружия задан Rng. Клеточная
  // подсветка (range-cells.mjs) — основной путь; кольцо (range-rings.mjs) —
  // резерв на Gridless-сценах, где клеток нет.
  const attackerToken = actor?.getActiveTokens?.(false)?.[0] ?? null;
  const isMelee = forceMelee || weapon?.system?.weaponClass === "melee";
  const rng = Number(weapon?.system?.range) || 0;
  const showsRange = !isMelee && !!(attackerToken && rng > 0);
  if (attackerToken) {
    if (isMelee) {
      if (!showMeleeRangeCells(attackerToken)) showMeleeReachRing(attackerToken);
    } else if (showsRange) {
      if (!showWeaponRangeCells(attackerToken, rng)) showWeaponRangeRing(attackerToken, rng);
    }
  }

  document.body.classList.add(AIMING);

  const hint = document.createElement("div");
  hint.id = HINT_ID;
  hint.innerHTML = `<b>${esc(weapon?.name || label || "Атака")}</b> — выбери цель · `
    + `<button type="button" id="wh-aim-notarget">Без цели (Пробел)</button> · `
    + `<span>ПКМ или Esc — отмена</span>`;
  document.body.appendChild(hint);

  // Живая подсказка полосы дальности у курсора («Короткая · 4 м · +10») —
  // тот же rangeBandKey, что и диалог атаки, только по позиции курсора,
  // а не по уже выбранной цели.
  let rangeHint = null, moveRange = null;
  if (showsRange) {
    rangeHint = document.createElement("div");
    rangeHint.id = RANGE_HINT_ID;
    rangeHint.style.display = "none";
    document.body.appendChild(rangeHint);
    moveRange = (ev) => _updateRangeHint(rangeHint, attackerToken, rng, ev);
    window.addEventListener("pointermove", moveRange, true);
  }

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
      if (moveRange) window.removeEventListener("pointermove", moveRange, true);
    }
  };
}
