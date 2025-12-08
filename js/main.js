import {
  fetchMenu,
  fetchCombos,
  submitOrder,
  loginUser,
  registerUser,
  updateUserProfile,
  fetchAddresses,
  addAddress,
  setActiveAddress,
  deleteAddress,
  fetchMyOrders,
  getChatMessages,
  sendChatMessage,
  fetchPublicCoupons,
  fetchNeighborhoodsPublic,
  fetchSchedule,
} from "./api.js";
import {
  checkMagicLinkReturn,
  abrirModalLogin,
  getSession,
  saveSession,
  clearSession,
  pedirMagicLink,
} from "./auth.js";

// Estado Global
let carrinho = [];
let menuGlobal = [];
let itemEmPersonalizacao = null;
let cuponsDisponiveis = [];
let cupomSelecionado = null; // Objeto do cupom
let taxaEntregaAtual = 0;
let lojaAberta = false;
let horariosGlobal = [];

window.showToast = function (message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  // Ícones baseados no tipo
  let icon = "fa-circle-info";
  if (type === "success") icon = "fa-circle-check";
  if (type === "error") icon = "fa-circle-xmark";
  if (type === "warning") icon = "fa-triangle-exclamation";

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;

  container.appendChild(toast);

  // Remove do DOM após a animação (4.3s)
  setTimeout(() => {
    toast.remove();
  }, 4300);
};

document.addEventListener("DOMContentLoaded", () => {
  initMenu();
  initCombos();
  carregarCarrinhoLocal();
  initContactForm();
  initMobileMenu();
  initScrollEffects();
  initHorarioFuncionamento();
  initBairrosSelect();
  salvarCarrinhoLocal();
  checkMagicLinkReturn();

  // Verifica Login ao carregar
  checkLoginState();
  initAuthModalLogic();
  initCoupons();

  // Fecha modais ao clicar fora
  // Fecha modais e menus ao clicar fora
  window.onclick = (event) => {
    const modalProd = document.getElementById("modal-personalizacao");
    const modalAuth = document.getElementById("modal-auth");
    const accPhone = document.getElementById("acc-whatsapp");

    // 1. Fecha Modais Grandes (se clicar no fundo escuro)
    if (event.target === modalProd) fecharModal();
    if (event.target === modalAuth) closeAuthModal();
    if (accPhone) {
      accPhone.addEventListener("input", (e) => {
        let v = e.target.value.replace(/\D/g, "");
        if (v.length > 11) v = v.slice(0, 11);
        if (v.length > 2) v = `(${v.substring(0, 2)}) ${v.substring(2)}`;
        if (v.length > 7) v = `${v.substring(0, 10)}-${v.substring(10)}`;
        e.target.value = v;
      });
    }

    // 2. Fecha o Menu de Perfil (Dropdown)
    const profileMenu = document.getElementById("profile-menu");
    const profileIcon = document.querySelector(".profile-icon");

    // Se o menu existe e está aberto...
    if (profileMenu && profileMenu.style.display === "block") {
      // ...e o clique NÃO foi dentro do menu E NÃO foi no ícone que abre ele
      if (
        !profileMenu.contains(event.target) &&
        !profileIcon.contains(event.target)
      ) {
        profileMenu.style.display = "none";
      }
    }
  };
});

// EXPORTA FUNÇÕES PARA O HTML USAR (onclick="")
window.adicionarAoCarrinho = adicionarAoCarrinho;
window.toggleCart = toggleCart;
window.removerItem = removerItem;
window.finalizarPedido = finalizarPedido;
window.alterarQuantidade = alterarQuantidade;
window.adicionarComQuantidade = adicionarComQuantidade;
window.alterarQuantidadeCarrinho = alterarQuantidadeCarrinho;
window.verificarOpcoes = verificarOpcoes;
window.fecharModal = fecharModal;
window.adicionarItemDoModal = adicionarItemDoModal;
window.atualizarSelecaoModal = atualizarSelecaoModal;
window.mudarQtdModal = mudarQtdModal;
// Auth Exports
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthTab = switchAuthTab;
window.toggleProfileMenu = toggleProfileMenu;
window.logout = logout;
window.fecharModalAuth = closeAuthModal;
window.openAccountModal = openAccountModal;
window.closeAccountModal = closeAccountModal;
window.saveAccountDetails = saveAccountDetails;
window.toggleMobileMenu = toggleMobileMenu;
window.openAddressesModal = openAddressesModal;
window.closeAddressesModal = closeAddressesModal;
window.toggleAddAddressForm = toggleAddAddressForm;
window.selecionarEnderecoAtivo = selecionarEnderecoAtivo;
window.excluirEndereco = excluirEndereco;
window.abrirHistoricoPedidos = abrirHistoricoPedidos;
window.fecharModalPedidos = fecharModalPedidos;
window.mostrarForcaSenha = mostrarForcaSenha;
window.toggleChat = toggleChat;
window.enviarMensagemChat = enviarMensagemChat;
window.handleChatKey = handleChatKey;
window.toggleTroco = toggleTroco;

// --- 1. AUTENTICAÇÃO ---

function checkLoginState() {
  const { token, user } = getSession();

  const btnLogin = document.getElementById("btn-open-login");
  const profileArea = document.getElementById("user-profile-area");
  const nameDisplay = document.getElementById("user-name-display");

  // [NOVO] Pega a referência do link admin
  const adminLink = document.getElementById("admin-link");

  // Auto-preenchimento (Nome e WhatsApp)
  if (user.name) {
    const nameInput = document.getElementById("name");
    if (nameInput && !nameInput.value) nameInput.value = user.name;
  }
  if (user.whatsapp) {
    const phoneInput = document.getElementById("phone");
    if (phoneInput && !phoneInput.value) phoneInput.value = user.whatsapp;
  }

  // Lógica de Exibição (Logado vs Deslogado)
  if (token && user.name) {
    if (btnLogin) btnLogin.style.display = "none";
    if (profileArea) profileArea.style.display = "flex"; // 'flex' para alinhar bolinha
    if (nameDisplay) nameDisplay.innerText = `Olá, ${user.name.split(" ")[0]}`;

    // [NOVO] Lógica do Botão Admin
    if (adminLink) {
      if (user.role === "admin" || user.role === "super_admin") {
        adminLink.style.display = "block"; // Mostra se for chefe
      } else {
        adminLink.style.display = "none"; // Esconde se for cliente
      }
    }

    // Busca endereço ativo
    if (user.id) {
      fetchAddresses().then((list) => preencherCheckoutComAtivo(list));
    }
  } else {
    // Deslogado
    if (btnLogin) btnLogin.style.display = "flex";
    if (profileArea) profileArea.style.display = "none";
    if (adminLink) adminLink.style.display = "none"; // Garante que suma
  }
}

export function openAuthModal() {
  document.getElementById("modal-auth").style.display = "flex";
  switchAuthTab("login");
}

