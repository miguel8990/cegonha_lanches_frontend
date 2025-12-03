import {
  fetchAdminMenu,
  fetchMenu,
  toggleAvailability,
  fetchAdminOrders,
  updateOrderStatus,
  fetchAdminConversations,
  fetchAdminUserHistory,
  sendAdminReply,
  uploadImage,
  createProduct,
  updateProduct,
  deleteProduct,
} from "./api.js";

let chatUserIdAtivo = null;
let chatInterval = null;

// 1. INICIALIZAÇÃO
document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  if (!user.role || (user.role !== "admin" && user.role !== "super_admin")) {
    alert("Acesso negado.");
    window.location.href = "index.html";
    return;
  }

  carregarPedidosAdmin();
  carregarMenuAdmin();

  // Exports globais para o HTML usar
  window.openProductModal = openProductModal;
  window.closeProductModal = closeProductModal;
  window.addDetailRow = addDetailRow;
  window.removeDetailRow = removeDetailRow;

  setInterval(carregarPedidosAdmin, 15000);
  setInterval(() => {
    if (document.getElementById("panel-orders").classList.contains("active"))
      carregarPedidosAdmin();
    if (document.getElementById("panel-chat").classList.contains("active")) {
      carregarListaConversas();
      if (chatUserIdAtivo) carregarChatAtivo(chatUserIdAtivo);
    }
  }, 5000);
});

// ... (Funções switchPanel, adminLogout, carregarPedidosAdmin, renderOrderCard, mudarStatus mantidas iguais) ...
// VOU COLOCAR APENAS AS FUNÇÕES QUE MUDARAM ABAIXO PARA ECONOMIZAR ESPAÇO
// MAS NO SEU ARQUIVO, MANTENHA AS FUNÇÕES DE PEDIDOS E CHAT.

window.switchPanel = function (panelId) {
  document
    .querySelectorAll(".panel-section")
    .forEach((el) => el.classList.remove("active"));
  document.getElementById(`panel-${panelId}`).classList.add("active");
  document
    .querySelectorAll(".sidebar-menu button")
    .forEach((btn) => btn.classList.remove("active"));
  event.currentTarget.classList.add("active");
};

window.adminLogout = function () {
  // Adiciona confirmação simples do navegador
  if (confirm("Tem certeza que deseja sair do Painel Administrativo?")) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "index.html";
  }
};

window.carregarPedidosAdmin = async function () {
  const container = document.getElementById("admin-orders-list");
  const btn = document.querySelector("#panel-orders .btn-outline");
  if (btn) btn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> ...';

  const pedidos = await fetchAdminOrders();
  container.innerHTML = pedidos.length
    ? pedidos.map((p) => renderOrderCard(p)).join("")
    : "<p>Nenhum pedido.</p>";
  if (btn) btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Atualizar';
};

// ... (renderOrderCard e mudarStatus continuam iguais, se precisar repito) ...
function renderOrderCard(p) {
  const time = new Date(p.date_created).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  let botoes = "";
  if (p.status === "Recebido")
    botoes = `<button class="btn-small btn-next" onclick="mudarStatus(${p.id}, 'Em Preparo')">Aceitar 🔥</button>`;
  else if (p.status === "Em Preparo")
    botoes = `<button class="btn-small btn-next" onclick="mudarStatus(${p.id}, 'Saiu para Entrega')">Enviar 🛵</button>`;
  else if (p.status === "Saiu para Entrega")
    botoes = `<button class="btn-small btn-next" onclick="mudarStatus(${p.id}, 'Concluído')">Concluir ✅</button>`;
  if (p.status !== "Concluído" && p.status !== "Cancelado")
    botoes += ` <button class="btn-small btn-cancel" onclick="mudarStatus(${p.id}, 'Cancelado')">Cancelar ❌</button>`;

  return `<div class="admin-order-card status-${p.status.replace(/ /g, ".")}">
        <div class="card-header"><span class="card-user">#${p.id} - ${
    p.customer_name || "Cli"
  }</span><span class="card-time">${time}</span></div>
        <div class="card-items">${p.items
          .map(
            (i) =>
              `<div><strong>${i.quantity}x ${i.product.name}</strong></div>`
          )
          .join("")}</div>
        <div style="font-size:0.85rem; margin:10px 0;">📍 ${p.street}, ${
    p.number
  }<br>💳 <strong>${
    p.payment_method
  }</strong><br><span style="color:gold">R$ ${p.total_price.toFixed(
    2
  )}</span></div>
        <div class="card-actions">${botoes}</div><div style="text-align:right; font-size:0.8rem; color:#666; margin-top:5px;">${
    p.status
  }</div>
    </div>`;
}

