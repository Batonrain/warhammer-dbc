import { _buildAmmoModString, _buildAmmoModDetails, _getAmmoSpent, esc } from "../helpers/utils.mjs";
import { postTestCard, outcomeHtml } from "../helpers/test-card.mjs";
import { spendActionPoints } from "./action-economy.mjs";
import { hasSpeedTalent, rapidReloadApCost } from "../rules/speed-talents.mjs";
import { fullyArmedReloadApCost } from "./fully-armed.mjs";
import { profileHasOwnFire, sysWithProfileFire, profileFireUpdate } from "./weapon-profiles.mjs";
import { chamberInAvailable, chamberInBlockReason, CHAMBER_IN_FLAG } from "../rules/gunner-talents.mjs";
import { weaponHandsRequired, handsOccupied } from "../rules/hands.mjs";

/**
 * Стоимость Перезарядки в ОД по книжному полю system.reload (стр. 35,
 * wdbc-x1nz.2.54, «Действие: Зависит от оружия»): «½» → Полудействие (1 ОД),
 * целое N → N Полных действий (2×N ОД за один Ход — если хватает бюджета
 * Хода, иначе перезарядка блокируется целиком; растянуть её на несколько
 * Ходов книга не описывает конкретной механикой, и растягивать её самим
 * значило бы придумывать за неё).
 *
 * Прочие форматы этого поля в паках («–»/пусто — не перезаряжается вовсе,
 * «¼», «N×M» — почти исключительно у оружия техники, «†» — сноска на
 * особое правило конкретного оружия без числа вовсе) не имеют однозначного
 * числового смысла для одиночного ОД-бюджета персонажа — перезарядка таким
 * оружием остаётся бесплатной, как было до этой правки (честный остаток, не
 * гадаем число за книгу).
 * @returns {number} 0 — бесплатно
 */
export function reloadApCost(reloadField) {
  const raw = String(reloadField ?? "").trim();
  if (raw === "½") return 1;
  if (/^\d+$/.test(raw)) return Number(raw) * 2;
  return 0;
}

export function _getCompatibleAmmo(actor, weapon, sysOverride = null) {
  const sys        = sysOverride ?? weapon.system;
  const weaponType = sys.weaponType;
  const weapClass  = sys.weaponClass;
  return actor.items.filter(i => {
    if (i.type !== "ammo") return false;
    const aTypes = i.system.weaponTypes || [];
    return aTypes.includes(weaponType) ||
           aTypes.includes(weapClass)  ||
           aTypes.includes("any");
  });
}

export async function _showAmmoSelectDialog(weapon, compatAmmo) {
  return new Promise(resolve => {
    let resolved = false;

    const options = compatAmmo.map(a => {
      const qty  = a.system.quantity || 0;
      const mods = _buildAmmoModString(a.system);
      return `<option value="${a.id}" ${qty <= 0 ? "disabled" : ""}>
        ${a.name} (${qty} маг.)${mods ? " — " + mods : ""}
      </option>`;
    }).join("");

    new Dialog({
      title: `Перезарядка: ${weapon.name}`,
      content: `
        <form style="padding:8px;">
          <div style="font-size:0.88em;font-weight:bold;color:var(--wh-text-mid);
                      margin-bottom:6px;">Выберите боеприпасы:</div>
          <select id="ammo-choice" style="width:100%;padding:4px;
            background:var(--wh-input-bg);border:1px solid var(--wh-border);
            font-family:inherit;font-size:0.88em;">${options}</select>
          <div id="ammo-preview" style="margin-top:6px;font-size:0.82em;
            color:#5a4a30;padding:4px 6px;background:rgba(0,0,0,0.05);
            border-left:3px solid var(--wh-border);min-height:20px;"></div>
        </form>`,
      buttons: {
        reload: {
          icon:  '<i class="fas fa-redo"></i>',
          label: "Зарядить",
          callback: html => {
            if (!resolved) {
              resolved = true;
              const id = html.find("#ammo-choice").val();
              resolve(compatAmmo.find(a => a.id === id) || null);
            }
          }
        },
        cancel: {
          label: "Отмена",
          callback: () => { if (!resolved) { resolved = true; resolve(null); } }
        }
      },
      default: "reload",
      render: html => {
        const preview   = html.find("#ammo-preview");
        const doPreview = () => {
          const id   = html.find("#ammo-choice").val();
          const ammo = compatAmmo.find(a => a.id === id);
          if (!ammo) { preview.html(""); return; }
          preview.html(_buildAmmoModDetails(ammo.system) || "<em>Нет описания.</em>");
        };
        html.find("#ammo-choice").on("change", doPreview);
        doPreview();
      },
      close: () => { if (!resolved) { resolved = true; resolve(null); } }
    }, { classes: ["dialog","wh-ammo-dialog"], width: 380 }).render(true);
  });
}

