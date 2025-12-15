// site/js/api.js

import { showToast } from "./main.js";
// import { getToken } from "./auth.js"; // Não é mais necessário ler o token manualmente

// Configuração Dinâmica de Ambiente
const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

export const API_BASE_URL = isLocalhost
  ? `http://${window.location.hostname}:5000/api`
  : "https://cegonha-lanches-backend.onrender.com/api";

// --- HELPER CENTRALIZADO (O "Pulo do Gato") ---
// Substitui o fetch padrão para garantir envio de Cookies e Headers
async function fetchAuth(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem("auth_token");

  // Configuração padrão
  const defaultHeaders = {
    "Content-Type": "application/json",
  };
  if (token) {
    defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: "include", // <--- ESSENCIAL: Envia o Cookie HttpOnly
  };

  const response = await fetch(url, config);
  return response;
}

// Traduz o produto do Backend para o formato do Frontend
function adaptarProduto(produtoBack) {
  let detalhes = {};
  if (typeof produtoBack.details_json === "string") {
    try {
      detalhes = JSON.parse(produtoBack.details_json);
    } catch (e) {
      detalhes = {};
    }
  } else if (produtoBack.details) {
    detalhes = produtoBack.details;
  }

  return {
    id: produtoBack.id,
    name: produtoBack.name,
    description: produtoBack.description,
    price: parseFloat(produtoBack.price),
    image: produtoBack.image_url || "assets/burger_classic.png",
    carnes: detalhes.carnes || [],
    adicionais: detalhes.adicionais || [],
    acompanhamentos: detalhes.acompanhamentos || [],
    bebidas: detalhes.bebidas || [],
    details: detalhes,
  };
}

// --- CARDÁPIO (Rotas Públicas) ---
export const fetchMenu = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/menu/lanches`);
    if (!response.ok) throw new Error("Erro na API");
    const dados = await response.json();
    return dados.map(adaptarProduto);
  } catch (error) {
    console.error("Erro Menu:", error);
    return [];
  }
};

export const fetchCombos = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/menu/combos`);
    if (!response.ok) throw new Error("Erro na API");
    const dados = await response.json();
    return dados.map(adaptarProduto);
  } catch (error) {
    console.error("Erro Combos:", error);
    return [];
  }
};

