// ============================================================
// CuentaClara — IndexedDB Data Layer
// ============================================================

const DB = {
  db: null,
  DB_NAME: 'CuentaClaraDB',
  DB_VERSION: 2,

  // ---- Initialize Database ----
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Transactions store
        if (!db.objectStoreNames.contains('transactions')) {
          const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
          txStore.createIndex('date', 'date', { unique: false });
          txStore.createIndex('type', 'type', { unique: false });
          txStore.createIndex('category', 'category', { unique: false });
          txStore.createIndex('monthYear', 'monthYear', { unique: false });
        }

        // Installments store (credit card purchases in installments)
        if (!db.objectStoreNames.contains('installments')) {
          const instStore = db.createObjectStore('installments', { keyPath: 'id' });
          instStore.createIndex('cardName', 'cardName', { unique: false });
          instStore.createIndex('active', 'active', { unique: false });
        }

        // Budgets store
        if (!db.objectStoreNames.contains('budgets')) {
          db.createObjectStore('budgets', { keyPath: 'category' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('DB Error:', event.target.error);
        reject(event.target.error);
      };
    });
  },

  // ---- Generic helpers ----
  _getStore(storeName, mode = 'readonly') {
    const tx = this.db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  },

  _promisify(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  // ============================================================
  // TRANSACTIONS
  // ============================================================

  async addTransaction(transaction) {
    const data = {
      id: Utils.generateId(),
      type: transaction.type, // 'income' | 'expense'
      amount: parseFloat(transaction.amount),
      category: transaction.category,
      description: transaction.description || '',
      date: transaction.date || Utils.getToday(),
      monthYear: transaction.date ? transaction.date.substring(0, 7) : Utils.getMonthYear(),
      createdAt: new Date().toISOString(),
    };
    const store = this._getStore('transactions', 'readwrite');
    await this._promisify(store.add(data));
    return data;
  },

  async updateTransaction(id, updates) {
    const store = this._getStore('transactions', 'readwrite');
    const existing = await this._promisify(store.get(id));
    if (!existing) throw new Error('Transaction not found');

    const updated = { ...existing, ...updates };
    if (updates.date) {
      updated.monthYear = updates.date.substring(0, 7);
    }
    await this._promisify(store.put(updated));
    return updated;
  },

  async deleteTransaction(id) {
    const store = this._getStore('transactions', 'readwrite');
    return this._promisify(store.delete(id));
  },

  async getTransaction(id) {
    const store = this._getStore('transactions');
    return this._promisify(store.get(id));
  },

  async getAllTransactions() {
    const store = this._getStore('transactions');
    return this._promisify(store.getAll());
  },

  async getTransaction(id) {
    const store = this._getStore('transactions');
    return this._promisify(store.get(id));
  },

  async updateTransaction(tx) {
    const store = this._getStore('transactions', 'readwrite');
    return this._promisify(store.put(tx));
  },

  async getTransactionsByMonth(monthYear) {
    const store = this._getStore('transactions');
    const index = store.index('monthYear');
    return this._promisify(index.getAll(monthYear));
  },

  async getTransactionsByDateRange(startDate, endDate) {
    const all = await this.getAllTransactions();
    return all.filter(t => t.date >= startDate && t.date <= endDate);
  },

  async getMonthSummary(monthYear) {
    const transactions = await this.getTransactionsByMonth(monthYear);
    let totalIncome = 0;
    let totalExpenses = 0;
    let carryOver = 0;
    const byCategory = {};

    transactions.forEach(t => {
      if (t.type === 'income') {
        if (t.category === 'carry_over') {
          carryOver += t.amount;
        } else {
          totalIncome += t.amount;
        }
      } else {
        totalExpenses += t.amount;
        if (!byCategory[t.category]) {
          byCategory[t.category] = 0;
        }
        byCategory[t.category] += t.amount;
      }
    });

    return {
      totalIncome,
      carryOver,
      totalExpenses,
      balance: totalIncome + carryOver - totalExpenses,
      byCategory,
      transactionCount: transactions.length,
      transactions,
    };
  },

  async checkAndCreateCarryOver() {
    const now = new Date();
    const currentMonthYear = Utils.getMonthYear(now);

    // Check if a carry-over already exists for the current month
    const currentTxs = await this.getTransactionsByMonth(currentMonthYear);
    const existing = currentTxs.find(t => t.category === 'carry_over');
    if (existing) return null; // Already created, skip

    // Calculate previous month's balance
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthYear = Utils.getMonthYear(prevDate);
    const prevSummary = await this.getMonthSummary(prevMonthYear);

    // Only carry over if positive balance
    if (prevSummary.balance <= 0) return null;

    // Get previous month name for the description
    const prevMonthName = Utils.getMonthName(prevDate);

    // Create the carry-over transaction on the 1st of the current month
    const firstDay = `${currentMonthYear}-01`;
    const tx = await this.addTransaction({
      type: 'income',
      amount: prevSummary.balance,
      category: 'carry_over',
      description: Utils.t('carryOverDesc', { month: prevMonthName }),
      date: firstDay,
    });

    return tx;
  },

  async getRecentTransactions(limit = 5) {
    const all = await this.getAllTransactions();
    return all.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return new Date(b.createdAt) - new Date(a.createdAt);
    }).slice(0, limit);
  },

  async getMonthlyTotals(months = 6) {
    const result = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const my = Utils.getMonthYear(d);
      const summary = await this.getMonthSummary(my);
      result.push({
        monthYear: my,
        month: d.getMonth(),
        year: d.getFullYear(),
        ...summary,
      });
    }

    return result;
  },

  // ============================================================
  // INSTALLMENTS (Credit Card Purchases)
  // ============================================================

  async addInstallment(installment) {
    const monthlyAmount = parseFloat(installment.totalAmount) / parseInt(installment.installmentCount);
    const data = {
      id: Utils.generateId(),
      productName: installment.productName,
      totalAmount: parseFloat(installment.totalAmount),
      installmentCount: parseInt(installment.installmentCount),
      paidInstallments: parseInt(installment.paidCount) || 0,
      monthlyAmount: Math.round(monthlyAmount * 100) / 100,
      cardName: installment.cardName || 'Visa',
      startDate: installment.startDate || Utils.getToday(),
      startMonthYear: installment.startDate ? installment.startDate.substring(0, 7) : Utils.getMonthYear(),
      active: true,
      createdAt: new Date().toISOString(),
    };
    const store = this._getStore('installments', 'readwrite');
    await this._promisify(store.add(data));
    return data;
  },

  async getActiveInstallments() {
    const store = this._getStore('installments');
    const all = await this._promisify(store.getAll());
    return all.filter(inst => inst.active && inst.paidInstallments < inst.installmentCount);
  },

  async getAllInstallments() {
    const store = this._getStore('installments');
    return this._promisify(store.getAll());
  },

  async getInstallment(id) {
    const store = this._getStore('installments');
    return this._promisify(store.get(id));
  },

  async updateInstallment(inst) {
    const store = this._getStore('installments', 'readwrite');
    const monthlyAmount = parseFloat(inst.totalAmount) / parseInt(inst.installmentCount);
    inst.monthlyAmount = Math.round(monthlyAmount * 100) / 100;
    return this._promisify(store.put(inst));
  },

  async payInstallment(id) {
    const store = this._getStore('installments', 'readwrite');
    const inst = await this._promisify(store.get(id));
    if (!inst) throw new Error('Installment not found');

    inst.paidInstallments += 1;
    if (inst.paidInstallments >= inst.installmentCount) {
      inst.active = false;
    }
    await this._promisify(store.put(inst));
    return inst;
  },

  async deleteInstallment(id) {
    const store = this._getStore('installments', 'readwrite');
    return this._promisify(store.delete(id));
  },

  async getInstallmentSummary() {
    const active = await this.getActiveInstallments();
    let totalDebt = 0;
    let monthlyPayment = 0;

    active.forEach(inst => {
      const remaining = inst.installmentCount - inst.paidInstallments;
      totalDebt += inst.monthlyAmount * remaining;
      monthlyPayment += inst.monthlyAmount;
    });

    return {
      activeCount: active.length,
      totalDebt: Math.round(totalDebt * 100) / 100,
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      installments: active,
    };
  },

  // ============================================================
  // BUDGETS
  // ============================================================

  async setBudget(category, amount) {
    const store = this._getStore('budgets', 'readwrite');
    await this._promisify(store.put({ category, amount: parseFloat(amount) }));
  },

  async getBudget(category) {
    const store = this._getStore('budgets');
    return this._promisify(store.get(category));
  },

  async getAllBudgets() {
    const store = this._getStore('budgets');
    return this._promisify(store.getAll());
  },

  async deleteBudget(category) {
    const store = this._getStore('budgets', 'readwrite');
    return this._promisify(store.delete(category));
  },

  // ============================================================
  // SETTINGS (using localStorage)
  // ============================================================

  getSettings() {
    const defaults = {
      monthlyIncome: 0,
      currency: 'ARS',
      lang: 'es',
      theme: 'dark',
      isPremium: true,
      customCategories: [],
      cards: [],
    };
    const saved = localStorage.getItem('cc_settings');
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  },

  saveSettings(settings) {
    localStorage.setItem('cc_settings', JSON.stringify(settings));
  },

  updateSetting(key, value) {
    const settings = this.getSettings();
    settings[key] = value;
    this.saveSettings(settings);
    return settings;
  },

  // ============================================================
  // EXPORT / IMPORT
  // ============================================================

  async exportData() {
    const transactions = await this.getAllTransactions();
    const installments = await this.getAllInstallments();
    const budgets = await this.getAllBudgets();
    const settings = this.getSettings();

    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions,
      installments,
      budgets,
      settings,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuentaclara-backup-${Utils.getToday()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async exportCSV() {
    const transactions = await this.getAllTransactions();
    const headers = ['Fecha', 'Tipo', 'Categoría', 'Monto', 'Descripción'];
    const rows = transactions
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(t => [
        t.date,
        t.type === 'income' ? 'Ingreso' : 'Gasto',
        Utils.getCategoryById(t.category)?.name_es || t.category,
        t.amount.toFixed(2),
        `"${(t.description || '').replace(/"/g, '""')}"`,
      ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuentaclara-${Utils.getToday()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);

      if (data.transactions) {
        const store = this._getStore('transactions', 'readwrite');
        for (const t of data.transactions) {
          await this._promisify(store.put(t));
        }
      }

      if (data.installments) {
        const store = this._getStore('installments', 'readwrite');
        for (const inst of data.installments) {
          await this._promisify(store.put(inst));
        }
      }

      if (data.budgets) {
        const store = this._getStore('budgets', 'readwrite');
        for (const b of data.budgets) {
          await this._promisify(store.put(b));
        }
      }
// Versión de DB actualizada para soportar edición de cuotas.

      if (data.settings) {
        this.saveSettings(data.settings);
      }

      return true;
    } catch (e) {
      console.error('Import error:', e);
      return false;
    }
  },
};