/** Руки, метка «раз в Ход» и запрещающий мод (Буллпап: «Chamber In… не работают») для chamberInBlockReason. */
function chamberInContext(actor, weapon) {
  return {
    handsNeeded: weaponHandsRequired(weapon, actor),
    freeHands: handsOccupied(actor, { exclude: weapon.id }).free,
    usedThisTurn: !!actor.getFlag?.("warhammer-dbc", CHAMBER_IN_FLAG),
    modBlocked: [...(actor.items ?? [])].some(i => i.type === "weaponMod" && i.system?.installedOn === weapon.id
      && /bullpup|буллпап/i.test(String(i.name ?? "")))
  };
}

/**
 * Досылание (Талант Стрелка «Chamber In», rules/gunner-talents.mjs): +1 патрон в
 * магазин свободным действием, раз в Ход; запас магазинов НЕ уменьшается
 * (решение владельца 24.10.2026). Условия рук и типа оружия — chamberInBlockReason.
 * @returns {Promise<boolean>} досыл состоялся
 */
export async function chamberInRound(actor, weapon, { profileIdx = null } = {}) {
  const pIdx   = Number(profileIdx ?? weapon.getFlag?.("warhammer-dbc", "hudProfile") ?? -1);
  const prof   = pIdx >= 0 ? weapon.system.profiles?.[pIdx] : null;
  const ownIdx = profileHasOwnFire(prof) ? pIdx : -1;
  const sys    = ownIdx >= 0 ? sysWithProfileFire(weapon.system, prof) : weapon.system;
  const barrel = ownIdx >= 0 ? `${weapon.name} (${prof.label || "второй ствол"})` : weapon.name;
  if (!chamberInAvailable(actor, weapon)) {
    ui.notifications.warn(`Досылание: ${barrel} не подходит (нужен Талант и оружие на отдельных патронах).`);
    return false;
  }
  const reason = chamberInBlockReason(weapon, {
    ...chamberInContext(actor, weapon),
    magazineCur: sys.magazineCur, magazineMax: sys.magazineMax
  });
  if (reason) {
    ui.notifications.warn(`Досылание: ${reason}.`);
    return false;
  }
  const newMag = (Number(sys.magazineCur) || 0) + 1;
  await weapon.update(ownIdx >= 0
    ? profileFireUpdate(weapon, ownIdx, { magazineCur: newMag })
    : { "system.magazineCur": newMag });
  await actor.setFlag("warhammer-dbc", CHAMBER_IN_FLAG, true);
  await postTestCard(actor, {
    title: `Досылание — ${esc(barrel)}`,
    lines: [`<div class="roll-damage-meta">Свободное действие, раз в Ход: патрон с бандольера или пояса; запас магазинов не уменьшается.</div>`],
    outcome: outcomeHtml(true, `Заряд <b>${newMag}/${sys.magazineMax}</b>`)
  }, { sound: false });
  return true;
}

/** Предложить Досылание вместо полной перезарядки (Dialog v1, как выбор боеприпасов выше). */
function _askChamberIn(barrel, cur, max) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    new Dialog({
      title: `Досылание: ${barrel}`,
      content: `<div style="padding:8px;font-size:0.9em;">Магазин ${cur}/${max}. Дослать один патрон свободным действием (Талант «Досылание», раз в Ход; запас магазинов не тратится) или перезарядить целиком?</div>`,
      buttons: {
        chamber: { icon: '<i class="fas fa-bullseye"></i>', label: "Дослать 1 патрон", callback: () => finish("chamber") },
        reload:  { icon: '<i class="fas fa-redo"></i>', label: "Перезарядить", callback: () => finish("reload") }
      },
      default: "chamber",
      close: () => finish(null)
    }, { classes: ["dialog"], width: 380 }).render(true);
  });
}

/**
 * Перезарядка. У комби-оружия (wdbc-jho9) заряжается ствол, выбранный сейчас
 * профилем в HUD (флаг hudProfile), если у этого профиля свой ствол: свой
 * магазин, свои боеприпасы (weaponType профиля), свой срок перезарядки.
 */