function closeAuthModal() {
  document.getElementById("modal-auth").style.display = "none";

  // 1. Limpa os dados digitados
  const loginForm = document.getElementById("form-login");
  const regForm = document.getElementById("form-register");
  if (loginForm) loginForm.reset();
  if (regForm) regForm.reset();

  // 2. (Opcional) Reseta visualmente para a aba de Login
  // Assim, se o usuário abrir de novo, começa do início
  switchAuthTab("login");

  // 3. (Opcional) Restaura o texto dos botões se estiverem como "Enviando..."
  if (loginForm) {
    const btn = loginForm.querySelector("button");
    if (btn) {
      btn.innerText = "Entrar";
      btn.disabled = false;
    }
  }
  if (regForm) {
    const btn = regForm.querySelector("button");
    if (btn) {
      btn.innerText = "Cadastrar";
      btn.disabled = false;
    }
  }
}

function switchAuthTab(tab) {
  const magicForm = document.getElementById("form-magic-login");
  const passForm = document.getElementById("form-password-login");
  const regForm = document.getElementById("form-register");
  const btns = document.querySelectorAll(".tab-btn");

  if (tab === "login") {
    // Por padrão, mostra o Magic Link ao abrir a aba Login
    magicForm.style.display = "block";
    passForm.style.display = "none";
    regForm.style.display = "none";

    if (btns[0]) btns[0].classList.add("active");
    if (btns[1]) btns[1].classList.remove("active");
  } else {
    // Aba Cadastro
    magicForm.style.display = "none";
    passForm.style.display = "none";
    regForm.style.display = "block";

    if (btns[0]) btns[0].classList.remove("active");
    if (btns[1]) btns[1].classList.add("active");
  }
}

function initAuthModalLogic() {
  // 1. Magic Link Submit
  const magicForm = document.getElementById("form-magic-login");
  if (magicForm) {
    magicForm.addEventListener("submit", pedirMagicLink);
  }

  // 2. [NOVO] Password Login Submit
  const passForm = document.getElementById("form-password-login");
  if (passForm) {
    passForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;
      const btn = passForm.querySelector("button");
      const originalText = btn.innerText;

      btn.innerText = "Entrando...";
      btn.disabled = true;

      // Chama a função de login da API (já existente)
      const res = await loginUser(email, password);

      if (res.success) {
        // Salva sessão (Cookies) e atualiza a tela
        saveSession(res.token, res.user);
        checkLoginState();
        closeAuthModal();
        showToast(
          `Bem-vindo de volta, ${res.user.name.split(" ")[0]}!`,
          "success"
        );
      } else {
        showToast(res.error || "Email ou senha incorretos.", "error");
      }

      btn.innerText = originalText;
      btn.disabled = false;
    });
  }

  // Register Submit
  const regForm = document.getElementById("form-register");
  if (regForm) {
    // [NOVO] MÁSCARA PARA O WHATSAPP NO CADASTRO
    const whatsappInput = regForm.querySelector('input[name="whatsapp"]');
    if (whatsappInput) {
      whatsappInput.addEventListener("input", (e) => {
        let v = e.target.value.replace(/\D/g, ""); // Remove tudo que não é dígito
        if (v.length > 11) v = v.slice(0, 11); // Limita a 11 números

        // Aplica a máscara (XX) XXXXX-XXXX
        if (v.length > 2) v = `(${v.substring(0, 2)}) ${v.substring(2)}`;
        if (v.length > 7) v = `${v.substring(0, 10)}-${v.substring(10)}`;

        e.target.value = v;
      });
    }

    regForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Captura os dados
      const data = {
        name: regForm.querySelector('input[name="name"]').value,
        email: regForm.querySelector('input[name="email"]').value,
        password: regForm.querySelector('input[name="password"]').value,
        // Remove a máscara antes de enviar pro banco (opcional, mas recomendado)
        whatsapp: regForm.querySelector('input[name="whatsapp"]').value || "",
      };

      const btn = regForm.querySelector("button");
      const txt = btn.innerText;
      btn.innerText = "Criando...";
      btn.disabled = true;

      const res = await registerUser(data);

      if (res.success) {
        showToast(
          "Cadastro criado! Um link de confirmação foi enviado para seu email."
        );

        regForm.reset();
      } else {
        showToast(res.error);
      }
      btn.innerText = txt;
      btn.disabled = false;
    });
  }
}

function toggleProfileMenu() {
  const menu = document.getElementById("profile-menu");
  if (menu.style.display === "block") {
    menu.style.display = "none";
  } else {
    menu.style.display = "block";
  }
}

function logout() {
  // [MUDANÇA] Limpa cookies
  clearSession();
  checkLoginState();
  toggleProfileMenu();
  showToast("Você saiu da conta.");
}

// --- 2. LÓGICA DO CARRINHO ---

function adicionarAoCarrinho(nome, preco, dadosExtras = {}) {
  const itemExistente = carrinho.find((item) => item.nome === nome);
  if (itemExistente) {
    itemExistente.quantity += 1;
  } else {
    carrinho.push({ nome, preco, quantity: 1, ...dadosExtras });
  }
  atualizarCarrinhoUI();
  atualizarBotoesMenu();
  animarCarrinho();
  showToast(`${nome} adicionado!`, "success");
  salvarCarrinhoLocal();
}

function removerItem(index) {
  carrinho.splice(index, 1);
  atualizarCarrinhoUI();
  atualizarBotoesMenu();
  showToast(`${nome} removido!`, "success");
  salvarCarrinhoLocal();
}

function atualizarCarrinhoUI() {
  const container = document.getElementById("cart-items");
  const contador = document.getElementById("cart-count");
  const totalSpan = document.getElementById("cart-total-price");

  container.innerHTML = "";
  let total = 0;
  let totalItens = 0;

  if (carrinho.length === 0) {
    container.innerHTML = '<p class="empty-msg">Seu carrinho está vazio 🍔</p>';
  } else {
    carrinho.forEach((item) => {
      total += item.preco * item.quantity;
      totalItens += item.quantity;
      const itemDiv = document.createElement("div");
      itemDiv.classList.add("cart-item-row");
      itemDiv.innerHTML = `
        <div style="flex: 1;">
            <h4 style="color:white; margin:0;">${item.nome}</h4>
            <small style="color:#aaa;">R$ ${(item.preco * item.quantity)
              .toFixed(2)
              .replace(".", ",")}</small>
        </div>
        <div class="cart-qty-controls">
            <button onclick="alterarQuantidadeCarrinho('${
              item.nome
            }', -1)">-</button>
            <span>${item.quantity}</span>
            <button onclick="alterarQuantidadeCarrinho('${
              item.nome
            }', 1)">+</button>
        </div>`;
      container.appendChild(itemDiv);
    });
  }
  if (contador) contador.innerText = totalItens;
  if (totalSpan)
    totalSpan.innerText = `R$ ${total.toFixed(2).replace(".", ",")}`;

  renderizarCupons();

  // Se o total caiu e tinha cupom selecionado inválido, remove ele
  const novoTotal = carrinho.reduce(
    (acc, item) => acc + item.preco * item.quantity,
    0
  );
  if (cupomSelecionado && novoTotal < cupomSelecionado.min_purchase) {
    cupomSelecionado = null;
    atualizarVisualDesconto();
    showToast("Cupom removido: Valor mínimo não atingido.", "warning");
  } else if (cupomSelecionado) {
    // Recalcula o valor do desconto se o total mudou
    atualizarVisualDesconto();
  }
}

