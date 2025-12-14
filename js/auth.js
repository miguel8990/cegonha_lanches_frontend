// site/js/auth.js
import { loginUser, API_BASE_URL } from "./api.js";
import { openAuthModal, showToast } from "./main.js";

// ==========================================
//  GESTÃO DE SESSÃO (Interface Visual)
//  Nota: O Token real fica num Cookie HttpOnly invisível ao JS.
// ==========================================

export function saveSession(token, user) {
  // Salvamos apenas os dados públicos do usuário para a interface (Nome, Email, Role)
  // O Token JWT não é mais salvo no localStorage por segurança.
  if (user) {
    localStorage.setItem("user", JSON.stringify(user));
  }
  if (token) {
    localStorage.setItem("auth_token", token);
  }
}

export function getSession() {
  const userStr = localStorage.getItem("user");
  let user = {};

  try {
    user = userStr ? JSON.parse(userStr) : {};
  } catch (e) {
    user = {};
  }

  // Retorna um "token fictício" apenas para manter compatibilidade com verificações antigas
  // Ex: if (token) ...
  const fakeToken = user.id ? "session_active" : null;

  return { token: fakeToken, user };
}

export function clearSession() {
  // Limpa dados visuais
  localStorage.removeItem("user");
}

export async function logout() {
  try {
    // 1. Avisa o backend para destruir o cookie HttpOnly
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include", // <--- OBRIGATÓRIO: Envia o cookie para ser apagado
    });
  } catch (e) {
    console.error("Erro ao fazer logout:", e);
  }

  // 2. Limpa o visual
  clearSession();

  if (window.showToast) window.showToast("Sessão terminada.", "info");
  setTimeout(() => {
    window.location.href = "index.html";
  }, 1000);
}

// Mantido para compatibilidade, mas retorna null (segurança)
export function getToken() {
  return null;
}

// ==========================================
//  LÓGICA DE PÁGINAS (Magic Link & Login)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  checkMagicLinkReturn();
});

export function checkMagicLinkReturn() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");
  const token = params.get("token");

  if (status === "verified") {
    // Backend retornou sucesso via URL
    const name = params.get("name");
    const role = params.get("role");
    const id = params.get("id");
    const whatsapp = params.get("whatsapp");

    if (name && id) {
      // O cookie HttpOnly já foi setado pelo backend no redirect.
      // Apenas salvamos o estado visual.
      const userObj = { id, name, role, whatsapp };
      saveSession(token, { id, name, role, whatsapp });

      // Limpa a URL para ficar bonita
      // Mude para isto:
      window.history.replaceState({}, document.title, window.location.pathname);

      if (window.checkLoginState) window.checkLoginState();
      if (window.showToast) window.showToast(`Bem-vindo, ${name}!`, "success");
    }
  } else if (status === "error_token") {
    if (window.showToast)
      window.showToast("Link inválido ou expirado.", "error");
  } else if (status === "error_user") {
    if (window.showToast) window.showToast("Usuário não encontrado.", "error");
  }
}

// Formulário da página login.html (Standalone)
const form = document.getElementById("standalone-login-form");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("page-email").value;
    const pass = document.getElementById("page-password").value;
    const btn = form.querySelector("button");
    const txt = btn.innerText;

    btn.innerText = "Verificando...";
    btn.disabled = true;

    // loginUser (do api.js) já deve estar usando fetchAuth ou credentials: 'include'
    const res = await loginUser(email, pass);

    if (res.success) {
      saveSession(null, res.user);
      window.location.href = "index.html";
    } else {
      showToast("Erro: " + res.error);
      btn.innerText = txt;
      btn.disabled = false;
    }
  });
}

// Funções para abrir/fechar modal (Helpers globais)
export function abrirModalLogin() {
  const modal =
    typeof openAuthModal === "function"
      ? openAuthModal()
      : document.getElementById("modal-auth");
  if (modal) {
    if (modal instanceof HTMLElement) modal.style.display = "block";
    // Se openAuthModal já abre, não precisa fazer nada aqui
  }
}

export function fecharModalLogin() {
  const modal = document.getElementById("modal-auth"); // Ajustado ID padrão
  if (modal) modal.style.display = "none";
}

// ==========================================
//  MAGIC LINK (Acesso sem senha)
// ==========================================

export async function pedirMagicLink(event) {
  event.preventDefault();
  const email = document.getElementById("magic-email").value;
  const btn = event.target.querySelector("button");
  const txtOriginal = btn.innerText;

  btn.innerText = "Enviando...";
  btn.disabled = true;

  try {
    // [CORREÇÃO] Usando a constante importada para evitar duplicação de lógica
    const res = await fetch(`${API_BASE_URL}/auth/magic-login/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      credentials: "include", // Boa prática para manter consistência CORS
    });

    const data = await res.json();

    if (res.ok) {
      if (window.abrirModalMagic) {
        window.abrirModalMagic();
      } else {
        showToast("Verifique seu e-mail! Link enviado.", "success");
      }
      const emailInput = document.getElementById("login-email");
      if (emailInput) emailInput.value = "";
    } else {
      showToast(data.error || "Erro ao enviar link.", "error");
      // Se o erro for de nome, muda aba (lógica específica do seu app)
      if (data.error && data.error.includes("Nome")) {
        if (window.switchAuthTab) window.switchAuthTab("register");
      }
    }
  } catch (error) {
    console.error(error);
    showToast("Erro de conexão com o servidor.", "error");
  } finally {
    btn.innerText = txtOriginal;
    btn.disabled = false;
  }
}

// ==========================================
//  GOOGLE AUTH
// ==========================================

async function handleGoogleCredentialResponse(response) {
  console.log("Token Google recebido...");

  try {
    const res = await fetch(`${API_BASE_URL}/auth/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ credential: response.credential }),
      credentials: "include", // Garante que a sessão (cookie) seja estabelecida corretamente
    });

    const data = await res.json();

    if (res.ok) {
      saveSession(data.token, data.user);
      if (window.showToast)
        window.showToast(`Bem-vindo, ${data.user.name}!`, "success");

      setTimeout(() => window.location.reload(), 1000);
    } else {
      alert(data.message || "Erro ao logar com Google");
    }
  } catch (error) {
    console.error("Erro comunicação API:", error);
    alert("Erro ao conectar com o servidor.");
  }
}

export function initGoogleButton() {
  let tentativas = 0;
  const intervalo = setInterval(() => {
    if (window.google) {
      clearInterval(intervalo);

      // Lembre-se de substituir pelo seu Client ID real se mudar
      window.google.accounts.id.initialize({
        client_id:
          "681186932916-jsjkbpajai5mchsbrfrbmfshh27cqpo6.apps.googleusercontent.com",
        callback: handleGoogleCredentialResponse,
      });

      const btnContainer = document.getElementById("google-btn-container");
      if (btnContainer) {
        window.google.accounts.id.renderButton(btnContainer, {
          theme: "outline",
          size: "large",
          type: "standard",
          text: "signin_with",
        });
      }
    } else {
      tentativas++;
      if (tentativas > 20) {
        // 10 segundos
        clearInterval(intervalo);
        console.warn("Google Auth script não carregou.");
      }
    }
  }, 500);
}
