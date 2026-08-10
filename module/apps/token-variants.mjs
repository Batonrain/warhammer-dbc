// ─────────────────────────────────────────────────────────────────────────────
//  ВАРИАНТЫ ТОКЕНА — «в шлеме / без шлема» и прочие облики.
//
//  ГМ заранее собирает набор картинок на акторе, игрок переключает облик сам
//  из меню токена. Набор живёт во флаге актора, а не в настройках мира:
//  так он переезжает вместе с актором в компендиум и обратно.
//
//  Флаг: warhammer-dbc.tokenVariants = [{ id, label, img }]
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM = "warhammer-dbc";
const FLAG   = "tokenVariants";

// В v13 FilePicker переехал в namespace, в v12 он глобальный — берём что есть.
const FP = () => foundry.applications?.apps?.FilePicker?.implementation || globalThis.FilePicker;

/** Набор вариантов актора (всегда массив). */
export function tokenVariants(actor) {
  const list = actor?.getFlag(SYSTEM, FLAG);
  return Array.isArray(list) ? list.filter(v => v && v.img) : [];
}

/** Текущая картинка токена — чтобы подсветить выбранный вариант. */
function currentImg(tokenDoc) {
  return tokenDoc?.texture?.src || "";
}

/**
 * Применить облик. Игроку достаточно прав на актора: он меняет свой токен,
 * а не чужие. Прототип трогаем только по галочке — иначе смена шлема в одной
 * сцене молча переписала бы облик по умолчанию для всех остальных.
 */
async function applyVariant(tokenDoc, img, alsoPrototype) {
  await tokenDoc.update({ "texture.src": img });
  if (alsoPrototype && tokenDoc.actor?.isOwner) {
    await tokenDoc.actor.update({ "prototypeToken.texture.src": img });
  }
}

/** Палитра обликов: превью, подпись, отметка текущего. */
function showVariantPalette(tokenDoc) {
  const actor = tokenDoc.actor;
  const list  = tokenVariants(actor);
  const cur   = currentImg(tokenDoc);
  const isGM  = game.user.isGM;

  if (!list.length) {
    if (!isGM) return ui.notifications.info("Для этого персонажа мастер не задал вариантов токена.");
    return showVariantManager(actor);
  }

  const cards = list.map(v => `
    <button type="button" class="tv-card ${v.img === cur ? "on" : ""}" data-img="${v.img}"
            title="${v.label || ""}">
      <img src="${v.img}"/>
      <span class="tv-card-lbl">${v.label || "Без названия"}</span>
    </button>`).join("");

  const dlg = new Dialog({
    title: `Облик токена — ${actor?.name ?? "токен"}`,
    content: `<form class="wh-token-variants">
      <div class="tv-list">${cards}</div>
      <label class="tv-proto">
        <input type="checkbox" id="tv-proto"/>
        Запомнить как облик по умолчанию (прототип токена)
      </label>
      ${isGM ? `<button type="button" class="tv-manage">Управление набором</button>` : ""}
    </form>`,
    buttons: { close: { label: "Закрыть" } },
    default: "close",
    render: html => {
      html.find(".tv-card").click(async ev => {
        const img = ev.currentTarget.dataset.img;
        const proto = html.find("#tv-proto")[0]?.checked;
        await applyVariant(tokenDoc, img, proto);
        dlg.close();
      });
      html.find(".tv-manage").click(() => { dlg.close(); showVariantManager(actor); });
    }
  }, { classes: ["dialog", "warhammer-dbc", "wh-holo"], width: 460 });
  dlg.render(true);
}

/** Управление набором — только ГМ. Добавление файлом или папкой целиком. */
export function showVariantManager(actor) {
  if (!game.user.isGM) return;

  const draw = () => {
    const list = tokenVariants(actor);
    const rows = list.length ? list.map((v, i) => `
      <div class="tvm-row" data-idx="${i}">
        <img src="${v.img}"/>
        <input type="text" class="tvm-label" value="${v.label || ""}" placeholder="Название облика"/>
        <span class="tvm-path" title="${v.img}">${v.img.split("/").pop()}</span>
        <button type="button" class="tvm-del" title="Убрать из набора">✕</button>
      </div>`).join("") : `<div class="tvm-empty">Набор пуст. Добавьте картинки токенов.</div>`;

    return `<form class="wh-token-variants-mgr">
      <div class="tvm-hint">Игроки увидят эти облики в меню своего токена и смогут
        переключаться сами. Название — то, что они прочитают: «В шлеме», «Без шлема».</div>
      <div class="tvm-list">${rows}</div>
      <div class="tvm-acts">
        <button type="button" class="tvm-add">+ Картинка</button>
        <button type="button" class="tvm-add-folder">+ Папка целиком</button>
        <button type="button" class="tvm-add-current">+ Текущий токен</button>
      </div>
    </form>`;
  };

  const dlg = new Dialog({
    title: `Варианты токена — ${actor.name}`,
    content: draw(),
    buttons: { close: { label: "Готово" } },
    default: "close",
    render: html => wireManager(html, actor, dlg, draw)
  }, { classes: ["dialog", "warhammer-dbc", "wh-holo"], width: 520 });
  dlg.render(true);
}