export const fetchBebidas = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/menu/bebidas`);
    if (!response.ok) throw new Error("Erro na API");
    const dados = await response.json();
    return dados.map(adaptarProduto);
  } catch (error) {
    console.error("Erro Bebidas:", error);
    return [];
  }
};

// --- PEDIDOS ---
export async function submitOrder(frontData, abrirWhatsapp = true) {
  const itemsFormatados = frontData.cartItems.map((item) => ({
    product_id: item.productId || item.id,
    quantity: item.quantity,
    customizations: {
      carnes: extrairNomes(item.details?.carnes),
      adicionais: extrairNomes(item.details?.adicionais),
      acompanhamentos: extrairNomes(item.details?.acompanhamentos),
      bebidas: extrairNomes(item.details?.bebidas),
      obs: item.details?.obs || "",
    },
  }));

  const payload = {
    customer: {
      name: frontData.name,
      phone: frontData.phone,
      address: {
        street: frontData.address,
        number: frontData.number,
        neighborhood: frontData.bairro,
        complement: frontData.comp,
      },
    },
    items: itemsFormatados,
    payment_method: frontData.payment_method,
    coupon_code: frontData.coupon_code,
  };

  try {
    // [REFATORADO] Usa fetchAuth
    const response = await fetchAuth("/orders/create", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      showToast("Sua sessão expirou. Faça login novamente.", "warning");
      import("./auth.js").then((module) => module.logout());
      return { success: false, error: "Sessão expirada" };
    }

    const dados = await response.json();

    if (!response.ok) {
      throw new Error(dados.error || "Falha ao salvar pedido");
    }

    if (abrirWhatsapp) {
      enviarWhatsApp(frontData, dados.id);
    }

    return {
      success: true,
      orderId: dados.id,
      redirectUrl: dados.redirect_url,
    };
  } catch (error) {
    console.error("Erro Envio:", error);
    return { success: false, error: error.message };
  }
}

// --- AUTENTICAÇÃO ---
export async function loginUser(email, password) {
  try {
    const response = await fetchAuth("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Erro ao entrar");

    return { success: true, token: data.token, user: data.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function registerUser(userData) {
  try {
    const response = await fetchAuth("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Erro ao cadastrar");

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateUserProfile(userData) {
  try {
    const response = await fetchAuth("/auth/update", {
      method: "PUT",
      body: JSON.stringify(userData),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Erro ao atualizar");

    return { success: true, user: data.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// --- ENDEREÇOS ---
export async function fetchAddresses() {
  try {
    const res = await fetchAuth("/address");
    if (!res.ok) throw new Error();
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function addAddress(addrData) {
  try {
    const res = await fetchAuth("/address", {
      method: "POST",
      body: JSON.stringify(addrData),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function setActiveAddress(id) {
  try {
    await fetchAuth(`/address/${id}/active`, { method: "PATCH" });
    return true;
  } catch (e) {
    return false;
  }
}

export async function deleteAddress(id) {
  try {
    await fetchAuth(`/address/${id}`, { method: "DELETE" });
    return true;
  } catch (e) {
    return false;
  }
}

// --- MEUS PEDIDOS ---
export async function fetchMyOrders() {
  try {
    const response = await fetchAuth("/orders/me");
    if (!response.ok) throw new Error("Erro ao buscar pedidos");
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

// --- CHAT ---
export async function getChatMessages() {
  try {
    const res = await fetchAuth("/chat");
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function sendChatMessage(text) {
  try {
    const res = await fetchAuth("/chat", {
      method: "POST",
      body: JSON.stringify({ message: text }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// --- PAINEL ADMIN ---
export async function fetchAdminMenu() {
  try {
    const response = await fetchAuth("/menu/admin");
    if (!response.ok) throw new Error("Erro ao buscar menu admin");
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function toggleAvailability(id) {
  try {
    const response = await fetchAuth(`/menu/${id}/toggle`, { method: "PATCH" });
    return response.ok;
  } catch (error) {
    return false;
  }
}

export async function updateOrderStatus(id, status) {
  try {
    const response = await fetchAuth(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

export async function fetchAdminConversations() {
  try {
    const res = await fetchAuth("/chat/admin/conversations");
    return res.ok ? await res.json() : [];
  } catch (e) {
    return [];
  }
}

export async function fetchAdminUserHistory(userId) {
  try {
    const res = await fetchAuth(`/chat/admin/history/${userId}`);
    return res.ok ? await res.json() : [];
  } catch (e) {
    return [];
  }
}

export async function sendAdminReply(userId, text) {
  try {
    const res = await fetchAuth("/chat/admin/reply", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, message: text }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// --- ADMIN: PRODUTOS (Upload de Imagem) ---
// NOTA: Upload NÃO usa fetchAuth pois não pode ter Content-Type: application/json
export async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      body: formData,
      credentials: "include", // Manual aqui
    });

    if (!res.ok) throw new Error("Erro no upload");
    const data = await res.json();
    return data.url;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function createProduct(productData) {
  try {
    const res = await fetchAuth("/menu", {
      method: "POST",
      body: JSON.stringify(productData),
    });
    return res.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export async function updateProduct(id, productData) {
  try {
    const res = await fetchAuth(`/menu/${id}`, {
      method: "PUT",
      body: JSON.stringify(productData),
    });
    return res.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export async function deleteProduct(id, password) {
  try {
    const res = await fetchAuth(`/menu/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ password: password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao deletar");
    }
    return true;
  } catch (e) {
    console.error(e);
    return { error: e.message };
  }
}

// --- CONFIG: CUPONS & USERS ---
export async function fetchCoupons() {
  try {
    const res = await fetchAuth("/config/coupons");
    return res.ok ? await res.json() : [];
  } catch (e) {
    return [];
  }
}

