// module/combat/movement-actions.mjs
// ════════════════════════════════════════════════════════════════════════
//  Движение (стр. 28-30), кроме Трудного Ландшафта (движение-terrain.mjs):
//   A. Боевые типы (Полудвижение/Полное/Натиск/Бег, стр. 32) — тратят ОД
//      через action-economy.mjs, Бег ставит флаг flags.warhammer-dbc.running,
//      читаемый в module/sheets/attack-dialog.mjs (модификатор атакующим по
//      бегущему) и в action-economy.mjs (блокирует Реакции бегущего).
//   B. Отдельные механики кнопками (Карабканье/Прыжки/Плавание/Падение/
//      Полёт) — по образцу showDifficultTerrainDialog из movement-terrain.mjs:
//      Dialog + тест 1d100 + чат-карточка исхода.
//   C. Марш/Бег/Форсированный марш вне боя (нарратив) — кумулятивный тест T
//      каждый час (flags.warhammer-dbc.marchFailStreak), провал → addFatigue
//      (module/sheets/tabs/conditions.mjs), побочный флаг marchPPenalty
//      читает marchPenalty() там же (actor-sheet.mjs, _getMarchPenalty).
//  Кнопка Token HUD — initMovementActionsHud(), по образцу
//  initDifficultTerrainHud из movement-terrain.mjs; та же панель — на
//  вкладке БОЙ (templates/actor/parts/tab-combat.hbs, combat.mjs).
// ════════════════════════════════════════════════════════════════════════

import { esc, _degWord } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { SKILLS_DEF } from "../constants/skills.mjs";
import { spendActionPoints, isEncounterActive } from "./action-economy.mjs";
import { addFatigue } from "../sheets/tabs/conditions.mjs";
import { itemHasName } from "../rules/predicates.mjs";

const sgn = (n) => `${n >= 0 ? "+" : ""}${n}`;

// Полёт (стр. 30) доступен только актору с Чертой Flyer/Hoverer (module/rules/
// mount.mjs держит тот же список для скакунов/байков — здесь та же проверка,
// но по Чертам самого актора, а не его скакуна).
const FLIGHT_TRAIT_NAMES = ["Flyer", "Летун", "Летающий", "Hoverer", "Парящий"];
const FLIGHT_TRAIT_ITEM_TYPES = new Set(["trait", "vehicleTrait"]);

export function actorCanFly(actor) {
  return (actor?.items ?? []).some(item =>
    FLIGHT_TRAIT_ITEM_TYPES.has(item?.type)
    && FLIGHT_TRAIT_NAMES.some(name => itemHasName(item, name)));
}

/** Итог Навыка (с учётом Тренировки) — умолчание на саму характеристику,
 *  если записи Навыка на акторе нет вовсе. */
function skillTotal(actor, key) {
  const sk = actor.system.skills?.[key];
  if (sk?.total != null) return sk.total;
  const charKey = SKILLS_DEF[key]?.char;
  return actor.system.characteristics?.[charKey]?.total ?? 0;
}

/** 1d100 против порога — тот же приём вычисления Успехов/Провалов, что и
 *  _resolveDifficultTerrain в movement-terrain.mjs. */
async function _d100(threshold) {
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const passed = rv <= threshold;
  const deg = Math.floor(Math.abs(passed ? threshold - rv : rv - threshold) / 10) + 1;
  return { roll, rv, passed, deg };
}

async function _postCard(actor, content) {
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    sound: CONFIG.sounds.dice
  }, game.settings.get("core", "rollMode")));
}

// ════════════════════════════════════════════════════════════════════════
// A. Боевые типы движения (стр. 32)
// ════════════════════════════════════════════════════════════════════════

export async function declareHalfMove(actor) {
  if (!actor) return;
  if (!await spendActionPoints(actor, 1)) return ui.notifications.warn("⚠️ Не хватает ОД.");
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#b0a080")}${esc(actor.name)} — Полудвижение</div>
    <div class="roll-threshold">Полудействие (1 ОД). Перемещение до SPD×1.</div>
  </div>`);
}

export async function declareFullMove(actor) {
  if (!actor) return;
  if (!await spendActionPoints(actor, 2)) return ui.notifications.warn("⚠️ Не хватает ОД.");
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#b0a080")}${esc(actor.name)} — Полное Движение</div>
    <div class="roll-threshold">Полное действие (2 ОД). Перемещение до SPD×2.</div>
    <div class="roll-threshold" style="font-size:0.85em;">Можно ещё полудействие (не атаку) — но его тесты, если есть, получают Помеху (стр. 32).</div>
  </div>`);
}