function wireManager(html, actor, dlg, draw) {
  const list  = () => tokenVariants(actor);
  const save  = async (arr) => {
    await actor.setFlag(SYSTEM, FLAG, arr);
    dlg.data.content = draw();
    dlg.render(true);
  };
  const newId = () => foundry.utils.randomID(8);
  // Имя файла без расширения — сносная подпись по умолчанию.
  const labelFromPath = (p) => decodeURIComponent(p.split("/").pop() || "").replace(/\.[^.]+$/, "");

  html.find(".tvm-del").click(async ev => {
    const i = Number(ev.currentTarget.closest(".tvm-row").dataset.idx);
    const arr = list(); arr.splice(i, 1);
    await save(arr);
  });

  // Подписи сохраняем на уходе фокуса, чтобы не дёргать флаг на каждой букве.
  html.find(".tvm-label").change(async ev => {
    const i = Number(ev.currentTarget.closest(".tvm-row").dataset.idx);
    const arr = list();
    if (arr[i]) { arr[i].label = ev.currentTarget.value; await actor.setFlag(SYSTEM, FLAG, arr); }
  });

  html.find(".tvm-add").click(() => {
    new (FP())({
      type: "image",
      current: actor.prototypeToken?.texture?.src || "",
      callback: async (path) => {
        const arr = list();
        if (arr.some(v => v.img === path)) return ui.notifications.info("Этот облик уже в наборе.");
        arr.push({ id: newId(), label: labelFromPath(path), img: path });
        await save(arr);
      }
    }).browse();
  });

  html.find(".tvm-add-folder").click(() => {
    new (FP())({
      type: "folder",
      callback: async (path) => {
        let res;
        try { res = await FP().browse("data", path); }
        catch (e) { return ui.notifications.error("Не удалось прочитать папку: " + e.message); }
        const imgs = (res?.files || []).filter(f => /\.(webp|png|jpe?g|gif|svg|avif)$/i.test(f));
        if (!imgs.length) return ui.notifications.warn("В папке нет картинок.");
        const arr = list();
        let added = 0;
        for (const f of imgs) {
          if (arr.some(v => v.img === f)) continue;
          arr.push({ id: newId(), label: labelFromPath(f), img: f });
          added++;
        }
        await save(arr);
        ui.notifications.info(`Добавлено обликов: ${added}.`);
      }
    }).browse();
  });

  html.find(".tvm-add-current").click(async () => {
    const img = canvas?.tokens?.controlled?.[0]?.document?.texture?.src
             || actor.prototypeToken?.texture?.src;
    if (!img) return ui.notifications.warn("Не удалось определить текущий токен.");
    const arr = list();
    if (arr.some(v => v.img === img)) return ui.notifications.info("Этот облик уже в наборе.");
    arr.push({ id: newId(), label: labelFromPath(img), img });
    await save(arr);
  });
}

/**
 * Кнопка в меню токена. Игроку показываем, только если облики заданы и токен
 * его — чужие переодевать нельзя. ГМу — всегда, чтобы собирать набор.
 */
export function initTokenVariants() {
  Hooks.on("renderTokenHUD", (hud, html, data) => {
    const tokenDoc = hud.object?.document;
    const actor    = tokenDoc?.actor;
    if (!actor) return;

    const isGM  = game.user.isGM;
    const owns  = actor.isOwner;
    const count = tokenVariants(actor).length;
    if (!isGM && (!owns || !count)) return;

    const el = html instanceof HTMLElement ? html : html?.[0];
    if (!el) return;
    // Разметка меню токена между версиями Foundry менялась — пробуем варианты,
    // в крайнем случае вешаем кнопку в сам корень меню.
    const col = el.querySelector(".col.left") || el.querySelector(".col-left")
             || el.querySelector(".left") || el;
    if (el.querySelector(".wh-token-variant-btn")) return;   // без дублей при перерисовке

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "control-icon wh-token-variant-btn";
    btn.dataset.action = "whTokenVariant";
    btn.title = count
      ? `Облик токена (${count})`
      : "Варианты токена — набор пуст";
    btn.innerHTML = `<i class="fas fa-masks-theater"></i>${count ? `<span class="wh-tv-count">${count}</span>` : ""}`;
    btn.addEventListener("click", ev => {
      ev.preventDefault();
      ev.stopPropagation();
      // ГМу правый клик открывает управление набором сразу.
      showVariantPalette(tokenDoc);
    });
    btn.addEventListener("contextmenu", ev => {
      ev.preventDefault();
      ev.stopPropagation();
      if (game.user.isGM) showVariantManager(actor);
    });
    col.appendChild(btn);
  });
}