export async function _reloadWeapon(actor, weapon, { profileIdx = null } = {}) {
  const pIdx   = Number(profileIdx ?? weapon.getFlag?.("warhammer-dbc", "hudProfile") ?? -1);
  const prof   = pIdx >= 0 ? weapon.system.profiles?.[pIdx] : null;
  const ownIdx = profileHasOwnFire(prof) ? pIdx : -1;
  const sys    = ownIdx >= 0 ? sysWithProfileFire(weapon.system, prof) : weapon.system;
  const barrel = ownIdx >= 0 ? `${weapon.name} (${prof.label || "второй ствол"})` : weapon.name;
  const maxMag = sys.magazineMax || 0;
  const curMag = sys.magazineCur || 0;
  const needed = maxMag - curMag;

  if (needed <= 0) {
    ui.notifications.info(`${barrel}: магазин уже полон (${curMag}/${maxMag}).`);
    return;
  }

  // Досылание: у носителя Таланта и при выполненных условиях (руки, раз в Ход, тип оружия) —
  // сначала предлагаем дослать один патрон; отказ — обычная перезарядка.
  if (chamberInAvailable(actor, weapon) && !chamberInBlockReason(weapon, {
        ...chamberInContext(actor, weapon),
        magazineCur: curMag, magazineMax: maxMag })) {
    const choice = await _askChamberIn(barrel, curMag, maxMag);
    if (choice === null) return;
    if (choice === "chamber") { await chamberInRound(actor, weapon, { profileIdx: pIdx }); return; }
  }

  const compatAmmo = _getCompatibleAmmo(actor, weapon, sys);
  if (!compatAmmo.length) {
    ui.notifications.warn(`Нет подходящих боеприпасов для ${barrel}!`);
    return;
  }

  const loadedAmmoId = sys.loadedAmmoId;
  let preferredAmmo  = loadedAmmoId
    ? compatAmmo.find(a => a.id === loadedAmmoId)
    : null;

  if (!preferredAmmo && compatAmmo.length === 1) {
    preferredAmmo = compatAmmo[0];
  }

  if (!preferredAmmo) {
    preferredAmmo = await _showAmmoSelectDialog(weapon, compatAmmo);
    if (!preferredAmmo) return;
  }

  const ammoSys = preferredAmmo.system;
  const ammoQty = ammoSys.quantity || 0;

  if (ammoQty <= 0) {
    ui.notifications.warn(`${preferredAmmo.name}: нет боеприпасов!`);
    return;
  }

  // Стр. 35, wdbc-x1nz.2.54: ОД списываются ПОСЛЕ выбора боеприпаса — отмена
  // диалога выбора выше ничего не стоит, только реально начатая перезарядка.
  // Быстрая Перезарядка: время перезарядки вдвое (окр.▼) — в ОД, ½ → свободно.
  // Во Всеоружии (−1 ОД вплоть до ½) и Быстрая Перезарядка (вдвое) НЕ
  // складываются — берётся лучшая из двух (решение владельца 24.10.2026, 62-0252 Q3).
  const baseCost = reloadApCost(sys.reload);
  const rapidCost = baseCost > 0 && hasSpeedTalent(actor, "rapidReload") ? rapidReloadApCost(baseCost) : baseCost;
  const armedCost = fullyArmedReloadApCost(actor, weapon, baseCost);
  const apCost = Math.min(rapidCost, armedCost);
  const rapid = rapidCost < baseCost && rapidCost === apCost;
  const armed = armedCost < baseCost && armedCost === apCost && !rapid;
  if (apCost > 0 && !await spendActionPoints(actor, apCost, { physical: true })) {
    return ui.notifications.warn(`⚠️ ${barrel}: не хватает ОД на перезарядку (нужно ${apCost}).`);
  }

  // По правилам системы: 1 предмет-боеприпас = 1 полный магазин. Перезарядка
  // вставляет свежий магазин (заполняет до максимума) и тратит 1 единицу запаса.
  const newMag = maxMag;
  const newQty = ammoQty - 1;

  await weapon.update(ownIdx >= 0
    ? profileFireUpdate(weapon, ownIdx, { magazineCur: newMag, loadedAmmoId: preferredAmmo.id })
    : { "system.magazineCur": newMag, "system.loadedAmmoId": preferredAmmo.id });
  await preferredAmmo.update({ "system.quantity": newQty });

  await postTestCard(actor, {
    title: `Перезарядка — ${esc(barrel)}`,
    lines: [`<div class="roll-damage-meta">
          Боеприпасы: <b>${esc(preferredAmmo.name)}</b>
        </div>`,
        ...(rapid ? [`<div class="roll-damage-meta">Быстрая Перезарядка: ${baseCost} → ${apCost} ОД. Пустой магазин выброшен под ноги.</div>`] : []),
        ...(armed ? [`<div class="roll-damage-meta">Во Всеоружии (Custom Grip): ${baseCost} → ${apCost} ОД.</div>`] : [])],
    outcome: outcomeHtml(true, `
            Вставлен магазин · Заряд <b>${newMag}/${maxMag}</b> · В запасе: <b>${newQty}</b> маг.
          `),
    sections: [newQty === 0
      ? `<div class="roll-allout-note">Боеприпасы <b>${esc(preferredAmmo.name)}</b> закончились!</div>`
      : ""]
  }, { sound: false });
}