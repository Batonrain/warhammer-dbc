// ════════════════════════════════════════════════════════════════════════
//  Нексус Сцен — когитаторное окно (Warhammer DBC).
//  • Галерея сцен, сгруппированных по именованным ГРУППАМ (constants/scene-nexus).
//  • Игрок выбирает токен(ы) на текущей сцене и «прыгает» на сцену-переход —
//    токен телепортируется (создаётся на цели, удаляется с источника). Пере-
//    мещение выполняет активный ГМ через сокет; игрок затем видит целевую сцену.
//  • Каждая группа несёт ОБЩУЮ Завесу (кнопка открывает окно «Завеса» на группе).
//  Стиль — стандартный когитаторный (wh-holo), как у листов/Обзора систем.
// ════════════════════════════════════════════════════════════════════════

import { veilTotal, veilLevelInfo } from "../constants/veil.mjs";
import {
  NEXUS_SCOPE, SCENE_FLAG, sceneGroups, getGroup, sceneNexus, normalizeVeil,
  createGroup, renameGroup, setGroupColor, deleteGroup, moveGroup,
  addSceneToGroup, removeSceneFromGroup,
  createSubgroup, renameSubgroup, deleteSubgroup, assignSceneToSub, unassignScene
} from "../constants/scene-nexus.mjs";
import { openVeilMystic } from "./veil.mjs";
import { openEnvironment } from "./environment.mjs";
import { esc } from "../helpers/utils.mjs";

const { Application } = foundry.appv1.api;

// ── Телепорт токенов (исполняется активным ГМ; для ГМ — локально) ──────────
// Уведомить инициатора: себе — тост; игроку — через флаг его User (document-sync,
// надёжнее сырого сокета). Игрок ловит флаг в хуке updateUser (warhammer-dbc.mjs).
function _nexusNotify(requester, kind, text) {
  if (!requester || requester.id === game.user.id) {
    ui.notifications?.[kind === "error" ? "error" : kind === "info" ? "info" : "warn"](text);
    return;
  }
  try { game.users.get(requester.id)?.setFlag(NEXUS_SCOPE, "nexusGoto", { msg: { kind, text }, ts: Date.now() }); } catch (e) {}
}

// data: { fromSceneId, toSceneId, tokenIds:[] }; requester — User-инициатор.
export async function execSceneTeleport(data, requester) {
  try {
    const from = game.scenes.get(data.fromSceneId);
    const to   = game.scenes.get(data.toSceneId);
    if (!from || !to) { console.warn("Нексус: сцена не найдена", data); return; }
    if (from.id === to.id) return;
    const nx = sceneNexus(to);
    if (!requester.isGM && !nx.open) { ui.notifications?.warn(`Нексус: переход на «${to.name}» закрыт.`); return; }

    const grid = to.grid?.size || 100;
    const cx = Number(to.width)  || (grid * 20);
    const cy = Number(to.height) || (grid * 20);
    const base = (nx.entry && Number.isFinite(nx.entry.x))
      ? { x: nx.entry.x, y: nx.entry.y }
      : { x: Math.round(cx / 2), y: Math.round(cy / 2) };

    console.log("Warhammer DBC | Нексус: приём телепорта", { from: from.name, to: to.name, tokenIds: data.tokenIds, by: requester.name });

    const news = [], dels = [];
    let i = 0, missing = 0;
    for (const tid of (Array.isArray(data.tokenIds) ? data.tokenIds : [])) {
      const tok = from.tokens.get(tid);
      if (!tok) { missing++; console.warn("Нексус: токен не найден на сцене-источнике", tid); continue; }
      // Проверку прав НЕ делаем блокирующей: игрок смог выделить токен → владеет им.
      // Перемещение всё равно исполняет ГМ (полные права), так что это безопасно.
      const obj = tok.toObject();
      delete obj._id;
      obj.x = base.x + (i % 4) * grid;
      obj.y = base.y + Math.floor(i / 4) * grid;
      news.push(obj); dels.push(tid); i++;
    }
    if (!news.length) {
      const text = missing ? "Нексус: токен не найден на исходной сцене."
                           : "Нексус: не передано ни одного токена.";
      _nexusNotify(requester, "warn", text);
      return;
    }

    const created = await to.createEmbeddedDocuments("Token", news);
    await from.deleteEmbeddedDocuments("Token", dels);

    // Дать ПУТЕШЕСТВЕННИКУ (и только ему) право видеть целевую сцену для view().
    // Персональное право (ownership.<userId>), а не default — остальные игроки
    // скрытую сцену по-прежнему не видят.
    if (!requester.isGM && !to.testUserPermission(requester, "OBSERVER")) {
      try { await to.update({ [`ownership.${requester.id}`]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER }); }
      catch (e) { console.warn("Нексус: не удалось выдать право просмотра", e); }
    }

    ui.notifications?.info(`Нексус: ${created.length} токен(ов) → «${to.name}» (${requester.name}).`);

    // Показать целевую сцену путешественнику: сам — view(); игрок — через флаг
    // его User (его хук updateUser вызовет view() на его клиенте).
    if (requester.id === game.user.id) { try { await to.view(); } catch (e) {} }
    else { try { await game.users.get(requester.id)?.setFlag(NEXUS_SCOPE, "nexusGoto", { toSceneId: to.id, ts: Date.now() }); } catch (e) {} }
  } catch (e) {
    console.error("Warhammer DBC | Нексус телепорт:", e);
    _nexusNotify(requester, "error", `Нексус: ошибка перемещения — ${e?.message || e}`);
  }
}

