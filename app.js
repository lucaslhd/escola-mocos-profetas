const form = document.getElementById("registrationForm");
const submitButton = document.getElementById("submitButton");
const formStatus = document.getElementById("formStatus");
const voucherCard = document.getElementById("voucherCard");
const voucherNumber = document.getElementById("voucherNumber");
const voucherName = document.getElementById("voucherName");
const downloadVoucherBtn = document.getElementById("downloadVoucherBtn");

let currentVoucherData = null;

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
      cfg.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      }
    );

    const registeredFullName = document.getElementById("fullName").value.trim();
    const registeredPhone = normalizePhone(document.getElementById("phone").value);
    const registeredEmail = document.getElementById("email").value.trim().toLowerCase();
    const registeredConsent = document.getElementById("consent").checked;

    // Chamada RPC segura create_registration (SECURITY DEFINER no Supabase)
    const { data, error } = await supabaseClient.rpc("create_registration", {
      p_full_name: registeredFullName,
      p_phone: registeredPhone,
      p_email: registeredEmail,
      p_consent: registeredConsent
    });

    if (error) {
      if (error.code === "23505" || (error.message && error.message.includes("duplicate"))) {
        throw new Error("Este e-mail ou telefone já foi cadastrado para este evento.");
      }
      throw error;
    }

    const regData = Array.isArray(data) ? data[0] : data;
    const rawNumber = regData?.registration_number;

    if (rawNumber === null || rawNumber === undefined) {
      throw new Error("Não foi possível obter o número de inscrição gerado.");
    }

    const formattedNumber = String(rawNumber).padStart(3, "0");
    const confirmedName = regData?.full_name || registeredFullName;

    // Substituir área do formulário pelo comprovante elegante
    form.classList.add("hidden");
    voucherNumber.textContent = formattedNumber;
    voucherName.textContent = confirmedName;
    voucherCard.classList.remove("hidden");

    currentVoucherData = {
      number: formattedNumber,
      name: confirmedName
    };

    voucherCard.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (err) {
    console.error("Erro na inscrição:", err);
    formStatus.className = "form-status error";
    formStatus.textContent = err.message || "Não foi possível concluir agora. Tente novamente em instantes.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Confirmar inscrição";
  }
});

// Download do comprovante elegante em formato PNG via Canvas 2D
if (downloadVoucherBtn) {
  downloadVoucherBtn.addEventListener("click", async () => {
    const number = (currentVoucherData?.number || voucherNumber?.textContent || "001").trim();
    const name = (currentVoucherData?.name || voucherName?.textContent || "Participante").trim();

    const originalText = downloadVoucherBtn.textContent;
    downloadVoucherBtn.disabled = true;
    downloadVoucherBtn.textContent = "⏳ Gerando comprovante...";

    try {
      await downloadVoucherAsPng(number, name);
    } catch (err) {
      console.error("Erro ao gerar comprovante:", err);
      alert("Não foi possível gerar o arquivo de download automaticamente. Tente novamente.");
    } finally {
      downloadVoucherBtn.disabled = false;
      downloadVoucherBtn.textContent = originalText;
    }
  });
}

