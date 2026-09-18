// test/combat/swim-stamina.test.mjs
//
// Плавание свыше T.b часов (стр. 30): «за каждый час свыше он должен
// проходить тест на Т» — раньше повторно гонял тот же порог Athletics с
// кумулятивным штрафом марша, что подменяло характеристику теста. Теперь это
// отдельный тест на сырую Toughness (T), как у Марша/Бега (_hourlyTest),
// не влияющий на «может ли двигаться» (это по-прежнему решает Athletics).
// wdbc-x1nz.2.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { _resolveSwim } from "../../module/combat/movement-actions.mjs";

function actor({ fatigue = 0, tTotal = 30 } = {}) {
  const flags = {};
  const a = {
    name: "Подставной", items: [],
    system: { fatigue: { value: fatigue, max: 0 }, characteristics: { t: { total: tTotal } } },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete flags[k]; },
    update: async (data) => {
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split(".");
        let target = a;
        for (const key of keys.slice(0, -1)) target = (target[key] ??= {});
        target[keys.at(-1)] = value;
      }
    }
  };
  return a;
}

beforeEach(resetCaptured);

describe("_resolveSwim: обычный тест — без чекбокса «свыше T.b часов»", () => {
  it("порог и бросок только по Athletics, без строки Выносливости", async () => {
    captured.dice = [40];
    await _resolveSwim(actor(), 40, false, false, 0, 6);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("<label>Порог</label><b>40</b>");
    expect(html).not.toContain("Выносливость");
  });
});

describe("_resolveSwim: свыше T.b часов — отдельный тест на Т, не Athletics (стр. 30)", () => {
  it("тест выносливости идёт по Toughness, а не по Athletics-порогу", async () => {
    // Athletics-тест (40) проходит первым, независимо от теста Т.
    captured.dice = [30, 25]; // [0]: Athletics-роллбросок, [1]: T-тест (порог 30)
    await _resolveSwim(actor({ tTotal: 30 }), 40, false, true, 0, 6);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Выносливость (T)");
    expect(html).toContain("<b>30</b>"); // порог T, не Athletics(40)
  });

  it("провал теста Т даёт +1 Усталость, но НЕ отменяет успешное движение", async () => {
    captured.dice = [30, 95]; // Athletics успешен (30≤40), T-тест провален (95>30)
    const a = actor({ tTotal: 30, fatigue: 0 });
    await _resolveSwim(a, 40, false, true, 0, 6);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Провал, +1 Усталость");
    expect(html).toContain("Плывёт"); // движение не заблокировано провалом Т-теста
    expect(a.system.fatigue.value).toBe(1);
  });

  it("кумулятивный штраф T-теста растёт по своему стрику, независимо от Athletics", async () => {
    captured.dice = [30, 95, 30, 95];
    const a = actor({ tTotal: 30, fatigue: 0 });
    await _resolveSwim(a, 40, false, true, 0, 6); // 1-й провал Т-теста
    await _resolveSwim(a, 40, false, true, 0, 6); // 2-й: порог T уже 30−10=20
    const html = captured.chat.at(-1).content;
    expect(html).toContain("−10 кумулятив");
    expect(a.system.fatigue.value).toBe(2);
  });
});
