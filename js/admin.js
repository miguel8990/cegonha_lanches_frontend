// site/js/admin.js
import {
  fetchAdminMenu,
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
  fetchCoupons,
  createCoupon,
  deleteCoupon,
  fetchUsersList,
  fetchCloudGallery,
  deleteCloudImage,
  fetchNeighborhoodsAdmin,
  addNeighborhood,
  deleteNeighborhood,
  fetchSchedule,
  updateSchedule,
  fetchDashboardStats,
  fetchOrderDossier,
} from "./api.js";
import { getSession, clearSession } from "./auth.js";
// --- Variáveis de Estado ---
let chatUserIdAtivo = null;
let chatInterval = null;
let produtoEmEdicaoId = null; // null = criando, número = editando
let idParaDeletar = null; // Para o modal de segurança
let pedidosDoDia = [];
let chartInstance = null;

// --- 1. Inicialização ---
document.addEventListener("DOMContentLoaded", () => {
  // Verifica se é admin
  const { user } = getSession();
  if (!user.role || (user.role !== "admin" && user.role !== "super_admin")) {
    alert("Acesso negado.");
    window.location.href = "index.html";
    return;
  }

  // Carrega dados iniciais
  carregarPedidosAdmin();
  carregarMenuAdmin();
  carregarCozinha();

  // Inicia Polling (atualização automática)
  setInterval(() => {
    // Só atualiza se a aba Cozinha estiver visível
    if (document.getElementById("panel-kitchen").classList.contains("active")) {
      carregarCozinha();
    }
  }, 10000);
  setInterval(() => {
    // Chat atualiza apenas se a aba estiver aberta
    if (document.getElementById("panel-chat").classList.contains("active")) {
      carregarListaConversas();
      if (chatUserIdAtivo) carregarChatAtivo(chatUserIdAtivo);
    }
  }, 5000);
});

// =============================================================================
//  GESTÃO DE PAINÉIS E NAVEGAÇÃO
// =============================================================================

window.switchPanel = function (panelId) {
  // Esconde todas as seções
  document
    .querySelectorAll(".panel-section")
    .forEach((el) => el.classList.remove("active"));
  // Mostra a desejada
  document.getElementById(`panel-${panelId}`).classList.add("active");
  if (panelId === "kitchen") carregarCozinha();
  if (panelId === "delivery") carregarBairrosAdmin();
  // Atualiza menu lateral
  document
    .querySelectorAll(".sidebar-menu button")
    .forEach((btn) => btn.classList.remove("active"));
  event.currentTarget.classList.add("active");
};

window.adminLogout = function () {
  if (confirm("Tem certeza que deseja sair do Painel Administrativo?")) {
    clearSession();
    window.location.href = "index.html";
  }
};

// =============================================================================
//  ABA 1: PEDIDOS
// =============================================================================
// --- COZINHA (KDS) ---

window.carregarCozinha = async function () {
  // Busca todos os pedidos
  const pedidos = await fetchAdminOrders();
  pedidosDoDia = pedidos;
  // Filtra para as 3 colunas
  const espera = pedidos.filter((p) => p.status === "Recebido");
  const preparo = pedidos.filter((p) => p.status === "Em Preparo");
  const entrega = pedidos.filter((p) => p.status === "Saiu para Entrega"); // [NOVO]

  // Renderiza
  renderizarFila("queue-waiting", espera, "espera");
  renderizarFila("queue-prep", preparo, "preparo");
  renderizarFila("queue-delivery", entrega, "entrega"); // [NOVO]
};

function renderizarFila(elementId, lista, tipo) {
  const container = document.getElementById(elementId);

  if (lista.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:#666; margin-top:20px; font-size:0.9rem;">Vazio</p>`;
    return;
  }

  container.innerHTML = lista
    .map((p) => {
      const hora = new Date(p.date_created).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const classeAlerta = tipo === "espera" ? "card-alert" : "";

      // Botões de Ação Dinâmicos
      let btnAcao = "";

      if (tipo === "espera") {
        // Botão ACEITAR -> Vai para Preparo
        btnAcao = `<button class="btn-primary full-width" onclick="moverParaPreparo(${p.id})">ACEITAR <i class="fa-solid fa-arrow-right"></i></button>`;
      } else if (tipo === "preparo") {
        // Botão ENTREGA -> Vai para Entrega
        btnAcao = `<button class="btn-primary full-width" style="background:#3498db; border-color:#3498db;" onclick="moverParaEntrega(${p.id})">SAIR P/ ENTREGA <i class="fa-solid fa-motorcycle"></i></button>`;
      } else if (tipo === "entrega") {
        // [NOVO] Botão CONCLUIR -> Finaliza e remove da tela
        btnAcao = `<button class="btn-primary full-width" style="background:#2ecc71; border-color:#2ecc71;" onclick="concluirPedidoDefinitivo(${p.id})">ENTREGUE ✅</button>`;
      }

      // Renderiza itens (comprimido para ocupar menos espaço)
      const itensHtml = p.items
        .map((i) => {
          let obsHtml = "";
          if (i.customizations_json) {
            try {
              const c = JSON.parse(i.customizations_json);
              if (c.obs)
                obsHtml = `<div class="k-obs" style="display:inline; margin-left:5px;">⚠️ ${c.obs}</div>`;
            } catch (e) {}
          }
          return `<div class="k-item"><strong>${i.quantity}x ${i.product.name}</strong>${obsHtml}</div>`;
        })
        .join("");

      return `
            <div class="kitchen-card ${classeAlerta}">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #444; padding-bottom:5px;">
                    <span style="font-size:1rem; font-weight:bold;">#${
                      p.id
                    } - ${p.customer_name.split(" ")[0]}</span>
                    <span style="color:#aaa; font-size:0.9rem;">${hora}</span>
                </div>
                
                <div style="margin-bottom:10px; max-height:150px; overflow-y:auto;">${itensHtml}</div>
                
                ${
                  tipo === "entrega"
                    ? `<div style="font-size:0.8rem; color:#ccc; margin-bottom:10px; background:#222; padding:5px; border-radius:4px;">📍 ${p.neighborhood}</div>`
                    : ""
                }

                <div style="display:flex; gap:5px;">
                    ${btnAcao}
                    <button class="btn-small btn-cancel" onclick="imprimirComanda(${
                      p.id
                    })" title="Imprimir"><i class="fa-solid fa-print"></i></button>
                </div>
            </div>
        `;
    })
    .join("");
}