export async function declareCharge(actor) {
  if (!actor) return;
  await actor.update({ "system.meleeBase": "charge" });
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("sword","#ff9d4d")}${esc(actor.name)} — Натиск</div>
    <div class="roll-threshold">Перемещение до SPD×3 (не менее 4м), заканчивая в контакте с противником.</div>
    <div class="roll-threshold" style="font-size:0.85em;">База «Натиск» выбрана — рукопашный приём +20, 2 ОД спишутся на броске атаки.</div>
  </div>`);
}

export async function declareRun(actor) {
  if (!actor) return;
  if (!await spendActionPoints(actor, 2)) return ui.notifications.warn("⚠️ Не хватает ОД.");
  await actor.setFlag("warhammer-dbc", "running", true);
  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#4dffa6")}${esc(actor.name)} — Бег</div>
    <div class="roll-threshold">Полное действие (2 ОД). Перемещение до SPD×6.</div>
    <div class="roll-threshold" style="font-size:0.85em;">До начала следующего Хода: нельзя Реакции, вся Стрельба по персонажу −20, вся Рукопашная по нему +20.</div>
  </div>`);
}

// ════════════════════════════════════════════════════════════════════════
// B. Отдельные механики — кнопками (стр. 29-30)
// ════════════════════════════════════════════════════════════════════════

