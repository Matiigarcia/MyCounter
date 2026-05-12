// ============================================================
// CuentasClaras — Utilities Module
// ============================================================

const Utils = {
  // ---- Language System ----
  currentLang: localStorage.getItem('cc_lang') || 'es',

  translations: {
    es: {
      appName: 'CuentasClaras',
      dashboard: 'Inicio',
      history: 'Historial',
      reports: 'Reportes',
      cards: 'Tarjetas',
      settings: 'Ajustes',
      income: 'Ingreso',
      expense: 'Gasto',
      balance: 'Balance',
      totalIncome: 'Total Ingresos',
      totalExpenses: 'Total Gastos',
      monthlyBalance: 'Balance Mensual',
      addTransaction: 'Agregar Transacción',
      amount: 'Monto',
      category: 'Categoría',
      description: 'Descripción',
      date: 'Fecha',
      save: 'Guardar',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      edit: 'Editar',
      confirm: 'Confirmar',
      search: 'Buscar...',
      noTransactions: 'No hay transacciones aún',
      addFirst: '¡Agregá tu primer gasto o ingreso!',
      voiceHint: 'Decí algo como: "Gasté 500 en supermercado"',
      listening: 'Escuchando...',
      voiceError: 'No se pudo reconocer la voz',
      saved: '¡Guardado!',
      deleted: '¡Eliminado!',
      monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
      monthShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
      dayNames: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
      today: 'Hoy',
      yesterday: 'Ayer',
      thisWeek: 'Esta semana',
      thisMonth: 'Este mes',
      lastMonth: 'Mes pasado',
      allTime: 'Todo',
      alertExcess: '¡Cuidado! Ya gastaste el {pct}% de tus ingresos del mes',
      alertCategory: 'Estás gastando más de lo normal en {cat}',
      alertBudget: 'Te queda poco presupuesto en {cat}',
      recentTransactions: 'Transacciones Recientes',
      spendingByCategory: 'Gastos por Categoría',
      monthlyTrend: 'Tendencia Mensual',
      creditCards: 'Tarjetas de Crédito',
      installments: 'Cuotas',
      installmentOf: 'Cuota {current} de {total}',
      remainingInstallments: '{n} cuotas restantes',
      nextPayment: 'Próximo pago',
      totalDebt: 'Deuda Total',
      monthlyCardExpense: 'Gasto Mensual Tarjeta',
      addInstallment: 'Agregar compra en cuotas',
      cardName: 'Tarjeta',
      totalAmount: 'Monto Total',
      numberOfInstallments: 'Cantidad de Cuotas',
      productName: 'Producto / Descripción',
      currency: 'Moneda',
      language: 'Idioma',
      theme: 'Tema',
      darkMode: 'Modo Oscuro',
      lightMode: 'Modo Claro',
      monthlyIncome: 'Ingreso Mensual Fijo',
      categories: 'Categorías',
      budgets: 'Presupuestos',
      exportData: 'Exportar Datos',
      importData: 'Importar Datos',
      about: 'Acerca de',
      version: 'Versión',
      premium: 'Premium',
      upgradePremium: 'Mejorar a Premium',
      premiumFeatures: 'Sin publicidad, tarjetas de crédito, reportes avanzados y más',
      free: 'Gratuito',
      good: 'Bien',
      warning: 'Cuidado',
      danger: 'Excedido',
      weekSummary: 'Resumen Semanal',
      vsLastMonth: 'vs mes anterior',
      more: 'más',
      less: 'menos',
    },
    en: {
      appName: 'CuentasClaras',
      dashboard: 'Home',
      history: 'History',
      reports: 'Reports',
      cards: 'Cards',
      settings: 'Settings',
      income: 'Income',
      expense: 'Expense',
      balance: 'Balance',
      totalIncome: 'Total Income',
      totalExpenses: 'Total Expenses',
      monthlyBalance: 'Monthly Balance',
      addTransaction: 'Add Transaction',
      amount: 'Amount',
      category: 'Category',
      description: 'Description',
      date: 'Date',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      confirm: 'Confirm',
      search: 'Search...',
      noTransactions: 'No transactions yet',
      addFirst: 'Add your first expense or income!',
      voiceHint: 'Say something like: "Spent 500 on groceries"',
      listening: 'Listening...',
      voiceError: 'Could not recognize voice',
      saved: 'Saved!',
      deleted: 'Deleted!',
      monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      monthShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      today: 'Today',
      yesterday: 'Yesterday',
      thisWeek: 'This week',
      thisMonth: 'This month',
      lastMonth: 'Last month',
      allTime: 'All time',
      alertExcess: 'Watch out! You\'ve spent {pct}% of your monthly income',
      alertCategory: 'You\'re spending more than usual on {cat}',
      alertBudget: 'Low budget remaining for {cat}',
      recentTransactions: 'Recent Transactions',
      spendingByCategory: 'Spending by Category',
      monthlyTrend: 'Monthly Trend',
      creditCards: 'Credit Cards',
      installments: 'Installments',
      installmentOf: 'Payment {current} of {total}',
      remainingInstallments: '{n} installments left',
      nextPayment: 'Next payment',
      totalDebt: 'Total Debt',
      monthlyCardExpense: 'Monthly Card Expense',
      addInstallment: 'Add installment purchase',
      cardName: 'Card',
      totalAmount: 'Total Amount',
      numberOfInstallments: 'Number of Installments',
      productName: 'Product / Description',
      currency: 'Currency',
      language: 'Language',
      theme: 'Theme',
      darkMode: 'Dark Mode',
      lightMode: 'Light Mode',
      monthlyIncome: 'Fixed Monthly Income',
      categories: 'Categories',
      budgets: 'Budgets',
      exportData: 'Export Data',
      importData: 'Import Data',
      about: 'About',
      version: 'Version',
      premium: 'Premium',
      upgradePremium: 'Upgrade to Premium',
      premiumFeatures: 'No ads, credit cards, advanced reports and more',
      free: 'Free',
      good: 'Good',
      warning: 'Warning',
      danger: 'Exceeded',
      weekSummary: 'Weekly Summary',
      vsLastMonth: 'vs last month',
      more: 'more',
      less: 'less',
    }
  },

  t(key, params = {}) {
    let text = this.translations[this.currentLang]?.[key] || this.translations['es'][key] || key;
    Object.keys(params).forEach(k => {
      text = text.replace(`{${k}}`, params[k]);
    });
    return text;
  },

  setLang(lang) {
    this.currentLang = lang;
    localStorage.setItem('cc_lang', lang);
  },

  // ---- Currency Formatting ----
  currencySymbol: localStorage.getItem('cc_currency') || 'ARS',

  formatMoney(amount) {
    const symbols = {
      'ARS': '$',
      'USD': 'US$',
      'EUR': '€',
      'BRL': 'R$',
      'MXN': 'MX$',
      'CLP': 'CL$',
      'COP': 'COL$',
      'PEN': 'S/',
      'UYU': '$U',
    };
    const symbol = symbols[this.currencySymbol] || '$';
    const formatted = Math.abs(amount).toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${amount < 0 ? '-' : ''}${symbol} ${formatted}`;
  },

  formatMoneyShort(amount) {
    const symbols = {
      'ARS': '$',
      'USD': 'US$',
      'EUR': '€',
    };
    const symbol = symbols[this.currencySymbol] || '$';
    if (Math.abs(amount) >= 1000000) {
      return `${amount < 0 ? '-' : ''}${symbol}${(Math.abs(amount) / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(amount) >= 1000) {
      return `${amount < 0 ? '-' : ''}${symbol}${(Math.abs(amount) / 1000).toFixed(1)}K`;
    }
    return `${amount < 0 ? '-' : ''}${symbol}${Math.abs(amount).toFixed(0)}`;
  },

  setCurrency(currency) {
    this.currencySymbol = currency;
    localStorage.setItem('cc_currency', currency);
  },

  // ---- Date Helpers ----
  getMonthYear(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  },

  getMonthName(date = new Date()) {
    return this.t('monthNames')[date.getMonth()];
  },

  getMonthShort(monthIndex) {
    return this.t('monthShort')[monthIndex];
  },

  formatDate(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return this.t('today');
    if (date.toDateString() === yesterday.toDateString()) return this.t('yesterday');

    const day = date.getDate();
    const month = this.t('monthShort')[date.getMonth()];
    return `${day} ${month}`;
  },

  formatDateFull(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');
    const day = date.getDate();
    const month = this.t('monthNames')[date.getMonth()];
    const year = date.getFullYear();
    return `${day} de ${month} ${year}`;
  },

  getToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  getMonthRange(year, month) {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
  },

  // ---- Default Categories ----
  defaultCategories: [
    { id: 'food', icon: '🍕', name_es: 'Comida', name_en: 'Food', color: '#FF6B6B' },
    { id: 'supermarket', icon: '🛒', name_es: 'Supermercado', name_en: 'Supermarket', color: '#A78BFA' },
    { id: 'transport', icon: '🚗', name_es: 'Transporte', name_en: 'Transport', color: '#4ECDC4' },
    { id: 'services', icon: '💡', name_es: 'Servicios', name_en: 'Services', color: '#FFD93D' },
    { id: 'health', icon: '🏥', name_es: 'Salud', name_en: 'Health', color: '#6BCB77' },
    { id: 'entertainment', icon: '🎬', name_es: 'Entretenimiento', name_en: 'Entertainment', color: '#9B59B6' },
    { id: 'clothing', icon: '👕', name_es: 'Ropa', name_en: 'Clothing', color: '#E74C3C' },
    { id: 'education', icon: '📚', name_es: 'Educación', name_en: 'Education', color: '#3498DB' },
    { id: 'home', icon: '🏠', name_es: 'Hogar', name_en: 'Home', color: '#E67E22' },
    { id: 'savings', icon: '💰', name_es: 'Ahorro', name_en: 'Savings', color: '#00D9A6' },
    { id: 'other', icon: '📦', name_es: 'Otros', name_en: 'Other', color: '#8B8BA7' },
    { id: 'salary', icon: '💵', name_es: 'Salario', name_en: 'Salary', color: '#2ECC71' },
    { id: 'freelance', icon: '💻', name_es: 'Freelance', name_en: 'Freelance', color: '#1ABC9C' },
    { id: 'investment', icon: '📈', name_es: 'Inversiones', name_en: 'Investments', color: '#F39C12' },
    { id: 'credit_card', icon: '💳', name_es: 'Tarjeta de Crédito', name_en: 'Credit Card', color: '#8B5CF6' },
  ],

  getCategoryName(cat) {
    const langKey = `name_${this.currentLang}`;
    return cat[langKey] || cat.name_es;
  },

  getCategoryById(id) {
    return this.defaultCategories.find(c => c.id === id) || { id, icon: '📦', name_es: id, name_en: id, color: '#8B8BA7' };
  },

  // ---- Number Parsing ----
  parseSpokenNumber(text) {
    const numberWords = {
      'cero': 0, 'un': 1, 'uno': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4,
      'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
      'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15,
      'veinte': 20, 'treinta': 30, 'cuarenta': 40, 'cincuenta': 50,
      'sesenta': 60, 'setenta': 70, 'ochenta': 80, 'noventa': 90,
      'cien': 100, 'ciento': 100, 'doscientos': 200, 'trescientos': 300,
      'cuatrocientos': 400, 'quinientos': 500, 'seiscientos': 600,
      'setecientos': 700, 'ochocientos': 800, 'novecientos': 900,
      'mil': 1000, 'millón': 1000000, 'millon': 1000000,
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
      'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
      'hundred': 100, 'thousand': 1000, 'million': 1000000,
    };

    // Strip spaces between digits just in case the Speech API outputs "100 000"
    const cleanText = text.replace(/(\d)\s+(?=\d)/g, '$1');
    
    // Try to find a direct number
    const directNumberMatch = cleanText.match(/([\d,.]+)\s*(mil|millón|millon|million|k|m)?\b/);
    if (directNumberMatch) {
      let numStr = directNumberMatch[1];
      const lastPuncMatch = numStr.match(/[,.](?=\d+$)/);
      if (lastPuncMatch) {
        const index = numStr.lastIndexOf(lastPuncMatch[0]);
        const after = numStr.substring(index + 1);
        if (after.length === 3) {
          // If exactly 3 digits after the last punctuation, treat it as thousands separator
          numStr = numStr.replace(/[,.]/g, '');
        } else {
          // Treat as decimal separator
          const before = numStr.substring(0, index).replace(/[,.]/g, '');
          numStr = before + '.' + after;
        }
      }
      let num = parseFloat(numStr);
      const multiplier = directNumberMatch[2];
      if (multiplier) {
        if (multiplier.startsWith('mil') || multiplier === 'k') num *= 1000;
        else if (multiplier.startsWith('mill') || multiplier === 'm') num *= 1000000;
      }
      return num;
    }

    // Try word-based parsing
    const words = text.toLowerCase().split(/\s+/);
    let total = 0;
    let current = 0;

    for (const word of words) {
      if (numberWords[word] !== undefined) {
        const val = numberWords[word];
        if (val === 1000) {
          current = current === 0 ? 1000 : current * 1000;
        } else if (val === 1000000) {
          current = current === 0 ? 1000000 : current * 1000000;
        } else if (val >= 100) {
          current = current === 0 ? val : current + val;
        } else {
          current += val;
        }
      } else if (word === 'y') {
        continue;
      }
    }

    return total + current;
  },

  // ---- Percentage ----
  percentage(part, total) {
    if (total === 0) return 0;
    return Math.round((part / total) * 100);
  },

  // ---- ID Generator ----
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  // ---- Debounce ----
  debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  // ---- Animate number ----
  animateNumber(element, start, end, duration = 800) {
    const startTime = performance.now();
    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = start + (end - start) * eased;
      element.textContent = this.formatMoney(current);
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };
    requestAnimationFrame(update);
  },

  // ---- Toast Notification ----
  showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
      <span class="toast-text">${message}</span>
    `;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('toast-show'));

    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  },

  // ---- Haptic Feedback ----
  vibrate(pattern = [10]) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  },
};
