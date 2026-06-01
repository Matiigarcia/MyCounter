// ============================================================
// CuentaClara — Main Application
// ============================================================

const App = {
  currentPage: 'dashboard',
  currentMonth: new Date(),
  editingTransaction: null,

  async init() {
    await DB.init();
    await DB.checkAndCreateCarryOver();
    const settings = DB.getSettings();
    Utils.setLang(settings.lang || 'es');
    Utils.setCurrency(settings.currency || 'ARS');
    document.documentElement.setAttribute('data-theme', settings.theme || 'dark');

    this.populateCardSelects();

    if (!localStorage.getItem('cc_onboarded')) {
      document.getElementById('onboarding').classList.remove('hidden');
    } else {
      this.navigate('dashboard');
    }

    this.bindEvents();
    Voice.init();
    Voice.onResult = (text, isFinal) => {
      document.getElementById('voiceTranscript').textContent = text;
    };
    Voice.onParsed = (parsed, raw) => this.handleVoiceParsed(parsed, raw);
    Voice.onStateChange = (listening) => {
      const btn = document.getElementById('voiceBtn');
      if (btn) btn.classList.toggle('listening', listening);
    };
  },

  populateCardSelects() {
    const s = DB.getSettings();
    const cards = s.cards || [];
    const html = cards.length ? cards.map(c => `<option value="${c}">${c}</option>`).join('') : '<option value="" disabled>Primero agrega una tarjeta en Ajustes</option>';
    
    const s1 = document.getElementById('instCard');
    if(s1) s1.innerHTML = html;
    
    const s2 = document.getElementById('instCardName');
    if(s2) s2.innerHTML = html;
  },

  bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => this.navigate(item.dataset.page));
    });

    // FAB
    document.getElementById('fab').addEventListener('click', () => this.openAddModal());

    // Modal close
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeModal();
    });

    // Type toggle
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active', 'expense-active', 'income-active'));
        const type = btn.dataset.type;
        const isExpense = type === 'expense';
        btn.classList.add('active', isExpense ? 'expense-active' : 'income-active');
        document.getElementById('modalType').value = type;
        
        // Show/hide installment fields
        const instFields = document.getElementById('installmentFields');
        if (instFields) instFields.style.display = isExpense ? 'block' : 'none';
        
        // Income specific logic
        document.getElementById('addSalaryBtn').style.display = isExpense ? 'none' : 'block';
        document.getElementById('modalDesc').placeholder = isExpense ? '¿En qué gastaste?' : 'Descripción (opcional)';
        
        this.renderCategoryGrid();
      });
    });

    // Category selection
    document.getElementById('categoryGrid').addEventListener('click', (e) => {
      const item = e.target.closest('.cat-item');
      if (!item) return;
      document.querySelectorAll('.cat-item').forEach(c => c.classList.remove('selected'));
      item.classList.add('selected');
      document.getElementById('modalCategory').value = item.dataset.cat;
    });

    // Save transaction
    document.getElementById('saveBtn').addEventListener('click', () => this.saveTransaction());

    // Voice button
    document.getElementById('voiceBtn').addEventListener('click', () => Voice.toggle());

    // Onboarding
    document.getElementById('onboardStart').addEventListener('click', () => this.completeOnboarding());

    // Search
    const searchInput = document.getElementById('historySearch');
    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce(() => this.renderHistory(), 300));
    }

    // Installment modal
    document.getElementById('instSaveBtn')?.addEventListener('click', () => this.saveInstallment());

    // Settings events
    this.bindSettingsEvents();
  },

  // ===== NAVIGATION =====
  navigate(page) {
    this.currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));

    // Render page content
    switch (page) {
      case 'dashboard': this.renderDashboard(); break;
      case 'history': this.renderHistory(); break;
      case 'reports': this.renderReports(); break;
      case 'cards': this.renderCards(); break;
      case 'settings': this.renderSettings(); break;
    }
  },

  // ===== DASHBOARD =====
  async renderDashboard() {
    const monthYear = Utils.getMonthYear(this.currentMonth);
    const summary = await DB.getMonthSummary(monthYear);
    const settings = DB.getSettings();
    const recent = await DB.getRecentTransactions(5);
    const alerts = await Alerts.checkAll();
    const status = Alerts.getStatusColor(settings, summary);

    // Balance
    document.getElementById('balanceAmount').textContent = Utils.formatMoney(summary.balance);
    document.getElementById('balanceLabel').textContent = `${Utils.t('monthlyBalance')} — ${Utils.getMonthName(this.currentMonth)}`;

    const statusEl = document.getElementById('balanceStatus');
    statusEl.className = `balance-status status-${status}`;
    statusEl.textContent = `● ${Utils.t(status)}`;

    // Summary
    document.getElementById('totalIncome').textContent = Utils.formatMoney(summary.totalIncome);
    document.getElementById('totalExpenses').textContent = Utils.formatMoney(summary.totalExpenses);

    // Carry-over row
    const carryOverRow = document.getElementById('carryOverRow');
    const carryOverAmount = document.getElementById('carryOverAmount');
    if (summary.carryOver > 0) {
      carryOverRow.style.display = 'flex';
      carryOverAmount.textContent = Utils.formatMoney(summary.carryOver);
    } else {
      carryOverRow.style.display = 'none';
    }

    // Alerts
    Alerts.renderAlerts('alertsContainer');

    // Donut chart
    const catData = Object.entries(summary.byCategory).map(([catId, amount]) => {
      const cat = Utils.getCategoryById(catId);
      return { label: cat.icon + ' ' + Utils.getCategoryName(cat), value: amount, color: cat.color };
    }).sort((a, b) => b.value - a.value);

    setTimeout(() => {
      Charts.drawDonut('donutChart', catData, {
        centerLabel: Utils.t('totalExpenses'),
        centerText: Utils.formatMoneyShort(summary.totalExpenses),
      });
    }, 100);

    // Legend
    const legendEl = document.getElementById('donutLegend');
    legendEl.innerHTML = catData.slice(0, 5).map(d =>
      `<div class="legend-item"><div class="legend-dot" style="background:${d.color}"></div>${d.label} ${Utils.formatMoneyShort(d.value)}</div>`
    ).join('');

    // Recent transactions
    this.renderTransactionList('recentList', recent);

    // Card summary on dashboard
    const instSummary = await DB.getInstallmentSummary();
    const cardWidget = document.getElementById('dashCardWidget');
    if (instSummary.activeCount > 0) {
      cardWidget.style.display = 'block';
      cardWidget.querySelector('.card-monthly').textContent = Utils.formatMoney(instSummary.monthlyPayment);
      cardWidget.querySelector('.card-count').textContent = instSummary.activeCount;
    } else {
      cardWidget.style.display = 'none';
    }
  },

  renderTransactionList(containerId, transactions) {
    const el = document.getElementById(containerId);
    if (!transactions.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-title">${Utils.t('noTransactions')}</div><div class="empty-desc">${Utils.t('addFirst')}</div></div>`;
      return;
    }
    el.innerHTML = transactions.map(tx => {
      const cat = Utils.getCategoryById(tx.category);
      const sign = tx.type === 'income' ? '+' : '-';
      return `<div class="tx-item" data-id="${tx.id}">
        <div class="tx-icon" style="background:${cat.color}20">${cat.icon}</div>
        <div class="tx-info">
          <div class="tx-category">${Utils.getCategoryName(cat)}</div>
          <div class="tx-desc">${tx.description || ''}</div>
        </div>
        <div class="tx-right" style="margin-left: 10px;">
          <div class="tx-amount ${tx.type}">${sign}${Utils.formatMoney(tx.amount)}</div>
          <div class="tx-date">${Utils.formatDate(tx.date)}</div>
        </div>
        <div class="tx-actions">
          <button class="tx-action-btn" onclick="App.editTransaction('${tx.id}')" title="${Utils.t('edit')}">✏️</button>
          <button class="tx-action-btn" onclick="App.deleteTransactionConfirm('${tx.id}')" title="${Utils.t('delete')}">🗑</button>
        </div>
      </div>`;
    }).join('');
  },

  // ===== HISTORY =====
  async renderHistory() {
    const monthYear = Utils.getMonthYear(this.currentMonth);
    const all = await DB.getTransactionsByMonth(monthYear);
    const searchTerm = document.getElementById('historySearch')?.value?.toLowerCase() || '';

    let filtered = all;
    if (searchTerm) {
      filtered = all.filter(t =>
        (t.description || '').toLowerCase().includes(searchTerm) ||
        Utils.getCategoryName(Utils.getCategoryById(t.category)).toLowerCase().includes(searchTerm)
      );
    }

    filtered.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    document.getElementById('historyMonth').textContent = `${Utils.getMonthName(this.currentMonth)} ${this.currentMonth.getFullYear()}`;
    this.renderTransactionList('historyList', filtered);
  },

  // ===== REPORTS =====
  async renderReports() {
    const monthlyData = await DB.getMonthlyTotals(6);

    // Bar chart
    const barData = monthlyData.map(m => ({
      label: Utils.getMonthShort(m.month),
      income: m.totalIncome,
      expense: m.totalExpenses,
    }));
    setTimeout(() => Charts.drawBars('barChart', barData), 100);

    // Line chart (balance trend)
    const lineData = monthlyData.map(m => ({
      label: Utils.getMonthShort(m.month),
      value: m.balance,
    }));
    setTimeout(() => Charts.drawLine('lineChart', lineData, { color: '#6C63FF' }), 150);

    // Comparison vs last month
    const current = monthlyData[monthlyData.length - 1];
    const prev = monthlyData[monthlyData.length - 2];
    const compEl = document.getElementById('comparison');
    if (current && prev && prev.totalExpenses > 0) {
      const diff = current.totalExpenses - prev.totalExpenses;
      const pct = Math.round(Math.abs(diff) / prev.totalExpenses * 100);
      const isMore = diff > 0;
      compEl.innerHTML = `<span style="color:${isMore ? 'var(--red)' : 'var(--green)'}">${isMore ? '▲' : '▼'} ${pct}% ${Utils.t(isMore ? 'more' : 'less')}</span> ${Utils.t('vsLastMonth')}`;
    } else {
      compEl.textContent = '';
    }
  },

  // ===== CREDIT CARDS =====
  async renderCards() {
    const summary = await DB.getInstallmentSummary();
    const monthYear = Utils.getMonthYear(this.currentMonth);
    const txsThisMonth = await DB.getTransactionsByMonth(monthYear);

    document.getElementById('cardTotalDebt').textContent = Utils.formatMoney(summary.totalDebt);
    document.getElementById('cardMonthly').textContent = Utils.formatMoney(summary.monthlyPayment);
    document.getElementById('cardActiveCount').textContent = summary.activeCount;

    const listEl = document.getElementById('installmentList');
    if (!summary.installments.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">💳</div><div class="empty-title">${Utils.t('noTransactions')}</div><div class="empty-desc">${Utils.t('addInstallment')}</div></div>`;
      return;
    }

    // Group by card
    const grouped = {};
    summary.installments.forEach(inst => {
      if (!grouped[inst.cardName]) {
        grouped[inst.cardName] = { name: inst.cardName, items: [], totalMonthly: 0, totalDebt: 0 };
      }
      grouped[inst.cardName].items.push(inst);
      grouped[inst.cardName].totalMonthly += inst.monthlyAmount;
      grouped[inst.cardName].totalDebt += inst.monthlyAmount * (inst.installmentCount - inst.paidInstallments);
    });

    let html = '';
    for (const cardName in grouped) {
      const g = grouped[cardName];
      const isPaid = txsThisMonth.some(t => t.category === 'credit_card' && t.description.includes(`Pago Tarjeta - ${cardName}`));
      
      html += `
        <div class="card" style="margin-bottom: 16px; padding: 16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 12px;">
            <div>
              <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0;">💳 ${g.name}</h3>
              <div style="font-size: 0.85rem; color: var(--text-secondary);">Deuda: ${Utils.formatMoney(g.totalDebt)}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.85rem; color: var(--text-secondary);">A pagar este mes</div>
              <div style="font-size: 1.1rem; font-weight: 700; color: var(--yellow);">${Utils.formatMoney(g.totalMonthly)}</div>
              <div style="font-size: 0.75rem; color: ${isPaid ? 'var(--green)' : 'var(--red)'}; font-weight: 600;">
                ${isPaid ? '✅ PAGADO' : '⏳ ADEUDA'}
              </div>
            </div>
          </div>
          <button class="btn-primary" style="margin-bottom: 16px; padding: 10px;" onclick="App.openCardPayModal('${g.name}', ${g.totalMonthly}, ${isPaid})">
            Pagar Tarjeta
          </button>
          <div style="display:flex; flex-direction:column; gap: 8px;">
            ${g.items.map(inst => {
              const remaining = inst.installmentCount - inst.paidInstallments;
              const pct = (inst.paidInstallments / inst.installmentCount) * 100;
              return `
                <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
                  <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                    <span style="font-weight: 500; font-size: 0.9rem;">${inst.productName}</span>
                    <span style="font-size: 0.9rem;">${Utils.formatMoney(inst.monthlyAmount)}</span>
                  </div>
                  <div class="inst-progress" style="height:4px; margin-bottom:6px;"><div class="inst-progress-fill" style="width:${pct}%"></div></div>
                  <div style="display:flex; justify-content:space-between; font-size: 0.75rem; color: var(--text-secondary);">
                    <span>Cuota ${Math.min(inst.installmentCount, inst.paidInstallments + 1)} de ${inst.installmentCount}</span>
                    <div style="display:flex; gap: 8px;">
                      <button class="btn-secondary" style="padding: 2px 6px; font-size: 0.75rem; width: auto; margin: 0; background: none; border: none; opacity: 0.7;" onclick="App.editInstallment('${inst.id}')">✏️</button>
                      <button class="btn-secondary" style="padding: 2px 6px; font-size: 0.75rem; width: auto; margin: 0; background: none; border: none; opacity: 0.7;" onclick="App.deleteInstallmentConfirm('${inst.id}')">🗑</button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
    listEl.innerHTML = html;
  },

  openCardPayModal(cardName, totalMonthly, isPaid) {
    document.getElementById('cardPayModalOverlay').classList.add('open');
    document.getElementById('cardPayTitle').textContent = `Pagar Tarjeta ${cardName}`;
    document.getElementById('cardPaySuggested').textContent = Utils.formatMoney(totalMonthly);
    document.getElementById('cardPayAmount').value = totalMonthly;
    document.getElementById('cardPayCardName').value = cardName;
    document.getElementById('cardPayWarning').style.display = isPaid ? 'block' : 'none';
  },

  async confirmCardPayment() {
    const cardName = document.getElementById('cardPayCardName').value;
    const amount = parseFloat(document.getElementById('cardPayAmount').value);

    if (!amount || amount <= 0) {
      Utils.showToast('Ingresa un monto válido', 'error');
      return;
    }

    // Advance installments for this card
    const active = await DB.getActiveInstallments();
    for (const inst of active) {
      if (inst.cardName === cardName) {
        await DB.payInstallment(inst.id);
      }
    }

    // Register transaction
    await DB.addTransaction({
      type: 'expense',
      amount: amount,
      category: 'credit_card',
      description: `Pago Tarjeta - ${cardName}`,
      date: Utils.getToday()
    });

    Utils.showToast(`✅ Pago de ${cardName} registrado`);
    Utils.vibrate([10, 50, 10]);
    document.getElementById('cardPayModalOverlay').classList.remove('open');
    this.renderCards();
    this.renderDashboard();
  },

  async deleteInstallmentConfirm(id) {
    this.customConfirm(async () => {
      await DB.deleteInstallment(id);
      Utils.showToast(Utils.t('deleted'));
      this.renderCards();
    });
  },

  // ===== SETTINGS =====
  renderSettings() {
    const s = DB.getSettings();
    document.getElementById('settingLang').value = s.lang || 'es';
    document.getElementById('settingCurrency').value = s.currency || 'ARS';
    document.getElementById('settingTheme').checked = (s.theme || 'dark') === 'dark';
    document.getElementById('settingIncome').value = s.monthlyIncome || '';
    this.renderCardSettings();
  },

  renderCardSettings() {
    const s = DB.getSettings();
    const cards = s.cards || [];
    const list = document.getElementById('settingsCardList');
    if(list) {
      list.innerHTML = cards.map((c, i) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:8px;">
          <span>${c}</span>
          <button class="btn-secondary" style="padding:4px 8px; font-size:0.8rem; width:auto; margin:0;" onclick="App.deleteCardFromSettings(${i})">🗑</button>
        </div>
      `).join('');
    }
  },

  addCardToSettings() {
    const bank = document.getElementById('newCardBank').value.trim();
    const type = document.getElementById('newCardType').value;
    if(!bank) { Utils.showToast('Ingresa el banco', 'warning'); return; }
    const cardName = `${bank} ${type}`;
    const s = DB.getSettings();
    const cards = s.cards || [];
    if(cards.includes(cardName)) { Utils.showToast('La tarjeta ya existe', 'warning'); return; }
    cards.push(cardName);
    DB.updateSetting('cards', cards);
    document.getElementById('newCardBank').value = '';
    this.renderCardSettings();
    this.populateCardSelects();
  },

  deleteCardFromSettings(index) {
    this.customConfirm(() => {
      const s = DB.getSettings();
      const cards = s.cards || [];
      cards.splice(index, 1);
      DB.updateSetting('cards', cards);
      this.renderCardSettings();
      this.populateCardSelects();
    });
  },

  bindSettingsEvents() {
    document.getElementById('settingLang')?.addEventListener('change', (e) => {
      DB.updateSetting('lang', e.target.value);
      Utils.setLang(e.target.value);
      Voice.updateLanguage();
      this.refreshUI();
    });

    document.getElementById('settingCurrency')?.addEventListener('change', (e) => {
      DB.updateSetting('currency', e.target.value);
      Utils.setCurrency(e.target.value);
      this.refreshUI();
    });

    document.getElementById('settingTheme')?.addEventListener('change', (e) => {
      const theme = e.target.checked ? 'dark' : 'light';
      DB.updateSetting('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    });

    document.getElementById('settingIncome')?.addEventListener('change', (e) => {
      DB.updateSetting('monthlyIncome', parseFloat(e.target.value) || 0);
    });

    document.getElementById('exportJSON')?.addEventListener('click', () => DB.exportData());
    document.getElementById('exportCSV')?.addEventListener('click', () => DB.exportCSV());

    document.getElementById('importFile')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const ok = await DB.importData(text);
      Utils.showToast(ok ? '✅ Importado' : '❌ Error', ok ? 'success' : 'error');
      this.refreshUI();
    });
  },

  refreshUI() {
    this.updateNavLabels();
    this.navigate(this.currentPage);
  },

  updateNavLabels() {
    const labels = { dashboard: 'dashboard', history: 'history', reports: 'reports', cards: 'cards', settings: 'settings' };
    document.querySelectorAll('.nav-item').forEach(item => {
      const key = item.dataset.page;
      const label = item.querySelector('.nav-label');
      if (label && labels[key]) label.textContent = Utils.t(labels[key]);
    });
  },

  // ===== ADD/EDIT MODAL =====
  openAddModal(defaults = {}) {
    this.editingTransaction = null;
    document.getElementById('modalOverlay').classList.add('open');
    document.getElementById('modalTitle').textContent = Utils.t('addTransaction');
    document.getElementById('modalAmount').value = defaults.amount || '';
    document.getElementById('modalDesc').value = defaults.description || '';
    document.getElementById('modalDate').value = defaults.date || Utils.getToday();
    document.getElementById('voiceTranscript').textContent = '';

    // Type
    const type = defaults.type || 'expense';
    const isExpense = type === 'expense';
    document.querySelectorAll('.type-btn').forEach(b => {
      b.classList.remove('active', 'expense-active', 'income-active');
      if (b.dataset.type === type) b.classList.add('active', isExpense ? 'expense-active' : 'income-active');
    });
    document.getElementById('modalType').value = type;

    // Category
    const cat = defaults.category || 'food';
    document.querySelectorAll('.cat-item').forEach(c => c.classList.toggle('selected', c.dataset.cat === cat));
    document.getElementById('modalCategory').value = cat;

    // Installment fields
    const instFields = document.getElementById('installmentFields');
    if (instFields) {
      instFields.style.display = isExpense ? 'block' : 'none';
      document.getElementById('instCount').value = defaults.installmentCount || '';
      document.getElementById('instCard').value = defaults.cardName || '';
    }
    
    document.getElementById('addSalaryBtn').style.display = isExpense ? 'none' : 'block';
    document.getElementById('modalDesc').placeholder = isExpense ? '¿En qué gastaste?' : 'Descripción (opcional)';

    // Render categories
    this.renderCategoryGrid();
  },

  renderCategoryGrid() {
    const type = document.getElementById('modalType').value;
    const cats = Utils.defaultCategories.filter(c => {
      if (c.id === 'carry_over') return false; // Never show carry_over in manual entry
      if (type === 'income') return ['salary', 'freelance', 'investment', 'other'].includes(c.id);
      return !['salary', 'freelance', 'investment'].includes(c.id);
    });

    const grid = document.getElementById('categoryGrid');
    grid.innerHTML = cats.map(c => `
      <div class="cat-item" data-cat="${c.id}">
        <span class="cat-emoji">${c.icon}</span>
        <span class="cat-name">${Utils.getCategoryName(c)}</span>
      </div>
    `).join('');

    // Re-select
    const selected = document.getElementById('modalCategory').value;
    const sel = grid.querySelector(`[data-cat="${selected}"]`);
    if (sel) sel.classList.add('selected');
  },

  closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
  },

  async saveTransaction() {
    const amount = parseFloat(document.getElementById('modalAmount').value);
    if (!amount || amount <= 0) { Utils.showToast('Ingresá un monto válido', 'error'); return; }

    const type = document.getElementById('modalType').value;
    const category = document.getElementById('modalCategory').value;
    const description = document.getElementById('modalDesc').value;
    const date = document.getElementById('modalDate').value;
    const instCount = document.getElementById('instCount')?.value;
    const instCard = document.getElementById('instCard')?.value;

    if (this.editingTransaction) {
      const tx = await DB.getTransaction(this.editingTransaction);
      if (tx) {
        tx.amount = amount;
        tx.type = type;
        tx.category = category;
        tx.description = description;
        tx.date = date;
        await DB.updateTransaction(tx);
        Utils.showToast('✅ Editado correctamente');
      }
      this.editingTransaction = null;
    } else {
      // If installment purchase
      if (instCount && parseInt(instCount) > 1 && type === 'expense') {
        await DB.addInstallment({
          productName: description || Utils.getCategoryName(Utils.getCategoryById(category)),
          totalAmount: amount,
          installmentCount: parseInt(instCount),
          cardName: instCard || 'Visa',
          startDate: date,
        });
        Utils.showToast(`✅ ${Utils.t('saved')} — ${instCount} cuotas de ${Utils.formatMoney(amount / parseInt(instCount))}`);
      } else {
        await DB.addTransaction({ type, amount, category, description, date });
        Utils.showToast(Utils.t('saved'));
      }
    }

    Utils.vibrate([10, 50, 10]);
    this.closeModal();
    this.navigate(this.currentPage);
  },

  customConfirm(action) {
    document.getElementById('confirmModalOverlay').classList.add('open');
    document.getElementById('confirmYesBtn').onclick = () => {
      document.getElementById('confirmModalOverlay').classList.remove('open');
      action();
    };
  },

  async editTransaction(id) {
    const tx = await DB.getTransaction(id);
    if (!tx) return;
    this.openAddModal(tx);
    this.editingTransaction = tx.id;
    document.getElementById('modalTitle').textContent = 'Editar Transacción';
  },


  async deleteTransactionConfirm(id) {
    this.customConfirm(async () => {
      await DB.deleteTransaction(id);
      Utils.showToast(Utils.t('deleted'));
      this.navigate(this.currentPage);
    });
  },

  // ===== INSTALLMENT MODAL =====
  openInstallmentModal(defaults = {}) {
    document.getElementById('instModalOverlay').classList.add('open');
    document.getElementById('editingInstallmentId').value = defaults.id || '';
    document.getElementById('instProductName').value = defaults.productName || '';
    document.getElementById('instTotalAmount').value = defaults.totalAmount || '';
    document.getElementById('instTotalCount').value = defaults.installmentCount || '';
    
    const paidCountEl = document.getElementById('instPaidCount');
    if (paidCountEl) {
      // Si editamos, mostramos la cuota actual (pagadas + 1)
      paidCountEl.value = defaults.id ? (defaults.paidInstallments + 1) : 1;
    }
    
    const cardField = document.getElementById('instCardName');
    cardField.value = defaults.cardName || 'Visa';

    // Close on overlay click
    document.getElementById('instModalOverlay').onclick = (e) => {
      if (e.target === e.currentTarget) {
        document.getElementById('instModalOverlay').classList.remove('open');
      }
    };
  },

  async saveInstallment() {
    const editId = document.getElementById('editingInstallmentId').value;
    const name = document.getElementById('instProductName').value;
    const amount = parseFloat(document.getElementById('instTotalAmount').value);
    const count = parseInt(document.getElementById('instTotalCount').value);
    // Usuario ingresa "Cuota actual", nosotros guardamos "Cuotas pagadas" (actual - 1)
    const currentCount = parseInt(document.getElementById('instPaidCount')?.value) || 1;
    const paidCount = Math.max(0, currentCount - 1);
    const card = document.getElementById('instCardName').value;

    if (!name || !amount || !count || count < 2) {
      Utils.showToast('Completá todos los campos', 'error');
      return;
    }
    
    if (paidCount >= count) {
      Utils.showToast('La cuota actual no puede ser mayor al total', 'error');
      return;
    }

    if (editId) {
      const inst = await DB.getInstallment(editId);
      if (inst) {
        inst.productName = name;
        inst.totalAmount = amount;
        inst.installmentCount = count;
        inst.paidInstallments = paidCount;
        inst.cardName = card || 'Visa';
        await DB.updateInstallment(inst);
        Utils.showToast('✅ Cuotas actualizadas');
      }
    } else {
      await DB.addInstallment({
        productName: name,
        totalAmount: amount,
        installmentCount: count,
        paidCount: paidCount,
        cardName: card || 'Visa',
      });
      Utils.showToast(`✅ ${count} cuotas de ${Utils.formatMoney(amount / count)}`);
    }

    Utils.vibrate([10, 50, 10]);
    document.getElementById('instModalOverlay').classList.remove('open');
    this.renderCards();
  },

  async editInstallment(id) {
    const inst = await DB.getInstallment(id);
    if (!inst) return;
    this.openInstallmentModal(inst);
  },

  // ===== VOICE =====
  async handleVoiceParsed(parsed, raw) {
    if (parsed.amount > 0) {
      if (parsed.installmentCount && parsed.installmentCount > 1 && parsed.type === 'expense') {
        const s = DB.getSettings();
        const defaultCard = (s.cards && s.cards.length > 0) ? s.cards[0] : 'Visa';
        await DB.addInstallment({
          productName: parsed.description || Utils.getCategoryName(Utils.getCategoryById(parsed.category)),
          totalAmount: parsed.amount,
          installmentCount: parsed.installmentCount,
          cardName: parsed.cardName || defaultCard,
          startDate: Utils.getToday(),
        });
        Utils.showToast(`✅ Guardado: ${parsed.installmentCount} cuotas de ${Utils.formatMoney(parsed.amount / parsed.installmentCount)}`);
      } else {
        await DB.addTransaction({
          type: parsed.type,
          amount: parsed.amount,
          category: parsed.category,
          description: parsed.description,
          date: Utils.getToday()
        });
        Utils.showToast('✅ Guardado por voz');
      }
      Utils.vibrate([10, 50, 10]);
      this.navigate(this.currentPage);
    } else {
      Utils.showToast(Utils.t('voiceError'), 'error');
    }
  },

  // ===== ONBOARDING & SALARY =====
  openSalaryModal() {
    document.getElementById('salaryModalOverlay').classList.add('open');
    document.getElementById('salaryAmount').value = DB.getSettings().monthlyIncome || '';
  },

  saveSalary() {
    const amt = parseFloat(document.getElementById('salaryAmount').value) || 0;
    DB.updateSetting('monthlyIncome', amt);
    document.getElementById('salaryModalOverlay').classList.remove('open');
    Utils.showToast('Salario actualizado');
    this.renderDashboard();
    if(this.currentPage === 'settings') this.renderSettings();
  },

  completeOnboarding() {
    const income = parseFloat(document.getElementById('onboardIncome').value) || 0;
    if (income > 0) DB.updateSetting('monthlyIncome', income);
    localStorage.setItem('cc_onboarded', 'true');
    document.getElementById('onboarding').classList.add('hidden');
    this.navigate('dashboard');
  },

  // ===== MONTH NAVIGATION =====
  prevMonth() {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1);
    this.navigate(this.currentPage);
  },
  nextMonth() {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1);
    this.navigate(this.currentPage);
  },
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
