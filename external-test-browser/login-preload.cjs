const { ipcRenderer } = require("electron");

// This stays in Electron's isolated preload world. No native API is exposed to
// the site. Autofill and automatic submission use only its existing login forms.
window.addEventListener("DOMContentLoaded", async () => {
  const response = await ipcRenderer.invoke("test-browser:read-login").catch(() => null);
  if (!response) return; // Not this pane's configured origin, tenant, or role.
  const teacher = response.teacher;
  let saved = response.login;
  let candidate = null;
  let submittedIdentity = null;
  const filled = new WeakSet();
  const edited = new WeakSet();
  const autoSubmitted = new WeakSet();
  const scheduled = new WeakSet();
  let autoLogin = true;

  function fill(input, value) {
    if (!input || !value || input.disabled || input.value || filled.has(input) || edited.has(input)) return;
    filled.add(input);
    // Use the native setter and bubble input so React updates its form state too.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function identity() {
    const number = document.querySelector("#student-number");
    const name = document.querySelector("#student-name");
    if (!number || !name) return null;
    return { studentNumber: number.value.normalize("NFKC").trim(), name: name.value.normalize("NFKC").trim().replace(/\s+/g, " ") };
  }
  function loginError(form) {
    return Boolean(form?.querySelector('[role="alert"]')?.textContent.trim());
  }
  function submitSaved(form, matches) {
    if (!autoLogin || !form || autoSubmitted.has(form) || scheduled.has(form)) return;
    scheduled.add(form);
    // React must commit the input events before its submit handler reads state.
    setTimeout(() => {
      scheduled.delete(form);
      if (!autoLogin || !form.isConnected || autoSubmitted.has(form) || loginError(form) || !matches()) return;
      if (form.querySelector('button[type="submit"]:disabled, button:not([type]):disabled, input:disabled')) return;
      autoSubmitted.add(form); // A failed login stays editable; never retry in a loop.
      form.requestSubmit();
    }, 0);
  }
  function update() {
    const password = document.querySelector("#admin-password");
    const number = document.querySelector("#student-number");
    const pin = document.querySelector('[role="dialog"] input[name="pin"]');
    if (candidate && loginError(candidate.form)) candidate = null;
    if (candidate) {
      const success = teacher
        ? !password && Boolean(document.querySelector('nav[aria-label="교사용 메뉴"]'))
        : !number && !pin && !candidate.form.isConnected;
      if (success) {
        const login = candidate.login;
        candidate = null;
        void ipcRenderer.invoke("test-browser:save-login", login).then((ok) => {
          if (ok) saved = login;
        }).catch(() => {});
      } else if (!teacher && !pin && number) {
        candidate = null; // The PIN dialog was cancelled, not a successful login.
      }
    }
    if (!saved) return;
    if (teacher) {
      const email = document.querySelector("#admin-email");
      fill(email, saved.email);
      fill(password, saved.password);
      submitSaved(password?.form, () => password.value === saved.password && (!email || email.value.trim() === saved.email));
    } else {
      fill(number, saved.studentNumber);
      fill(document.querySelector("#student-name"), saved.name);
      const current = submittedIdentity;
      // Never put an old PIN into a new-account setup or a different student's form.
      if (pin?.autocomplete === "current-password" && current?.studentNumber === saved.studentNumber && current.name === saved.name) {
        fill(pin, saved.pin);
        submitSaved(pin.form, () => pin.value === saved.pin);
      } else if (!pin) {
        submitSaved(number?.form, () => {
          const currentIdentity = identity();
          return currentIdentity?.studentNumber === saved.studentNumber && currentIdentity.name === saved.name;
        });
      }
    }
  }

  document.addEventListener("input", (event) => {
    if (event.isTrusted && event.target instanceof HTMLInputElement) {
      edited.add(event.target);
      autoLogin = false;
    }
  }, true);
  for (const type of ["pointerdown", "keydown"]) {
    document.addEventListener(type, (event) => { if (event.isTrusted) autoLogin = false; }, true);
  }
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (teacher) {
      const password = form.querySelector("#admin-password");
      if (password?.value && !password.disabled) {
        candidate = { form, login: { email: form.querySelector("#admin-email")?.value ?? "", password: password.value } };
      }
    } else {
      if (form.querySelector("#student-number")) {
        submittedIdentity = identity();
        candidate = null;
      }
      const pin = form.querySelector('input[name="pin"]');
      const confirmation = form.querySelector('input[name="pinConfirmation"]');
      if (pin && !pin.disabled && submittedIdentity && (!confirmation || confirmation.value === pin.value)) {
        candidate = { form, login: { ...submittedIdentity, pin: pin.value } };
      }
    }
  }, true);
  new MutationObserver(update).observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
  update();
});
