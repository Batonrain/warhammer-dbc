// test/tools/pr-queue-check.test.mjs
//
// Сторож «Конца сессии»: блоки «Проверить в Foundry» и «Разобрать» из
// описаний PR облачных сессий должны оказаться в bd. 19.11.2026 пять PR
// (#571–575) висели с такими блоками, пока владелец не заметил сам.

import { describe, it, expect } from "vitest";
import { parseQueueBlocks, queueDebt } from "../../tools/pr-queue-check.mjs";

const BODY = `## Что сделано
- что-то

## Проверить в Foundry (очередь testing)

1. Первое.
2. Второе,
   продолжение второго.
- [ ] Третье с галочкой.

## Разобрать (не автоматизировано; в облаке нет bd и Sahara)

- **Гидрае** — переброс.
  - вложенный пункт
- Острие Копья.

Для игры: строка, а не пункт.
- это уже не блок
`;

describe("parseQueueBlocks", () => {
  it("берёт пункты верхнего уровня обоих блоков", () => {
    const b = parseQueueBlocks(BODY);
    expect(b.testing).toEqual(["Первое.", "Второе, продолжение второго.", "Третье с галочкой."]);
    expect(b.razobrat).toHaveLength(2);
    expect(b.razobrat[0]).toContain("вложенный пункт");
  });

  it("без блоков — пусто", () => {
    expect(parseQueueBlocks("## Итог\n- a")).toEqual({ testing: [], razobrat: [] });
    expect(parseQueueBlocks(undefined)).toEqual({ testing: [], razobrat: [] });
  });

  it("«---» закрывает блок", () => {
    expect(parseQueueBlocks("## Разобрать\n- a\n---\n- b").razobrat).toEqual(["a"]);
  });
});

describe("queueDebt", () => {
  const pr = { number: 572, title: "t", state: "OPEN", body: BODY };

  it("долг, когда в bd нет задач с gh-N", () => {
    const [r] = queueDebt([pr], []);
    expect(r.missing).toEqual(["testing", "razobrat"]);
  });

  it("нет долга, когда задачи есть по обеим меткам, даже если число другое", () => {
    const bd = [
      { external_ref: "gh-572", labels: ["testing"] },
      { external_ref: "gh-572", labels: ["razobrat"] },
    ];
    expect(queueDebt([pr], bd)[0].missing).toEqual([]);
  });

  it("задачи чужого PR не засчитываются", () => {
    const bd = [{ external_ref: "gh-571", labels: ["testing"] }, { external_ref: "gh-571", labels: ["razobrat"] }];
    expect(queueDebt([pr], bd)[0].missing).toEqual(["testing", "razobrat"]);
  });

  it("задача, ссылающаяся на PR в тексте, засчитывается; #5720 — нет", () => {
    const bd = [
      { title: "Проверить (#572): x", labels: ["testing"] },
      { description: "PR: https://github.com/o/r/pull/5720", labels: ["razobrat"] },
    ];
    expect(queueDebt([pr], bd)[0].missing).toEqual(["razobrat"]);
  });

  it("пункт с уже названным id bd не считается долгом", () => {
    const p = { number: 9, body: "## Проверить в Foundry\n- bd `wdbc-8y8bv` — уже заведено" };
    expect(queueDebt([p], [])).toEqual([]);
  });

  it("PR без блоков не попадает в отчёт", () => {
    expect(queueDebt([{ number: 1, body: "## Итог" }], [])).toEqual([]);
  });
});