// --- Ações de Mudança de Status ---

window.moverParaPreparo = async function (id) {
  await updateOrderStatus(id, "Em Preparo");
  carregarCozinha();
};

window.moverParaEntrega = async function (id) {
  // Não pede confirmação para ser rápido
  await updateOrderStatus(id, "Saiu para Entrega");
  carregarCozinha();
};

window.concluirPedidoDefinitivo = async function (id) {
  if (confirm("Confirmar que o pedido foi entregue e pago?")) {
    await updateOrderStatus(id, "Concluído");
    carregarCozinha(); // O pedido sairá da coluna 'Em Entrega' e irá para o Histórico
  }
};
window.carregarPedidosAdmin = async function () {
  const container = document.getElementById("admin-orders-list");
  const btn = document.querySelector("#panel-orders .btn-outline");

  // Feedback visual
  if (btn) btn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> ...';

  // Busca da API
  const pedidos = await fetchAdminOrders();

  // [NOVO] Salva na memória global para a impressão usar
  pedidosDoDia = pedidos;

  container.innerHTML = pedidos.length
    ? pedidos.map((p) => renderOrderCard(p)).join("")
    : "<p>Nenhum pedido hoje.</p>";

  if (btn) btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Atualizar';
};

function renderOrderCard(p) {
  const time = new Date(p.date_created).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Botões de Status
  let botoes = "";

  if (p.status !== "Concluído" && p.status !== "Cancelado")
    botoes += ` <button class="btn-small btn-cancel" onclick="mudarStatus(${p.id}, 'Cancelado')">Cancelar ❌</button>`;

  // [NOVO] Botão de Imprimir (Sempre visível)
  const btnPrint = `
    <button class="btn-small" onclick="imprimirComanda(${p.id})" style="background:#555; color:white; border:none; margin-right:5px;" title="Imprimir Cupom">
        <i class="fa-solid fa-print"></i>
    </button>
  `;

  const btnDossie = `
    <button class="btn-small" onclick="abrirDossie(${p.id})" style="background:#444; color:#aaa; border:none; margin-right:5px;" title="Investigar Pedido">
        <i class="fa-solid fa-magnifying-glass"></i>
    </button>
  `;

  // Itens
  const itemsHtml = p.items
    .map((i) => `<div><strong>${i.quantity}x ${i.product.name}</strong></div>`)
    .join("");

  return `
    <div class="admin-order-card status-${p.status.replace(/ /g, ".")}">
        <div class="card-header">
            <span class="card-user">#${p.id} - ${
    p.customer_name || "Cliente"
  }</span>
            <span class="card-time">${time}</span>
        </div>
        <div class="card-items">${itemsHtml}</div>
        <div style="font-size:0.85rem; margin:10px 0;">
            📍 ${p.street}, ${p.number}<br>
            💳 <strong>${p.payment_method}</strong><br>
            <span style="color:gold">R$ ${p.total_price.toFixed(2)}</span>
        </div>
        <div class="card-actions">
            ${btnPrint}
            ${botoes}
            ${btnDossie}
        </div>
        <div style="text-align:right; font-size:0.8rem; color:#666; margin-top:5px;">${
          p.status
        }</div>
    </div>`;
}

window.mudarStatus = async function (id, novo) {
  if (confirm(`Mudar status do pedido #${id} para '${novo}'?`)) {
    await updateOrderStatus(id, novo);
    carregarPedidosAdmin();
  }
};

// =============================================================================
//  ABA 2: CARDÁPIO
// =============================================================================

window.carregarMenuAdmin = async function () {
  const tbody = document.getElementById("admin-menu-list");
  const produtos = await fetchAdminMenu();

  if (produtos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">Cardápio vazio.</td></tr>';
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
                   style="font-size:1.5rem; cursor:pointer;" 
                   title="Pausar/Ativar"></i>
            </td>
            <td>
                <div style="display:flex; gap:5px; justify-content:center;">
                    <button class="btn-small" style="background:#3498db; color:white; border:none;" 
                            onclick="editarProduto(${
                              p.id
                            })"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-small" style="background:#e74c3c; color:white; border:none;" 
                            onclick="deletarProduto(${
                              p.id
                            })"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `
    )
    .join("");
};

window.toggleProd = async function (id) {
  await toggleAvailability(id);
  carregarMenuAdmin();
};

// --- MODAL DE PRODUTO (Criar e Editar) ---

window.openProductModal = function () {
  produtoEmEdicaoId = null; // Modo Criar

  // Limpa formulário e visual
  document.getElementById("form-add-product").reset();
  document.querySelector("#modal-product-admin h3").innerText = "Novo Produto";
  document.querySelector('#form-add-product button[type="submit"]').innerText =
    "Cadastrar Produto";

  // Imagem
  document.getElementById("preview-img").style.display = "none";
  document.getElementById("preview-icon").style.display = "block";
  document.getElementById("prod-image-url").value = "";
  const lbl = document.querySelector('label[for="prod-file"]');
  if (lbl) {
    lbl.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Upload PC';
    lbl.style.color = "";
    lbl.style.borderColor = "";
  }

  // Detalhes (Linhas vazias)
  document.getElementById("details-container").innerHTML = "";
  window.addDetailRow();
  window.addDetailRow();

  document.getElementById("modal-product-admin").style.display = "flex";
};