export async function createCoupon(data) {
  try {
    const res = await fetchAuth("/config/coupons", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function deleteCoupon(id) {
  try {
    const res = await fetchAuth(`/config/coupons/${id}`, { method: "DELETE" });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function fetchUsersList() {
  try {
    const res = await fetchAuth("/config/users");
    return res.ok ? await res.json() : [];
  } catch (e) {
    return [];
  }
}

export async function fetchPublicCoupons() {
  try {
    // Rota pública, mas fetchAuth não atrapalha
    const res = await fetch(`${API_BASE_URL}/config/coupons/public`);
    return res.ok ? await res.json() : [];
  } catch (e) {
    console.error("Erro ao buscar cupons:", e);
    return [];
  }
}

export async function fetchCloudGallery() {
  try {
    const res = await fetchAuth("/upload/gallery");
    if (!res.ok) throw new Error("Erro ao buscar galeria");
    return await res.json();
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function deleteCloudImage(publicId) {
  try {
    const res = await fetchAuth("/upload/gallery", {
      method: "DELETE",
      body: JSON.stringify({ public_id: publicId }),
    });
    return res.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

// --- DELIVERY ---
export async function fetchNeighborhoodsAdmin() {
  const res = await fetchAuth("/delivery/admin");
  return res.ok ? await res.json() : [];
}

export async function fetchNeighborhoodsPublic() {
  try {
    const res = await fetch(`${API_BASE_URL}/delivery`);
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

export async function addNeighborhood(data) {
  const res = await fetchAuth("/delivery", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.ok;
}

export async function deleteNeighborhood(id) {
  const res = await fetchAuth(`/delivery/${id}`, { method: "DELETE" });
  return res.ok;
}

// --- SCHEDULE ---
export async function fetchSchedule() {
  try {
    const res = await fetch(`${API_BASE_URL}/config/schedule`);
    return res.ok ? await res.json() : [];
  } catch (e) {
    return [];
  }
}

export async function updateSchedule(data) {
  try {
    const res = await fetchAuth("/config/schedule", {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// --- REPORTS ---
export async function fetchDashboardStats(filtros = {}) {
  try {
    const params = new URLSearchParams(filtros).toString();
    const res = await fetchAuth(`/reports/dashboard?${params}`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function fetchOrderDossier(id) {
  try {
    const res = await fetchAuth(`/reports/dossier/${id}`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function fetchAdminOrders(filtros = {}) {
  try {
    const params = new URLSearchParams(filtros).toString();
    const response = await fetchAuth(`/orders/admin?${params}`);

    if (!response.ok) throw new Error("Erro ao buscar pedidos");
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

// --- UTILITÁRIOS ---
function extrairNomes(lista) {
  if (!lista) return [];
  return lista.map((i) => (typeof i === "string" ? i : i.nome));
}

function enviarWhatsApp(data, id) {
  const tel = "5534996537883";
  const texto =
    `*NOVO PEDIDO #${id}*\n` +
    `----------------------------------\n` +
    `👤 *${data.name}*\n` +
    `📱 ${data.phone}\n` +
    `📍 ${data.address}, ${data.number}\n` +
    (data.bairro ? `🏘️ ${data.bairro}\n` : "") +
    (data.comp ? `📌 ${data.comp}\n` : "") +
    `----------------------------------\n` +
    `🛒 *RESUMO:*\n${data.resumoCarrinho}\n` +
    `----------------------------------\n` +
    `💰 *TOTAL: R$ ${data.total.toFixed(2)}*\n\n` +
    `📝 *Obs:* ${data.message}`;

  const url = `https://api.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(
    texto
  )}`;
  window.open(url, "_blank");
}

export async function fetchCurrentUser() {
  try {
    // Note que não precisamos enviar token manual, o navegador envia o cookie
    // graças ao credentials: 'include' dentro do fetchAuth
    const response = await fetchAuth("/auth/me");

    if (response.status === 401 || response.status === 403) {
      return null; // Não está logado (ou cookie expirou)
    }

    if (!response.ok) throw new Error("Erro ao buscar sessão");

    return await response.json(); // Retorna { id, name, role, ... }
  } catch (error) {
    console.warn("Sessão inválida ou erro de rede:", error);
    return null;
  }
}
