/*
 * CSC Ticket Dashboard — data engine (plain JavaScript, no dependencies).
 * Runs in the Intelligence Center TypeScript tool or in Node.
 *
 *   const data = buildDashboardData(inputs, config);
 *   const html = renderDashboardHtml(templateText, data);
 *   const check = summary(data);
 *
 * inputs = {
 *   tickets:  [rows, rows, ...]  // one array of row objects per Zendesk export (XLSX.utils.sheet_to_json(ws, {raw:true}))
 *   segments: rows | null        // segments.csv rows (segment, owner, label, brands, countries, org_contains, org_excludes, notes)
 *   portfolio: rows | null       // am-portfolio.csv rows (account_manager, regions, products, brands, pairs = Brand@Country|… , * = all markets)
 * }
 * config = {
 *   segment: "AFG"               // a segment key from segments.csv  — OR
 *   account_manager: "Jozsef Udvari" // the AM's own brand×market portfolio from am-portfolio.csv — OR / AND ad-hoc filters:
 *   brands: ["Kia","Hyundai"], countries: ["Germany"], org_contains: ["AFG"], org_excludes: [],
 *   from: "2026-01", to: "2026-09",   // optional; default = all months in the export
 *   exclude_automated: false,          // drop system batch tickets (Superservice Connect Team "DMS Errors …")
 *   audience: "", prepared_by: "Intellegam", top_n: 5, demo: false
 * }
 * Definitions (do not change without the CSC team):
 *   reporting month = month of the Zendesk "Requested" timestamp (as exported, no time-zone shift)
 *   closed = status Solved or Closed at export time; open = everything else (Open, Pending, New, On-hold)
 *   avg days to close = mean(Solved − Requested) over closed tickets of the period
 *   admin request = Case Reason in ADMIN list (user / login / account administration)
 */