window.editarProduto = async function (id) {
  // Busca dados atualizados do menu
  const produtos = await fetchAdminMenu();
  const produto = produtos.find((p) => p.id === id);
  if (!produto) return;

  produtoEmEdicaoId = id; // Modo Editar

  // Preenche formulário
  document.querySelector("#modal-product-admin h3").innerText =
    "Editar Produto";
  document.querySelector('#form-add-product button[type="submit"]').innerText =
    "Salvar Alterações";

  document.getElementById("prod-name").value = produto.name;
  document.getElementById("prod-price").value = produto.price;
  document.getElementById("prod-category").value = produto.category || "Lanche";
  document.getElementById("prod-desc").value = produto.description || "";
  document.getElementById("prod-image-url").value = produto.image_url || "";

  if (document.getElementById("prod-stock")) {
    document.getElementById("prod-stock").value =
      produto.stock_quantity !== null && produto.stock_quantity !== undefined
        ? produto.stock_quantity
        : "";
  }

  if (document.getElementById("prod-stock"))
    document.getElementById("prod-stock").value = "";

  // Preview Imagem
  if (produto.image_url) {
    const img = document.getElementById("preview-img");
    img.src = produto.image_url;
    img.style.display = "block";
    document.getElementById("preview-icon").style.display = "none";
  }

  // Preenche Detalhes
  const container = document.getElementById("details-container");
  container.innerHTML = "";

  let details = {};
  try {
    // Tenta ler do objeto ou parsear string (compatibilidade)
    details =
      typeof produto.details_json === "string"
        ? JSON.parse(produto.details_json)
        : produto.details || {};
  } catch (e) {}

  let temDetalhes = false;
  ["carnes", "adicionais", "acompanhamentos", "bebidas"].forEach((key) => {
    if (details[key]) {
      details[key].forEach((item) => {
        // Formata "Bacon - 3.00"
        const val = item.price > 0 ? `${item.nome} - ${item.price}` : item.nome;
        window.addDetailRow(key, val);
        temDetalhes = true;
      });
    }
  });

  if (!temDetalhes) window.addDetailRow(); // Garante pelo menos uma linha

  document.getElementById("modal-product-admin").style.display = "flex";
};

window.closeProductModal = function () {
  document.getElementById("modal-product-admin").style.display = "none";
};

// Adiciona linha dinâmica no modal
window.addDetailRow = function (key = "adicionais", value = "") {
  const container = document.getElementById("details-container");
  const div = document.createElement("div");
  div.style.display = "flex";
  div.style.gap = "5px";

  const options = `
    <option value="adicionais" ${
      key === "adicionais" ? "selected" : ""
    }>Adicional</option>
    <option value="acompanhamentos" ${
      key === "acompanhamentos" ? "selected" : ""
    }>Acomp.</option>
    <option value="bebidas" ${
      key === "bebidas" ? "selected" : ""
    }>Bebida</option>
    <option value="carnes" ${key === "carnes" ? "selected" : ""}>Carne</option>
  `;

  div.innerHTML = `
    <select class="detail-key" style="background:#111; color:white; border:1px solid #444; border-radius:4px; padding:5px;">${options}</select>
    <input type="text" class="detail-val" value="${value}" placeholder="Ex: Bacon - 3.00" style="flex:1; background:#111; color:white; border:1px solid #444; border-radius:4px; padding:5px;">
    <button type="button" onclick="removeDetailRow(this)" style="background:#333; color:#e74c3c; border:none; cursor:pointer; padding:0 10px;">&times;</button>
  `;
  container.appendChild(div);
};

window.removeDetailRow = function (btn) {
  btn.parentElement.remove();
};

// Upload de Imagem (Listener)
// Upload de Imagem (Listener)
const fileInput = document.getElementById("prod-file");

if (fileInput) {
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Elementos visuais
    const lbl = document.getElementById("btn-upload-pc"); // O botão que criamos
    const textoOriginal =
      '<i class="fa-solid fa-cloud-arrow-up"></i> <span>Upload PC</span>';

    // 1. Estado Inicial: Verificando Duplicatas
    lbl.innerHTML =
      '<i class="fa-solid fa-magnifying-glass fa-spin"></i> Verificando...';
    lbl.style.pointerEvents = "none";
    lbl.style.opacity = "0.7";

    try {
      // --- NOVO: VERIFICAÇÃO DE DUPLICIDADE ---
      // 1. Busca a lista atual da nuvem
      const galeria = await fetchCloudGallery();

      // 2. Extrai o nome do arquivo sem extensão (ex: "burger.jpg" -> "burger")
      // O Cloudinary usa o "public_id" que geralmente é o nome do arquivo sem extensão
      const nomeArquivo = file.name.split(".")[0].toLowerCase();

      // 3. Verifica se existe alguma imagem na galeria que termine com esse nome
      // (O public_id pode ser "cegonha_cardapio/burger", então checamos o final)
      const duplicada = galeria.find((img) => {
        const nomeNaNuvem = img.name.split("/").pop().toLowerCase(); // Pega só o final
        return nomeNaNuvem === nomeArquivo;
      });

      if (duplicada) {
        alert(
          `Atenção: A imagem "${file.name}" já existe na nuvem!\n\nPara usar esta imagem, clique no botão "Nuvem" e selecione-a na galeria.`
        );
        throw new Error("Imagem duplicada"); // Força a saída para o catch
      }

      // --- SE PASSOU, CONTINUA PRO UPLOAD ---
      lbl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

      // Preview Local (para não deixar o usuário esperando o upload terminar para ver)
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = document.getElementById("preview-img");
        if (img) {
          img.src = ev.target.result;
          img.style.display = "block";
          document.getElementById("preview-icon").style.display = "none";
        }
      };
      reader.readAsDataURL(file);

      // Envio Real
      const url = await uploadImage(file);

      if (url) {
        // SUCESSO
        document.getElementById("prod-image-url").value = url;

        // Alert pedido
        alert("Imagem enviada para a nuvem com sucesso!");

        lbl.innerHTML = "Foto OK ✅";
        lbl.style.color = "#2ecc71";
        lbl.style.borderColor = "#2ecc71";

        // Reseta visual após 3s
        setTimeout(() => {
          lbl.innerHTML = textoOriginal;
          lbl.style.color = "";
          lbl.style.borderColor = "";
          lbl.style.pointerEvents = "auto";
          lbl.style.opacity = "1";
        }, 3000);
      } else {
        throw new Error("Falha no envio");
      }
    } catch (error) {
      // TRATAMENTO DE ERRO OU DUPLICIDADE
      console.warn(error.message);

      // Se não for erro de duplicada (que já deu alert), avisa
      if (error.message !== "Imagem duplicada") {
        alert("Erro: " + error.message);
      }

      // Reseta o botão imediatamente
      lbl.innerHTML = textoOriginal;
      lbl.style.pointerEvents = "auto";
      lbl.style.opacity = "1";

      // Limpa o preview se deu erro
      document.getElementById("preview-img").style.display = "none";
      document.getElementById("preview-icon").style.display = "block";
      document.getElementById("prod-image-url").value = "";
    }

    // Limpa o input para permitir nova tentativa
    fileInput.value = "";
  });
}

