// site/js/auth.js
import { loginUser } from "./api.js";

// Este arquivo roda apenas na página login.html
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
      // Salva sessão
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));

      // Redireciona para o site principal já logado
      window.location.href = "index.html";
    } else {
      alert("Erro: " + res.error);
      btn.innerText = txt;
      btn.disabled = false;
    }
  });
}
