// module/combat/rig-steal.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Забрать предмет с ЧУЖОЙ разгрузки (стр. 27): «Оружие на магнитных замках
//  не может быть взято другим персонажем – как вручную при Борьбе, так и
//  телекинезом или магнитным притяжением, но из него можно вынуть чеку или
//  боеприпасы. Чтобы сорвать предмет с магнитного замка, нужно за
//  полудействие пройти тест S–30. С предметами в карманах и кобурах ситуация
//  противоположная.»
//
//  Читаем формулировку буквально: раз книга перечисляет ТРИ метода, которым
//  магнитный замок сопротивляется (ручной Борьбой, телекинезом, магнитным
//  притяжением), а для карманов/кобур «ситуация противоположная» — вне
//  замка все три метода работают штатно. У этой системы нет ни правил
//  магнитного притяжения, ни готового «Разоружения» в Борьбе — здесь
//  моделируются только два реальных пути:
//    - Боевой контакт (тот же порог, что showMeleeRangeCells, стр. 27 —
//      «дотянуться руками») — работает всегда, замок или нет.
//    - Телекинез — дотягивается ИЗДАЛЕКА, но ТОЛЬКО до кармана/кобуры:
//      магнитный замок книга прямым текстом исключает даже для телекинеза.
//  Проверка «владеет ли Телекинезом» — по владению самой дисциплиной
//  (psychicPower с discipline:"telekinesis"), не по дальности конкретной
//  силы/по факту манифестации — точный учёт дальности данной психосилы
//  вживую увёл бы это далеко за рамки книжного абзаца про Разгрузку.
// ════════════════════════════════════════════════════════════════════════════

import { rigManagerData } from "../constants/rig.mjs";
import { tokenDistance } from "./facing.mjs";
import { spendActionPoints } from "./action-economy.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";

// Тот же множитель, что showMeleeRangeCells (combat/range-cells.mjs) — 1.5
// клетки сцены, «дотянуться руками» вне зависимости от точного хвата оружия.
const MELEE_REACH_MULT = 1.5;

/** Владеет ли актор дисциплиной Телекинез (хотя бы одна манифестируемая сила). */
export function hasTelekinesis(actor) {
  return (actor?.items ?? []).some(i => i.type === "psychicPower" && i.system?.discipline === "telekinesis");
}

/** Токены в Боевом контакте («дотянуться руками») — Евклидова дистанция, тот же порог, что и подсветка ближнего боя. */
export function inMeleeContact(tokenA, tokenB) {
  if (!tokenA || !tokenB) return false;
  const gridUnit = canvas?.scene?.grid?.distance ?? canvas?.grid?.distance ?? 1;
  const d = tokenDistance(tokenA, tokenB);
  return d != null && d <= gridUnit * MELEE_REACH_MULT;
}

/**
 * Предметы victim'а, доступные для «Забрать» — реально СТОУЕМЫЕ (разгрузка/
 * рюкзак/не размещено), не то, что уже в руках (это Разоружение, отдельная
 * нереализованная механика, не эта). magLocked — сидит именно на магнитном
 * замке (rig.mjs::expandSlots.isMag), а не в кармане/кобуре/рюкзаке.
 */
export function stealableItems(victim) {
  const data = rigManagerData(victim);
  const out = [];
  for (const rig of data.rigs) {
    if (rig.container) {
      for (const c of rig.contents) out.push({ id: c.id, name: c.name, magLocked: false });
    } else {
      for (const sl of rig.slots) {
        if (sl.item) out.push({ id: sl.item.id, name: sl.item.name, magLocked: !!sl.isMag });
      }
    }
  }
  for (const u of data.unassigned) out.push({ id: u.id, name: u.name, magLocked: false });
  // unassigned включает и то, что просто равно ничем не занято (не в руках и
  // не в разгрузке) — но НЕ то, что сейчас в руках: equipped-предметы решает
  // Разоружение, не эта функция (см. заголовок файла).
  return out.filter(o => {
    const item = victim.items?.get?.(o.id);
    return item && !item.system?.equipped;
  });
}

/** Перенос предмета victim → thief: новый embedded-документ, снят (equipped:false), старый удалён. */
async function transferItem(thief, victim, itemId) {
  const item = victim.items.get(itemId);
  if (!item) return null;
  const data = item.toObject();
  delete data._id;
  if (data.system && "equipped" in data.system) data.system.equipped = false;
  const [created] = await thief.createEmbeddedDocuments("Item", [data]);
  await item.delete();
  return created;
}

/**
 * Забрать предмет с чужой разгрузки. `melee` — тот же Боевой контакт, что
 * посчитал вызывающий (inMeleeContact на токенах); отдельно перепроверяется
 * здесь же — функция может быть позвана и не из HUD-меню.
 */
