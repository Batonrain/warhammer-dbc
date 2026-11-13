// module/rules/cognis.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Когнис (Cognis) — свойство оружия, книга «Особые Свойства Оружия».
//
//  «Священное оружие Механикум рассчитано на единение с техножрецом, и его дух
//  машины не принимает команд от непосвящённых. Если оно не установлено на
//  технике, им может атаковать только персонаж с Трейтом Mechanicum Implants,
//  подключившись к нему Электро-Графтами. Если оно установлено на технике,
//  подключившийся к ней через Электро-Графты или Ноосферу персонаж может
//  атаковать им вместо оператора. Он может в любом случае потратить 1
//  [Когниция], чтобы использовать свой I вместо WS или BS для атаки.»
//
//  Решения владельца (10.11.2026): значок в тексте книги — Когниция
//  (system.cognition, ресурс Техножреца); оружие на технике подключённого
//  персонажа допускается без проверки Трейта (подключение — на отыгрыше).
//  Игрок без Трейта не может атаковать вовсе; ГМ получает предупреждение и
//  может продолжить (NPC-Механикус в паках Трейта могут не нести).
// ════════════════════════════════════════════════════════════════════════════

/** Трейт-допуск: «Mechanicum Implants / Импланты Механикум». */
export function hasMechanicumImplants(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "trait"
    && /mechanicum implants|импланты механикум/i.test(String(i.name ?? "")));
}

/**
 * Решение по атаке Когнис-оружием.
 * @param {object} p
 * @param {boolean} p.implants   у атакующего есть Mechanicum Implants
 * @param {boolean} p.onVehicle  оружие установлено на технике
 * @param {boolean} p.isGM       атакует ГМ
 * @param {string}  p.charKey    характеристика атаки ("bs" | "ws" | "i" …)
 * @param {number}  p.cognition  текущая Когниция атакующего
 * @returns {{blocked:boolean, warn:string, spend:number}}
 */
export function cognisDecision({ implants, onVehicle, isGM = false, charKey, cognition = 0 }) {
  let warn = "";
  if (!onVehicle && !implants) {
    warn = "Когнис: дух машины не принимает команд от непосвящённых — нужен Трейт Mechanicum Implants.";
    if (!isGM) return { blocked: true, warn, spend: 0 };
  }
  // В системе I — Интеллект, ключ "int" (в окне атаки "i" нет); "i" оставлен для старых вызовов.
  if (charKey === "int" || charKey === "i") {
    if ((Number(cognition) || 0) < 1) {
      return { blocked: true, warn: "Когнис: атака через I стоит 1 Когниции, а её нет.", spend: 0 };
    }
    return { blocked: false, warn, spend: 1 };
  }
  return { blocked: false, warn, spend: 0 };
}
