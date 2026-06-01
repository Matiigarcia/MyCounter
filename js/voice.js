// ============================================================
// CuentaClara — Voice Recognition Module
// ============================================================

const Voice = {
  recognition: null,
  isListening: false,
  onResult: null,
  onStateChange: null,
  onParsed: null,

  init() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;
    this.recognition = new SR();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.updateLanguage();

    this.recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const transcript = last[0].transcript;
      if (this.onResult) this.onResult(transcript, last.isFinal);
      if (last.isFinal) {
        this.stop();
        if (this.onParsed) this.onParsed(this.parseTransaction(transcript), transcript);
      }
    };
    this.recognition.onerror = (event) => {
      this.isListening = false;
      if (this.onStateChange) this.onStateChange(false);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        Utils.showToast(Utils.t('voiceError'), 'error');
      }
    };
    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onStateChange) this.onStateChange(false);
    };
    return true;
  },

  updateLanguage() {
    if (this.recognition) this.recognition.lang = Utils.currentLang === 'es' ? 'es-AR' : 'en-US';
  },

  start() {
    if (!this.recognition && !this.init()) { Utils.showToast(Utils.t('voiceError'), 'error'); return; }
    this.updateLanguage();
    try { this.recognition.start(); this.isListening = true; if (this.onStateChange) this.onStateChange(true); Utils.vibrate([15]); } catch(e) {}
  },

  stop() {
    if (this.recognition && this.isListening) { this.recognition.stop(); this.isListening = false; if (this.onStateChange) this.onStateChange(false); }
  },

  toggle() { this.isListening ? this.stop() : this.start(); },

  parseTransaction(text) {
    const lower = text.toLowerCase().trim();
    const result = { type: 'expense', amount: 0, category: 'other', description: text, confidence: 0 };

    const expW = ['gasté','gaste','pagué','pague','compré','compre','spent','paid','bought'];
    const incW = ['cobré','cobre','recibí','recibi','gané','gane','ingresé','ingrese','earned','received','got paid'];

    if (incW.some(w => lower.includes(w))) { result.type = 'income'; result.confidence += 0.3; }
    else if (expW.some(w => lower.includes(w))) { result.confidence += 0.3; }

    const amount = Utils.parseSpokenNumber(lower);
    if (amount > 0) { result.amount = amount; result.confidence += 0.4; }

    let foundLearned = false;
    if (typeof App !== 'undefined' && App.learningRules) {
      const sortedKeywords = Object.keys(App.learningRules).sort((a, b) => b.length - a.length);
      const cleanSpoken = Utils.cleanKeyword(lower);
      for (const keyword of sortedKeywords) {
        const cleanKw = Utils.cleanKeyword(keyword);
        if (cleanKw && cleanSpoken.includes(cleanKw)) {
          result.category = App.learningRules[keyword];
          result.confidence += 0.5;
          foundLearned = true;
          break;
        }
      }
    }

    if (!foundLearned) {
      const catKw = {
        food: ['comida','comer','carniceria','verdulerias','delivery','cena','cenas','restaurant','restaurante','rappi','pedidosya','café','pizza'],
        supermarket: ['super','supermercado','coto','carrefour','mercadito','jumbo','superchino','chino','mercado','grocery'],
        transport: ['taxi','uber','colectivo','bondi','subte','nafta','combustible','transport','gas','fuel','bus'],
        services: ['luz','agua','internet','teléfono','telefono','celular','cable','servicios','electricity','phone','wifi'],
        health: ['médico','medico','farmacia','doctor','hospital','salud','health','medicine','pharmacy'],
        entertainment: ['cine','netflix','spotify','juego','salida','bar','streaming','movie','game','teatro'],
        clothing: ['ropa','zapatos','zapatillas','camisa','remera','clothes','shoes','shirt'],
        education: ['curso','libro','escuela','universidad','facultad','course','book','school'],
        home: ['alquiler','expensas','mueble','hogar','casa','rent','home','furniture'],
        savings: ['ahorro','inversión','plazo fijo','dólar','savings','investment'],
        salary: ['sueldo','salario','salary','paycheck'],
        freelance: ['freelance','proyecto','cliente','project','client'],
      };

      for (const [catId, kws] of Object.entries(catKw)) {
        if (kws.some(kw => lower.includes(kw))) { result.category = catId; result.confidence += 0.3; break; }
      }
    }

    const instMatch = lower.match(/(\d+)\s*(cuotas?|installments?)/);
    if (instMatch) result.installmentCount = parseInt(instMatch[1]);

    const subW = ['suscripción', 'suscripcion', 'mensual', 'recurrente', 'subscription', 'monthly', 'recurring'];
    if (subW.some(w => lower.includes(w))) {
      result.isSubscription = true;
      result.confidence += 0.3;
    }

    const cardMatch = lower.match(/con\s+(visa|mastercard|master|amex|cabal|naranja)/i);
    if (cardMatch) result.cardName = cardMatch[1].charAt(0).toUpperCase() + cardMatch[1].slice(1);

    let desc = text.replace(/\d+[\d.,]*/g, '').trim();
    [...expW, ...incW].forEach(w => { desc = desc.replace(new RegExp(w, 'gi'), '').trim(); });
    desc = desc.replace(/\s*(pesos|dolares|en|de|por)\s*/gi, ' ').trim();
    if (desc.length > 2) result.description = desc.charAt(0).toUpperCase() + desc.slice(1);

    return result;
  },

  isSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },
};