window.mudarStatus = async function (id, novo) {
  if (confirm(`Mudar para ${novo}?`)) {
    await updateOrderStatus(id, novo);
    carregarPedidosAdmin();
  }
};

// --- GESTÃO DE CARDÁPIO ---
window.carregarMenuAdmin = async function () {
  const tbody = document.getElementById("admin-menu-list");
  const produtos = await fetchAdminMenu();
  if (produtos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">Vazio</td></tr>';
    return;
  }
  tbody.innerHTML = produtos
    .map(
      (p) => `
        <tr>
            <td>${p.name}</td><td>R$ ${p.price.toFixed(2)}</td>
            <td style="text-align:center;"><i class="toggle-switch fa-solid ${
              p.is_available ? "fa-toggle-on on" : "fa-toggle-off off"
            }" onclick="toggleProd(${
        p.id
      })" style="font-size:1.5rem; cursor:pointer;"></i></td>
            <td><button class="btn-small"><i class="fa-solid fa-pen"></i></button></td>
        </tr>`
    )
    .join("");
};

window.toggleProd = async function (id) {
  await toggleAvailability(id);
  carregarMenuAdmin();
};

// --- FUNÇÕES GLOBAIS DE CHAT (MANTIDAS) ---
window.carregarListaConversas = async function () {
  const lista = await fetchAdminConversations();
  document.getElementById("chat-users-list").innerHTML = lista
    .map(
      (u) => `
        <div class="chat-user-item ${
          chatUserIdAtivo === u.user_id ? "active" : ""
        }" onclick="selecionarChat(${u.user_id}, '${u.user_name}')">
            <div class="user-avatar-small">${u.user_name[0]}</div>
            <div style="flex:1"><div>${
              u.user_name
            }</div><small style="color:#888">${new Date(u.last_interaction)
        .toLocaleTimeString()
        .slice(0, 5)}</small></div>
        </div>`
    )
    .join("");
};
window.selecionarChat = function (id, nome) {
  chatUserIdAtivo = id;
  document.getElementById("admin-chat-input-area").style.display = "flex";
  carregarChatAtivo(id);
  carregarListaConversas();
};
async function carregarChatAtivo(uid) {
  const msgs = await fetchAdminUserHistory(uid);
  document.getElementById("admin-chat-messages").innerHTML = msgs
    .map(
      (m) =>
        `<div class="msg ${m.is_from_admin ? "msg-admin" : "msg-user"}">${
          m.message
        }</div>`
    )
    .join("");
}
window.enviarRespostaAdmin = async function () {
  const inp = document.getElementById("admin-chat-input");
  if (!inp.value.trim() || !chatUserIdAtivo) return;
  if (await sendAdminReply(chatUserIdAtivo, inp.value.trim())) {
    inp.value = "";
    carregarChatAtivo(chatUserIdAtivo);
  }
};
window.handleAdminChatKey = function (e) {
  if (e.key === "Enter") enviarRespostaAdmin();
};

// ========================================================
// GESTÃO DE PRODUTOS (CRIAR, EDITAR, EXCLUIR)
// ========================================================

let produtoEmEdicaoId = null; // Controla se é edição ou novo

// Abre modal para CRIAR
function openProductModal() {
  produtoEmEdicaoId = null; // Modo Criação

  // Reset Visual
  document.getElementById("modal-product-admin").style.display = "flex";
  document.getElementById("form-add-product").reset();
  document.querySelector("#modal-product-admin h3").innerText = "Novo Produto";
  document.querySelector('#form-add-product button[type="submit"]').innerText =
    "Cadastrar Produto";

  // Reset Imagem
  document.getElementById("preview-img").style.display = "none";
  document.getElementById("preview-icon").style.display = "block";
  document.getElementById("prod-image-url").value = "";

  // Reset Detalhes (Cria 3 linhas vazias)
  const container = document.getElementById("details-container");
  container.innerHTML = "";
  addDetailRow();
  addDetailRow();
}

