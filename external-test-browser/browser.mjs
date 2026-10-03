import { BrowserWindow, WebContentsView, ipcMain } from "electron";
import { join } from "node:path";
import { GRID, paneBounds } from "./settings.mjs";
import { loginScope, readLogin, saveLogin } from "./passwords.mjs";

export function createBrowser(settings, { maximize = true, show = true } = {}) {
  const window = new BrowserWindow({
    title: "교실 수업 콘솔",
    width: 1600,
    height: 1000,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    backgroundColor: "#101827",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(import.meta.dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  window.setMenu(null);
  const shell = window.webContents;
  let active = 0;
  let mode = "grid";
  let shellReady = false;
  const panes = ["교사화면", "테스트화면 1", "테스트화면 2", "테스트화면 3"].map((label, index) => {
    const view = new WebContentsView({
      webPreferences: {
        preload: join(import.meta.dirname, "login-preload.cjs"),
        partition: `persist:classroom-${index === 0 ? "teacher" : 9990 + index}`,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        backgroundThrottling: false,
      },
    });
    window.contentView.addChildView(view);
    view.setVisible(false);
    const url = index === 0 ? settings.teacherUrl : settings.studentUrl;
    return { index, label, view, url, status: "off", message: "꺼져 있음", passwordError: "", bounds: null };
  });

  function state() {
    return {
      active,
      mode,
      grid: GRID,
      panes: panes.map(({ index, label, status, message, passwordError, bounds }) => ({ index, label, status, message, passwordError, bounds, visible: mode === "grid" || mode === index })),
    };
  }
  function publish() {
    if (shellReady) shell.send("test-browser:state", state());
  }
  function select(index, focus = true) {
    if (mode !== "grid" && mode !== index) return;
    active = index;
    publish();
    if (focus && panes[index].status === "ready" && !panes[index].view.webContents.isFocused()) panes[index].view.webContents.focus();
  }
  function layout() {
    const [width, height] = window.getContentSize();
    for (const pane of panes) {
      pane.bounds = paneBounds(width, height, pane.index, mode);
      pane.view.setBounds(pane.bounds.content);
      pane.view.setVisible(pane.status === "ready" && (mode === "grid" || mode === pane.index));
      if (pane.view.getVisible()) window.contentView.addChildView(pane.view);
    }
    publish();
  }
  function failed(pane, message) {
    pane.status = "error";
    pane.message = message;
    pane.view.setVisible(false);
    publish();
  }
  function load(pane) {
    pane.status = "loading";
    pane.message = "불러오는 중…";
    pane.view.setVisible(false);
    publish();
    // did-fail-load supplies the user-visible error; consume the rejected promise.
    void pane.view.webContents.loadURL(pane.url).catch(() => {});
  }

  for (const pane of panes) {
    const contents = pane.view.webContents;
    contents.on("before-mouse-event", (_event, mouse) => {
      if (mouse.type === "mouseDown") select(pane.index);
    });
    contents.on("focus", () => {
      if (window.isVisible()) select(pane.index, false);
    });
    contents.on("did-start-navigation", (_event, _url, isInPlace, isMainFrame) => {
      if (!isMainFrame || isInPlace) return;
      pane.status = "loading";
      pane.message = "불러오는 중…";
      pane.view.setVisible(false);
      publish();
    });
    contents.on("did-finish-load", () => {
      if (pane.status === "error") return; // Chromium also finishes its built-in error page.
      pane.status = "ready";
      pane.message = "";
      layout();
    });
    contents.on("did-fail-load", (_event, code, description, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) failed(pane, `연결하지 못했습니다 (${description}).`);
    });
    contents.on("render-process-gone", () => failed(pane, "화면이 종료되었습니다. 새로고침해 주세요."));
    // Game pages have no exposed native APIs or injected game/test logic.
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    contents.on("before-input-event", (event, input) => {
      if (input.type !== "keyDown") return;
      if (input.key === "F5" || (input.control && input.key.toLowerCase() === "r")) {
        event.preventDefault();
        if (pane.status === "error") load(pane);
        else contents.reload();
      }
    });
  }

  function shellSender(event) {
    return event.sender === shell && event.senderFrame === shell.mainFrame;
  }
  function loginSender(event) {
    const pane = panes.find((item) => item.view.webContents === event.sender);
    if (!pane || event.senderFrame !== event.sender.mainFrame) return null;
    try {
      const current = new URL(event.senderFrame.url);
      const configured = new URL(pane.url);
      if (loginScope(current.href) !== loginScope(pane.url) || current.pathname !== configured.pathname) return null;
    } catch { return null; }
    return pane;
  }
  ipcMain.handle("test-browser:read-login", (event) => {
    const pane = loginSender(event);
    if (!pane) return null;
    try {
      return { teacher: pane.index === 0, login: readLogin(pane.index, pane.url) };
    } catch {
      pane.passwordError = "비밀번호 읽기 실패";
      publish();
      return { teacher: pane.index === 0, login: null };
    }
  });
  ipcMain.handle("test-browser:save-login", (event, login) => {
    const pane = loginSender(event);
    if (!pane) return false;
    try {
      saveLogin(pane.index, pane.url, login);
      pane.passwordError = "";
      publish();
      return true;
    } catch {
      pane.passwordError = "비밀번호 저장 실패";
      publish();
      return false;
    }
  });
  ipcMain.handle("test-browser:get-state", (event) => shellSender(event) ? state() : null);
  const onSelect = (event, index) => {
    if (shellSender(event) && Number.isInteger(index) && index >= 0 && index < panes.length) select(index);
  };
  const onReload = (event, index) => {
    if (!shellSender(event) || !Number.isInteger(index) || index < 0 || index >= panes.length) return;
    select(index);
    const pane = panes[index];
    if (pane.status === "off") return;
    if (pane.status === "error") load(pane);
    else pane.view.webContents.reload();
  };
  const onEnable = (event, index) => {
    if (!shellSender(event) || !Number.isInteger(index) || index < 0 || index >= panes.length) return;
    if (panes[index].status !== "off") return;
    select(index, false);
    load(panes[index]);
  };
  const onMode = (event, nextMode) => {
    if (!shellSender(event) || (nextMode !== "grid" && (!Number.isInteger(nextMode) || nextMode < 0 || nextMode >= panes.length))) return;
    mode = nextMode;
    layout();
    select(mode === "grid" ? active : mode);
    if (panes[active].status !== "ready") shell.focus();
  };
  ipcMain.on("test-browser:select", onSelect);
  ipcMain.on("test-browser:reload", onReload);
  ipcMain.on("test-browser:enable", onEnable);
  ipcMain.on("test-browser:mode", onMode);
  shell.once("did-finish-load", () => {
    shellReady = true;
    layout();
    if (show) {
      if (maximize) window.maximize();
      window.show();
      select(0);
    }
    publish();
  });
  // Keep the local chrome local even if a renderer link is accidentally added.
  shell.on("will-navigate", (event) => event.preventDefault());
  shell.setWindowOpenHandler(() => ({ action: "deny" }));
  window.on("resize", layout);
  window.on("closed", () => {
    shellReady = false;
    ipcMain.removeHandler("test-browser:get-state");
    ipcMain.removeHandler("test-browser:read-login");
    ipcMain.removeHandler("test-browser:save-login");
    ipcMain.removeListener("test-browser:select", onSelect);
    ipcMain.removeListener("test-browser:reload", onReload);
    ipcMain.removeListener("test-browser:enable", onEnable);
    ipcMain.removeListener("test-browser:mode", onMode);
    for (const pane of panes) {
      if (!pane.view.webContents.isDestroyed()) pane.view.webContents.close();
    }
  });
  layout();
  void shell.loadFile(join(import.meta.dirname, "shell.html"));
  load(panes[0]);
  return { window, panes, state };
}
