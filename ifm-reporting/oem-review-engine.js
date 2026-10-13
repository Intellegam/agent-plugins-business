/*
 * OEM Superservice review — data engine (JavaScript, runs in the IC TypeScript tool or Node).
 * Port of build_review.py. Takes parsed input rows, returns the data object that the
 * dashboard template (oem-review-template.html) renders, and renders the final HTML.
 *
 * Usage:
 *   const data = buildReviewData(inputs, config);
 *   const html = renderReviewHtml(templateText, data);
 *
 * inputs = {
 *   quotes:      [rows, rows, ...]   // one array of row objects per quote file (XLSX.utils.sheet_to_json(ws, {raw:true}))
 *   dealers:     rows | null         // dealer numbers (wide: Country, January..; or long: country, month, dealers)
 *   networkRef:  rows | null         // network_reference.csv rows
 *   history:     rows | null         // year, month, market, dealers, active, quotes, d20, d50, d100
 *   sst, ssc, helpdesk: object|null  // JSON as documented
 *   pdca:        {sheetName: arrayOfArrays} | null   // XLSX.utils.sheet_to_json(ws, {header:1})
 * }
 */
(function (root) {
  'use strict';
  const ISO = {AT:'Austria',BE:'Belgium',BG:'Bulgaria',CH:'Switzerland',CY:'Cyprus',CZ:'Czech Republic',DE:'Germany',DK:'Denmark',
    EE:'Estonia',ES:'Spain',FI:'Finland',FR:'France',GB:'United Kingdom',UK:'United Kingdom',GR:'Greece',HR:'Croatia',HU:'Hungary',
    IE:'Ireland',IS:'Iceland',IT:'Italy',LT:'Lithuania',LU:'Luxembourg',LV:'Latvia',MT:'Malta',NL:'Netherlands',NO:'Norway',PL:'Poland',
    PT:'Portugal',RO:'Romania',RS:'Serbia',SE:'Sweden',SI:'Slovenia',SK:'Slovak Republic',TR:'Turkey',UA:'Ukraine',ZA:'South Africa',
    IL:'Israel',AE:'United Arab Emirates',SA:'Saudi Arabia',MA:'Morocco',EG:'Egypt'};
  const MABBR = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MFULL = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  const CP1252 = {'€':0x80,'‚':0x82,'ƒ':0x83,'„':0x84,'…':0x85,'†':0x86,'‡':0x87,'ˆ':0x88,'‰':0x89,'Š':0x8a,'‹':0x8b,'Œ':0x8c,'Ž':0x8e,
    '‘':0x91,'’':0x92,'“':0x93,'”':0x94,'•':0x95,'–':0x96,'—':0x97,'˜':0x98,'™':0x99,'š':0x9a,'›':0x9b,'œ':0x9c,'ž':0x9e,'Ÿ':0x9f};

  // ---------------------------------------------------------------- helpers
  function fixText(s) {
    if (typeof s !== 'string' || !/[ÃÂâ]/.test(s)) return s;
    const bytes = [];
    for (const ch of s) {
      const c = ch.codePointAt(0);
      if (c <= 255) bytes.push(c); else if (CP1252[ch] !== undefined) bytes.push(CP1252[ch]); else return s;
    }
    try { return new TextDecoder('utf-8', {fatal: true}).decode(new Uint8Array(bytes)); } catch (e) { return s; }
  }
  const countryName = x => { x = String(x).trim(); return x.length <= 3 ? (ISO[x.toUpperCase()] || x) : x; };
  function monthNo(v) {
    if (typeof v === 'number' && isFinite(v)) return Math.trunc(v);
    const s = String(v).trim().toLowerCase();
    const i = MABBR.findIndex(m => m && m.toLowerCase() === s.slice(0, 3));
    return i > 0 ? i : null;
  }
  const lowerKeys = row => { const o = {}; for (const k in row) o[String(k).toLowerCase().trim()] = row[k]; return o; };
  const r1 = x => Math.round(x * 10) / 10;
  function toDate(v) {
    if (v instanceof Date) { const t = v.getTime() - v.getTimezoneOffset() * 60000; return new Date(Math.round(t / 86400000) * 86400000); }   // snap to calendar day
    if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000));        // Excel serial
    const s = String(v).trim();
    if (/^\d{6}$/.test(s)) return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, 1));
    const m = s.match(/^([A-Za-z]{3})[- ](\d{4})$/);                                        // "Sep-2026"
    if (m) return new Date(Date.UTC(+m[2], monthNo(m[1]) - 1, 1));
    return new Date(s);
  }
  const ymOf = d => [d.getUTCFullYear(), d.getUTCMonth() + 1];

  // ---------------------------------------------------------------- quotes
  function loadQuotes(files, cfg, dq) {
    const apps = (cfg.apps || ['Menus']).map(s => s.toLowerCase());
    const statuses = (cfg.quote_statuses || ['Quotation', 'Appointment']).map(s => s.toLowerCase());
    const regions = (cfg.regions || ['Europe', 'MEA', 'Middle East/Africa', 'Middle East / Africa']).map(s => s.toLowerCase());
    const fr = (cfg.franchise || cfg.oem).toLowerCase();
    const agg = new Map(); let fixed = 0;
    for (const rows of files) {
      if (!rows.length) continue;
      const k0 = lowerKeys(rows[0]);
      const corrected = 'count_of_quotes' in k0, raw = 'num quotes' in k0;
      if (!corrected && !raw) throw new Error('Unknown quote file format: ' + Object.keys(rows[0]).slice(0, 12).join(', '));
      for (const r0 of rows) {
        const r = lowerKeys(r0); let d, country, dealer, q;
        if (corrected) {
          if ('status' in r && !statuses.includes(String(r.status).toLowerCase())) continue;
          if ('applicationsource' in r && !apps.includes(String(r.applicationsource).toLowerCase())) continue;
          d = toDate(r.date_reporting_local); country = countryName(r.country); dealer = String(r.name); q = +r.count_of_quotes || 0;
        } else {
          const f = r.quote_franchise ?? r.franchise, ap = r.applicationsource ?? r['app source'] ?? r.app_source;
          if (f !== undefined && String(f).toLowerCase() !== fr) continue;
          if (ap !== undefined && !apps.includes(String(ap).toLowerCase())) continue;
          if (r.region !== undefined && !regions.includes(String(r.region).toLowerCase())) continue;
          d = toDate(r.order_by !== undefined ? String(Math.trunc(+r.order_by)) : (r['year month'] ?? r.month));
          country = countryName(r.country); dealer = String(r['dealer name']); q = +r['num quotes'] || 0;
        }
        if (!(q > 0)) continue;
        const fx = fixText(dealer).trim(); if (fx !== dealer.trim()) fixed++;
        const [y, m] = ymOf(d); const key = `${y}|${m}|${country}|${fx}`;
        agg.set(key, (agg.get(key) || 0) + q);
      }
    }
    if (fixed) dq.push(`<b>Dealer names repaired.</b> ${fixed.toLocaleString('en-US')} rows had garbled characters (UTF-8 read as Latin-1, e.g. “AUTOMOCIÃ“N”); they were converted back.`);
    const out = [];
    for (const [k, v] of agg) { const [y, m, c, dl] = k.split('|'); out.push({year: +y, month: +m, country: c, dealer: dl, quotes: v}); }
    return out;
  }

  // ---------------------------------------------------------------- dealer numbers / network
  function loadDealers(rows, year) {
    const out = {}; if (!rows || !rows.length) return out;
    const k0 = Object.keys(rows[0]), lk = k0.map(k => k.toLowerCase().trim());
    if (lk.includes('dealers') && lk.includes('month')) {
      for (const r0 of rows) { const r = lowerKeys(r0); if (r.year !== undefined && +r.year !== year) continue;
        const c = countryName(r.country); (out[c] = out[c] || {})[monthNo(r.month)] = Math.trunc(+r.dealers); }
    } else {
      const ccol = k0[0], mcols = k0.slice(1).map(c => [c, monthNo(c)]).filter(x => x[1]);
      for (const r of rows) { const name = String(r[ccol] ?? '').trim();
        if (!name || ['total', 'nan', 'undefined'].includes(name.toLowerCase())) continue;
        const c = countryName(name);
        for (const [col, m] of mcols) if (r[col] !== undefined && r[col] !== null && r[col] !== '') (out[c] = out[c] || {})[m] = Math.trunc(+r[col]); }
    }
    return out;
  }
  function loadNetworkRef(rows, franchise) {
    const out = {}; if (!rows) return out;
    for (const r of rows) {
      if ('franchise' in r) {
        if (String(r.franchise).toLowerCase() !== franchise.toLowerCase()) continue;
        for (const c of String(r.data_countries).split('|')) out[c.trim()] = (out[c.trim()] || 0) + Math.trunc(+r.network);
      } else out[countryName(r.country ?? r.Country)] = Math.trunc(+(r.network ?? r.dealers));
    }
    return out;
  }

  // ---------------------------------------------------------------- PDCA
  function loadPdca(sheets) {
    const out = {}; if (!sheets) return out;
    const clean = v => v === null || v === undefined ? '' : String(v).replace(/​/g, '').replace(/ /g, ' ').trim();
    for (const [title, rows] of Object.entries(sheets)) {
      const key = ['ssm', 'sst', 'ssc'].find(k => title.toLowerCase().includes(k));
      if (!key || out[key]) continue;
      const phases = []; let ph = null;
      rows.forEach((r, i) => {
        if (i === 0 || ph === false) return;
        const [a, b, c, d, e] = [0, 1, 2, 3, 4].map(j => clean(r[j]));
        if (a.toUpperCase().startsWith('PDCA')) { ph = false; return; }
        if (!a && !b) return;
        if (!b && /^(PLAN|DO|CHECK|ACT)\b/i.test(a)) { ph = {title: a, rows: []}; phases.push(ph); return; }
        if (!ph) { ph = {title: 'PLAN', rows: []}; phases.push(ph); }
        ph.rows.push({task: b, owner: c, non: !!d, low: !!e});
      });
      if (phases.length) out[key] = phases;
    }
    return out;
  }

  const LB = m => m === 'United Kingdom' ? 'UK' : m;
  const uniqSorted = a => [...new Set(a)].sort();

  // ---------------------------------------------------------------- main
  function buildReviewData(inputs, cfg) {
    const dq = [], flags = [];
    const q = loadQuotes(inputs.quotes, cfg, dq);
    const year = +(cfg.year || Math.max(...q.map(r => r.year)));
    const cy = q.filter(r => r.year === year);
    const mMin = Math.min(...cy.map(r => r.month)), mMax = Math.max(...cy.map(r => r.month));
    const months = []; for (let m = mMin; m <= mMax; m++) months.push(m);
    const n = months.length, mlab = months.map(m => MABBR[m]), mfull = months.map(m => MFULL[m]);

    const coreCfg = cfg.core_markets;
    let markets = uniqSorted([...cy.map(r => r.country), ...(coreCfg || [])]);
    const core = new Set(coreCfg || markets);
    const hasOther = !!coreCfg && markets.some(m => !core.has(m));
    const dealersFile = inputs.dealers ? loadDealers(inputs.dealers, year) : {};
    const netref = inputs.networkRef ? loadNetworkRef(inputs.networkRef, cfg.franchise || cfg.oem) : {};
    markets = uniqSorted([...markets, ...Object.keys(dealersFile)]);
    const hasDF = Object.keys(dealersFile).length > 0;

    // dealer-month aggregation for the year
    const dm = new Map();       // country -> Map(dealer -> {month: quotes})
    for (const r of cy) { if (!dm.has(r.country)) dm.set(r.country, new Map()); const md = dm.get(r.country);
      if (!md.has(r.dealer)) md.set(r.dealer, {}); md.get(r.dealer)[r.month] = (md.get(r.dealer)[r.month] || 0) + r.quotes; }
    const trend = {}, missing = [], est = [];
    for (const mk of markets) {
      const md = dm.get(mk) || new Map();
      const active = months.map(m => [...md.values()].filter(x => (x[m] || 0) > 0).length);
      const quotes = months.map(m => [...md.values()].reduce((s, x) => s + (x[m] || 0), 0));
      let netm, src;
      if (dealersFile[mk] && months.every(m => dealersFile[mk][m] !== undefined)) { netm = months.map(m => dealersFile[mk][m]); src = 'file'; }
      else if (mk in netref) { netm = months.map(() => netref[mk]); src = hasDF ? 'ref' : 'file'; if (hasDF) missing.push(mk); }
      else { netm = months.map(() => Math.max(...active) || 1); src = 'est'; est.push(mk); }
      trend[mk] = {core: core.has(mk), netm, net_src: src, network: netm[n - 1], active, quotes};
    }
    const dealers = [];
    for (const c of [...dm.keys()].sort()) for (const d of [...dm.get(c).keys()].sort()) dealers.push([c, d, ...months.map(m => dm.get(c).get(d)[m] || 0)]);

    // windows
    let A, B, Alab, Blab;
    const qlab = ix => months[ix[0]] % 3 === 1 ? `Q${Math.floor((months[ix[0]] - 1) / 3) + 1}` : `${mlab[ix[0]]}–${mlab[ix[ix.length - 1]]}`;
    if (n >= 6) { A = [0, 1, 2]; B = [n - 3, n - 2, n - 1]; Alab = qlab(A); Blab = qlab(B); }
    else if (n >= 2) { A = [0]; B = [n - 1]; Alab = mlab[0]; Blab = mlab[n - 1]; }
    else { A = [0]; B = [0]; Alab = Blab = mlab[0]; }

    // year over year
    const merge = cfg.merge_markets || {};
    const yoyMarkets = [];
    for (const mk of [...core].sort()) { const g = Object.keys(merge).find(k => merge[k].includes(mk)) || mk; if (!yoyMarkets.includes(g)) yoyMarkets.push(g); }
    const members = g => merge[g] || [g];
    let qm = months.slice(-3).filter(m => Math.floor((m - 1) / 3) === Math.floor((months[n - 1] - 1) / 3));
    if (qm.length < 3 && n >= 3 && months[n - 1] % 3 !== 0) qm = months.slice(-3);
    const qlabel = qm.length === 3 && qm[0] % 3 === 1 ? `Q${Math.floor((qm[0] - 1) / 3) + 1}` : qm.length === 1 ? MABBR[qm[0]] : `${MABBR[qm[0]]}–${MABBR[qm[qm.length - 1]]}`;
    function fromQuotes(yr, lookup) {
      const out = {};
      for (const g of yoyMarkets) {
        const xm = q.filter(r => r.year === yr && members(g).includes(r.country) && qm.includes(r.month));
        const cnt = th => r1(qm.reduce((s, m) => s + xm.filter(r => r.month === m && r.quotes >= th).length, 0) / qm.length);
        let dl = null;
        if (lookup) { const vals = qm.map(m => members(g).reduce((s, c) => s + ((lookup[c] || {})[m] || 0), 0)); if (vals.some(v => v)) dl = r1(vals.reduce((a, b) => a + b, 0) / qm.length); }
        out[g] = {monthly_quotes: qm.map(m => xm.filter(r => r.month === m).reduce((s, r) => s + r.quotes, 0)), quotes: xm.reduce((s, r) => s + r.quotes, 0),
          active_avg: cnt(1), d20: cnt(20), d50: cnt(50), d100: cnt(100), dealers_avg: dl};
      }
      return out;
    }
    const curDealers = {}; for (const c in trend) { curDealers[c] = {}; months.forEach((m, i) => curDealers[c][m] = trend[c].netm[i]); }
    const yoyData = {[year]: fromQuotes(year, curDealers)}, basis = {[year]: 'quote data'};
    for (const yr of uniqSorted(q.map(r => r.year)).filter(y => y !== year)) {
      const ms = new Set(q.filter(r => r.year === yr).map(r => r.month));
      if (qm.every(m => ms.has(m))) { yoyData[yr] = fromQuotes(yr, null); basis[yr] = 'quote data'; }
    }
    if (inputs.history) {
      const H = inputs.history.map(lowerKeys).map(r => ({...r, month: monthNo(r.month), year: String(Math.trunc(+r.year))}));
      for (const yr of uniqSorted(H.map(r => r.year))) {
        const hy = H.filter(r => r.year === yr);
        if (yr in yoyData || !qm.every(m => hy.some(r => r.month === m))) continue;
        const out = {}; const hasD = 'dealers' in hy[0];
        for (const g of yoyMarkets) {
          const x = hy.filter(r => [g, ...members(g)].includes(r.market) && qm.includes(r.month)); if (!x.length) continue;
          const per = {}; for (const r of x) { const p = per[r.month] = per[r.month] || {}; for (const c of ['dealers', 'active', 'quotes', 'd20', 'd50', 'd100']) p[c] = (p[c] || 0) + (+r[c] || 0); }
          const pm = Object.keys(per).map(Number), get = c => r1(pm.reduce((s, m) => s + per[m][c], 0) / pm.length);
          out[g] = {monthly_quotes: qm.map(m => per[m] ? Math.trunc(per[m].quotes) : 0), quotes: Math.trunc(pm.reduce((s, m) => s + per[m].quotes, 0)),
            active_avg: get('active'), d20: get('d20'), d50: get('d50'), d100: get('d100'), dealers_avg: hasD ? get('dealers') : null};
        }
        yoyData[yr] = out; basis[yr] = 'history';
      }
    }
    const years = Object.keys(yoyData).sort();
    let yoy = null;
    if (years.length >= 2) {
      const mixed = new Set(Object.values(basis)).size > 1;
      yoy = {years, qlabel, qmonths: qm.map(m => MFULL[m]), mixed_basis: mixed,
        basis_note: cfg.history_basis_note || (`${year} comes from the quote-level data; ${years.filter(y => basis[y] === 'history').join(', ')} from the supplied history figures. Differences in how the two sources count quotes or dealers can affect year-over-year changes.`),
        source_note: cfg.history_source_note || ''};
    }

    // data-quality checks
    const over = {};
    for (const [mk, t] of Object.entries(trend)) t.active.forEach((a, i) => { if (t.net_src !== 'est' && a > t.netm[i]) (over[mk] = over[mk] || []).push(`${mlab[i]} ${a} vs ${t.netm[i]}`); });
    if (Object.keys(over).length) {
      const txt = Object.entries(over).map(([mk, v]) => `${LB(mk)} (${v.slice(0, 3).join(', ')}${v.length > 3 ? '…' : ''})`).join('; ');
      dq.push(`<b>More dealers quoting than dealers in the list.</b> ${txt}. Most likely some sites quote under their own name but count as one dealer.`);
      flags.push(`More dealers quote than the dealer list contains in ${Object.keys(over).map(LB).join(', ')}.`);
    }
    const jumps = [];
    for (const [mk, t] of Object.entries(trend)) if (t.net_src === 'file') for (let i = 1; i < n; i++) { const a = t.netm[i - 1], b = t.netm[i];
      if (a >= 20 && Math.abs(b - a) / a >= 0.15) jumps.push(`${LB(mk)} ${a} → ${b} (${mlab[i - 1]} → ${mlab[i]})`); }
    if (jumps.length) dq.push(`<b>Large month-to-month changes in dealer numbers.</b> ${jumps.join('; ')}. A drop like this lifts % active without more dealers quoting — worth confirming.`);
    if (missing.length) { dq.push(`<b>Not in the dealer file:</b> ${missing.join(', ')} — the dealer count comes from the network reference list.`);
      flags.push(`${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing from the dealer numbers.`); }
    if (est.length) dq.push(`<b>No dealer count available:</b> ${est.join(', ')} — the highest monthly number of active dealers is used, so % active is overstated there.`);
    const zero = months.filter(m => !cy.some(r => r.month === m)).map(m => MABBR[m]);
    if (zero.length) dq.push(`<b>Months without data:</b> ${zero.join(', ')}.`);
    if (yoy && yoy.mixed_basis) dq.push(`<b>Mixed data basis in the year-over-year view.</b> ${yoy.basis_note}`);
    dq.push(...(cfg.notes || []));

    const statuses = cfg.quote_statuses || ['Quotation', 'Appointment'];
    const dealerSrc = hasDF ? 'dealer numbers supplied per month' : Object.keys(netref).length ? 'network reference list' : 'highest monthly active-dealer count (no dealer list supplied)';
    const method = [
      '<b>Active dealer.</b> A dealer that completed at least one Menus quote in the month. Quotes per active dealer = quotes ÷ months ÷ average monthly active dealers.',
      `<b>% active dealers.</b> Active dealers ÷ dealers in the network for the same month (${dealerSrc}).`,
      `<b>Scope.</b> ${cfg.oem}, Menus application, ${cfg.region || 'Europe'}. ` + (hasOther ? `${cfg.core_label || 'Core'} markets in the summary and year-over-year views; all markets in the trend view.` : 'All markets.'),
      `<b>Quotes.</b> Statuses counted as completed quotes: ${statuses.join(', ')}.`,
      yoy ? `<b>Year over year.</b> ${qlabel} = ${qm.map(m => MFULL[m]).join(', ')} summed per year. Dealer counts are monthly averages.` : '<b>Year over year.</b> Not shown — no prior-year data supplied.',
      `<b>Within-year comparison.</b> ${Alab} vs ${Blab} averages instead of single months, so holiday months do not distort the status flags.`,
      '<b>Concentration.</b> Dealers ranked by quotes; “top 20%” is the largest fifth of dealers with at least one quote. The top-20% cohort of the first window is followed unchanged.',
      '<b>Refresh.</b> Re-run the build with the next month’s quote file and dealer numbers; no manual preparation is needed.'];

    // other products
    const products = ['ssm'], extra = {};
    if (inputs.sst) { extra.sst = inputs.sst; products.push('sst'); }
    if (inputs.ssc) {
      const ssc = JSON.parse(JSON.stringify(inputs.ssc)); let rec = false;
      for (const mo of ssc.months) {
        const m = monthNo(mo.n); const i = months.indexOf(m); if (i < 0) continue;
        if (mo.c.some(c => c.length > 5)) {
          let tot = 0;
          for (const c of mo.c) if (trend[c[0]]) { const s = trend[c[0]].quotes[i]; tot += s; c[4] = (c[5] + s) ? r1(c[5] / (c[5] + s) * 100) : 0; }
          mo.quotes = mo.ssc + tot; rec = true;
        }
        mo.c = mo.c.map(c => c.slice(0, 5));
      }
      if (rec && !ssc.basis_note) ssc.basis_note = 'SSC share of quotes is calculated with the SSM quotes from this dashboard’s quote data (SSC ÷ SSC + SSM, per market and month).';
      for (const h of ssc.history || []) if (h.quotes === null || h.quotes === undefined) h.quotes = ssc.months.reduce((s, mo) => s + mo.quotes, 0);
      if (!ssc.core_markets) ssc.core_markets = [...core].sort();
      extra.ssc = ssc; products.push('ssc');
    }
    if (inputs.helpdesk) { extra.hd = inputs.helpdesk; products.push('hd'); }
    const pdca = loadPdca(inputs.pdca);

    const srcs = ['SSM quote data (Menus)'].concat(hasDF ? ['dealer numbers'] : Object.keys(netref).length ? ['network reference list'] : []);
    if (products.length > 1) srcs.push('SST, SSC and helpdesk figures as supplied');
    const today = new Date();
    const meta = {oem: cfg.oem, region: cfg.region || 'Europe', audience: cfg.audience || '', prepared_by: cfg.prepared_by || 'Intellegam',
      created: `${MFULL[today.getMonth() + 1]} ${today.getFullYear()}`, year, months: mlab, month_full: mfull, A, B, Alab, Blab, trend_ok: n >= 2,
      core_label: hasOther ? (cfg.core_label || 'core') : 'core', other_label: cfg.other_label || 'Other markets', has_other: hasOther, yoy,
      dealer_source: dealerSrc, products, sources: srcs,
      period_label: (n === 1 && !yoy) ? `${mfull[0]} ${year}` : `${qlabel} ${year}` + (yoy ? ` vs ${qlabel} ${years.slice(0, -1).join(', ')}` : '') + (n > 1 ? ` and ${mfull[0]} – ${mfull[n - 1]} ${year}` : ''),
      extra_questions: cfg.questions || []};
    return {meta, trend, dealers, yoy: yoy ? {markets: yoyMarkets, data: yoyData} : null, dq, dq_flags: flags, method, pdca, ...extra};
  }

  function renderReviewHtml(template, data) {
    const json = JSON.stringify(data).replace(/<\/script/gi, '<\\/script');
    return template.replace('__TITLE__', `${data.meta.oem} Superservice Review`).replace('__DATA__', () => json);
  }

  function summary(data) {
    const m = data.meta, t = Object.values(data.trend);
    const tq = t.reduce((s, x) => s + x.quotes.reduce((a, b) => a + b, 0), 0), dq = data.dealers.reduce((s, r) => s + r.slice(2).reduce((a, b) => a + b, 0), 0);
    return {oem: m.oem, period: `${m.months[0]}–${m.months[m.months.length - 1]} ${m.year}`, markets: t.length, core: t.filter(x => x.core).length,
      dealers: data.dealers.length, yoy: m.yoy ? m.yoy.years : null, products: m.products, quotes_trend: tq, quotes_dealers: dq, reconciled: tq === dq,
      dq: data.dq.map(x => x.replace(/<[^>]+>/g, ''))};
  }

  const api = {buildReviewData, renderReviewHtml, summary, fixText};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OemReview = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