function toggleCart(forceOpen = false) {
  const sidebar = document.getElementById("cart-sidebar");
  const overlay = document.getElementById("cart-overlay");

  if (forceOpen || !sidebar.classList.contains("open")) {
    sidebar.classList.add("open");
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  } else {
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
    document.body.style.overflow = "";
  }
}

function finalizarPedido() {
  if (carrinho.length === 0)
    return showToast("Adicione itens antes de fechar o pedido!", "warning");
  toggleCart();
  document.getElementById("contact").scrollIntoView({ behavior: "smooth" });
}

// --- 3. MENU E API ---

async function initMenu() {
  const menuGrid = document.getElementById("menu-grid");
  if (!menuGrid) return;
  try {
    const itens = await fetchMenu();
    menuGlobal = itens;
    menuGrid.innerHTML = itens.map(createMenuItemCard).join("");
    atualizarBotoesMenu();
  } catch (e) {
    menuGrid.innerHTML = "<p>Erro ao carregar cardápio</p>";
  }
}

async function initCombos() {
  const container = document.querySelector("#combos .carousel");
  if (!container) return;
  try {
    const itens = await fetchCombos();
    // Adiciona combos ao menu global para busca por ID
    itens.forEach((c) => {
      if (!menuGlobal.find((m) => m.id === c.id)) menuGlobal.push(c);
    });
    container.innerHTML = itens.map(createComboCard).join("");
    atualizarBotoesMenu();
  } catch (e) {
    container.innerHTML = "<p>Erro ao carregar combos</p>";
  }
}

// --- 4. MODAL DE PRODUTO ---

function verificarOpcoes(itemId, qtdId) {
  // Garante que itemId seja comparado como número ou string corretamente
  const produto = menuGlobal.find((p) => p.id == itemId);

  if (!produto) {
    console.error("Produto não encontrado no menu global:", itemId);
    showToast("Erro ao carregar produto. Tente recarregar a página.");
    return;
  }

  const qtdDisplay = document.getElementById(`qty-${qtdId}`);
  // Proteção caso o contador não exista (ex: em layouts diferentes)
  const quantidade = qtdDisplay ? parseInt(qtdDisplay.innerText) : 1;

  const d = produto.details || {};

  const temOpcoes =
    (d.carnes && d.carnes.length > 0) ||
    (d.adicionais && d.adicionais.length > 0) ||
    (d.acompanhamentos && d.acompanhamentos.length > 0) ||
    (d.bebidas && d.bebidas.length > 0);

  if (temOpcoes) {
    abrirModalProduto(produto, quantidade, qtdId);
  } else {
    adicionarComQuantidade(produto.name, produto.price, itemId);
  }
}

function adicionarComQuantidade(nome, preco, idVisual) {
  const display = document.getElementById(`qty-${idVisual}`);
  const qtd = parseInt(display.innerText);
  const produto = menuGlobal.find((p) => p.id == idVisual);

  for (let i = 0; i < qtd; i++) {
    adicionarAoCarrinho(nome, preco, { productId: produto.id, details: {} });
  }
  display.innerText = "1";
}

function abrirModalProduto(produto, qtd, qtdId) {
  const modal = document.getElementById("modal-personalizacao");
  document.body.style.overflow = "hidden";

  itemEmPersonalizacao = {
    produto: produto,
    qtd: qtd,
    qtdIdCard: qtdId,
    selecoes: {
      carnes: [],
      adicionais: [],
      acompanhamentos: [],
      bebidas: [],
    },
    precoBase: produto.price,
    precoTotal: produto.price,
  };

  // Preenche UI
  document.getElementById("modal-img").src = produto.image;
  document.getElementById("modal-title").innerText = produto.name;
  document.getElementById("modal-desc").innerText = produto.description;
  document.getElementById("modal-obs").value = "";

  // Renderiza Seções
  const d = produto.details || {};
  renderSection(
    "lista-carnes",
    "modal-carnes-section",
    d.carnes,
    "radio",
    "carne"
  );
  renderSection(
    "lista-adicionais",
    "modal-adicionais-section",
    d.adicionais,
    "checkbox",
    "add"
  );
  renderSection(
    "lista-acompanhamentos",
    "modal-acompanhamentos-section",
    d.acompanhamentos,
    "checkbox",
    "acomp"
  );
  renderSection(
    "lista-bebidas",
    "modal-bebidas-section",
    d.bebidas,
    "checkbox",
    "bebida"
  );

  // Auto-select carne
  if (d.carnes?.length > 0) {
    const r = document.querySelector('input[name="carne"]');
    if (r) r.checked = true;
  }
  atualizarSelecaoModal();
  modal.style.display = "flex"; // Mostra o modal
}

function renderSection(divId, secId, list, type, name) {
  const div = document.getElementById(divId);
  const section = document.getElementById(secId); // Pega a seção pelo ID correto

  if (!div || !section) return; // Proteção contra erro

  div.innerHTML = "";

  if (list && list.length > 0) {
    section.style.display = "block";
    list.forEach((item, idx) => {
      const priceTxt =
        item.price > 0 ? `+ R$ ${item.price.toFixed(2).replace(".", ",")}` : "";
      div.innerHTML += `
            <label class="option-row">
                <input type="${type}" name="${name}" value="${idx}" data-price="${item.price}" data-name="${item.nome}" onchange="atualizarSelecaoModal()">
                <div class="option-info"><span>${item.nome}</span><span class="option-price">${priceTxt}</span></div>
            </label>`;
    });
  } else {
    section.style.display = "none";
  }
}

function atualizarSelecaoModal() {
  let extra = 0;
  const s = itemEmPersonalizacao.selecoes;
  s.carnes = [];
  s.adicionais = [];
  s.acompanhamentos = [];
  s.bebidas = [];

  const carne = document.querySelector('input[name="carne"]:checked');
  if (carne) {
    s.carnes.push(carne.dataset.name);
    extra += parseFloat(carne.dataset.price);
  }

  ["add", "acomp", "bebida"].forEach((tipo) => {
    const key =
      tipo === "add"
        ? "adicionais"
        : tipo === "acomp"
        ? "acompanhamentos"
        : "bebidas";
    document.querySelectorAll(`input[name="${tipo}"]:checked`).forEach((c) => {
      s[key].push(c.dataset.name);
      extra += parseFloat(c.dataset.price);
    });
  });

  itemEmPersonalizacao.precoTotal = itemEmPersonalizacao.precoBase + extra;
  const total = itemEmPersonalizacao.precoTotal * itemEmPersonalizacao.qtd;
  document.getElementById("modal-total").innerText = `R$ ${total
    .toFixed(2)
    .replace(".", ",")}`;
}

