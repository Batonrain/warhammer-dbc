/**
 * Механика Силовых щитов Warhammer FFG.
 *
 * При получении попадания персонаж бросает d100:
 *   rv ≤ rating              → щит поглощает удар (попадание аннулировано)
 *   rating < rv ≤ rating+threshold → перегрузка (щит отключается, нужен ремонт)
 *   rv > rating + threshold  → щит не сработал
 */

import { SHIELD_STATUS } from "../constants/shields.mjs";
import { applyShieldOverloadQuality } from "../constants/quality.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

// Источник состояния щита: у forcefield — прямо в system; у импланта (Боевые Латы
// Скитарии и т.п. со встроенным дефлектором) — в system.shield. Возвращаем сам
// под-объект и префикс пути для item.update().
function _sstate(item) {
  return item.type === "implant"
    ? { sys: item.system.shield || {}, p: "system.shield." }
    : { sys: item.system,             p: "system." };
}

// ── Вкл/выкл щит ─────────────────────────────────────────────────────────────

export async function _toggleShield(actor, item) {
  const { sys, p } = _sstate(item);
  const status = sys.status || "inactive";

  // Перегружен/повреждён — только выключить
  if (status === "overloaded" || status === "damaged") {
    await item.update({
      [p + "status"]:        "inactive",
      [p + "equipped"]:      false,
      [p + "currentRating"]: 0
    });
    await _shieldChatMsg(actor, item,
      `${rollIcon("shield","#ff6b6b")}Щит деактивирован`,
      `${item.name} выключен вручную.`,
      "shield-msg-off"
    );
    return;
  }

  if (status === "active") {
    // Выключить
    await item.update({
      [p + "status"]:        "inactive",
      [p + "equipped"]:      false,
      [p + "currentRating"]: 0
    });
    await _shieldChatMsg(actor, item,
      `${rollIcon("shield","#ff6b6b")}Щит деактивирован`,
      `${item.name} выключен.`,
      "shield-msg-off"
    );
  } else {
    // Включить. Рейтинг щита ФИКСИРОВАН (это верхняя граница диапазона «1–X»,
    // а не результат броска) — стр. 240. Бросок d100 делается только при
    // получении попадания (_rollShieldActivation), а не при активации.
    let rating = sys.currentRating || 0;

    if (!sys.isSpecialRating) {
      const max = sys.ratingMax || 35;
      // Рейтинг не может быть > 99 (с перегрузкой) или > 90 (без)
      const cap = (sys.overloadThreshold > 0) ? 99 : 90;
      rating = Math.min(max, cap);
    }
    // Особый рейтинг (Мерцающие Робы 1–PR×9 и т.п.) — берём как есть из currentRating.

    // Правило одной природы: одновременно активен только один щит каждой
    // природы. Включение второго перегружаемого не-дефлекторного щита той же
    // природы перегружает оба (стр. 240) — тогда новый щит не активируется, а
    // сам уходит в перегрузку. Дефлекторы и неперегружаемые щиты взаимную
    // перегрузку не вызывают: прежний просто выключается.
    const conflict = await _enforceSingleShieldPerNature(actor, item, sys);
    if (conflict.selfOverload) {
      await item.update({
        [p + "status"]:        "overloaded",
        [p + "equipped"]:      false,
        [p + "currentRating"]: 0
      });
      await _shieldChatMsg(actor, item,
        `${rollIcon("warn","#ffb84d")}Взаимная перегрузка`,
        `${item.name} перегрузился при попытке активировать второй ${_shieldNatureLabel(sys.shieldNature).toLowerCase()} щит той же природы — оба требуют обслуживания.`,
        "shield-msg-overload"
      );
      return;
    }

    if (sys.isSpecialRating) {
      await _shieldChatMsg(actor, item,
        `${rollIcon("shield","#4dffa6")}Щит активирован`,
        `${item.name} активирован (особый рейтинг: ${rating}).`,
        "shield-msg-active"
      );
    } else {
      await _shieldChatMsg(actor, item,
        `${rollIcon("shield","#4dffa6")}Щит активирован`,
        `${item.name} — рейтинг <b>1–${rating}</b>${sys.overloadThreshold > 0
          ? `, перегрузка 1–${sys.overloadThreshold}` : ", без перегрузки"}. ` +
        `Тип: ${_shieldTypeLabel(sys.shieldType)}, природа: ${_shieldNatureLabel(sys.shieldNature)}.`,
        "shield-msg-active"
      );
    }

    await item.update({
      [p + "status"]:        "active",
      [p + "equipped"]:      true,
      [p + "currentRating"]: rating
    });
  }
}

