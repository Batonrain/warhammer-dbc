// test/helpers/python.mjs
//
// Запуск Python из тестов инструментов (tools/*.py). На Linux/CI достаточно
// `python3`, но на Windows `python3` и `python` в PATH часто оказываются
// заглушками Microsoft Store (WindowsApps): они не исполняют код и отвечают
// кодом 9009, а настоящий интерпретатор доступен только как лаунчер `py -3`.
// Поэтому берём первого кандидата, который реально выполняет код, — а не
// первого, который нашёлся в PATH.

import { spawnSync } from "node:child_process";

const CANDIDATES = [
  ["python3"],
  ["python"],
  ["py", "-3"],
];

let resolved;

/** Первый рабочий интерпретатор как `[команда, ...префиксные аргументы]`. */
export function pythonCommand() {
  if (resolved) return resolved;
  for (const [cmd, ...pre] of CANDIDATES) {
    const r = spawnSync(cmd, [...pre, "-c", "print(40 + 2)"], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim() === "42") {
      resolved = [cmd, ...pre];
      return resolved;
    }
  }
  throw new Error(
    "Не найден рабочий Python: пробовали " +
    CANDIDATES.map(c => c.join(" ")).join(", ") +
    ". На Windows `python`/`python3` могут быть заглушками Microsoft Store — нужен `py -3`."
  );
}

/** `spawnSync` для Python: те же аргументы, что у `spawnSync("python3", args, opts)`. */
export function spawnPython(args, options) {
  const [cmd, ...pre] = pythonCommand();
  return spawnSync(cmd, [...pre, ...args], options);
}