function adicionarItemDoModal() {
  if (
    document.getElementById("modal-carnes-section").style.display !== "none" &&
    itemEmPersonalizacao.selecoes.carnes.length === 0
  ) {
    return showToast("Escolha uma carne!");
  }

  let nome = itemEmPersonalizacao.produto.name;
  const extras = [
    ...itemEmPersonalizacao.selecoes.carnes,
    ...itemEmPersonalizacao.selecoes.adicionais,
    ...itemEmPersonalizacao.selecoes.acompanhamentos,
    ...itemEmPersonalizacao.selecoes.bebidas,
  ];
  if (extras.length) nome += ` (${extras.join(", ")})`;
  const obs = document.getElementById("modal-obs").value;
  if (obs) nome += ` [Obs: ${obs}]`;

  const dadosExtras = {
    productId: itemEmPersonalizacao.produto.id,
    details: {
      carnes: itemEmPersonalizacao.selecoes.carnes,
      adicionais: itemEmPersonalizacao.selecoes.adicionais,
      acompanhamentos: itemEmPersonalizacao.selecoes.acompanhamentos,
      bebidas: itemEmPersonalizacao.selecoes.bebidas,
      obs: obs,
    },
  };

  for (let i = 0; i < itemEmPersonalizacao.qtd; i++) {
    adicionarAoCarrinho(nome, itemEmPersonalizacao.precoTotal, dadosExtras);
  }

  // Reset visual qtd
  const disp = document.getElementById(`qty-${itemEmPersonalizacao.qtdIdCard}`);
  if (disp) disp.innerText = "1";

  fecharModal();
}

function fecharModal() {
  document.getElementById("modal-personalizacao").style.display = "none";
  document.body.style.overflow = "";
}

function mudarQtdModal(delta) {
  // Essa função faltava no HTML que te passei antes, mas é bom ter se usar botões dentro do modal
}

// --- HELPERS ---
function getSafeId(name) {
  return name.replace(/[^a-zA-Z0-9]/g, "_");
}
function alterarQuantidade(id, delta) {
  const el = document.getElementById(`qty-${id}`);
  if (el) el.innerText = Math.max(1, parseInt(el.innerText) + delta);
}
function alterarQuantidadeCarrinho(nome, delta) {
  const item = carrinho.find((i) => i.nome === nome);
  if (item) {
    item.quantity += delta;
    if (item.quantity <= 0) carrinho = carrinho.filter((i) => i.nome !== nome);
  }
  atualizarCarrinhoUI();
  atualizarBotoesMenu();
  salvarCarrinhoLocal();
}
function atualizarBotoesMenu() {
  document.querySelectorAll(".btn-add-item").forEach((btn) => {
    const nome = btn.getAttribute("data-name");
    const qtd = carrinho
      .filter((i) => i.nome.startsWith(nome))
      .reduce((a, b) => a + b.quantity, 0);
    if (qtd > 0) {
      btn.innerHTML = `Adicionado (${qtd})`;
      btn.style.background = "var(--color-gold)";
      btn.style.color = "var(--color-black)";
    } else {
      btn.innerText = btn.classList.contains("btn-primary")
        ? "Eu Quero!"
        : "Adicionar";
      btn.style.background = "";
      btn.style.color = "";
    }
  });
}
function animarCarrinho() {
  const btn = document.getElementById("cart-btn");
  btn?.classList.remove("cart-bump");
  void btn?.offsetWidth;
  btn?.classList.add("cart-bump");
}
function initMobileMenu() {
  const btn = document.querySelector(".hamburger");
  const menu = document.querySelector(".nav-links");
  btn?.addEventListener("click", () => {
    menu.style.display = menu.style.display === "flex" ? "none" : "flex";
  });
}
function initScrollEffects() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      // 1. Pega o href dentro do clique
      const href = a.getAttribute("href");

      // 2. Se for apenas "#" (link vazio), ignora e previne o pulo de página
      if (href === "#") {
        e.preventDefault();
        return;
      }
      try {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth" });
        }
      } catch (error) {
        // Se o seletor for inválido, ignora silenciosamente
        console.warn("Link inválido para scroll:", href);
      }
    });
  });
}
function createMenuItemCard(item) {
  const safeId = getSafeId(item.name);
  return `<div class="menu-item">
        <img src="${item.image}" alt="${
    item.name
  }" class="menu-img" loading="lazy">
        <div class="menu-info">
            <h3>${item.name}</h3><p>${item.description}</p>
            <span class="price">R$ ${item.price
              .toFixed(2)
              .replace(".", ",")}</span>
            <div class="quantity-controls">
                <button class="qty-btn" onclick="alterarQuantidade('${safeId}', -1)">-</button>
                <span id="qty-${safeId}" class="qty-display">1</span>
                <button class="qty-btn" onclick="alterarQuantidade('${safeId}', 1)">+</button>
            </div>
            <button class="btn-outline btn-add-item" data-name="${
              item.name
            }" onclick="verificarOpcoes('${
    item.id
  }', '${safeId}')">Adicionar</button>
        </div>
    </div>`;
}
function createComboCard(item) {
  const safeId = getSafeId(item.name);
  return `<div class="menu-item combo-item">
        <img src="${item.image}" alt="${
    item.name
  }" class="menu-img" loading="lazy">
        <div class="menu-info">
            <h3 class="text-gold">${item.name}</h3><p>${item.description}</p>
            <span class="price">R$ ${item.price
              .toFixed(2)
              .replace(".", ",")}</span>
            <div class="quantity-controls">
                <button class="qty-btn-combo" onclick="alterarQuantidade('${safeId}', -1)">-</button>
                <span id="qty-${safeId}" class="qty-display">1</span>
                <button class="qty-btn-combo" onclick="alterarQuantidade('${safeId}', 1)">+</button>
            </div>
            <button class="btn-primary btn-add-item" data-name="${
              item.name
            }" onclick="verificarOpcoes('${
    item.id
  }', '${safeId}')">Eu Quero!</button>
        </div>
    </div>`;
}

async function initBairrosSelect() {
  const select = document.getElementById("bairro");
  if (!select) return;

  const bairros = await fetchNeighborhoodsPublic();

  // Limpa e preenche
  select.innerHTML =
    '<option value="" disabled selected>Selecione seu Bairro...</option>';

  if (bairros.length === 0) {
    select.innerHTML +=
      '<option value="" disabled>Nenhum bairro cadastrado</option>';
  }

  bairros.forEach((b) => {
    select.innerHTML += `<option value="${b.name}" data-price="${b.price}">${b.name} </option>`;
  });

  // Evento ao mudar a opção
  select.addEventListener("change", function () {
    const option = this.options[this.selectedIndex];
    // Se não tiver preço (ex: opção padrão), assume 0
    taxaEntregaAtual = parseFloat(option.getAttribute("data-price") || 0);

    // Atualiza o texto na tela
    const display = document.getElementById("delivery-fee-display");
    if (display) {
      display.innerText = `R$ ${taxaEntregaAtual.toFixed(2).replace(".", ",")}`;
    }
  });
}