export async function useStealFromRig(thief, victim, itemId, { melee = false } = {}) {
  if (!thief || !victim || !itemId) return;
  const target = stealableItems(victim).find(i => i.id === itemId);
  if (!target) return ui.notifications.warn("⚠️ Предмет не найден на разгрузке цели (возможно, уже забран).");

  if (target.magLocked) {
    // Магнитный замок сопротивляется телекинезу и магнитному притяжению
    // тоже (стр. 27) — единственный путь всегда физический, полудействие
    // рядом с целью.
    if (!melee) {
      return ui.notifications.warn("⚠️ Магнитный замок — только в Боевом контакте, телекинез на него не действует (стр. 27).");
    }
    if (!await spendActionPoints(thief, 1, { physical: true })) {
      return ui.notifications.warn("⚠️ Не хватает ОД, чтобы сорвать предмет с замка.");
    }
    const s = thief.system?.characteristics?.s?.total ?? 0;
    const ruleMods = collectTestMods(thief, { kind: "skill", char: "s" });
    const threshold = s - 30 + ruleMods.total;
    const roll = await new Roll("1d100").evaluate();
    const rv = roll.total;
    const success = rv <= threshold;
    const dice = await roll.render();
    if (success) await transferItem(thief, victim, itemId);
    await postTestCard(thief, {
      icon: rollIcon("wrench", "#c0a0ff"),
      title: `${esc(thief.name)} — Сорвать с замка: ${esc(target.name)} (${esc(victim.name)})`,
      threshold: rollStatLine({ label: "S−30", base: s - 30, parts: ruleMods.parts, threshold, rv }),
      outcome: success ? outcomeHtml(true, `Успех — забрано у ${esc(victim.name)}`) : outcomeHtml(false, "Провал — предмет остался на замке"),
      sections: [`<details class="roll-dice-details"><summary>${rollIcon("chart", "#8fd0ff")}Показать кубы</summary>${dice}</details>`]
    }, { rolls: [roll] });
    return;
  }

  // Карман/кобура/рюкзак/не размещено — «ситуация противоположная»: без
  // теста, но всё ещё нужен контакт — либо руками, либо Телекинезом издалека.
  if (!melee && !hasTelekinesis(thief)) {
    return ui.notifications.warn("⚠️ Нужен Боевой контакт (или дисциплина Телекинез) — стр. 27.");
  }
  if (!await spendActionPoints(thief, 1, { physical: true })) {
    return ui.notifications.warn("⚠️ Не хватает ОД, чтобы забрать предмет.");
  }
  await transferItem(thief, victim, itemId);
  await postTestCard(thief, {
    icon: rollIcon("run", "#b0a080"),
    title: `${esc(thief.name)} — Забрать`,
    lines: [`<div class="roll-threshold">Берёт <b>${esc(target.name)}</b> у ${esc(victim.name)}${melee ? "" : " (Телекинез)"} — Полудействие.</div>`]
  }, { sound: false });
}

function showStealMenu(thief, thiefToken, victim, victimToken) {
  const items = stealableItems(victim);
  if (!items.length) return ui.notifications.info(`У ${victim.name} нет доступных для этого предметов на разгрузке.`);
  const melee = inMeleeContact(thiefToken, victimToken);
  const telekinesis = hasTelekinesis(thief);

  const buttons = {};
  for (const it of items) {
    const reachable = it.magLocked ? melee : (melee || telekinesis);
    const tag = it.magLocked ? " 🔒(S−30)" : "";
    const label = `${it.name}${tag}${reachable ? "" : " — недосягаемо"}`;
    buttons[`steal-${it.id}`] = {
      label,
      callback: () => useStealFromRig(thief, victim, it.id, { melee })
    };
  }
  buttons.cancel = { label: "Закрыть" };

  new Dialog({
    title: `Забрать у ${victim.name}`,
    content: `<div class="atk-range-info" style="font-size:0.85em;padding:4px 2px;">
      ${melee ? "Боевой контакт." : telekinesis ? "Не в контакте — доступен только Телекинез (не для замков)." : "Не в контакте и нет Телекинеза — доступны только предметы в контакте."}
    </div>`,
    buttons,
    default: "cancel"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 340 }).render(true);
}

const STEAL_MENU_EXCLUDED_TYPES = ["vehicle", "ship", "horde", "squad", "formation", "starSystem"];

/** Кнопка Token HUD — «Забрать» на ЧУЖОМ токене (по образцу initMovementActionsHud). */
export function initRigStealHud() {
  Hooks.on("renderTokenHUD", (hud, html) => {
    const victimToken = hud.object;
    const victim = victimToken?.document?.actor;
    if (!victim || STEAL_MENU_EXCLUDED_TYPES.includes(victim.type)) return;
    // Не показываем только на СВОЁМ токене (тот же актор, что под контролем
    // прямо сейчас) — его снаряжение берётся с вкладки СНАРЯЖЕНИЕ (equipItem),
    // тащить у самого себя незачем. victim.isOwner здесь НЕ годится (wdbc-0uol,
    // живой тест 18.09.2026): у ГМа Foundry isOwner всегда true на любом
    // документе (обход прав ядра), даже без единой записи в ownership — кнопка
    // не рендерилась вовсе ни на одном токене, включая чужих NPC.
    const myActor = canvas.tokens?.controlled?.[0]?.actor ?? null;
    if (myActor && myActor.id === victim.id) return;

    const el = html instanceof HTMLElement ? html : html?.[0];
    if (!el) return;
    const col = el.querySelector(".col.right") || el.querySelector(".col-right")
             || el.querySelector(".right") || el;
    if (el.querySelector(".wh-steal-btn")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "control-icon wh-steal-btn";
    btn.title = "Забрать с разгрузки (стр. 27)";
    btn.innerHTML = `<i class="fas fa-hand-back-fist"></i>`;
    btn.addEventListener("click", ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const thiefToken = canvas.tokens?.controlled?.[0] ?? null;
      const thief = thiefToken?.actor ?? null;
      if (!thief) return ui.notifications.warn("⚠️ Выберите своего персонажа на сцене!");
      showStealMenu(thief, thiefToken, victim, victimToken);
    });
    col.appendChild(btn);
  });
}
