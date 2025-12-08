// site/js/api.js

import { getToken } from "./auth.js";

// [CORREÇÃO 1] Configuração Dinâmica de Ambiente
// Detecta se o site está rodando localmente ou em produção
const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

// Se for localhost, usa a porta 5000. Se for produção (Vercel/Render), usa a URL do seu backend online.
const API_BASE_URL = isLocalhost
  ? "http://localhost:5000/api"
  : "https://seu-backend-no-render.com/api";

// --- HELPERS ---
function getAuthHeader() {
  // Pega do cookie agora
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
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

    // AQUI ESTÁ A CORREÇÃO MÁGICA:
    // Convertemos o preço (que vem como String do banco Numeric) para Float
    price: parseFloat(produtoBack.price),

    image: produtoBack.image_url || "assets/burger_classic.png",
    carnes: detalhes.carnes || [],
    adicionais: detalhes.adicionais || [],
    acompanhamentos: detalhes.acompanhamentos || [],
    bebidas: detalhes.bebidas || [],
    details: detalhes,
  };
}

// --- CARDÁPIO ---
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

// --- PEDIDOS ---
// site/js/api.js

export async function submitOrder(frontData, abrirWhatsapp = true) {
  // Traduz o carrinho visual para IDs
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
    const headers = {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    };

    const response = await fetch(`${API_BASE_URL}/orders/create`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });

    // CORREÇÃO: Lemos o JSON apenas UMA vez aqui
    const dados = await response.json();

    if (!response.ok) {
      throw new Error(dados.error || "Falha ao salvar pedido");
    }

    // Se sucesso:
    if (abrirWhatsapp) {
      enviarWhatsApp(frontData, dados.id);
    }

    return {
      success: true,
      orderId: dados.id,
      redirectUrl: dados.redirect_url, // Link do Mercado Pago
    };
  } catch (error) {
    console.error("Erro Envio:", error);
    return { success: false, error: error.message };
  }
}

// --- AUTENTICAÇÃO ---
export async function loginUser(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Erro ao cadastrar");

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
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
// site/js/api.js

// ... (outras funções: fetchMenu, loginUser...) ...

export async function updateUserProfile(userData) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/update`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(), // Usa o token salvo
      },
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
    const res = await fetch(`${API_BASE_URL}/address`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error();
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function addAddress(addrData) {
  try {
    const res = await fetch(`${API_BASE_URL}/address`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(addrData),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function setActiveAddress(id) {
  try {
    await fetch(`${API_BASE_URL}/address/${id}/active`, {
      method: "PATCH",
      headers: getAuthHeader(),
    });
    return true;
  } catch (e) {
    return false;
  }
}

export async function deleteAddress(id) {
  try {
    await fetch(`${API_BASE_URL}/address/${id}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });
    return true;
  } catch (e) {
    return false;
  }
}
// site/js/api.js

// ... (outras funções: loginUser, registerUser, etc) ...