function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;

  // Elementos do Formulário
  const phoneInput = document.getElementById("phone"); // Use ID para garantir
  const retiradaCheck = document.getElementById("retirada-check");
  const addressSection = document.querySelector(".address-section");

  // 1. LÓGICA DA RETIRADA (Corrigida)
  if (retiradaCheck && addressSection) {
    // Função interna para alternar visibilidade
    // Função interna para alternar visibilidade
    const toggleAddress = () => {
      const bairroSelect = document.getElementById("bairro"); // Pega o select

      if (retiradaCheck.checked) {
        addressSection.style.display = "none"; // Esconde endereço

        // Remove obrigatoriedade dos inputs escondidos
        addressSection
          .querySelectorAll("input")
          .forEach((i) => i.removeAttribute("required"));

        // [CORREÇÃO] Remove obrigatoriedade do Select de Bairro
        if (bairroSelect) bairroSelect.removeAttribute("required");
      } else {
        addressSection.style.display = "block"; // Mostra endereço

        // Devolve a obrigatoriedade dos inputs
        addressSection.querySelectorAll("input").forEach((i) => {
          if (i.name !== "comp") i.setAttribute("required", "true");
        });

        // [CORREÇÃO] Devolve obrigatoriedade do Bairro
        if (bairroSelect) bairroSelect.setAttribute("required", "true");
      }
    };

    // Ouve o clique
    retiradaCheck.addEventListener("change", toggleAddress);

    // Roda uma vez ao carregar (caso o navegador tenha guardado o estado checked)
    toggleAddress();
  } else {
    console.warn(
      "Alerta: Checkbox de retirada ou seção de endereço não encontrados."
    );
  }

  // 2. MÁSCARA DE TELEFONE
  if (phoneInput) {
    phoneInput.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "");
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 2) v = `(${v.substring(0, 2)}) ${v.substring(2)}`;
      if (v.length > 7) v = `${v.substring(0, 10)}-${v.substring(10)}`;
      e.target.value = v;
    });
  }

  // 3. ENVIO DO FORMULÁRIO
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    //bloqueio de loja fechada

    if (!lojaAberta) {
      document.getElementById("modal-closed").style.display = "flex";
      return; // Para tudo, não envia nada
    }

    // ===> 2. [NOVO] BLOQUEIO DE LOGIN <===

    const { token } = getSession();

    if (!token) {
      // Abre o modal de autenticação
      // Supondo que você tem uma função para abrir o modal de login
      // Se não tiver, chame document.getElementById('modal-auth').style.display = 'flex';
      abrirModalLogin(
        "Para finalizar o pedido, é necessário entrar ou cadastrar-se."
      );
      return;
    }

    // Identifica qual botão clicou (Sistema ou WhatsApp)
    const btnClicado = e.submitter;
    const deveAbrirZap = btnClicado && btnClicado.id === "btn-submit-whatsapp";
    const totalProdutos = carrinho.reduce(
      (a, b) => a + b.preco * b.quantity,
      0
    );
    const totalFinal = totalProdutos + taxaEntregaAtual; // Soma o frete

    // Validação Básica
    const name = document.getElementById("name").value;
    const phone = document.getElementById("phone").value;
    const isRetirada = retiradaCheck ? retiradaCheck.checked : false;

    if (name.length < 3) return showToast("Por favor, digite seu nome.");
    if (phone.length < 14) return showToast("Digite um WhatsApp válido."); // (XX) XXXXX-XXXX tem 15 chars, min 14
    if (carrinho.length === 0) return showToast("Seu carrinho está vazio!");

    // Se NÃO for retirada, valida endereço
    if (!isRetirada) {
      const rua = document.getElementById("address").value;
      const num = document.getElementById("number").value;
      const bairro = document.getElementById("bairro").value;
      if (!rua || !num || !bairro)
        return showToast("Preencha o endereço completo para entrega.");
    }

    // Feedback Visual
    if (btnClicado) {
      btnClicado.innerText = "Enviando...";
      btnClicado.disabled = true;
    }

    // Monta os dados
    const total = carrinho.reduce((a, b) => a + b.preco * b.quantity, 0);
    const resumoTexto = carrinho
      .map((i) => `${i.quantity}x ${i.nome}`)
      .join("\n");

    // Captura Pagamento
    const paymentEl = document.querySelector(
      'input[name="paymentMethod"]:checked'
    );
    let paymentMethod = paymentEl ? paymentEl.value : "Não informado";

    // Adiciona detalhes do troco se for dinheiro
    if (paymentMethod === "cash") {
      const trocoVal = document.getElementById("troco-for")?.value;
      if (trocoVal) paymentMethod += ` (Troco para ${trocoVal})`;
    }

    const frontData = {
      name: name,
      phone: phone,
      // Se for retirada, mandamos um texto fixo para o backend não reclamar
      address: isRetirada
        ? "RETIRADA NO LOCAL"
        : document.getElementById("address").value,
      number: isRetirada ? "0" : document.getElementById("number").value,
      bairro: isRetirada ? "-" : document.getElementById("bairro").value,

      comp: isRetirada ? "" : document.getElementById("comp").value,

      message: document.getElementById("message").value,
      payment_method: paymentMethod,
      resumoCarrinho: resumoTexto,
      total: total,
      cartItems: carrinho,
      total: totalFinal, // Envia o total já com frete
      coupon_code: cupomSelecionado ? cupomSelecionado.code : null,
    };

    // Envia
    const res = await submitOrder(frontData, deveAbrirZap);

    if (btnClicado) {
      btnClicado.innerText = deveAbrirZap ? "WhatsApp" : "Fazer Pedido";
      btnClicado.disabled = false;
    }

    if (res.success) {
      /*if (res.redirectUrl) {
        showToast("Redirecionando para pagamento...", "success");

        // Aguarda 1s para o usuário ler e abre o Mercado Pago
        setTimeout(() => {
          window.location.href = res.redirectUrl;
        }, 1000);
        return; // Para aqui, não reseta o form ainda
      }*/

      if (!deveAbrirZap)
        showToast(`Pedido #${res.orderId} enviado com sucesso!`);

      carrinho = [];

      salvarCarrinhoLocal();
      atualizarCarrinhoUI();
      atualizarBotoesMenu();
      form.reset();

      // Reseta estado visual da retirada
      if (isRetirada && retiradaCheck) {
        retiradaCheck.checked = false;
        toggleAddress(); // Mostra endereço de volta
      }
    } else {
      showToast("Erro ao enviar: " + res.error);
    }
  });
}

async function initHorarioFuncionamento() {
  const statusBox = document.getElementById("status-funcionamento");
  const statusText = statusBox ? statusBox.querySelector(".status-text") : null;

  // 1. Busca horários do banco se ainda não tiver
  if (horariosGlobal.length === 0) {
    horariosGlobal = await fetchSchedule();
  }

  // Se falhar a busca, usa um fallback seguro (fechado ou horário padrão)
  if (horariosGlobal.length === 0) {
    console.warn("Não foi possível carregar horários. Usando padrão.");
    // Fallback manual se quiser, ou deixa vazio para tentar de novo
  }

  const agora = new Date();
  const diaHoje = agora.getDay(); // 0-6
  const minsAgora = agora.getHours() * 60 + agora.getMinutes();

  // 2. Encontra a regra de hoje
  const regraHoje = horariosGlobal.find((d) => d.day_of_week === diaHoje);

  let estaAberto = false;
  let texto = "Fechado";

  if (regraHoje) {
    if (regraHoje.is_closed) {
      estaAberto = false;
      texto = "Fechado hoje";
    } else {
      // Converte "18:30" para minutos (18*60 + 30 = 1110)
      const [hAbre, mAbre] = regraHoje.open_time.split(":").map(Number);
      const [hFecha, mFecha] = regraHoje.close_time.split(":").map(Number);

      const minAbre = hAbre * 60 + mAbre;
      let minFecha = hFecha * 60 + mFecha;

      // Tratamento para madrugada (ex: fecha as 01:00 do dia seguinte)
      // Se fecha menor que abre (ex: abre 18:00 fecha 01:00), somamos 24h ao fecha
      if (minFecha < minAbre) minFecha += 24 * 60;

      // Ajuste se já passou da meia noite (agora é 00:30, mas pertence ao turno de ontem)
      // Isso é complexo. Para simplificar no seu modelo "diário":
      // Vamos assumir funcionamento no mesmo dia ou até o final da noite.

      estaAberto = minsAgora >= minAbre && minsAgora < minFecha;

      texto = estaAberto
        ? `Aberto • Fecha às ${regraHoje.close_time}`
        : `Fechado • Abre às ${regraHoje.open_time}`;
    }
  }

  // Atualiza Global
  lojaAberta = estaAberto;
  // lojaAberta = true; // DEBUG: Descomente para testar aberto forçado

  // Atualiza UI
  if (statusBox && statusText) {
    statusBox.className =
      "status-box " + (lojaAberta ? "status-open" : "status-closed");
    statusText.innerText = texto;
  }

  // Re-executa a cada minuto
  setTimeout(initHorarioFuncionamento, 60000);
}
// --- MINHA CONTA ---