export class SceneNexus extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "wh-scene-nexus",
      classes: ["warhammer-dbc", "wh-holo", "wh-scene-nexus"],
      title: "Нексус Сцен",
      template: "systems/warhammer-dbc/templates/apps/scene-nexus.hbs",
      width: 880, height: 720, resizable: true,
      scrollY: [".wh-nx-body"]
    });
  }

  constructor(...args) {
    super(...args);
    this._collapsed = this._loadCollapsed();   // свёрнутые группы/подгруппы — постоянно (localStorage)
  }
  _loadCollapsed() { try { return JSON.parse(localStorage.getItem("wh-nexus-collapsed") || "{}") || {}; } catch (e) { return {}; } }
  _saveCollapsed() { try { localStorage.setItem("wh-nexus-collapsed", JSON.stringify(this._collapsed)); } catch (e) {} }
  _toggleCollapse(id) { this._collapsed[id] = !this._collapsed[id]; this._saveCollapsed(); this.render(false); }

  getData() {
    const isGM    = game.user.isGM;
    const curId   = canvas?.scene?.id || game.scenes?.current?.id || "";
    const activeId = game.scenes?.active?.id || "";
    const controlled = canvas?.tokens?.controlled || [];

    // Присутствие игроков: активный (не-ГМ) пользователь → сцена, которую он смотрит.
    const presence = {};
    for (const u of game.users) {
      if (!u.active || u.isGM) continue;
      const sid = u.viewedScene;
      if (!sid) continue;
      (presence[sid] ||= []).push({
        name: u.name, color: String(u.color || "#cccccc"),
        initials: (u.name || "?").trim().slice(0, 2).toUpperCase()
      });
    }

    // Полный путь по папкам сцены («Папка / Подпапка») — для деления списка добавления.
    const folderPath = (sc) => {
      let f = sc.folder, guard = 0; const parts = [];
      while (f && guard++ < 12) { parts.unshift(f.name); f = f.folder; }
      return parts.join(" / ");
    };
    // Сцены, ещё не входящие в группу, сгруппированные по папкам (как в боковой панели).
    const addableByFolder = (inIds) => {
      const buckets = new Map();
      for (const s of game.scenes) {
        if (inIds.has(s.id)) continue;
        const label = folderPath(s) || "— Без папки —";
        if (!buckets.has(label)) buckets.set(label, []);
        buckets.get(label).push({ id: s.id, name: s.name });
      }
      return [...buckets.entries()]
        .sort((a, b) => (a[0].startsWith("—") ? 1 : b[0].startsWith("—") ? -1 : a[0].localeCompare(b[0], "ru")))
        .map(([label, scenes]) => ({ label, scenes: scenes.sort((x, y) => x.name.localeCompare(y.name, "ru")) }));
    };

    // Карточка сцены → объект для партиала nexus-card. null — если игрок не видит.
    const card = (id, groupId, subId) => {
      const sc = game.scenes.get(id); if (!sc) return null;
      const nx = sceneNexus(sc);
      if (!isGM && !nx.open) return null;                          // игрок видит только открытые переходы
      const here = presence[sc.id] || [];
      return {
        id: sc.id, name: nx.label || sc.name, groupId, subId: subId || "",
        thumb: sc.thumb || sc.background?.src || "",
        isCurrent: sc.id === curId, isActive: sc.id === activeId,
        open: nx.open, hasEntry: !!nx.entry,
        players: here, hasPlayers: here.length > 0
      };
    };

    const list = sceneGroups().slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const groups = [];
    for (const g of list) {
      const inIds = new Set(g.sceneIds || []);
      const subs = Array.isArray(g.subgroups) ? g.subgroups : [];
      const subSceneIds = new Set(subs.flatMap(s => s.sceneIds || []));
      let count = 0;

      // Подгруппы
      const subgroups = subs.map(sub => {
        const cards = (sub.sceneIds || []).map(id => card(id, g.id, sub.id)).filter(Boolean);
        count += cards.length;
        return {
          id: sub.id, name: sub.name, key: `${g.id}:${sub.id}`,
          cards, hasCards: cards.length > 0, count: cards.length,
          collapsed: !!this._collapsed[`${g.id}:${sub.id}`]
        };
      }).filter(s => isGM || s.hasCards);                          // пустые подгруппы игрок не видит

      // «Прочие» сцены группы (не в подгруппах)
      const looseCards = (g.sceneIds || []).filter(id => !subSceneIds.has(id)).map(id => card(id, g.id, "")).filter(Boolean);
      count += looseCards.length;

      if (!isGM && count === 0) continue;                          // пустую для игрока группу скрываем

      // Список свободных сцен группы (для «+ в подгруппу»)
      const looseAddable = isGM ? (g.sceneIds || []).filter(id => !subSceneIds.has(id))
        .map(id => game.scenes.get(id)).filter(Boolean)
        .map(s => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name, "ru")) : [];

      const total = veilTotal(normalizeVeil(g.veil));
      const info  = veilLevelInfo(total);
      groups.push({
        id: g.id, name: g.name, color: g.color || "#4dffa6",
        collapsed: !!this._collapsed[g.id],
        subgroups, hasSubgroups: subgroups.length > 0,
        looseCards, hasLoose: looseCards.length > 0, count,
        veilTotal: total, veilSigned: (total > 0 ? "+" : "") + total,
        veilTier: info.tier, veilLabel: info.label,
        addable: isGM ? addableByFolder(inIds) : [],
        looseAddable, hasLooseAddable: looseAddable.length > 0
      });
    }

    return {
      isGM,
      groups, hasGroups: groups.length > 0,
      selCount: controlled.length, hasSel: controlled.length > 0,
      selText: controlled.map(t => t.name).join(", "),
      curName: canvas?.scene?.name || "— нет активной сцены —"
    };
  }

  // ── Запрос телепорта выбранных токенов на сцену sceneId ──────────────────
  async requestTeleport(sceneId) {
    const controlled = canvas?.tokens?.controlled || [];
    const from = canvas?.scene;
    const to   = game.scenes.get(sceneId);
    if (!to || !from) return;
    if (to.id === from.id) { ui.notifications?.info("Токен уже на этой сцене."); return; }
    if (!controlled.length) { ui.notifications?.warn("Сначала выберите токен на текущей сцене."); return; }
    if (!game.user.isGM && !sceneNexus(to).open) { ui.notifications?.warn("Этот переход закрыт Мастером."); return; }

    const payload = {
      action: "sceneTeleport", userId: game.user.id,
      fromSceneId: from.id, toSceneId: to.id, tokenIds: controlled.map(t => t.id)
    };

    // Создание токенов в Foundry доступно ТОЛЬКО ГМу (даже OWNER на сцене не даёт
    // игроку это право — сервер отклоняет). Поэтому: ГМ делает локально, игрок —
    // через активного ГМа по сокету.
    if (game.user.isGM) {
      await execSceneTeleport(payload, game.user);
      return;
    }
    if (!game.users.activeGM) { ui.notifications?.error("Нет активного Мастера — перемещение невозможно."); return; }
    // Надёжный канал: пишем запрос во флаг СВОЕГО User-документа. Активный ГМ
    // выполнит перенос по хуку updateUser (сырой сокет в этом мире не доходил).
    await game.user.setFlag(NEXUS_SCOPE, "nexusReq", {
      fromSceneId: from.id, toSceneId: to.id, tokenIds: controlled.map(t => t.id), ts: Date.now()
    });
    ui.notifications?.info(`Перемещение на «${to.name}»…`);
  }

  // ── Подсказка ГМу: токены на сцене (иконка + имя), когитаторная сетка ──────
  _tokenTipContent(sc) {
    const toks = sc.tokens?.contents || [];
    const wrap = document.createElement("div");
    wrap.className = "wh-nx-tip";
    if (!toks.length) { wrap.innerHTML = `<div class="wh-nx-tip-empty">На сцене нет токенов</div>`; return wrap; }
    const CAP = 24;
    const rows = toks.slice(0, CAP).map(t => {
      const img = t.texture?.src || t.actor?.img || "";
      const nm  = esc(t.name || t.actor?.name || "—");
      const ic  = img ? `<img src="${esc(img)}" loading="lazy"/>` : `<span class="wh-nx-tip-noimg">◈</span>`;
      return `<div class="wh-nx-tip-tok${t.hidden ? " hidden" : ""}">${ic}<span class="wh-nx-tip-nm">${nm}</span></div>`;
    }).join("");
    const more = toks.length > CAP ? `<div class="wh-nx-tip-more">…и ещё ${toks.length - CAP}</div>` : "";
    wrap.innerHTML = `<div class="wh-nx-tip-head">Токены · ${toks.length}</div><div class="wh-nx-tip-grid">${rows}${more}</div>`;
    return wrap;
  }

  // ── Посмотреть сцену без перемещения токена (локальный view своей канвы) ──
  peekScene(sceneId) {
    const sc = game.scenes.get(sceneId); if (!sc) return;
    if (canvas?.scene?.id === sc.id) { ui.notifications?.info("Вы уже смотрите эту сцену."); return; }
    if (!game.user.isGM && !sc.testUserPermission(game.user, "OBSERVER")) {
      ui.notifications?.warn("Эту сцену смотреть нельзя — Мастер не открыл к ней доступ.");
      return;
    }
    try { sc.view(); } catch (e) { ui.notifications?.error("Не удалось открыть сцену для просмотра."); }
  }

  // ── Переключить «переход открыт» ─────────────────────────────────────────
  // Открытый переход выдаёт сцене default=OBSERVER — этого хватает игроку, чтобы
  // после переноса ГМом сработал view(). navigation=false — чтобы сцена НЕ
  // всплывала в верхней панели навигации (утечки нет: боковой панели сцен у
  // игроков нет). Создание токена делает ГМ. Закрытие → NONE.
  async _toggleOpen(sceneId) {
    const sc = game.scenes.get(sceneId); if (!sc) return;
    const open = !sceneNexus(sc).open;
    const L = CONST.DOCUMENT_OWNERSHIP_LEVELS;
    const upd = { [`flags.${NEXUS_SCOPE}.${SCENE_FLAG}.open`]: open };
    if (open) { upd["ownership.default"] = L.OBSERVER; upd["navigation"] = false; }
    else       { upd["ownership.default"] = L.NONE; }
    await sc.update(upd);
    this.render();
  }

  // Разовая синхронизация прав уже-открытых переходов (после обновления кода):
  // проставляет OBSERVER + navigation:false там, где переход открыт, но прав нет.
  async _syncTransitionPerms() {
    if (!game.user.isGM || this._syncedPerms) return;
    this._syncedPerms = true;
    const L = CONST.DOCUMENT_OWNERSHIP_LEVELS;
    const ups = [];
    for (const g of sceneGroups()) for (const id of (g.sceneIds || [])) {
      const sc = game.scenes.get(id);
      if (sc && sceneNexus(sc).open && (sc.ownership?.default ?? 0) < L.OBSERVER) {
        ups.push(sc.update({ "ownership.default": L.OBSERVER, navigation: false }));
      }
    }
    if (ups.length) { await Promise.all(ups); this.render(); }
  }

  activateListeners(html) {
    super.activateListeners(html);
    const el = html[0] ?? html;
    const isGM = game.user.isGM;

    // Клик по карточке — телепорт выбранных токенов.
    el.querySelectorAll("[data-jump]").forEach(c => c.addEventListener("click", ev => {
      if (ev.target.closest("[data-card-tool]")) return;          // клики по инструментам ГМа не прыгают
      this.requestTeleport(c.dataset.jump);
    }));

    // Смотреть сцену без перемещения токена (только своя канва) — доступно всем.
    el.querySelectorAll("[data-peek]").forEach(b => b.addEventListener("click", ev => {
      ev.stopPropagation();
      this.peekScene(b.dataset.peek);
    }));

    // Свернуть/развернуть группу или подгруппу (состояние сохраняется в localStorage).
    el.querySelectorAll("[data-gcollapse]").forEach(b => b.addEventListener("click", ev => {
      ev.stopPropagation();
      this._toggleCollapse(b.dataset.gcollapse);
    }));

    if (!isGM) return; // ── дальше — управление ГМа ──

    this._syncTransitionPerms();   // разово выдать права уже-открытым переходам

    // Подсказка со списком токенов сцены при наведении на карточку (только ГМ).
    el.querySelectorAll(".wh-nx-card").forEach(card => {
      const sc = game.scenes.get(card.dataset.jump);
      if (!sc) return;
      card.addEventListener("mouseenter", () => {
        try {
          const c = this._tokenTipContent(sc);
          game.tooltip.activate(card, { content: c, html: c, cssClass: "wh-nx-tip-tt" });
        } catch (e) {}
      });
      card.addEventListener("mouseleave", () => { try { game.tooltip.deactivate(); } catch (e) {} });
    });

    // Создать группу
    el.querySelector("[data-act=addGroup]")?.addEventListener("click", async () => {
      await createGroup("Новая группа"); this.render();
    });

    // Заголовок группы: переименовать / цвет / порядок / удалить / Завеса
    el.querySelectorAll("[data-grename]").forEach(b => b.addEventListener("click", () => {
      const id = b.dataset.grename; const g = getGroup(id); if (!g) return;
      this._promptText("Название группы", g.name, async v => { await renameGroup(id, v); this.render(); });
    }));
    el.querySelectorAll("[data-gcolor]").forEach(inp => inp.addEventListener("change", async e => {
      await setGroupColor(inp.dataset.gcolor, e.target.value); this.render();
    }));
    el.querySelectorAll("[data-gup]").forEach(b => b.addEventListener("click", async () => { await moveGroup(b.dataset.gup, -1); this.render(); }));
    el.querySelectorAll("[data-gdown]").forEach(b => b.addEventListener("click", async () => { await moveGroup(b.dataset.gdown, 1); this.render(); }));
    el.querySelectorAll("[data-gdel]").forEach(b => b.addEventListener("click", async () => {
      const g = getGroup(b.dataset.gdel); if (!g) return;
      const ok = await Dialog.confirm({ title: "Удалить группу", content: `<p>Удалить группу «${esc(g.name)}»? Сцены и их Завеса-флаги останутся, удалится только группа (и её общая Завеса).</p>` });
      if (ok) { await deleteGroup(b.dataset.gdel); this.render(); }
    }));
    el.querySelectorAll("[data-gveil]").forEach(b => b.addEventListener("click", async () => {
      const g = getGroup(b.dataset.gveil); if (!g) return;
      const first = (g.sceneIds || []).map(id => game.scenes.get(id)).find(Boolean);
      if (!first) { ui.notifications?.warn("В группе нет сцен — добавьте сцену, чтобы задать Завесу."); return; }
      try { await first.view(); } catch (e) {}
      openVeilMystic();
    }));
    el.querySelectorAll("[data-genv]").forEach(b => b.addEventListener("click", async () => {
      const g = getGroup(b.dataset.genv); if (!g) return;
      const first = (g.sceneIds || []).map(id => game.scenes.get(id)).find(Boolean);
      if (!first) { ui.notifications?.warn("В группе нет сцен — добавьте сцену, чтобы задать Окружение."); return; }
      try { await first.view(); } catch (e) {}
      openEnvironment();
    }));

    // Добавить сцену в группу
    el.querySelectorAll("[data-gaddscene]").forEach(sel => sel.addEventListener("change", async e => {
      if (!e.target.value) return;
      await addSceneToGroup(sel.dataset.gaddscene, e.target.value); this.render();
    }));

    // ── Подгруппы ──
    el.querySelectorAll("[data-subcreate]").forEach(b => b.addEventListener("click", () => {
      const gid = b.dataset.subcreate;
      this._promptText("Название подгруппы", "Новая подгруппа", async v => { await createSubgroup(gid, v); this.render(); });
    }));
    el.querySelectorAll("[data-subrename]").forEach(b => b.addEventListener("click", () => {
      const gid = b.dataset.subrename, sid = b.dataset.sub;
      const sub = getGroup(gid)?.subgroups?.find(s => s.id === sid);
      this._promptText("Название подгруппы", sub?.name || "", async v => { await renameSubgroup(gid, sid, v); this.render(); });
    }));
    el.querySelectorAll("[data-subdel]").forEach(b => b.addEventListener("click", async () => {
      const ok = await Dialog.confirm({ title: "Удалить подгруппу", content: "<p>Удалить подгруппу? Её сцены вернутся в общий список группы (сами сцены не удаляются).</p>" });
      if (ok) { await deleteSubgroup(b.dataset.subdel, b.dataset.sub); this.render(); }
    }));
    el.querySelectorAll("[data-subaddscene]").forEach(sel => sel.addEventListener("change", async e => {
      if (!e.target.value) return;
      await assignSceneToSub(sel.dataset.subaddscene, sel.dataset.sub, e.target.value); this.render();
    }));
    el.querySelectorAll("[data-unassign]").forEach(b => b.addEventListener("click", async e => {
      e.stopPropagation();
      await unassignScene(b.dataset.group, b.dataset.unassign); this.render();
    }));

    // Инструменты карточки (ГМ): открыть переход / вид / активировать / вход / убрать
    el.querySelectorAll("[data-toggleopen]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); this._toggleOpen(b.dataset.toggleopen); }));
    el.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); game.scenes.get(b.dataset.view)?.view(); }));
    el.querySelectorAll("[data-activate]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); game.scenes.get(b.dataset.activate)?.activate(); }));
    el.querySelectorAll("[data-remove]").forEach(b => b.addEventListener("click", async e => {
      e.stopPropagation();
      await removeSceneFromGroup(b.dataset.group, b.dataset.remove); this.render();
    }));
    // Точка входа = позиция единственного выбранного токена (если карта = текущая сцена)
    el.querySelectorAll("[data-setentry]").forEach(b => b.addEventListener("click", async e => {
      e.stopPropagation();
      const sc = game.scenes.get(b.dataset.setentry); if (!sc) return;
      if (canvas?.scene?.id !== sc.id) { ui.notifications?.warn("Откройте эту сцену и выберите токен, чтобы задать точку входа."); return; }
      const tok = (canvas?.tokens?.controlled || [])[0];
      if (!tok) { ui.notifications?.warn("Выберите один токен — его позиция станет точкой входа."); return; }
      await sc.update({ [`flags.${NEXUS_SCOPE}.${SCENE_FLAG}.entry`]: { x: tok.document.x, y: tok.document.y } });
      ui.notifications?.info(`Точка входа для «${sc.name}» задана.`);
      this.render();
    }));
  }

  _promptText(title, value, cb) {
    new Dialog({
      title,
      content: `<form class="ss-gen"><label class="ss-gen-field"><span>${title}</span><input type="text" id="nx-txt" value="${esc(value)}"/></label></form>`,
      buttons: {
        ok: { icon: '<i class="fas fa-check"></i>', label: "OK", callback: h => cb((h.find("#nx-txt").val() || "").trim()) },
        cancel: { label: "Отмена" }
      },
      default: "ok"
    }, { width: 380, classes: ["warhammer-dbc", "wh-holo"] }).render(true);
  }

  async close(options) { _instance = null; return super.close(options); }
}

let _instance = null;
export function openSceneNexus() {
  if (!_instance) _instance = new SceneNexus();
  _instance.render(true);
  return _instance;
}
export function refreshSceneNexus() { if (_instance?.rendered) _instance.render(false); }