// Salvar Produto (Submit)
const formProd = document.getElementById("form-add-product");
if (formProd) {
  formProd.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = formProd.querySelector('button[type="submit"]');
    btn.innerText = "Salvando...";
    btn.disabled = true;
    const stockVal = document.getElementById("prod-stock").value;

    try {
      // Coleta dados simples
      const data = {
        name: document.getElementById("prod-name").value,
        price: parseFloat(document.getElementById("prod-price").value),
        category: document.getElementById("prod-category").value,
        description: document.getElementById("prod-desc").value,
        image_url: document.getElementById("prod-image-url").value,
        stock_quantity: stockVal === "" ? null : parseInt(stockVal),
        details: {
          carnes: [],
          adicionais: [],
          acompanhamentos: [],
          bebidas: [],
        },
      };

      // Processa as linhas de detalhes
      document.querySelectorAll("#details-container > div").forEach((row) => {
        const key = row.querySelector(".detail-key").value;
        const val = row.querySelector(".detail-val").value.trim();
        if (val) {
          let nomeItem = val;
          let precoItem = 0.0;
          if (val.includes("-")) {
            const partes = val.split("-");
            nomeItem = partes[0].trim();
            // Converte "3,50" para 3.50
            precoItem = parseFloat(partes[1].replace(",", ".").trim()) || 0;
          }
          data.details[key].push({ nome: nomeItem, price: precoItem });
        }
      });

      // Envia
      let ok = false;
      if (produtoEmEdicaoId) {
        ok = await updateProduct(produtoEmEdicaoId, data);
      } else {
        ok = await createProduct(data);
      }

      if (ok) {
        alert(produtoEmEdicaoId ? "Produto atualizado!" : "Produto criado!");
        window.closeProductModal();
        carregarMenuAdmin();
      } else {
        throw new Error("Erro no servidor");
      }
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      btn.innerText = produtoEmEdicaoId
        ? "Salvar Alterações"
        : "Cadastrar Produto";
      btn.disabled = false;
    }
  });
}

// --- SEGURANÇA: EXCLUIR PRODUTO ---

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
  const senha = input.value;

  if (!senha) return alert("Digite a senha mestra.");
  if (!idParaDeletar) return;

  btn.innerHTML = "Verificando...";
  btn.disabled = true;

  const result = await deleteProduct(idParaDeletar, senha);

  if (result === true) {
    alert("Produto excluído!");
    closeSecurityModal();
    carregarMenuAdmin();
  } else {
    alert(result.error || "Senha incorreta ou erro.");
    input.value = "";
    input.focus();
  }

  btn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir Agora';
  btn.disabled = false;
};

// Atalho Enter no modal de senha
document.getElementById("security-pass")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") window.executarDelecao();
});

// =============================================================================
//  ABA 3: CHAT
// =============================================================================

window.carregarListaConversas = async function () {
  const lista = await fetchAdminConversations();
  const container = document.getElementById("chat-users-list");

  if (lista.length === 0) {
    container.innerHTML =
      '<p style="padding:20px; color:#666">Nenhuma conversa.</p>';
    return;
  }

  container.innerHTML = lista
    .map(
      (u) => `
        <div class="chat-user-item ${
          chatUserIdAtivo === u.user_id ? "active" : ""
        }" 
             onclick="selecionarChat(${u.user_id}, '${u.user_name}')">
            <div class="user-avatar-small">${u.user_name[0].toUpperCase()}</div>
            <div style="flex:1">
                <div>${u.user_name}</div>
                <small style="color:#888">${new Date(u.last_interaction)
                  .toLocaleTimeString()
                  .slice(0, 5)}</small>
            </div>
        </div>
    `
    )
    .join("");
};

window.selecionarChat = function (id, nome) {
  chatUserIdAtivo = id;
  document.getElementById("admin-chat-input-area").style.display = "flex";
  carregarChatAtivo(id);
  carregarListaConversas(); // Atualiza destaque
};

async function carregarChatAtivo(uid) {
  const msgs = await fetchAdminUserHistory(uid);
  const container = document.getElementById("admin-chat-messages");

  container.innerHTML = msgs
    .map(
      (m) =>
        `<div class="msg ${m.is_from_admin ? "msg-admin" : "msg-user"}">${
          m.message
        }</div>`
    )
    .join("");

  // Rola para o final
  container.scrollTop = container.scrollHeight;
}

window.enviarRespostaAdmin = async function () {
  const inp = document.getElementById("admin-chat-input");
  const txt = inp.value.trim();

  if (!txt || !chatUserIdAtivo) return;

  if (await sendAdminReply(chatUserIdAtivo, txt)) {
    inp.value = "";
    carregarChatAtivo(chatUserIdAtivo);
  } else {
    alert("Erro ao enviar.");
  }
};

window.handleAdminChatKey = function (e) {
  if (e.key === "Enter") window.enviarRespostaAdmin();
};