// ── Карабканье ──────────────────────────────────────────────────────────
export function showClimbDialog(actor) {
  if (!actor) return;
  const ath  = skillTotal(actor, "athletics");
  const acro = skillTotal(actor, "acrobatics");
  const spd  = Number(actor.system.movement?.halfMove) || 0;

  new Dialog({
    title: "Карабканье",
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Склон:</label>
          <select id="cl-type">
            <option value="simple">Простой (Athletics+0)</option>
            <option value="sheer">Отвесный (Athletics−10 и Acrobatics+0, оба)</option>
          </select>
        </div>
        <div class="atk-dlg-row"><label>Athletics (S):</label><input id="cl-ath" type="number" value="${ath}"/></div>
        <div class="atk-dlg-row"><label>Acrobatics (A):</label><input id="cl-acro" type="number" value="${acro}"/></div>
        <div class="atk-dlg-row"><label>Доп. мод:</label><input id="cl-mod" type="number" value="0"/></div>
        <div class="atk-range-info" style="font-size:0.82em;">
          Дистанция: SPD/2 (${(spd / 2).toFixed(1)}) + Успехи, м. Провал — падение (стр. 29).
        </div>
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Тест!",
        callback: async html => {
          const type  = html.find("#cl-type").val();
          const athV  = parseInt(html.find("#cl-ath").val()) || 0;
          const acroV = parseInt(html.find("#cl-acro").val()) || 0;
          const md    = parseInt(html.find("#cl-mod").val()) || 0;
          await _resolveClimb(actor, type, athV, acroV, md, spd);
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 420 }).render(true);
}

async function _resolveClimb(actor, type, ath, acro, mod, spd) {
  let passed, deg, thresholdLine;

  if (type === "sheer") {
    const athThreshold  = ath - 10 + mod;
    const acroThreshold = acro + mod;
    const roll = await new Roll("1d100").evaluate();
    const rv = roll.total;
    const passA = rv <= athThreshold;
    const passB = rv <= acroThreshold;
    passed = passA && passB;
    const worstDiff = passed
      ? Math.min(athThreshold - rv, acroThreshold - rv)
      : Math.max(rv - athThreshold, rv - acroThreshold);
    deg = Math.floor(Math.abs(worstDiff) / 10) + 1;
    thresholdLine = `Athletics−10 <b>${athThreshold}</b> и Acrobatics <b>${acroThreshold}</b> (оба) · 1d100: <b>${rv}</b>`;
  } else {
    const threshold = ath + mod;
    const r = await _d100(threshold);
    passed = r.passed; deg = r.deg;
    thresholdLine = `Athletics <b>${ath}</b>${sgn(mod)} → Порог <b>${threshold}</b> · 1d100: <b>${r.rv}</b>`;
  }

  const dist = (spd / 2 + deg).toFixed(1);
  const outcome = passed
    ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Взобрался на ${dist}м.</span>`
    : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Персонаж падает!</span>`;

  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#b0a080")}Карабканье — ${esc(actor.name)}</div>
    <div class="roll-threshold">${thresholdLine}</div>
    <div class="roll-outcome">${outcome}</div>
  </div>`);
}

// ── Прыжки ──────────────────────────────────────────────────────────────
const JUMP_FORMULAS = {
  vplace: { label: "Вертикальный с места",   dist: (sb, deg) => sb / 4 },
  vrun:   { label: "Вертикальный с разбега", dist: (sb, deg) => sb / 2 + deg / 2 },
  hplace: { label: "Горизонтальный с места", dist: (sb, deg) => sb + deg / 2 },
  hrun:   { label: "Горизонтальный с разбега", dist: (sb, deg) => sb + deg }
};

export function showJumpDialog(actor) {
  if (!actor) return;
  const acro = skillTotal(actor, "acrobatics");
  const sb   = Number(actor.system.characteristics?.s?.bonus) || 0;

  new Dialog({
    title: "Прыжок",
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Тип:</label>
          <select id="jp-type">
            <option value="vplace">Вертикальный с места (S.b/4)</option>
            <option value="vrun">Вертикальный с разбега (S.b/2+Усп/2)</option>
            <option value="hplace">Горизонтальный с места (S.b+Усп/2)</option>
            <option value="hrun">Горизонтальный с разбега (S.b+Усп)</option>
          </select>
        </div>
        <div class="atk-dlg-row"><label>Разбег:</label>
          <select id="jp-runup">
            <option value="0">Нет / &lt;8м (+0)</option>
            <option value="10">8м (+10)</option>
            <option value="20">12м (+20)</option>
            <option value="30">16м (+30)</option>
          </select>
        </div>
        <div class="atk-dlg-row"><label>Acrobatics (A):</label><input id="jp-acro" type="number" value="${acro}"/></div>
        <div class="atk-dlg-row"><label>Доп. мод:</label><input id="jp-mod" type="number" value="0"/></div>
        <div class="atk-range-info" style="font-size:0.82em;">Мин. дистанция разбега 4м (стр. 29-30).</div>
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Тест!",
        callback: async html => {
          const type  = html.find("#jp-type").val();
          const runup = parseInt(html.find("#jp-runup").val()) || 0;
          const acroV = parseInt(html.find("#jp-acro").val()) || 0;
          const md    = parseInt(html.find("#jp-mod").val()) || 0;
          await _resolveJump(actor, type, acroV, runup, md, sb);
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 420 }).render(true);
}

async function _resolveJump(actor, type, acro, runup, mod, sb) {
  const threshold = acro + runup + mod;
  const { rv, passed, deg } = await _d100(threshold);
  const f = JUMP_FORMULAS[type];
  const dist = passed ? f.dist(sb, deg).toFixed(1) : 0;
  const outcome = passed
    ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}. ${f.label}: ${dist}м.</span>`
    : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Прыжок не удался.</span>`;

  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#b0a080")}Прыжок — ${esc(actor.name)}</div>
    <div class="roll-threshold">Acrobatics <b>${acro}</b>${runup ? ` + ${runup} (разбег)` : ""}${sgn(mod)} → Порог <b>${threshold}</b> · 1d100: <b>${rv}</b></div>
    <div class="roll-outcome">${outcome}</div>
  </div>`);
}

