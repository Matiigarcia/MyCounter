// ============================================================
// CuentasClaras — Main Application
// ============================================================

const App = {
  VERSION: '1.0.24',
  currentPage: 'dashboard',
  currentMonth: new Date(),
  editingTransaction: null,
  pendingAmounts: [],
  historyViewMode: 'list',
  learningRules: {},

  async init() {
    this.checkVersion();
    await DB.init();
    const settings = DB.getSettings();
    Utils.setLang(settings.lang || 'es');
    Utils.setCurrency(settings.currency || 'ARS');
    document.documentElement.setAttribute('data-theme', settings.theme || 'dark');

    // Load custom learning rules into memory
    this.learningRules = {};
    try {
      const rules = await DB.getAllLearningRules();
      if (rules) {
        rules.forEach(r => {
          this.learningRules[r.keyword] = r.category;
        });
      }
    } catch (err) {
      console.error('Failed to load learning rules:', err);
    }

    this.applyTranslations();
    this.populateRulesCategorySelect();
    this.populateCardSelects();

    if (!localStorage.getItem('cc_onboarded')) {
      document.getElementById('onboarding').classList.remove('hidden');
      this.updateOnboardingInstallBtn();
    } else {
      this.navigate('dashboard');
    }

    this.bindEvents();
    this.initPWA();
    Voice.init();
    Voice.onResult = (text, isFinal) => {
      document.getElementById('voiceTranscript').textContent = text;
    };
    Voice.onParsed = (parsed, raw) => this.handleVoiceParsed(parsed, raw);
    Voice.onStateChange = (listening) => {
      const btn = document.getElementById('voiceBtn');
      const fab = document.getElementById('fab');
      if (btn) btn.classList.toggle('listening', listening);
      if (fab) fab.classList.toggle('listening', listening);
    };
  },

  deferredPrompt: null,
  initPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const installBtn = document.getElementById('installBtnContainer');
      if (installBtn) installBtn.style.display = 'flex';
      this.updateOnboardingInstallBtn();
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      const installBtn = document.getElementById('installBtnContainer');
      if (installBtn) installBtn.style.display = 'none';
      Utils.showToast('✅ Aplicación instalada');
    });
  },

  async installPWA() {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    const installBtn = document.getElementById('installBtnContainer');
    if (installBtn) installBtn.style.display = 'none';
    const onboardingBtn = document.getElementById('onboardingInstallContainer');
    if (onboardingBtn) onboardingBtn.style.display = 'none';
  },

  updateOnboardingInstallBtn() {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const container = document.getElementById('onboardingInstallContainer');
    if (this.deferredPrompt && isChrome && container) {
      container.style.display = 'flex';
    }
  },

  showAbout() {
    document.getElementById('aboutModalOverlay').classList.add('open');
    document.querySelectorAll('.app-version-txt').forEach(el => el.textContent = this.VERSION);
  },

  checkVersion() {
    const savedVersion = localStorage.getItem('cc_version');
    if (savedVersion && savedVersion !== this.VERSION) {
      console.log('Nueva versión detectada:', this.VERSION);
      localStorage.setItem('cc_version', this.VERSION);
      
      // Clear all caches and reload
      if ('serviceWorker' in navigator) {
        caches.keys().then(names => {
          for (let name of names) caches.delete(name);
        });
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (let registration of registrations) registration.unregister();
        });
      }
      
      setTimeout(() => {
        window.location.reload(true);
      }, 500);
    } else {
      localStorage.setItem('cc_version', this.VERSION);
    }
  },

  showHelp() {
    document.getElementById('helpModalOverlay').classList.add('open');
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

    // FAB Logic (Click and Long Press)
    const fab = document.getElementById('fab');
    let fabTimer;
    let isLongPress = false;

    const startVoice = () => {
      isLongPress = true;
      this.openAddModal();
      Voice.start();
      Utils.vibrate([30]);
    };

    fab.addEventListener('mousedown', () => {
      isLongPress = false;
      fabTimer = setTimeout(startVoice, 500);
    });

    fab.addEventListener('touchstart', () => {
      isLongPress = false;
      fabTimer = setTimeout(startVoice, 500);
    }, { passive: true });

    const endVoice = (e) => {
      clearTimeout(fabTimer);
      if (isLongPress) {
        Voice.stop();
        // The click event might still fire, we handle it in the click listener
      }
    };

    fab.addEventListener('mouseup', endVoice);
    fab.addEventListener('touchend', endVoice);
    
    fab.addEventListener('click', (e) => {
      if (isLongPress) {
        isLongPress = false;
        return;
      }
      this.openAddModal();
    });

    // Modal close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
          overlay.classList.remove('open');
          if (overlay.id === 'modalOverlay') Voice.stop();
        }
      });
    });

    // Type toggle
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active', 'expense-active', 'income-active'));
        const type = btn.dataset.type;
        const isExpense = type === 'expense';
        btn.classList.add('active', isExpense ? 'expense-active' : 'income-active');
        document.getElementById('modalType').value = type;
        
        // Show/hide installment fields based on category
        this.updateInstallmentFieldsVisibility();
        
        // Income specific logic
        const salaryBtn = document.getElementById('addSalaryBtn');
        if (salaryBtn) salaryBtn.style.display = isExpense ? 'none' : 'block';
        document.getElementById('modalDesc').placeholder = isExpense ? '¿En qué gastaste?' : 'Descripción (opcional)';
        
        this.renderCategoryGrid();
      });
    });

    // Subscription checkbox logic
    document.getElementById('modalIsSubscription').addEventListener('change', (e) => {
      document.getElementById('instCountGroup').style.display = e.target.checked ? 'none' : 'block';
    });
    
    document.getElementById('instIsSubscription').addEventListener('change', (e) => {
      document.getElementById('instModalCountsGroup').style.display = e.target.checked ? 'none' : 'block';
    });

    // Category selection
    document.getElementById('categoryGrid').addEventListener('click', (e) => {
      const item = e.target.closest('.cat-item');
      if (!item) return;
      document.querySelectorAll('.cat-item').forEach(c => c.classList.remove('selected'));
      item.classList.add('selected');
      document.getElementById('modalCategory').value = item.dataset.cat;
      this.updateInstallmentFieldsVisibility();
    });

    // Save transaction
    document.getElementById('saveBtn').addEventListener('click', () => this.saveTransaction());

    // Swipe down to close modals
    let touchStartY = 0;
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('touchstart', (e) => {
        if (modal.scrollTop <= 0) touchStartY = e.touches[0].clientY;
        else touchStartY = 0;
      }, { passive: true });

      modal.addEventListener('touchmove', (e) => {
        if (touchStartY === 0) return;
        const touchY = e.touches[0].clientY;
        const diff = touchY - touchStartY;
        if (diff > 0) {
          modal.style.transform = `translateY(${diff}px)`;
          modal.style.transition = 'none';
        }
      }, { passive: true });

      modal.addEventListener('touchend', (e) => {
        if (touchStartY === 0) return;
        const touchY = e.changedTouches[0].clientY;
        const diff = touchY - touchStartY;
        modal.style.transition = 'transform 0.3s cubic-bezier(0.16,1,0.3,1)';
        modal.style.transform = '';
        if (diff > 120) {
          const overlay = modal.closest('.modal-overlay');
          if (overlay) {
            overlay.classList.remove('open');
            if (overlay.id === 'modalOverlay') Voice.stop();
          }
        }
      });
    });



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
    const fab = document.getElementById('fab');
    if (fab) fab.style.display = page === 'cards' ? 'none' : 'flex';

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
    await DB.checkAndCreateCarryOver();
    
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

    // Carry-over
    const carryOverRow = document.getElementById('carryOverRow');
    if (carryOverRow) {
      if (summary.carryOver > 0) {
        carryOverRow.style.display = 'block';
        document.getElementById('carryOverAmount').textContent = Utils.formatMoney(summary.carryOver);
        const carryOverTx = summary.transactions.find(t => t.category === 'carry_over');
        if (carryOverTx && carryOverTx.description) {
          document.getElementById('carryOverDesc').textContent = carryOverTx.description;
        } else {
          document.getElementById('carryOverDesc').textContent = '';
        }
      } else {
        carryOverRow.style.display = 'none';
      }
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
      const label = tx.description || Utils.getCategoryName(cat);
      return `<div class="tx-item" data-id="${tx.id}">
        <div class="tx-icon" style="background:${cat.color}20">${cat.icon}</div>
        <div class="tx-info">
          <div class="tx-info-top">
            <div class="tx-date">${Utils.formatDate(tx.date)}</div>
            <div class="tx-amount ${tx.type}">${sign}${Utils.formatMoney(tx.amount)}</div>
          </div>
          <div class="tx-desc">${label}</div>
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

    document.getElementById('historyMonth').textContent = `${Utils.getMonthName(this.currentMonth)} ${this.currentMonth.getFullYear()}`;

    if (this.historyViewMode === 'list') {
      filtered.sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      this.renderTransactionList('historyList', filtered);
    } else {
      this.renderCategoryGroupedHistory(filtered);
    }
  },

  setHistoryViewMode(mode) {
    this.historyViewMode = mode;
    const btnList = document.getElementById('btnViewList');
    const btnCat = document.getElementById('btnViewCategory');
    
    if (btnList && btnCat) {
      if (mode === 'list') {
        btnList.classList.add('active');
        btnList.style.background = 'rgba(255,255,255,0.1)';
        btnList.style.color = 'var(--text-primary)';
        
        btnCat.classList.remove('active');
        btnCat.style.background = 'transparent';
        btnCat.style.color = 'var(--text-secondary)';
      } else {
        btnCat.classList.add('active');
        btnCat.style.background = 'rgba(255,255,255,0.1)';
        btnCat.style.color = 'var(--text-primary)';
        
        btnList.classList.remove('active');
        btnList.style.background = 'transparent';
        btnList.style.color = 'var(--text-secondary)';
      }
    }
    this.renderHistory();
  },

  renderCategoryGroupedHistory(transactions) {
    const listEl = document.getElementById('historyList');
    if (!listEl) return;
    
    if (!transactions.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-title">${Utils.t('noTransactions')}</div><div class="empty-desc">${Utils.t('addFirst')}</div></div>`;
      return;
    }
    
    // Calculate total expenses for percentage calculation
    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
      
    // Group transactions by category ID and transaction type
    const grouped = {};
    transactions.forEach(t => {
      const groupKey = `${t.category}-${t.type}`;
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          category: Utils.getCategoryById(t.category),
          type: t.type,
          transactions: [],
          total: 0
        };
      }
      grouped[groupKey].transactions.push(t);
      grouped[groupKey].total += t.amount;
    });
    
    // Convert to sorted array
    const groups = Object.values(grouped).sort((a, b) => b.total - a.total);
    
    listEl.innerHTML = groups.map(g => {
      const cat = g.category;
      const txCount = g.transactions.length;
      const isIncomeGroup = g.type === 'income';
      
      const pct = isIncomeGroup ? 0 : Utils.percentage(g.total, totalExpenses);
      const pctLabel = isIncomeGroup ? '' : `<span style="font-size:0.75rem; color:var(--text-secondary); margin-left: 6px;">(${pct}% ${Utils.t('ofTotal')})</span>`;
      const accordionId = `cat-accordion-${cat.id}-${g.type}`;
      
      g.transactions.sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      
      return `
        <div class="category-group-card" style="margin-bottom: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; transition: all 0.3s ease;">
          <div class="group-header" onclick="App.toggleCategoryAccordion('${accordionId}')" style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px; cursor:pointer; user-select:none; transition: background 0.2s;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div class="group-icon" style="background:${cat.color}15; width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.2rem;">
                ${cat.icon}
              </div>
              <div>
                <h4 style="font-size:0.95rem; font-weight:700; margin:0; color:var(--text-primary);">
                  ${Utils.getCategoryName(cat)}${isIncomeGroup ? ` (${Utils.t('income')})` : ''}
                </h4>
                <span style="font-size:0.75rem; color:var(--text-secondary);">
                  ${txCount} ${txCount === 1 ? Utils.t('transactionSingle') : Utils.t('transactionPlural')}
                </span>
              </div>
            </div>
            <div style="text-align: right; display:flex; align-items:center; gap:10px;">
              <div>
                <div style="font-size:1.05rem; font-weight:700; color:${isIncomeGroup ? 'var(--green)' : 'var(--text-primary)'};">
                  ${isIncomeGroup ? '+' : '-'}${Utils.formatMoney(g.total)}
                </div>
                ${pctLabel}
              </div>
              <span class="accordion-chevron" style="font-size:0.7rem; color:var(--text-muted); transition: transform 0.3s ease;">▼</span>
            </div>
          </div>
          
          ${!isIncomeGroup ? `
            <div style="height: 3px; width: 100%; background: rgba(255,255,255,0.05);">
              <div style="height: 100%; width: ${pct}%; background: ${cat.color}; transition: width 0.5s ease-out;"></div>
            </div>
          ` : ''}
          
          <div id="${accordionId}" class="accordion-panel" style="max-height: 0; overflow: hidden; transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1); background: rgba(0,0,0,0.15);">
            <div style="padding: 8px 12px; display: flex; flex-direction: column; gap: 8px;">
              ${g.transactions.map(tx => {
                const sign = tx.type === 'income' ? '+' : '-';
                const label = tx.description || Utils.getCategoryName(cat);
                return `
                  <div class="tx-item" data-id="${tx.id}" style="margin: 0; padding: 10px; border-radius: 8px; border: none; background: rgba(255,255,255,0.02);">
                    <div class="tx-info" style="flex:1;">
                      <div class="tx-info-top">
                        <div class="tx-date">${Utils.formatDate(tx.date)}</div>
                        <div class="tx-amount ${tx.type}">${sign}${Utils.formatMoney(tx.amount)}</div>
                      </div>
                      <div class="tx-desc" style="font-size:0.85rem; color:var(--text-primary); margin-top:2px;">${label}</div>
                    </div>
                    <div class="tx-actions">
                      <button class="tx-action-btn" onclick="App.editTransaction('${tx.id}')" title="${Utils.t('edit')}">✏️</button>
                      <button class="tx-action-btn" onclick="App.deleteTransactionConfirm('${tx.id}')" title="${Utils.t('delete')}">🗑</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  toggleCategoryAccordion(id) {
    const panel = document.getElementById(id);
    if (!panel) return;
    
    const card = panel.closest('.category-group-card');
    const chevron = card.querySelector('.accordion-chevron');
    const isCollapsed = !panel.style.maxHeight || panel.style.maxHeight === '0px';
    
    if (isCollapsed) {
      panel.style.maxHeight = panel.scrollHeight + 'px';
      if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
      panel.style.maxHeight = '0px';
      if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
    Utils.vibrate([8]);
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
      if (!inst.isSubscription) {
        grouped[inst.cardName].totalDebt += inst.monthlyAmount * (inst.installmentCount - inst.paidInstallments);
      }
    });

    let html = '';
    for (const cardName in grouped) {
      const g = grouped[cardName];
      const isPaid = txsThisMonth.some(t => t.category === 'credit_card' && t.description.includes(`Pago Tarjeta - ${cardName}`));
      const cardId = `card-details-${cardName.replace(/\s+/g, '-')}`;
      
      html += `
        <div class="card" style="margin-bottom: 16px; padding: 16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 12px;">
            <div onclick="App.toggleCardDetails('${cardId}')" style="cursor:pointer; flex:1">
              <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0;">💳 ${g.name} <span style="font-size:0.7rem; color:var(--text-muted)">▼</span></h3>
              <div style="font-size: 0.85rem; color: var(--text-secondary);">Deuda: ${Utils.formatMoney(g.totalDebt)}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.85rem; color: var(--text-secondary);">${isPaid ? 'A pagar el mes que viene' : 'A pagar este mes'}</div>
              <div style="font-size: 1.1rem; font-weight: 700; color: var(--yellow);">${Utils.formatMoney(g.totalMonthly)}</div>
              <div style="font-size: 0.75rem; color: ${isPaid ? 'var(--green)' : 'var(--red)'}; font-weight: 600;">
                ${isPaid ? '✅ PAGADO' : '⏳ ADEUDA'}
              </div>
            </div>
          </div>
          <button class="btn-primary" style="margin-bottom: 16px; padding: 10px;" onclick="App.openCardPayModal('${g.name}', ${g.totalMonthly}, ${isPaid})">
            Pagar Tarjeta
          </button>
          <div id="${cardId}" style="display:none; flex-direction:column; gap: 8px;">
            ${g.items.map(inst => {
              const isSub = !!inst.isSubscription;
              const remaining = isSub ? '∞' : (inst.installmentCount - inst.paidInstallments);
              const pct = isSub ? 100 : ((inst.paidInstallments / inst.installmentCount) * 100);
              const label = isSub ? 'Suscripción Recurrente' : `Cuota ${Math.min(inst.installmentCount, inst.paidInstallments + 1)} de ${inst.installmentCount}`;
              
              return `
                <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
                  <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                    <span style="font-weight: 500; font-size: 0.9rem;">${inst.productName} ${isSub ? '🔁' : ''}</span>
                    <span style="font-size: 0.9rem;">${Utils.formatMoney(inst.monthlyAmount)}</span>
                  </div>
                  <div class="inst-progress" style="height:4px; margin-bottom:6px;"><div class="inst-progress-fill" style="width:${pct}%"></div></div>
                  <div style="display:flex; justify-content:space-between; font-size: 0.75rem; color: var(--text-secondary);">
                    <span>${label}</span>
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

  toggleCardDetails(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const isHidden = el.style.display === 'none';
    el.style.display = isHidden ? 'flex' : 'none';
    
    // Rotate chevron
    const cardHeader = el.previousElementSibling.previousElementSibling;
    const chevron = cardHeader.querySelector('span');
    if (chevron) chevron.textContent = isHidden ? '▲' : '▼';
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
    this.renderRulesSettings();
    this.populateRulesCategorySelect();
  },

  renderCardSettings() {
    const s = DB.getSettings();
    const cards = s.cards || [];
    const list = document.getElementById('settingsCardList');
    if(list) {
      list.innerHTML = cards.map((c, i) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:8px;">
          <span>${c}</span>
          <div style="display:flex; gap:8px;">
            <button class="btn-secondary" style="padding:4px 8px; font-size:0.8rem; width:auto; margin:0;" onclick="App.editCardName(${i})">✏️</button>
            <button class="btn-secondary" style="padding:4px 8px; font-size:0.8rem; width:auto; margin:0;" onclick="App.deleteCardFromSettings(${i})">🗑</button>
          </div>
        </div>
      `).join('');
    }
  },

  editCardName(index) {
    const s = DB.getSettings();
    const cards = s.cards || [];
    const oldName = cards[index];
    const newName = prompt('Nuevo nombre de la tarjeta:', oldName);
    if (newName && newName.trim() !== '' && newName !== oldName) {
      cards[index] = newName.trim();
      DB.updateSetting('cards', cards);
      this.renderCardSettings();
      this.populateCardSelects();
      Utils.showToast('Tarjeta actualizada');
    }
  },

  addCardFromPage() {
    const bank = document.getElementById('pageCardBank').value.trim();
    const type = document.getElementById('pageCardType').value;
    if(!bank) { Utils.showToast('Ingresa el banco', 'warning'); return; }
    const cardName = `${bank} ${type}`;
    const s = DB.getSettings();
    const cards = s.cards || [];
    if(cards.includes(cardName)) { Utils.showToast('La tarjeta ya existe', 'warning'); return; }
    cards.push(cardName);
    DB.updateSetting('cards', cards);
    document.getElementById('pageCardBank').value = '';
    this.populateCardSelects();
    this.renderCards();
    Utils.showToast('✅ Tarjeta agregada');
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
      this.applyTranslations();
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
      this.applyTranslations();
      this.refreshUI();
    });
  },

  async manualMigration() {
    Utils.showToast('Buscando datos antiguos...', 'info');
    localStorage.removeItem('cc_db_migrated');
    await DB.migrate();
    this.refreshUI();
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
      const isSub = !!defaults.isSubscription;
      document.getElementById('modalIsSubscription').checked = isSub;
      document.getElementById('instCountGroup').style.display = isSub ? 'none' : 'block';
      document.getElementById('instCount').value = defaults.installmentCount && defaults.installmentCount < 9999 ? defaults.installmentCount : '';
      document.getElementById('instCard').value = defaults.cardName || '';
    }
    
    const salaryBtn = document.getElementById('addSalaryBtn');
    if (salaryBtn) salaryBtn.style.display = isExpense ? 'none' : 'block';
    document.getElementById('modalDesc').placeholder = isExpense ? '¿En qué gastaste?' : 'Descripción (opcional)';

    // Render categories
    this.renderCategoryGrid();
    this.updateInstallmentFieldsVisibility();
    this.resetAmounts();
  },

  updateInstallmentFieldsVisibility() {
    const type = document.getElementById('modalType').value;
    const cat = document.getElementById('modalCategory').value;
    const instFields = document.getElementById('installmentFields');
    if (instFields) {
      instFields.style.display = (type === 'expense' && cat === 'credit_card') ? 'block' : 'none';
    }
  },

  addAmountToList() {
    const input = document.getElementById('modalAmount');
    const val = parseFloat(input.value);
    if (!val || val <= 0) return;
    
    this.pendingAmounts.push(val);
    input.value = '';
    this.updateSumDisplay();
    Utils.vibrate([10]);
  },

  updateSumDisplay() {
    const display = document.getElementById('amountSumDisplay');
    if (this.pendingAmounts.length > 0) {
      const sum = this.pendingAmounts.reduce((a, b) => a + b, 0);
      display.textContent = `Suma total: ${Utils.formatMoney(sum)} (${this.pendingAmounts.length} montos)`;
      display.style.display = 'block';
    } else {
      display.style.display = 'none';
    }
  },

  resetAmounts() {
    this.pendingAmounts = [];
    this.updateSumDisplay();
  },

  renderCategoryGrid() {
    const type = document.getElementById('modalType').value;
    const cats = Utils.defaultCategories.filter(c => {
      if (c.id === 'carry_over') return false;
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
    let amount = parseFloat(document.getElementById('modalAmount').value) || 0;
    
    // Add pending amounts if any
    if (this.pendingAmounts.length > 0) {
      amount += this.pendingAmounts.reduce((a, b) => a + b, 0);
    }

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
        
        // Auto-learn/update categorization rule
        if (description && description.trim().length > 0 && description.trim().length <= 35) {
          const cleaned = Utils.cleanKeyword(description);
          if (cleaned) {
            this.learningRules[cleaned] = category;
            await DB.saveLearningRule(cleaned, category);
          }
        }
        
        Utils.showToast('✅ Editado correctamente');
      }
      this.editingTransaction = null;
    } else {
      // If installment purchase
      const isSubscription = document.getElementById('modalIsSubscription').checked;
      if (type === 'expense' && (isSubscription || (instCount && parseInt(instCount) >= 1))) {
        await DB.addInstallment({
          productName: description || Utils.getCategoryName(Utils.getCategoryById(category)),
          totalAmount: amount,
          installmentCount: isSubscription ? 9999 : parseInt(instCount),
          cardName: instCard || 'Visa',
          startDate: date,
          isSubscription: isSubscription
        });
        const msg = isSubscription ? '✅ Suscripción guardada' : `✅ ${Utils.t('saved')} — ${instCount} cuotas de ${Utils.formatMoney(amount / parseInt(instCount))}`;
        Utils.showToast(msg);
        
        // Auto-learn categorization rule for installments
        const instDesc = description || Utils.getCategoryName(Utils.getCategoryById(category));
        if (instDesc && instDesc.trim().length > 0 && instDesc.trim().length <= 35) {
          const cleaned = Utils.cleanKeyword(instDesc);
          if (cleaned) {
            this.learningRules[cleaned] = category;
            await DB.saveLearningRule(cleaned, category);
          }
        }
      } else {
        await DB.addTransaction({ type, amount, category, description, date });
        
        // Auto-learn categorization rule
        if (description && description.trim().length > 0 && description.trim().length <= 35) {
          const cleaned = Utils.cleanKeyword(description);
          if (cleaned) {
            this.learningRules[cleaned] = category;
            await DB.saveLearningRule(cleaned, category);
          }
        }
        
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
    document.getElementById('instTotalAmount').value = defaults.totalAmount || (defaults.isSubscription ? defaults.monthlyAmount : '');
    
    const isSub = !!defaults.isSubscription;
    document.getElementById('instIsSubscription').checked = isSub;
    document.getElementById('instModalCountsGroup').style.display = isSub ? 'none' : 'block';
    document.getElementById('instTotalCount').value = (isSub || !defaults.installmentCount || defaults.installmentCount >= 9999) ? '' : defaults.installmentCount;
    
    const paidCountEl = document.getElementById('instPaidCount');
    if (paidCountEl) {
      paidCountEl.value = defaults.id ? (defaults.paidInstallments + 1) : 1;
    }
    
    const cardField = document.getElementById('instCardName');
    cardField.value = defaults.cardName || 'Visa';

    // Reset validation styles and values
    const fields = ['instProductName', 'instTotalAmount', 'instTotalCount', 'instPaidCount'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.borderColor = '';
    });

    this.setInstAmountMode('total');
    
    // Toggle mode group visibility based on subscription
    const updateVisibility = () => {
      const isSub = document.getElementById('instIsSubscription').checked;
      document.getElementById('instAmountModeGroup').style.display = isSub ? 'none' : 'block';
      if (isSub) this.setInstAmountMode('monthly');
      else this.setInstAmountMode('total');
    };
    
    document.getElementById('instIsSubscription').onchange = updateVisibility;
    updateVisibility();

    // Close on overlay click
    document.getElementById('instModalOverlay').onclick = (e) => {
      if (e.target === e.currentTarget) {
        document.getElementById('instModalOverlay').classList.remove('open');
      }
    };
  },

  setInstAmountMode(mode) {
    const isTotal = mode === 'total';
    document.getElementById('instAmountMode').value = mode;
    document.getElementById('modeTotal').classList.toggle('active', isTotal);
    document.getElementById('modeMonthly').classList.toggle('active', !isTotal);
    document.getElementById('instAmountLabel').textContent = isTotal ? 'Monto Total de la Compra' : 'Monto de cada Cuota (Mensual)';
    document.getElementById('instTotalAmount').placeholder = isTotal ? '0.00' : '0.00';
  },

  async saveInstallment() {
    const editId = document.getElementById('editingInstallmentId').value;
    const name = document.getElementById('instProductName').value;
    let amount = parseFloat(document.getElementById('instTotalAmount').value);
    const amountMode = document.getElementById('instAmountMode').value;
    const isSubscription = document.getElementById('instIsSubscription').checked;
    const count = isSubscription ? 9999 : parseInt(document.getElementById('instTotalCount').value);

    if (amountMode === 'monthly' && !isSubscription) {
      amount = amount * count;
    }

    // Usuario ingresa "Cuota actual", nosotros guardamos "Cuotas pagadas" (actual - 1)
    const currentCount = isSubscription ? 1 : (parseInt(document.getElementById('instPaidCount')?.value) || 1);
    const paidCount = Math.max(0, currentCount - 1);
    const card = document.getElementById('instCardName').value;

    // Reset styles
    const fields = ['instProductName', 'instTotalAmount', 'instTotalCount', 'instPaidCount'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.borderColor = '';
    });

    if (!name) {
      document.getElementById('instProductName').style.borderColor = 'var(--red)';
      Utils.showToast('Ingresá el nombre del producto', 'error');
      return;
    }
    if (!amount || amount <= 0) {
      document.getElementById('instTotalAmount').style.borderColor = 'var(--red)';
      Utils.showToast('Ingresá un monto válido', 'error');
      return;
    }
    if (!isSubscription) {
      if (!count || count < 1) {
        document.getElementById('instTotalCount').style.borderColor = 'var(--red)';
        Utils.showToast('La cantidad de cuotas debe ser al menos 1', 'error');
        return;
      }
      if (currentCount < 1 || currentCount > count) {
        document.getElementById('instPaidCount').style.borderColor = 'var(--red)';
        Utils.showToast('La cuota actual no es válida', 'error');
        return;
      }
    }

    if (editId) {
      const inst = await DB.getInstallment(editId);
      if (inst) {
        inst.productName = name;
        inst.totalAmount = amount;
        inst.installmentCount = count;
        inst.paidInstallments = paidCount;
        inst.cardName = card || 'Visa';
        inst.isSubscription = isSubscription;
        await DB.updateInstallment(inst);
        Utils.showToast('✅ Actualizado correctamente');
      }
    } else {
      await DB.addInstallment({
        productName: name,
        totalAmount: amount,
        installmentCount: count,
        paidCount: paidCount,
        cardName: card || 'Visa',
        isSubscription: isSubscription
      });
      const msg = isSubscription ? '✅ Suscripción guardada' : `✅ ${count} cuotas de ${Utils.formatMoney(amount / count)}`;
      Utils.showToast(msg);
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
        const productName = parsed.description || Utils.getCategoryName(Utils.getCategoryById(parsed.category));
        await DB.addInstallment({
          productName: productName,
          totalAmount: parsed.amount,
          installmentCount: parsed.isSubscription ? 9999 : (parsed.installmentCount || 12),
          cardName: parsed.cardName || defaultCard,
          startDate: Utils.getToday(),
          isSubscription: !!parsed.isSubscription
        });
        const msg = parsed.isSubscription ? `✅ Suscripción guardada: ${Utils.formatMoney(parsed.amount)}` : `✅ Guardado: ${parsed.installmentCount} cuotas de ${Utils.formatMoney(parsed.amount / parsed.installmentCount)}`;
        Utils.showToast(msg);
        
        // Auto-learn rule from voice installment
        if (productName && productName.trim().length > 0 && productName.trim().length <= 35) {
          const cleaned = Utils.cleanKeyword(productName);
          if (cleaned) {
            this.learningRules[cleaned] = parsed.category;
            await DB.saveLearningRule(cleaned, parsed.category);
          }
        }
      } else {
        await DB.addTransaction({
          type: parsed.type,
          amount: parsed.amount,
          category: parsed.category,
          description: parsed.description,
          date: Utils.getToday()
        });
        
        // Auto-learn rule from voice transaction
        if (parsed.description && parsed.description.trim().length > 0 && parsed.description.trim().length <= 35) {
          const cleaned = Utils.cleanKeyword(parsed.description);
          if (cleaned) {
            this.learningRules[cleaned] = parsed.category;
            await DB.saveLearningRule(cleaned, parsed.category);
          }
        }
        
        Utils.showToast('✅ Guardado por voz');
      }
      Utils.vibrate([10, 50, 10]);
      this.closeModal();
      this.navigate('dashboard');
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

  // ===== TRANSLATIONS & LEARNING RULES HELPERS =====
  applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = Utils.t(key);
      if (text !== key) {
        el.innerHTML = text;
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const text = Utils.t(key);
      if (text !== key) {
        el.placeholder = text;
      }
    });
  },

  populateRulesCategorySelect() {
    const select = document.getElementById('newRuleCategory');
    if (select) {
      select.innerHTML = Utils.defaultCategories
        .map(c => `<option value="${c.id}">${c.icon} ${Utils.getCategoryName(c)}</option>`)
        .join('');
    }
  },

  renderRulesSettings() {
    const listEl = document.getElementById('settingsRulesList');
    if (!listEl) return;
    
    const rules = Object.entries(this.learningRules);
    if (rules.length === 0) {
      listEl.innerHTML = `
        <div style="font-size:0.8rem; color:var(--text-secondary); text-align:center; padding:16px;" data-i18n="noRules">
          ${Utils.t('noRules')}
        </div>
      `;
      return;
    }
    
    rules.sort((a, b) => a[0].localeCompare(b[0]));
    
    listEl.innerHTML = rules.map(([keyword, categoryId]) => {
      const cat = Utils.getCategoryById(categoryId);
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); padding:8px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.03);">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-size:0.9rem; font-weight:600; color:var(--text-primary);">${keyword}</span>
            <span style="font-size:0.75rem; color:${cat.color}; font-weight:500; display:flex; align-items:center; gap:4px;">
              <span>${cat.icon}</span> <span>${Utils.getCategoryName(cat)}</span>
            </span>
          </div>
          <button class="btn-secondary" style="padding:6px 10px; font-size:0.8rem; width:auto; margin:0; background:none; border:none; opacity:0.8; cursor:pointer;" onclick="App.deleteCustomRule('${keyword.replace(/'/g, "\\'")}')" title="${Utils.t('delete')}">🗑</button>
        </div>
      `;
    }).join('');
  },

  async addCustomRuleFromSettings() {
    const keywordInput = document.getElementById('newRuleKeyword');
    const categorySelect = document.getElementById('newRuleCategory');
    if (!keywordInput || !categorySelect) return;
    
    const rawKeyword = keywordInput.value.trim();
    const category = categorySelect.value;
    
    if (!rawKeyword) {
      Utils.showToast(Utils.t('enterKeywordError'), 'error');
      keywordInput.style.borderColor = 'var(--red)';
      return;
    }
    keywordInput.style.borderColor = '';
    
    const cleaned = Utils.cleanKeyword(rawKeyword);
    if (!cleaned) {
      Utils.showToast(Utils.t('enterKeywordError'), 'error');
      return;
    }
    
    this.learningRules[cleaned] = category;
    await DB.saveLearningRule(cleaned, category);
    
    keywordInput.value = '';
    this.renderRulesSettings();
    Utils.showToast(Utils.t('ruleAdded'));
    Utils.vibrate([10]);
  },

  async deleteCustomRule(keyword) {
    const cleaned = Utils.cleanKeyword(keyword);
    if (this.learningRules[cleaned]) {
      delete this.learningRules[cleaned];
      await DB.deleteLearningRule(cleaned);
      this.renderRulesSettings();
      Utils.showToast(Utils.t('deleted'));
      Utils.vibrate([10]);
    }
  },

  toggleSettingsGroup(id) {
    const panel = document.getElementById(id);
    if (!panel) return;
    
    const isHidden = !panel.style.display || panel.style.display === 'none';
    panel.style.display = isHidden ? 'flex' : 'none';
    
    // Rotate chevron
    const header = panel.previousElementSibling;
    const chevron = header ? header.querySelector('.settings-chevron') : null;
    if (chevron) {
      chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
    Utils.vibrate([8]);
  },
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