// =============================================================================
//  ABA 4: CONFIGURAÇÕES (Cupons e Usuários)
// =============================================================================

window.switchConfigTab = function (tabName) {
  document
    .querySelectorAll(".config-tab-btn")
    .forEach((btn) => btn.classList.remove("active"));
  event.currentTarget.classList.add("active");

  document
    .querySelectorAll(".config-subpanel")
    .forEach((el) => (el.style.display = "none"));
  document.getElementById(`config-${tabName}`).style.display = "block";

  if (tabName === "coupons") carregarCuponsAdmin();
  if (tabName === "users") carregarUsuariosAdmin();
  if (tabName === "schedule") carregarHorariosAdmin();
};

// Cupons
window.carregarCuponsAdmin = async function () {
  const container = document.getElementById("coupons-list");
  const lista = await fetchCoupons();

  if (lista.length === 0) {
    container.innerHTML = '<p style="color:#666">Nenhum cupom ativo.</p>';
    return;
  }

  container.innerHTML = lista
    .map(
      (c) => `
        <div class="coupon-card">
            <div class="coupon-code">${c.code}</div>
            <div class="coupon-info">
                ${
                  c.discount_percent > 0
                    ? c.discount_percent + "% OFF"
                    : "R$ " + c.discount_fixed.toFixed(2) + " OFF"
                }
            </div>
            <div class="coupon-info">Min: R$ ${c.min_purchase.toFixed(2)}</div>
            <div class="coupon-info">Usos: ${c.used_count} / ${
        c.usage_limit || "∞"
      }</div>
            
            <button class="btn-small btn-cancel" onclick="deletarCupom(${
              c.id
            })" 
                style="position:absolute; top:10px; right:10px; border:none; background:transparent; color:#e74c3c;">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `
    )
    .join("");
};

window.toggleNewCouponForm = function () {
  const form = document.getElementById("form-new-coupon");
  form.style.display = form.style.display === "none" ? "block" : "none";
};

window.deletarCupom = async function (id) {
  if (confirm("Apagar este cupom permanentemente?")) {
    await deleteCoupon(id);
    carregarCuponsAdmin();
  }
};

const formCupom = document.getElementById("form-new-coupon");
if (formCupom) {
  formCupom.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      code: document.getElementById("cupom-code").value.trim(),
      discount_percent:
        parseInt(document.getElementById("cupom-percent").value) || 0,
      discount_fixed:
        parseFloat(document.getElementById("cupom-fixed").value) || 0,
      min_purchase: parseFloat(document.getElementById("cupom-min").value) || 0,
      usage_limit:
        parseInt(document.getElementById("cupom-limit").value) || null,
    };

    if (await createCoupon(data)) {
      alert("Cupom criado!");
      formCupom.reset();
      formCupom.style.display = "none";
      carregarCuponsAdmin();
    } else {
      alert("Erro (código já existe?)");
    }
  });
}

