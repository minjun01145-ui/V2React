(function () {
  // Runs before page scripts. Credentials stay in this closure and are used only
  // by the configured top-level site's existing forms, tenant and role.
  const context = __CLASSROOM_CONTEXT__;
  if (window !== window.top || location.origin !== context.origin || location.pathname !== context.path) return;
  const tenant = (new URL(location.href).searchParams.get("tenant") || "minjun").trim().toLowerCase();
  if (tenant !== context.tenant) return;
  const send = window.chrome.webview.postMessage.bind(window.chrome.webview);
  window.addEventListener("DOMContentLoaded", () => {
    const teacher = context.teacher;
    let saved = context.login;
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
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    function identity() {
      const number = document.querySelector("#student-number");
      const name = document.querySelector("#student-name");
      if (!number || !name) return null;
      return { studentNumber: number.value.normalize("NFKC").trim(), name: name.value.normalize("NFKC").trim().replace(/\s+/g, " ") };
    }
    function loginError(form) { return Boolean(form?.querySelector('[role="alert"]')?.textContent.trim()); }
    function submitSaved(form, matches) {
      if (!autoLogin || !form || autoSubmitted.has(form) || scheduled.has(form)) return;
      scheduled.add(form);
      setTimeout(() => {
        scheduled.delete(form);
        if (!autoLogin || !form.isConnected || autoSubmitted.has(form) || loginError(form) || !matches()) return;
        if (form.querySelector('button[type="submit"]:disabled, button:not([type]):disabled, input:disabled')) return;
        autoSubmitted.add(form);
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
          send({ type: "classroom-save-login", login });
          saved = login;
        } else if (!teacher && !pin && number) candidate = null;
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
      if (event.isTrusted && event.target instanceof HTMLInputElement) { edited.add(event.target); autoLogin = false; }
    }, true);
    for (const type of ["pointerdown", "keydown"]) document.addEventListener(type, (event) => { if (event.isTrusted) autoLogin = false; }, true);
    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (teacher) {
        const password = form.querySelector("#admin-password");
        if (password?.value && !password.disabled) candidate = { form, login: { email: form.querySelector("#admin-email")?.value ?? "", password: password.value } };
      } else {
        if (form.querySelector("#student-number")) { submittedIdentity = identity(); candidate = null; }
        const pin = form.querySelector('input[name="pin"]');
        const confirmation = form.querySelector('input[name="pinConfirmation"]');
        if (pin && !pin.disabled && submittedIdentity && (!confirmation || confirmation.value === pin.value)) candidate = { form, login: { ...submittedIdentity, pin: pin.value } };
      }
    }, true);
    new MutationObserver(update).observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    update();
  }, { once: true });
})();