// Abre modal para EDITAR
window.editarProduto = function (id) {
  const produtos = document.querySelectorAll("#admin-menu-list tr");
  // O jeito ideal seria buscar do array global ou da API,
  // mas para simplificar vamos buscar o produto pelo ID na API novamente ou usar cache.
  // Vamos fazer um fetch rápido específico ou usar o cache do carregarMenuAdmin.

  fetchAdminMenu().then((lista) => {
    const produto = lista.find((p) => p.id === id);
    if (!produto) return;

    produtoEmEdicaoId = id; // Modo Edição

    // Preenche Campos
    document.getElementById("modal-product-admin").style.display = "flex";
    document.querySelector("#modal-product-admin h3").innerText =
      "Editar Produto";
    document.querySelector(
      '#form-add-product button[type="submit"]'
    ).innerText = "Salvar Alterações";

    document.getElementById("prod-name").value = produto.name;
    document.getElementById("prod-price").value = produto.price;
    document.getElementById("prod-category").value =
      produto.category || "Lanche";
    document.getElementById("prod-desc").value = produto.description || "";
    document.getElementById("prod-image-url").value = produto.image_url || "";

    // Preview Imagem
    if (produto.image_url) {
      const img = document.getElementById("preview-img");
      img.src = produto.image_url;
      img.style.display = "block";
      document.getElementById("preview-icon").style.display = "none";
    } else {
      document.getElementById("preview-img").style.display = "none";
      document.getElementById("preview-icon").style.display = "block";
    }

    // Preenche Detalhes
    const container = document.getElementById("details-container");
    container.innerHTML = "";

    let details = {};
    try {
      details =
        typeof produto.details_json === "string"
          ? JSON.parse(produto.details_json)
          : produto.details || {};
    } catch (e) {}

    // Reconstrói as linhas baseadas no JSON
    let temDetalhes = false;
    ["carnes", "adicionais", "acompanhamentos", "bebidas"].forEach((key) => {
      if (details[key] && details[key].length > 0) {
        details[key].forEach((item) => {
          // Formata "Nome - Preço"
          const val =
            item.price > 0 ? `${item.nome} - ${item.price}` : item.nome;
          addDetailRow(key, val);
          temDetalhes = true;
        });
      }
    });

    // Se não tiver nada, adiciona uma linha vazia
    if (!temDetalhes) addDetailRow();
  });
};

function closeProductModal() {
  document.getElementById("modal-product-admin").style.display = "none";
}

// Adiciona linha visual (agora aceita valores pré-preenchidos)
function addDetailRow(key = "adicionais", value = "") {
  const container = document.getElementById("details-container");
  const div = document.createElement("div");
  div.style.display = "flex";
  div.style.gap = "5px";

  // Seleciona a opção correta no select
  const selAdicionais = key === "adicionais" ? "selected" : "";
  const selAcomp = key === "acompanhamentos" ? "selected" : "";
  const selBebida = key === "bebidas" ? "selected" : "";
  const selCarne = key === "carnes" ? "selected" : "";

  div.innerHTML = `
        <select class="detail-key" style="background:#111; color:white; border:1px solid #444; border-radius:4px; padding:5px;">
            <option value="adicionais" ${selAdicionais}>Adicional</option>
            <option value="acompanhamentos" ${selAcomp}>Acomp.</option>
            <option value="bebidas" ${selBebida}>Bebida</option>
            <option value="carnes" ${selCarne}>Carne</option>
        </select>
        <input type="text" class="detail-val" value="${value}" placeholder="Ex: Bacon - 3.00" style="flex:1; background:#111; color:white; border:1px solid #444; border-radius:4px; padding:5px;">
        <button type="button" onclick="removeDetailRow(this)" style="background:#333; color:#e74c3c; border:none; cursor:pointer; padding:0 10px;">&times;</button>
    `;
  container.appendChild(div);
}

window.removeDetailRow = function (btn) {
  // Exportado para o HTML ver
  btn.parentElement.remove();
};

// --- SEGURANÇA DE DELEÇÃO ---
// --- SEGURANÇA DE DELEÇÃO ---
let idParaDeletar = null;

// Removemos a const SENHA_MESTRA daqui. O segredo agora está seguro no Backend!

window.deletarProduto = function (id) {
  idParaDeletar = id;
  const modal = document.getElementById("modal-security");
  const input = document.getElementById("security-pass");

  input.value = "";
  modal.style.display = "flex";
  setTimeout(() => input.focus(), 100);
};

window.closeSecurityModal = function () {
  document.getElementById("modal-security").style.display = "none";
  idParaDeletar = null;
};

window.executarDelecao = async function () {
  const input = document.getElementById("security-pass");
  const btn = document.querySelector("#modal-security .btn-primary");
  const senhaDigitada = input.value;

  if (!senhaDigitada) {
    return alert("Por favor, digite a senha.");
  }

  if (!idParaDeletar) return;

  const originalTxt = btn.innerHTML;
  btn.innerHTML = "Verificando...";
  btn.disabled = true;

  // Envia o ID e a Senha Digitada para o Backend decidir
  const result = await deleteProduct(idParaDeletar, senhaDigitada);

  // Se result for true (sucesso)
  if (result === true) {
    alert("Produto excluído com sucesso!");
    closeSecurityModal();
    carregarMenuAdmin();
  } else {
    // Se der erro (ex: Senha incorreta vindo do python)
    alert(result.error || "Erro ao excluir.");
    input.value = "";
    input.focus();
  }

  btn.innerHTML = originalTxt;
  btn.disabled = false;
};