// Usuários
window.carregarUsuariosAdmin = async function () {
  const tbody = document.getElementById("users-list-body");
  tbody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';

  const lista = await fetchUsersList();

  if (lista.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4">Nenhum usuário encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = lista
    .map(
      (u) => `
        <tr>
            <td>${u.id}</td>
            <td>${u.name}<br><small style="color:#666">${u.email}</small></td>
            <td>${u.whatsapp || "-"}</td>
            <td><span style="background:#333; padding:2px 6px; border-radius:4px;">${
              u.orders_count
            }</span></td>
        </tr>
    `
    )
    .join("");
};
// site/js/admin.js (Substitua o final do arquivo por isto)

// =============================================================================
//  SISTEMA DE GALERIA CLOUDINARY (UNIFICADO)
// =============================================================================

// 1. Função Principal: Abre o Modal E Carrega a Lista
window.abrirGaleriaNuvem = async function () {
  const modal = document.getElementById("modal-cloud-gallery");
  const container = document.getElementById("cloud-grid");

  // Ação 1: Mostrar o Modal
  modal.style.display = "flex";

  // Ação 2: Feedback de Carregamento
  container.innerHTML =
    '<p style="color:#ccc"><i class="fa-solid fa-spinner fa-spin"></i> Carregando nuvem...</p>';

  // Ação 3: Buscar dados da API
  const imagens = await fetchCloudGallery();

  // Ação 4: Renderizar
  if (imagens.length === 0) {
    container.innerHTML =
      '<p style="color:#ccc">Nenhuma imagem encontrada na nuvem.</p>';
    return;
  }

  container.innerHTML = imagens
    .map((img) => {
      // Limpa o nome para ficar mais bonito (remove pasta e extensão se quiser, ou deixa completo)
      // Aqui mostramos o public_id completo (ex: "cegonha_cardapio/burger")
      const nomeExibicao = img.name.split("/").pop(); // Pega só o final do nome (ex: "burger")

      return `
        <div class="gallery-item" onclick="selecionarImagemCloud('${img.url}')" title="${img.name}">
            <button class="btn-delete-img" 
                    onclick="apagarImagemCloud(event, '${img.name}')" 
                    title="Apagar permanentemente">
                <i class="fa-solid fa-trash"></i>
            </button>
            
            <img src="${img.url}" loading="lazy">
            
            <div class="gallery-name">${nomeExibicao}</div>
        </div>
    `;
    })
    .join("");
};

window.fecharGaleriaNuvem = function () {
  document.getElementById("modal-cloud-gallery").style.display = "none";
};

window.selecionarImagemCloud = function (url) {
  // 1. Preenche o input escondido do formulário de produto
  document.getElementById("prod-image-url").value = url;

  // 2. Atualiza o visual (Preview)
  const img = document.getElementById("preview-img");
  const icon = document.getElementById("preview-icon");

  img.src = url;
  img.style.display = "block";
  icon.style.display = "none";

  // 3. Fecha a galeria
  fecharGaleriaNuvem();
};

// Função de Apagar Imagem
async function apagarImagemCloud(event, publicId) {
  event.stopPropagation(); // Impede que o clique selecione a imagem ao tentar apagar

  if (
    !confirm(
      "Tem certeza? Essa imagem será apagada do servidor permanentemente."
    )
  )
    return;

  const btn = event.currentTarget;
  // Feedback visual no botão de lixo
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  const sucesso = await deleteCloudImage(publicId);

  if (sucesso) {
    // REUTILIZA A FUNÇÃO UNIFICADA:
    // Chama a abrirGaleriaNuvem novamente para recarregar a lista atualizada
    await window.abrirGaleriaNuvem();
  } else {
    alert("Erro ao apagar. Verifique se tem permissão.");
    btn.innerHTML = '<i class="fa-solid fa-trash"></i>';
  }
}

window.carregarBairrosAdmin = async function () {
  const lista = await fetchNeighborhoodsAdmin();
  const container = document.getElementById("delivery-list");

  container.innerHTML = lista
    .map(
      (b) => `
        <div class="coupon-card" style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong style="color:var(--color-gold); font-size:1.1rem;">${
                  b.name
                }</strong>
                <div style="color:#ccc;">Taxa: R$ ${b.price.toFixed(2)}</div>
            </div>
            <button class="btn-small btn-cancel" onclick="apagarBairro(${
              b.id
            })">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `
    )
    .join("");
};

window.adicionarBairro = async function () {
  const nome = document.getElementById("new-bairro-name").value;
  const preco = document.getElementById("new-bairro-price").value;

  if (!nome || !preco) return alert("Preencha nome e valor");

  if (await addNeighborhood({ name: nome, price: preco })) {
    document.getElementById("new-bairro-name").value = "";
    document.getElementById("new-bairro-price").value = "";
    carregarBairrosAdmin();
  } else {
    alert("Erro ao salvar (Bairro já existe?)");
  }
};

window.apagarBairro = async function (id) {
  if (confirm("Remover este bairro?")) {
    await deleteNeighborhood(id);
    carregarBairrosAdmin();
  }
};

// Exporta a função de apagar para o HTML poder usar no onclick
window.apagarImagemCloud = apagarImagemCloud;

// ==========================================
//  SISTEMA DE IMPRESSÃO TÉRMICA
// ==========================================

window.imprimirComanda = function (id) {
  // 1. Encontra o pedido na memória
  const pedido = pedidosDoDia.find((p) => p.id === id);
  if (!pedido)
    return alert("Erro: Pedido não encontrado na memória. Atualize a página.");

  // 2. Formata Data
  const dataObj = new Date(pedido.date_created);
  const dataFormatada =
    dataObj.toLocaleDateString("pt-BR") +
    " " +
    dataObj.toLocaleTimeString("pt-BR").slice(0, 5);

  // 3. Monta Itens
  let itensHtml = "";
  pedido.items.forEach((item) => {
    // Processa personalizações para exibir no papel
    let detalhes = "";
    if (item.customizations_json) {
      try {
        const cust = JSON.parse(item.customizations_json);
        const lista = [
          ...(cust.carnes || []),
          ...(cust.adicionais || []),
          ...(cust.acompanhamentos || []),
          ...(cust.bebidas || []),
        ];
        if (lista.length > 0)
          detalhes = `<div style="font-size:10px; margin-left:10px; color:#444;">+ ${lista.join(
            ", "
          )}</div>`;
        if (cust.obs)
          detalhes += `<div style="font-size:10px; margin-left:10px; font-weight:bold;">OBS: ${cust.obs}</div>`;
      } catch (e) {}
    }

    itensHtml += `
      <div style="margin-bottom:5px; border-bottom:1px dashed #ccc; padding-bottom:2px;">
        <div style="display:flex; justify-content:space-between; font-weight:bold;">
            <span>${item.quantity}x ${item.product.name}</span>
            <span>R$ ${(item.price_at_time * item.quantity).toFixed(2)}</span>
        </div>
        ${detalhes}
      </div>
    `;
  });

  // 4. Monta o Layout da Comanda (HTML Puro)
  const conteudoJanela = `
    <html>
      <head>
        <title>Pedido #${pedido.id}</title>
        <style>
          @page { margin: 0; }
          body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 10px; width: 300px; color: #000; }
          .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 5px; }
          .section { margin-bottom: 10px; border-bottom: 1px solid #000; padding-bottom: 5px; }
          .bold { font-weight: bold; }
          .big { font-size: 14px; }
          .center { text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="big bold">CEGONHA LANCHES</div>
          <div>Itapagipe - MG</div>
          <div style="margin-top:5px;">PEDIDO #${pedido.id}</div>
          <div>${dataFormatada}</div>
        </div>

        <div class="section">
          <div class="bold">CLIENTE:</div>
          <div>${pedido.customer_name || "Consumidor"}</div>
          <div>Tel: ${pedido.customer_phone || "-"}</div>
          <div style="margin-top:5px;" class="bold">ENTREGA:</div>
          <div>${pedido.street}, ${pedido.number}</div>
          <div>${pedido.neighborhood} ${
    pedido.complement ? "- " + pedido.complement : ""
  }</div>
        </div>

        <div class="section">
          <div class="bold" style="margin-bottom:5px;">ITENS:</div>
          ${itensHtml}
        </div>

        <div class="section">
          <div style="display:flex; justify-content:space-between;">
             <span>Taxa Entrega:</span>
             <span>R$ ${(pedido.delivery_fee || 0).toFixed(2)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:bold; margin-top:5px;">
             <span>TOTAL:</span>
             <span>R$ ${pedido.total_price.toFixed(2)}</span>
          </div>
        </div>

        <div class="center">
          <div>Pagamento: <strong>${pedido.payment_method}</strong></div>
          <div style="margin-top:10px; font-size:10px;">Sistema Cegonha Lanches</div>
        </div>
      </body>
    </html>
  `;

  // 5. Abre Janela e Imprime
  const janela = window.open("", "_blank", "width=350,height=600");
  janela.document.write(conteudoJanela);
  janela.document.close();

  // Aguarda carregar para imprimir
  setTimeout(() => {
    janela.print();
    // janela.close(); // Opcional: fechar automaticamente após imprimir
  }, 500);
};

const diasSemana = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

window.carregarHorariosAdmin = async function () {
  const lista = await fetchSchedule();
  const tbody = document.getElementById("schedule-list-body");

  tbody.innerHTML = lista
    .map(
      (d) => `
        <tr data-day="${d.day_of_week}">
            <td><strong>${diasSemana[d.day_of_week]}</strong></td>
            <td><input type="time" class="inp-time open" value="${
              d.open_time
            }" style="background:#111; border:1px solid #444; color:white; padding:5px; border-radius:4px;"></td>
            <td><input type="time" class="inp-time close" value="${
              d.close_time
            }" style="background:#111; border:1px solid #444; color:white; padding:5px; border-radius:4px;"></td>
            <td>
                <label class="checkbox-container" style="margin:0;">
                    <input type="checkbox" class="inp-closed" ${
                      d.is_closed ? "checked" : ""
                    }>
                    <span class="checkmark"></span>
                </label>
            </td>
        </tr>
    `
    )
    .join("");
};

window.salvarHorarios = async function () {
  const linhas = document.querySelectorAll("#schedule-list-body tr");
  const payload = [];

  linhas.forEach((tr) => {
    payload.push({
      day_of_week: parseInt(tr.dataset.day),
      open_time: tr.querySelector(".open").value,
      close_time: tr.querySelector(".close").value,
      is_closed: tr.querySelector(".inp-closed").checked,
    });
  });

  if (await updateSchedule(payload)) {
    alert("Horários atualizados!");
  } else {
    alert("Erro ao salvar.");
  }
};

window.carregarDashboard = async function () {
  const dados = await fetchDashboardStats();
  if (!dados) return;

  // Preenche cards
  document.getElementById("stat-hoje").innerText = `R$ ${dados.hoje.toFixed(
    2
  )}`;
  document.getElementById("stat-mes").innerText = `R$ ${dados.mes.toFixed(2)}`;

  // Renderiza Gráfico
  const ctx = document.getElementById("salesChart").getContext("2d");

  if (chartInstance) chartInstance.destroy(); // Limpa anterior

  chartInstance = new Chart(ctx, {
    type: "bar", // ou 'line'
    data: {
      labels: dados.grafico.labels,
      datasets: [
        {
          label: "Vendas (R$)",
          data: dados.grafico.data,
          backgroundColor: "#f2c94c",
          borderColor: "#f2c94c",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "white" } },
      },
      scales: {
        y: { ticks: { color: "#ccc" }, grid: { color: "#333" } },
        x: { ticks: { color: "#ccc" }, grid: { display: false } },
      },
    },
  });
};

