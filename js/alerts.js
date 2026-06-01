// ============================================================
// CuentaClara — Smart Alerts Module
// ============================================================

const Alerts = {
  activeAlerts: [],

  async checkAll() {
    this.activeAlerts = [];
    const now = new Date();
    const monthYear = Utils.getMonthYear(now);
    const summary = await DB.getMonthSummary(monthYear);
    const settings = DB.getSettings();
    const budgets = await DB.getAllBudgets();

    // 1. Income excess alert
    if (settings.monthlyIncome > 0) {
      const pct = Utils.percentage(summary.totalExpenses, settings.monthlyIncome);
      if (pct >= 100) {
        this.activeAlerts.push({
          id: 'excess-100', type: 'danger', icon: '🚨',
          message: Utils.t('alertExcess', { pct: pct }),
          detail: `${Utils.formatMoney(summary.totalExpenses)} / ${Utils.formatMoney(settings.monthlyIncome)}`,
        });
      } else if (pct >= 80) {
        this.activeAlerts.push({
          id: 'excess-80', type: 'warning', icon: '⚠️',
          message: Utils.t('alertExcess', { pct: pct }),
          detail: `${Utils.formatMoney(summary.totalExpenses)} / ${Utils.formatMoney(settings.monthlyIncome)}`,
        });
      }
    }

    // 2. Budget alerts per category
    for (const budget of budgets) {
      const spent = summary.byCategory[budget.category] || 0;
      const pct = Utils.percentage(spent, budget.amount);
      if (pct >= 100) {
        const cat = Utils.getCategoryById(budget.category);
        this.activeAlerts.push({
          id: `budget-${budget.category}`, type: 'danger', icon: cat.icon,
          message: Utils.t('alertBudget', { cat: Utils.getCategoryName(cat) }),
          detail: `${Utils.formatMoney(spent)} / ${Utils.formatMoney(budget.amount)} (${pct}%)`,
        });
      } else if (pct >= 75) {
        const cat = Utils.getCategoryById(budget.category);
        this.activeAlerts.push({
          id: `budget-${budget.category}`, type: 'warning', icon: cat.icon,
          message: Utils.t('alertBudget', { cat: Utils.getCategoryName(cat) }),
          detail: `${Utils.formatMoney(spent)} / ${Utils.formatMoney(budget.amount)} (${pct}%)`,
        });
      }
    }

    // 3. Category anomaly detection (compare to last month average)
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevSummary = await DB.getMonthSummary(Utils.getMonthYear(prevMonth));
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectionFactor = daysInMonth / dayOfMonth;

    for (const [catId, amount] of Object.entries(summary.byCategory)) {
      const prevAmount = prevSummary.byCategory[catId] || 0;
      if (prevAmount > 0) {
        const projected = amount * projectionFactor;
        if (projected > prevAmount * 1.5 && amount > 1000) {
          const cat = Utils.getCategoryById(catId);
          this.activeAlerts.push({
            id: `anomaly-${catId}`, type: 'info', icon: '📊',
            message: Utils.t('alertCategory', { cat: Utils.getCategoryName(cat) }),
            detail: Utils.t('alertCategoryDetail', { current: Utils.formatMoney(amount), prev: Utils.formatMoney(prevAmount) }),
          });
        }
      }
    }

    // 4. Credit card installment alerts
    const instSummary = await DB.getInstallmentSummary();
    if (instSummary.monthlyPayment > 0 && settings.monthlyIncome > 0) {
      const cardPct = Utils.percentage(instSummary.monthlyPayment, settings.monthlyIncome);
      if (cardPct >= 30) {
        this.activeAlerts.push({
          id: 'card-high', type: 'warning', icon: '💳',
          message: Utils.t('alertCardHigh', { pct: cardPct }),
          detail: Utils.t('alertCardHighDetail', { amount: Utils.formatMoney(instSummary.monthlyPayment) }),
        });
      }
    }

    return this.activeAlerts;
  },

  getStatusColor(settings, summary) {
    if (!settings.monthlyIncome || settings.monthlyIncome === 0) return 'good';
    const pct = Utils.percentage(summary.totalExpenses, settings.monthlyIncome);
    if (pct >= 100) return 'danger';
    if (pct >= 75) return 'warning';
    return 'good';
  },

  renderAlerts(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (this.activeAlerts.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    container.innerHTML = this.activeAlerts.map(alert => `
      <div class="alert-card alert-${alert.type}" data-alert-id="${alert.id}">
        <div class="alert-icon">${alert.icon}</div>
        <div class="alert-content">
          <div class="alert-message">${alert.message}</div>
          <div class="alert-detail">${alert.detail}</div>
        </div>
        <button class="alert-dismiss" onclick="this.closest('.alert-card').classList.add('alert-dismissed')" aria-label="Dismiss">×</button>
      </div>
    `).join('');
  },
};