// ── Плавание ────────────────────────────────────────────────────────────
export function showSwimDialog(actor) {
  if (!actor) return;
  const ath = skillTotal(actor, "athletics");
  const sb  = Number(actor.system.characteristics?.s?.bonus) || 0;

  new Dialog({
    title: "Плавание",
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Athletics (S):</label><input id="sw-ath" type="number" value="${ath}"/></div>
        <div class="atk-dlg-row"><label><input id="sw-heavy" type="checkbox"/> Тяж. оружие/броня (−30)</label></div>
        <div class="atk-dlg-row"><label><input id="sw-ext" type="checkbox"/> Свыше T.b часов (кумулятивный тест, как марш)</label></div>
        <div class="atk-dlg-row"><label>Доп. мод:</label><input id="sw-mod" type="number" value="0"/></div>
        <div class="atk-range-info" style="font-size:0.82em;">
          Успех — SPD = ½S.b (${(sb / 2).toFixed(1)}м). Провал — не может двигаться (стр. 30).
        </div>
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Тест!",
        callback: async html => {
          const athV = parseInt(html.find("#sw-ath").val()) || 0;
          const heavy = html.find("#sw-heavy").is(":checked");
          const ext   = html.find("#sw-ext").is(":checked");
          const md    = parseInt(html.find("#sw-mod").val()) || 0;
          await _resolveSwim(actor, athV, heavy, ext, md, sb);
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 420 }).render(true);
}

async function _resolveSwim(actor, ath, heavy, ext, mod, sb) {
  const threshold = ath + (heavy ? -30 : 0) + mod;
  const r = ext ? await _hourlyTest(actor, { threshold, slow: false })
                : { ...(await _d100(threshold)), effThreshold: threshold, streak: 0 };
  const { rv, passed, deg, effThreshold, streak } = r;
  const dist = passed ? (sb / 2).toFixed(1) : 0;
  const outcome = passed
    ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Плывёт, SPD ${dist}м.</span>`
    : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Не может двигаться.${ext ? " +1 Усталость." : ""}</span>`;

  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#6fe6ff")}Плавание — ${esc(actor.name)}</div>
    <div class="roll-threshold">Athletics <b>${ath}</b>${heavy ? " − 30 (тяж.)" : ""}${sgn(mod)}${streak ? ` − ${streak * 10} (кумулятив)` : ""} → Порог <b>${effThreshold}</b> · 1d100: <b>${rv}</b></div>
    <div class="roll-outcome">${outcome}</div>
  </div>`);
}

// ── Падение и Группирование ────────────────────────────────────────────
async function _resolveFallDamage(actor, height, { tuck = false } = {}) {
  const cappedHeight = Math.min(height, 25);
  const dmgRoll = await new Roll(`1d10 + ${cappedHeight}`).evaluate();
  let reduction = 0, tuckLine = "";
  if (tuck) {
    const acro = skillTotal(actor, "acrobatics");
    const { rv, passed, deg } = await _d100(acro);
    reduction = passed ? deg : 0;
    tuckLine = `<div class="roll-threshold">Группирование (Acrobatics ${acro}) · 1d100: <b>${rv}</b> — ${passed ? `Успех, −${deg} урона` : "Провал, без смягчения"}</div>`;
  }
  const finalDmg = Math.max(0, dmgRoll.total - reduction);

  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("skull","#ff6b6b")}Падение — ${esc(actor.name)}</div>
    <div class="roll-threshold">Высота <b>${height}</b>м${height > 25 ? " (ограничено терминальной скоростью 25)" : ""} · 1d10+${cappedHeight}: <b>${dmgRoll.total}</b></div>
    ${tuckLine}
    <div class="roll-outcome"><span class="${finalDmg > 0 ? "roll-failure" : "roll-success"}">Урон: <b>${finalDmg}</b> I (Impact), броня не учитывается.</span></div>
  </div>`);
}