export async function fetchMyOrders() {
  try {
    const response = await fetch(`${API_BASE_URL}/orders/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
    });

    if (!response.ok) throw new Error("Erro ao buscar pedidos");
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}
// ... (código anterior) ...

// --- CHAT ---
export async function getChatMessages() {
  try {
    const res = await fetch(`${API_BASE_URL}/chat`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function sendChatMessage(text) {
  try {
    const res = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ message: text }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// --- FUNÇÕES DO PAINEL ADMIN ---

export async function fetchAdminMenu() {
  try {
    const response = await fetch(`${API_BASE_URL}/menu/admin`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error("Erro ao buscar menu admin");
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function toggleAvailability(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/menu/${id}/toggle`, {
      method: "PATCH",
      headers: getAuthHeader(),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

export async function updateOrderStatus(id, status) {
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ status }),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// ... (código anterior) ...

// --- CHAT ADMIN ---
export async function fetchAdminConversations() {
  try {
    const res = await fetch(`${API_BASE_URL}/chat/admin/conversations`, {
      headers: getAuthHeader(),
    });
    return res.ok ? await res.json() : [];
  } catch (e) {
    return [];
  }
}

export async function fetchAdminUserHistory(userId) {
  try {
    const res = await fetch(`${API_BASE_URL}/chat/admin/history/${userId}`, {
      headers: getAuthHeader(),
    });
    return res.ok ? await res.json() : [];
  } catch (e) {
    return [];
  }
}

export async function sendAdminReply(userId, text) {
  try {
    const res = await fetch(`${API_BASE_URL}/chat/admin/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ user_id: userId, message: text }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// ... (outras funções) ...

// --- ADMIN: PRODUTOS ---

export async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      headers: getAuthHeader(), // NÃO coloque Content-Type aqui, o navegador põe automático para FormData
      body: formData,
    });

    if (!res.ok) throw new Error("Erro no upload");
    const data = await res.json();
    return data.url; // Retorna a URL da imagem salva
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function createProduct(productData) {
  try {
    const res = await fetch(`${API_BASE_URL}/menu`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(productData),
    });
    return res.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

// ... (código anterior) ...

export async function updateProduct(id, productData) {
  try {
    const res = await fetch(`${API_BASE_URL}/menu/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
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
    const res = await fetch(`${API_BASE_URL}/menu/${id}`, {
      method: "DELETE",
      // Agora o DELETE tem corpo (body) com a senha
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ password: password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao deletar");
    }
    return true;
  } catch (e) {
    console.error(e);
    // Retorna o erro para o admin.js mostrar no alert
    return { error: e.message };
  }
}

// --- CONFIG: CUPONS & USERS ---
export async function fetchCoupons() {
  try {
    const res = await fetch(`${API_BASE_URL}/config/coupons`, {
      headers: getAuthHeader(),
    });
    return res.ok ? await res.json() : [];
  } catch (e) {
    return [];
  }
}

export async function createCoupon(data) {
  try {
    const res = await fetch(`${API_BASE_URL}/config/coupons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function deleteCoupon(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/config/coupons/${id}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function fetchUsersList() {
  try {
    const res = await fetch(`${API_BASE_URL}/config/users`, {
      headers: getAuthHeader(),
    });
    return res.ok ? await res.json() : [];
  } catch (e) {
    return [];
  }
}

// site/js/api.js

// ... (outras funções) ...

export async function fetchPublicCoupons() {
  try {
    const res = await fetch(`${API_BASE_URL}/config/coupons/public`);
    return res.ok ? await res.json() : [];
  } catch (e) {
    console.error("Erro ao buscar cupons:", e);
    return [];
  }
}
// site/js/api.js

// ... (código existente) ...

export async function fetchCloudGallery() {
  try {
    const res = await fetch(`${API_BASE_URL}/upload/gallery`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error("Erro ao buscar galeria");
    return await res.json();
  } catch (e) {
    console.error(e);
    return [];
  }
}

// Adicione no final do api.js

export async function deleteCloudImage(publicId) {
  try {
    const res = await fetch(`${API_BASE_URL}/upload/gallery`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
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
  const res = await fetch(`${API_BASE_URL}/delivery/admin`, {
    headers: getAuthHeader(),
  });
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
  const res = await fetch(`${API_BASE_URL}/delivery`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: JSON.stringify(data),
  });
  return res.ok;
}

export async function deleteNeighborhood(id) {
  const res = await fetch(`${API_BASE_URL}/delivery/${id}`, {
    method: "DELETE",
    headers: getAuthHeader(),
  });
  return res.ok;
}

// js/api.js

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
    const res = await fetch(`${API_BASE_URL}/config/schedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// js/api.js

export async function fetchDashboardStats(filtros = {}) {
  try {
    const params = new URLSearchParams(filtros).toString();
    const res = await fetch(`${API_BASE_URL}/reports/dashboard?${params}`, {
      headers: getAuthHeader(),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function fetchOrderDossier(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/reports/dossier/${id}`, {
      headers: getAuthHeader(),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// js/api.js

export async function fetchAdminOrders(filtros = {}) {
  try {
    // Converte objeto { nome: 'joao' } em string "?nome=joao"
    const params = new URLSearchParams(filtros).toString();

    const response = await fetch(`${API_BASE_URL}/orders/admin?${params}`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) throw new Error("Erro ao buscar pedidos");
    return await response.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}
