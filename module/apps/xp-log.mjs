// module/apps/xp-log.mjs
// ════════════════════════════════════════════════════════════════════════
//  Журнал опыта — отдельное окно (wdbc-ng7q). Раньше лента шла прямо в теле
//  вкладки Развитие и растягивала её на весь список; теперь окно открывается
//  кнопкой «Журнал опыта» и держится живым — перерисовывается, как только на
//  акторе меняется system.experience (ручное «＋», возврат за совпавшую
//  выдачу, покупка элитного архетипа — см. apps/stat-log.mjs,
//  apps/duplicate-refund.mjs, apps/elite-buy.mjs).
// ════════════════════════════════════════════════════════════════════════

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Записи журнала — свежие сверху (интересна последняя выдача, а не первая).
 * Дата короткая: год у одного персонажа всё равно один. Общий источник для
 * этого окна и для счётчика на кнопке (sheets/sheet-helpers.mjs).
 */
export function xpLogEntries(system) {
  return [...(Array.isArray(system?.experience?.log) ? system.experience.log : [])]
    .sort((a, b) => (b?.at || 0) - (a?.at || 0))
    .map(e => ({
      amount: Number(e?.amount) || 0,
      reason: e?.kind === "refund" ? `Возврат за ${e?.reason || "—"}` : (e?.reason || "—"),
      when: e?.at ? new Date(e.at).toLocaleString("ru", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""
    }));
}

export class XpLogApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["warhammer-dbc", "wh-holo", "wh-xplog"],
    window: { resizable: true },
    position: { width: 420, height: 480 }
  };

  static PARTS = {
    body: { template: "systems/warhammer-dbc/templates/apps/xp-log.hbs", root: true }
  };

  constructor(actor, options = {}) {
    super({ id: `wh-xplog-${actor.id}`, ...options });
    this.actorId = actor.id;
  }

  get actor() { return game.actors.get(this.actorId); }
  get title() { return `Журнал опыта — ${this.actor?.name || ""}`; }

  async _prepareContext() {
    const actor = this.actor;
    if (!actor) return { entries: [] };
    return { actorName: actor.name, entries: xpLogEntries(actor.system) };
  }

  async close(options) {
    if (_instances.get(this.actorId) === this) _instances.delete(this.actorId);
    return super.close(options);
  }
}

// Одно окно на актора: повторный клик по кнопке поднимает уже открытое,
// а не плодит второе с тем же DOM id.
const _instances = new Map();

export function openXpLog(actor) {
  if (!actor) return null;
  let app = _instances.get(actor.id);
  if (!app) { app = new XpLogApp(actor); _instances.set(actor.id, app); }
  app.render(true);
  return app;
}

Hooks.on("updateActor", (actor, changes) => {
  const app = _instances.get(actor.id);
  if (app?.rendered && changes.system?.experience) app.render(false);
});
