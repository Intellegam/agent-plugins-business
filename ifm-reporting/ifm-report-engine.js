/*
 * IFM Report — generic data engine for any tabular export (plain JavaScript, no dependencies).
 * Used by the IC skill "IFM Report (any data)" when no dedicated report skill fits the uploaded file.
 * The model chooses WHICH columns to use (spec); the engine does ALL counting, so figures are reproducible.
 *
 *   const data = buildReportData(inputs, spec);
 *   const html = renderReportHtml(templateText, data);
 *   const check = summary(data);
 *   const profile = profileColumns(rows);    // step 1: column profile to choose the spec from
 *
 * inputs = { rows: [rows, rows, ...], portfolio: rows | null }   // one array per file (sheet_to_json, raw:true)
 * spec = {
 *   title: "Microcat EPC usage — Kia UK",      // required
 *   date_col: "Month" | null,                  // a date or "YYYY-MM" column → monthly trend
 *   measure_col: "Searches" | null,            // numeric column to SUM; null = count rows
 *   measure_label: "Searches" | "Tickets" | "Rows",
 *   dims: [{col: "Country", label: "Market"}, {col: "Dealer Name", label: "Dealer", top: 10}],   // 1–4 breakdowns
 *   brand_col, country_col,                    // optional: needed for the account-manager filter
 *   brand: "Nissan",                           // optional: brand of a single-brand file without brand column
 *   brands: ["Kia"], markets: ["Germany"],      // optional: keep only these brands / markets
 *   measures: [{col, label}], ratios: [{label, num, den, pct}],   // optional: extra sums and sum-based ratios
 *   account_manager: "Simon French",           // optional: keep only the AM's brand × market pairs (am-portfolio.csv)
 *   filters: {"Region": ["Europe", "MEA"]},    // optional: keep rows whose column value is in the list
 *   from: "2026-01", to: "2026-09",            // optional, needs date_col
 *   zero_label: "dealers without activity",   // optional: count dims[last] items whose measure is 0
 *   audience, prepared_by: "Intellegam", demo: false
 * }
 */