async function downloadVoucherAsPng(number, name) {
  // Aguarda carregamento de fontes para nitidez perfeita
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (_) {}
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // Alta resolução: 1080 x 1350 px
  canvas.width = 1080;
  canvas.height = 1350;

  // Fundo degradê escuro
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bgGrad.addColorStop(0, "#0e0a07");
  bgGrad.addColorStop(0.5, "#150f09");
  bgGrad.addColorStop(1, "#090604");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Brilho radial dourado no topo/centro
  const glowGrad = ctx.createRadialGradient(540, 380, 40, 540, 380, 500);
  glowGrad.addColorStop(0, "rgba(213, 163, 70, 0.18)");
  glowGrad.addColorStop(1, "rgba(213, 163, 70, 0)");
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Moldura externa dourada dupla
  ctx.save();
  ctx.strokeStyle = "rgba(213, 163, 70, 0.55)";
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 40, 40, 1000, 1270, 28);
  ctx.stroke();

  ctx.strokeStyle = "rgba(213, 163, 70, 0.22)";
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, 52, 52, 976, 1246, 22);
  ctx.stroke();

  // Cantoneiras ornamentais
  drawCornerAccents(ctx, 52, 52, 976, 1246, 30);
  ctx.restore();

  ctx.textAlign = "center";

  // Badge superior: ✓ INSCRIÇÃO CONFIRMADA
  const badgeY = 130;
  const badgeW = 440;
  const badgeH = 50;
  ctx.save();
  ctx.fillStyle = "rgba(46, 196, 122, 0.12)";
  ctx.strokeStyle = "rgba(46, 196, 122, 0.5)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 540 - badgeW / 2, badgeY, badgeW, badgeH, 25);
  ctx.fill();
  ctx.stroke();

  ctx.font = "bold 22px 'Inter', sans-serif";
  ctx.fillStyle = "#5fe29e";
  ctx.fillText("✓ INSCRIÇÃO CONFIRMADA", 540, badgeY + 33);
  ctx.restore();

  // Rótulo: Nº DE INSCRIÇÃO
  ctx.font = "bold 20px 'Inter', sans-serif";
  ctx.fillStyle = "#D5A346";
  ctx.fillText("Nº DE INSCRIÇÃO", 540, 240);

  // Número em destaque dourado: 001
  ctx.font = "bold 100px 'Cinzel', 'Times New Roman', serif";
  const numGrad = ctx.createLinearGradient(0, 280, 0, 390);
  numGrad.addColorStop(0, "#fff5dc");
  numGrad.addColorStop(0.6, "#f2d07b");
  numGrad.addColorStop(1, "#bd7b20");
  ctx.fillStyle = numGrad;
  ctx.fillText(number, 540, 360);

  // Linha divisória dourada
  const divGrad = ctx.createLinearGradient(160, 0, 920, 0);
  divGrad.addColorStop(0, "rgba(213, 163, 70, 0)");
  divGrad.addColorStop(0.5, "rgba(213, 163, 70, 0.7)");
  divGrad.addColorStop(1, "rgba(213, 163, 70, 0)");
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(160, 410);
  ctx.lineTo(920, 410);
  ctx.stroke();

  // Saudação com nome
  ctx.font = "bold 32px 'Inter', sans-serif";
  ctx.fillStyle = "#F5E8C7";
  const displayName = name.length > 34 ? name.slice(0, 32) + "..." : name;
  ctx.fillText(`${displayName}, sua inscrição foi realizada com sucesso!`, 540, 475);

  // Card do Evento
  const cardX = 120;
  const cardY = 530;
  const cardW = 840;
  const cardH = 480;

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
  ctx.strokeStyle = "rgba(213, 163, 70, 0.28)";
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 20);
  ctx.fill();
  ctx.stroke();

  // Título do evento
  ctx.font = "bold 36px 'Cinzel', 'Times New Roman', serif";
  ctx.fillStyle = "#f2d07b";
  ctx.fillText("ESCOLA DE MOÇOS E PROFETAS", 540, cardY + 70);

  ctx.font = "500 24px 'Inter', sans-serif";
  ctx.fillStyle = "#A89886";
  ctx.fillText("Tabernáculo de Profetas", 540, cardY + 115);

  // Linha sutil interna
  ctx.strokeStyle = "rgba(213, 163, 70, 0.2)";
  ctx.beginPath();
  ctx.moveTo(cardX + 60, cardY + 150);
  ctx.lineTo(cardX + cardW - 60, cardY + 150);
  ctx.stroke();

  // Datas e Local
  ctx.font = "600 28px 'Inter', sans-serif";
  ctx.fillStyle = "#F5E8C7";
  ctx.fillText("📅 07/11 — 16h às 22h", 540, cardY + 220);
  ctx.fillText("📅 08/11 — 08h às 11h", 540, cardY + 285);
  ctx.fillText("📍 Vila Maria Alta — SP", 540, cardY + 350);

  ctx.font = "400 22px 'Inter', sans-serif";
  ctx.fillStyle = "#A89886";
  ctx.fillText("Av. Alberto Byington, 2354", 540, cardY + 395);
  ctx.restore();

  // Tag: SUA VAGA ESTÁ CONFIRMADA
  const tagY = 1050;
  const tagW = 840;
  const tagH = 75;
  ctx.save();
  ctx.fillStyle = "rgba(213, 163, 70, 0.12)";
  ctx.strokeStyle = "rgba(213, 163, 70, 0.35)";
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, 540 - tagW / 2, tagY, tagW, tagH, 14);
  ctx.fill();
  ctx.stroke();

  ctx.font = "bold 28px 'Inter', sans-serif";
  ctx.fillStyle = "#f2d07b";
  ctx.fillText("SUA VAGA ESTÁ CONFIRMADA", 540, tagY + 48);
  ctx.restore();

  // Rodapé institucional
  ctx.font = "400 18px 'Inter', sans-serif";
  ctx.fillStyle = "#7F6F5F";
  ctx.fillText("Apresente este comprovante no credenciamento do evento.", 540, 1195);
  ctx.fillText("Tabernáculo de Profetas • Discípulos hoje, referências amanhã.", 540, 1230);

  // Baixar imagem PNG usando Blob com fallback para DataURL
  return new Promise((resolve) => {
    const filename = `comprovante-inscricao-${number}.png`;
    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (!blob) {
          triggerDataUrlDownload(canvas, filename);
          resolve();
          return;
        }
        const blobUrl = URL.createObjectURL(blob);
        const downloadLink = document.createElement("a");
        downloadLink.style.display = "none";
        downloadLink.download = filename;
        downloadLink.href = blobUrl;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        setTimeout(() => {
          if (downloadLink.parentNode) {
            downloadLink.parentNode.removeChild(downloadLink);
          }
          URL.revokeObjectURL(blobUrl);
        }, 2000);
        resolve();
      }, "image/png");
    } else {
      triggerDataUrlDownload(canvas, filename);
      resolve();
    }
  });
}

