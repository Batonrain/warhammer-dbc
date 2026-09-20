// test/combat/movement-actions-grapple.test.mjs
//
// Стр. 12, wdbc-x1nz.2.31: «только действия Борьбы или не-Физические» — все
// боевые объявления Движения (Физическое) блокируются, пока актор в Захвате
// (system.conditions.grappling). Действия Борьбы сами (combat/grapple.mjs)
// этот гейт не проходят вовсе — они не вызывают ничего отсюда.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import {
  declareHalfMove, declareFullMove, declareCharge,
  declareDisengage, declareRun, declareHalfStep
} from "../../module/combat/movement-actions.mjs";

const grappled = () => ({ name: "Захваченный", items: [], system: { conditions: { grappling: true } } });

beforeEach(resetCaptured);

describe("Захват блокирует все объявления Движения", () => {
  it.each([
    ["Полудвижение", declareHalfMove],
    ["Полное Движение", declareFullMove],
    ["Натиск", declareCharge],
    ["Выход из Боя", declareDisengage],
    ["Бег", declareRun],
    ["Полушаг", declareHalfStep]
  ])("%s — предупреждение про Захват, никакой карточки/траты ОД", async (_label, fn) => {
    await fn(grappled());
    expect(captured.warnings.some(w => w.includes("Захвате"))).toBe(true);
    expect(captured.chat).toHaveLength(0);
  });
});