(function (root) {
  'use strict';
  const MABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MFULL = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const BLANK = '(blank)';
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const clean = v => {
    if (v == null) return '';
    const s = String(v).replace(/ /g, ' ').trim();
    if (s === "'-" || s === '-' || s === '—' || /^n\/?a$/i.test(s) || s === '#N/A') return '';
    return s.replace(/\s+/g, ' ');
  };
  const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmt = x => Number(x).toLocaleString('en-GB', {maximumFractionDigits: 1});
  const list = v => Array.isArray(v) ? v.map(clean).filter(Boolean) : String(v || '').split(/[;|]/).map(clean).filter(Boolean);
  const COUNTRY = {'uk': 'United Kingdom', 'gb': 'United Kingdom', 'great britain': 'United Kingdom', 'czechia': 'Czech Republic', 'slovakia': 'Slovak Republic',
    'holland': 'Netherlands', 'the netherlands': 'Netherlands', 'türkiye': 'Turkey', 'turkiye': 'Turkey', 'uae': 'United Arab Emirates'};
  const canonCountry = s => COUNTRY[String(s).toLowerCase()] || s;
  const BRANDS = [['Ford', /\bford\b/i], ['Toyota', /toyota/i], ['Mitsubishi', /mitsubishi/i], ['Jaguar Land Rover', /jaguar|land ?rover|\bjlr\b/i],
    ['Honda', /^honda$/i], ['Kia', /\bkia\b/i], ['Hyundai', /hyundai/i], ['Nissan', /nissan/i]];
  const canonBrand = s => { for (const [l, re] of BRANDS) if (re.test(s)) return l; return s; };

  function parseDate(v) {
    if (v == null || v === '') return null;
    let d = null;
    if (v instanceof Date) d = new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
    else if (typeof v === 'number' && isFinite(v)) {
      if (v > 190000 && v < 300000) d = new Date(Date.UTC(Math.floor(v / 100), v % 100 - 1, 1));   // 202609
      else if (v > 20000 && v < 80000) d = new Date(Math.round((v - 25569) * 86400000));            // Excel serial
    } else {
      const s = String(v).trim(); let m;
      if ((m = s.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?/))) d = new Date(Date.UTC(+m[1], +m[2] - 1, +(m[3] || 1)));
      else if ((m = s.match(/^(\d{4})(\d{2})$/))) d = new Date(Date.UTC(+m[1], +m[2] - 1, 1));
      else if ((m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/))) d = new Date(Date.UTC(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]));
      else if ((m = s.match(/^(?:(\d{1,2})[ -])?([A-Za-z]{3})[a-z]*[ -](\d{2,4})/))) {
        const mi = MABBR.findIndex(x => x.toLowerCase() === m[2].toLowerCase());
        if (mi > 0) d = new Date(Date.UTC(+m[3] < 100 ? 2000 + +m[3] : +m[3], mi - 1, +(m[1] || 1)));
      }
    }
    if (!d || isNaN(d)) return null;
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  const ymLabel = k => `${MABBR[+k.slice(5)]} ${k.slice(2, 4)}`;
  const num = v => { if (typeof v === 'number') return v; const s = clean(v).replace(/[ '’]/g, ''); if (!s) return null;
    const x = Number(/,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')); return isFinite(x) ? x : null; };

  function findCol(keys, name) {
    if (!name) return null;
    return keys.find(k => k === name) || keys.find(k => norm(k) === norm(name)) || null;
  }

  // ---------------------------------------------------------------- column profile (to choose a spec)
  function profileColumns(rowsOrFiles) {
    const files = Array.isArray(rowsOrFiles[0]) ? rowsOrFiles : [rowsOrFiles];
    return files.map((rows, i) => {
      const keys = [...new Set(rows.slice(0, 500).flatMap(r => Object.keys(r || {})))];
      return {file: i + 1, rows: rows.length, columns: keys.map(k => {
        const vals = rows.map(r => r[k]).filter(v => clean(v) !== '');
        const distinct = new Set(vals.map(v => clean(v))).size;
        const hint = /date|month|period|time|created|requested|solved|day|week|year/i.test(k);
        const nums = vals.filter(v => num(v) !== null).length, dates = vals.slice(0, 200).filter(v => (typeof v !== 'number' || hint) && parseDate(v)).length;
        return {name: k, filled_pct: pct(vals.length, rows.length), distinct,
          type: dates > Math.min(vals.length, 200) * .8 ? 'date' : nums > vals.length * .9 ? 'number' : 'text',
          examples: [...new Set(vals.slice(0, 50).map(v => clean(v)))].slice(0, 4)};
      })};
    });
  }


  // small RFC-4180 CSV reader for the reference files (segments.csv, am-portfolio.csv) — avoids delimiter sniffing
  function parseCsv(text) {
    const rows = []; let row = [], cell = '', q = false; text = String(text).replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    const head = (rows.shift() || []).map(h => h.trim());
    return rows.filter(r => r.some(x => x.trim() !== '')).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
  }

  // ---------------------------------------------------------------- build
  function buildReportData(inputs, spec) {
    const sp0 = Object.assign({prepared_by: 'Intellegam', measure_label: spec && spec.measure_col ? spec.measure_col : 'Rows'}, spec || {});
    const sp = sp0; const HASDATE = sp.date_col || (sp.file_months && sp.file_months.length ? 'file' : null);
    if (!sp.title) throw new Error('spec.title is required.');
    if (!sp.dims || !sp.dims.length) throw new Error('spec.dims needs at least one breakdown column.');
    const dq = [];
    const files = (inputs.rows || []).filter(f => f && f.length);
    if (!files.length) throw new Error('No rows in the uploaded files.');

    // load + normalise
    let all = [], rowsIn = 0, noDate = 0, noMeasure = 0;
    files.forEach((rows, fi) => {
      const keys = [...new Set(rows.slice(0, 500).flatMap(r => Object.keys(r || {})))];
      const col = n => { const c = findCol(keys, n); if (n && !c) throw new Error(`Column "${n}" not found in file ${fi + 1}. Columns: ${keys.join(', ')}`); return c; };
      const dc = col(sp.date_col), mc = col(sp.measure_col), bc = col(sp.brand_col), cc = col(sp.country_col);
      const xcs = (sp.measures || []).map(x => col(x.col));
      const fileMonth = !dc && sp.file_months ? parseDate(sp.file_months[fi]) : null;
      if (!dc && sp.file_months && !fileMonth) throw new Error(`file_months[${fi}] is missing or not a month ("YYYY-MM") for file ${fi + 1}.`);
      const dcs = sp.dims.map(d => col(d.col));
      const fc = Object.entries(sp.filters || {}).map(([k, v]) => [col(k), list(v).map(x => x.toLowerCase())]);
      for (const r of rows) {
        rowsIn++;
        if (fc.some(([c, vals]) => !vals.includes(clean(r[c]).toLowerCase()))) continue;
        const ym = dc ? parseDate(r[dc]) : (fileMonth ? fileMonth : null);
        if (dc && !ym) { noDate++; continue; }
        let m = 1; if (mc) { m = num(r[mc]); if (m === null) { noMeasure++; m = 0; } }
        const rec = {ym, m, x: xcs.map(c => num(r[c]) || 0), dims: dcs.map((c, i) => { const v = clean(r[c]); return v ? (sp.dims[i].col === sp.country_col ? canonCountry(v) : v) : ''; }),
          brand: bc ? canonBrand(clean(r[bc])) : (sp.brand ? canonBrand(sp.brand) : ''), country: cc ? canonCountry(clean(r[cc])) : ''};
        rec.file = fi; all.push(rec);
      }
    });
    if (HASDATE && files.length > 1) {
      // several exports of the same kind: a month present in more than one file is taken from the file that reaches furthest (newest export)
      const fmax = {}; all.forEach(t => { if (!fmax[t.file] || t.ym > fmax[t.file]) fmax[t.file] = t.ym; });
      const owner = {};
      all.forEach(t => { const o = owner[t.ym]; if (o === undefined || fmax[t.file] > fmax[o] || (fmax[t.file] === fmax[o] && t.file > o)) owner[t.ym] = t.file; });
      const before = all.length, overl = new Set(all.filter(t => owner[t.ym] !== t.file).map(t => t.ym));
      all = all.filter(t => owner[t.ym] === t.file);
      if (overl.size) dq.push(`${files.length} files combined. ${overl.size} month(s) appeared in more than one file (${[...overl].sort().map(ymLabel).join(', ')}); each was taken once, from the most recent export (${fmt(before - all.length)} duplicate rows left out).`);
      else dq.push(`${files.length} files combined into one timeline; no overlapping months.`);
    }
    if (sp.filters && Object.keys(sp.filters).length) dq.push(`Filter applied: ${Object.entries(sp.filters).map(([k, v]) => `${esc(k)} = ${list(v).map(esc).join(' / ')}`).join('; ')}.`);
    if (noDate) dq.push(`${fmt(noDate)} row(s) without a readable date in "${esc(HASDATE)}" were left out.`);
    if (noMeasure) dq.push(`${fmt(noMeasure)} row(s) had no number in "${esc(sp.measure_col)}" and count as 0.`);

    const presentAll = HASDATE ? [...new Set(all.map(t => t.ym))].sort() : [];
    let scope = 'All rows in the uploaded file(s)';
    // brand / market filter (the usual way to scope a report)
    const fB = list(sp.brands).map(b => canonBrand(b).toLowerCase()), fM = list(sp.markets).map(m => canonCountry(m).toLowerCase());
    if (fB.length || fM.length) {
      if (fB.length && !sp.brand_col && !sp.brand) throw new Error('brands filter needs spec.brand_col (or spec.brand for a single-brand file).');
      if (fM.length && !sp.country_col) throw new Error('markets filter needs spec.country_col.');
      const before = all.length;
      all = all.filter(t => (!fB.length || fB.includes(t.brand.toLowerCase())) && (!fM.length || fM.includes(t.country.toLowerCase())));
      scope = [fB.length ? list(sp.brands).join(', ') : '', fM.length ? (fM.length > 3 ? `${fM.length} markets` : list(sp.markets).join(', ')) : 'all markets'].filter(Boolean).join(' · ');
      dq.push(`Filter: ${fmt(all.length)} of ${fmt(before)} rows match ${esc(scope)}.`);
    } else if (sp.brand) scope = `${canonBrand(sp.brand)} · all markets`;
    // account-manager portfolio
    if (sp.account_manager) {
      if ((!sp.brand_col && !sp.brand) || !sp.country_col) throw new Error('account_manager needs spec.country_col and either spec.brand_col or spec.brand (for single-brand files).');
      const am = (inputs.portfolio || []).find(r => norm(r.account_manager) === norm(sp.account_manager)) ||
        (inputs.portfolio || []).find(r => norm(r.account_manager).includes(norm(sp.account_manager)));
      if (!am) throw new Error(`Account manager "${sp.account_manager}" not found in am-portfolio.csv. Available: ${(inputs.portfolio || []).map(r => r.account_manager).join(', ')}`);
      const pairs = list(am.pairs).map(p => { const [b, c] = p.split('@'); return [canonBrand(clean(b)), c === '*' ? '*' : canonCountry(clean(c))]; });
      const before = all.length;
      all = all.filter(t => pairs.some(([b, c]) => b.toLowerCase() === t.brand.toLowerCase() && (c === '*' || c.toLowerCase() === t.country.toLowerCase())));
      scope = `${clean(am.account_manager)} – own accounts (${pairs.length} brand × market combinations)`;
      dq.push(`Account filter: ${fmt(all.length)} of ${fmt(before)} rows belong to ${esc(clean(am.account_manager))}'s brand × market portfolio (account handover file).`);
    }
    if (!all.length) throw new Error('No rows left after filters / account filter. Check column names and the account manager.');

    // months
    let months = [];
    if (HASDATE) {
      const present = [...new Set(all.map(t => t.ym))].sort();
      const from = sp.from || present[0], to = sp.to || present[present.length - 1];
      let [y, m] = from.split('-').map(Number); const [ty, tm] = to.split('-').map(Number);
      while (y < ty || (y === ty && m <= tm)) { months.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
      all = all.filter(t => months.includes(t.ym));
      const gaps = months.filter(k => !presentAll.includes(k) && k > presentAll[0] && k < presentAll[presentAll.length - 1]);
      if (gaps.length) dq.push(`No rows at all for ${gaps.map(ymLabel).join(', ')} — probably a missing export for these months; the trend shows them as zero.`);
      if (months.length > 36) { months = months.slice(-36); all = all.filter(t => months.includes(t.ym)); dq.push('Only the last 36 months are shown.'); }
    }
    const total = all.reduce((s, t) => s + t.m, 0);
    const trend = months.map(k => all.filter(t => t.ym === k).reduce((s, t) => s + t.m, 0));

    // dims
    const dims = sp.dims.map((d, i) => {
      const topN = d.top || (i === 0 ? 5 : 10);
      const tot = new Map(), byM = new Map();
      for (const t of all) {
        const v = t.dims[i] || BLANK;
        tot.set(v, (tot.get(v) || 0) + t.m);
        if (months.length) { if (!byM.has(v)) byM.set(v, Object.fromEntries(months.map(k => [k, 0]))); byM.get(v)[t.ym] += t.m; }
      }
      const ranked = [...tot.entries()].filter(([v]) => v !== BLANK).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(b[0]));
      const top = ranked.slice(0, topN).map(([v, c]) => ({label: v, total: round(c), pct: pct(c, total), monthly: months.map(k => round(byM.get(v)[k]))}));
      const zero = ranked.filter(([, c]) => c === 0).length;
      const bottom = ranked.filter(([, c]) => c > 0).slice(-5).reverse().map(([v, c]) => ({label: v, total: round(c), pct: pct(c, total)}));
      const blank = tot.get(BLANK) || 0;
      if (blank) dq.push(`${fmt(blank)} ${esc(sp.measure_label)} have an empty "${esc(d.col)}" — shown as not ranked.`);
      let latest = [];
      if (months.length) {
        const last = months[months.length - 1], lt = trend[trend.length - 1];
        latest = ranked.map(([v]) => ({label: v, total: round(byM.get(v)[last])})).sort((a, b) => b.total - a.total).slice(0, Math.min(topN, 8));
        latest.forEach(x => x.pct = pct(x.total, lt));
      }
      return {col: d.col, label: d.label || d.col, top, bottom, latest, distinct: ranked.length, zero, other: round(total - top.reduce((s, x) => s + x.total, 0)), blank: round(blank)};
    });

    // extra measures (summed) and ratios (sum ÷ sum), e.g. eVHCs completed, sold work, appointments
    const XM = (sp.measures || []).map((x, i) => ({label: x.label || x.col, col: x.col, i}));
    const valOf = (sums, ref) => { if (ref === sp.measure_col || ref === sp.measure_label) return sums.m;
      const k = XM.find(x => x.col === ref || x.label === ref); if (!k) throw new Error(`Ratio refers to "${ref}", which is neither measure_col nor one of measures.`); return sums.x[k.i]; };
    const RT = (sp.ratios || []).map(r => ({label: r.label, num: r.num, den: r.den, pct: r.pct !== false}));
    const ratioVal = (sums, r) => { const d = valOf(sums, r.den); return d ? Math.round(valOf(sums, r.num) / d * (r.pct ? 1000 : 100)) / (r.pct ? 10 : 100) : null; };
    const sumUp = ts => ({m: ts.reduce((a, t) => a + t.m, 0), x: XM.map(k => ts.reduce((a, t) => a + t.x[k.i], 0))});
    const totSums = sumUp(all);
    const extras = XM.map(k => ({label: k.label, total: round(totSums.x[k.i])})).concat(RT.map(r => ({label: r.label, total: ratioVal(totSums, r), pct: r.pct})));
    // detail table: dim 0 × months (all items, max 60 rows)
    const d0 = sp.dims[0];
    const tmap = new Map();
    for (const t of all) { const v = t.dims[0] || BLANK; if (!tmap.has(v)) tmap.set(v, {label: v, monthly: months.map(() => 0), total: 0, sums: {m: 0, x: XM.map(() => 0)}}); const o = tmap.get(v); o.total += t.m; o.sums.m += t.m; t.x.forEach((v2, j) => o.sums.x[j] += v2); if (months.length) o.monthly[months.indexOf(t.ym)] += t.m; }
    const table = [...tmap.values()].sort((a, b) => b.total - a.total).slice(0, 60).map(o => ({label: o.label, total: round(o.total), pct: pct(o.total, total), monthly: o.monthly.map(round), extra: XM.map(k => round(o.sums.x[k.i])).concat(RT.map(r => ratioVal(o.sums, r)))}));
    if (tmap.size > 60) dq.push(`Detail table shows the 60 largest of ${fmt(tmap.size)} ${esc(d0.label || d0.col)} values.`);

    // KPIs + findings
    const n = months.length, last = n ? trend[n - 1] : null, prev = n > 1 ? trend[n - 2] : null;
    const kpis = {total: round(total), rows: all.length, months: n, avg_month: n ? round(total / n) : null, last, prev,
      mom: prev ? pct(last - prev, prev) : null, last_label: n ? ymLabel(months[n - 1]) : '', distinct: dims.map(d => d.distinct)};
    const findings = [];
    const L = sp.measure_label;
    const d1 = dims[0];
    if (d1.top[0]) findings.push(`<b>${esc(d1.top[0].label)}</b> is the largest ${esc(d1.label.toLowerCase())}: ${fmt(d1.top[0].total)} ${esc(L)} (${d1.top[0].pct}%).`);
    if (d1.top.length >= 3) { const s3 = d1.top.slice(0, 3).reduce((a, x) => a + x.pct, 0); findings.push(`The top 3 ${esc(d1.label.toLowerCase())} values account for <b>${Math.round(s3 * 10) / 10}%</b> of the total.`); }
    if (dims[1] && dims[1].top[0]) findings.push(`By ${esc(dims[1].label.toLowerCase())}: <b>${esc(dims[1].top[0].label)}</b> leads with ${fmt(dims[1].top[0].total)} (${dims[1].top[0].pct}%).`);
    if (kpis.mom != null) findings.push(`${kpis.last_label}: ${fmt(last)} ${esc(L)}, <b>${kpis.mom > 0 ? '+' : ''}${kpis.mom}%</b> vs the previous month.`);
    if (n >= 3) { const mx = Math.max(...trend), mn = Math.min(...trend); findings.push(`Range over ${n} months: ${fmt(mn)} (${ymLabel(months[trend.indexOf(mn)])}) to ${fmt(mx)} (${ymLabel(months[trend.indexOf(mx)])}).`); }
    const lastDim = dims[dims.length - 1];
    if (sp.zero_label && lastDim.zero) findings.push(`<b>${fmt(lastDim.zero)}</b> ${esc(sp.zero_label)} (0 ${esc(L)} in the period).`);

    const created = new Date();
    const meta = {title: sp.title, subtitle: sp.subtitle || '', audience: sp.audience || '', prepared_by: sp.prepared_by, demo: !!sp.demo, scope,
      measure_label: L, measure_is_count: !sp.measure_col, months: months.map(ymLabel), month_keys: months,
      period_label: n ? `${MFULL[+months[0].slice(5)]} ${months[0].slice(0, 4)} – ${MFULL[+months[n - 1].slice(5)]} ${months[n - 1].slice(0, 4)}` : 'whole file',
      last_month_label: n ? `${MFULL[+months[n - 1].slice(5)]} ${months[n - 1].slice(0, 4)}` : '', rows_in: rowsIn,
      created: `${created.getUTCDate()} ${MFULL[created.getUTCMonth() + 1]} ${created.getUTCFullYear()}`};
    const method = [
      sp.measure_col ? `${L} = sum of the column "${sp.measure_col}".` : `${L} = number of rows in the export.`,
      sp.date_col ? `Month = month of the column "${sp.date_col}".` : (HASDATE ? 'Month = the reporting month of each file (one file per month, taken from the file name).' : 'The export has no date column, so there is no trend.'),
      `Breakdowns: ${sp.dims.map(d => `"${d.col}"`).join(', ')}. Rankings use the whole period; empty values are not ranked.`,
      ...(sp.measures || []).map(x => `${x.label || x.col} = sum of "${x.col}".`),
      ...(sp.ratios || []).map(r => `${r.label} = sum of ${r.num} ÷ sum of ${r.den}${r.pct !== false ? ' (in %)' : ''}, over all rows in scope (not an average of row ratios).`),
      'All figures are calculated by the IFM report engine from the uploaded file; nothing is entered by hand.'];
    return {meta, kpis, trend, dims, table, table_label: d0.label || d0.col, extras, extra_labels: extras.map(x => x.label + (x.pct ? ' %' : '')), findings, dq, method};
  }
  function round(x) { return Math.round(x * 100) / 100; }

  function renderReportHtml(template, data) {
    const json = JSON.stringify(data).replace(/<\/script/gi, '<\\/script').replace(/\u2028|\u2029/g, ' ');
    return template.replace('__TITLE__', () => esc(data.meta.title)).replace('__DATA__', () => json);
  }
  function summary(data) {
    const k = data.kpis, sumTrend = Math.round(data.trend.reduce((a, b) => a + b, 0));
    const d0 = data.dims[0], sumDim = Math.round(d0.top.reduce((a, x) => a + x.total, 0) + d0.other);
    return {title: data.meta.title, scope: data.meta.scope, period: data.meta.period_label, total: k.total, rows: k.rows, last_month: k.last, mom_pct: k.mom,
      top: data.dims.map(d => `${d.label}: ${d.top.slice(0, 3).map(x => `${x.label} ${x.total}`).join(', ')}`),
      reconciled: (data.trend.length ? sumTrend === Math.round(k.total) : true) && sumDim === Math.round(k.total),
      dq: data.dq.map(x => x.replace(/<[^>]+>/g, ''))};
  }

  const api = {buildReportData, renderReportHtml, summary, profileColumns, parseDate, parseCsv};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IfmReport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
