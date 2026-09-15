// Inicialização do cliente Supabase para a Área Administrativa
(function() {
  const cfg = window.APP_CONFIG || {};

  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY ||
      cfg.SUPABASE_URL.includes("COLE_AQUI") ||
      cfg.SUPABASE_ANON_KEY.includes("COLE_AQUI")) {
    alert("Supabase não configurado no config.js. Verifique as credenciais.");
    return;
  }

  const supabaseClient = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  // Elementos do DOM
  const loginView = document.getElementById("loginView");
  const loginForm = document.getElementById("loginForm");
  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const loginSubmit = document.getElementById("loginSubmit");
  const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
  const loginStatus = document.getElementById("loginStatus");

  // Elementos da Tela de Redefinição de Senha
  const resetPasswordView = document.getElementById("resetPasswordView");
  const resetPasswordForm = document.getElementById("resetPasswordForm");
  const newPassword = document.getElementById("newPassword");
  const confirmPassword = document.getElementById("confirmPassword");
  const savePasswordSubmit = document.getElementById("savePasswordSubmit");
  const resetStatus = document.getElementById("resetStatus");
  const cancelResetBtn = document.getElementById("cancelResetBtn");

  const dashboardView = document.getElementById("dashboardView");
  const userEmailBadge = document.getElementById("userEmailBadge");
  const logoutBtn = document.getElementById("logoutBtn");

  const statTotal = document.getElementById("statTotal");
  const statToday = document.getElementById("statToday");
  const todayDateHint = document.getElementById("todayDateHint");

  const searchInput = document.getElementById("searchInput");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  const resultCount = document.getElementById("resultCount");
  const registrationsTbody = document.getElementById("registrationsTbody");

  // Estado da aplicação
  let allRegistrations = [];
  let isRecoveringPassword = false;

  // Detectar se a URL contém tokens de recuperação
  if (window.location.hash.includes("type=recovery") ||
      window.location.search.includes("type=recovery")) {
    isRecoveringPassword = true;
  }

  // Exibir a data de hoje no card de métricas
  if (todayDateHint) {
    const todayStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    todayDateHint.textContent = `Hoje (${todayStr})`;
  }

  function showResetPasswordView() {
    isRecoveringPassword = true;
    loginView.classList.add("hidden");
    dashboardView.classList.add("hidden");
    if (resetPasswordView) resetPasswordView.classList.remove("hidden");
    if (newPassword) newPassword.value = "";
    if (confirmPassword) confirmPassword.value = "";
    if (resetStatus) {
      resetStatus.textContent = "";
      resetStatus.className = "auth-status";
    }
  }

  function showLogin() {
    allRegistrations = [];
    loginView.classList.remove("hidden");
    dashboardView.classList.add("hidden");
    if (resetPasswordView) resetPasswordView.classList.add("hidden");
    if (loginPassword) loginPassword.value = "";
    if (loginStatus && !loginStatus.classList.contains("success")) {
      loginStatus.textContent = "";
      loginStatus.className = "auth-status";
    }
  }

  function showDashboard(user) {
    if (isRecoveringPassword) {
      showResetPasswordView();
      return;
    }
    loginView.classList.add("hidden");
    if (resetPasswordView) resetPasswordView.classList.add("hidden");
    dashboardView.classList.remove("hidden");
    if (userEmailBadge) {
      userEmailBadge.textContent = user.email || "Administrador";
    }
    fetchRegistrations();
  }

  // Checar sessão ativa no início
  async function initAuth() {
    if (isRecoveringPassword) {
      showResetPasswordView();
      return;
    }

    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (isRecoveringPassword) {
        showResetPasswordView();
      } else if (session && session.user) {
        showDashboard(session.user);
      } else {
        showLogin();
      }
    } catch (err) {
      console.error("Erro ao verificar sessão:", err);
      showLogin();
    }
  }

  // Ouvir mudanças de autenticação
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      isRecoveringPassword = true;
      showResetPasswordView();
    } else if (event === "SIGNED_IN" && session?.user) {
      if (isRecoveringPassword) {
        showResetPasswordView();
      } else {
        showDashboard(session.user);
      }
    } else if (event === "SIGNED_OUT") {
      if (!isRecoveringPassword) {
        showLogin();
      }
    }
  });

  // Evento de Login
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!email || !password) {
      loginStatus.className = "auth-status error";
      loginStatus.textContent = "Preencha o e-mail e a senha.";
      return;
    }

    loginSubmit.disabled = true;
    loginSubmit.textContent = "Autenticando...";
    loginStatus.className = "auth-status";
    loginStatus.textContent = "";

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        let msg = "Não foi possível autenticar.";
        if (error.message.includes("Invalid login credentials")) {
          msg = "E-mail ou senha incorretos. Verifique suas credenciais.";
        } else if (error.message.includes("Email not confirmed")) {
          msg = "Este e-mail ainda não foi confirmado no Supabase.";
        } else {
          msg = error.message;
        }
        throw new Error(msg);
      }

      loginStatus.className = "auth-status success";
      loginStatus.textContent = "Login autorizado! Carregando painel...";
      showDashboard(data.user);
    } catch (err) {
      console.error(err);
      loginStatus.className = "auth-status error";
      loginStatus.textContent = err.message;
    } finally {
      loginSubmit.disabled = false;
      loginSubmit.textContent = "Entrar no painel";
    }
  });

  // Recuperação de Senha do Administrador
  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      const currentEmail = (loginEmail.value || "").trim();
      const email = window.prompt("Informe o e-mail do administrador para recuperação de senha:", currentEmail);

      if (email === null) return; // cancelado pelo usuário

      const emailTrimmed = email.trim();
      if (!emailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
        loginStatus.className = "auth-status error";
        loginStatus.textContent = "Por favor, informe um e-mail válido.";
        return;
      }

      loginStatus.className = "auth-status";
      loginStatus.textContent = "Solicitando e-mail de recuperação...";

      try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(emailTrimmed, {
          redirectTo: "http://localhost:3000/admin.html"
        });

        if (error) throw error;

        loginStatus.className = "auth-status success";
        loginStatus.textContent = "E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada.";
      } catch (err) {
        console.error("Erro ao recuperar senha:", err);
        loginStatus.className = "auth-status error";
        loginStatus.textContent = err.message || "Não foi possível enviar o e-mail de recuperação.";
      }
    });
  }

  // Evento de Logout
  logoutBtn.addEventListener("click", async () => {
    try {
      logoutBtn.disabled = true;
      await supabaseClient.auth.signOut();
    } catch (err) {
      console.error("Erro ao sair:", err);
    } finally {
      logoutBtn.disabled = false;
      showLogin();
    }
  });

  // Consultar cadastros na tabela registrations
  async function fetchRegistrations() {
    registrationsTbody.innerHTML = `
      <tr>
        <td colspan="4" class="table-empty">Atualizando lista de cadastros...</td>
      </tr>
    `;
    resultCount.textContent = "Carregando dados...";

    try {
      const { data, error } = await supabaseClient
        .from("registrations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        // Alerta amigável se faltar política de SELECT no RLS
        if (error.code === "42501" || error.message.includes("policy") || error.message.includes("permission denied")) {
          throw new Error("Permissão insuficiente (RLS). Execute a política de SELECT para 'authenticated' no SQL Editor do Supabase.");
        }
        throw error;
      }

      allRegistrations = data || [];
      updateStats();
      renderTable();
    } catch (err) {
      console.error("Erro ao buscar inscrições:", err);
      registrationsTbody.innerHTML = `
        <tr>
          <td colspan="4" class="table-empty" style="color: var(--danger);">
            ⚠️ ${err.message || "Erro ao carregar os dados. Verifique a conexão e as permissões RLS."}
          </td>
        </tr>
      `;
      resultCount.textContent = "Erro no carregamento";
      statTotal.textContent = "0";
      statToday.textContent = "0";
    }
  }

  // Atualizar contadores
  function updateStats() {
    statTotal.textContent = allRegistrations.length.toString();

    // Data de hoje no formato local YYYY-MM-DD
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();

    const todayCount = allRegistrations.filter((item) => {
      if (!item.created_at) return false;
      const d = new Date(item.created_at);
      return (
        d.getFullYear() === todayYear &&
        d.getMonth() === todayMonth &&
        d.getDate() === todayDate
      );
    }).length;

    statToday.textContent = todayCount.toString();
  }

  // Formatação de data em português
  function formatDate(isoString) {
    if (!isoString) return "—";
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;

    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const ano = d.getFullYear();
    const horas = String(d.getHours()).padStart(2, "0");
    const minutos = String(d.getMinutes()).padStart(2, "0");

    return `${dia}/${mes}/${ano} às ${horas}:${minutos}`;
  }

  // Formatar telefone para exibição e link do WhatsApp
  function formatPhone(phone) {
    if (!phone) return { display: "—", link: null };
    const digits = phone.replace(/\D/g, "");

    let display = phone;
    if (digits.length === 11) {
      display = digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    } else if (digits.length === 10) {
      display = digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
    }

    const link = digits.length >= 10 ? `https://wa.me/55${digits}` : null;
    return { display, link };
  }

  // Renderizar a tabela com filtro de busca
  function renderTable() {
    const query = searchInput.value.trim().toLowerCase();

    const filtered = allRegistrations.filter((item) => {
      if (!query) return true;
      const name = (item.full_name || "").toLowerCase();
      const phone = (item.phone || "").toLowerCase();
      const email = (item.email || "").toLowerCase();
      return name.includes(query) || phone.includes(query) || email.includes(query);
    });

    // Atualizar texto de contagem
    if (allRegistrations.length === 0) {
      resultCount.innerHTML = "Nenhuma inscrição registrada até o momento.";
    } else if (query) {
      resultCount.innerHTML = `Mostrando <strong>${filtered.length}</strong> de <strong>${allRegistrations.length}</strong> inscritos`;
    } else {
      resultCount.innerHTML = `Total de <strong>${allRegistrations.length}</strong> inscritos registrados`;
    }

    if (filtered.length === 0) {
      registrationsTbody.innerHTML = `
        <tr>
          <td colspan="4" class="table-empty">
            ${query ? "Nenhum cadastro corresponde ao termo pesquisado." : "Nenhum cadastro encontrado."}
          </td>
        </tr>
      `;
      return;
    }

    const rowsHtml = filtered.map((item) => {
      const dateFormatted = formatDate(item.created_at);
      const phoneInfo = formatPhone(item.phone);
      const phoneHtml = phoneInfo.link
        ? `<a href="${phoneInfo.link}" target="_blank" rel="noopener noreferrer" title="Abrir conversa no WhatsApp">${phoneInfo.display} ↗</a>`
        : phoneInfo.display;

      const emailSafe = (item.email || "—").toLowerCase();
      const emailHtml = emailSafe !== "—"
        ? `<a href="mailto:${emailSafe}" title="Enviar e-mail">${emailSafe}</a>`
        : "—";

      return `
        <tr>
          <td class="td-date">${dateFormatted}</td>
          <td class="td-name">${escapeHtml(item.full_name || "—")}</td>
          <td class="td-phone">${phoneHtml}</td>
          <td class="td-email">${emailHtml}</td>
        </tr>
      `;
    }).join("");

    registrationsTbody.innerHTML = rowsHtml;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Busca em tempo real
  searchInput.addEventListener("input", () => {
    if (searchInput.value.trim().length > 0) {
      clearSearchBtn.classList.remove("hidden");
    } else {
      clearSearchBtn.classList.add("hidden");
    }
    renderTable();
  });

  // Limpar busca
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearSearchBtn.classList.add("hidden");
    searchInput.focus();
    renderTable();
  });

  // Botão Atualizar
  refreshBtn.addEventListener("click", () => {
    fetchRegistrations();
  });

  // Exportar para CSV com suporte a UTF-8 (compatível com Excel)
  exportCsvBtn.addEventListener("click", () => {
    if (allRegistrations.length === 0) {
      alert("Não há dados de inscrições para exportar.");
      return;
    }

    const headers = ["ID", "Data/Hora", "Nome Completo", "Telefone", "E-mail", "Consentimento LGPD", "Evento"];
    
    const rows = allRegistrations.map((item) => {
      const dataHora = formatDate(item.created_at);
      const phoneInfo = formatPhone(item.phone);
      return [
        item.id || "",
        dataHora,
        item.full_name || "",
        phoneInfo.display,
        item.email || "",
        item.consent ? "Sim" : "Não",
        item.event_slug || ""
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`);
    });

    // Byte Order Mark (BOM) UTF-8 para garantir abertura correta no Microsoft Excel
    const csvContent = "\uFEFF" + [headers.map(h => `"${h}"`).join(";"), ...rows.map(r => r.join(";"))].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", url);
    link.setAttribute("download", `inscritos_escola_mocos_profetas_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  // Alternar visibilidade de senha (mostrar/ocultar)
  document.querySelectorAll(".toggle-password-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;

      if (input.type === "password") {
        input.type = "text";
        btn.textContent = "🙈";
        btn.setAttribute("aria-label", "Ocultar senha");
      } else {
        input.type = "password";
        btn.textContent = "👁️";
        btn.setAttribute("aria-label", "Mostrar senha");
      }
    });
  });

  // Salvar Nova Senha no Supabase
  if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const novaSenha = newPassword.value;
      const confirmar = confirmPassword.value;

      if (!novaSenha || novaSenha.length < 8) {
        resetStatus.className = "auth-status error";
        resetStatus.textContent = "A nova senha deve possuir no mínimo 8 caracteres.";
        return;
      }

      if (novaSenha !== confirmar) {
        resetStatus.className = "auth-status error";
        resetStatus.textContent = "As duas senhas não coincidem. Confirme a mesma senha nos dois campos.";
        return;
      }

      savePasswordSubmit.disabled = true;
      savePasswordSubmit.textContent = "Salvando nova senha...";
      resetStatus.className = "auth-status";
      resetStatus.textContent = "";

      try {
        const { error } = await supabaseClient.auth.updateUser({
          password: novaSenha
        });

        if (error) throw error;

        resetStatus.className = "auth-status success";
        resetStatus.textContent = "Senha alterada com sucesso.";

        // Aguarda exibição da mensagem de sucesso, desloga e retorna à tela normal de login
        setTimeout(async () => {
          isRecoveringPassword = false;
          // Remove hash de recuperação da URL para evitar loops
          if (window.history.replaceState) {
            window.history.replaceState(null, "", window.location.pathname);
          }
          await supabaseClient.auth.signOut();
          showLogin();
          loginStatus.className = "auth-status success";
          loginStatus.textContent = "Senha alterada com sucesso. Faça login com sua nova senha.";
        }, 1600);

      } catch (err) {
        console.error("Erro ao redefinir senha:", err);
        resetStatus.className = "auth-status error";
        resetStatus.textContent = err.message || "Não foi possível alterar a senha. Tente novamente.";
        savePasswordSubmit.disabled = false;
        savePasswordSubmit.textContent = "Salvar nova senha";
      }
    });
  }

  // Cancelar redefinição e voltar ao login
  if (cancelResetBtn) {
    cancelResetBtn.addEventListener("click", async () => {
      isRecoveringPassword = false;
      if (window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      await supabaseClient.auth.signOut();
      showLogin();
    });
  }

  // Inicializar
  initAuth();
})();