document.getElementById("security-pass")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") executarDelecao();
});
// SALVAR (CRIAR OU EDITAR)
const formProd = document.getElementById("form-add-product");
if (formProd) {
  formProd.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = formProd.querySelector('button[type="submit"]');
    const originalTxt = btn.innerText;
    btn.innerText = "Salvando...";
    btn.disabled = true;

    try {
      const nome = document.getElementById("prod-name").value;
      const preco = parseFloat(document.getElementById("prod-price").value);
      const cat = document.getElementById("prod-category").value;
      const desc = document.getElementById("prod-desc").value;
      const imgUrl = document.getElementById("prod-image-url").value;

      // Monta JSON de detalhes
      const details = {
        carnes: [],
        adicionais: [],
        acompanhamentos: [],
        bebidas: [],
      };
      const rows = document.querySelectorAll("#details-container > div");

      rows.forEach((row) => {
        const key = row.querySelector(".detail-key").value;
        const val = row.querySelector(".detail-val").value.trim();

        if (val) {
          let nomeItem = val;
          let precoItem = 0.0;
          if (val.includes("-")) {
            const partes = val.split("-");
            nomeItem = partes[0].trim();
            const precoString = partes[1].replace(",", ".").trim();
            precoItem = parseFloat(precoString) || 0;
          }
          details[key].push({ nome: nomeItem, price: precoItem });
        }
      });

      const data = {
        name: nome,
        price: preco,
        category: cat,
        description: desc,
        image_url: imgUrl,
        details: details,
      };

      let ok = false;
      if (produtoEmEdicaoId) {
        // MODO EDIÇÃO
        ok = await updateProduct(produtoEmEdicaoId, data);
      } else {
        // MODO CRIAÇÃO
        ok = await createProduct(data);
      }

      if (ok) {
        alert(produtoEmEdicaoId ? "Produto atualizado!" : "Produto criado!");
        closeProductModal();
        carregarMenuAdmin();
      } else {
        throw new Error("Erro no servidor.");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar: " + error.message);
    } finally {
      btn.innerText = originalTxt;
      btn.disabled = false;
    }
  });
}

// Renderização da Tabela (Atualizado com botões corretos)
window.carregarMenuAdmin = async function () {
  const tbody = document.getElementById("admin-menu-list");
  const produtos = await fetchAdminMenu(); // Certifique-se de importar isso

  if (produtos.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4">Nenhum produto cadastrado.</td></tr>';
    return;
  }

  tbody.innerHTML = produtos
    .map(
      (p) => `
        <tr>
            <td>${p.name}</td>
            <td>R$ ${p.price.toFixed(2)}</td>
            <td style="text-align:center;">
                <i class="toggle-switch fa-solid ${
                  p.is_available ? "fa-toggle-on on" : "fa-toggle-off off"
                }" 
                   onclick="toggleProd(${p.id})"
                   style="font-size:1.5rem; cursor:pointer;">
                </i>
            </td>
            <td>
                <div style="display:flex; gap:5px; justify-content:center;">
                    <button class="btn-small" style="background:#3498db; color:white; border:none;" onclick="editarProduto(${
                      p.id
                    })" title="Editar">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-small" style="background:#e74c3c; color:white; border:none;" onclick="deletarProduto(${
                      p.id
                    })" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `
    )
    .join("");
};

// ... (Upload de Imagem e ToggleProd continuam iguais) ...
// Upload Imagem
const fileInput = document.getElementById("prod-file");
if (fileInput) {
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const lbl = document.querySelector('label[for="prod-file"]');
    lbl.innerText = "Enviando...";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = document.getElementById("preview-img");
      img.src = ev.target.result;
      img.style.display = "block";
      document.getElementById("preview-icon").style.display = "none";
    };
    reader.readAsDataURL(file);
    const url = await uploadImage(file);
    if (url) {
      document.getElementById("prod-image-url").value = url;
      lbl.innerText = "Foto OK ✅";
      lbl.style.color = "#2ecc71";
    } else {
      alert("Falha no upload.");
      lbl.innerText = "Tentar de novo";
    }
  });
}