// --- DOSSIÊ DE INVESTIGAÇÃO ---
window.abrirDossie = async function (id) {
  const dossie = await fetchOrderDossier(id);
  if (!dossie) return alert("Erro ao carregar dossiê.");

  const container = document.getElementById("dossier-body");
  const d = dossie; // Atalho

  // Formata JSON dos itens para leitura
  const itensLegiveis = d.items
    .map((i) => ` - ${i.quantity}x ${i.product.name} (R$ ${i.price_at_time})`)
    .join("<br>");

  container.innerHTML = `
        <div style="background:#222; padding:10px; border-radius:5px; margin-bottom:10px;">
            <strong>🆔 PEDIDO:</strong> #${d.id}<br>
            <strong>📅 DATA:</strong> ${new Date(
              d.date_created
            ).toLocaleString()}<br>
            <strong>👤 CLIENTE:</strong> ${d.customer_name} (${
    d.customer_phone
  })<br>
            <strong>🚦 STATUS ATUAL:</strong> ${d.status}
        </div>

        <div style="background:#222; padding:10px; border-radius:5px; margin-bottom:10px;">
            <strong>💳 PAGAMENTO:</strong><br>
            Método: ${d.payment_method}<br>
            Status do Pagamento: <span style="color:${
              d.payment_status === "approved" ? "#2ecc71" : "#e74c3c"
            }">${d.payment_status}</span><br>
            Total Pago: R$ ${d.total_price.toFixed(2)}
        </div>

        <div style="background:#222; padding:10px; border-radius:5px; margin-bottom:10px;">
            <strong>📍 ENTREGA:</strong><br>
            ${d.street}, ${d.number}<br>
            ${d.neighborhood} ${d.complement ? "- " + d.complement : ""}<br>
            Taxa Cobrada: R$ ${(d.delivery_fee || 0).toFixed(2)}
        </div>

        <div style="background:#222; padding:10px; border-radius:5px;">
            <strong>🍔 ITENS ORIGINAIS:</strong><br>
            ${itensLegiveis}
        </div>
        
        <p style="font-size:0.8rem; color:#666; margin-top:10px; text-align:center;">
            Documento gerado digitalmente pelo sistema Cegonha Lanches.<br>
            ID Auditoria: ${Date.now()}-${d.id}
        </p>
    `;

  document.getElementById("modal-dossier").style.display = "flex";
};

window.fecharDossie = function () {
  document.getElementById("modal-dossier").style.display = "none";
};

// js/admin.js

// --- FILTROS ---
window.abrirModalFiltro = function () {
  document.getElementById("modal-filter-orders").style.display = "flex";
};

window.fecharModalFiltro = function () {
  document.getElementById("modal-filter-orders").style.display = "none";
};

// Mostra/Esconde inputs de data
window.toggleDatasManuais = function () {
  const val = document.getElementById("filter-period").value;
  const row = document.getElementById("filter-dates-row");
  row.style.display = val === "manual" ? "flex" : "none";
};

