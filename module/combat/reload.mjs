import { _buildAmmoModString, _buildAmmoModDetails, _getAmmoSpent, esc } from "../helpers/utils.mjs";
import { postTestCard, outcomeHtml } from "../helpers/test-card.mjs";

export function _getCompatibleAmmo(actor, weapon) {
  const sys        = weapon.system;
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

export async function _reloadWeapon(actor, weapon) {
  const sys    = weapon.system;
  const maxMag = sys.magazineMax || 0;
  const curMag = sys.magazineCur || 0;
  const needed = maxMag - curMag;

  if (needed <= 0) {
    ui.notifications.info(`${weapon.name}: магазин уже полон (${curMag}/${maxMag}).`);
    return;
  }

  const compatAmmo = _getCompatibleAmmo(actor, weapon);
  if (!compatAmmo.length) {
    ui.notifications.warn(`Нет подходящих боеприпасов для ${weapon.name}!`);
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

  // По правилам системы: 1 предмет-боеприпас = 1 полный магазин. Перезарядка
  // вставляет свежий магазин (заполняет до максимума) и тратит 1 единицу запаса.
  const newMag = maxMag;
  const newQty = ammoQty - 1;

  await weapon.update({
    "system.magazineCur":  newMag,
    "system.loadedAmmoId": preferredAmmo.id
  });
  await preferredAmmo.update({ "system.quantity": newQty });

  await postTestCard(actor, {
    title: `Перезарядка — ${esc(weapon.name)}`,
    lines: [`<div class="roll-damage-meta">
          Боеприпасы: <b>${esc(preferredAmmo.name)}</b>
        </div>`],
    outcome: outcomeHtml(true, `
            Вставлен магазин · Заряд <b>${newMag}/${maxMag}</b> · В запасе: <b>${newQty}</b> маг.
          `),
    sections: [newQty === 0
      ? `<div class="roll-allout-note">Боеприпасы <b>${esc(preferredAmmo.name)}</b> закончились!</div>`
      : ""]
  }, { sound: false });
}