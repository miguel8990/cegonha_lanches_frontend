import {
  fetchAdminMenu,
  toggleAvailability,
  fetchAdminOrders,
  updateOrderStatus,
  fetchAdminConversations,
  fetchAdminUserHistory,
  sendAdminReply,
} from "./api.js";

let chatUserIdAtivo = null;
let chatInterval = null;
// 1. VERIFICAÇÃO DE SEGURANÇA E INICIALIZAÇÃO
document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Verifica se é Admin
  if (!user.role || (user.role !== "admin" && user.role !== "super_admin")) {
    alert("Acesso negado. Área restrita.");
    window.location.href = "index.html";
    return;
  }

  // Carrega dados iniciais
  carregarPedidosAdmin();
  carregarMenuAdmin();

  // Polling: Atualiza pedidos a cada 15 segundos
  setInterval(carregarPedidosAdmin, 15000);

  // Inicia Polling Geral (Pedidos e Chat)
  setInterval(() => {
    if (document.getElementById("panel-orders").classList.contains("active"))
      carregarPedidosAdmin();
    if (document.getElementById("panel-chat").classList.contains("active")) {
      carregarListaConversas(); // Atualiza lista lateral
      if (chatUserIdAtivo) carregarChatAtivo(chatUserIdAtivo); // Atualiza msg abertas
    }
  }, 5000); // 5 segundos
});

// --- NAVEGAÇÃO (Abas) ---
window.switchPanel = function (panelId) {
  // Esconde todas as seções
  document
    .querySelectorAll(".panel-section")
    .forEach((el) => el.classList.remove("active"));
  // Mostra a escolhida
  const target = document.getElementById(`panel-${panelId}`);
  if (target) target.classList.add("active");

  // Atualiza menu lateral
  document
    .querySelectorAll(".sidebar-menu button")
    .forEach((btn) => btn.classList.remove("active"));
  event.currentTarget.classList.add("active");
};

window.adminLogout = function () {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "index.html";
};

// --- GESTÃO DE PEDIDOS ---
window.carregarPedidosAdmin = async function () {
  const container = document.getElementById("admin-orders-list");
  // Feedback visual leve no botão de atualizar
  const btn = document.querySelector("#panel-orders .btn-outline");
  if (btn)
    btn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Atualizando...';

  const pedidos = await fetchAdminOrders();

  if (pedidos.length === 0) {
    container.innerHTML = "<p>Nenhum pedido hoje.</p>";
  } else {
    container.innerHTML = pedidos.map((p) => renderOrderCard(p)).join("");
  }

  if (btn) btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Atualizar';
};

function renderOrderCard(p) {
  const time = new Date(p.date_created).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Define botões de ação baseados no status atual
  let botoes = "";
  if (p.status === "Recebido") {
    botoes = `<button class="btn-small btn-next" onclick="mudarStatus(${p.id}, 'Em Preparo')">Aceitar 🔥</button>`;
  } else if (p.status === "Em Preparo") {
    botoes = `<button class="btn-small btn-next" onclick="mudarStatus(${p.id}, 'Saiu para Entrega')">Enviar 🛵</button>`;
  } else if (p.status === "Saiu para Entrega") {
    botoes = `<button class="btn-small btn-next" onclick="mudarStatus(${p.id}, 'Concluído')">Concluir ✅</button>`;
  }

  // Botão de cancelar sempre disponível (menos se já finalizou)
  if (p.status !== "Concluído" && p.status !== "Cancelado") {
    botoes += ` <button class="btn-small btn-cancel" onclick="mudarStatus(${p.id}, 'Cancelado')">Cancelar ❌</button>`;
  }

  // Classe para borda colorida
  const statusClass = p.status.replace(/ /g, "."); // "Em Preparo" -> "Em.Preparo"

  return `
    <div class="admin-order-card status-${statusClass}">
        <div class="card-header">
            <span class="card-user">#${p.id} - ${
    p.customer_name || "Cliente"
  }</span>
            <span class="card-time">${time}</span>
        </div>
        
        <div class="card-items">
            ${p.items
              .map((i) => {
                // Mostra personalizações se tiver
                let details = "";
                try {
                  const cust = JSON.parse(i.customizations_json || "{}");
                  const extras = [
                    ...(cust.carnes || []),
                    ...(cust.adicionais || []),
                    ...(cust.bebidas || []),
                  ].join(", ");
                  if (extras)
                    details = `<small style="color:#aaa; display:block;">+ ${extras}</small>`;
                  if (cust.obs)
                    details += `<small style="color:#f39c12; display:block;">Obs: ${cust.obs}</small>`;
                } catch (e) {}

                return `<div style="margin-bottom:5px;"><strong>${i.quantity}x ${i.product.name}</strong>${details}</div>`;
              })
              .join("")}
        </div>

        <div style="margin-bottom:10px; font-size:0.85rem; border-top:1px solid #333; padding-top:5px;">
            <div>📍 ${p.street}, ${p.number} - ${p.neighborhood}</div>
            <div>💳 <strong>${p.payment_method}</strong></div>
            <div style="font-size:1rem; color:var(--color-gold); margin-top:5px;">Total: R$ ${p.total_price.toFixed(
              2
            )}</div>
        </div>

        <div class="card-actions">
            ${botoes}
        </div>
        <div style="margin-top:8px; font-size:0.8rem; color:#666; text-align:right;">
            Status: ${p.status}
        </div>
    </div>`;
}