function openAccountModal() {
  const { user } = getSession();
  if (!user.id) return showToast("Faça login novamente.");

  // Preenche o formulário com o que temos salvo
  document.getElementById("acc-name").value = user.name || "";
  document.getElementById("acc-email").value = user.email || "";
  document.getElementById("acc-whatsapp").value = user.whatsapp || "";
  document.getElementById("acc-password").value = ""; // Senha sempre vazia por segurança

  document.getElementById("modal-account").style.display = "flex";
  toggleProfileMenu(); // Fecha o menu dropdown
}

function closeAccountModal() {
  document.getElementById("modal-account").style.display = "none";
}

async function saveAccountDetails() {
  const btn = document.querySelector("#modal-account .btn-primary");
  const originalTxt = btn.innerText;

  // Campos
  const pass = document.getElementById("acc-password").value;
  const confirm = document.getElementById("acc-password-confirm").value;

  // 1. Validação de Senha (Se o usuário tentou mudar)
  if (pass) {
    const check = validarForcaSenha(pass);
    if (!check.valid) {
      return showToast("Senha muito fraca: " + check.msg);
    }
    if (pass !== confirm) {
      return showToast("As senhas não conferem!");
    }
  }

  btn.innerText = "Salvando...";
  btn.disabled = true;

  const data = {
    name: document.getElementById("acc-name").value,
    whatsapp: document.getElementById("acc-whatsapp").value,
    // Envia senha apenas se preenchida e validada
    password: pass || undefined,
  };

  const res = await updateUserProfile(data);

  if (res.success) {
    const { token, user: oldUser } = getSession();
    const newUser = { ...oldUser, ...res.user };
    checkLoginState();

    showToast("Dados atualizados com sucesso!");

    // Limpa campos de senha para segurança
    document.getElementById("acc-password").value = "";
    document.getElementById("acc-password-confirm").value = "";
    document.getElementById("acc-strength").innerText = "";

    closeAccountModal();
  } else {
    showToast("Erro: " + res.error);
  }

  btn.innerText = originalTxt;
  btn.disabled = false;
}
function toggleMobileMenu() {
  const navLinks = document.querySelector(".nav-links");
  if (navLinks) {
    navLinks.classList.toggle("active"); // Usa classe CSS para abrir/fechar
  }
}

// Garante que ao clicar num link, o menu feche (UX Mobile)
document.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", () => {
    const navLinks = document.querySelector(".nav-links");
    if (navLinks) navLinks.classList.remove("active");
  });
});

// Adicione no final do main.js

// --- GESTÃO DE ENDEREÇOS ---

async function openAddressesModal() {
  document.getElementById("modal-addresses").style.display = "flex";
  toggleProfileMenu(); // fecha menu
  carregarListaEnderecos();
}

function closeAddressesModal() {
  document.getElementById("modal-addresses").style.display = "none";
  document.getElementById("form-new-address").style.display = "none";
}

