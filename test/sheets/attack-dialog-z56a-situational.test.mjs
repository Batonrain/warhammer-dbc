// test/sheets/attack-dialog-z56a-situational.test.mjs
//
// wdbc-z56a: ситуативные штрафы боя (теснота/высота-скорость цели/нестабильная
// платформа) раньше в диалоге атаки не существовали вовсе — из-за этого Anti-Air,
// Gyro-Stabilized и Carbine ничего не гасили (aggregateAuto собирал флаги, но
// ничто их не читало). Здесь проверяется появление штрафов и их снятие/снижение
// нужными свойствами оружия. Бонус Уклонения цели от Карабина — отдельно, в
// test/combat/attack-carbine-dodge.test.mjs (там нужна карточка чата, не окно).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

/** Строка данных чекбокса «Низкая высота цели» и т.п. — с меткой и data-value. */
function html() { return captured.dialog?.content ?? ""; }

/** Есть ли в разметке пара «эта метка → это состояние чекбокса перед ней». */
function modLine(label) {
  const idx = html().indexOf(`<span>${label} (`);
  if (idx < 0) return null;
  // Сам <input> идёт перед <span> внутри того же <label class="attack-mod-check">.
  const before = html().slice(Math.max(0, idx - 400), idx);
  const inputStart = before.lastIndexOf("<input");
  const inputTag = before.slice(inputStart);
  const valueMatch = inputTag.match(/data-value="(-?\d+)"/);
  const autofail   = /data-autofail="true"/.test(inputTag);
  const disabled   = /\sdisabled/.test(inputTag);
  const noteMatch  = html().slice(idx, idx + 200).match(/\]/) && html().slice(idx, idx + 200).match(/\[([^\]]*)\]/);
  return {
    value: valueMatch ? Number(valueMatch[1]) : null,
    autofail, disabled,
    note: noteMatch ? noteMatch[1] : null
  };
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Зенитное (Anti-Air) — высота и скорость цели", () => {
  it("без Зенитного: высота цели и «Цель бежит» — обычные штрафы, Высокая высота непроходима без галочки", () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon], fatigue: { value: 0 }, aiming: "none" });
    showAttackDialog(actor, weapon);

    expect(modLine("Низкая высота цели")).toMatchObject({ value: -10, disabled: false });
    expect(modLine("Высокая высота цели")).toMatchObject({ autofail: true, disabled: false });
    expect(modLine("Цель бежит")).toMatchObject({ value: -20, disabled: false });
  });

  it("с Зенитным: оба штрафа высоты и штраф скорости цели сняты (иммунитет)", () => {
    const weapon = weaponFor({ weaponProps: [{ key: "antiAir" }] });
    const actor  = actorFor({ items: [weapon], fatigue: { value: 0 }, aiming: "none" });
    showAttackDialog(actor, weapon);

    expect(modLine("Низкая высота цели")).toMatchObject({ value: 0, disabled: true });
    expect(modLine("Высокая высота цели")).toMatchObject({ value: 0, disabled: true, autofail: false });
    expect(modLine("Цель бежит")).toMatchObject({ value: 0, disabled: true });
  });

  it("Зенитное не трогает штраф скорости цели в рукопашной (+20, не −20)", () => {
    const weapon = weaponFor({ weaponClass: "melee", weaponProps: [{ key: "antiAir" }] });
    const actor  = actorFor({ items: [weapon], fatigue: { value: 0 }, aiming: "none" });
    showAttackDialog(actor, weapon);

    // Мелейный «Цель бежит» — бонус атакующему (+20), Зенитное — стрелковое
    // свойство, тут его вообще нет смысла применять, и логика бьёт только
    // по стрелковой ветке (!isMelee) — цифра должна остаться +20.
    expect(modLine("Цель бежит")).toMatchObject({ value: 20, disabled: false });
  });
});

describe("Гиро-Стабилизированное — тяжёлое оружие и нестабильная платформа", () => {
  it("без Гиро-стаба: без Закрепления −30, на ходу ещё −10", () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon], fatigue: { value: 0 }, aiming: "none" });
    showAttackDialog(actor, weapon);

    expect(modLine("Тяжёлое оружие: без Закрепления")).toMatchObject({ value: -30, disabled: false });
    expect(modLine("Тяжёлое оружие: стрельба на ходу")).toMatchObject({ value: -10, disabled: false });
  });

  it("с Гиро-стабом: без Закрепления снижено до −10, на ходу снято целиком", () => {
    const weapon = weaponFor({ weaponProps: [{ key: "gyroStabilized" }] });
    const actor  = actorFor({ items: [weapon], fatigue: { value: 0 }, aiming: "none" });
    showAttackDialog(actor, weapon);

    expect(modLine("Тяжёлое оружие: без Закрепления")).toMatchObject({ value: -10, disabled: false });
    expect(modLine("Тяжёлое оружие: стрельба на ходу")).toMatchObject({ value: 0, disabled: true });
  });
});

describe("Гиро-Стабилизированное — штраф стрельбы с седла (нестабильная платформа верхом)", () => {
  function mountedRider(speed, over = {}) {
    const a = actorFor({
      items: [], fatigue: { value: 0 }, aiming: "none",
      mount: { uuid: "Actor.bike", role: "rider", speed },
      ...over
    });
    a.update = async () => {};
    return a;
  }
  function fieldValue() {
    const m = html().match(/id="atk-mount-ranged"[^>]*value="(-?\d+)"/);
    return m ? Number(m[1]) : null;
  }

  beforeEach(() => {
    globalThis.game.actors = [{ uuid: "Actor.bike", type: "vehicle", system: {} }];
  });

  it("верхом, Натиск, без Гиро-стаба — штраф −30 как обычно", () => {
    const actor = mountedRider("charge");
    showAttackDialog(actor, weaponFor({ rof_single: 1 }));
    expect(fieldValue()).toBe(-30);
  });

  it("верхом, Натиск, с Гиро-стабом — штраф снят целиком (0)", () => {
    const actor = mountedRider("charge");
    showAttackDialog(actor, weaponFor({ rof_single: 1, weaponProps: [{ key: "gyroStabilized" }] }));
    expect(fieldValue()).toBe(0);
  });
});
