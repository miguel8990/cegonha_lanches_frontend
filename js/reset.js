// site/js/reset.js

const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";
const API_BASE_URL = isLocalhost
  ? "http://localhost:5000/api"
  : "https://cegonha-lanches-backend.onrender.com/api";

// Reutiliza a lógica de Toast do main.js (simplificada aqui)
function showToast(msg, type = "info") {
  const container = document.getElementById("toast-container");
  const div = document.createElement("div");
  div.className = `toast ${type}`;
  div.style.opacity = 1;
  div.innerHTML = `<span>${msg}</span>`;
  container.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

// Reutiliza validação de senha
window.validarPass = function (senha) {
  const el = document.getElementById("pass-strength");
  if (senha.length < 8) {
    el.innerText = "Mínimo 8 caracteres";
    el.style.color = "#e74c3c";
  } else {
    el.innerText = "Senha Ok";
    el.style.color = "#2ecc71";
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // 1. Verifica se existe token na URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  // Elementos das telas
  const stepRequest = document.getElementById("step-request");
  const stepNewPass = document.getElementById("step-new-pass");
  const stepSent = document.getElementById("step-sent");

  if (token) {
    // MODO B: Tem token, usuário quer definir senha
    stepRequest.classList.remove("active");
    stepNewPass.classList.add("active");
    initResetForm(token);
  } else {
    // MODO A: Não tem token, usuário esqueceu senha
    stepRequest.classList.add("active");
    initRequestForm();
  }
});

// --- LÓGICA MODO A: Pedir Link ---
function initRequestForm() {
  const form = document.getElementById("form-request-reset");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email-request").value;
    const btn = form.querySelector("button");

    btn.innerText = "Enviando...";
    btn.disabled = true;

    try {
      document.cookie = `token=${token}; path=/; max-age=3600; samesite=lax`;
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email }),
        credentials: "include",
      });

      // Por segurança, sempre mostramos sucesso (para não revelar se o email existe)
      document.getElementById("step-request").classList.remove("active");
      document.getElementById("step-sent").classList.add("active");
    } catch (error) {
      showToast("Erro de conexão.", "error");
      btn.innerText = "Tentar Novamente";
      btn.disabled = false;
    }
  });
}

// --- LÓGICA MODO B: Salvar Senha ---
function initResetForm(token) {
  const form = document.getElementById("form-confirm-reset");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const p1 = document.getElementById("new-password").value;
    const p2 = document.getElementById("confirm-password").value;
    const btn = form.querySelector("button");

    if (p1 !== p2) return showToast("As senhas não conferem!", "warning");
    if (p1.length < 8) return showToast("Senha muito curta.", "warning");

    btn.innerText = "Salvando...";
    btn.disabled = true;

    try {
      // O Token JWT vai no Header Authorization
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_password: p1 }),
      });

      const data = await res.json();

      if (res.ok) {
        document.cookie =
          "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        alert("Sucesso! Sua senha foi alterada. Faça login agora.");
        window.location.href = "index.html"; // Redireciona para login
      } else {
        showToast(data.error || "Link expirado ou inválido.", "error");
        btn.innerText = "Erro";
        // Opcional: Redirecionar para pedir token de novo após uns segundos
      }
    } catch (error) {
      showToast("Erro ao conectar com servidor.", "error");
      btn.disabled = false;
    }
  });
}
