const root = document.querySelector("#panes");
const cards = [];
const viewButtons = [...document.querySelectorAll("#views button")];
for (const button of viewButtons) {
  button.addEventListener("click", () => window.testBrowser.setMode(button.dataset.mode === "grid" ? "grid" : Number(button.dataset.mode)));
}

function render(state) {
  if (!state) return;
  for (const button of viewButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.mode === String(state.mode)));
  }
  for (const pane of state.panes) {
    let card = cards[pane.index];
    if (!card) {
      const element = document.createElement("section");
      element.className = "pane";
      const header = document.createElement("div");
      header.className = "header";
      const select = document.createElement("button");
      select.className = "select";
      select.addEventListener("click", () => window.testBrowser.select(pane.index));
      const reload = document.createElement("button");
      reload.className = "reload";
      reload.textContent = "↻";
      reload.setAttribute("aria-label", `${pane.label} 새로고침`);
      reload.title = "새로고침";
      reload.addEventListener("click", () => window.testBrowser.reload(pane.index));
      const status = document.createElement("div");
      status.className = "status";
      status.setAttribute("role", "status");
      const message = document.createElement("div");
      const enable = document.createElement("button");
      enable.className = "enable";
      enable.textContent = "켜기";
      enable.setAttribute("aria-label", `${pane.label} 켜기`);
      enable.addEventListener("click", () => window.testBrowser.enable(pane.index));
      status.append(message, enable);
      header.append(select, reload);
      element.append(header, status);
      root.append(element);
      card = { element, select, message, enable, reload, status };
      cards[pane.index] = card;
    }
    card.select.textContent = pane.passwordError ? `${pane.label} · ${pane.passwordError}` : pane.label;
    card.select.setAttribute("aria-pressed", String(state.active === pane.index));
    card.element.classList.toggle("active", state.active === pane.index);
    card.element.hidden = !pane.visible;
    card.message.textContent = pane.message;
    card.enable.hidden = pane.status !== "off";
    card.status.hidden = pane.status === "ready";
    card.reload.disabled = pane.status === "off" || pane.status === "loading";
    const bounds = pane.bounds.outer;
    Object.assign(card.element.style, {
      left: `${bounds.x}px`, top: `${bounds.y}px`, width: `${bounds.width}px`, height: `${bounds.height}px`,
    });
  }
}

window.testBrowser.onState(render);
render(await window.testBrowser.getState());
