const menuToggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('#menu');

if (menuToggle && menu) {
  menuToggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menu.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (event) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});






// Carrinho de pedidos com localStorage, variações obrigatórias e envio para WhatsApp
(() => {
  const STORAGE_KEY = "praticita_cart";
  const WHATSAPP_NUMBER = "554999916511";

  const readCart = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeCart = (cart) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    renderCart();
  };

  const findVariationSelect = (button) => {
    const card = button.closest(".product-card, .menu-item");
    return card ? card.querySelector("[data-variation-select]") : null;
  };

  const clearVariationWarning = (select) => {
    if (!select) return;
    select.classList.remove("is-invalid");
    const field = select.closest(".variation-field");
    const warning = field?.parentElement?.querySelector(".variation-warning");
    if (warning) warning.remove();
  };

  const showVariationWarning = (select) => {
    if (!select) return;
    clearVariationWarning(select);
    select.classList.add("is-invalid");
    const field = select.closest(".variation-field");
    const warning = document.createElement("span");
    warning.className = "variation-warning";
    warning.textContent = "Selecione o tamanho/opção antes de adicionar.";
    field.insertAdjacentElement("afterend", warning);
    select.focus();
  };

  const normalizeItem = (button) => {
    const requiresVariation = button.dataset.requiresVariation === "true";
    const select = findVariationSelect(button);
    let variation = "";
    let price = button.dataset.price || "Consultar";

    if (requiresVariation) {
      if (!select || !select.value) {
        showVariationWarning(select);
        return null;
      }
      const selectedOption = select.options[select.selectedIndex];
      variation = select.value;
      price = selectedOption?.dataset.price || price;
      clearVariationWarning(select);
    }

    const baseName = button.dataset.name || "Produto";
    const name = variation ? `${baseName} — ${variation}` : baseName;
    const source = button.dataset.source || "Site";
    const baseId = button.dataset.id || baseName.toLowerCase().replace(/\s+/g, "-");
    const id = variation ? `${baseId}-${variation.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}` : baseId;

    return { id, baseId, name, variation, price, source, quantity: 1 };
  };

  const getElements = () => ({
    drawer: document.querySelector(".cart-drawer"),
    backdrop: document.querySelector(".cart-backdrop"),
    items: document.querySelector("[data-cart-items]"),
    empty: document.querySelector("[data-cart-empty]"),
    countEls: document.querySelectorAll("[data-cart-count]"),
    totalItems: document.querySelector("[data-cart-total-items]"),
    checkout: document.querySelector("[data-cart-checkout]")
  });

  const totalQuantity = (cart) => cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const openCart = () => {
    const { drawer, backdrop } = getElements();
    if (!drawer) return;
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    if (backdrop) backdrop.hidden = false;
  };

  const closeCart = () => {
    const { drawer, backdrop } = getElements();
    if (!drawer) return;
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    if (backdrop) backdrop.hidden = true;
  };

  const addItem = (item) => {
    if (!item) return;
    const cart = readCart();
    const existing = cart.find((cartItem) => cartItem.id === item.id && cartItem.price === item.price);
    if (existing) {
      existing.quantity = Number(existing.quantity || 1) + 1;
    } else {
      cart.push(item);
    }
    writeCart(cart);
    openCart();
  };

  const changeQuantity = (id, price, delta) => {
    const cart = readCart();
    const item = cart.find((cartItem) => cartItem.id === id && cartItem.price === price);
    if (!item) return;
    item.quantity = Math.max(1, Number(item.quantity || 1) + delta);
    writeCart(cart);
  };

  const removeItem = (id, price) => {
    const cart = readCart().filter((item) => !(item.id === id && item.price === price));
    writeCart(cart);
  };

  const clearCart = () => writeCart([]);

  const buildWhatsAppMessage = (cart) => {
    const lines = [
      "Olá, vim pelo site da Praticità e quero finalizar este pedido:",
      ""
    ];

    cart.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.name}`);
      if (item.variation) lines.push(`   Opção: ${item.variation}`);
      lines.push(`   Quantidade: ${item.quantity}`);
      lines.push(`   Valor/info: ${item.price}`);
      lines.push(`   Origem: ${item.source || "Site"}`);
      lines.push("");
    });

    lines.push("Dados para confirmar:");
    lines.push("- Nome:");
    lines.push("- Data desejada:");
    lines.push("- Retirada ou entrega:");
    lines.push("- Observações:");

    return lines.join("\n");
  };

  const checkout = () => {
    const cart = readCart();
    if (!cart.length) return;
    const message = encodeURIComponent(buildWhatsAppMessage(cart));
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
    window.open(url, "_blank", "noopener");
  };

  function renderCart() {
    const { items, empty, countEls, totalItems, checkout } = getElements();
    const cart = readCart();
    const total = totalQuantity(cart);

    countEls.forEach((el) => el.textContent = String(total));
    if (totalItems) totalItems.textContent = String(total);
    if (checkout) checkout.disabled = total === 0;

    if (!items) return;

    items.innerHTML = "";
    if (!cart.length) {
      if (empty) empty.classList.add("show");
      return;
    }

    if (empty) empty.classList.remove("show");

    cart.forEach((item) => {
      const article = document.createElement("article");
      article.className = "cart-item";
      article.innerHTML = `
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.price)}</p>
        <p>${escapeHtml(item.source || "Site")}</p>
        <div class="cart-item-actions">
          <div class="cart-qty" aria-label="Quantidade">
            <button type="button" data-cart-decrease data-id="${escapeAttr(item.id)}" data-price="${escapeAttr(item.price)}">−</button>
            <span>${item.quantity}</span>
            <button type="button" data-cart-increase data-id="${escapeAttr(item.id)}" data-price="${escapeAttr(item.price)}">+</button>
          </div>
          <button class="cart-remove" type="button" data-cart-remove data-id="${escapeAttr(item.id)}" data-price="${escapeAttr(item.price)}">Remover</button>
        </div>
      `;
      items.appendChild(article);
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  document.addEventListener("change", (event) => {
    const select = event.target.closest("[data-variation-select]");
    if (select && select.value) clearVariationWarning(select);
  });

  document.addEventListener("click", (event) => {
    const addButton = event.target.closest(".add-to-cart");
    if (addButton) {
      addItem(normalizeItem(addButton));
      return;
    }

    if (event.target.closest("[data-cart-open]")) {
      openCart();
      return;
    }

    if (event.target.closest("[data-cart-close]")) {
      closeCart();
      return;
    }

    const increase = event.target.closest("[data-cart-increase]");
    if (increase) {
      changeQuantity(increase.dataset.id, increase.dataset.price, 1);
      return;
    }

    const decrease = event.target.closest("[data-cart-decrease]");
    if (decrease) {
      changeQuantity(decrease.dataset.id, decrease.dataset.price, -1);
      return;
    }

    const remove = event.target.closest("[data-cart-remove]");
    if (remove) {
      removeItem(remove.dataset.id, remove.dataset.price);
      return;
    }

    if (event.target.closest("[data-cart-clear]")) {
      clearCart();
      return;
    }

    if (event.target.closest("[data-cart-checkout]")) {
      checkout();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCart();
  });

  renderCart();
})();