// Разруливает уже активные щиты той же природы при включении нового (стр. 240).
// Дефлектор с любой из сторон конфликта сосуществует — перегрузки нет. Между
// двумя перегружаемыми не-дефлекторными щитами одной природы — взаимная
// перегрузка (оба выбывают, включая новый → возвращаем selfOverload). Прочие
// конфликтующие щиты (неперегружаемые не-дефлекторы) просто выключаются.
// Не-выключаемые источники (импланты/трейты/техночудеса) сюда не попадают.
async function _enforceSingleShieldPerNature(actor, newItem, newSys) {
  const nature = newSys.shieldNature || "technological";
  const others = actor.items.contents.filter(i =>
    i.id !== newItem.id &&
    i.type === "forcefield" &&
    (i.system.status === "active") &&
    (i.system.shieldNature || "technological") === nature
  );
  if (!others.length) return { selfOverload: false };

  const newDeflector = newSys.shieldType === "deflector";
  const newOverloads = (newSys.overloadThreshold || 0) > 0;
  let selfOverload = false;

  for (const other of others) {
    const os = other.system;
    const otherDeflector = os.shieldType === "deflector";
    const otherOverloads = (os.overloadThreshold || 0) > 0;
    // Дефлектор с любой стороны — сосуществование без перегрузки.
    if (newDeflector || otherDeflector) continue;

    if (newOverloads && otherOverloads) {
      // Взаимная перегрузка: гаснут оба.
      selfOverload = true;
      await other.update({ "system.status": "overloaded", "system.equipped": false, "system.currentRating": 0 });
      await _shieldChatMsg(actor, other,
        `${rollIcon("warn","#ffb84d")}Взаимная перегрузка`,
        `${other.name} перегружен: активирован второй ${_shieldNatureLabel(nature).toLowerCase()} щит той же природы.`,
        "shield-msg-overload"
      );
    } else {
      // Хотя бы один неперегружаемый — прежний просто выключается.
      await other.update({ "system.status": "inactive", "system.equipped": false, "system.currentRating": 0 });
      await _shieldChatMsg(actor, other,
        `${rollIcon("shield","#ff6b6b")}Щит выключен`,
        `${other.name} выключен: одновременно активен только один ${_shieldNatureLabel(nature).toLowerCase()} щит.`,
        "shield-msg-off"
      );
    }
  }
  return { selfOverload };
}

// ── Бросок щита при попадании ─────────────────────────────────────────────────

