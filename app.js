const form = document.getElementById("registrationForm");
const submitButton = document.getElementById("submitButton");
const formStatus = document.getElementById("formStatus");

function normalizePhone(value) {
  return value.replace(/\D/g, "");
}

function setError(field, message = "") {
  const el = document.querySelector(`[data-error-for="${field}"]`);
  if (el) el.textContent = message;
}

function validateForm() {
  let ok = true;
  const fullName = document.getElementById("fullName").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const consent = document.getElementById("consent").checked;

  ["fullName", "phone", "email"].forEach((f) => setError(f));

  if (fullName.length < 3 || !fullName.includes(" ")) {
    setError("fullName", "Informe seu nome completo.");
    ok = false;
  }

  const phoneDigits = normalizePhone(phone);
  if (phoneDigits.length < 10 || phoneDigits.length > 13) {
    setError("phone", "Informe um telefone válido com DDD.");
    ok = false;
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    setError("email", "Informe um e-mail válido.");
    ok = false;
  }

  if (!consent) {
    formStatus.className = "form-status error";
    formStatus.textContent = "É necessário autorizar o uso dos dados para concluir a inscrição.";
    ok = false;
  } else {
    formStatus.textContent = "";
    formStatus.className = "form-status";
  }

  return ok;
}

// Máscara simples de telefone BR
document.getElementById("phone").addEventListener("input", (e) => {
  let v = e.target.value.replace(/\D/g, "").slice(0, 11);
  if (v.length > 10) {
    v = v.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
  } else if (v.length > 6) {
    v = v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
  } else if (v.length > 2) {
    v = v.replace(/^(\d{2})(\d{0,5}).*/, "($1) $2");
  } else {
    v = v.replace(/^(\d*)/, "($1");
  }
  e.target.value = v;
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const cfg = window.APP_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY ||
      cfg.SUPABASE_URL.includes("COLE_AQUI") ||
      cfg.SUPABASE_ANON_KEY.includes("COLE_AQUI")) {
    formStatus.className = "form-status error";
    formStatus.textContent = "Configuração pendente: conecte o Supabase em config.js antes de publicar.";
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Enviando...";
  formStatus.textContent = "";

  try {
    const supabaseClient = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_ANON_KEY
    );

    const payload = {
      full_name: document.getElementById("fullName").value.trim(),
      phone: normalizePhone(document.getElementById("phone").value),
      email: document.getElementById("email").value.trim().toLowerCase(),
      consent: true,
      event_slug: "escola-mocos-profetas-07-08-11"
    };

    const { error } = await supabaseClient
      .from("registrations")
      .insert(payload);

    if (error) {
      if (error.code === "23505") {
        throw new Error("Este e-mail ou telefone já foi cadastrado para este evento.");
      }
      throw error;
    }

    form.reset();
    formStatus.className = "form-status success";
    formStatus.textContent = "Inscrição realizada com sucesso! Sua vaga foi registrada.";
  } catch (err) {
    console.error(err);
    formStatus.className = "form-status error";
    formStatus.textContent = err.message || "Não foi possível concluir agora. Tente novamente em instantes.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Confirmar inscrição";
  }
});