(function (root) {
  'use strict';
  const MABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MFULL = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const BLANK = '(blank)';

  // ------------------------------------------------------------- column aliases
  const ALIASES = {
    id: ['id', 'ticketid'],
    status: ['ticketstatus', 'status'],
    brand: ['brand', 'franchise', 'oem', 'make', 'marke', 'manufacturer'],
    org: ['organization', 'organisation', 'organizationname', 'organisationname', 'dealer', 'dealername', 'account'],
    product: ['product', 'produkt'],
    reason: ['casereason', 'reason', 'category'],
    nissanCat: ['nissan'],
    origin: ['caseorigin', 'origin', 'channel', 'via'],
    country: ['country', 'market', 'land'],
    requested: ['requested', 'created', 'createdat', 'requestedat', 'datecreated'],
    solved: ['solved', 'solvedat', 'datesolved'],
    subject: ['summary', 'subject']
  };
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');

  const BRANDS = [ // canonical label, match patterns (checked against brand cell, then organisation)
    ['Nissan', /nissan/i], ['Infiniti', /infiniti/i], ['Ford', /\bford\b/i], ['Lexus', /lexus/i], ['Toyota', /toyota/i],
    ['Kia', /\bkia\b/i], ['Hyundai', /hyundai/i], ['Genesis', /genesis/i], ['Mitsubishi', /mitsubishi/i], ['Mazda', /mazda/i],
    ['Subaru', /subaru/i], ['Suzuki', /suzuki/i], ['Honda', /honda/i], ['Jaguar Land Rover', /jaguar|land ?rover|\bjlr\b/i],
    ['Renault', /renault/i], ['Dacia', /dacia/i], ['BYD', /\bbyd\b/i], ['MG', /\bmg\b/i], ['Isuzu', /isuzu/i], ['Volvo', /volvo/i]];
  const COUNTRY = {
    'uk': 'United Kingdom', 'gb': 'United Kingdom', 'great britain': 'United Kingdom', 'england': 'United Kingdom', 'scotland': 'United Kingdom',
    'wales': 'United Kingdom', 'northern ireland': 'United Kingdom', 'united kingdom': 'United Kingdom', 'de': 'Germany', 'deutschland': 'Germany',
    'fr': 'France', 'es': 'Spain', 'it': 'Italy', 'nl': 'Netherlands', 'holland': 'Netherlands', 'the netherlands': 'Netherlands',
    'be': 'Belgium', 'at': 'Austria', 'ch': 'Switzerland', 'czechia': 'Czech Republic', 'cz': 'Czech Republic', 'slovakia': 'Slovak Republic',
    'sk': 'Slovak Republic', 'pl': 'Poland', 'hu': 'Hungary', 'ro': 'Romania', 'se': 'Sweden', 'dk': 'Denmark', 'no': 'Norway',
    'fi': 'Finland', 'ie': 'Ireland', 'pt': 'Portugal', 'tr': 'Turkey', 'türkiye': 'Turkey', 'turkiye': 'Turkey', 'za': 'South Africa',
    'uae': 'United Arab Emirates', 'ksa': 'Saudi Arabia'};
  const PRODUCT_FIX = [[/^super ?service menus v3$/i, 'Superservice Menus v3'], [/^super ?service menus data$/i, 'Superservice Menus Data'],
    [/^super ?service triage v2$/i, 'Superservice Triage v2'], [/^super ?service triage v1$/i, 'Superservice Triage v1'],
    [/^super ?service register$/i, 'Superservice Register'], [/^super ?service connect$/i, 'Connect'], [/^microcat epc$/i, 'Microcat EPC'],
    [/^microcat market$/i, 'Microcat Market']];
  const ADMIN = ['add/remove user(s)', 'additional permissions', 'reset password', 'login support', 'change of details',
    'account issues (sso & sign in)'];
  const AUTOMATED_ORG = /superservice connect team/i, AUTOMATED_SUBJ = /^dms errors\b/i;

  // ------------------------------------------------------------- helpers
  const clean = v => {
    if (v == null) return '';
    let s = String(v).replace(/ /g, ' ').trim();
    if (s === "'-" || s === '-' || s === '—' || /^n\/?a$/i.test(s) || s === '#N/A') return '';
    return s.replace(/\s+/g, ' ');
  };
  const titleCase = s => s.replace(/\b([a-zà-ÿ])/g, (m, c) => c.toUpperCase());
  function canonCountry(s) {
    if (!s) return '';
    const k = s.toLowerCase();
    return COUNTRY[k] || (s === s.toLowerCase() || s === s.toUpperCase() ? titleCase(k) : s);
  }
  function canonProduct(s) { for (const [re, v] of PRODUCT_FIX) if (re.test(s)) return v; return s; }
  function canonBrand(s) { for (const [lab, re] of BRANDS) if (re.test(s)) return lab; return s ? titleCase(s.toLowerCase()) : ''; }
  function brandFromOrg(s) { for (const [lab, re] of BRANDS) if (re.test(s)) return lab; return ''; }
  const list = v => Array.isArray(v) ? v.map(clean).filter(Boolean) : String(v || '').split(/[;|]/).map(clean).filter(Boolean);
  const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // dates → {y, m, d, t (ms, UTC-as-exported)}
  function parseDate(v) {
    if (v == null || v === '') return null;
    let d = null;
    if (v instanceof Date) d = new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate(), v.getHours(), v.getMinutes(), v.getSeconds()));
    else if (typeof v === 'number' && isFinite(v)) d = new Date(Math.round((v - 25569) * 86400000)); // Excel serial
    else {
      const s = String(v).trim(); let m;
      if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/)))
        d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
      else if ((m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/))) {
        const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
        d = new Date(Date.UTC(y, +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
      } else if ((m = s.match(/^(\d{1,2}) (\w{3})\w* (\d{4})(?:[ ,]+(\d{1,2}):(\d{2}))?/))) {
        const mi = MABBR.findIndex(x => x.toLowerCase() === m[2].toLowerCase());
        if (mi > 0) d = new Date(Date.UTC(+m[3], mi - 1, +m[1], +(m[4] || 0), +(m[5] || 0)));
      }
    }
    if (!d || isNaN(d)) return null;
    return {y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), t: d.getTime()};
  }
  const ym = p => `${p.y}-${String(p.m).padStart(2, '0')}`;
  const ymLabel = k => `${MABBR[+k.slice(5)]} ${k.slice(2, 4)}`;

  function mapColumns(rows) {
    const keys = [...new Set(rows.slice(0, 500).flatMap(r => Object.keys(r || {})))]; const map = {}; // empty cells are omitted per row
    for (const [f, al] of Object.entries(ALIASES)) {
      const hit = keys.find(k => al.includes(norm(k))) || (f === 'reason' ? keys.find(k => norm(k).startsWith('casereason')) : null)
        || (f === 'subject' ? null : keys.find(k => al.some(a => a.length > 4 && norm(k).startsWith(a))));
      if (hit) map[f] = hit;
    }
    if (map.nissanCat === map.brand) delete map.nissanCat;
    return map;
  }

  // ------------------------------------------------------------- load + clean
  function loadTickets(files, cfg, dq) {
    const byId = new Map(); let rowsIn = 0, noId = 0, noDate = 0, dup = 0, n = 0;
    const variants = {country: new Map(), product: new Map(), brand: new Map()};
    const note = (k, raw, c) => { if (raw && raw !== c) variants[k].set(`${raw} → ${c}`, (variants[k].get(`${raw} → ${c}`) || 0) + 1); };
    files.forEach((rows, fi) => {
      if (!rows || !rows.length) return;
      const map = mapColumns(rows);
      if (!map.requested) throw new Error(`Unknown ticket file format (file ${fi + 1}): no "Requested"/"Created" column. Columns: ${[...new Set(rows.slice(0, 50).flatMap(Object.keys))].join(', ')}`);
      if (!map.brand && !cfg.default_brand) dq.push(`File ${fi + 1} has no Brand column — brand was derived from the organisation name or the Nissan category field; tickets without a recognisable brand are shown as "${BLANK}".`);
      for (const r of rows) {
        rowsIn++;
        const req = parseDate(r[map.requested]); if (!req) { noDate++; continue; }
        const rawC = clean(r[map.country]), rawP = clean(r[map.product]), rawB = clean(r[map.brand]);
        const org = clean(r[map.org]), subj = clean(r[map.subject]);
        let brand = rawB ? canonBrand(rawB) : '';
        if (!brand && map.nissanCat && clean(r[map.nissanCat])) brand = 'Nissan';
        if (!brand) brand = brandFromOrg(org) || cfg.default_brand || '';
        note('brand', rawB, brand);
        const country = canonCountry(rawC); note('country', rawC, country);
        const product = canonProduct(rawP); note('product', rawP, product);
        let reason = clean(r[map.reason]); if (!reason && map.nissanCat) reason = clean(r[map.nissanCat]);
        const status = clean(r[map.status]);
        const t = {id: clean(r[map.id]) || `row${fi}-${n++}`, status, closed: /^(solved|closed)$/i.test(status), brand, org, product, reason,
          origin: clean(r[map.origin]), country, subject: subj, req, solved: parseDate(r[map.solved]),
          automated: AUTOMATED_ORG.test(org) || AUTOMATED_SUBJ.test(subj)};
        if (!clean(r[map.id])) noId++;
        if (byId.has(t.id)) dup++;
        byId.set(t.id, t);
      }
    });
    if (noDate) dq.push(`${noDate} row(s) without a readable Requested date were skipped.`);
    if (dup) dq.push(`${dup} duplicate ticket ID(s) across the uploaded files were counted once (latest file wins).`);
    if (noId) dq.push(`${noId} row(s) had no ticket ID; each was counted as its own ticket.`);
    for (const [k, lab] of [['country', 'Country'], ['product', 'Product'], ['brand', 'Brand']]) {
      const v = [...variants[k].entries()].sort((a, b) => b[1] - a[1]);
      if (v.length) dq.push(`${lab} spellings unified: ${v.slice(0, 6).map(([s, c]) => `${esc(s)} (${c})`).join(', ')}${v.length > 6 ? ` and ${v.length - 6} more` : ''}.`);
    }
    return {tickets: [...byId.values()], rowsIn};
  }

  // ------------------------------------------------------------- segment filter
  function resolveSegment(cfg, segRows, pfRows) {
    const seg = {key: cfg.segment || '', label: cfg.label || '', owner: cfg.owner || '', brands: list(cfg.brands), countries: list(cfg.countries), pairs: [],
      org_contains: list(cfg.org_contains), org_excludes: list(cfg.org_excludes), notes: cfg.segment_notes || ''};
    if (cfg.segment && segRows) {
      const hit = segRows.find(r => norm(r.segment) === norm(cfg.segment) || norm(r.label) === norm(cfg.segment));
      if (!hit) throw new Error(`Segment "${cfg.segment}" not found in segments.csv. Available: ${segRows.map(r => r.segment).join(', ')}`);
      seg.key = clean(hit.segment); seg.label = seg.label || clean(hit.label) || seg.key; seg.owner = seg.owner || clean(hit.owner);
      if (!seg.brands.length) seg.brands = list(hit.brands); if (!seg.countries.length) seg.countries = list(hit.countries);
      if (!seg.org_contains.length) seg.org_contains = list(hit.org_contains); if (!seg.org_excludes.length) seg.org_excludes = list(hit.org_excludes);
      seg.notes = seg.notes || clean(hit.notes);
    }
    if (cfg.account_manager) {
      const am = (pfRows || []).find(r => norm(r.account_manager) === norm(cfg.account_manager)) ||
        (pfRows || []).find(r => norm(r.account_manager).includes(norm(cfg.account_manager)));
      if (!am) throw new Error(`Account manager "${cfg.account_manager}" not found in am-portfolio.csv. Available: ${(pfRows || []).map(r => r.account_manager).join(', ')}`);
      seg.pairs = list(am.pairs).map(p => { const [b, c] = p.split('@'); return [canonBrand(clean(b)), c === '*' ? '*' : canonCountry(clean(c))]; });
      seg.owner = seg.owner || clean(am.account_manager); seg.key = seg.key || 'AM';
      seg.label = seg.label || `${clean(am.account_manager)} – own accounts`;
    }
    seg.brands = seg.brands.filter(b => !/^all$/i.test(b)).map(canonBrand);
    seg.countries = seg.countries.filter(c => !/^all$/i.test(c)).map(canonCountry);
    if (!seg.label) {
      const parts = [seg.brands.join(' & '), seg.countries.length > 3 ? `${seg.countries.length} markets` : seg.countries.join(', '),
        seg.org_contains.length ? `orgs "${seg.org_contains.join('", "')}"` : ''].filter(Boolean);
      seg.label = parts.join(' · ') || 'All brands · Europe';
    }
    const desc = [];
    if (!seg.pairs.length || seg.brands.length) desc.push(seg.brands.length ? `Brands: ${seg.brands.join(', ')}` : 'Brands: all');
    if (!seg.pairs.length || seg.countries.length) desc.push(seg.countries.length ? `Markets: ${seg.countries.join(', ')}` : 'Markets: all');
    if (seg.org_contains.length) desc.push(`Organisation contains: ${seg.org_contains.join(' / ')}`);
    if (seg.org_excludes.length) desc.push(`Excluding organisations containing: ${seg.org_excludes.join(' / ')}`);
    if (seg.pairs.length) desc.push(`Account portfolio: ${seg.pairs.length} brand × market combinations (${[...new Set(seg.pairs.map(p => p[0]))].join(', ')})`);
    seg.description = desc.join(' · ');
    return seg;
  }
  function inSegment(t, seg) {
    if (seg.brands.length && !seg.brands.includes(t.brand)) return false;
    if (seg.countries.length && !seg.countries.includes(t.country)) return false;
    const o = t.org.toLowerCase();
    if (seg.org_contains.length && !seg.org_contains.some(p => o.includes(p.toLowerCase()))) return false;
    if (seg.org_excludes.some(p => o.includes(p.toLowerCase()))) return false;
    if (seg.pairs.length && !seg.pairs.some(([b, c]) => b === t.brand && (c === '*' || c === t.country))) return false;
    return true;
  }

  // ------------------------------------------------------------- aggregation
  function dimension(ts, key, months, topN) {
    const tot = new Map(), byM = new Map();
    for (const t of ts) {
      const v = t[key] || BLANK, k = ym(t.req);
      tot.set(v, (tot.get(v) || 0) + 1);
      if (!byM.has(v)) byM.set(v, Object.fromEntries(months.map(m => [m, 0])));
      byM.get(v)[k]++;
    }
    const all = [...tot.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const ranked = all.filter(([v]) => v !== BLANK);
    const top = ranked.slice(0, topN).map(([v, c]) => ({label: v, total: c, pct: pct(c, ts.length), monthly: months.map(m => byM.get(v)[m])}));
    const last = months[months.length - 1];
    const latest = ranked.map(([v]) => ({label: v, total: byM.get(v)[last]})).sort((a, b) => b.total - a.total).slice(0, topN);
    const lastTot = ts.filter(t => ym(t.req) === last).length;
    latest.forEach(x => x.pct = pct(x.total, lastTot));
    const otherTotal = ts.length - top.reduce((s, x) => s + x.total, 0);
    return {top, latest, other: otherTotal, distinct: ranked.length, blank: tot.get(BLANK) || 0};
  }
  function breakdown(ts, topN) {
    return {country: dimension(ts, 'country', [], topN).top, product: dimension(ts, 'product', [], topN).top,
      reason: dimension(ts, 'reason', [], topN).top, org: dimension(ts, 'org', [], topN).top, total: ts.length};
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

  function buildDashboardData(inputs, config) {
    const cfg = Object.assign({top_n: 5, prepared_by: 'Intellegam', exclude_automated: false}, config || {});
    const N = cfg.top_n, dq = [];
    const {tickets: all, rowsIn} = loadTickets(inputs.tickets || [], cfg, dq);
    if (!all.length) throw new Error('No tickets found in the uploaded files.');
    const seg = resolveSegment(cfg, inputs.segments, inputs.portfolio);

    // period
    const monthsAll = [...new Set(all.map(t => ym(t.req)))].sort();
    const from = cfg.from || monthsAll[0], to = cfg.to || monthsAll[monthsAll.length - 1];
    const months = []; { let [y, m] = from.split('-').map(Number); const [ty, tm] = to.split('-').map(Number);
      while (y < ty || (y === ty && m <= tm)) { months.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } }
    const snapshotT = Math.max(...all.map(t => Math.max(t.req.t, t.solved ? t.solved.t : 0)));
    const snap = new Date(snapshotT), snapLabel = `${snap.getUTCDate()} ${MFULL[snap.getUTCMonth() + 1]} ${snap.getUTCFullYear()}`;
    const lastM = months[months.length - 1];
    const lastEnd = Date.UTC(+lastM.slice(0, 4), +lastM.slice(5), 1);
    const partial = snapshotT < lastEnd - 86400000 * 2;
    if (partial) dq.push(`The export ends on ${snapLabel}, so ${MFULL[+lastM.slice(5)]} ${lastM.slice(0, 4)} is not complete; its figures will still grow.`);
    const gaps = months.filter(m => !monthsAll.includes(m) && m > monthsAll[0] && m < monthsAll[monthsAll.length - 1]);
    if (gaps.length) dq.push(`No tickets at all for ${gaps.map(ymLabel).join(', ')} — probably a missing export for these months; the trend shows them as zero.`);
    const firstWithData = monthsAll.find(m => months.includes(m));
    if (firstWithData && firstWithData !== months[0]) dq.push(`No tickets before ${ymLabel(firstWithData)} in the export; earlier months show as zero.`);

    const periodAll = all.filter(t => months.includes(ym(t.req)));
    const automatedAll = periodAll.filter(t => t.automated);
    let base = periodAll;
    if (cfg.exclude_automated) base = periodAll.filter(t => !t.automated);
    const ts = base.filter(t => inSegment(t, seg));
    const autoSeg = ts.filter(t => t.automated).length + (cfg.exclude_automated ? periodAll.filter(t => t.automated && inSegment(t, seg)).length : 0);
    if (autoSeg) dq.push(cfg.exclude_automated
      ? `${autoSeg} automated system ticket(s) (Superservice Connect Team "DMS Errors …" alerts) were excluded; they are not customer contacts.`
      : `${autoSeg} ticket(s) in this view are automated system alerts (Superservice Connect Team "DMS Errors …"), mostly DMS Issues / Connect. They are included, as in the CSC overview; ask for "without automated alerts" to drop them.`);
    if (!ts.length) throw new Error(`No tickets match the segment (${seg.description}) in ${months[0]} – ${lastM}. Check the segment definition in segments.csv.`);

    // blanks + suspicious values within the segment
    const blanks = {};
    for (const [k, lab] of [['brand', 'Brand'], ['country', 'Country'], ['product', 'Product'], ['reason', 'Case Reason'], ['origin', 'Case Origin']]) {
      const b = ts.filter(t => !t[k]); if (!b.length) continue;
      const nw = b.filter(t => /^new$/i.test(t.status)).length;
      blanks[lab] = b.length;
      dq.push(`${b.length} ticket(s) with empty ${lab}${nw ? ` (${nw} still in status New, i.e. not triaged yet)` : ''} — shown as "${BLANK}" and not ranked. Ticket IDs: ${b.slice(0, 12).map(t => t.id).join(', ')}${b.length > 12 ? ' …' : ''}`);
    }
    const eu = ts.filter(t => /^europe$/i.test(t.country)).length;
    if (eu) dq.push(`${eu} ticket(s) carry Country = "Europe" (system / pan-European tickets, not a market).`);
    const segShare = pct(ts.length, base.length);

    // KPIs
    const byMonth = months.map(m => ts.filter(t => ym(t.req) === m));
    const monthly = byMonth.map(x => x.length);
    const openM = byMonth.map(x => x.filter(t => !t.closed).length);
    const totalAllM = months.map(m => base.filter(t => ym(t.req) === m).length);
    const closedTs = ts.filter(t => t.closed && t.solved && t.solved.t >= t.req.t);
    const avgDays = closedTs.length ? Math.round(closedTs.reduce((s, t) => s + (t.solved.t - t.req.t), 0) / closedTs.length / 864e5 * 10) / 10 : null;
    const sameDay = closedTs.length ? pct(closedTs.filter(t => t.solved.t - t.req.t <= 864e5).length, closedTs.length) : null;
    const admin = ts.filter(t => ADMIN.includes(t.reason.toLowerCase())).length;
    const n = months.length, last = monthly[n - 1], prev = n > 1 ? monthly[n - 2] : null;
    const kpis = {
      total: ts.length, months: n, avg_month: Math.round(ts.length / n), last, prev, last_label: ymLabel(lastM),
      mom: prev ? pct(last - prev, prev) : null, share_of_all: segShare, all_total: base.length,
      open: ts.filter(t => !t.closed).length, closed_pct: pct(ts.filter(t => t.closed).length, ts.length),
      avg_days: avgDays, within_24h: sameDay, admin_pct: pct(admin, ts.length), admin
    };

    // dimensions
    const dims = {};
    for (const k of ['brand', 'country', 'product', 'reason', 'origin', 'org']) dims[k] = dimension(ts, k, months, k === 'org' ? 10 : N);
    const multiBrand = dims.brand.distinct > 1;
    const primary = multiBrand ? 'brand' : 'country';

    // focus reason (her "Add/Remove User tickets by brand") = #1 case reason, split by primary dimension
    const focusReason = cfg.focus_reason || (dims.reason.top[0] && dims.reason.top[0].label) || '';
    const focusTs = ts.filter(t => t.reason === focusReason);
    const focus = {reason: focusReason, total: focusTs.length, pct: pct(focusTs.length, ts.length), by: primary,
      series: dims[primary].top.map(x => ({label: x.label, monthly: months.map(m => focusTs.filter(t => t[primary] === x.label && ym(t.req) === m).length)}))};
    focus.series.forEach(s => s.share = pct(s.monthly.reduce((a, b) => a + b, 0), focusTs.length));

    // drill-downs per top item of the primary dimension
    const drill = dims[primary].top.map(x => {
      const sub = ts.filter(t => t[primary] === x.label);
      const b = breakdown(sub, N);
      const d = {label: x.label, total: sub.length, pct: x.pct, monthly: x.monthly, open: sub.filter(t => !t.closed).length};
      for (const k of ['country', 'product', 'reason', 'org']) d[k] = b[k].map(i => ({label: i.label, total: i.total, pct: pct(i.total, sub.length)}));
      if (primary === 'brand') d.brand = null; else d.brand = dimension(sub, 'brand', [], N).top.map(i => ({label: i.label, total: i.total, pct: pct(i.total, sub.length)}));
      return d;
    });

    // open items by product / reason (snapshot)
    const openTs = ts.filter(t => !t.closed);
    const openBy = k => dimension(openTs, k, [], N).top.map(i => ({label: i.label, total: i.total}));

    // findings (computed, directional)
    const findings = [];
    const tb = dims[primary].top[0], tr = dims.reason.top[0], tp = dims.product.top[0];
    if (tb) findings.push(`<b>${esc(tb.label)}</b> is the largest ${primary === 'brand' ? 'brand' : 'market'} with ${fmt(tb.total)} tickets (${tb.pct}% of this view).`);
    if (tr) findings.push(`<b>${esc(tr.label)}</b> is the #1 case reason: ${fmt(tr.total)} tickets, ${tr.pct}% of all contacts.`);
    if (kpis.admin_pct >= 30) findings.push(`<b>${kpis.admin_pct}%</b> of contacts are user / login / account administration — the clearest candidate for self-service or automation.`);
    if (tp) findings.push(`<b>${esc(tp.label)}</b> drives ${tp.pct}% of tickets.`);
    if (kpis.mom != null && !partial) findings.push(`${kpis.last_label}: ${fmt(last)} tickets, <b class="${kpis.mom > 0 ? 'neg' : 'pos'}">${kpis.mom > 0 ? '+' : ''}${kpis.mom}%</b> vs the previous month.`);
    const peak = monthly.indexOf(Math.max(...monthly));
    if (n >= 3) findings.push(`Peak month: <b>${ymLabel(months[peak])}</b> with ${fmt(monthly[peak])} tickets (average ${fmt(kpis.avg_month)}).`);

    const created = new Date();
    const meta = {
      title: cfg.title || (((seg.key && !/^all/i.test(seg.key)) || seg.brands.length || seg.countries.length || seg.org_contains.length || seg.pairs.length) ? `CSC Tickets — ${seg.label}` : 'Top 5 categories of CSC Tickets'),
      segment: seg.label, segment_key: seg.key, owner: seg.owner, description: seg.description, segment_notes: seg.notes,
      audience: cfg.audience || '', prepared_by: cfg.prepared_by, demo: !!cfg.demo,
      months: months.map(ymLabel), month_keys: months, period_label: `${MFULL[+months[0].slice(5)]} ${months[0].slice(0, 4)} – ${MFULL[+lastM.slice(5)]} ${lastM.slice(0, 4)}`,
      last_month_label: `${MFULL[+lastM.slice(5)]} ${lastM.slice(0, 4)}`, snapshot: snapLabel, partial, multi_brand: multiBrand, primary,
      exclude_automated: !!cfg.exclude_automated, created: `${created.getUTCDate()} ${MFULL[created.getUTCMonth() + 1]} ${created.getUTCFullYear()}`,
      rows_in: rowsIn, tickets_in_export: all.length, top_n: N
    };
    const method = [
      'Reporting month = month of the Zendesk "Requested" timestamp, as exported (no time-zone conversion).',
      'Closed = status Solved or Closed at the time of the export; everything else (Open, Pending, New, On-hold) counts as open. Open figures are a snapshot as of ' + snapLabel + '.',
      'Avg. days to close = mean of Solved − Requested over closed tickets in the period; "within 24 h" uses the same tickets.',
      'Admin requests = Case Reason Add/Remove User(s), Additional permissions, Reset Password, Login Support, Change of Details (Nissan: Account Issues (SSO & Sign In)).',
      'Top 5 lists rank by ticket count over the whole period; empty fields are not ranked. Spelling variants (e.g. UK / United Kingdom, SuperService / Superservice) are unified before counting.',
      'Duplicate ticket IDs across uploaded files are counted once.'
    ];
    return {meta, kpis, trend: {monthly, open: openM, all: totalAllM}, dims: {brand: dims.brand, country: dims.country, product: dims.product, reason: dims.reason, origin: dims.origin, org: dims.org},
      focus, drill, open_by: {product: openBy('product'), reason: openBy('reason')}, findings, dq, method, blanks,
      automated_in_period: automatedAll.length};
  }
  function fmt(x) { return Number(x).toLocaleString('en-GB'); }

  function renderDashboardHtml(template, data) {
    const json = JSON.stringify(data).replace(/<\/script/gi, '<\\/script').replace(/\u2028|\u2029/g, ' ');
    return template.replace('__TITLE__', () => esc(data.meta.title)).replace('__DATA__', () => json);
  }

  function summary(data) {
    const d = data.dims, k = data.kpis;
    const sumMonthly = data.trend.monthly.reduce((a, b) => a + b, 0);
    const prim = d[data.meta.primary];
    const primSum = prim.top.reduce((s, x) => s + x.total, 0) + prim.other;
    return {segment: data.meta.segment, period: data.meta.period_label, snapshot: data.meta.snapshot, partial_last_month: data.meta.partial,
      tickets: k.total, share_of_all_pct: k.share_of_all, avg_per_month: k.avg_month, last_month: k.last, mom_pct: k.mom, open: k.open,
      avg_days_to_close: k.avg_days, admin_pct: k.admin_pct,
      top_brands: d.brand.top.map(x => `${x.label} ${x.total}`), top_countries: d.country.top.map(x => `${x.label} ${x.total}`),
      top_products: d.product.top.map(x => `${x.label} ${x.total}`), top_reasons: d.reason.top.map(x => `${x.label} ${x.total}`),
      reconciled: sumMonthly === k.total && primSum === k.total && data.drill.every(x => x.total === x.monthly.reduce((a, b) => a + b, 0)),
      dq: data.dq.map(x => x.replace(/<[^>]+>/g, ''))};
  }

  function listSegments(segRows) {
    return (segRows || []).map(r => ({segment: clean(r.segment), owner: clean(r.owner), label: clean(r.label), brands: clean(r.brands) || 'all',
      countries: clean(r.countries) || 'all', org_contains: clean(r.org_contains), notes: clean(r.notes)}));
  }

  const api = {buildDashboardData, renderDashboardHtml, summary, listSegments, parseDate, parseCsv};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CscDashboard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
