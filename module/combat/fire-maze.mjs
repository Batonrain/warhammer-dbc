// module/combat/fire-maze.mjs
// Лабиринт Пламени (rules/fire-dance.mjs::hasFireMaze): выбор одного из двух
// бросков Linger. Окно закрыли — берётся больший (зона держится дольше).

export async function pickFireMazeRounds(a, b) {
  const hi = Math.max(a, b), lo = Math.min(a, b);
  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (!DialogV2) return hi;
  const choice = await DialogV2.wait({
    window: { title: "Лабиринт Пламени" },
    content: `<p>Два броска «Остаётся»: <b>${a}</b> и <b>${b}</b>. Сколько раундов держится зона?</p>`,
    buttons: [
      { action: "hi", label: `${hi} раундов`, default: true },
      { action: "lo", label: `${lo} раундов` }
    ],
    rejectClose: false
  }).catch(() => "hi");
  return choice === "lo" ? lo : hi;
}