// Lógica Principal de Filtragem
window.aplicarFiltros = function () {
  const period = document.getElementById("filter-period").value;
  const name = document.getElementById("filter-name").value;
  const payment = document.getElementById("filter-payment").value;
  const id = document.getElementById("filter-id").value;

  let start = "";
  let end = "";

  // Calcula datas baseado na seleção
  const hoje = new Date();

  if (period === "hoje") {
    start = hoje.toISOString().split("T")[0];
    end = start;
  } else if (period === "mes") {
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    start = primeiroDia.toISOString().split("T")[0];
    end = hoje.toISOString().split("T")[0];
  } else if (period === "ano") {
    const primeiroDia = new Date(hoje.getFullYear(), 0, 1);
    start = primeiroDia.toISOString().split("T")[0];
    end = hoje.toISOString().split("T")[0];
  } else if (period === "manual") {
    start = document.getElementById("filter-start").value;
    end = document.getElementById("filter-end").value;
  }
  // 'todos' deixa start/end vazios

  // Monta objeto
  const filtros = {};
  if (start) filtros.start_date = start;
  if (end) filtros.end_date = end;
  if (name) filtros.customer_name = name;
  if (payment) filtros.payment_method = payment;
  if (id) filtros.order_id = id;

  // Chama a função de carregar passando os filtros
  // Precisamos atualizar a função carregarPedidosAdmin para aceitar argumentos
  carregarPedidosAdmin(filtros);
  fecharModalFiltro();
};

window.limparFiltros = function () {
  document.getElementById("filter-period").value = "hoje";
  document.getElementById("filter-name").value = "";
  document.getElementById("filter-payment").value = "";
  document.getElementById("filter-id").value = "";
  toggleDatasManuais();
  aplicarFiltros(); // Reseta para hoje
};

// --- ATUALIZE A FUNÇÃO carregarPedidosAdmin ---
window.carregarPedidosAdmin = async function (filtrosOpcionais = null) {
  const container = document.getElementById("admin-orders-list");
  const btn = document.querySelector("#panel-orders .btn-outline");

  if (btn) btn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> ...';

  // Se não vier filtros (ex: clique no botão atualizar), usa padrão (hoje) ou o último usado?
  // Para simplificar, se clicar em atualizar sem filtros, busca HOJE.
  // Se vier do modal, usa os filtros do modal.

  let filtrosFinais = filtrosOpcionais;
  if (!filtrosFinais) {
    // Padrão: Hoje
    const hoje = new Date().toISOString().split("T")[0];
    filtrosFinais = { start_date: hoje, end_date: hoje };
  }

  const pedidos = await fetchAdminOrders(filtrosFinais);

  pedidosDoDia = pedidos;

  container.innerHTML = pedidos.length
    ? pedidos.map((p) => renderOrderCard(p)).join("")
    : '<div style="text-align:center; padding:20px; color:#666; grid-column: 1 / -1;">Nenhum pedido encontrado com estes filtros.</div>';

  if (btn) btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Atualizar';
};

window.abrirModalFiltroRelatorio = function () {
  document.getElementById("modal-filter-reports").style.display = "flex";
};

window.fecharModalFiltroRelatorio = function () {
  document.getElementById("modal-filter-reports").style.display = "none";
};

window.toggleDatasRelatorio = function () {
  const val = document.getElementById("rep-period").value;
  document.getElementById("rep-dates-row").style.display =
    val === "manual" ? "flex" : "none";
};

// js/admin.js

window.aplicarFiltroRelatorio = function () {
  const period = document.getElementById("rep-period").value;
  const payment = document.getElementById("rep-payment").value;

  let start = "";
  let end = "";
  const hoje = new Date();
  start = hoje.toISOString().split("T")[0];
  end = start;

  if (period === "hoje") {
    start = hoje.toISOString().split("T")[0];
    end = start;
  } else if (period === "semana") {
    // [NOVA LÓGICA] Esta Semana (De Domingo até Hoje)
    const primeiroDia = new Date(hoje);
    const diaDaSemana = hoje.getDay(); // 0 = Domingo, 1 = Segunda...

    // Subtrai os dias para voltar ao último Domingo
    primeiroDia.setDate(hoje.getDate() - diaDaSemana);

    start = primeiroDia.toISOString().split("T")[0];
    end = hoje.toISOString().split("T")[0];
  } else if (period === "mes") {
    // Do dia 1 até hoje
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    start = primeiroDia.toISOString().split("T")[0];
    end = hoje.toISOString().split("T")[0];
  } else if (period === "manual") {
    start = document.getElementById("rep-start").value;
    end = document.getElementById("rep-end").value;
  }

  const filtros = {};
  if (start) filtros.start_date = start;
  if (end) filtros.end_date = end;
  if (payment) filtros.payment_method = payment;

  carregarDashboard(filtros);
  fecharModalFiltroRelatorio();
};

// [ATUALIZADO] Função principal do Dashboard
window.carregarDashboard = async function (filtros = {}) {
  const btn = document.querySelector("#panel-reports .btn-outline");
  if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  const dados = await fetchDashboardStats(filtros);

  if (btn) btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Atualizar';

  if (!dados) return;

  // Atualiza Textos
  document.getElementById(
    "stat-faturamento"
  ).innerText = `R$ ${dados.total_periodo.toFixed(2)}`;
  document.getElementById("stat-qtd").innerText = dados.qtd_pedidos;
  document.getElementById(
    "report-period-label"
  ).innerText = `Período: ${dados.periodo_info}`;

  // Renderiza Gráfico
  const ctx = document.getElementById("salesChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: "line", // Mudei para linha, fica mais bonito para evolução temporal
    data: {
      labels: dados.grafico.labels,
      datasets: [
        {
          label: "Vendas (R$)",
          data: dados.grafico.data,
          backgroundColor: "rgba(242, 201, 76, 0.2)",
          borderColor: "#f2c94c",
          borderWidth: 2,
          fill: true,
          tension: 0.4, // Curva suave
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "white" } } },
      scales: {
        y: {
          ticks: {
            color: "#ccc",
            callback: function (value) {
              return "R$ " + value;
            },
          },
          grid: { color: "#333" },
        },
        x: { ticks: { color: "#ccc" }, grid: { display: false } },
      },
    },
  });
};
