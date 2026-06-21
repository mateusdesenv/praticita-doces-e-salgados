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

document.addEventListener('click', (event) => {
  const anchor = event.target.closest('a[href^="#"]');
  if (!anchor) return;

  const href = anchor.getAttribute('href');
  if (!href || href === '#') return;

  const target = document.querySelector(href);
  if (!target) return;

  event.preventDefault();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// Integração do cardápio público com a API Node/MongoDB.
(() => {
  const MENU_ENDPOINT = '/menu-data';
  const REQUEST_TIMEOUT_MS = 12000;

  const dom = {
    menuContent: document.querySelector('[data-menu-content]'),
    menuNav: document.querySelector('[data-menu-category-nav]'),
    menuStatus: document.querySelector('[data-menu-status]'),
    menuSearch: document.querySelector('[data-menu-search]'),
    menuSummary: document.querySelector('[data-menu-summary]'),
    featuredProducts: document.querySelector('[data-featured-products]')
  };

  if (!dom.menuContent && !dom.featuredProducts) return;

  const moneyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

  const availabilityLabels = {
    available: 'Disponível',
    unavailable: 'Indisponível',
    on_request: 'Sob encomenda',
    quote: 'Sob orçamento'
  };

  const priceTypeFallbackUnit = {
    unit: 'unidade',
    hundred: 'cento',
    kg: 'kg',
    package: 'pacote'
  };

  const featuredSlots = [
    {
      productId: 'prod-bolo-red-velvet',
      title: 'Bolo Red Velvet Recheado',
      image: 'assets/bolo-red-velvt-recheado.webp',
      alt: 'Bolo Red Velvet Recheado'
    },
    {
      productId: 'prod-torta-red-velvet',
      image: 'assets/torta-red-velvt.webp',
      alt: 'Torta Red Velvet'
    },
    {
      productId: 'prod-torta-morango',
      image: 'assets/torta-de-morango.webp',
      alt: 'Torta de Morango'
    },
    {
      productId: 'prod-bolo-red-velvet',
      image: 'assets/bolo-red-velvt.webp',
      alt: 'Bolo Red Velvet'
    }
  ];

  let menuData = null;
  let searchTerm = '';

  function resolveApiBaseUrl() {
    return 'https://praticita-api.vercel.app/api';
    // const configured = String(window.PRATICITA_API_BASE_URL || '').trim();
    // if (configured) return configured.replace(/\/+$/, '');

    // const isLocal = ['localhost', '127.0.0.1', '0.0.0.0', ''].includes(window.location.hostname);
    // if (isLocal || window.location.protocol === 'file:') {
    //   return 'https://praticita-api.vercel.app/api';
    // }

    // return `${window.location.origin.replace(/\/+$/, '')}/api`;
  }

  function buildUrl(path) {
    return `${resolveApiBaseUrl()}${path}`;
  }

  async function fetchJsonWithTimeout(url) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  function setStatus(message, type = 'info') {
    if (!dom.menuStatus) return;
    dom.menuStatus.textContent = message;
    dom.menuStatus.dataset.state = type;
    dom.menuStatus.hidden = !message;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  function normalizeSearch(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function sortByDisplayOrder(items) {
    return [...items].sort((a, b) => {
      const orderA = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : 9999;
      const orderB = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : 9999;
      if (orderA !== orderB) return orderA - orderB;
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
  }

  function activeItems(items) {
    return Array.isArray(items) ? items.filter((item) => item?.isActive !== false) : [];
  }

  function formatMoney(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 'Sob consulta';
    return moneyFormatter.format(number);
  }

  function uniqueParts(parts) {
    const seen = new Set();
    return parts
      .map((part) => String(part ?? '').trim())
      .filter(Boolean)
      .filter((part) => {
        const key = normalizeSearch(part);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function variationLabel(variation) {
    return uniqueParts([
      variation.name,
      variation.sizeLabel,
      variation.weightLabel,
      variation.servesLabel,
      variation.unitLabel
    ]).join(' · ') || 'Opção';
  }

  function variationPriceLabel(variation) {
    const base = formatMoney(variation.price);
    return variation.unitLabel ? `${base} / ${variation.unitLabel}` : base;
  }

  function getVariations(productId) {
    return sortByDisplayOrder(activeItems(menuData?.variations).filter((variation) => variation.productId === productId));
  }

  function getOptionGroups(productId) {
    return sortByDisplayOrder(activeItems(menuData?.optionGroups).filter((group) => group.productId === productId));
  }

  function getOptions(groupId) {
    return sortByDisplayOrder(activeItems(menuData?.productOptions).filter((option) => option.optionGroupId === groupId));
  }

  function getProductsByCategory(categoryId) {
    return sortByDisplayOrder(activeItems(menuData?.products).filter((product) => product.categoryId === categoryId));
  }

  function getProductSearchHaystack(product) {
    const category = activeItems(menuData?.categories).find((item) => item.id === product.categoryId);
    const variations = getVariations(product.id).map(variationLabel).join(' ');
    const optionText = getOptionGroups(product.id)
      .map((group) => `${group.name} ${getOptions(group.id).map((option) => option.name).join(' ')}`)
      .join(' ');

    return normalizeSearch([
      product.name,
      product.slug,
      product.shortDescription,
      product.fullDescription,
      product.pricingNote,
      product.availabilityNote,
      category?.name,
      variations,
      optionText
    ].join(' '));
  }

  function productMatchesSearch(product) {
    if (!searchTerm) return true;
    return getProductSearchHaystack(product).includes(searchTerm);
  }

  function productPriceLabel(product, variations = getVariations(product.id)) {
    if (product.priceType === 'quote' || product.availabilityStatus === 'quote') return 'Sob orçamento';

    if (product.priceType === 'variation') {
      const prices = variations
        .map((variation) => Number(variation.price))
        .filter((price) => Number.isFinite(price));

      if (!prices.length) return 'Sob consulta';
      return `a partir de ${formatMoney(Math.min(...prices))}`;
    }

    if (Number.isFinite(Number(product.basePrice))) {
      const unit = product.unitLabel || priceTypeFallbackUnit[product.priceType] || '';
      return `${formatMoney(product.basePrice)}${unit ? ` / ${unit}` : ''}`;
    }

    return 'Sob consulta';
  }

  function productMeta(product) {
    const meta = [];
    if (Number.isFinite(Number(product.preparationDays)) && Number(product.preparationDays) > 0) {
      meta.push(`${Number(product.preparationDays)} dias de antecedência`);
    }
    if (Number.isFinite(Number(product.minQuantity)) && Number(product.minQuantity) > 0) {
      meta.push(`mín. ${Number(product.minQuantity)}`);
    }
    if (product.availabilityNote) meta.push(product.availabilityNote);
    if (product.pricingNote) meta.push(product.pricingNote);
    return meta.join(' • ');
  }

  function htmlTextParagraph(value, className) {
    if (!value) return '';
    return `<p class="${className}">${escapeHtml(value).replace(/\n/g, '<br>')}</p>`;
  }

  function renderVariationSelect(product, variations) {
    if (product.priceType !== 'variation' || !variations.length) return '';

    const options = variations.map((variation) => {
      const label = variationLabel(variation);
      const price = variationPriceLabel(variation);
      return `<option value="${escapeAttr(label)}" data-price="${escapeAttr(price)}">${escapeHtml(label)} — ${escapeHtml(price)}</option>`;
    }).join('');

    return `
      <label class="variation-field">
        <span>Tamanho/opção</span>
        <select class="product-variation-select" data-variation-select>
          <option value="">Selecione o tamanho/opção</option>
          ${options}
        </select>
      </label>
    `;
  }

  function renderVariationList(product, variations) {
    if (product.priceType !== 'variation' || !variations.length) return '';

    return `
      <ul class="variation-list">
        ${variations.map((variation) => `
          <li><span>${escapeHtml(variationLabel(variation))}</span><strong>${escapeHtml(variationPriceLabel(variation))}</strong></li>
        `).join('')}
      </ul>
    `;
  }

  function renderOptionGroups(product) {
    const groups = getOptionGroups(product.id);
    if (!groups.length) return '';

    return groups.map((group) => {
      const options = getOptions(group.id);
      if (!options.length) return '';
      return `
        <div class="menu-option-group">
          <strong>${escapeHtml(group.name)}</strong>
          <span>${escapeHtml(options.map((option) => option.name).join(', '))}</span>
        </div>
      `;
    }).join('');
  }

  function renderProductArticle(product, source = 'Cardápio') {
    const variations = getVariations(product.id);
    const priceLabel = productPriceLabel(product, variations);
    const requiresVariation = product.priceType === 'variation' && variations.length > 0;
    const isUnavailable = product.availabilityStatus === 'unavailable';
    const meta = productMeta(product);

    return `
      <article class="menu-item">
        <div class="menu-item-head">
          <h3>${escapeHtml(product.name)}</h3>
          <span>${escapeHtml(availabilityLabels[product.availabilityStatus] || 'Disponível')}</span>
        </div>
        ${htmlTextParagraph(product.shortDescription, 'menu-desc')}
        ${htmlTextParagraph(product.fullDescription, 'menu-full')}
        <div class="menu-price">${escapeHtml(priceLabel)}</div>
        ${renderVariationSelect(product, variations)}
        ${renderVariationList(product, variations)}
        ${renderOptionGroups(product)}
        ${meta ? `<p class="menu-meta">${escapeHtml(meta)}</p>` : ''}
        <button class="add-to-cart menu-add-to-cart" type="button"
          data-id="${escapeAttr(product.slug || product.id)}"
          data-product-id="${escapeAttr(product.id)}"
          data-name="${escapeAttr(product.name)}"
          data-price="${escapeAttr(priceLabel)}"
          data-source="${escapeAttr(source)}"
          data-requires-variation="${requiresVariation ? 'true' : 'false'}"
          ${isUnavailable ? 'disabled' : ''}>${requiresVariation ? 'Selecionar e adicionar' : 'Adicionar ao carrinho'}</button>
      </article>
    `;
  }

  function renderCategoryNav(categories) {
    if (!dom.menuNav) return;

    if (!categories.length) {
      dom.menuNav.innerHTML = '<span class="menu-loading-pill">Nenhuma categoria encontrada</span>';
      return;
    }

    dom.menuNav.innerHTML = categories
      .map((category) => `<a href="#${escapeAttr(category.slug)}">${escapeHtml(category.name)}</a>`)
      .join('');
  }

  function renderMenuPage() {
    if (!dom.menuContent || !menuData) return;

    const categories = sortByDisplayOrder(activeItems(menuData.categories));
    const visibleCategories = categories
      .map((category) => ({
        ...category,
        products: getProductsByCategory(category.id).filter(productMatchesSearch)
      }))
      .filter((category) => category.products.length > 0);

    renderCategoryNav(visibleCategories);

    const totalProducts = visibleCategories.reduce((sum, category) => sum + category.products.length, 0);
    if (dom.menuSummary) {
      dom.menuSummary.textContent = searchTerm
        ? `${totalProducts} item(ns) encontrado(s) para “${dom.menuSearch.value.trim()}”.`
        : `${totalProducts} item(ns) carregado(s) da API.`;
    }

    if (!visibleCategories.length) {
      dom.menuContent.innerHTML = `
        <section class="menu-empty-state">
          <h2>Nenhum item encontrado</h2>
          <p>Tente buscar por outro nome, categoria ou ingrediente.</p>
        </section>
      `;
      setStatus('', 'success');
      return;
    }

    dom.menuContent.innerHTML = visibleCategories.map((category) => `
      <section class="menu-category" id="${escapeAttr(category.slug)}">
        <div class="menu-category-heading">
          <h2>${escapeHtml(category.name)}</h2>
          <p>${escapeHtml(category.description || '')}</p>
        </div>
        <div class="menu-list">
          ${category.products.map((product) => renderProductArticle(product)).join('')}
        </div>
      </section>
    `).join('');

    setStatus('', 'success');
  }

  function renderFeaturedProducts() {
    if (!dom.featuredProducts || !menuData) return;

    const products = activeItems(menuData.products);
    const cards = featuredSlots
      .map((slot) => {
        const product = products.find((item) => item.id === slot.productId);
        return product ? { slot, product } : null;
      })
      .filter(Boolean);

    if (!cards.length) {
      dom.featuredProducts.innerHTML = `
        <article class="product-card real-product-card fixed-highlight-card product-card-placeholder">
          <div>
            <h3>Nenhum destaque disponível</h3>
            <p>Cadastre produtos ativos na API para exibir esta seção.</p>
          </div>
        </article>
      `;
      return;
    }

    dom.featuredProducts.innerHTML = cards.map(({ slot, product }) => {
      const variations = getVariations(product.id);
      const priceLabel = productPriceLabel(product, variations);
      const requiresVariation = product.priceType === 'variation' && variations.length > 0;
      const title = slot.title || product.name;

      return `
        <article class="product-card real-product-card fixed-highlight-card">
          <img src="${escapeAttr(slot.image)}" alt="${escapeAttr(slot.alt || title)}" />
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p>Imagem real do cliente</p>
            <strong>${escapeHtml(priceLabel)}</strong>
            ${renderVariationSelect(product, variations).replace('class="product-variation-select"', 'class="product-variation-select compact-variation-select"')}
            <button class="add-to-cart" type="button"
              data-id="${escapeAttr((product.slug || product.id) + '-' + normalizeSearch(title).replace(/[^a-z0-9]+/g, '-'))}"
              data-product-id="${escapeAttr(product.id)}"
              data-name="${escapeAttr(title)}"
              data-price="${escapeAttr(priceLabel)}"
              data-source="Destaques"
              data-requires-variation="${requiresVariation ? 'true' : 'false'}">${requiresVariation ? 'Selecionar e adicionar' : 'Adicionar ao carrinho'}</button>
          </div>
        </article>
      `;
    }).join('');
  }

  function bindSearch() {
    if (!dom.menuSearch) return;
    dom.menuSearch.addEventListener('input', () => {
      searchTerm = normalizeSearch(dom.menuSearch.value);
      renderMenuPage();
    });
  }

  async function initMenuApi() {
    setStatus('Carregando cardápio...', 'loading');
    bindSearch();

    try {
      menuData = await fetchJsonWithTimeout(buildUrl(MENU_ENDPOINT));
      renderFeaturedProducts();
      renderMenuPage();

      if (window.location.hash && dom.menuContent) {
        window.requestAnimationFrame(() => {
          const target = document.querySelector(window.location.hash);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    } catch (error) {
      console.error('Erro ao carregar cardápio da API:', error);

      if (dom.featuredProducts) {
        dom.featuredProducts.innerHTML = `
          <article class="product-card real-product-card fixed-highlight-card product-card-placeholder">
            <div>
              <h3>Não foi possível carregar os destaques</h3>
              <p>Verifique se a API está online e se o domínio foi liberado no CORS.</p>
            </div>
          </article>
        `;
      }

      if (dom.menuContent) {
        dom.menuContent.innerHTML = '';
        if (dom.menuNav) dom.menuNav.innerHTML = '<span class="menu-loading-pill">API indisponível</span>';
        if (dom.menuSummary) dom.menuSummary.textContent = 'Não foi possível carregar os itens.';
        setStatus('Não foi possível carregar o cardápio. Verifique a URL da API em config.js e a configuração de CORS da API.', 'error');
      }
    }
  }

  initMenuApi();
})();



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