export async function _rollShieldActivation(actor, item) {
  const { sys, p } = _sstate(item);

  if (sys.status !== "active") {
    ui.notifications.warn(`${item.name}: щит не активен. Сначала включите щит.`);
    return null;
  }

  const rating    = sys.currentRating    || 0;
  // Качество влияет на рейтинг Перегрузки только у силовых полей (forcefield);
  // у имплантов со встроенным дефлектором качество к перегрузке не применяется.
  const threshold = applyShieldOverloadQuality(
    sys.overloadThreshold || 0,
    item.type === "forcefield" ? item.system.quality : "common"
  );

  const roll = await new Roll("1d100").evaluate();
  const rv   = roll.total;

  // Стр. 240: бросок в пределах рейтинга → удар нивелирован. Бросок в пределах
  // рейтинга перегрузки (после «/») — это ПОДМНОЖЕСТВО успеха (низкий бросок):
  // щит СРАБАТЫВАЕТ (удар поглощён), но перегружается и выключается.
  const absorbed   = rv <= rating;
  const overloaded = absorbed && threshold > 0 && rv <= threshold;

  let msgTitle = "";
  let msgBody  = "";
  let msgCss   = "";

  if (overloaded) {
    msgTitle = `${rollIcon("shield","#ffb84d")}Щит поглотил удар и перегрузился!`;
    msgBody  = `Бросок <b>${rv}</b> ≤ Рейтинг <b>${rating}</b> — попадание аннулировано,
                но результат попал в рейтинг перегрузки (≤ ${threshold}).
                Щит отключён, требует обслуживания перед повторной активацией.`;
    msgCss   = "shield-msg-overload";
    await item.update({
      [p + "status"]:        "overloaded",
      [p + "equipped"]:      false,
      [p + "currentRating"]: 0
    });

  } else if (absorbed) {
    msgTitle = `${rollIcon("shield","#4dffa6")}Щит поглотил удар!`;
    msgBody  = `Бросок <b>${rv}</b> ≤ Рейтинг <b>${rating}</b> — попадание аннулировано.`;
    msgCss   = "shield-msg-absorbed";

  } else {
    msgTitle = "Щит не сработал";
    msgBody  = `Бросок <b>${rv}</b> &gt; Рейтинг <b>${rating}</b> — щит не активировался, урон проходит.`;
    msgCss   = "shield-msg-fail";
  }

  const rollMode = game.settings.get("core", "rollMode");
  const msgData  = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-shield-msg ${msgCss}">
        <div class="shield-msg-header">${msgTitle}</div>
        <div class="shield-msg-shield-name">
          ${_shieldNatureIcon(sys.shieldNature)} ${item.name}
        </div>
        <div class="shield-msg-body">${msgBody}</div>
        <div class="shield-msg-stats">
          Рейтинг: <b>${rating}</b> |
          Порог перегрузки: <b>${threshold > 0 ? threshold : "−"}</b> |
          Тип: ${_shieldTypeLabel(sys.shieldType)} |
          Природа: ${_shieldNatureLabel(sys.shieldNature)}
        </div>
      </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  }, rollMode);
  await ChatMessage.create(msgData);

  return { absorbed, overloaded, roll: rv };
}

// ── Ремонт щита ───────────────────────────────────────────────────────────────

export async function _repairShield(actor, item) {
  const { p } = _sstate(item);
  await item.update({
    [p + "status"]:        "inactive",
    [p + "equipped"]:      false,
    [p + "currentRating"]: 0
  });
  await _shieldChatMsg(actor, item,
    `${rollIcon("wrench","#6fe6ff")}Щит отремонтирован`,
    `${item.name} восстановлен и готов к активации.`,
    "shield-msg-repair"
  );
}

// ── Вспомогательные ───────────────────────────────────────────────────────────

function _shieldTypeLabel(type) {
  const map = { dome: "Купол", deflector: "Дефлектор", penetrating: "Сквозной" };
  return map[type] || type;
}

function _shieldNatureLabel(nature) {
  return nature === "warp" ? "Чародейский" : "Технологический";
}

function _shieldNatureIcon(nature) {
  return nature === "warp" ? rollIcon("spark","#c98bff") : rollIcon("gear","#8fd0ff");
}

async function _shieldChatMsg(actor, item, title, body, css) {
  const rollMode = game.settings.get("core", "rollMode");
  const msgData  = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-shield-msg ${css}">
        <div class="shield-msg-header">${title}</div>
        <div class="shield-msg-shield-name">
          ${_shieldNatureIcon(_sstate(item).sys.shieldNature)} ${item.name}
        </div>
        <div class="shield-msg-body">${body}</div>
      </div>`
  }, rollMode);
  await ChatMessage.create(msgData);
}