window.mudarStatus = async function (id, novoStatus) {
  if (!confirm(`Mudar pedido #${id} para "${novoStatus}"?`)) return;

  const sucesso = await updateOrderStatus(id, novoStatus);
  if (sucesso) {
    carregarPedidosAdmin(); // Atualiza a tela
  } else {
    alert("Erro ao atualizar status.");
  }
};

// --- GESTÃO DE CARDÁPIO ---
window.carregarMenuAdmin = async function () {
  const tbody = document.getElementById("admin-menu-list");
  const produtos = await fetchAdminMenu();

  if (produtos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">Nenhum produto.</td></tr>';
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
                <button class="btn-small" onclick="alert('Edição em breve!')"><i class="fa-solid fa-pen"></i></button>
            </td>
        </tr>
    `
    )
    .join("");
};

window.toggleProd = async function (id) {
  await toggleAvailability(id);
  carregarMenuAdmin(); // Atualiza a lista para refletir a mudança
};

// --- FUNÇÕES GLOBAIS DE CHAT ---
window.carregarListaConversas = async function () {
  const lista = await fetchAdminConversations();
  const container = document.getElementById("chat-users-list");

  container.innerHTML = lista
    .map(
      (u) => `
        <div class="chat-user-item ${
          chatUserIdAtivo === u.user_id ? "active" : ""
        }" onclick="selecionarChat(${u.user_id}, '${u.user_name}')">
            <div class="user-avatar-small">${u.user_name.charAt(0)}</div>
            <div>
                <div style="font-weight:bold; color:#fff">${u.user_name}</div>
                <div style="font-size:0.8rem; color:#888">Última: ${new Date(
                  u.last_interaction
                )
                  .toLocaleTimeString()
                  .slice(0, 5)}</div>
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
  carregarListaConversas(); // Para atualizar o destaque 'active'
};

async function carregarChatAtivo(userId) {
  const msgs = await fetchAdminUserHistory(userId);
  const container = document.getElementById("admin-chat-messages");

  container.innerHTML = msgs
    .map((m) => {
      const classe = m.is_from_admin ? "msg-admin" : "msg-user"; // Admin é Gold, User é Cinza
      return `<div class="msg ${classe}">${m.message}</div>`;
    })
    .join("");

  // Auto Scroll apenas se for a primeira carga ou se estiver perto do fim
  // container.scrollTop = container.scrollHeight;
}

window.enviarRespostaAdmin = async function () {
  const inp = document.getElementById("admin-chat-input");
  const txt = inp.value.trim();
  if (!txt || !chatUserIdAtivo) return;

  const ok = await sendAdminReply(chatUserIdAtivo, txt);
  if (ok) {
    inp.value = "";
    carregarChatAtivo(chatUserIdAtivo);
  } else {
    alert("Erro ao enviar.");
  }
};

window.handleAdminChatKey = function (e) {
  if (e.key === "Enter") enviarRespostaAdmin();
};
