(() => {
  const form = document.querySelector("#companyForm");
  const message = document.querySelector("#companyMessage");

  if (!form || !message) return;

  const submitButton = form.querySelector('button[type="submit"]');
  const defaultButtonText = submitButton?.textContent ?? "Kérek javaslatot a kampányra";
  const requiredGroups = ["shift", "mainProblem"];
  let isSubmitting = false;
  let submissionId = null;
  let turnstileToken = "";
  let turnstileWidgetId = null;

  async function initializeTurnstile() {
    const container = document.querySelector("#companyTurnstile");
    if (!container) return;
    try {
      const config = await fetch("/api/turnstile-config", { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject());
      await new Promise((resolve, reject) => {
        const script = document.createElement("script"); script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; script.async = true; script.onload = resolve; script.onerror = reject; document.head.append(script);
      });
      turnstileWidgetId = window.turnstile.render(container, { sitekey: config.siteKey, action: "company_interest", size: "flexible", callback: (token) => { turnstileToken = token; }, "expired-callback": () => { turnstileToken = ""; }, "error-callback": () => { turnstileToken = ""; } });
    } catch { container.textContent = "A biztonsági ellenőrzés nem érhető el. Kérjük, próbáld később."; }
  }
  initializeTurnstile();

  function validateRequiredGroups() {
    let valid = true;

    requiredGroups.forEach((name) => {
      const inputs = Array.from(form.querySelectorAll(`input[name="${name}"]`));
      const firstInput = inputs[0];
      if (!firstInput) return;

      const hasSelection = inputs.some((input) => input.checked);
      firstInput.setCustomValidity(hasSelection ? "" : "Válassz legalább egy lehetőséget.");
      valid = hasSelection && valid;
    });

    return valid;
  }

  function value(formData, name) {
    return String(formData.get(name) ?? "").trim();
  }

  function values(formData, name) {
    return formData.getAll(name).map((item) => String(item).trim()).filter(Boolean);
  }

  requiredGroups.forEach((name) => {
    form.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
      input.addEventListener("change", validateRequiredGroups);
    });
  });

  form.addEventListener("change", () => {
    if (!isSubmitting) submissionId = null;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    validateRequiredGroups();
    if (!form.reportValidity()) return;
    if (!turnstileToken) { message.textContent = "Kérjük, várd meg a biztonsági ellenőrzést, majd próbáld újra."; message.classList.add("form-message-error"); return; }

    isSubmitting = true;
    submissionId ||= crypto.randomUUID();
    message.textContent = "";
    message.classList.remove("form-message-error");
    form.setAttribute("aria-busy", "true");

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Küldés folyamatban…";
    }

    const formData = new FormData(form);
    const payload = {
      requestId: submissionId,
      company: value(formData, "company"),
      contactName: value(formData, "contactName"),
      email: value(formData, "email"),
      phone: value(formData, "phone"),
      callTime: value(formData, "callTime"),
      role: value(formData, "role"),
      headcount: value(formData, "headcount"),
      location: value(formData, "location"),
      startUrgency: value(formData, "startUrgency"),
      shift: values(formData, "shift"),
      hasSalary: value(formData, "hasSalary"),
      salary: value(formData, "salary"),
      requirements: values(formData, "requirements"),
      mustKnow: value(formData, "mustKnow"),
      mainProblem: values(formData, "mainProblem"),
      advertisedBefore: value(formData, "advertisedBefore"),
      package: value(formData, "package"),
      notes: value(formData, "notes"),
      turnstileToken
    };

    try {
      const response = await fetch("/api/company-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok || !result.leadId) {
        if (turnstileWidgetId !== null) { window.turnstile.reset(turnstileWidgetId); turnstileToken = ""; }
        throw new Error(result.error || "A beküldés most nem sikerült. Kérjük, próbáld újra.");
      }

      message.textContent = "Köszönjük, megkaptuk a briefet.";
      form.reset();
      submissionId = null;
      validateRequiredGroups();
    } catch (error) {
      message.textContent = error instanceof Error
        ? error.message
        : "A beküldés most nem sikerült. Kérjük, próbáld újra.";
      message.classList.add("form-message-error");
    } finally {
      isSubmitting = false;
      form.removeAttribute("aria-busy");
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = defaultButtonText;
      }
    }
  });
})();