export function showFallDialog(actor) {
  if (!actor) return;
  const ab = Number(actor.system.characteristics?.ag?.bonus) || 0;

  new Dialog({
    title: "Падение",
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Высота (м):</label><input id="fl-h" type="number" value="3"/></div>
        <div class="atk-dlg-row"><label><input id="fl-tuck" type="checkbox" checked/> Группирование (Acrobatics+0)</label></div>
        <div class="atk-dlg-row"><label><input id="fl-vol" type="checkbox"/> Добровольный прыжок (Acrobatics+0, отдельное полное действие, успех: −A.b=${ab}м)</label></div>
        <div class="atk-range-info" style="font-size:0.82em;">1d10 + высота I Dmg (потолок 25м), броня не учитывается (стр. 30).</div>
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Урон!",
        callback: async html => {
          let h = parseInt(html.find("#fl-h").val()) || 0;
          const tuck = html.find("#fl-tuck").is(":checked");
          const vol  = html.find("#fl-vol").is(":checked");
          if (vol) {
            const acro = skillTotal(actor, "acrobatics");
            const { passed } = await _d100(acro);
            if (passed) h = Math.max(0, h - ab);
            ui.notifications.info(passed
              ? `Добровольный прыжок удался — высота падения −${ab}м.`
              : `Добровольный прыжок не удался — падение с исходной высоты.`);
          }
          await _resolveFallDamage(actor, h, { tuck });
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 420 }).render(true);
}

// ── Полёт ───────────────────────────────────────────────────────────────
const FLIGHT_ALTITUDES = {
  ground: { label: "Приземная (до 2м)" },
  low:    { label: "Низкая" },
  high:   { label: "Высокая" }
};

// Урон при потере управления (стр. 30): высота × тип движения.
const FLIGHT_LOC_TABLE = {
  ground: { none: 0,  half: 0,  full: 3,  charge: 6,  run: 9  },
  low:    { none: 10, half: 12, full: 15, charge: 20, run: 25 },
  high:   { none: 25, half: 25, full: 25, charge: 25, run: 25 }
};
const FLIGHT_MOVE_LABELS = {
  none: "Неподвижен", half: "Полудвижение", full: "Полное движение",
  charge: "Натиск", run: "Бег"
};

export function showFlightDialog(actor) {
  if (!actor) return;
  if (!actorCanFly(actor)) {
    return ui.notifications.warn(`${actor.name}: нет Черты Flyer/Hoverer — полёт недоступен.`);
  }
  const current = actor.system.movement?.altitude || "ground";

  new Dialog({
    title: "Полёт",
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Высота:</label>
          <select id="fly-alt">
            ${Object.entries(FLIGHT_ALTITUDES).map(([k, v]) =>
              `<option value="${k}" ${k === current ? "selected" : ""}>${v.label}</option>`).join("")}
          </select>
        </div>
        <div class="atk-range-info" style="font-size:0.82em;">
          Flyer/Hoverer: Приземная — свободное действие. Flyer: Приземная↔Низкая — полудействие,
          Низкая↔Высокая — полное действие. На Низкой — недосягаема рукопашной, стрелковое −10,
          недоступна в помещениях с потолком &lt;5м. Все тесты Acrobatics/Dodge на любой высоте —
          комбинированные с Operate (Aeronautica)(A), теми же модификаторами (стр. 30).
        </div>
        <div class="atk-range-info" style="font-size:0.82em;">
          Потеря управления — урон по типу движения (Неподвиж./Полу/Полное/Натиск/Бег):<br/>
          Приземная 0/0/3/6/9 · Низкая 10/12/15/20/25 · Высокая 25/25/25/25/25.
        </div>
      </form>`,
    buttons: {
      set: { icon: '<i class="fas fa-check"></i>', label: "Установить высоту",
        callback: async html => {
          const alt = html.find("#fly-alt").val();
          await actor.update({ "system.movement.altitude": alt });
          ui.notifications.info(`${actor.name}: высота полёта — ${FLIGHT_ALTITUDES[alt].label}.`);
        } },
      loc: { icon: '<i class="fas fa-dice-d10"></i>', label: "Потеря управления",
        callback: html => {
          const alt = html.find("#fly-alt").val();
          _showFlightLocDialog(actor, alt);
        } },
      cancel: { label: "Отмена" }
    },
    default: "set"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 440 }).render(true);
}

function _showFlightLocDialog(actor, alt) {
  new Dialog({
    title: "Потеря управления — тип движения",
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Тип движения:</label>
          <select id="loc-move">
            ${Object.entries(FLIGHT_MOVE_LABELS).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}
          </select>
        </div>
      </form>`,
    buttons: {
      ok: { label: "Урон!", callback: async html => {
        const move = html.find("#loc-move").val();
        const dmg = FLIGHT_LOC_TABLE[alt]?.[move] ?? 0;
        await _postCard(actor, `<div class="wh-roll-result">
          <div class="roll-header">${rollIcon("warn","#ff6b6b")}Потеря управления — ${esc(actor.name)}</div>
          <div class="roll-outcome"><span class="roll-failure">Урон: <b>${dmg}</b> (высота: ${FLIGHT_ALTITUDES[alt].label}, движение: ${FLIGHT_MOVE_LABELS[move]}).</span></div>
        </div>`);
      } },
      cancel: { label: "Отмена" }
    },
    default: "ok"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 380 }).render(true);
}

// ════════════════════════════════════════════════════════════════════════
// C. Марш/Бег/Форсированный марш вне боя (стр. 29)
// ════════════════════════════════════════════════════════════════════════

/** Общий кумулятивный тест «час за часом» (Марш/Бег/Форс.марш/длит. Плавание):
 *  штраф −10× уже проваленных часов подряд, провал → +1 к счётчику и Усталость. */
async function _hourlyTest(actor, { threshold, slow = false }) {
  const streak = Number(actor.getFlag("warhammer-dbc", "marchFailStreak")) || 0;
  const effThreshold = threshold - 10 * streak;
  const { rv, passed, deg } = await _d100(effThreshold);
  if (!passed) {
    await actor.setFlag("warhammer-dbc", "marchFailStreak", streak + 1);
    await addFatigue(actor, 1, { slow });
  }
  return { rv, passed, deg, effThreshold, streak };
}

const MARCH_KINDS = {
  accelerated: {
    label: "Ускоренный марш", mult: "×2", pPenalty: -10, trackBonus: 10,
    note: "До T.b часов без теста; тест T+0 при превышении, дальше — каждый час, кумулятивно."
  },
  run: {
    label: "Бег (марш)", mult: "×3", pPenalty: -20, trackBonus: 30,
    note: "1 час; тест T каждый час, кумулятивно."
  },
  forced: {
    label: "Форсированный марш", mult: "как обычный марш", pPenalty: 0, trackBonus: 0,
    note: "После обычных 8ч марша; тест T каждый час, кумулятивно. Усталость от него восстанавливается вдвое медленнее."
  }
};

export function showMarchDialog(actor, kind) {
  if (!actor) return;
  const def = MARCH_KINDS[kind];
  if (!def) return;
  const t = Number(actor.system.characteristics?.t?.total) || 0;
  const streak = Number(actor.getFlag("warhammer-dbc", "marchFailStreak")) || 0;
  const active = actor.getFlag("warhammer-dbc", "marchKind") === kind;

  new Dialog({
    title: def.label,
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Toughness (T):</label><input id="mch-t" type="number" value="${t}"/></div>
        <div class="atk-dlg-row"><label>Текущий кумулятив:</label><span>−${streak * 10}</span></div>
        <div class="atk-range-info" style="font-size:0.82em;">${def.note}</div>
        <div class="atk-range-info" style="font-size:0.82em;">
          Скорость ${def.mult}. Побочно: P ${def.pPenalty !== 0 ? sgn(def.pPenalty) : "+0"}${def.trackBonus ? `, тестам обнаружения персонажа +${def.trackBonus}` : ""}.
        </div>
      </form>`,
    buttons: {
      test: { icon: '<i class="fas fa-dice-d10"></i>', label: "Тест часа",
        callback: async html => {
          const tv = parseInt(html.find("#mch-t").val()) || 0;
          if (!active) {
            await actor.setFlag("warhammer-dbc", "marchKind", kind);
            await actor.setFlag("warhammer-dbc", "marchPPenalty", def.pPenalty);
          }
          await _resolveMarchHour(actor, def, tv, kind === "forced");
        } },
      stop: { label: "Закончить марш",
        callback: async () => {
          await actor.unsetFlag("warhammer-dbc", "marchKind");
          await actor.unsetFlag("warhammer-dbc", "marchFailStreak");
          await actor.unsetFlag("warhammer-dbc", "marchPPenalty");
          ui.notifications.info(`${actor.name}: марш закончен.`);
        } },
      cancel: { label: "Отмена" }
    },
    default: "test"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 420 }).render(true);
}

async function _resolveMarchHour(actor, def, t, slow) {
  const { rv, passed, deg, effThreshold, streak } = await _hourlyTest(actor, { threshold: t, slow });
  const outcome = passed
    ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}.</span>`
    : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. +1 Усталость, кумулятив теперь −${(streak + 1) * 10}.</span>`;

  await _postCard(actor, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("run","#b0a080")}${def.label} — ${esc(actor.name)}</div>
    <div class="roll-threshold">T <b>${t}</b>${streak ? ` − ${streak * 10} (кумулятив)` : ""} → Порог <b>${effThreshold}</b> · 1d100: <b>${rv}</b></div>
    <div class="roll-outcome">${outcome}</div>
  </div>`);
}

// ════════════════════════════════════════════════════════════════════════
// Меню — общее для Token HUD и вкладки БОЙ
// ════════════════════════════════════════════════════════════════════════

export function showMovementMenu(actor) {
  if (!actor) return;
  const buttons = {};

  if (isEncounterActive()) {
    buttons.halfmove = { label: "Полудвижение (1 ОД)", callback: () => declareHalfMove(actor) };
    buttons.fullmove = { label: "Полное движение (2 ОД)", callback: () => declareFullMove(actor) };
    buttons.charge   = { label: "Натиск", callback: () => declareCharge(actor) };
    buttons.run      = { label: "Бег (2 ОД)", callback: () => declareRun(actor) };
  }
  buttons.climb = { label: "Карабканье", callback: () => showClimbDialog(actor) };
  buttons.jump  = { label: "Прыжок", callback: () => showJumpDialog(actor) };
  buttons.swim  = { label: "Плавание", callback: () => showSwimDialog(actor) };
  buttons.fall  = { label: "Падение", callback: () => showFallDialog(actor) };
  if (actorCanFly(actor)) {
    buttons.fly = { label: "Полёт", callback: () => showFlightDialog(actor) };
  }
  if (!isEncounterActive()) {
    buttons.marchA = { label: "Ускоренный марш", callback: () => showMarchDialog(actor, "accelerated") };
    buttons.marchR = { label: "Бег (марш)", callback: () => showMarchDialog(actor, "run") };
    buttons.marchF = { label: "Форсированный марш", callback: () => showMarchDialog(actor, "forced") };
  }
  buttons.cancel = { label: "Закрыть" };

  new Dialog({
    title: "Движение",
    content: `<div class="atk-range-info" style="font-size:0.85em;padding:4px 2px;">Выберите действие (стр. 28-30).</div>`,
    buttons,
    default: "cancel"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 320 }).render(true);
}

// Токены техники/Орды/Отряда/Формации не участвуют в этом разделе —
// у них своя механика движения (module/combat/vehicle.mjs и т.п.).
const MOVEMENT_MENU_EXCLUDED_TYPES = ["vehicle", "ship", "horde", "squad", "formation", "starSystem"];

export function initMovementActionsHud() {
  Hooks.on("renderTokenHUD", (hud, html, data) => {
    const tokenDoc = hud.object?.document;
    const actor    = tokenDoc?.actor;
    if (!actor || MOVEMENT_MENU_EXCLUDED_TYPES.includes(actor.type)) return;

    const isGM = game.user.isGM;
    const owns = actor.isOwner;
    if (!isGM && !owns) return;

    const el = html instanceof HTMLElement ? html : html?.[0];
    if (!el) return;
    const col = el.querySelector(".col.left") || el.querySelector(".col-left")
             || el.querySelector(".left") || el;
    if (el.querySelector(".wh-movement-btn")) return;   // без дублей при перерисовке

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "control-icon wh-movement-btn";
    btn.dataset.action = "whMovement";
    btn.title = "Движение (стр. 28-30)";
    btn.innerHTML = `<i class="fas fa-person-running"></i>`;
    btn.addEventListener("click", ev => {
      ev.preventDefault();
      ev.stopPropagation();
      showMovementMenu(actor);
    });
    col.appendChild(btn);
  });
}
