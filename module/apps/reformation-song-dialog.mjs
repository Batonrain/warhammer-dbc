// module/apps/reformation-song-dialog.mjs
// ════════════════════════════════════════════════════════════════════════
//  Диалог Reformation Song/Песня Изменений (Певцы Кости, wdbc-vwfk) — свой
//  многоцелевой пикер: до F.b психокостяных предметов (Оружие/Броня/
//  Снаряжение) в радиусе W м от кастера, per-target выбор Восстановление/
//  Разрушение. Не переиспользует module/apps/wraithbone-song-dialog.mjs —
//  тот бинарный (одна техника/область, один эффект на всех), здесь
//  наоборот много разных целей со своим режимом на каждую.
//
//  Кандидаты фильтруются РЕАЛЬНЫМИ флагами схемы item.system.wraithbone/
//  wraithboneImmune (не текстовой договорённостью) — см. комментарий у
//  этих полей в module/data/item/weapon.mjs.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import { reformationSongTargetCount, reformationSongRadius, applyReformationSong } from "../combat/reformation-song.mjs";

const CATEGORY_LABEL = { weapon: "Оружие", armor: "Броня", gear: "Снаряжение" };
const TARGET_TYPES = new Set(["weapon", "armor", "gear"]);

export async function showReformationSongDialog(actor) {
  const casterToken = actor.getActiveTokens?.(false, true)?.[0] ?? null;
  if (!casterToken) {
    ui.notifications?.warn("У актора нет токена на текущей сцене — радиус не от чего мерить.");
    return null;
  }

  const radius = reformationSongRadius(actor);
  const maxTargets = reformationSongTargetCount(actor);
  const tokens = tokensWithinRadius(casterToken, radius, { includeSelf: true, actorType: null });

  const rows = [];
  for (const tokenDoc of tokens) {
    const tActor = tokenDoc.actor;
    for (const item of tActor.items ?? []) {
      if (!TARGET_TYPES.has(item.type)) continue;
      if (!item.system?.wraithbone || item.system?.wraithboneImmune) continue;
      rows.push({ actorName: tActor.name, item });
    }
  }

  if (!rows.length) {
    ui.notifications?.warn(`Нет психокостяных предметов Оружия/Брони/Снаряжения (не отмеченных иммунными) в радиусе ${radius} м (W.b).`);
    return null;
  }

  const rowsHtml = rows.map((r, i) => `
    <div class="atk-dlg-row" style="align-items:center;gap:6px;">
      <label style="flex:1;"><input type="checkbox" class="rs-pick" data-idx="${i}"> ${esc(r.actorName)} — ${esc(r.item.name)} (${CATEGORY_LABEL[r.item.type]})</label>
      <select class="rs-mode" data-idx="${i}" disabled>
        <option value="restore">Восстановление</option>
        <option value="destroy">Разрушение</option>
      </select>
    </div>`).join("");

  const content = `
    <div class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-header"><span class="atk-weapon-name">Reformation Song / Песня Изменений</span></div>
      <div style="font-size:0.82em;color:#8a8a8a;margin-bottom:6px;">До ${maxTargets} предметов (F.b) в радиусе ${radius} м (W.b). Список уже отфильтрован по флагу «Психокостяное» и без пометки «Иммунно» — если нужного предмета нет в списке, отметьте ему system.wraithbone на листе (F12/правка данных).</div>
      <div class="rs-rows" style="max-height:360px;overflow-y:auto;">${rowsHtml}</div>
      <div class="rs-count" style="margin-top:6px;font-size:0.85em;">Выбрано: <span class="rs-count-n">0</span> / ${maxTargets}</div>
    </div>`;

  return foundry.applications.api.DialogV2.wait({
    window: { title: "Reformation Song / Песня Изменений" },
    classes: ["wh-attack-dialog", "warhammer-dbc"],
    position: { width: 480 },
    content,
    rejectClose: false,
    render: (event, dialog) => {
      const root = dialog.element;
      const countEl = root.querySelector(".rs-count-n");
      const sync = () => {
        const checked = [...root.querySelectorAll(".rs-pick")].filter(cb => cb.checked);
        countEl.textContent = String(checked.length);
        root.querySelectorAll(".rs-mode").forEach(sel => {
          const pick = root.querySelector(`.rs-pick[data-idx="${sel.dataset.idx}"]`);
          sel.disabled = !pick?.checked;
        });
      };
      root.querySelectorAll(".rs-pick").forEach(cb => {
        cb.addEventListener("change", () => {
          const checked = [...root.querySelectorAll(".rs-pick")].filter(x => x.checked);
          if (checked.length > maxTargets) {
            cb.checked = false;
            ui.notifications?.warn(`Не больше ${maxTargets} предметов (F.b).`);
          }
          sync();
        });
      });
      sync();
    },
    buttons: [
      {
        action: "go", label: "Применить", icon: "fas fa-yin-yang", default: true,
        callback: async (event, button) => {
          const form = button.form;
          const picks = [];
          form.querySelectorAll(".rs-pick").forEach(cb => {
            if (!cb.checked) return;
            const idx = Number(cb.dataset.idx);
            const mode = form.querySelector(`.rs-mode[data-idx="${idx}"]`)?.value || "restore";
            picks.push({ item: rows[idx].item, mode });
          });
          if (!picks.length) { ui.notifications?.warn("Выберите хотя бы один предмет."); return false; }
          await applyReformationSong(actor, picks);
        }
      },
      { action: "cancel", label: "Отмена" }
    ]
  }).then(res => res === false ? null : res);
}