function toggleAddAddressForm() {
  const form = document.getElementById("form-new-address");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

async function carregarListaEnderecos() {
  const container = document.getElementById("address-list-container");
  container.innerHTML = '<p style="color:#ccc">Carregando...</p>';

  const enderecos = await fetchAddresses();
  container.innerHTML = "";

  if (enderecos.length === 0) {
    container.innerHTML =
      '<p style="color:#ccc">Nenhum endereço cadastrado.</p>';
    return;
  }

  enderecos.forEach((addr) => {
    const isActive = addr.is_active;
    const cardClass = isActive ? "address-card active" : "address-card";
    const btnHtml = isActive
      ? `<span style="color:#2ecc71; font-weight:bold;"><i class="fa-solid fa-check"></i> Ativo</span>`
      : `<button class="btn-outline btn-sm" onclick="selecionarEnderecoAtivo(${addr.id})">Usar este</button>`;

    container.innerHTML += `
            <div class="${cardClass}">
                <div>
                    <strong>${addr.street}, ${addr.number}</strong><br>
                    <small>${addr.neighborhood} ${
      addr.complement ? "- " + addr.complement : ""
    }</small>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    ${btnHtml}
                    <button class="remove-btn" onclick="excluirEndereco(${
                      addr.id
                    })"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
  });

  // [MÁGICA] Atualiza o formulário de checkout com o endereço ativo
  preencherCheckoutComAtivo(enderecos);
}

function preencherCheckoutComAtivo(enderecos) {
  const ativo = enderecos.find((a) => a.is_active);
  if (ativo) {
    if (document.getElementById("address"))
      document.getElementById("address").value = ativo.street;
    if (document.getElementById("number"))
      document.getElementById("number").value = ativo.number;
    if (document.getElementById("bairro"))
      document.getElementById("bairro").value = ativo.neighborhood;
    if (document.getElementById("comp"))
      document.getElementById("comp").value = ativo.complement || "";
  }
}

async function selecionarEnderecoAtivo(id) {
  await setActiveAddress(id);
  carregarListaEnderecos(); // Recarrega para atualizar visual e checkout
}

async function excluirEndereco(id) {
  if (confirm("Remover este endereço?")) {
    await deleteAddress(id);
    carregarListaEnderecos();
  }
}

// Listener do Form de Novo Endereço
const formNewAddr = document.getElementById("form-new-address");
if (formNewAddr) {
  formNewAddr.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      street: document.getElementById("new-street").value,
      number: document.getElementById("new-number").value,
      neighborhood: document.getElementById("new-neighbor").value,
      complement: document.getElementById("new-comp").value,
    };

    const ok = await addAddress(data);
    if (ok) {
      formNewAddr.reset();
      formNewAddr.style.display = "none";
      carregarListaEnderecos();
    } else {
      showToast("Erro ao salvar endereço");
    }
  });
}
let ordersInterval = null;
// --- HISTÓRICO DE PEDIDOS ---

async function abrirHistoricoPedidos() {
  const { user } = getSession();
  if (!user.id) return showToast("Faça login para ver.", "warning");

  const modal = document.getElementById("modal-orders");
  const cont = document.getElementById("orders-list-container");

  modal.style.display = "flex";
  toggleProfileMenu();

  // Mostra loading apenas na abertura inicial
  cont.innerHTML =
    '<div class="loading-spinner" style="margin:20px auto;"></div>';

  // Função interna que busca e desenha (será chamada repetidamente)
  const atualizarLista = async () => {
    const pedidos = await fetchMyOrders();

    if (!pedidos.length) {
      cont.innerHTML =
        '<p style="text-align:center; padding:20px; color:#888;">Nenhum pedido encontrado.</p>';
      return;
    }

    // Renderiza a lista
    cont.innerHTML = pedidos
      .map((p) => {
        const date = new Date(p.date_created).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });

        return `
            <div class="order-card">
                <div class="order-header">
                    <span>#${p.id} - ${date}</span>
                    <span class="status-badge st-${getStatusClass(p.status)}">${
          p.status
        }</span>
                </div>
                <div class="order-body">
                    ${p.items
                      .map(
                        (i) =>
                          `<div class="order-item-row">
                            <span>${i.quantity}x ${i.product.name}</span>
                            <span>R$ ${i.price_at_time.toFixed(2)}</span>
                         </div>`
                      )
                      .join("")}
                </div>
                <div class="order-footer">
                    <span>Total:</span>
                    <span class="order-total">R$ ${p.total_price
                      .toFixed(2)
                      .replace(".", ",")}</span>
                </div>
            </div>`;
      })
      .join("");
  };

  // 1. Chama imediatamente para não esperar 2s na primeira vez
  await atualizarLista();

  // 2. Inicia o Loop (Polling) a cada 2 segundos
  if (ordersInterval) clearInterval(ordersInterval); // Segurança
  ordersInterval = setInterval(atualizarLista, 2000);
}

function fecharModalPedidos() {
  document.getElementById("modal-orders").style.display = "none";

  // PARAR O RELOAD QUANDO FECHAR (Importante!)
  if (ordersInterval) {
    clearInterval(ordersInterval);
    ordersInterval = null;
  }
}

function getStatusClass(st) {
  if (st === "Recebido") return "received";
  if (st === "Em Preparo") return "prep";
  if (st === "Saiu para Entrega") return "delivery";
  if (st === "Concluído") return "done";
  return "canceled";
}
function renderizarPedidos(lista) {
  const container = document.getElementById("orders-list-container");
  container.innerHTML = "";

  if (lista.length === 0) {
    container.innerHTML = `
            <div style="text-align:center; padding:30px; color:#888;">
                <i class="fa-solid fa-burger" style="font-size:3rem; margin-bottom:10px;"></i>
                <p>Você ainda não fez nenhum pedido.</p>
                <button class="btn-outline mt-3" onclick="fecharModalPedidos()">Ver Cardápio</button>
            </div>`;
    return;
  }

  lista.forEach((pedido) => {
    const dataFormatada = new Date(pedido.date_created).toLocaleDateString(
      "pt-BR",
      {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }
    );

    // Traduz status para classe CSS (cor) e Ícone
    const statusConfig = getStatusConfig(pedido.status);

    // Monta resumo dos itens (Ex: 2x X-Burger, 1x Coca)
    const resumoItens = pedido.items
      .map(
        (i) =>
          `<div class="order-item-row">
                <span>${i.quantity}x ${i.product.name}</span>
                <span style="color:#aaa;">R$ ${i.price_at_time.toFixed(
                  2
                )}</span>
             </div>`
      )
      .join("");

    const html = `
            <div class="order-card">
                <div class="order-header">
                    <div>
                        <span class="order-id">Pedido #${pedido.id}</span>
                        <span class="order-date">${dataFormatada}</span>
                    </div>
                    <span class="status-badge ${statusConfig.css}">
                        ${statusConfig.icon} ${pedido.status}
                    </span>
                </div>
                
                <div class="order-body">
                    ${resumoItens}
                </div>

                <div class="order-footer">
                    <span>Total:</span>
                    <span class="order-total">R$ ${pedido.total_price
                      .toFixed(2)
                      .replace(".", ",")}</span>
                </div>
            </div>
        `;
    container.innerHTML += html;
  });
}

function getStatusConfig(status) {
  switch (status) {
    case "Recebido":
      return {
        css: "st-received",
        icon: '<i class="fa-regular fa-clock"></i>',
      };
    case "Em Preparo":
      return {
        css: "st-prep",
        icon: '<i class="fa-solid fa-fire-burner"></i>',
      };
    case "Saiu para Entrega":
      return {
        css: "st-delivery",
        icon: '<i class="fa-solid fa-motorcycle"></i>',
      };
    case "Concluído":
      return { css: "st-done", icon: '<i class="fa-solid fa-check"></i>' };
    case "Cancelado":
      return {
        css: "st-canceled",
        icon: '<i class="fa-solid fa-xmark"></i>',
      };
    default:
      return { css: "", icon: "" };
  }
}

// --- FUNÇÃO DE VALIDAÇÃO DE SENHA ---
function validarForcaSenha(senha) {
  const minLength = 8;
  const hasUpper = /[A-Z]/.test(senha);
  const hasLower = /[a-z]/.test(senha);
  const hasNumber = /[0-9]/.test(senha);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(senha);

  if (senha.length < minLength)
    return { valid: false, msg: "Mínimo 8 caracteres" };
  if (!hasUpper) return { valid: false, msg: "Precisa de letra maiúscula" };
  if (!hasLower) return { valid: false, msg: "Precisa de letra minúscula" };
  if (!hasNumber) return { valid: false, msg: "Precisa de um número" };
  if (!hasSpecial)
    return { valid: false, msg: "Precisa de caractere especial (!@#...)" };

  return { valid: true, msg: "Senha Forte 💪" };
}

function mostrarForcaSenha(valor, elementoId) {
  const el = document.getElementById(elementoId);
  if (!valor) {
    el.innerText = "";
    el.className = "password-strength";
    return;
  }

  const resultado = validarForcaSenha(valor);
  el.innerText = resultado.msg;

  if (resultado.valid) {
    el.className = "password-strength strength-strong";
  } else {
    // Se tiver pelo menos 6 chars, amarela, senão vermelha
    el.className =
      valor.length > 5
        ? "password-strength strength-medium"
        : "password-strength strength-weak";
  }
}

let chatInterval = null;
let chatAberto = false;
let ultimoEnvio = 0;
const COOLDOWN_CHAT = 2000;

function toggleChat() {
  const widget = document.getElementById("chat-widget");
  const icon = document.getElementById("chat-icon");
  const { user } = getSession();

  if (!user.id) return showToast("Faça login para usar o chat.");

  chatAberto = !chatAberto; // Inverte estado

  if (chatAberto) {
    widget.classList.remove("minimized");
    icon.classList.remove("fa-chevron-up");
    icon.classList.add("fa-chevron-down");

    carregarMensagens(); // Carrega na hora
    // Inicia Polling (atualiza a cada 3s)
    if (!chatInterval) chatInterval = setInterval(carregarMensagens, 3000);
  } else {
    widget.classList.add("minimized");
    icon.classList.remove("fa-chevron-down");
    icon.classList.add("fa-chevron-up");

    // Para o Polling para economizar bateria/dados
    if (chatInterval) {
      clearInterval(chatInterval);
      chatInterval = null;
    }
  }
}

async function carregarMensagens() {
  if (!chatAberto) return;

  const msgs = await getChatMessages();
  const container = document.getElementById("chat-messages-area");

  // Limpa e remonta (Simples, mas funciona. Ideal seria adicionar só novas)
  container.innerHTML = '<p class="chat-welcome">Histórico de Conversa</p>';

  msgs.forEach((msg) => {
    const classe = msg.is_from_admin ? "msg-admin" : "msg-user";
    // Opcional: Formatar hora msg.timestamp

    const div = document.createElement("div");
    div.className = `msg ${classe}`;
    div.innerText = msg.message;
    container.appendChild(div);
  });

  // Scroll para o final (mensagem mais recente)
  // container.scrollTop = container.scrollHeight;
}

async function enviarMensagemChat() {
  const input = document.getElementById("chat-input");
  const texto = input.value.trim();

  if (!texto) return;

  if (texto.length > 800) {
    showToast("Sua mensagem é muito longa. Por favor, seja mais breve.");
  }
  const agora = Date.now();
  if (agora - ultimoEnvio < COOLDOWN_CHAT) {
    const segundosRestantes = Math.ceil(
      (COOLDOWN_CHAT - (agora - ultimoEnvio)) / 1000
    );

    return;
  }
  // Envia para o backend
  const sucesso = await sendChatMessage(texto);

  if (sucesso) {
    input.value = "";
    carregarMensagens(); // Atualiza a tela imediatamente Atualiza o tempo do último envio Atualiza o tempo do último envio
    ultimoEnvio = Date.now();
  } else {
    showToast("Erro ao enviar mensagem.");
  }
}

function handleChatKey(e) {
  if (e.key === "Enter") enviarMensagemChat();
}

function toggleTroco(radio) {
  const box = document.getElementById("troco-box");
  if (box) {
    box.style.display =
      radio.checked && radio.value === "cash" ? "block" : "none";
  }
}

// Listener para fechar o troco se clicar em outro meio
document.querySelectorAll('input[name="paymentMethod"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    const box = document.getElementById("troco-box");
    if (e.target.value !== "cash" && box) box.style.display = "none";
  });
});

// --- LÓGICA DE CUPONS ---

async function initCoupons() {
  cuponsDisponiveis = await fetchPublicCoupons();
  renderizarCupons();
}

function renderizarCupons() {
  const container = document.getElementById("coupons-container");
  if (!container) return;

  if (cuponsDisponiveis.length === 0) {
    container.innerHTML =
      '<p style="color:#666; font-size:0.9rem;">Nenhum cupom disponível no momento.</p>';
    return;
  }

  // Calcula total atual do carrinho
  const totalCarrinho = carrinho.reduce(
    (acc, item) => acc + item.preco * item.quantity,
    0
  );

  container.innerHTML = cuponsDisponiveis
    .map((c) => {
      let isMinimoAtingido = totalCarrinho >= c.min_purchase;
      const disabledClass = isMinimoAtingido ? "" : "disabled";
      const titleAttr = isMinimoAtingido
        ? ""
        : `Mínimo de R$ ${c.min_purchase.toFixed(2)}`;

      // Texto do desconto
      const descTexto =
        c.discount_percent > 0
          ? `${c.discount_percent}% OFF`
          : `R$ ${c.discount_fixed.toFixed(2)} OFF`;

      return `
            <label class="coupon-wrapper" title="${titleAttr}">
                <input type="radio" name="selectedCoupon" value="${c.code}" 
                    class="coupon-option" 
                    ${!isMinimoAtingido ? "disabled" : ""}
                    onchange="selecionarCupom('${c.code}')">
                
                <div class="coupon-card-ui ${disabledClass}">
                    <span class="cp-code">${c.code}</span>
                    <span class="cp-desc">${descTexto}</span>
                    ${
                      c.min_purchase > 0
                        ? `<span class="cp-min">Mín. R$ ${c.min_purchase.toFixed(
                            2
                          )}</span>`
                        : ""
                    }
                </div>
            </label>
        `;
    })
    .join("");
}

// Torna global para o HTML acessar
window.selecionarCupom = function (code) {
  const cupom = cuponsDisponiveis.find((c) => c.code === code);
  const totalCarrinho = carrinho.reduce(
    (acc, item) => acc + item.preco * item.quantity,
    0
  );

  if (!cupom) return;

  // Validação Frontend (Dupla checagem)
  if (totalCarrinho < cupom.min_purchase) {
    showToast(
      `Valor mínimo para este cupom: R$ ${cupom.min_purchase.toFixed(2)}`,
      "warning"
    );
    // Desmarca
    document.querySelector(`input[value="${code}"]`).checked = false;
    cupomSelecionado = null;
    atualizarVisualDesconto();
    return;
  }

  cupomSelecionado = cupom;
  atualizarVisualDesconto();
  showToast(`Cupom ${code} aplicado!`, "success");
};

function atualizarVisualDesconto() {
  const display = document.getElementById("discount-display");
  const valSpan = document.getElementById("discount-value");

  if (!cupomSelecionado) {
    display.style.display = "none";
    return;
  }

  const totalCarrinho = carrinho.reduce(
    (acc, item) => acc + item.preco * item.quantity,
    0
  );
  let desconto = 0;

  if (cupomSelecionado.discount_percent > 0) {
    desconto = totalCarrinho * (cupomSelecionado.discount_percent / 100);
  } else {
    desconto = cupomSelecionado.discount_fixed;
  }

  // Garante que não desconte mais que o total
  if (desconto > totalCarrinho) desconto = totalCarrinho;

  valSpan.innerText = `- R$ ${desconto.toFixed(2).replace(".", ",")}`;
  display.style.display = "block";
}
// =========================================
//  SISTEMA DE PERSISTÊNCIA (MEMÓRIA)
// =========================================

// 1. Salva o carrinho atual no navegador
function salvarCarrinhoLocal() {
  console.log("💾 Salvando carrinho...", carrinho);
  localStorage.setItem("cegonha_cart", JSON.stringify(carrinho));
}

// 2. Recupera o carrinho quando o site abre
function carregarCarrinhoLocal() {
  const salvo = localStorage.getItem("cegonha_cart");
  if (salvo) {
    carrinho = JSON.parse(salvo);
    console.log("📂 Carrinho recuperado:", carrinho);

    // Atualiza o visual (totais, bolinhas vermelhas, lista lateral)
    atualizarCarrinhoUI();
    atualizarBotoesMenu();
  }
}

window.pedirMagicLink = pedirMagicLink;

// Alterna entre "Magic Link" e "Senha" dentro da aba de Login
function toggleLoginMode(mode) {
  const magicForm = document.getElementById("form-magic-login");
  const passForm = document.getElementById("form-password-login");

  if (mode === "password") {
    magicForm.style.display = "none";
    passForm.style.display = "block";

    // Auto-foco no campo de email se estiver vazio
    const emailMagic = document.getElementById("magic-email").value;
    const emailPass = document.getElementById("login-email");
    if (emailMagic) emailPass.value = emailMagic; // Copia o email digitado
  } else {
    magicForm.style.display = "block";
    passForm.style.display = "none";
  }
}

// ...
// Lembre de exportar a função para o HTML usar:
window.toggleLoginMode = toggleLoginMode;
