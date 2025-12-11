// site/js/auth.js
import { loginUser, API_BASE_URL } from "./api.js";
import { openAuthModal, showToast } from "./main.js";

// ==========================================
//  SISTEMA DE COOKIES (Sessão Robusta)
// ==========================================

export function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }
  // Secure: Só envia em HTTPS (ou localhost)
  // SameSite=Strict: Protege contra CSRF
  document.cookie =
    name +
    "=" +
    (encodeURIComponent(value) || "") +
    expires +
    "; path=/; SameSite=Strict"; // Adicione "Secure;" se estiver em produção com HTTPS
}

export function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0)
      return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
}

export function eraseCookie(name) {
  document.cookie = name + "=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
}

// ==========================================
//  GESTÃO DE SESSÃO (API Pública)
// ==========================================

export function saveSession(token, user) {
  // Salva o Token e User por 7 dias (Persistência)
  setCookie("auth_token", token, 7);
  setCookie("user_data", JSON.stringify(user), 7);

  // Limpa o localStorage antigo para não gerar conflito
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getSession() {
  const token = getCookie("auth_token");
  const userStr = getCookie("user_data");
  let user = {};
  try {
    user = userStr ? JSON.parse(userStr) : {};
  } catch (e) {
    user = {};
  }
  return { token, user };
}

export function clearSession() {
  eraseCookie("auth_token");
  eraseCookie("user_data");
  // Garante limpeza total
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function logout() {
  // 1. Limpa todos os dados da sessão
  clearSession();

  // 2. Opcional: Feedback visual antes de recarregar (se a função existir globalmente)
  if (window.showToast) {
    window.showToast("Sessão terminada.", "info");
  }

  // 3. Redireciona para a página inicial (ou login) para "limpar" o estado visual da aplicação
  setTimeout(() => {
    window.location.href = "index.html";
  }, 1000); // Pequeno delay para o utilizador perceber que saiu
}

export function getToken() {
  return getCookie("auth_token");
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

  if (status === "verified") {
    const token = params.get("token");
    const name = params.get("name");
    const role = params.get("role");
    // Se o ID vier na URL, capture-o também, senão o backend deve retornar no user object futuro
    const id = params.get("id");

    if (token && name) {
      // Salva usando o novo sistema de Cookies
      const userObj = { id, name, role };
      saveSession(token, userObj);

      // Limpa a URL
      window.history.replaceState({}, document.title, "/index.html");

      // Se a função de UI existir globalmente, atualiza
      if (window.checkLoginState) window.checkLoginState();
      if (window.showToast)
        window.showToast(`Email confirmado! Bem-vindo, ${name}.`, "success");
    }
  } else if (status === "error_token") {
    if (window.showToast)
      window.showToast("Link de verificação inválido ou expirado.", "error");
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

    const res = await loginUser(email, pass);

    if (res.success) {
      // Salva sessão nos cookies
      saveSession(res.token, res.user);
      window.location.href = "index.html";
    } else {
      showToast("Erro: " + res.error);
      btn.innerText = txt;
      btn.disabled = false;
    }
  });
}

export function abrirModalLogin() {
  // 1. Procura o elemento do modal no HTML
  const modal = openAuthModal();

  // 2. Verifica se o modal realmente existe antes de tentar abrir
  if (modal) {
    modal.style.display = "block"; // Torna o modal visível
    console.log("Modal de login aberto com sucesso.");
  } else {
    console.error('Erro: O elemento "modal-login" não foi encontrado no HTML.');
  }
}

/**
 * Função para fechar o modal de login (Bónus: é sempre bom ter o par).
 */
export function fecharModalLogin() {
  const modal = document.getElementById("modal-login");
  if (modal) {
    modal.style.display = "none"; // Esconde o modal
  }
}

// Função para enviar o pedido
// site/js/auth.js

// ... (resto do arquivo acima)

export async function pedirMagicLink(event) {
  event.preventDefault();
  const email = document.getElementById("magic-email").value;
  const btn = event.target.querySelector("button");
  const txtOriginal = btn.innerText;

  btn.innerText = "Enviando...";
  btn.disabled = true;

  try {
    // Detecta URL dinamicamente
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    const baseUrl = isLocalhost
      ? "http://localhost:5000/api"
      : "https://cegonha-lanches-backend.onrender.com/api";

    const res = await fetch(`${baseUrl}/auth/magic-login/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (res.ok) {
      // --- MUDANÇA AQUI ---
      // 1. Removemos o Toast simples
      // 2. Chamamos o Modal explicativo
      if (window.abrirModalMagic) {
        window.abrirModalMagic();
      } else {
        // Fallback de segurança caso a função do modal não tenha carregado
        showToast("Verifique seu e-mail! Link enviado.", "success");
      }

      // 3. (Opcional) Limpar o campo de e-mail para não confundir o usuário
      const emailInput = document.getElementById("login-email"); // Verifique se o ID é esse mesmo no seu HTML
      if (emailInput) emailInput.value = "";
    } else {
      // Lógica de Erro (Mantém igual)
      showToast(data.error || "Erro ao enviar link.", "error");

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

// Função que o Google chama ao completar o login
async function handleGoogleCredentialResponse(response) {
  console.log("Token Google recebido:", response.credential);

  try {
    const res = await fetch(`${API_BASE_URL}/auth/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ credential: response.credential }),
    });

    const data = await res.json();

    if (res.ok) {
      // Reutiliza sua lógica de sucesso existente (salvar token, atualizar UI)
      // Aqui estou simulando o que você provavelmente faz no login normal
      saveSession(data.token, data.user);

      alert(`Bem-vindo, ${data.user.name}!`);
      window.location.reload(); // Ou fechar modal e atualizar header
    } else {
      alert(data.message || "Erro ao logar com Google");
    }
  } catch (error) {
    console.error("Erro comunicação API:", error);
    alert("Erro ao conectar com o servidor.");
  }
}

// Inicializa o botão (chame isso quando a página carregar ou quando abrir o modal)
// site/js/auth.js

export function initGoogleButton() {
  // Tenta verificar se o Google carregou a cada meio segundo
  let tentativas = 0;
  const intervalo = setInterval(() => {
    if (window.google) {
      clearInterval(intervalo); // Parar de tentar, já carregou!

      // Inicializa com seu Client ID
      window.google.accounts.id.initialize({
        client_id:
          "681186932916-jsjkbpajai5mchsbrfrbmfshh27cqpo6.apps.googleusercontent.com",
        callback: handleGoogleCredentialResponse,
      });

      // Renderiza o botão
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
      // Desiste após 5 segundos (10 tentativas) para não travar
      if (tentativas > 10) {
        clearInterval(intervalo);
        console.error("Google Identity Services não carregou a tempo.");
      }
    }
  }, 500);
}