function triggerDataUrlDownload(canvas, filename) {
  const dataUrl = canvas.toDataURL("image/png");
  const downloadLink = document.createElement("a");
  downloadLink.style.display = "none";
  downloadLink.download = filename;
  downloadLink.href = dataUrl;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  setTimeout(() => {
    if (downloadLink.parentNode) {
      downloadLink.parentNode.removeChild(downloadLink);
    }
  }, 2000);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawCornerAccents(ctx, x, y, width, height, len) {
  ctx.strokeStyle = "rgba(213, 163, 70, 0.65)";
  ctx.lineWidth = 2.5;

  // Canto superior esquerdo
  ctx.beginPath();
  ctx.moveTo(x, y + len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len, y);
  ctx.stroke();

  // Canto superior direito
  ctx.beginPath();
  ctx.moveTo(x + width - len, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + len);
  ctx.stroke();

  // Canto inferior esquerdo
  ctx.beginPath();
  ctx.moveTo(x, y + height - len);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x + len, y + height);
  ctx.stroke();

  // Canto inferior direito
  ctx.beginPath();
  ctx.moveTo(x + width - len, y + height);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width, y + height - len);
  ctx.stroke();
}

// Controle de som do vídeo de apresentação
const heroVideo = document.getElementById("heroVideo");
const soundToggle = document.getElementById("soundToggle");

if (heroVideo && soundToggle) {
  soundToggle.addEventListener("click", () => {
    if (heroVideo.muted) {
      heroVideo.muted = false;
      heroVideo.play().catch(() => {});
      soundToggle.textContent = "🔇 Silenciar";
      soundToggle.setAttribute("aria-label", "Silenciar");
    } else {
      heroVideo.muted = true;
      soundToggle.textContent = "🔊 Ativar som";
      soundToggle.setAttribute("aria-label", "Ativar som");
    }
  });
}

