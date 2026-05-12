/**
 * Quotation Request Prototype (static HTML)
 * - No backend. Uses localStorage as a fake database.
 * - Includes: Home, Create, Summary, Detail
 * - Search across: docNo, project, requester, phone, items (name/model/code/detail/remark)
 * - Admin mode toggle (prototype only)
 */

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

const LS_KEY = "qr_proto_db_v1";
const LS_ADMIN = "qr_proto_admin";

function nowISO(){ return new Date().toISOString(); }


/* QR: balance NOTE textarea height to match FOR block bottom (only affects FOR/NOTE row) */
function balanceForNoteRow(){
  try{
    const frm = document.querySelector('#frmCreate');
    if(!frm) return;

    const noteTa = frm.querySelector('textarea[name="note"]');
    if(!noteTa) return;

    const row = noteTa.closest('.row');
    if(!row) return;

    // FOR side container (left column in this row)
    const leftCol = row.querySelector('input[type="checkbox"]')?.closest('.col') || row.querySelector('.col') || row;
    const forSide = (leftCol.querySelector('.for-list')?.parentElement) || leftCol;

    // Pick the SALE customer input (last text-like input/select in FOR side)
    const inputs = Array.from(forSide.querySelectorAll('input,select,textarea'))
      .filter(el => el.offsetParent !== null && el !== noteTa);

    const textLike = inputs.filter(el =>
      el.tagName === 'SELECT' ||
      (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'search' || el.type === 'tel' || el.type === 'number')) ||
      el.tagName === 'TEXTAREA'
    );
    const saleEl = (textLike.length ? textLike[textLike.length-1] : (inputs.length ? inputs[inputs.length-1] : null));
    if(!saleEl) return;

    // Ensure note field can stretch
    const noteField = noteTa.closest('.field') || noteTa.parentElement;
    if(noteField){
      noteField.style.display = 'flex';
      noteField.style.flexDirection = 'column';
    }

    // Iteratively nudge height so NOTE bottom == Sale input bottom (tiny +2px to counter borders/padding)
    for(let i=0;i<4;i++){
      const saleBottom = saleEl.getBoundingClientRect().bottom;
      const noteBottom = noteTa.getBoundingClientRect().bottom;
      const delta = Math.round(saleBottom - noteBottom) + 2;
      if(Math.abs(delta) <= 1) break;

      const current = noteTa.getBoundingClientRect().height;
      const next = Math.max(132, current + delta);
      noteTa.style.height = next + 'px';
    }
  }catch(e){}
}
function pad3(n){ return String(n).padStart(3,"0"); }
function yymmFromDate(d){
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth()+1).padStart(2,"0");
  return { yy, mm };
}
function newDocNo(prefix, dateStr){
  const d = dateStr ? new Date(dateStr) : new Date();
  const {yy, mm} = yymmFromDate(d);
  const key = `${yy}-${mm}`;
  const db = loadDB();
  db.counters = db.counters || { QR:{}, PR:{}, PO:{}, SHIP:{}, COST:{}, MO:{} };
  db.counters[prefix] = db.counters[prefix] || {};
  db.counters[prefix][key] = (db.counters[prefix][key] || 0) + 1;
  saveDB(db);
  return `${prefix}${yy}-${mm}.${pad3(db.counters[prefix][key])}`;
}

function nanoid(len=16){
  const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  for(let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

function toast(msg){
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(window.__toast_t);
  window.__toast_t = setTimeout(()=> el.classList.remove("show"), 1800);
}

function loadDB(){
  const raw = localStorage.getItem(LS_KEY);
  if(!raw){
    const seeded = seedDB();
    localStorage.setItem(LS_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try { return JSON.parse(raw); } catch {
    const seeded = seedDB();
    localStorage.setItem(LS_KEY, JSON.stringify(seeded));
    return seeded;
  }
}
function saveDB(db){ localStorage.setItem(LS_KEY, JSON.stringify(db)); }

function seedDB(){
  const base = { counters: { QR: {}, PR: {}, PO: {}, SHIP: {}, COST: {}, MO: {} }, qr: [], pr: [], po: [], shipping: [], cost: [], mo: [] };

  const mkQR = (docNo, status, requester, phone, project, items, createdAt) => ({
    kind: "QR",
    id: nanoid(12),
    docNo, docDate: createdAt.slice(0,10),
    project, requester, phone, urgency: "Normal", note: "",
    status,
    editToken: nanoid(24),
    createdAt, updatedAt: createdAt,
    items: items.map((it, idx)=> ({ ...it, lineNo: idx+1, photos: [] })),
    files: { quotation: [], po: [], shipping: [] },
    activity: [{ at: createdAt, actor: `${requester} (${phone})`, action: "SUBMIT", detail: "" }]
  });

  const mkPR = (docNo, status, requester, phone, subject, items, createdAt) => ({
    kind: "PR",
    id: nanoid(12),
    docNo, docDate: createdAt.slice(0,10),
    subject,
    requester, phone,
    remark: "",
    status,
    editToken: nanoid(24),
    createdAt, updatedAt: createdAt,
    items: items.map((it, idx)=> ({ ...it, lineNo: idx+1, photos: [] })),
    approvals: { preparedBy: "", orderedBy: "", approvedBy: "" },
    files: { receipts: [] },
    activity: [{ at: createdAt, actor: `${requester} (${phone})`, action: "SUBMIT", detail: "" }]
  });

  const mkPO = (poNo, status, supplier, currency, items, refs, createdAt) => ({
    kind: "PO",
    id: nanoid(12),
    poNo,
    date: createdAt.slice(0,10),
    supplier,
    currency: currency || "THB",
    status: status || "Draft",

    // references (link to QR/PR + shipping/cost later)
    refs: {
      qrNo: refs?.qrNo || "",
      prNo: refs?.prNo || "",
      qtNo: refs?.qtNo || "",
      deliveryPlan: refs?.deliveryPlan || "",
      receiveDate: refs?.receiveDate || ""
    },

    // purchase items
    items: (items||[]).map((it, idx)=> ({
      lineNo: idx+1,
      productCode: it.productCode || "",
      detail: it.detail || "",
      model: it.model || "",
      serial: it.serial || "",
      qty: Number(it.qty || 0),
      unit: it.unit || "",
      priceUnit: Number(it.priceUnit || 0),
      total: Number(it.total || (Number(it.qty||0)*Number(it.priceUnit||0)))
    })),

    // accounting (v1: minimal fields; v2 will follow worklist)
    accounting: {
      tax7: 0,
      wht: 0,
      exchangeRate: 0, // reference only (cost uses shipment exchange rate)
    },

    // payment table (multi)
    payments: [], // rows: {no, date, amountTHB, note, slipLink}
    attachments: {
      folderLink: "",
      quotation: [],
      customerPO: [],
      customerSlip: [],
      supplierDocs: [],
      supplierSlip: [],
      spec: [],
      shippingDocs: []
    },

    createdAt,
    updatedAt: createdAt,
    activity: [{ at: createdAt, actor: "admin", action: "IMPORT/CREATE", detail: "" }]
  });


  base.qr.push(mkQR("QR26-01.001","Submitted","Somchai","0812345678","XR280E spare parts",[
    { code:"", name:"Clamping block", model:"XR280E", qty:2, unit:"pcs", detail:"Original/OEM", remark:"Urgent" },
    { code:"", name:"Drilling rod", model:"XR280E", qty:10, unit:"pcs", detail:"Length 3m", remark:"Export by sea" }
  ], "2026-01-02T10:10:00.000Z"));

  base.qr.push(mkQR("QR26-01.002","Quoted","Nok","0899998888","Hydraulic pump",[
    { code:"P-112", name:"Hydraulic pump", model:"ABC-900", qty:1, unit:"set", detail:"Include gasket", remark:"" }
  ], "2026-01-03T12:30:00.000Z"));

  base.qr.push(mkQR("QR26-01.003","PO Issued","Beam","0867776666","Tracks & bolts",[
    { code:"", name:"Track bolt", model:"", qty:50, unit:"pcs", detail:"M16", remark:"" }
  ], "2026-01-05T08:40:00.000Z"));

  base.pr.push(mkPR("PR25-11.001","Submitted","Chang A","0801112222","Request Petty cash",[
    { code:"", detail:"DIESEL FOR TEST MACHINE", qty:1, unit:"lot", price:2000 },
    { code:"", detail:"GLASS WOOL PIPE WRAP", qty:1, unit:"lot", price:1000 },
    { code:"", detail:"BELT", qty:1, unit:"lot", price:2000 }
  ], "2025-11-21T09:15:00.000Z"));
  // --- Seed 1 PO (demo) linked to QR26-01.003 ---
  base.po.push(mkPO("PO26-01.001","Open","Demo Supplier","THB",[
    { productCode:"DAY0-TRACK-BOLT", detail:"Track bolt M16", model:"", serial:"", qty:50, unit:"pcs", priceUnit:120, total:6000 }
  ], { qrNo:"QR26-01.003", qtNo:"", prNo:"", deliveryPlan:"", receiveDate:"" }, "2026-01-07T09:00:00.000Z"));


  base.counters.QR["26-01"] = 3;
  base.counters.PR["25-11"] = 1;
  base.counters.PO["26-01"] = 1;

  return base;
}

/* Role */
function isAdmin(){
  return localStorage.getItem(LS_ADMIN) === "1";
}
function setAdminMode(flag){
  localStorage.setItem(LS_ADMIN, flag ? "1" : "0");
  $("#roleLabel").textContent = flag ? "Admin" : "Requester";
  toast(flag ? "เข้าสู่โหมดแอดมินแล้ว" : "กลับเป็นโหมดพนักงานแล้ว");
  renderRoute();
}

/* Escape */
function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* Bilingual Label helper (EN + TH) */
function biLabel(en, th){
  return `
    <span class="lb-en">${escapeHtml(en)}</span>
    <span class="lb-th">${escapeHtml(th)}</span>
  `;
}

/* Inject CSS for bilingual labels (FOR FORMS ONLY because used inside <label> in form pages) */
(function injectBilingualLabelCSS(){
  if(document.querySelector('style[data-mintflow="bilingual-labels"]')) return;
  const css = `
    label .lb-en{ display:block; font-weight:600; line-height:1.1; }
    label .lb-th{ display:block; font-size:12px; font-weight:300; opacity:.72; margin-top:2px; line-height:1.1; }
  

    /* v10: English heading bigger than Thai translation */
    #frmCreate .field > label{
      font-size: 14px !important;   /* English */
      font-weight: 700 !important;
      color: rgba(0,0,0,.72);
    }
    #frmCreate .field > label small,
    #frmCreate .field > label .th{
      font-size: 12px !important;   /* Thai translation */
      font-weight: 500 !important;
      color: rgba(0,0,0,.38) !important;
    }

    /* v10: placeholder (example) smaller + lighter like translation */
    #frmCreate input::placeholder,
    #frmCreate textarea::placeholder{
      font-size: 12px !important;
      color: rgba(0,0,0,.35) !important;
      font-weight: 400 !important;
    }



    /* v11: remove extra top gap inside FOR block (the row that contains NOTE) */
    #frmCreate > .row:has(textarea[name="note"]) .field:first-child{
      padding-top: 0 !important;
      margin-top: 0 !important;
    }
    #frmCreate > .row:has(textarea[name="note"]) .field:first-child > label{
      margin-top: 0 !important;
    }

    /* v14: Items row spacing = 1cm between rows (ONLY inside item cards) */
    #items .card > .row + .row{
      margin-top: 8mm !important;
    }
    /* spacing between last .row and the attach-photos field (which is a direct .field) */
    #items .card > .row + .field{
      margin-top: 8mm !important;
    }
    /* if there are multiple direct .field blocks after rows, keep same rhythm */
    #items .card > .field + .field{
      margin-top: 8mm !important;
    }



    /* v15: tighten rows inside item cards (use top-margin rhythm only) */
    #items .card > .row{ margin-bottom: 0 !important; }

    /* v15: Items code/qty/unit widths: Code = 1/2 (same as Name), QTY+Unit share the other 1/2 */
    #items .card .row.row-codeqty{
      display: grid !important;
      grid-template-columns: 1fr 0.5fr 0.5fr;
      gap: 12px;
      align-items: end;
    }

    .inputPlus{position:relative;width:100%;}
    .inputPlus .input{width:100%;padding-right:46px;}
    .inputPlus .miniBtn{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:22px;height:22px;border-radius:999px;display:flex;align-items:center;justify-content:center;padding:0;font-size:12px;line-height:1;}
    .exportByRow{display:flex;gap:18px;flex-wrap:wrap;align-items:center;padding:4px 0;}
    .exportByRow .chkLine{display:flex;align-items:center;gap:8px;margin:0;}
    .warnBox{margin-top:10px;padding:10px 12px;border:1px dashed rgb(255,153,102);background:rgba(255,153,102,0.08);border-radius:12px;color:#c23b22;font-weight:700;font-size:13px;text-align:center;white-space:nowrap;display:flex;align-items:center;justify-content:center;}
    #items .card .row.row-codeqty > .field{ min-width: 0; }


    /* v24: QR action buttons (Preview/Submit/Cancel) equal width */
    #frmCreate .btnRow3{
      display: grid !important;
      grid-template-columns: repeat(3, 1fr) !important;
      gap: 10px !important;
      align-items: stretch !important;
    }
    #frmCreate .btnRow3 > .btn{ width: 100% !important; }

    /* v24: submit confirm modal (simple, self-contained) */
    .mfModal{ display:none; position:fixed; inset:0; z-index:9999; }
    .mfModal.is-open{ display:block; }
    .mfModal__backdrop{ position:absolute; inset:0; background: rgba(0,0,0,.35); }
    .mfModal__panel{
      position:absolute; left:50%; top:50%; transform: translate(-50%,-50%);
      width: min(440px, calc(100vw - 32px));
      background:#fff; border-radius:16px; padding:16px;
      box-shadow: 0 20px 60px rgba(0,0,0,.25);
    }
    .mfModal__title{ font-weight:800; margin:0 0 8px; letter-spacing:.4px; }
    .mfModal__body{ color: rgba(0,0,0,.65); margin: 0 0 14px; line-height:1.35; }
    .mfModal__actions{ display:flex; gap:10px; justify-content:flex-end; }
    .mfModal__actions .btn{ min-width: 110px; }

`;
  const style = document.createElement("style");
  style.setAttribute("data-mintflow", "bilingual-labels");
  style.textContent = css;
  document.head.appendChild(style);
})();

/* Sidebar balance patch (v1) - make left menu slimmer & less cramped */
(function(){
  const css = `
    /* v8: correct block spacing for the real structure:
       row1 (.row) -> project (.field) -> row3 (.row) -> row4 (.row)
       Make gaps consistent like the 3/4 gap that is already OK.
    */

    /* A) label-to-field tighter (everywhere) */
    #frmCreate .field > label{
      display:block;
      margin: 0 0 2px 0 !important;
      line-height: 1.15;
    }
    #frmCreate .field .hint,
    #frmCreate .field small{ margin-top: 0 !important; }

    /* B) CONSISTENT gaps between top blocks (use 20px baseline ~1cm) */
    #frmCreate > .row{ margin-top: 0 !important; }
    #frmCreate > .field{ margin-top: 0 !important; }

    /* gap: row -> field (DocDate row -> Project field) */
    #frmCreate > .row + .field{ margin-top: 20px !important; }
    /* gap: field -> row (Project field -> Requester row) */
    #frmCreate > .field + .row{ margin-top: 20px !important; }
    /* gap: row -> row (Requester row -> FOR row) */
    #frmCreate > .row + .row{ margin-top: 20px !important; }

    /* C) FOR + NOTE bottom alignment */
    #frmCreate > .row:nth-of-type(3){ /* this is the FOR/NOTE row in this form */
      align-items: stretch !important;
    }
    #frmCreate > .row:nth-of-type(3) .field{
      display:flex;
      flex-direction:column;
    }
    #frmCreate > .row:nth-of-type(3) .field textarea[name="note"]{
      flex:1 1 auto;
      height: 100% !important;
      min-height: 132px;
    }

    /* keep note look */
    #frmCreate textarea[name="note"]{
      width:100%;
      padding:10px 12px;
      border-radius:12px;
      border:1px solid rgba(0,0,0,.12);
      background:#fff;
      font:inherit;
      line-height:1.35;
      resize:vertical;
      box-sizing:border-box;
    }

    #frmCreate .for-list{ margin:0; }
  

    /* v13: make row 3->4 gap match others (override only FOR/NOTE row) */
    #frmCreate > .row:has(textarea[name="note"]){
      margin-top: 16px !important; /* was visually ~1.2cm; pull a hair closer */
    }

`;
  const style = document.createElement("style");
  style.setAttribute("data-mintflow", "qr-section1-align-v8");
  style.textContent = css;
  document.head.appendChild(style);
})();
/* Routing */
function route(){
  const hash = location.hash || "#/home";
  const [_, r, param] = hash.split("/");
  return { r: r || "home", param: param || "" };
}

function setPageTitle(title, sub){
  $("#pageTitle").textContent = title;
  $("#pageSub").textContent = sub || "";
}

function renderRoute(){
  const { r, param } = route();
  $$(".nav-item").forEach(a => a.classList.toggle("active", a.dataset.route === r));
  const view = $("#view");
  if(r === "home") renderHome(view);
  else if(r === "request-qr") renderCreateQR(view);
  else if(r === "summary-qr") renderSummaryQR(view);
  else if(r === "request-pr") renderCreatePR(view);
  else if(r === "summary-pr") renderSummaryPR(view);
  else if(r === "summary-po") renderSummaryPO(view);
  else if(r === "shipping-plan") renderShippingPlan(view);
  else if(r === "claim-mo") renderClaimMO(view);
  else if(r === "summary-mo") renderSummaryMO(view);
  else if(r === "cost") renderCost(view);
  else if(r === "detail") renderDetail(view, param);
  else if(r === "help") renderHelp(view);
  else renderHome(view);
}

/* Views */
function renderHome(el){
  setPageTitle("Home", "รวมฟังก์ชันหลักของ MintFlow (กดแล้วไปได้เลย)");

  const db = loadDB();
  const qrTotal = (db.qr||[]).length;
  const prTotal = (db.pr||[]).length;

  const tiles = [
    { key:"request-qr", title:"Request QR", sub:"ขอราคา + แนบรูปต่อรายการ", ico:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h6v6H4z"/><path d="M14 4h6v6h-6z"/><path d="M4 14h6v6H4z"/><path d="M14 14h3"/><path d="M14 17h6"/><path d="M17 14v6"/><path d="M20 20v0"/></svg>`},
    { key:"summary-qr", title:"Summary QR", sub:`ค้นหา QR ได้ทุกมิติ (ทั้งหมด ${qrTotal})`, ico:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>`},
    { key:"request-pr", title:"Request PR", sub:"ขอเบิก/ขอซื้อ + แนบรูปต่อรายการ", ico:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1-2 1V3z"/><path d="M9 7h6"/><path d="M9 11h6"/><path d="M9 15h4"/></svg>`},

    { key:"summary-pr", title:"Summary PR", sub:`ค้นหา PR ได้ทุกมิติ (ทั้งหมด ${prTotal})`, ico:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>`},
    { key:"summary-po", title:"Summary PO", sub:"นำเข้า PO จาก Excel และค้นหาได้", ico:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/></svg>`},
    { key:"shipping-plan", title:"Shipping Plan", sub:"ติดตามของส่ง / BL / ETA", ico:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h13v10H3z"/><path d="M16 10h4l1 2v5h-5z"/><path d="M7.5 17a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/><path d="M18.5 17a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>`},

    { key:"claim-mo", title:"Claim / Repair (MO)", sub:"ใบแจ้งซ่อม / Maintenance Order", ico:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0-1.4 0L3 16.6V21h4.4l10.3-10.3a1 1 0 0 0 0-1.4z"/><path d="M13 7l4 4"/></svg>`},
    { key:"summary-mo", title:"Summary MO", sub:"สรุปรายการแจ้งซ่อมทั้งหมด", ico:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10v18H7z"/><path d="M9 7h6"/><path d="M9 11h6"/><path d="M9 15h4"/></svg>`},
    { key:"cost", title:"Cost", sub:"ค้นหาต้นทุนจาก Product Code / PO", ico:`<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H6"/></svg>`},
  ];

  el.innerHTML = `
    <div class="card">
      <div class="section-title">
        <h2 style="margin:0">Welcome to <span style="color:var(--orange)">MintFlow</span> 🍊</h2>
        <div class="subtext">โปรโตไทป์หน้าตา/โฟลว์ เพื่อคุยงานก่อนทำของจริง</div>
      </div>

      <div class="hr"></div>

      <div class="tiles">
        ${tiles.map(t=>`
          <div class="tile">
            <div class="row tight" style="gap:12px; align-items:center">
              <div class="ico">${t.ico}</div>
              <div>
                <div class="t-title">${t.title}</div>
                <div class="t-sub">${t.sub}</div>
              </div>
            </div>
            <button class="btn btn-primary" data-go="${t.key}">Go</button>
          </div>
        `).join("")}
      </div>

      <div class="hr"></div>

      <div class="pill" style="margin-top:10px">
        Tip: ค้นจาก “ชื่อตัวเอง / เบอร์ / ชื่อสินค้า / model” ได้เลย ไม่ต้องไล่ทีละหน้า 😄
      </div>

      <ul class="subtext" style="margin:10px 0 0 0">
        <li><b>พนักงาน</b>: สร้าง Request QR/PR + ดูสถานะของตัวเอง</li>
        <li><b>แอดมิน</b>: เพิ่มเอกสารต่างๆ (Quotation/PO/Shipping/Receipt) ผ่านปุ่มในเคส</li>
        <li><b>เวลาตามงาน</b> → ใช้เลขเอกสาร QR/PR หรือค้นหาใน Summary</li>
      </ul>
    </div>
  `;

  $$("[data-go]", el).forEach(b=>{
    b.onclick = ()=> location.hash = `#/${b.dataset.go}`;
  });
}



function badge(status){
  const map = {
    "Draft": ["submitted","Draft"],
    "Submitted": ["submitted","Submitted"],
    "EditRequested": ["submitted","Edit Requested"],
    "Unlocked": ["submitted","Unlocked"],
    "Quoted": ["quoted","Quoted"],
    "PO Issued": ["po","PO Issued"],
    "Shipping": ["shipping","Shipping"],
    "Closed": ["closed","Closed"],
    "Cancelled": ["closed","Cancelled"]
  };
  const [cls, label] = map[status] || ["submitted", status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function fmtMoney(n){
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function poGrandTotal(po){
  return (po.items||[]).reduce((s,it)=> s + Number(it.total||0), 0);
}
function poPaidTotal(po){
  return (po.payments||[]).reduce((s,p)=> s + Number(p.amountTHB||0), 0);
}
function filterPO(pos, q){
  if(!q) return pos;
  const qq = q.toLowerCase();
  return (pos||[]).filter(p=>{
    const hay = [
      p.poNo, p.date, p.supplier, p.currency, p.status,
      p.refs?.qrNo, p.refs?.prNo, p.refs?.qtNo,
      p.refs?.deliveryPlan, p.refs?.receiveDate
    ].filter(Boolean).join(" ").toLowerCase();
    if(hay.includes(qq)) return true;

    for(const it of p.items||[]){
      const ih = [it.productCode, it.detail, it.model, it.serial, it.unit].filter(Boolean).join(" ").toLowerCase();
      if(ih.includes(qq)) return true;
    }
    for(const pay of p.payments||[]){
      const ph = [pay.date, pay.note, pay.slipLink].filter(Boolean).join(" ").toLowerCase();
      if(ph.includes(qq)) return true;
    }
    return false;
  });
}


function renderSummaryQR(el){
  setPageTitle("Summary QR", "ค้นหาได้ทุกมิติ: QR / ชื่อคน / เบอร์ / ชื่อสินค้า / model / code");
  const db = loadDB();
  const q = ($("#globalSearch").value || "").trim().toLowerCase();
  const rows = filterRequests(db.qr||[], q);

  el.innerHTML = `
    <div class="card">
      <div class="section-title">
        <h2>รายการคำขอ (QR)</h2>
        <div class="row tight">
          <button class="btn btn-primary" id="btnCreate2">➕ Create New</button>
          <button class="btn btn-ghost" id="btnReset">Reset demo</button>
        </div>
      </div>
      <div class="subtext">ผลการค้นหา: <b>${escapeHtml(q || "ทั้งหมด")}</b> (${rows.length} รายการ)</div>
      <div class="hr"></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Doc Date</th>
              <th>Doc No.</th>
              <th>Project</th>
              <th>Requester</th>
              <th>Status</th>
              <th>#Items</th>
              <th>Last update</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r=>`
              <tr>
                <td class="mono">${r.docDate}</td>
                <td class="mono"><a href="#/detail/${encodeURIComponent(r.docNo)}">${r.docNo}</a></td>
                <td>${escapeHtml(r.project||"")}</td>
                <td>${escapeHtml(r.requester)}<div class="subtext">${escapeHtml(r.phone)}</div></td>
                <td>${badge(r.status)}</td>
                <td>${r.items.length}</td>
                <td class="mono">${(r.updatedAt||"").slice(0,10)}</td>
                <td>
                  <div class="actions">
                    <button class="btn btn-small" data-open="${r.docNo}">Open</button>
                    <button class="kebab" data-kebab="${r.docNo}">⋯</button>
                  </div>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="8">ไม่พบข้อมูล</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="section-title">
        <h2>Filters (mock)</h2>
        <div class="subtext">ในเวอร์ชันจริงจะมีกรอง Status / Date range / Has PO/Shipping เป็นต้น</div>
      </div>
      <div class="row">
        <button class="btn btn-ghost" data-filter="Submitted">Submitted</button>
        <button class="btn btn-ghost" data-filter="Quoted">Quoted</button>
        <button class="btn btn-ghost" data-filter="PO Issued">PO Issued</button>
        <button class="btn btn-ghost" data-filter="Shipping">Shipping</button>
        <button class="btn btn-ghost" data-filter="Closed">Closed</button>
      </div>
    </div>
  `;

  $("#btnCreate2").onclick = ()=> location.hash = "#/request-qr";
  $("#btnReset").onclick = ()=>{
    localStorage.removeItem(LS_KEY);
    toast("รีเซ็ตข้อมูลเดโมแล้ว");
    renderRoute();
  };

  $$("[data-open]").forEach(b=>{
    b.onclick = ()=> location.hash = `#/detail/${encodeURIComponent(b.dataset.open)}`;
  });

  $$("[data-filter]").forEach(b=>{
    b.onclick = ()=>{
      $("#globalSearch").value = b.dataset.filter;
      toast("กรองแบบเดโมด้วยคำค้น: " + b.dataset.filter);
      renderRoute();
    };
  });

  setupKebabs();
}

function renderCreateQR(el){
  setPageTitle("Request QR", "กรอกให้ครบ แนบรูปต่อรายการ แล้วระบบออกเลข QR อัตโนมัติ");
  const today = new Date().toISOString().slice(0,10);

  el.innerHTML = `
    <div class="card">
        <style>
          .for-list{display:flex;flex-direction:column;gap:10px}
          .for-line{display:flex;align-items:center;gap:10px}
          .chk{display:flex;align-items:center;gap:10px;white-space:nowrap}
          .for-line .input{flex:1}
          textarea[name="note"]{min-height:96px}

          /* Layout A: 2 columns inside the form (Section 1 / Items) */
          .mfLayoutA{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;}
          .mfLayoutA .mfCol{min-width:0;}
          @media(max-width: 920px){.mfLayoutA{grid-template-columns:1fr;}}
        


</style>

        <h2 style="margin:0 0 10px">Create Quotation Request (QR)</h2>
        <div class="subtext">* โปรโตไทป์นี้จะบันทึกลงเครื่อง (localStorage) เพื่อดูหน้าตาระบบ</div>
        <div class="hr"></div>

        <form class="form" id="frmCreate">

          <div class="mfLayoutA">
            <div class="mfCol left" id="mfS1">
          <div class="row">
            <div class="field">
              <label>${biLabel("Doc Date", "วันที่")}</label>
              <input class="input" name="docDate" type="date" value="${today}" />
            </div>
            <div class="field">
              <label>${biLabel("Urgency", "ความเร่งด่วน")}</label>
              <select name="urgency">
                <option>Normal</option>
                <option>Urgent</option>
                <option>Very Urgent</option>
              </select>
            </div>
            <div class="field">
              <label>${biLabel("Export By", "การส่งออกทาง")}</label>
              <select class="input" name="exportBy">
                <option value="">-- Select export method --</option>
                <option value="By Sea">By Sea</option>
                <option value="By Land">By Land</option>
                <option value="By Air">By Air</option>
              </select>
            </div>
          </div>

          <div class="row">
            <div class="field">
              <label>${biLabel("Project / Subject", "โครงการ / หัวข้อ")}</label>
              <input class="input" name="project" placeholder="เช่น XR280E spare parts / Pump / Track bolts" />
            </div>
            <div class="field">
              <label>${biLabel("For Customer", "สำหรับลูกค้า")}</label>
              <input class="input" name="forCustomer" placeholder="ระบุชื่อลูกค้า" />
            </div>
          </div>

          <div class="row">
            <div class="field">
              <label>${biLabel("Claim", "ชื่อบริษัทลูกค้า")}</label>
              <input class="input" name="phone" />
            </div>
            <div class="field">
              <label>${biLabel("Requester", "ชื่อผู้ขอ (จำเป็น)")}</label>
              <select class="input is-placeholder" name="requester" required>
                <option value="">-- Select requester --</option>
                <option value="Chakrit (Heeb)">Chakrit (Heeb)</option>
                <option value="Jirawat (Tor)">Jirawat (Tor)</option>
                <option value="K.Lim">K.Lim</option>
                <option value="K.Yang">K.Yang</option>
                <option value="Kanrawee (Kling)">Kanrawee (Kling)</option>
                <option value="Ratthaphol (Frame)">Ratthaphol (Frame)</option>
                <option value="Rojarnon (Non)">Rojarnon (Non)</option>
                <option value="Phantita (Ning)">Phantita (Ning)</option>
                <option value="Saowarak (Nok)">Saowarak (Nok)</option>
                <option value="Sudarat (Mhork)">Sudarat (Mhork)</option>
              </select>
            </div>
          </div>

          <div class="row">
            <div class="field">
              <label>${biLabel("FOR", "สำหรับ")}</label>
              <div class="for-list">
                <label class="chk"><input type="checkbox" name="forStock" value="Stock" /> Stock</label>
                <div class="for-line">
                  <label class="chk"><input type="checkbox" id="forRepairChk" name="forRepair" value="Repair" /> Repair</label>
                  <input class="input" id="forRepairTxt" name="forRepairTxt" placeholder="For Sale / For Customer" disabled />
                </div>
                <div class="for-line">
                  <label class="chk"><input type="checkbox" id="forSaleChk" name="forSale" value="Sale" /> Sale</label>
                  <input class="input" id="forSaleTxt" name="forSaleTxt" placeholder="Name Customer" disabled />
                </div>
              </div>
            </div>

            <div class="field">
              <label>${biLabel("Note", "หมายเหตุเพิ่มเติม")}</label>
              <textarea name="note"></textarea>
            </div>
</div>
            

          <div class="warnBox" title="**Please add product spec detail, picture and show export rate**">**Please add product spec detail, picture and show export rate**</div>
</div>
            <div class="mfCol right" id="mfS2">

            <div class="hr"></div>
<div id="items"></div>

          <div class="row btnRow3">
            <button class="btn btn-ghost" type="button" id="btnPreview">Preview</button>
            <button class="btn btn-primary" type="submit" id="btnSubmit">Submit</button>
            <button class="btn btn-ghost" type="button" id="btnCancel">Cancel</button>
          </div>

          <!-- Submit confirm modal -->
          <div class="mfModal" id="submitModal" aria-hidden="true">
            <div class="mfModal__backdrop" data-close="1"></div>
            <div class="mfModal__panel" role="dialog" aria-modal="true" aria-labelledby="mfModalTitle">
              <div class="mfModal__title" id="mfModalTitle">PREVIEW</div>
              <div class="mfModal__body">กรุณาตรวจสอบความถูกต้องของข้อมูลก่อนกดส่ง</div>
              <div class="mfModal__actions">
                <button class="btn btn-primary" type="button" id="btnConfirmSubmit">Confirm</button>
                <button class="btn btn-ghost" type="button" id="btnCancelSubmit">Cancel</button>
              </div>
            </div>
          </div>

          <div id="submitNote" class="pill submit-note">หลัง Submit: ระบบจะสร้าง QR + ไฟล์ PDF/Excel (ของจริง) และเก็บลง Drive อัตโนมัติ</div>
          <!-- Preview modal (FlowAccount style) -->
          <div class="mfModal" id="previewModal" aria-hidden="true">
            <div class="mfModal__backdrop" data-close="1"></div>
            <div class="mfModal__panel" role="dialog" aria-modal="true" aria-labelledby="mfPreviewTitle">
              <div class="row" style="justify-content:space-between; align-items:center; gap:12px;">
                <div class="mfModal__title" id="mfPreviewTitle" style="margin:0">Preview</div>
                <div class="row tight" style="gap:8px; justify-content:flex-end;">
                  <button class="btn btn-ghost" type="button" id="btnPrintPreview">Print</button>
                  <button class="btn btn-ghost" type="button" id="btnClosePreview" data-close="1">Close</button>
                </div>
              </div>
              <div class="hr"></div>
              <div id="previewBody" class="subtext">กรอกข้อมูลแล้วกด Preview</div>
            </div>
          </div>

          <datalist id="unitList">
            <option value="Trip"></option>
            <option value="Unit"></option>
            <option value="Kg."></option>
            <option value="Km."></option>
            <option value="Box"></option>
            <option value="Set"></option>
            <option value="Pcs."></option>
            <option value="Hr."></option>
            <option value="Mth."></option>
            <option value="Sqm."></option>
            <option value="Year"></option>
            <option value="Pack"></option>
            <option value="Metr"></option>
            <option value="Doz."></option>
          </datalist>
            </div>
          </div>

</form>
    </div>
  `;

  // Layout A: remove redundant "Items" title (if present) at top of right column
  try{
    const s2 = document.querySelector("#mfS2");
    const titleH2 = s2 && s2.querySelector(".section-title h2");
    if(titleH2 && titleH2.textContent.trim() === "Items"){
      const wrap = titleH2.closest(".section-title");
      if(wrap) wrap.remove();
    }
  }catch(e){}


  
  // v9: keep NOTE textarea bottom aligned with FOR block
  setTimeout(()=>{ requestAnimationFrame(()=>{ balanceForNoteRow(); }); }, 0);
  window.addEventListener('resize', balanceForNoteRow);
  // Custom unit options (free, no backend)
  const MF_UNITS_KEY = "mf_units_custom_v1";
  const getCustomUnits = () => {
    try { return JSON.parse(localStorage.getItem(MF_UNITS_KEY) || "[]"); } catch(e){ return []; }
  };
  const saveCustomUnits = (arr) => localStorage.setItem(MF_UNITS_KEY, JSON.stringify(arr));
  const ensureUnitList = () => {
    const dl = document.getElementById("unitList");
    if(!dl) return;
    const existing = new Set(Array.from(dl.querySelectorAll("option")).map(o => (o.value||"").trim()).filter(Boolean));
    const custom = getCustomUnits();
    custom.forEach(u => {
      const v = String(u||"").trim();
      if(!v || existing.has(v)) return;
      const opt = document.createElement("option");
      opt.value = v;
      dl.appendChild(opt);
      existing.add(v);
    });
  };
  ensureUnitList();

const itemsEl = $("#items");
  const addItem = ()=>{
    const idx = itemsEl.children.length + 1;
    const block = document.createElement("div");
    block.className = "card";
    block.style.boxShadow = "none";
    block.style.marginBottom = "10px";
    block.innerHTML = `
      <div class="section-title">
        <h3 style="margin:0">Item #${idx}</h3>
</div>
      <div class="row">
        <div class="field">
          <label>${biLabel("Name", "ชื่อสินค้า/อะไหล่ (จำเป็น)")}</label>
          <input class="input" name="item_name" placeholder="ชื่ออะไหล่/สินค้า" required />
        </div>
        <div class="field">
          <label>${biLabel("Model", "รุ่น")}</label>
          <input class="input" name="item_model" placeholder="XR280E / XR320E ..." />
        </div>
      </div>
      <div class="row row-codeqty">
        <div class="field">
          <label>${biLabel("Code", "รหัสสินค้า")}</label>
          <input class="input" name="item_code" placeholder="ถ้ามี" />
        </div>
        <div class="field">
          <label>${biLabel("QTY", "จำนวน (จำเป็น)")}</label>
          <input class="input" name="qty" type="number" min="0" step="0.01" value="1" required />
        </div>
        <div class="field">
          <label>${biLabel("Unit", "หน่วย (จำเป็น)")}</label>
          <div class="inputPlus">
            <input class="input" name="unit" list="unitList" style="flex:1" />
            <button type="button" class="miniBtn" data-add-unit title="Add unit" aria-label="Add unit">+</button>
          </div>
        </div>
      </div>

      <div class="field">
        <label>${biLabel("Detail", "รายละเอียด/สเปก")}</label>
        <textarea class="input" name="detail" rows="2" placeholder="Spec/Detail e.g. Original/OEM, size, length..." style="min-height:56px; resize:vertical;"></textarea>
      </div>
<div class="row row-export-attach row-attach-only">
  <div class="field">
    <label>${biLabel("Attach photos", "แนบรูปต่อรายการ")}</label>
    <input class="input" name="photos" type="file" accept="image/*" multiple />
    <div class="subtext" data-ph-list></div>

    <div class="itemControls">
      <button class="btn btn-danger btn-small" type="button" data-action="delItem">ลบ</button>
      <button class="btn btn-ghost" type="button" data-action="addItem">+ เพิ่มรายการ</button>
    </div>


  </div>
</div>
      </div>
    `;
    const _rm = block.querySelector("[data-remove]");
    if(_rm) _rm.onclick = ()=>{
      block.remove();
      renumberItems();
    };
    const fileInput = block.querySelector('input[name="photos"]');
    const phList = block.querySelector("[data-ph-list]");
    fileInput.onchange = ()=>{
      const names = Array.from(fileInput.files||[]).map(f=>f.name);
      phList.textContent = names.length ? "แนบแล้ว: " + names.join(", ") : "";
    };
    // "+" add unit (append to datalist + persist in localStorage)
    const addUnitBtn = block.querySelector('[data-add-unit]');
    if(addUnitBtn){
      addUnitBtn.addEventListener("click", () => {
        const v = prompt("Add new unit", "");
        const unit = (v || "").trim();
        if(!unit) return;
        const custom = getCustomUnits();
        if(!custom.includes(unit)) { custom.push(unit); saveCustomUnits(custom); }
        ensureUnitList();
        const unitInput = block.querySelector('[name="unit"]');
        if(unitInput) unitInput.value = unit;
      });
    }

    itemsEl.appendChild(block);
  };

  const renumberItems = ()=>{
    Array.from(itemsEl.children).forEach((c, i)=>{
      const h3 = c.querySelector("h3");
      if(h3) h3.textContent = `Item #${i+1}`;
    });
  };
  // Item controls (Add / Delete) - delegated (stable even after re-render)
  const syncItemControls = ()=>{
    const cards = $$("#items > .card");
    cards.forEach((c, i)=>{
      const controls = c.querySelector(".itemControls");
      if(!controls) return;
      controls.style.display = (i === cards.length-1) ? "flex" : "none";
    });
  };

  itemsEl.addEventListener("click", (e)=>{
    const btn = e.target.closest('button[data-action]');
    if(!btn) return;

    const action = btn.getAttribute("data-action");
    if(action === "addItem"){
      addItem();
      renumberItems();
      syncItemControls();
      return;
    }
    if(action === "delItem"){
      const cards = $$("#items > .card");
      if(cards.length <= 1) return;
      cards[cards.length-1].remove();
      renumberItems();
      syncItemControls();
      return;
    }
  });


// FOR: enable detail inputs only when checked
  const repairChk = $("#forRepairChk");
  const saleChk = $("#forSaleChk");
  const repairTxt = $("#forRepairTxt");
  const saleTxt = $("#forSaleTxt");
  const syncFor = () => {
    if(repairChk && repairTxt){
      repairTxt.disabled = !repairChk.checked;
      repairTxt.required = !!repairChk.checked;
      if(!repairChk.checked) repairTxt.value = "";
    }
    if(saleChk && saleTxt){
      saleTxt.disabled = !saleChk.checked;
      saleTxt.required = !!saleChk.checked;
      if(!saleChk.checked) saleTxt.value = "";
    }
  };
  if(repairChk) repairChk.addEventListener("change", syncFor);
  if(saleChk) saleChk.addEventListener("change", syncFor);
  syncFor();

  $("#btnCancel").onclick = ()=> location.hash = "#/home";

  addItem();
  renumberItems();
  syncItemControls();


  // v24: Preview + submit confirm flow
  const submitModal = $("#submitModal");
  const openSubmitModal = ()=>{
    if(!submitModal) return true;
    submitModal.classList.add("is-open");
    submitModal.setAttribute("aria-hidden","false");
    return false;
  };
  const closeSubmitModal = ()=>{
    if(!submitModal) return;
    submitModal.classList.remove("is-open");
    submitModal.setAttribute("aria-hidden","true");
  };

  // build preview as "real document" inside modal (FlowAccount-ish, no required enforcement)
  const renderPreviewFromData = (data)=>{
    const __pvTarget = $("#previewBody") || $("#preview");
    if(!__pvTarget) return;

    // Inject preview-doc CSS once (scoped to .mfPreviewDoc*)
    (function injectPreviewDocCSS(){
      if(document.querySelector('style[data-mintflow="preview-doc"]')) return;
      const css = `
        .mfPreviewDocPaper{
          width: 794px; max-width: 100%;
          margin: 0 auto;
          background:#fff;
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 14px;
          padding: 18px 18px 16px;
          box-shadow: 0 10px 28px rgba(0,0,0,.10);
          color:#111;
        }
        .mfPreviewDocHeader{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:10px;}
        .mfPreviewDocTitle{font-weight:900;letter-spacing:.3px;font-size:18px;line-height:1.1;margin:0;}
        .mfPreviewDocMeta{font-size:12px;color:rgba(0,0,0,.62);line-height:1.3;}
        .mfPreviewDocGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;}
        .mfPreviewDocBlock{padding:10px 12px;border:1px solid rgba(0,0,0,.08);border-radius:12px;}
        .mfPreviewDocBlock h3{margin:0 0 8px;font-size:12px;letter-spacing:.2px;color:rgba(0,0,0,.55);}
        .mfPreviewDocLine{display:flex;gap:8px;line-height:1.25;margin:6px 0;font-size:13px;}
        .mfPreviewDocLine b{min-width:92px;display:inline-block;color:rgba(0,0,0,.72);}
        .mfPreviewDocNote{white-space:pre-wrap;}
        .mfPreviewDocTable{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px;}
        .mfPreviewDocTable th,.mfPreviewDocTable td{border:1px solid rgba(0,0,0,.10);padding:6px 7px;vertical-align:top;}
        .mfPreviewDocTable th{background:rgba(0,0,0,.035);text-align:left;font-weight:800;color:rgba(0,0,0,.72);}
        .mfPreviewDocFooter{margin-top:10px;font-size:12px;color:rgba(0,0,0,.55);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;}
        .mfPreviewDocPill{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border:1px dashed rgba(255,153,102,.55);background:rgba(255,153,102,.08);border-radius:999px;font-weight:800;color:#c23b22;}
        @media (max-width: 980px){
          .mfPreviewDocGrid{grid-template-columns:1fr;}
        }
        @media print{
          body *{visibility:hidden !important;}
          #previewModal, #previewModal *{visibility:visible !important;}
          #previewModal{position:static !important; inset:auto !important;}
          #previewModal .mfModal__backdrop{display:none !important;}
          #previewModal .mfModal__panel{position:static !important; left:auto !important; top:auto !important; transform:none !important; box-shadow:none !important; width:100% !important; padding:0 !important;}
          #previewModal .row, #previewModal .hr{display:none !important;} /* hide modal chrome */
          .mfPreviewDocPaper{border:none !important; box-shadow:none !important; padding:0 !important;}
        }
      `;
      const style = document.createElement("style");
      style.setAttribute("data-mintflow","preview-doc");
      style.textContent = css;
      document.head.appendChild(style);
    })();

    const val = (v)=> (v==null || String(v).trim()==="" ? "" : String(v));
    const line = (k,v)=> v ? `<div class="mfPreviewDocLine"><b>${escapeHtml(k)}</b><div>${escapeHtml(v)}</div></div>` : "";
    const noteLine = (k,v)=> v ? `<div class="mfPreviewDocLine"><b>${escapeHtml(k)}</b><div class="mfPreviewDocNote">${escapeHtml(v)}</div></div>` : "";

    const docDate = val(data.docDate);
    const urgency = val(data.urgency);
    const project = val(data.project);
    const requester = val(data.requester);
    const phone = val(data.phone);
    const forMode = val(data.forMode || data.for); // tolerate legacy key
    const note = val(data.note);
    const exportBy = Array.isArray(data.exportBy) ? data.exportBy.filter(Boolean) : (val(data.exportBy) ? [val(data.exportBy)] : []);
    const attachCount = data.attachCount != null ? String(data.attachCount) : "";

    const items = Array.isArray(data.items) ? data.items : [];
    const itemsRows = items.map((it, i)=>{
      const c = (x)=> escapeHtml(val(x));
      return `
        <tr>
          <td style="width:34px">${i+1}</td>
          <td>${c(it.name)}</td>
          <td>${c(it.model)}</td>
          <td>${c(it.code)}</td>
          <td style="width:70px">${c(it.qty)}</td>
          <td style="width:80px">${c(it.unit)}</td>
          <td>${c(it.detail)}</td>
        </tr>
      `;
    }).join("");

    __pvTarget.innerHTML = `
      <div class="mfPreviewDocPaper" id="mfPreviewDocPaper">
        <div class="mfPreviewDocHeader">
          <div>
            <div class="mfPreviewDocTitle">Quotation Request</div>
            <div class="mfPreviewDocMeta">Preview only (ยังไม่ส่งจริง)</div>
          </div>
          <div class="mfPreviewDocMeta" style="text-align:right">
            ${docDate ? `Doc Date: ${escapeHtml(docDate)}<br>` : ``}
            ${urgency ? `Urgency: ${escapeHtml(urgency)}<br>` : ``}
            ${data.docNo ? `Doc No: ${escapeHtml(data.docNo)}<br>` : ``}
          </div>
        </div>

        <div class="mfPreviewDocGrid">
          <div class="mfPreviewDocBlock">
            <h3>Section 1</h3>
            ${line("Project", project)}
            ${line("Requester", requester)}
            ${line("Claim", phone)}
            ${line("FOR", forMode)}
            ${noteLine("Note", note)}
          </div>

          <div class="mfPreviewDocBlock">
            <h3>Section 2</h3>
            ${exportBy.length ? `<div class="mfPreviewDocLine"><b>Export By</b><div>${escapeHtml(exportBy.join(", "))}</div></div>` : ``}
            ${attachCount ? line("Attach", attachCount) : ``}
            <div class="mfPreviewDocLine"><b>Items</b><div>${items.length} รายการ</div></div>
            <div class="mfPreviewDocPill" style="margin-top:10px;">ตรวจสอบก่อน Submit</div>
          </div>
        </div>

        ${items.length ? `
          <table class="mfPreviewDocTable" aria-label="Items table">
            <thead>
              <tr>
                <th style="width:34px">#</th>
                <th>Name</th>
                <th>Model</th>
                <th>Code</th>
                <th style="width:70px">QTY</th>
                <th style="width:80px">Unit</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
          </table>
        ` : `<div class="mfPreviewDocFooter"><div>ยังไม่มีรายการ Items</div></div>`}

        <div class="mfPreviewDocFooter">
          <div>${requester ? `Prepared by: ${escapeHtml(requester)}` : ``}</div>
          <div>${nowISO ? `Generated: ${escapeHtml(nowISO().slice(0,19).replace("T"," "))}` : ``}</div>
        </div>
      </div>
    `;

    $("#previewModal")?.classList.add("is-open");
  };

  const collectQRFromForm = ({strict=true}={}) => {
    const form = $("#frmCreate");
    if(!form) throw new Error("Form not ready");

    const getFormVal = (name)=>{
      const el = form.elements ? form.elements[name] : null;
      return (el && typeof el.value === "string") ? el.value : (el && el.value != null ? String(el.value) : "");
    };
    const getTrim = (name)=> (getFormVal(name) || "").trim();

    const requester = getTrim("requester");
    const phone = getTrim("phone");
    const exportBy = getTrim("exportBy");

    const itemsBlocks = itemsEl ? Array.from(itemsEl.children) : [];
    const items = itemsBlocks.map((blk, idx)=>{
      const q = (sel)=> blk ? blk.querySelector(sel) : null;
      const v = (sel)=> {
        const el = q(sel);
        return el && el.value != null ? String(el.value) : "";
      };
      const t = (sel)=> (v(sel) || "").trim();

      const name = t('input[name="item_name"]');
      const model = t('input[name="item_model"]');
      const code = t('input[name="item_code"]');

      const qtyRaw = v('input[name="qty"]');
      const qty = Number(qtyRaw || 0);

      // unit can be select or input; always query by [name="unit"]
      const unit = (t('[name="unit"]') || "");

      const detailEl = q('textarea[name="detail"], input[name="detail"]');
      const detail = (detailEl && detailEl.value != null ? String(detailEl.value) : "").trim();

      const sea = !!q('input[name="exportSea"]')?.checked;
      const land = !!q('input[name="exportLand"]')?.checked;
      const air = !!q('input[name="exportAir"]')?.checked;

      const exportParts = [];
      if(sea) exportParts.push("By Sea");
      if(land) exportParts.push("By Land");
      if(air) exportParts.push("By Air");

      const remarkInput = q('input[name="remark"]');
      const remark = exportParts.length ? exportParts.join(" / ") : ((remarkInput && remarkInput.value != null ? String(remarkInput.value) : "").trim());

      const photosInput = q('input[name="photos"]');
      const photos = photosInput && photosInput.files ? Array.from(photosInput.files).map(f=>f.name) : [];

      return { lineNo: idx+1, code, name, model, qty, unit, detail, remark, photos, exportBy: exportParts };
    });

    const forListEl = $("#forList");
    const forBy = forListEl ? Array.from(forListEl.querySelectorAll('input[type="checkbox"]:checked')).map(x=>x.value) : [];

    return {
      docDate: getFormVal("docDate"),
      urgency: getFormVal("urgency"),
      project: getTrim("project"),
      subject: getTrim("subject"),
      requester, phone, exportBy,
      forBy,
      note: getTrim("note"),
      items
    };
  };


  // Helpers: treat a completely blank form as "no preview"
  // We consider "blank" = user hasn't typed anything meaningful.
  // Default values like docDate, urgency, qty=1, unit default don't count as meaningful.
  const isAllEmptyQR = (d)=>{
    if(!d) return true;

    const anyTop = !!((d.project||"").trim() || (d.subject||"").trim() || (d.requester||"").trim() || (d.phone||"").trim() || (d.note||"").trim());
    const anyFor = Array.isArray(d.forBy) && d.forBy.length>0;

    const anyItems = Array.isArray(d.items) && d.items.some(it=>{
      const hasText = !!((it.name||"").trim() || (it.model||"").trim() || (it.code||"").trim() || (it.detail||"").trim());
      const hasRemark = !!((it.remark||"").trim());
      const hasPhotos = Array.isArray(it.photos) && it.photos.length>0;
      const hasExport = Array.isArray(it.exportBy) && it.exportBy.length>0;
      // qty/unit alone doesn't count
      return hasText || hasRemark || hasPhotos || hasExport;
    });

    return !(anyTop || anyFor || anyItems);
  };



  // Wire Preview button
  const btnPreview = $("#btnPreview");
  if(btnPreview){
    btnPreview.onclick = ()=>{
      try{
        const data = collectQRFromForm({strict:false});
        if(isAllEmptyQR(data)){
          toast("กรุณากรอกข้อมูลก่อนพรีวิว");
          // try focus requester field if exists
          const f = $("#frmCreate");
          if(f && f.requester) f.requester.focus();
          return;
        }
        renderPreviewFromData(data);
        toast("เปิดพรีวิวแล้ว");
      }catch(err){
        toast(err?.message || "Preview error");
      }
    };
  }

  // Modal wiring
  if(submitModal){
    submitModal.addEventListener("click", (ev)=>{
      const t = ev.target;
      if(t && t.getAttribute && t.getAttribute("data-close")==="1"){ closeSubmitModal(); }
    });
  }

  const previewModal = $("#previewModal");
  const closePreviewModal = ()=> previewModal?.classList.remove("is-open");
  if(previewModal){
    previewModal.addEventListener("click",(ev)=>{
      const t = ev.target;
      if(t && t.getAttribute && t.getAttribute("data-close")==="1"){ closePreviewModal(); }
    });
  }
  const btnClosePreview = $("#btnClosePreview");
  if(btnClosePreview) btnClosePreview.onclick = ()=> closePreviewModal();


  const btnPrintPreview = $("#btnPrintPreview");
  if(btnPrintPreview){
    btnPrintPreview.onclick = ()=>{
      try{
        // print the preview document only
        $("#previewModal")?.classList.add("is-open");
        window.print();
      }catch(e){
        toast("Print error");
      }
    };
  }


  const btnCancelSubmit = $("#btnCancelSubmit");
  if(btnCancelSubmit) btnCancelSubmit.onclick = ()=> closeSubmitModal();

  $("#frmCreate").onsubmit = (e)=>{
    e.preventDefault();
    // show Preview reminder before submit
    openSubmitModal();
  };

  // Confirm submit -> run the original submit logic
  const btnConfirmSubmit = $("#btnConfirmSubmit");
  if(btnConfirmSubmit){
    btnConfirmSubmit.onclick = ()=>{
      closeSubmitModal();
      const form = $("#frmCreate");
          const requester = form.requester.value.trim();
          const phone = form.phone.value.trim();
          const exportBy = form.exportBy.value.trim();
          if(!requester){
            toast("ต้องกรอก Requester ก่อนส่ง");
            return;
          }

          const itemBlocks = Array.from(itemsEl.children);
          if(!itemBlocks.length){
            toast("ต้องมีอย่างน้อย 1 รายการ");
            return;
          }

          const items = itemBlocks.map((blk, idx)=>{
            const name = blk.querySelector('input[name="item_name"]').value.trim();
            const model = blk.querySelector('input[name="item_model"]').value.trim();
            const code = blk.querySelector('input[name="item_code"]').value.trim();
            const qty = Number(blk.querySelector('input[name="qty"]').value || 0);
            const unit = blk.querySelector('[name="unit"]').value.trim();
            const detailEl = blk.querySelector('textarea[name="detail"], input[name="detail"]');
            const detail = (detailEl ? detailEl.value : "").trim();

            // Export By (checkboxes) -> store into remark (backward compatible)
            const sea = !!blk.querySelector('input[name="exportSea"]')?.checked;
            const land = !!blk.querySelector('input[name="exportLand"]')?.checked;
            const air = !!blk.querySelector('input[name="exportAir"]')?.checked;
            const exportParts = [];
            if(sea) exportParts.push("By Sea");
            if(land) exportParts.push("By Land");
            if(air) exportParts.push("By Air");

            const remarkInput = blk.querySelector('input[name="remark"]');
            const remark = exportParts.length ? exportParts.join(" / ") : ((remarkInput ? remarkInput.value : "").trim());
            const photos = Array.from(blk.querySelector('input[name="photos"]').files || []).map(f=>f.name);

            if(!name || !(qty > 0)){
              throw new Error(`รายการที่ ${idx+1} ต้องมี Name และ QTY>0`);
            }
            return { lineNo: idx+1, code, name, model, qty, unit, detail, remark, photos };
          });

          try{
            items.forEach((it, i)=>{
              if(!it.name || !(it.qty>0) || !it.unit) throw new Error(`รายการที่ ${i+1} ไม่ครบ`);
            });
          }catch(err){
            toast(err.message);
            return;
          }

          const docDate = form.docDate.value;
          const docNo = newDocNo("QR", docDate);
          const db = loadDB();
          db.qr = db.qr || [];

          const reqObj = {
            kind: "QR",
            id: nanoid(12),
            docNo,
            docDate,
            project: form.project.value.trim(),
            requester,
            phone,
            exportBy,
            forStock: !!form.forStock?.checked,
            forRepair: !!form.forRepair?.checked,
            forRepairTxt: (form.forRepairTxt?.value || "").trim(),
            forSale: !!form.forSale?.checked,
            forSaleTxt: (form.forSaleTxt?.value || "").trim(),
            urgency: form.urgency.value,
            note: form.note.value.trim(),
            status: "Submitted",
            editToken: nanoid(24),
            createdAt: nowISO(),
            updatedAt: nowISO(),
            items: items.map(it=> ({...it, photos: it.photos.map(n=> ({ name:n, addedAt: nowISO() }))})),
            files: { quotation: [], po: [], shipping: [] },
            activity: [{ at: nowISO(), actor: `${requester} (${phone})`, action:"SUBMIT", detail:"" }]
    };

    if(!reqObj.exportBy){
      reqObj.exportBy = "";
    }
  }

    db.qr.unshift(reqObj);
    saveDB(db);

    $("#preview").innerHTML = `
      <div class="pill">สร้างคำขอสำเร็จ: <b class="mono">${docNo}</b></div>
      <div class="hr"></div>
      <div><b>Project:</b> ${escapeHtml(reqObj.project||"-")}</div>
      <div><b>Requester:</b> ${escapeHtml(reqObj.requester)} (${escapeHtml(reqObj.phone)})</div>
      <div><b>Export By:</b> ${escapeHtml(reqObj.exportBy || "-")}</div>
      <div><b>Items:</b> ${reqObj.items.length}</div>
      <div class="hr"></div>
      <button class="btn btn-primary" id="btnGoDetail">เปิดเคสนี้</button>
    `;

    $("#btnGoDetail").onclick = ()=> location.hash = `#/detail/${encodeURIComponent(docNo)}`;
    toast("สร้าง QR สำเร็จ: " + docNo);
  };
}

function renderCreatePR(el){
  setPageTitle("Request PR", "ขอเบิก/ขอซื้อ (PR) + แนบรูปต่อรายการ + ระบบออกเลข PR อัตโนมัติ");
  const today = new Date().toISOString().slice(0,10);

  el.innerHTML = `
    <div class="card">
        <style>
          .for-list{display:flex;flex-direction:column;gap:10px}
          .for-line{display:flex;align-items:center;gap:10px}
          .chk{display:flex;align-items:center;gap:10px;white-space:nowrap}
          .for-line .input{flex:1}
          textarea[name="note"]{min-height:96px}

          /* Layout A: 2 columns inside the form (Section 1 / Items) */
          .mfLayoutA{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;}
          .mfLayoutA .mfCol{min-width:0;}
          @media(max-width: 920px){.mfLayoutA{grid-template-columns:1fr;}}
        
          .mfSelEdit{display:grid;grid-template-columns:1fr 34px 34px;gap:8px;align-items:center}
          .mfSelEdit select{width:100%;min-width:0}
          .mfMiniBtn{width:34px;height:34px;border-radius:10px;border:1px solid var(--border);background:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-weight:700;color:var(--text)}
          .mfMiniBtn:hover{border-color:rgba(249,115,22,.6)}


/* === PR ONLY: hide legacy FOR block (keep in DOM for JS logic) === */
.form.isPR .mfForLegacy{display:none !important;}
</style>

        <h2 style="margin:0 0 10px">Create Purchase Requisition (PR & Work Order)</h2>
        <div class="subtext">* โปรโตไทป์นี้จะบันทึกลงเครื่อง (localStorage) เพื่อดูหน้าตาระบบ</div>
        <div class="hr"></div>

        <form class="form isPR" id="frmCreate">

          <div class="mfLayoutA">
            <div class="mfCol left" id="mfS1">
        <!-- ===== NEW ROW 1: Doc Date + Request Type + Urgency (PATCH) ===== -->
        <div class="row">
          <div class="field">
            <label>Doc Date<br><small>วันที่</small></label>
            <input class="input" type="date" name="docDate" />
          </div>
          <div class="field">
            <label>Request Type<br><small>ประเภทคำขอ</small></label>
            <select class="input" name="requestType">
              <option value="Petty Cash">Petty Cash</option>
              <option value="Work Order">Work Order</option>
            </select>
          </div>
          <div class="field">
            <label>Urgency<br><small>ความเร่งด่วน</small></label>
            <select class="input" name="urgency">
              <option value="Normal">Normal</option>
              <option value="Urgent">Urgent</option>
              <option value="Very Urgent">Very Urgent</option>
            </select>
          </div>
        </div>
        <!-- ===== END NEW ROW 1 ===== -->
        <!-- ===== NEW ROW 2: For Job + Project/Subject (PATCH) ===== -->
        <div class="row">
          <div class="field">
            <label>For job<br><small>สำหรับงาน</small></label>
            <select class="input" name="forJob">
              <option value="">-- Select job --</option>
              <option value="Repair">Repair</option>
              <option value="Sale">Sale</option>
              <option value="Stock">Stock</option>
            </select>
          </div>
          <div class="field">
            <label>Project / Subject<br><small>โครงการ / หัวข้อ</small></label>
            <input class="input" name="projectSubjectNew" placeholder="เช่น XR280E spare parts / Pump / Track bolts" />
          </div>
        </div>
        <!-- ===== END NEW ROW 2 ===== -->
        <!-- ===== NEW ROW 3: Model + S/N + For Customer (MASTER LIST IN CODE) ===== -->
        <!--
          PR MASTER LIST (EDIT HERE):
          Models:
            - HDD : XZ360E
            - HDD : XZ480E
            - Drilling RIG : XR280DII
            - GRAB : XG600E
            - GRAB : XG700E
          Customers:
            - Sinkeaw
            - BangMin
            - HDD Thailand
            - JP nelson
        -->
        <div class="row">
          <div class="field">
            <label>Model<br><small>รุ่น</small></label>
            <select class="input is-placeholder" name="prModel">
              <option value="">-- Select model --</option>
              <option value="HDD : XZ360E">HDD : XZ360E</option>
              <option value="HDD : XZ480E">HDD : XZ480E</option>
              <option value="Drilling RIG : XR280DII">Drilling RIG : XR280DII</option>
              <option value="GRAB : XG600E">GRAB : XG600E</option>
              <option value="GRAB : XG700E">GRAB : XG700E</option>
            </select>
          </div>

          <div class="field">
            <label>S/N<br><small>Serial Number</small></label>
            <input class="input" type="text" name="prSerial" placeholder="Serial Number" />
          </div>

          <div class="field">
            <label>For Customer<br><small>สำหรับลูกค้า</small></label>
            <select class="input is-placeholder" name="prCustomer">
              <option value="">-- Select customer --</option>
              <option value="2 Combusiness">2 Combusiness</option>
<option value="2 Combusiness Company Limited0">2 Combusiness Company Limited0</option>
<option value="2 SOR Rungrueang Karnyotha">2 SOR Rungrueang Karnyotha</option>
<option value="224 Construction">224 Construction</option>
<option value="88 Interior">88 Interior</option>
<option value="A TECH Telecom">A TECH Telecom</option>
<option value="A.arnancharoen Kollakara">A.arnancharoen Kollakara</option>
<option value="A.b.phasin Development">A.b.phasin Development</option>
<option value="AC Construction JOINT Venture">AC Construction JOINT Venture</option>
<option value="AC Construction">AC Construction</option>
<option value="ACM Development">ACM Development</option>
<option value="ACN Traffic System">ACN Traffic System</option>
<option value="Advance CIVIL GROUP">Advance CIVIL GROUP</option>
<option value="Agrotech Energy">Agrotech Energy</option>
<option value="Akkara Drilling">Akkara Drilling</option>
<option value="AMATA Concrete Products">AMATA Concrete Products</option>
<option value="ARP Telecom Limited">ARP Telecom Limited</option>
<option value="ASIA HDD Construction">ASIA HDD Construction</option>
<option value="ASIA TRUCK">ASIA TRUCK</option>
<option value="ATC POWER">ATC POWER</option>
<option value="ATN Global Logistics">ATN Global Logistics</option>
<option value="August Engineering And Construction">August Engineering And Construction</option>
<option value="AUSY Constructions">AUSY Constructions</option>
<option value="Automation Technology Knowledge">Automation Technology Knowledge</option>
<option value="B&K Telecom">B&K Telecom</option>
<option value="B.P. POWER">B.P. POWER</option>
<option value="Baanplee Construction">Baanplee Construction</option>
<option value="Banana Telecom">Banana Telecom</option>
<option value="Bangkok CRANE AND Service">Bangkok CRANE AND Service</option>
<option value="Bangkok Grand Pacific Lease Public">Bangkok Grand Pacific Lease Public</option>
<option value="Bangmin Engineering">Bangmin Engineering</option>
<option value="Bangsaen Mahanakorn">Bangsaen Mahanakorn</option>
<option value="BC Piling">BC Piling</option>
<option value="BEST Concrete">BEST Concrete</option>
<option value="BETEL Engineering">BETEL Engineering</option>
<option value="BETO Construction Manchinnery">BETO Construction Manchinnery</option>
<option value="BKK CRANE">BKK CRANE</option>
<option value="BKP Construction">BKP Construction</option>
<option value="BLUE Business AND Consultant">BLUE Business AND Consultant</option>
<option value="Bm.telephone">Bm.telephone</option>
<option value="BNKP Tunneling">BNKP Tunneling</option>
<option value="BOOM AND HED D D">BOOM AND HED D D</option>
<option value="Boonchaya LAND">Boonchaya LAND</option>
<option value="Boonthamma Construction">Boonthamma Construction</option>
<option value="BOT Lease Thailand">BOT Lease Thailand</option>
<option value="Boy Service Pro">Boy Service Pro</option>
<option value="Broadband Leader Technology">Broadband Leader Technology</option>
<option value="BSL Leasing">BSL Leasing</option>
<option value="Buriram Thongchai Construction">Buriram Thongchai Construction</option>
<option value="C - Engineering Service">C - Engineering Service</option>
<option value="C N J 2007">C N J 2007</option>
<option value="C.B. WORLD 95">C.B. WORLD 95</option>
<option value="C.K.N Engineering">C.K.N Engineering</option>
<option value="C.l.v.& S.supply">C.l.v.& S.supply</option>
<option value="C.s.b.machine GROUP">C.s.b.machine GROUP</option>
<option value="CAEC Construction">CAEC Construction</option>
<option value="CAEC Machinery">CAEC Machinery</option>
<option value="CANON Marketing Thailand">CANON Marketing Thailand</option>
<option value="CARE CON">CARE CON</option>
<option value="CCS Advance TECH">CCS Advance TECH</option>
<option value="Center POWER Electric">Center POWER Electric</option>
<option value="Ch.water LEAK KAN YOTHA">Ch.water LEAK KAN YOTHA</option>
<option value="Chailekcrane">Chailekcrane</option>
<option value="Chaiwantana Construction">Chaiwantana Construction</option>
<option value="Changhong International Trading">Changhong International Trading</option>
<option value="Chaophaya INTER Marine">Chaophaya INTER Marine</option>
<option value="Charoen KIT Electric AND Service">Charoen KIT Electric AND Service</option>
<option value="Chatchaipiyachat">Chatchaipiyachat</option>
<option value="CHEC THAI">CHEC THAI</option>
<option value="CHEMO Aharon Thailand">CHEMO Aharon Thailand</option>
<option value="Chenjian Construction Thailand">Chenjian Construction Thailand</option>
<option value="CHINA Machine Thailand">CHINA Machine Thailand</option>
<option value="China Railway 11 Bureau Group Thailand">China Railway 11 Bureau Group Thailand</option>
<option value="CHINA Railway Number 10 Thailand">CHINA Railway Number 10 Thailand</option>
<option value="CHINA STATE Construction Engineering Thailand">CHINA STATE Construction Engineering Thailand</option>
<option value="Chinwa Communication">Chinwa Communication</option>
<option value="Cho Phukha">Cho Phukha</option>
<option value="Chockchai Concrete Corporation">Chockchai Concrete Corporation</option>
<option value="Chockchai Concrete Logistics">Chockchai Concrete Logistics</option>
<option value="Chokbandansap 2019">Chokbandansap 2019</option>
<option value="Chokbuncha CIVIL">Chokbuncha CIVIL</option>
<option value="Chokbunma Service">Chokbunma Service</option>
<option value="Chokthanawat2020">Chokthanawat2020</option>
<option value="Chonburi R.S. Construction">Chonburi R.S. Construction</option>
<option value="Chonnatee Construction">Chonnatee Construction</option>
<option value="Chuenchoophrai Construction">Chuenchoophrai Construction</option>
<option value="Chumjitpower">Chumjitpower</option>
<option value="CHUN JO Construction Thailand">CHUN JO Construction Thailand</option>
<option value="CK BORED PILE">CK BORED PILE</option>
<option value="CMG Engineering & Construction">CMG Engineering & Construction</option>
<option value="Compass Union Group Thailand">Compass Union Group Thailand</option>
<option value="Connect Engineering & Service">Connect Engineering & Service</option>
<option value="Crossing Horizon">Crossing Horizon</option>
<option value="CTC Construction">CTC Construction</option>
<option value="Cyberlink Thailand">Cyberlink Thailand</option>
<option value="CYT. Ultimate Success">CYT. Ultimate Success</option>
<option value="D.v.s.construction">D.v.s.construction</option>
<option value="D.y.ngansilp Construction">D.y.ngansilp Construction</option>
<option value="Daw Dang Restaurant">Daw Dang Restaurant</option>
<option value="DAY Solutions">DAY Solutions</option>
<option value="Dech Rungruang Engineering">Dech Rungruang Engineering</option>
<option value="DET Rungrueang KIT">DET Rungrueang KIT</option>
<option value="Doctor HOME Consultants">Doctor HOME Consultants</option>
<option value="Double P Construction GROUP">Double P Construction GROUP</option>
<option value="Double R Productions Publeic">Double R Productions Publeic</option>
<option value="Dragon Drilling">Dragon Drilling</option>
<option value="Drill-tech Thailand">Drill-tech Thailand</option>
<option value="Dynamic Groups Products">Dynamic Groups Products</option>
<option value="EANG TONG KEE">EANG TONG KEE</option>
<option value="Electricity BILLS">Electricity BILLS</option>
<option value="Engo Develop Solutions">Engo Develop Solutions</option>
<option value="Entech PILE">Entech PILE</option>
<option value="EUNG THONG KEE">EUNG THONG KEE</option>
<option value="Feng">Feng</option>
<option value="Flashplussolar">Flashplussolar</option>
<option value="FOR Friend Drilling & Construction">FOR Friend Drilling & Construction</option>
<option value="Fortuna Suppiles">Fortuna Suppiles</option>
<option value="Fulcrum Engineering">Fulcrum Engineering</option>
<option value="Future Foundation">Future Foundation</option>
<option value="G&N Telecom">G&N Telecom</option>
<option value="GD Building Design&construction">GD Building Design&construction</option>
<option value="General Engineering Public">General Engineering Public</option>
<option value="Geoharbour Construction">Geoharbour Construction</option>
<option value="Geomechanical Services">Geomechanical Services</option>
<option value="Global Prospector & Consultant">Global Prospector & Consultant</option>
<option value="Global Techdrill Engineering">Global Techdrill Engineering</option>
<option value="Global Tel Solution">Global Tel Solution</option>
<option value="GOOD FOOD Station 62">GOOD FOOD Station 62</option>
<option value="GPC Construction">GPC Construction</option>
<option value="GRAND Machine Service">GRAND Machine Service</option>
<option value="GRAND Opulent">GRAND Opulent</option>
<option value="Great Communication Network">Great Communication Network</option>
<option value="GRIT">GRIT</option>
<option value="Ground Footing">Ground Footing</option>
<option value="Guangcheng Foundation Engineering">Guangcheng Foundation Engineering</option>
<option value="HDD Thailand">HDD Thailand</option>
<option value="HDD Machinery">HDD Machinery</option>
<option value="Heavy Machine Technology">Heavy Machine Technology</option>
<option value="Highest Intelligent Trading">Highest Intelligent Trading</option>
<option value="HINO ASIA">HINO ASIA</option>
<option value="Hino Soonlhee Samrong">Hino Soonlhee Samrong</option>
<option value="Hippopo Solution">Hippopo Solution</option>
<option value="HMA Construction">HMA Construction</option>
<option value="Hongbao TCP">Hongbao TCP</option>
<option value="Hornumpol Wattana">Hornumpol Wattana</option>
<option value="HT POWER Construction SDN. BHD">HT POWER Construction SDN. BHD</option>
<option value="Hunan Chicheng Construction Engineering">Hunan Chicheng Construction Engineering</option>
<option value="I Design DEE">I Design DEE</option>
<option value="ICE FAR EAST Thailand">ICE FAR EAST Thailand</option>
<option value="Infinity Boring AND Construction">Infinity Boring AND Construction</option>
<option value="Innovation INFO">Innovation INFO</option>
<option value="Interlink">Interlink</option>
<option value="Interlink Rental Thailand">Interlink Rental Thailand</option>
<option value="Intertech AND KRELL Engineering">Intertech AND KRELL Engineering</option>
<option value="Ital Thai Trevi">Ital Thai Trevi</option>
<option value="Italian-thai Development">Italian-thai Development</option>
<option value="ITEM ONE Communication">ITEM ONE Communication</option>
<option value="ITS BORE PILE & RENT">ITS BORE PILE & RENT</option>
<option value="IV TECH">IV TECH</option>
<option value="IZZET ORGEN">IZZET ORGEN</option>
<option value="J.b.b. 2560">J.b.b. 2560</option>
<option value="J.n.c. Machinery">J.n.c. Machinery</option>
<option value="J.r.p.m">J.r.p.m</option>
<option value="J.r.w. Utility Public">J.r.w. Utility Public</option>
<option value="Jacking THAI">Jacking THAI</option>
<option value="JBD Brothers - JH">JBD Brothers - JH</option>
<option value="Jiangsu-orine">Jiangsu-orine</option>
<option value="Jirapat Talpuek">Jirapat Talpuek</option>
<option value="Jitbunruang">Jitbunruang</option>
<option value="Jobbkk DOT COM Recruitment">Jobbkk DOT COM Recruitment</option>
<option value="JOR WANG THO TAI DIN">JOR WANG THO TAI DIN</option>
<option value="Jorlod">Jorlod</option>
<option value="JP Nelson Thailand Limited">JP Nelson Thailand Limited</option>
<option value="JWS Engineering & Service">JWS Engineering & Service</option>
<option value="K PILE">K PILE</option>
<option value="K&P LEO Explorations AND Drilling">K&P LEO Explorations AND Drilling</option>
<option value="K.associates">K.associates</option>
<option value="K.d.w. Trading">K.d.w. Trading</option>
<option value="K.D.W">K.D.W</option>
<option value="K.T.N Engineering 1112">K.T.N Engineering 1112</option>
<option value="KA JOINT Venture">KA JOINT Venture</option>
<option value="Kanrungroj2017 Thailand">Kanrungroj2017 Thailand</option>
<option value="Kantang Hearitage">Kantang Hearitage</option>
<option value="Kasikorn Factory AND Equipmen">Kasikorn Factory AND Equipmen</option>
<option value="Kasikorn Factory AND Equipment">Kasikorn Factory AND Equipment</option>
<option value="Kasikorn Leasing">Kasikorn Leasing</option>
<option value="Kasikornbank">Kasikornbank</option>
<option value="Kasikornbank HEAD Office">Kasikornbank HEAD Office</option>
<option value="KBANK Mr.pichai Chumporn For Unifrom Refund">KBANK Mr.pichai Chumporn For Unifrom Refund</option>
<option value="Khamboklao">Khamboklao</option>
<option value="Kheper Public Utility Thailand">Kheper Public Utility Thailand</option>
<option value="Khun Prasarn Wong'sitthiporn">Khun Prasarn Wong'sitthiporn</option>
<option value="Khun Saner Khumjai">Khun Saner Khumjai</option>
<option value="Khun Sun">Khun Sun</option>
<option value="Khun Thanakit Temrak">Khun Thanakit Temrak</option>
<option value="Kiatnakin Phatra Public">Kiatnakin Phatra Public</option>
<option value="Kijcivil AND Drilling Construction">Kijcivil AND Drilling Construction</option>
<option value="Kitchai Supply">Kitchai Supply</option>
<option value="K-link Marine Solutions">K-link Marine Solutions</option>
<option value="KMIT Construction">KMIT Construction</option>
<option value="KORAT Engineering System">KORAT Engineering System</option>
<option value="Kowyoohah ISUZU SALES Krungthep">Kowyoohah ISUZU SALES Krungthep</option>
<option value="KP Construction & Engineering">KP Construction & Engineering</option>
<option value="KP KYO Phuket Construction">KP KYO Phuket Construction</option>
<option value="KRANG">KRANG</option>
<option value="KRUNG THAI IBJ Leasing">KRUNG THAI IBJ Leasing</option>
<option value="KRUNG Thairungcharoen">KRUNG Thairungcharoen</option>
<option value="Krungthai Mizuho Leasing">Krungthai Mizuho Leasing</option>
<option value="KSB Roongruang">KSB Roongruang</option>
<option value="KSR Roongruang">KSR Roongruang</option>
<option value="Kumpa 02">Kumpa 02</option>
<option value="Kwangphaisan Import Export">Kwangphaisan Import Export</option>
<option value="Ladkrabang BORED PILE">Ladkrabang BORED PILE</option>
<option value="LAN SAENG THAI">LAN SAENG THAI</option>
<option value="Laundry Service By Mr. Singthong Chaiyadech">Laundry Service By Mr. Singthong Chaiyadech</option>
<option value="LETO Construction Engineering">LETO Construction Engineering</option>
<option value="Lianhua">Lianhua</option>
<option value="Lida Machinery Thailand">Lida Machinery Thailand</option>
<option value="LS THAI">LS THAI</option>
<option value="Lumsan Ricemill">Lumsan Ricemill</option>
<option value="M ENG Inspector">M ENG Inspector</option>
<option value="M RICH Construction AND Engineering">M RICH Construction AND Engineering</option>
<option value="M&C DRILL Equipment SDN. BHD">M&C DRILL Equipment SDN. BHD</option>
<option value="M.j.k. AT Suppreme Boring">M.j.k. AT Suppreme Boring</option>
<option value="M.r.pravit Siriwat">M.r.pravit Siriwat</option>
<option value="M.S. Service">M.S. Service</option>
<option value="M.S.G Engineering & Construction">M.S.G Engineering & Construction</option>
<option value="Mac-nels Shipping Thailand">Mac-nels Shipping Thailand</option>
<option value="Mahawattana Construction">Mahawattana Construction</option>
<option value="Maritime Master">Maritime Master</option>
<option value="MASS Corporation">MASS Corporation</option>
<option value="MAX SANY">MAX SANY</option>
<option value="Mb.tech Engineering">Mb.tech Engineering</option>
<option value="MEGA PRIME GROUP">MEGA PRIME GROUP</option>
<option value="Methakarn">Methakarn</option>
<option value="MIN SEN Machinery">MIN SEN Machinery</option>
<option value="Minthong Supplies">Minthong Supplies</option>
<option value="MISS Anunotai Narsok">MISS Anunotai Narsok</option>
<option value="Miss Piyamas Seeda">Miss Piyamas Seeda</option>
<option value="MISS Ratmanee Jitmanee">MISS Ratmanee Jitmanee</option>
<option value="Miss. Rodsukhon Suwan-on">Miss. Rodsukhon Suwan-on</option>
<option value="Mitsubishi HC Capital Thailand">Mitsubishi HC Capital Thailand</option>
<option value="MIXED System">MIXED System</option>
<option value="MPS Construction">MPS Construction</option>
<option value="MR Natthachai Nanudon">MR Natthachai Nanudon</option>
<option value="MR. ZHANG JIE">MR. ZHANG JIE</option>
<option value="Mr. Bunsert Thaboran">Mr. Bunsert Thaboran</option>
<option value="Mr. Jamnong Tinthong">Mr. Jamnong Tinthong</option>
<option value="MR. Jirawat Pokaew">MR. Jirawat Pokaew</option>
<option value="Mr. Kamnueng Plano">Mr. Kamnueng Plano</option>
<option value="Mr. Krairuak Thaivichai">Mr. Krairuak Thaivichai</option>
<option value="Mr. Nattachai Nanudon">Mr. Nattachai Nanudon</option>
<option value="Mr. Pasin Tiskrathok">Mr. Pasin Tiskrathok</option>
<option value="Mr. Pinit Sodsee">Mr. Pinit Sodsee</option>
<option value="MR. Rojarnon Rojanasirisalkul">MR. Rojarnon Rojanasirisalkul</option>
<option value="Mr. Silatee Hongthong">Mr. Silatee Hongthong</option>
<option value="Mr. Somsak Thongsuk">Mr. Somsak Thongsuk</option>
<option value="Mr. Sutin Boonmee">Mr. Sutin Boonmee</option>
<option value="MR. TADA Wiyabun">MR. TADA Wiyabun</option>
<option value="MR. Thiratham Phetcharaburanin">MR. Thiratham Phetcharaburanin</option>
<option value="MR. Warawut Matkaew">MR. Warawut Matkaew</option>
<option value="Mr. Weerawat Thanomchai">Mr. Weerawat Thanomchai</option>
<option value="Mr.bancha Jeekeeree">Mr.bancha Jeekeeree</option>
<option value="Mr.ding ZHENG XUAN">Mr.ding ZHENG XUAN</option>
<option value="Mr.gittiphong Chaochaikhong">Mr.gittiphong Chaochaikhong</option>
<option value="Mr.lim CHIN HIAN">Mr.lim CHIN HIAN</option>
<option value="Mr.machine">Mr.machine</option>
<option value="Mr.phasin Thitkrathok">Mr.phasin Thitkrathok</option>
<option value="Mr.pisit Suwattarakun">Mr.pisit Suwattarakun</option>
<option value="Mr.prajoub Kamprakhon">Mr.prajoub Kamprakhon</option>
<option value="Mr.prapasri Jubjainai">Mr.prapasri Jubjainai</option>
<option value="Mr.pribun Intharawestwilai">Mr.pribun Intharawestwilai</option>
<option value="Mr.seven">Mr.seven</option>
<option value="Mr.sirisak Saonsuk">Mr.sirisak Saonsuk</option>
<option value="Mr.supich PIKUL">Mr.supich PIKUL</option>
<option value="Mr.tossaporn Chantharakhot">Mr.tossaporn Chantharakhot</option>
<option value="Mr.win OO">Mr.win OO</option>
<option value="Mr.witsanu Chotklang">Mr.witsanu Chotklang</option>
<option value="MRS. SAYAN Sreejaiwong">MRS. SAYAN Sreejaiwong</option>
<option value="Ms. Anchalee Thongmaha">Ms. Anchalee Thongmaha</option>
<option value="Ms.prapasri Jubjainai">Ms.prapasri Jubjainai</option>
<option value="Ms.prapawan Kruasaneh">Ms.prapawan Kruasaneh</option>
<option value="Multi-distribution Services">Multi-distribution Services</option>
<option value="Multiphase Connect">Multiphase Connect</option>
<option value="N.a.engineering 2019">N.a.engineering 2019</option>
<option value="N.d.sangsan Construction">N.d.sangsan Construction</option>
<option value="N.i.s.engineering">N.i.s.engineering</option>
<option value="N.P. Cable">N.P. Cable</option>
<option value="NA Promphet">NA Promphet</option>
<option value="Namora Telecom">Namora Telecom</option>
<option value="NANO Engineering & Service">NANO Engineering & Service</option>
<option value="NANO GROUP">NANO GROUP</option>
<option value="Nantong Construction Engineering">Nantong Construction Engineering</option>
<option value="Natthakan Drilling">Natthakan Drilling</option>
<option value="Natthapong BORED PILE">Natthapong BORED PILE</option>
<option value="Nawarat Patanakarn Public">Nawarat Patanakarn Public</option>
<option value="NDT Thailand">NDT Thailand</option>
<option value="NEC Success">NEC Success</option>
<option value="NEO Trucks Thailand">NEO Trucks Thailand</option>
<option value="NESIC Thailand">NESIC Thailand</option>
<option value="Nethub">Nethub</option>
<option value="NINE SW">NINE SW</option>
<option value="Nirada Construction">Nirada Construction</option>
<option value="Niramit Rangsan">Niramit Rangsan</option>
<option value="Nishio RENT ALL Thailand">Nishio RENT ALL Thailand</option>
<option value="Niyomphan PLACE">Niyomphan PLACE</option>
<option value="NK POWER 88">NK POWER 88</option>
<option value="NL Development Public">NL Development Public</option>
<option value="NM Pipeline">NM Pipeline</option>
<option value="NOP Charoenkit">NOP Charoenkit</option>
<option value="Northern SP PIPE">Northern SP PIPE</option>
<option value="Np.communication">Np.communication</option>
<option value="NRT SALES AND Service">NRT SALES AND Service</option>
<option value="One-peach Development">One-peach Development</option>
<option value="P A Ariyakit GROUP">P A Ariyakit GROUP</option>
<option value="P Techline">P Techline</option>
<option value="P Techline Day">P Techline Day</option>
<option value="P.329 Engineering Thailand">P.329 Engineering Thailand</option>
<option value="P.329">P.329</option>
<option value="P.c.develop CIVIL">P.c.develop CIVIL</option>
<option value="P.n.powernet 2000">P.n.powernet 2000</option>
<option value="P.P. Engineering 2018">P.P. Engineering 2018</option>
<option value="P.p.s.k Engineering">P.p.s.k Engineering</option>
<option value="P.vilai">P.vilai</option>
<option value="PA Construction Engineering">PA Construction Engineering</option>
<option value="PAI PIPE Jacking Engineering">PAI PIPE Jacking Engineering</option>
<option value="Palmer Engineering AND Development">Palmer Engineering AND Development</option>
<option value="Panamanee">Panamanee</option>
<option value="Panuwat DRIL AND Engineering">Panuwat DRIL AND Engineering</option>
<option value="Panyakarnyont">Panyakarnyont</option>
<option value="PASIT CIVIL">PASIT CIVIL</option>
<option value="Pat-tara Piling">Pat-tara Piling</option>
<option value="Pattaravut DRILL Engineering">Pattaravut DRILL Engineering</option>
<option value="Phajunchai Engineering">Phajunchai Engineering</option>
<option value="Pharuaykehaphan">Pharuaykehaphan</option>
<option value="Phatharaphon Engineering">Phatharaphon Engineering</option>
<option value="Phatphum">Phatphum</option>
<option value="Phatthalung Chaiburi Construction Limited">Phatthalung Chaiburi Construction Limited</option>
<option value="Phonphinit Kanyotha">Phonphinit Kanyotha</option>
<option value="PHRA Nakhon Construction">PHRA Nakhon Construction</option>
<option value="PHUN DARIN">PHUN DARIN</option>
<option value="PILES Boring">PILES Boring</option>
<option value="Pipeline Crossing Engineering Thailand">Pipeline Crossing Engineering Thailand</option>
<option value="PLAN Engineering & Supply">PLAN Engineering & Supply</option>
<option value="PLUTO SALES AND Services">PLUTO SALES AND Services</option>
<option value="PNT Technology Convergence">PNT Technology Convergence</option>
<option value="Pongpat Enterprise">Pongpat Enterprise</option>
<option value="Pool Telecom">Pool Telecom</option>
<option value="Pootirak Engineering">Pootirak Engineering</option>
<option value="Pornnachakorn">Pornnachakorn</option>
<option value="Pornprasertyotha EAST">Pornprasertyotha EAST</option>
<option value="Praibunjampatong">Praibunjampatong</option>
<option value="Pramsri 2000">Pramsri 2000</option>
<option value="Pravit Siriwat">Pravit Siriwat</option>
<option value="Premier GREEN POWER">Premier GREEN POWER</option>
<option value="Prosper Engineering Public">Prosper Engineering Public</option>
<option value="PSD Construction 2011">PSD Construction 2011</option>
<option value="PSD ROAD Solutions">PSD ROAD Solutions</option>
<option value="PWM Machinery Thailand">PWM Machinery Thailand</option>
<option value="PWP Engineering">PWP Engineering</option>
<option value="Py2546">Py2546</option>
<option value="Pylon Public">Pylon Public</option>
<option value="Quintus Advanced Products Limited">Quintus Advanced Products Limited</option>
<option value="Ratana UNION BORED PILE">Ratana UNION BORED PILE</option>
<option value="Ratana UNION">Ratana UNION</option>
<option value="RCH RCH Joint Venture">RCH RCH Joint Venture</option>
<option value="Regent Green Power">Regent Green Power</option>
<option value="RFT Systems">RFT Systems</option>
<option value="Rigcon Machinery">Rigcon Machinery</option>
<option value="RIGHT Tunnelling Public">RIGHT Tunnelling Public</option>
<option value="Rimmai Construction">Rimmai Construction</option>
<option value="RIRIT Engineering AND Development">RIRIT Engineering AND Development</option>
<option value="RLG Joint Venture">RLG Joint Venture</option>
<option value="Romklao Construction">Romklao Construction</option>
<option value="Royalthai Police">Royalthai Police</option>
<option value="RS ASSET Corporation">RS ASSET Corporation</option>
<option value="Ruamchok Wissawakarn">Ruamchok Wissawakarn</option>
<option value="Ruamlert BORED PILE">Ruamlert BORED PILE</option>
<option value="RUANG Ruethai">RUANG Ruethai</option>
<option value="S C G 1995">S C G 1995</option>
<option value="S E A Business">S E A Business</option>
<option value="S J P Information System">S J P Information System</option>
<option value="S L K 2016">S L K 2016</option>
<option value="S. W. P. Drilling AND Service">S. W. P. Drilling AND Service</option>
<option value="S.c.b. PE Pipeserve">S.c.b. PE Pipeserve</option>
<option value="S.K. Kunatham GROUP">S.K. Kunatham GROUP</option>
<option value="S.k.y. Construction">S.k.y. Construction</option>
<option value="S.permpoon">S.permpoon</option>
<option value="S.permpoon Electric & Development">S.permpoon Electric & Development</option>
<option value="S.s.m.c">S.s.m.c</option>
<option value="Sachin">Sachin</option>
<option value="Saendee DRIL AND Engineering">Saendee DRIL AND Engineering</option>
<option value="Saengfah Borepile">Saengfah Borepile</option>
<option value="Sahakarn Wisavakorn">Sahakarn Wisavakorn</option>
<option value="Sahatanachon">Sahatanachon</option>
<option value="Saimoon Kanyotha">Saimoon Kanyotha</option>
<option value="Saitaidin">Saitaidin</option>
<option value="SBT Tunnelling Construction">SBT Tunnelling Construction</option>
<option value="Seafco Public">Seafco Public</option>
<option value="Sealite Shipping">Sealite Shipping</option>
<option value="SH Crossings">SH Crossings</option>
<option value="SIAM Energy AGROW">SIAM Energy AGROW</option>
<option value="SIAM Kanamoto">SIAM Kanamoto</option>
<option value="SIAM Pathum GROUP">SIAM Pathum GROUP</option>
<option value="Siam Proud Cooperation">Siam Proud Cooperation</option>
<option value="SIAM TONE">SIAM TONE</option>
<option value="Siamextend">Siamextend</option>
<option value="Siamwara Construction & Supply">Siamwara Construction & Supply</option>
<option value="Singular Communication">Singular Communication</option>
<option value="Sinkaew Pronmalai Oomsap">Sinkaew Pronmalai Oomsap</option>
<option value="Sinohydro Thailand HEAD Office">Sinohydro Thailand HEAD Office</option>
<option value="Sinsub VAREE">Sinsub VAREE</option>
<option value="Sirabancha Transport . Lte">Sirabancha Transport . Lte</option>
<option value="Siripriboon Pattanakarn">Siripriboon Pattanakarn</option>
<option value="SIX SIGMA Solution">SIX SIGMA Solution</option>
<option value="SK SPEED">SK SPEED</option>
<option value="SKY Lighting Industry">SKY Lighting Industry</option>
<option value="SMART Pipeline">SMART Pipeline</option>
<option value="SMART TECH Utilities">SMART TECH Utilities</option>
<option value="Social Security">Social Security</option>
<option value="Solaris Wisdom">Solaris Wisdom</option>
<option value="Somkid 2013">Somkid 2013</option>
<option value="Songkhla 115">Songkhla 115</option>
<option value="SP Developer">SP Developer</option>
<option value="SPACE 83">SPACE 83</option>
<option value="Sriracha Sealand">Sriracha Sealand</option>
<option value="Srithai Corporation">Srithai Corporation</option>
<option value="STAND PILE">STAND PILE</option>
<option value="Subthada">Subthada</option>
<option value="Success Marine Service">Success Marine Service</option>
<option value="Suksamai BORED PILE">Suksamai BORED PILE</option>
<option value="SULAK AMNAT">SULAK AMNAT</option>
<option value="SUN MECH">SUN MECH</option>
<option value="SUN Network">SUN Network</option>
<option value="SUN Securitytraning GUARD">SUN Securitytraning GUARD</option>
<option value="SUNEE Karnchang">SUNEE Karnchang</option>
<option value="Sunrise Construction Engineering">Sunrise Construction Engineering</option>
<option value="Sunward International Engineering Thailand">Sunward International Engineering Thailand</option>
<option value="Suphachok Karnyotha">Suphachok Karnyotha</option>
<option value="SV CRANE Service">SV CRANE Service</option>
<option value="Syarikat Kontrektor WISMA SDN BHD">Syarikat Kontrektor WISMA SDN BHD</option>
<option value="T 30 MEDIA">T 30 MEDIA</option>
<option value="T AND T Construction Thailand">T AND T Construction Thailand</option>
<option value="T TEC Engineer">T TEC Engineer</option>
<option value="T.m.i. DRILL">T.m.i. DRILL</option>
<option value="T.m.i.drill & Construction">T.m.i.drill & Construction</option>
<option value="T.m.i.pipe LINE">T.m.i.pipe LINE</option>
<option value="TAI DE FU International">TAI DE FU International</option>
<option value="Tailong Engineering Construction">Tailong Engineering Construction</option>
<option value="Tanalert CIVIL">Tanalert CIVIL</option>
<option value="Tarnas">Tarnas</option>
<option value="TBM AND PIPE Jacking">TBM AND PIPE Jacking</option>
<option value="TBTC JOINT Venture">TBTC JOINT Venture</option>
<option value="TE CHANG Construction Thailand">TE CHANG Construction Thailand</option>
<option value="Terminator">Terminator</option>
<option value="TERRA Expertise">TERRA Expertise</option>
<option value="THAI Agri-pipe">THAI Agri-pipe</option>
<option value="Thai BAUER">Thai BAUER</option>
<option value="Thai Cement Column">Thai Cement Column</option>
<option value="THAI Engineering AND Industry">THAI Engineering AND Industry</option>
<option value="THAI Furukawa Unicomm Engineering">THAI Furukawa Unicomm Engineering</option>
<option value="THAI Laemchabang Terminal">THAI Laemchabang Terminal</option>
<option value="THAI Maruken">THAI Maruken</option>
<option value="THAI Northern Engineering Limited">THAI Northern Engineering Limited</option>
<option value="THAI PRESS PILE">THAI PRESS PILE</option>
<option value="THAI STATE Infrastructure">THAI STATE Infrastructure</option>
<option value="THAI Tomotachi">THAI Tomotachi</option>
<option value="Thaiheyuan Construction GROUP">Thaiheyuan Construction GROUP</option>
<option value="Thailand Rong Sheng Engineering">Thailand Rong Sheng Engineering</option>
<option value="Thaitan Drilling">Thaitan Drilling</option>
<option value="Thaksin Worldwide Development">Thaksin Worldwide Development</option>
<option value="Thammee">Thammee</option>
<option value="Thanthongkhemchor Engineering">Thanthongkhemchor Engineering</option>
<option value="Thanvis Engineering">Thanvis Engineering</option>
<option value="THE FOUR BEAM">THE FOUR BEAM</option>
<option value="THE Revenue Department">THE Revenue Department</option>
<option value="The Thai Credit Retail Bank Public HQ">The Thai Credit Retail Bank Public HQ</option>
<option value="THE WIN Telecom">THE WIN Telecom</option>
<option value="Thong Pluem Kanchang">Thong Pluem Kanchang</option>
<option value="Thongsaenkhan Company Limite">Thongsaenkhan Company Limite</option>
<option value="Thongsaenkhan">Thongsaenkhan</option>
<option value="Thongthanakorn DRILL AND Service">Thongthanakorn DRILL AND Service</option>
<option value="THREE TREES Project">THREE TREES Project</option>
<option value="Tipakorn">Tipakorn</option>
<option value="Tippawan Lamaiphan">Tippawan Lamaiphan</option>
<option value="TITAN Drilling AND Construction">TITAN Drilling AND Construction</option>
<option value="TONG Engineering">TONG Engineering</option>
<option value="Tonphruk Construction">Tonphruk Construction</option>
<option value="Toranee GROUP Service & Engineering">Toranee GROUP Service & Engineering</option>
<option value="TRC Construction Public">TRC Construction Public</option>
<option value="TREE System Telecom">TREE System Telecom</option>
<option value="Triple A Machinery">Triple A Machinery</option>
<option value="Triple B Engineering Solutions">Triple B Engineering Solutions</option>
<option value="Triple Digits">Triple Digits</option>
<option value="Triton Engineering AND Construction Public">Triton Engineering AND Construction Public</option>
<option value="Triton Holding Public">Triton Holding Public</option>
<option value="TRUE MOVE H Universal Communication">TRUE MOVE H Universal Communication</option>
<option value="TRUE Property Service">TRUE Property Service</option>
<option value="Trusty Construction">Trusty Construction</option>
<option value="Udomsak Cheingmai">Udomsak Cheingmai</option>
<option value="U-electric System Limited">U-electric System Limited</option>
<option value="UGO Underground Operation">UGO Underground Operation</option>
<option value="UNC Network">UNC Network</option>
<option value="Underground CIVIL">Underground CIVIL</option>
<option value="Underground Construction Specialist">Underground Construction Specialist</option>
<option value="Unique Engineering AND Construction Public">Unique Engineering AND Construction Public</option>
<option value="Unique Machinery">Unique Machinery</option>
<option value="Unique Tunnelling">Unique Tunnelling</option>
<option value="UOB">UOB</option>
<option value="USAE Thailand">USAE Thailand</option>
<option value="U-TON Telecom System Integration Services Thailand">U-TON Telecom System Integration Services Thailand</option>
<option value="V S Wongsa Construction">V S Wongsa Construction</option>
<option value="Viphuthaivipathorn Kanchang">Viphuthaivipathorn Kanchang</option>
<option value="Viriyapat 0104">Viriyapat 0104</option>
<option value="Vivacity ANMAN Service">Vivacity ANMAN Service</option>
<option value="Volume Energy Construction">Volume Energy Construction</option>
<option value="Vongsarun">Vongsarun</option>
<option value="Vongsayam Korsang">Vongsayam Korsang</option>
<option value="W.r.c. Electric AND Construction">W.r.c. Electric AND Construction</option>
<option value="W.r.c.electric AND Communication">W.r.c.electric AND Communication</option>
<option value="W.s.g. Telephone & NET">W.s.g. Telephone & NET</option>
<option value="Wanmai Enterprise">Wanmai Enterprise</option>
<option value="Wanxiang Business AND Trading">Wanxiang Business AND Trading</option>
<option value="Watchara DRILL Development">Watchara DRILL Development</option>
<option value="Wattson">Wattson</option>
<option value="Wisitchon Construction">Wisitchon Construction</option>
<option value="WONG OLARN GROUP">WONG OLARN GROUP</option>
<option value="Worapatrungrueang">Worapatrungrueang</option>
<option value="WORK OF WORK">WORK OF WORK</option>
<option value="WSP. VIBRO Services">WSP. VIBRO Services</option>
<option value="Wuzhou International Construction">Wuzhou International Construction</option>
<option value="XCMG Thailand">XCMG Thailand</option>
<option value="XCMG Leasing Thailand">XCMG Leasing Thailand</option>
<option value="Xuzhou Construction Machinery GROUP Imp.&exp">Xuzhou Construction Machinery GROUP Imp.&exp</option>
<option value="Xuzhou PLUTO Construction Machinery">Xuzhou PLUTO Construction Machinery</option>
<option value="YIRUN Construction Thailand">YIRUN Construction Thailand</option>
<option value="YJ Service AND Supply">YJ Service AND Supply</option>
<option value="YUAN RONG Construction Thailand">YUAN RONG Construction Thailand</option>
<option value="YX Engineering">YX Engineering</option>
<option value="Zhongyin Construction Engineering Thailand">Zhongyin Construction Engineering Thailand</option>
<option value="Zixuan Engineering">Zixuan Engineering</option>
<option value="ZSEN Technology">ZSEN Technology</option>
<option value="Municipal Waterworks Division Cha-am Municipality">Municipal Waterworks Division Cha-am Municipality</option>
<option value="Mr. Thanakit Temrak">Mr. Thanakit Temrak</option>
<option value="Mr. Pongwiwat Phoohomcharoen">Mr. Pongwiwat Phoohomcharoen</option>
<option value="Mr. Pongsak Thammapanya">Mr. Pongsak Thammapanya</option>
<option value="Mr. Suchart Khammee">Mr. Suchart Khammee</option>
<option value="Mr. Mee">Mr. Mee</option>
<option value="Treesiltems Telecom">Treesiltems Telecom</option>
<option value="Ms. Khanittha Phumlamchiak">Ms. Khanittha Phumlamchiak</option>
<option value="Mr. Nattaphon Inchuay">Mr. Nattaphon Inchuay</option>
<option value="Mr. Prawit Siriwat">Mr. Prawit Siriwat</option>
<option value="Mr. Wutthichai Suriyan">Mr. Wutthichai Suriyan</option>
<option value="Mr. Kosin Kamkhunthot">Mr. Kosin Kamkhunthot</option>
<option value="JP Nelson">JP Nelson</option>
<option value="Thongpluem Karnchang">Thongpluem Karnchang</option>
<option value="Sino-thai Engineering And Construction Public">Sino-thai Engineering And Construction Public</option>
<option value="Green Construction And Engineering">Green Construction And Engineering</option>
<option value="K-link Marine Solution">K-link Marine Solution</option>
<option value="Chalong Concrete 1999">Chalong Concrete 1999</option>
<option value="DTAC Trinet">DTAC Trinet</option>
<option value="T-chan">T-chan</option>
<option value="Thitikorn">Thitikorn</option>
<option value="Hat Yai Ruangchai Karnyotha">Hat Yai Ruangchai Karnyotha</option>
<option value="Itthisorn">Itthisorn</option>
<option value="A Plus Communication">A Plus Communication</option>
<option value="A2K Power Group">A2K Power Group</option>
<option value="Huimeng Supply Chain Freight Thailand">Huimeng Supply Chain Freight Thailand</option>
<option value="Bang Meen">Bang Meen</option>
<option value="Supravee Sirichokwatthanaphon">Supravee Sirichokwatthanaphon</option>
<option value="Somchai Sonthana Construction 2005">Somchai Sonthana Construction 2005</option>
            </select>
          </div>
        </div>
        <!-- ===== END NEW ROW 3 ===== -->


<div class="row">
            <div class="field">
              <label>${biLabel("Claim", "ชื่อบริษัทลูกค้า")}</label>
              <input class="input" name="phone" placeholder="Customer company name" />
            </div>
            <div class="field">
              <label>${biLabel("Requester", "ชื่อผู้ขอ (จำเป็น)")}</label>
              <select class="input is-placeholder" name="requester" required>
                <option value="">-- Select requester --</option>
                <option value="Chakrit (Heeb)">Chakrit (Heeb)</option>
                <option value="Jirawat (Tor)">Jirawat (Tor)</option>
                <option value="K.Lim">K.Lim</option>
                <option value="K.Yang">K.Yang</option>
                <option value="Kanrawee (Kling)">Kanrawee (Kling)</option>
                <option value="Ratthaphol (Frame)">Ratthaphol (Frame)</option>
                <option value="Rojarnon (Non)">Rojarnon (Non)</option>
                <option value="Phantita (Ning)">Phantita (Ning)</option>
                <option value="Saowarak (Nok)">Saowarak (Nok)</option>
                <option value="Sudarat (Mhork)">Sudarat (Mhork)</option>
              </select>
            </div>
          </div>

          
          <div class="row">
            <div class="field mfSupplierField">
              <label>${biLabel("Supplier", "ซัพพลายเออร์")}</label>

              <!-- PR SUPPLIER LIST (EDIT HERE): dropdown A (ฝังลิสต์ในโค้ด) -->
              <select class="input" name="supplier" id="supplierSel">
                <option value="">-- Select supplier --</option>
                <option value="000">000 : ไม่ระบุ</option>
                <option value="SUP01">SUP01 : 1963 Transport </option>
<option value="SUP02">SUP02 : 24 Hours Online Mall </option>
<option value="SUP03">SUP03 : 2P Media </option>
<option value="SUP04">SUP04 : 4.2 Magtire Wheel Center </option>
<option value="SUP05">SUP05 : Ace Filter Part </option>
<option value="SUP06">SUP06 : Acrylic (Thailand) </option>
<option value="SUP07">SUP07 : Aioi Bangkok Insurance </option>
<option value="SUP08">SUP08 : AK Sunthon Construction </option>
<option value="SUP09">SUP09 : Akarasun </option>
<option value="SUP10">SUP10 : Alai Ban Mo Rangsit </option>
<option value="SUP11">SUP11 : All Equipment </option>
<option value="SUP12">SUP12 : Amornchai Shop </option>
<option value="SUP13">SUP13 : Anan Service Lathe </option>
<option value="SUP14">SUP14 : Anon Kitjaroen Motor </option>
<option value="SUP15">SUP15 : ANT Global Logistics </option>
<option value="SUP16">SUP16 : Apiao Percent Rubber </option>
<option value="SUP17">SUP17 : APP Engineering 2021 </option>
<option value="SUP18">SUP18 : Aquip </option>
<option value="SUP19">SUP19 : ARM Media Service </option>
<option value="SUP20">SUP20 : Aroi Yok Lay Restaurant </option>
<option value="SUP21">SUP21 : Aroonrak Construction </option>
<option value="SUP22">SUP22 : ATN Global Logistics </option>
<option value="SUP23">SUP23 : AUB Computergood </option>
<option value="SUP24">SUP24 : Auto Part Nur </option>
<option value="SUP25">SUP25 : B K Rent Group Software and Service </option>
<option value="SUP26">SUP26 : Baan Dara Resort </option>
<option value="SUP27">SUP27 : Ban Rai Phufa Resort </option>
<option value="SUP28">SUP28 : Banana Online </option>
<option value="SUP29">SUP29 : Bangchak Corporation </option>
<option value="SUP30">SUP30 : Bangkok Crane and Service </option>
<option value="SUP31">SUP31 : Bangkok Eaksiam </option>
<option value="SUP32">SUP32 : Bangkok Plast Intertrade </option>
<option value="SUP33">SUP33 : Bigboycrane Transport </option>
<option value="SUP34">SUP34 : Billboard Plus </option>
<option value="SUP35">SUP35 : BLS Hydraulic </option>
<option value="SUP36">SUP36 : BM Service </option>
<option value="SUP37">SUP37 : Boonlert Air </option>
<option value="SUP38">SUP38 : Boy Service Pro </option>
<option value="SUP39">SUP39 : BP Crane & Service </option>
<option value="SUP40">SUP40 : B-Quik </option>
<option value="SUP41">SUP41 : Bypassworld Inter Phuket </option>
<option value="SUP42">SUP42 : C Tract </option>
<option value="SUP43">SUP43 : C&K Power Gen </option>
<option value="SUP44">SUP44 : C.P.L. Group </option>
<option value="SUP45">SUP45 : CAEC Machinery </option>
<option value="SUP46">SUP46 : Cartrack Technologies (Thailand) </option>
<option value="SUP47">SUP47 : CDG Innovation </option>
<option value="SUP48">SUP48 : C-Engineering Service </option>
<option value="SUP49">SUP49 : Center Seal Tract </option>
<option value="SUP50">SUP50 : Central Department Store </option>
<option value="SUP51">SUP51 : Central Material </option>
<option value="SUP52">SUP52 : Chai Nat United </option>
<option value="SUP53">SUP53 : Chai Rungroj Alci </option>
<option value="SUP54">SUP54 : Chaiangmai B.P. Real Estate </option>
<option value="SUP55">SUP55 : Chaichana Concrete </option>
<option value="SUP56">SUP56 : Chaicharoen Inter Print </option>
<option value="SUP57">SUP57 : Chaikasit Supply </option>
<option value="SUP58">SUP58 : Chaiwat Battery + Engine Oil </option>
<option value="SUP59">SUP59 : Chaiyaphon Automotive Air Conditioning Parts </option>
<option value="SUP60">SUP60 : Charoen Chai Trading </option>
<option value="SUP61">SUP61 : Charoen Yont Thai Group </option>
<option value="SUP62">SUP62 : Charoen Yont Thai Pattana </option>
<option value="SUP63">SUP63 : Charoenyothakehaphant </option>
<option value="SUP64">SUP64 : Chayaphon Automobile Air Conditioning Parts </option>
<option value="SUP65">SUP65 : Chayapol Air Conditioner Parts </option>
<option value="SUP66">SUP66 : Chenggang Electrical Engineering (Thailand) </option>
<option value="SUP67">SUP67 : Chiang Rai Dynamo Shop </option>
<option value="SUP68">SUP68 : China Machine (Thailand) </option>
<option value="SUP69">SUP69 : Chinda Resort Hotel </option>
<option value="SUP70">SUP70 : Chinter Product </option>
<option value="SUP71">SUP71 : Cho Chanachai </option>
<option value="SUP72">SUP72 : Chokchai Spare Parts </option>
<option value="SUP73">SUP73 : Chong Charoen Aluminum </option>
<option value="SUP74">SUP74 : Chonlaboon Lohaphan </option>
<option value="SUP75">SUP75 : Chor Ruamchang Diesel </option>
<option value="SUP76">SUP76 : Chusak Charoen Karnchang Shop, Lam Luk Ka Khlong 6 </option>
<option value="SUP77">SUP77 : Cloud 9 Services </option>
<option value="SUP78">SUP78 : COM7 Public </option>
<option value="SUP79">SUP79 : Compack Storage Solutions </option>
<option value="SUP80">SUP80 : Connect Hostel Chiangrai Thailand </option>
<option value="SUP81">SUP81 : Cool Radiator </option>
<option value="SUP82">SUP82 : Coway (Thailand) </option>
<option value="SUP83">SUP83 : CPL Group Public </option>
<option value="SUP84">SUP84 : CRC Thai Watsadu </option>
<option value="SUP85">SUP85 : Cummins DKSH (Thailand) </option>
<option value="SUP86">SUP86 : DHL Express International (Thailand) </option>
<option value="SUP87">SUP87 : D.T. Sourcing </option>
<option value="SUP88">SUP88 : Day Solutions </option>
<option value="SUP89">SUP89 : DC Group </option>
<option value="SUP90">SUP90 : DD Resort </option>
<option value="SUP91">SUP91 : Digital Control Australia </option>
<option value="SUP92">SUP92 : Dohome Public </option>
<option value="SUP93">SUP93 : Dynamo Net </option>
<option value="SUP94">SUP94 : East Coast Furnitech Public </option>
<option value="SUP95">SUP95 : Ekkamon Aluminum </option>
<option value="SUP96">SUP96 : Electricity </option>
<option value="SUP97">SUP97 : Electronics Source </option>
<option value="SUP98">SUP98 : Erawan Security Services </option>
<option value="SUP99">SUP99 : Ergo Insurance (Thailand) Public </option>
<option value="SUP100">SUP100 : Eunt Thong Kee </option>
<option value="SUP101">SUP101 : Euro-Oriental Trading </option>
<option value="SUP102">SUP102 : Europa Hardware Group </option>
<option value="SUP103">SUP103 : Eve & B Engineering </option>
<option value="SUP104">SUP104 : Fae Thai </option>
<option value="SUP105">SUP105 : Fah Song Ma </option>
<option value="SUP106">SUP106 : Fasai Hut and Resort </option>
<option value="SUP107">SUP107 : Fast Auto Drive (Thailand) </option>
<option value="SUP108">SUP108 : FlowAccount </option>
<option value="SUP109">SUP109 : Fonix </option>
<option value="SUP110">SUP110 : Future Spirits (Thailand) </option>
<option value="SUP111">SUP111 : Garage - Namo Dynamo Air </option>
<option value="SUP112">SUP112 : General Store </option>
<option value="SUP113">SUP113 : Ghong Heng Thai </option>
<option value="SUP114">SUP114 : Global Power Logistics Services (Thailand) </option>
<option value="SUP115">SUP115 : Google </option>
<option value="SUP116">SUP116 : GPC Construction </option>
<option value="SUP117">SUP117 : GPM Acrylic - Lazada Shop </option>
<option value="SUP118">SUP118 : GPSiam Part </option>
<option value="SUP119">SUP119 : Great Corner Invent Tech </option>
<option value="SUP120">SUP120 : Guangdong-Hong Kong-Macau Greater Bay Area Club </option>
<option value="SUP121">SUP121 : H.T.D </option>
<option value="SUP122">SUP122 : Hansa-Flex (Thailand) </option>
<option value="SUP123">SUP123 : Hardwarehouse Corporation </option>
<option value="SUP124">SUP124 : Hathairat Charoenyont </option>
<option value="SUP125">SUP125 : Hathairat Oxygen </option>
<option value="SUP126">SUP126 : Heng Dee Heng </option>
<option value="SUP127">SUP127 : Hercules Seal </option>
<option value="SUP128">SUP128 : Hi Premium </option>
<option value="SUP129">SUP129 : High Petroleum </option>
<option value="SUP130">SUP130 : Hitachipump Official Shop </option>
<option value="SUP131">SUP131 : HMA Construction </option>
<option value="SUP132">SUP132 : Home Product Center Public </option>
<option value="SUP133">SUP133 : Home & Office </option>
<option value="SUP134">SUP134 : Hua Tai Trading </option>
<option value="SUP135">SUP135 : Huean Noppakao Resort </option>
<option value="SUP136">SUP136 : Hunan Drillmaster Engineering Technology </option>
<option value="SUP137">SUP137 : Hydro Pneumatic Express </option>
<option value="SUP138">SUP138 : Hydrosyn Corporation </option>
<option value="SUP139">SUP139 : Idea Manufacturing </option>
<option value="SUP140">SUP140 : Ikano (Thailand) </option>
<option value="SUP141">SUP141 : Index Living Mall Public </option>
<option value="SUP142">SUP142 : IngOun Resort </option>
<option value="SUP143">SUP143 : Interlink </option>
<option value="SUP144">SUP144 : IT Smart Home </option>
<option value="SUP145">SUP145 : ITS Bore Pile & Rent </option>
<option value="SUP146">SUP146 : J.I.B Computer Group </option>
<option value="SUP147">SUP147 : Jakawan Autoparts </option>
<option value="SUP148">SUP148 : J-DEA Solutions </option>
<option value="SUP149">SUP149 : Jirasin Lohakarn </option>
<option value="SUP150">SUP150 : JobBKK Recruitment </option>
<option value="SUP151">SUP151 : Joya Wire Mesh (Thailand) </option>
<option value="SUP152">SUP152 : JR Printing & Compute </option>
<option value="SUP153">SUP153 : JR Tubtimsiam Transport </option>
<option value="SUP154">SUP154 : Jugkarin Part Mechanic </option>
<option value="SUP155">SUP155 : K Forklift </option>
<option value="SUP156">SUP156 : K K & K Hydraulic and Supply </option>
<option value="SUP157">SUP157 : K Pile </option>
<option value="SUP158">SUP158 : K. Charoen Hardware </option>
<option value="SUP159">SUP159 : K.J. Crane and Engineering </option>
<option value="SUP160">SUP160 : K.P. Battery </option>
<option value="SUP161">SUP161 : K.S. Ubpagonkreuangmeuchang </option>
<option value="SUP162">SUP162 : Kasetyon Sai Noi </option>
<option value="SUP163">SUP163 : Kasikorn </option>
<option value="SUP164">SUP164 : KBank </option>
<option value="SUP165">SUP165 : KCB Sling (Thailand) </option>
<option value="SUP166">SUP166 : KCH Power Rental </option>
<option value="SUP167">SUP167 : Kerry </option>
<option value="SUP168">SUP168 : Kha Mankhong Steel </option>
<option value="SUP169">SUP169 : Khao Hin Son Hydraulic </option>
<option value="SUP170">SUP170 : Khlang Sap Anan Watsadu Phan </option>
<option value="SUP171">SUP171 : Khlong Khut Autopart </option>
<option value="SUP172">SUP172 : Khlong Sam Wa District Office </option>
<option value="SUP173">SUP173 : Khonkaen KK Trading </option>
<option value="SUP174">SUP174 : Kiadtisak Laiwong </option>
<option value="SUP175">SUP175 : Kiatnakin Phatra Bank </option>
<option value="SUP176">SUP176 : KINE Machine - Shopee </option>
<option value="SUP177">SUP177 : Kiratrading Group </option>
<option value="SUP178">SUP178 : Kitankin </option>
<option value="SUP179">SUP179 : Kiti Engineering </option>
<option value="SUP180">SUP180 : Klangsapanan Watsaduphan </option>
<option value="SUP181">SUP181 : Ko Charoen Hardware </option>
<option value="SUP182">SUP182 : Koing </option>
<option value="SUP183">SUP183 : Krobkruayak </option>
<option value="SUP184">SUP184 : Krueang Mue Ram Ruay </option>
<option value="SUP185">SUP185 : Kuan Langkarnchang - Lazada Shop </option>
<option value="SUP186">SUP186 : L.T.K. Realty (Phunga Hotel) </option>
<option value="SUP187">SUP187 : Laowattana Group </option>
<option value="SUP188">SUP188 : Lathe Shop TFT </option>
<option value="SUP189">SUP189 : Laundry Service by Mr. Singthong Chaiyadech </option>
<option value="SUP190">SUP190 : Lazada Shop </option>
<option value="SUP191">SUP191 : Leader Professional Service </option>
<option value="SUP192">SUP192 : Lertdusit Transport </option>
<option value="SUP193">SUP193 : Lertvilai and Sons </option>
<option value="SUP194">SUP194 : Leto Construction Engineering </option>
<option value="SUP195">SUP195 : Lumlukka Lathe Shop </option>
<option value="SUP196">SUP196 : M & P Total Supply </option>
<option value="SUP197">SUP197 : M Eng Inspector </option>
<option value="SUP198">SUP198 : M Water </option>
<option value="SUP199">SUP199 : Mahacontainer </option>
<option value="SUP200">SUP200 : Mali Seafood Restaurant </option>
<option value="SUP201">SUP201 : Mangmee Bearings </option>
<option value="SUP202">SUP202 : Maritime Master </option>
<option value="SUP203">SUP203 : Maruay Stationery </option>
<option value="SUP204">SUP204 : Max SANY </option>
<option value="SUP205">SUP205 : Maxiflow Engineering </option>
<option value="SUP206">SUP206 : Maxwell LED Lighting Design </option>
<option value="SUP207">SUP207 : MethaKonKosang </option>
<option value="SUP208">SUP208 : Miss Chuleeporn Torsena </option>
<option value="SUP209">SUP209 : Miss Ichaya Khanchai </option>
<option value="SUP210">SUP210 : Miss Nipaporn Kumnurdwong </option>
<option value="SUP211">SUP211 : Miss Noophan Audomlap </option>
<option value="SUP212">SUP212 : Miss Pimolwan Thaweejan </option>
<option value="SUP213">SUP213 : Miss Prartna Mingkaew </option>
<option value="SUP214">SUP214 : Miss Saowalak Mueankaew </option>
<option value="SUP215">SUP215 : Miss Varittha Ekkarithakij </option>
<option value="SUP216">SUP216 : Miss Warunee Saisin </option>
<option value="SUP217">SUP217 : Miss Yureeporn Sripochang </option>
<option value="SUP218">SUP218 : Mitr Apai </option>
<option value="SUP219">SUP219 : Mitsu Metro </option>
<option value="SUP220">SUP220 : Mitsu Rungcharoen </option>
<option value="SUP221">SUP221 : Mitsu Rungrueang </option>
<option value="SUP222">SUP222 : Modern Account Intent </option>
<option value="SUP223">SUP223 : MPJ 789 Auto Accessories </option>
<option value="SUP224">SUP224 : Mr. Atiwat Janhong </option>
<option value="SUP225">SUP225 : Mr. Bancha Jeekiri </option>
<option value="SUP226">SUP226 : Mr. Jirachok Khonphonkrang </option>
<option value="SUP227">SUP227 : Mr. Kanrawee Kaewmuangklang </option>
<option value="SUP228">SUP228 : Mr. Kasem Orsantinudsakul </option>
<option value="SUP229">SUP229 : Mr. Kriankai Chaiyasit </option>
<option value="SUP230">SUP230 : Mr. Nattachai Naen-Udon </option>
<option value="SUP231">SUP231 : Mr. Nawapat Wonglamsam </option>
<option value="SUP232">SUP232 : Mr. Paiboon Intharawetwilai </option>
<option value="SUP233">SUP233 : Mr. Parames Thinraha </option>
<option value="SUP234">SUP234 : Mr. Peerapol Banjong </option>
<option value="SUP235">SUP235 : Mr. Prachuap Khamprakhon </option>
<option value="SUP236">SUP236 : Mr. Rot-Anon Rojanasirisakul </option>
<option value="SUP237">SUP237 : Mr. Rot-Anon Ronasirisakul </option>
<option value="SUP238">SUP238 : Mr. Sirikorn Yanphan </option>
<option value="SUP239">SUP239 : Mr. Somyut Loeksomphong </option>
<option value="SUP240">SUP240 : Mr. Sorawit Thepjon </option>
<option value="SUP241">SUP241 : Mr. Toesang Sae Lee </option>
<option value="SUP242">SUP242 : Mr. Uthai Thongnuan </option>
<option value="SUP243">SUP243 : Mr. Watthana Malithong </option>
<option value="SUP244">SUP244 : Mr. Weerawat Thanomchai </option>
<option value="SUP245">SUP245 : Mr. Wichai Kasee </option>
<option value="SUP246">SUP246 : Mr. Aitti Limwattananonchai </option>
<option value="SUP247">SUP247 : Mr. Anuson Aingkhai </option>
<option value="SUP248">SUP248 : Mr. Atthaphol Sribanthao </option>
<option value="SUP249">SUP249 : Mr. Chaowarit Ngamwong </option>
<option value="SUP250">SUP250 : Mr. Chayakorn Suriyasai </option>
<option value="SUP251">SUP251 : Mr. Chorkchai Faungwong </option>
<option value="SUP252">SUP252 : Mr. Jirasak Chumlaong </option>
<option value="SUP253">SUP253 : Mr. Karnrawee Kaewmuangklang </option>
<option value="SUP254">SUP254 : Mr. Kriangsak Mingkaew </option>
<option value="SUP255">SUP255 : Mr. Manit Erbsuk </option>
<option value="SUP256">SUP256 : Mr. Nalinee Soaksri </option>
<option value="SUP257">SUP257 : Mr. Pairat Janrood </option>
<option value="SUP258">SUP258 : Mr. Phacharaphon Noiwong </option>
<option value="SUP259">SUP259 : Mr. Phatcharaphon Tubtim </option>
<option value="SUP260">SUP260 : Mr. Pisan Innok </option>
<option value="SUP261">SUP261 : Mr. Poramaet Thinraha </option>
<option value="SUP262">SUP262 : Mr. Pribun Intharawestwilai </option>
<option value="SUP263">SUP263 : Mr. Sawit Saenghin </option>
<option value="SUP264">SUP264 : Mr. Sirisak Saensuk </option>
<option value="SUP265">SUP265 : Mr. Thiraphong Sa-Nguansat </option>
<option value="SUP266">SUP266 : Mr. Vinuch Kleebbus </option>
<option value="SUP267">SUP267 : Mr. Wanchai Sermsirimonkong </option>
<option value="SUP268">SUP268 : Mr. Wang Qiang </option>
<option value="SUP269">SUP269 : Mr. Wei Chen </option>
<option value="SUP270">SUP270 : Mr. Yuranan Thananjai </option>
<option value="SUP271">SUP271 : Mr. Zhou Shengli </option>
<option value="SUP272">SUP272 : Mrs. Tongjit Saeng-Iam </option>
<option value="SUP273">SUP273 : Ms. Pratthana Mingkaew </option>
<option value="SUP274">SUP274 : Ms. Chankhana Sombunma </option>
<option value="SUP275">SUP275 : Ms. Pimonwan Thaweechan </option>
<option value="SUP276">SUP276 : Ms. Thepsuriya Musaka </option>
<option value="SUP277">SUP277 : Ms. Noophan Audomlap </option>
<option value="SUP278">SUP278 : Ms. Patsaya </option>
<option value="SUP279">SUP279 : Ms. Phittiya Charoenchit </option>
<option value="SUP280">SUP280 : Ms. Pimporn Butrach </option>
<option value="SUP281">SUP281 : Ms. Sudarut Sriubon </option>
<option value="SUP282">SUP282 : Multitrack Equipment </option>
<option value="SUP283">SUP283 : Mungchu Grand Hotel </option>
<option value="SUP284">SUP284 : N&N Power </option>
<option value="SUP285">SUP285 : N.K. Best Accounting and Tax </option>
<option value="SUP286">SUP286 : N.T. Diesel Auto Service </option>
<option value="SUP287">SUP287 : Nakornthai Hardware </option>
<option value="SUP288">SUP288 : Natsa Hydraulic Hose Chiang Rai </option>
<option value="SUP289">SUP289 : Natthanit Customs Transport </option>
<option value="SUP290">SUP290 : Nava Siam Steel </option>
<option value="SUP291">SUP291 : Navamin Shop </option>
<option value="SUP292">SUP292 : Navanakhon Hardware </option>
<option value="SUP293">SUP293 : NCL International Logistics Public </option>
<option value="SUP294">SUP294 : Neonic Evolution </option>
<option value="SUP295">SUP295 : Ngao Kon Kan </option>
<option value="SUP296">SUP296 : Nihao Around the World </option>
<option value="SUP297">SUP297 : Nikhom Kan Yang 1999 </option>
<option value="SUP298">SUP298 : Nok Aiang Shop 20 Cheap Products </option>
<option value="SUP299">SUP299 : Nong Kao Hong Construction Materials </option>
<option value="SUP300">SUP300 : NOT Auto Parts </option>
<option value="SUP301">SUP301 : NP Cable </option>
<option value="SUP302">SUP302 : NRT Sales and Service (Head Office) </option>
<option value="SUP303">SUP303 : NV Air Spare Parts </option>
<option value="SUP304">SUP304 : O.C.R. </option>
<option value="SUP305">SUP305 : OA2016 </option>
<option value="SUP306">SUP306 : OfficeMate (Thai) </option>
<option value="SUP307">SUP307 : Olympus Oil </option>
<option value="SUP308">SUP308 : One-Stop Travel Service </option>
<option value="SUP309">SUP309 : Orchid Residence </option>
<option value="SUP310">SUP310 : Ousomyoskanchang </option>
<option value="SUP311">SUP311 : P & E Legal Group </option>
<option value="SUP312">SUP312 : P & W Business Group </option>
<option value="SUP313">SUP313 : P' Noppadol Service </option>
<option value="SUP314">SUP314 : P.S.M. Hardware </option>
<option value="SUP315">SUP315 : P.Y.P Trading and Supplies </option>
<option value="SUP316">SUP316 : PAC Orient </option>
<option value="SUP317">SUP317 : Panuwat Battery </option>
<option value="SUP318">SUP318 : Panyakarnyont </option>
<option value="SUP319">SUP319 : Paper Thai Commercial </option>
<option value="SUP320">SUP320 : Partslink </option>
<option value="SUP321">SUP321 : Pasto (Thailand) </option>
<option value="SUP322">SUP322 : Patong Polytechnic Shop </option>
<option value="SUP323">SUP323 : Pattanajukol Motor </option>
<option value="SUP324">SUP324 : Pattarachai </option>
<option value="SUP325">SUP325 : Peerachai Sai Mai Autoglass </option>
<option value="SUP326">SUP326 : Peppery Hills Hotel </option>
<option value="SUP327">SUP327 : Pharuaykehaphan </option>
<option value="SUP328">SUP328 : Phattharachai Shop </option>
<option value="SUP329">SUP329 : Phithak Kan Yang </option>
<option value="SUP330">SUP330 : Phitsanulok Orchid Hotel </option>
<option value="SUP331">SUP331 : Phuketalai </option>
<option value="SUP332">SUP332 : Piboonbunsab </option>
<option value="SUP333">SUP333 : Pitchaya Path Riches </option>
<option value="SUP334">SUP334 : Pitee Hydraulic </option>
<option value="SUP335">SUP335 : Ple Racing Will </option>
<option value="SUP336">SUP336 : Ploto Sale and Service </option>
<option value="SUP337">SUP337 : PPN Machinery </option>
<option value="SUP338">SUP338 : PPS Steel </option>
<option value="SUP339">SUP339 : Prang Thong Material Trading </option>
<option value="SUP340">SUP340 : Prangthong Material Shop </option>
<option value="SUP341">SUP341 : Praram 2 Wire Rope </option>
<option value="SUP342">SUP342 : Prathana </option>
<option value="SUP343">SUP343 : Prawat Kon Kan </option>
<option value="SUP344">SUP344 : Precha Carpaint </option>
<option value="SUP345">SUP345 : Preecha Auto Tire </option>
<option value="SUP346">SUP346 : Preecha Car Paint </option>
<option value="SUP347">SUP347 : Preecha Hardware </option>
<option value="SUP348">SUP348 : Premsuk Hotel General </option>
<option value="SUP349">SUP349 : Printing and Design </option>
<option value="SUP350">SUP350 : Professional Visa and Travel Service </option>
<option value="SUP351">SUP351 : Progress Republic </option>
<option value="SUP352">SUP352 : Provincial Electricity Authority Amphoe Lam Luk Ka </option>
<option value="SUP353">SUP353 : Prueksa Energy </option>
<option value="SUP354">SUP354 : PSK International Bearing </option>
<option value="SUP355">SUP355 : PSV Group </option>
<option value="SUP356">SUP356 : PTM Equipment </option>
<option value="SUP357">SUP357 : PTT Oil and Retail Business Public </option>
<option value="SUP358">SUP358 : Pueanchang Electric </option>
<option value="SUP359">SUP359 : Rama 2 Wire Rope (Head Office) </option>
<option value="SUP360">SUP360 : Rayong Chang Chia </option>
<option value="SUP361">SUP361 : Resort at Lampang </option>
<option value="SUP362">SUP362 : Rich Home </option>
<option value="SUP363">SUP363 : Rigcon Machinery </option>
<option value="SUP364">SUP364 : Rimnim Hostel Chiangmai </option>
<option value="SUP365">SUP365 : Rommai Green Park 2555 </option>
<option value="SUP366">SUP366 : Rubber Games </option>
<option value="SUP367">SUP367 : Rueanchai Auto Part 2020 </option>
<option value="SUP368">SUP368 : Rung Paisal Kolkarn </option>
<option value="SUP369">SUP369 : Rung Rorong Auto Parts </option>
<option value="SUP370">SUP370 : S R Advanced Industries </option>
<option value="SUP371">SUP371 : S. Charoen Metal Rubber </option>
<option value="SUP372">SUP372 : S. Charoenkij Petroleum </option>
<option value="SUP373">SUP373 : S. Charoenutopart Kabin </option>
<option value="SUP374">SUP374 : S.K. Tools </option>
<option value="SUP375">SUP375 : S.M.N Supplies </option>
<option value="SUP376">SUP376 : S. Phuket Supply </option>
<option value="SUP377">SUP377 : S.S.M.C. </option>
<option value="SUP378">SUP378 : S. Sombat Hydraulic </option>
<option value="SUP379">SUP379 : Sabai Sabai Resort </option>
<option value="SUP380">SUP380 : Saengaree Station </option>
<option value="SUP381">SUP381 : Sahaphan Motor Bike </option>
<option value="SUP382">SUP382 : Saitarn Resort </option>
<option value="SUP383">SUP383 : SanDisk Thailand Official Shop </option>
<option value="SUP384">SUP384 : Sanitchai Karnchang </option>
<option value="SUP385">SUP385 : SANY </option>
<option value="SUP386">SUP386 : Saowalak </option>
<option value="SUP387">SUP387 : Sasicha H </option>
<option value="SUP388">SUP388 : SB Steel Works </option>
<option value="SUP389">SUP389 : SBT Worldside Products </option>
<option value="SUP390">SUP390 : SC Paper-Pach </option>
<option value="SUP391">SUP391 : SEAFCO Public </option>
<option value="SUP392">SUP392 : Seal Center </option>
<option value="SUP393">SUP393 : Seal Track Center </option>
<option value="SUP394">SUP394 : Shaw Ruang Alai </option>
<option value="SUP395">SUP395 : Shopee (Thailand) </option>
<option value="SUP396">SUP396 : Shopee Shop </option>
<option value="SUP397">SUP397 : Siam Auto Part Center </option>
<option value="SUP398">SUP398 : Siam Dragon Part </option>
<option value="SUP399">SUP399 : Siam Global Metal </option>
<option value="SUP400">SUP400 : Siam Premium Plus Interfabric </option>
<option value="SUP401">SUP401 : Siam Victory Intertrade </option>
<option value="SUP402">SUP402 : Siamelectnic-Cooling </option>
<option value="SUP403">SUP403 : Siamxennon </option>
<option value="SUP404">SUP404 : Silpa Thai Electric Import Export </option>
<option value="SUP405">SUP405 : Sinpet Construction Materials </option>
<option value="SUP406">SUP406 : Sirimongkol In Engineering </option>
<option value="SUP407">SUP407 : Siriputtasak </option>
<option value="SUP408">SUP408 : Sitthiya Phasasuk </option>
<option value="SUP409">SUP409 : Sittipol Sales </option>
<option value="SUP410">SUP410 : SK Dinamo Klong 7 </option>
<option value="SUP411">SUP411 : SK Dynamo </option>
<option value="SUP412">SUP412 : SK Insurance Broker </option>
<option value="SUP413">SUP413 : So Charoenkit Pitroliam </option>
<option value="SUP414">SUP414 : Social </option>
<option value="SUP415">SUP415 : Somboon Karnchang </option>
<option value="SUP416">SUP416 : Song Auto Parts Shop </option>
<option value="SUP417">SUP417 : Sor Motor </option>
<option value="SUP418">SUP418 : Southeast </option>
<option value="SUP419">SUP419 : Southeast Life Insurance Public </option>
<option value="SUP420">SUP420 : Space 83 </option>
<option value="SUP421">SUP421 : SPP Progreat </option>
<option value="SUP422">SUP422 : Srikrung Broker </option>
<option value="SUP423">SUP423 : Sri-Lert-Lar </option>
<option value="SUP424">SUP424 : Sripochang Auto </option>
<option value="SUP425">SUP425 : SS Spare Part </option>
<option value="SUP426">SUP426 : Star Link Solutions </option>
<option value="SUP427">SUP427 : Student Loan Fund </option>
<option value="SUP428">SUP428 : Sudarut </option>
<option value="SUP429">SUP429 : Sunthornwanit 2003 </option>
<option value="SUP430">SUP430 : Supattra Sand </option>
<option value="SUP431">SUP431 : Supawat Hardware </option>
<option value="SUP432">SUP432 : Sutee Laowarakul </option>
<option value="SUP433">SUP433 : Suvarnabhumi Autotech </option>
<option value="SUP434">SUP434 : T C L Electronics (Thailand) </option>
<option value="SUP435">SUP435 : T Power Hydraulic </option>
<option value="SUP436">SUP436 : T. Siriyon </option>
<option value="SUP437">SUP437 : T.C. Radio and Communication </option>
<option value="SUP438">SUP438 : T. Siriyont </option>
<option value="SUP439">SUP439 : T. Thepthat Construction </option>
<option value="SUP440">SUP440 : T. Thongthai Tractor </option>
<option value="SUP441">SUP441 : Tanachot Tractor </option>
<option value="SUP442">SUP442 : Tareanchai Lohakit (Mr. Songsak Phitakchaikul) </option>
<option value="SUP443">SUP443 : TCM Enterprises </option>
<option value="SUP444">SUP444 : Teambase </option>
<option value="SUP445">SUP445 : Teerapat Trade </option>
<option value="SUP446">SUP446 : Teerapong Sanguansat </option>
<option value="SUP447">SUP447 : Thai Airways International Public </option>
<option value="SUP448">SUP448 : Thai Car Air </option>
<option value="SUP449">SUP449 : Thai Dee Construction Materials Trading </option>
<option value="SUP450">SUP450 : Thai Industrial Brake </option>
<option value="SUP451">SUP451 : Thai Mesh </option>
<option value="SUP452">SUP452 : Thai Pattana PE Pipes </option>
<option value="SUP453">SUP453 : Thai R SO (Lazada Shop) </option>
<option value="SUP454">SUP454 : Thai Sinrui </option>
<option value="SUP455">SUP455 : Thai State Infrastructure </option>
<option value="SUP456">SUP456 : ThaiWeldingStore </option>
<option value="SUP457">SUP457 : Thalan Hydraulic </option>
<option value="SUP458">SUP458 : Thamthaweechoke </option>
<option value="SUP459">SUP459 : Thap Yang </option>
<option value="SUP460">SUP460 : Thavorn Inter Corporation </option>
<option value="SUP461">SUP461 : Thawit Law Office </option>
<option value="SUP462">SUP462 : Thawit Lawthong </option>
<option value="SUP463">SUP463 : The Artel Nimman </option>
<option value="SUP464">SUP464 : The Bed Hotel </option>
<option value="SUP465">SUP465 : The Corner </option>
<option value="SUP466">SUP466 : The Elle Thai Trade </option>
<option value="SUP467">SUP467 : The Mall Group </option>
<option value="SUP468">SUP468 : The Metal Import </option>
<option value="SUP469">SUP469 : The Rooms Residence </option>
<option value="SUP470">SUP470 : The Target Resident & Resort </option>
<option value="SUP471">SUP471 : The Whitespace </option>
<option value="SUP472">SUP472 : Thing Net </option>
<option value="SUP473">SUP473 : Thinsuk Resort </option>
<option value="SUP474">SUP474 : Thiraphong </option>
<option value="SUP475">SUP475 : Thitaree 2014 </option>
<option value="SUP476">SUP476 : ThunElectric Online </option>
<option value="SUP477">SUP477 : Time Access Solution </option>
<option value="SUP478">SUP478 : TKC Prime Tyres </option>
<option value="SUP479">SUP479 : TL Grand Plus </option>
<option value="SUP480">SUP480 : TM Captain Transport </option>
<option value="SUP481">SUP481 : Tokio Marine Safety Insurance (Thailand) </option>
<option value="SUP482">SUP482 : Tool Profession </option>
<option value="SUP483">SUP483 : Top Hitech Engineering </option>
<option value="SUP484">SUP484 : Top Marketing System </option>
<option value="SUP485">SUP485 : Toyota Eknimit Thai </option>
<option value="SUP486">SUP486 : Toyota Insurance Broker </option>
<option value="SUP487">SUP487 : Toyota Suvarnabhumi (Theparak) </option>
<option value="SUP488">SUP488 : TP Tent </option>
<option value="SUP489">SUP489 : Trio Hut </option>
<option value="SUP490">SUP490 : Trip.com Travel Singapore </option>
<option value="SUP491">SUP491 : TYSIM Machinery </option>
<option value="SUP492">SUP492 : Udomsap Khehaphan Shop </option>
<option value="SUP493">SUP493 : Unique Tunnelling </option>
<option value="SUP494">SUP494 : Union K K </option>
<option value="SUP495">SUP495 : Unithai Trip </option>
<option value="SUP496">SUP496 : UOB Bank Thailand </option>
<option value="SUP497">SUP497 : UPD Guarantee </option>
<option value="SUP498">SUP498 : V. P. S. Equipment </option>
<option value="SUP499">SUP499 : Veera Steel Import </option>
<option value="SUP500">SUP500 : Veerasiam Group </option>
<option value="SUP501">SUP501 : VIPA Trade Steel </option>
<option value="SUP502">SUP502 : VN-Softsling (Thailand) </option>
<option value="SUP503">SUP503 : Vor Supaporn Machinery </option>
<option value="SUP504">SUP504 : VR Great Machinery </option>
<option value="SUP505">SUP505 : W Tech Rig Corporation </option>
<option value="SUP506">SUP506 : Wabi Sabi Shop and Service </option>
<option value="SUP507">SUP507 : Wanchai Tools </option>
<option value="SUP508">SUP508 : Wandee Marketing </option>
<option value="SUP509">SUP509 : Wangjumpa Machine </option>
<option value="SUP510">SUP510 : Wasin Trading </option>
<option value="SUP511">SUP511 : We Plus Group (Thailand) </option>
<option value="SUP512">SUP512 : Weichai Parts and Sales (Thailand) </option>
<option value="SUP513">SUP513 : Wichai Bo Yon </option>
<option value="SUP514">SUP514 : Wongpaiboon Mechanical Engineering </option>
<option value="SUP515">SUP515 : Wongphaiboon Kolakarn </option>
<option value="SUP516">SUP516 : World Medical Alliance (Thailand) </option>
<option value="SUP517">SUP517 : XCMG (Thailand) </option>
<option value="SUP518">SUP518 : Xuzhou Selected Construction Machinery </option>
<option value="SUP519">SUP519 : Xuzhou Star Geotechnical Construction Machinery </option>
<option value="SUP520">SUP520 : Xuzhou Taicheng Construction Machinery </option>
<option value="SUP521">SUP521 : YPN Battery </option>
<option value="SUP522">SUP522 : Zhang Feng (Seven) </option>
<option value="SUP523">SUP523 : Zhang Jie (JAX) </option>
<option value="SUP524">SUP524 : Xuzhou Construction Machinery Group Import and Export </option>
              </select>

              <!-- KEEP FOR (DO NOT DELETE): hidden only on PR via CSS -->
              <div class="mfForLegacy">
                <label>${biLabel("FOR", "สำหรับ")}</label>
                <div class="for-list">
                  <label class="chk"><input type="checkbox" name="forStock" value="Stock" /> Stock</label>
                  <div class="for-line">
                    <label class="chk"><input type="checkbox" id="forRepairChk" name="forRepair" value="Repair" /> Repair</label>
                    <input class="input" id="forRepairTxt" name="forRepairTxt" placeholder="For Sale / For Customer" disabled />
                  </div>
                  <div class="for-line">
                    <label class="chk"><input type="checkbox" id="forSaleChk" name="forSale" value="Sale" /> Sale</label>
                    <input class="input" id="forSaleTxt" name="forSaleTxt" placeholder="Name Customer" disabled />
                  </div>
                </div>
              </div>
            </div>

            <div class="field">
              <label>${biLabel("Note", "หมายเหตุเพิ่มเติม")}</label>
              <textarea name="note"></textarea>
            </div>
          </div>

            

          <div class="warnBox" title="**Please add product spec detail, picture and show export rate**">**Please add product spec detail, picture and show export rate**</div>
</div>
            <div class="mfCol right" id="mfS2">

            <div class="hr"></div>
<div id="items"></div>

          <div class="row btnRow3">
            <button class="btn btn-ghost" type="button" id="btnPreview">Preview</button>
            <button class="btn btn-primary" type="submit" id="btnSubmit">Submit</button>
            <button class="btn btn-ghost" type="button" id="btnCancel">Cancel</button>
          </div>

          <!-- Submit confirm modal -->
          <div class="mfModal" id="submitModal" aria-hidden="true">
            <div class="mfModal__backdrop" data-close="1"></div>
            <div class="mfModal__panel" role="dialog" aria-modal="true" aria-labelledby="mfModalTitle">
              <div class="mfModal__title" id="mfModalTitle">PREVIEW</div>
              <div class="mfModal__body">กรุณาตรวจสอบความถูกต้องของข้อมูลก่อนกดส่ง</div>
              <div class="mfModal__actions">
                <button class="btn btn-primary" type="button" id="btnConfirmSubmit">Confirm</button>
                <button class="btn btn-ghost" type="button" id="btnCancelSubmit">Cancel</button>
              </div>
            </div>
          </div>

          <div id="submitNote" class="pill submit-note">หลัง Submit: ระบบจะสร้าง QR + ไฟล์ PDF/Excel (ของจริง) และเก็บลง Drive อัตโนมัติ</div>
          <!-- Preview modal (FlowAccount style) -->
          <div class="mfModal" id="previewModal" aria-hidden="true">
            <div class="mfModal__backdrop" data-close="1"></div>
            <div class="mfModal__panel" role="dialog" aria-modal="true" aria-labelledby="mfPreviewTitle">
              <div class="row" style="justify-content:space-between; align-items:center; gap:12px;">
                <div class="mfModal__title" id="mfPreviewTitle" style="margin:0">Preview</div>
                <div class="row tight" style="gap:8px; justify-content:flex-end;">
                  <button class="btn btn-ghost" type="button" id="btnPrintPreview">Print</button>
                  <button class="btn btn-ghost" type="button" id="btnClosePreview" data-close="1">Close</button>
                </div>
              </div>
              <div class="hr"></div>
              <div id="previewBody" class="subtext">กรอกข้อมูลแล้วกด Preview</div>
            </div>
          </div>

          <datalist id="unitList">
            <option value="Trip"></option>
            <option value="Unit"></option>
            <option value="Kg."></option>
            <option value="Km."></option>
            <option value="Box"></option>
            <option value="Set"></option>
            <option value="Pcs."></option>
            <option value="Hr."></option>
            <option value="Mth."></option>
            <option value="Sqm."></option>
            <option value="Year"></option>
            <option value="Pack"></option>
            <option value="Metr"></option>
            <option value="Doz."></option>
          </datalist>
            </div>
          </div>

</form>
    </div>
  `;

  // PR only: make select placeholder text grey when value is empty
  const $prForm = el.querySelector('#frmCreate.isPR');
  if($prForm){
    $prForm.querySelectorAll('select.input').forEach(sel=>{
      const sync = ()=> sel.classList.toggle('is-placeholder', !sel.value);
      sync();
      sel.addEventListener('change', sync);
    });
  }


  // ===== PR: editable dropdown lists (Model / Customer / Supplier later) =====
  function mfListGet(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : null;
      if(Array.isArray(arr)) return arr;
    }catch(e){}
    return fallback || [];
  }
  function mfListSet(key, arr){
    localStorage.setItem(key, JSON.stringify(arr || []));
  }
  function mfSyncSelectPlaceholder(sel){
    if(!sel) return;
    sel.classList.toggle('is-placeholder', !sel.value);
  }
  function mfFillSelect(sel, key, defaults){
    const cur = sel.value;
    const items = mfListGet(key, defaults);
    const first = sel.querySelector("option[value='']");
    sel.innerHTML = "";
    if(first) sel.appendChild(first);
    items.forEach(v=>{
      const o=document.createElement("option");
      o.value=v; o.textContent=v;
      sel.appendChild(o);
    });
    if(cur) sel.value = cur;
    mfSyncSelectPlaceholder(sel);
  }
  function mfAddToList(key, defaults){
    const v = prompt("เพิ่มรายการใหม่:");
    if(!v) return;
    const val = v.trim();
    if(!val) return;
    const items = mfListGet(key, defaults);
    if(items.includes(val)) return;
    items.push(val);
    mfListSet(key, items);
  }
  function mfRemoveFromList(key){
    const items = mfListGet(key, []);
    if(!items.length){ alert("No items to remove."); return; }
    const v = prompt("พิมพ์ค่าที่จะลบ:\n\n" + items.join("\n"));
    if(!v) return;
    const val = v.trim();
    const idx = items.indexOf(val);
    if(idx === -1){ alert("Not found: " + val); return; }
    if(!confirm('Remove "'+val+'"?')) return;
    items.splice(idx,1);
    mfListSet(key, items);
  }

  // PR only: init editable select lists + +/- buttons
  if($prForm){
    const defaultsModels = ["XR280E","XR320E"];
    const defaultsCustomers = [];

    $prForm.querySelectorAll('select[data-listkey]').forEach(sel=>{
      const key = sel.getAttribute('data-listkey');
      if(key === 'mf_pr_models') mfFillSelect(sel, key, defaultsModels);
      if(key === 'mf_pr_customers') mfFillSelect(sel, key, defaultsCustomers);
      sel.addEventListener('change', ()=>mfSyncSelectPlaceholder(sel));
    });

    $prForm.querySelectorAll('.mfMiniBtn[data-add]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const key = btn.getAttribute('data-add');
        if(key === 'mf_pr_models') mfAddToList(key, defaultsModels);
        if(key === 'mf_pr_customers') mfAddToList(key, defaultsCustomers);
        $prForm.querySelectorAll("select[data-listkey='"+key+"']").forEach(sel=>{
          if(key === 'mf_pr_models') mfFillSelect(sel, key, defaultsModels);
          else mfFillSelect(sel, key, defaultsCustomers);
        });
      });
    });
    $prForm.querySelectorAll('.mfMiniBtn[data-del]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const key = btn.getAttribute('data-del');
        mfRemoveFromList(key);
        $prForm.querySelectorAll("select[data-listkey='"+key+"']").forEach(sel=>{
          if(key === 'mf_pr_models') mfFillSelect(sel, key, defaultsModels);
          else mfFillSelect(sel, key, defaultsCustomers);
        });
      });
    });
  }

  // Layout A: remove redundant "Items" title (if present) at top of right column
  try{
    const s2 = document.querySelector("#mfS2");
    const titleH2 = s2 && s2.querySelector(".section-title h2");
    if(titleH2 && titleH2.textContent.trim() === "Items"){
      const wrap = titleH2.closest(".section-title");
      if(wrap) wrap.remove();
    }
  }catch(e){}


  
  // v9: keep NOTE textarea bottom aligned with FOR block
  setTimeout(()=>{ requestAnimationFrame(()=>{ balanceForNoteRow(); }); }, 0);
  window.addEventListener('resize', balanceForNoteRow);
  // Custom unit options (free, no backend)
  const MF_UNITS_KEY = "mf_units_custom_v1";
  const getCustomUnits = () => {
    try { return JSON.parse(localStorage.getItem(MF_UNITS_KEY) || "[]"); } catch(e){ return []; }
  };
  const saveCustomUnits = (arr) => localStorage.setItem(MF_UNITS_KEY, JSON.stringify(arr));
  const ensureUnitList = () => {
    const dl = document.getElementById("unitList");
    if(!dl) return;
    const existing = new Set(Array.from(dl.querySelectorAll("option")).map(o => (o.value||"").trim()).filter(Boolean));
    const custom = getCustomUnits();
    custom.forEach(u => {
      const v = String(u||"").trim();
      if(!v || existing.has(v)) return;
      const opt = document.createElement("option");
      opt.value = v;
      dl.appendChild(opt);
      existing.add(v);
    });
  };
  ensureUnitList();

const itemsEl = $("#items");
  const addItem = ()=>{
    const idx = itemsEl.children.length + 1;
    const block = document.createElement("div");
    block.className = "card";
    block.style.boxShadow = "none";
    block.style.marginBottom = "10px";
    block.innerHTML = `
      <div class="section-title">
        <h3 style="margin:0">Item #${idx}</h3>
</div>
      <div class="row">
        <div class="field">
          <label>${biLabel("Name", "ชื่อสินค้า/อะไหล่ (จำเป็น)")}</label>
          <input class="input" name="item_name" placeholder="ชื่ออะไหล่/สินค้า" required />
        </div>
        <div class="field">
          <label>${biLabel("Model", "รุ่น")}</label>
          <input class="input" name="item_model" placeholder="XR280E / XR320E ..." />
        </div>
      </div>
      <div class="row row-codeqty">
        <div class="field">
          <label>${biLabel("Code", "รหัสสินค้า")}</label>
          <input class="input" name="item_code" placeholder="ถ้ามี" />
        </div>
        <div class="field">
          <label>${biLabel("QTY", "จำนวน (จำเป็น)")}</label>
          <input class="input" name="qty" type="number" min="0" step="0.01" value="1" required />
        </div>
        <div class="field">
          <label>${biLabel("Unit", "หน่วย (จำเป็น)")}</label>
          <div class="inputPlus">
            <input class="input" name="unit" list="unitList" style="flex:1" />
            <button type="button" class="miniBtn" data-add-unit title="Add unit" aria-label="Add unit">+</button>
          </div>
        </div>
      </div>

      <div class="field">
        <label>${biLabel("Detail", "รายละเอียด/สเปก")}</label>
        <textarea class="input" name="detail" rows="2" placeholder="Spec/Detail e.g. Original/OEM, size, length..." style="min-height:56px; resize:vertical;"></textarea>
      </div>
      <div class="row row-export-attach row-attach-only">
  <div class="field">
    <label>${biLabel("Attach photos", "แนบรูปต่อรายการ")}</label>
    <input class="input" name="photos" type="file" accept="image/*" multiple />
    <div class="subtext" data-ph-list></div>

    <div class="itemControls">
      <button class="btn btn-danger btn-small" type="button" data-action="delItem">ลบ</button>
      <button class="btn btn-ghost" type="button" data-action="addItem">+ เพิ่มรายการ</button>
    </div>


  </div>
</div>
      </div>
    `;
    const _rm = block.querySelector("[data-remove]");
    if(_rm) _rm.onclick = ()=>{
      block.remove();
      renumberItems();
    };
    const fileInput = block.querySelector('input[name="photos"]');
    const phList = block.querySelector("[data-ph-list]");
    fileInput.onchange = ()=>{
      const names = Array.from(fileInput.files||[]).map(f=>f.name);
      phList.textContent = names.length ? "แนบแล้ว: " + names.join(", ") : "";
    };
    // "+" add unit (append to datalist + persist in localStorage)
    const addUnitBtn = block.querySelector('[data-add-unit]');
    if(addUnitBtn){
      addUnitBtn.addEventListener("click", () => {
        const v = prompt("Add new unit", "");
        const unit = (v || "").trim();
        if(!unit) return;
        const custom = getCustomUnits();
        if(!custom.includes(unit)) { custom.push(unit); saveCustomUnits(custom); }
        ensureUnitList();
        const unitInput = block.querySelector('[name="unit"]');
        if(unitInput) unitInput.value = unit;
      });
    }

    itemsEl.appendChild(block);
  };

  const renumberItems = ()=>{
    Array.from(itemsEl.children).forEach((c, i)=>{
      const h3 = c.querySelector("h3");
      if(h3) h3.textContent = `Item #${i+1}`;
    });
  };
  // Item controls (Add / Delete) - delegated (stable even after re-render)
  const syncItemControls = ()=>{
    const cards = $$("#items > .card");
    cards.forEach((c, i)=>{
      const controls = c.querySelector(".itemControls");
      if(!controls) return;
      controls.style.display = (i === cards.length-1) ? "flex" : "none";
    });
  };

  itemsEl.addEventListener("click", (e)=>{
    const btn = e.target.closest('button[data-action]');
    if(!btn) return;

    const action = btn.getAttribute("data-action");
    if(action === "addItem"){
      addItem();
      renumberItems();
      syncItemControls();
      return;
    }
    if(action === "delItem"){
      const cards = $$("#items > .card");
      if(cards.length <= 1) return;
      cards[cards.length-1].remove();
      renumberItems();
      syncItemControls();
      return;
    }
  });


// FOR: enable detail inputs only when checked
  const repairChk = $("#forRepairChk");
  const saleChk = $("#forSaleChk");
  const repairTxt = $("#forRepairTxt");
  const saleTxt = $("#forSaleTxt");
  const syncFor = () => {
    if(repairChk && repairTxt){
      repairTxt.disabled = !repairChk.checked;
      repairTxt.required = !!repairChk.checked;
      if(!repairChk.checked) repairTxt.value = "";
    }
    if(saleChk && saleTxt){
      saleTxt.disabled = !saleChk.checked;
      saleTxt.required = !!saleChk.checked;
      if(!saleChk.checked) saleTxt.value = "";
    }
  };
  if(repairChk) repairChk.addEventListener("change", syncFor);
  if(saleChk) saleChk.addEventListener("change", syncFor);
  syncFor();

  $("#btnCancel").onclick = ()=> location.hash = "#/home";

  addItem();
  renumberItems();
  syncItemControls();


  // v24: Preview + submit confirm flow
  const submitModal = $("#submitModal");
  const openSubmitModal = ()=>{
    if(!submitModal) return true;
    submitModal.classList.add("is-open");
    submitModal.setAttribute("aria-hidden","false");
    return false;
  };
  const closeSubmitModal = ()=>{
    if(!submitModal) return;
    submitModal.classList.remove("is-open");
    submitModal.setAttribute("aria-hidden","true");
  };

  // build preview as "real document" inside modal (FlowAccount-ish, no required enforcement)
  const renderPreviewFromData = (data)=>{
    const __pvTarget = $("#previewBody") || $("#preview");
    if(!__pvTarget) return;

    // Inject preview-doc CSS once (scoped to .mfPreviewDoc*)
    (function injectPreviewDocCSS(){
      if(document.querySelector('style[data-mintflow="preview-doc"]')) return;
      const css = `
        .mfPreviewDocPaper{
          width: 794px; max-width: 100%;
          margin: 0 auto;
          background:#fff;
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 14px;
          padding: 18px 18px 16px;
          box-shadow: 0 10px 28px rgba(0,0,0,.10);
          color:#111;
        }
        .mfPreviewDocHeader{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:10px;}
        .mfPreviewDocTitle{font-weight:900;letter-spacing:.3px;font-size:18px;line-height:1.1;margin:0;}
        .mfPreviewDocMeta{font-size:12px;color:rgba(0,0,0,.62);line-height:1.3;}
        .mfPreviewDocGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;}
        .mfPreviewDocBlock{padding:10px 12px;border:1px solid rgba(0,0,0,.08);border-radius:12px;}
        .mfPreviewDocBlock h3{margin:0 0 8px;font-size:12px;letter-spacing:.2px;color:rgba(0,0,0,.55);}
        .mfPreviewDocLine{display:flex;gap:8px;line-height:1.25;margin:6px 0;font-size:13px;}
        .mfPreviewDocLine b{min-width:92px;display:inline-block;color:rgba(0,0,0,.72);}
        .mfPreviewDocNote{white-space:pre-wrap;}
        .mfPreviewDocTable{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px;}
        .mfPreviewDocTable th,.mfPreviewDocTable td{border:1px solid rgba(0,0,0,.10);padding:6px 7px;vertical-align:top;}
        .mfPreviewDocTable th{background:rgba(0,0,0,.035);text-align:left;font-weight:800;color:rgba(0,0,0,.72);}
        .mfPreviewDocFooter{margin-top:10px;font-size:12px;color:rgba(0,0,0,.55);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;}
        .mfPreviewDocPill{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border:1px dashed rgba(255,153,102,.55);background:rgba(255,153,102,.08);border-radius:999px;font-weight:800;color:#c23b22;}
        @media (max-width: 980px){
          .mfPreviewDocGrid{grid-template-columns:1fr;}
        }
        @media print{
          body *{visibility:hidden !important;}
          #previewModal, #previewModal *{visibility:visible !important;}
          #previewModal{position:static !important; inset:auto !important;}
          #previewModal .mfModal__backdrop{display:none !important;}
          #previewModal .mfModal__panel{position:static !important; left:auto !important; top:auto !important; transform:none !important; box-shadow:none !important; width:100% !important; padding:0 !important;}
          #previewModal .row, #previewModal .hr{display:none !important;} /* hide modal chrome */
          .mfPreviewDocPaper{border:none !important; box-shadow:none !important; padding:0 !important;}
        }
      `;
      const style = document.createElement("style");
      style.setAttribute("data-mintflow","preview-doc");
      style.textContent = css;
      document.head.appendChild(style);
    })();

    const val = (v)=> (v==null || String(v).trim()==="" ? "" : String(v));
    const line = (k,v)=> v ? `<div class="mfPreviewDocLine"><b>${escapeHtml(k)}</b><div>${escapeHtml(v)}</div></div>` : "";
    const noteLine = (k,v)=> v ? `<div class="mfPreviewDocLine"><b>${escapeHtml(k)}</b><div class="mfPreviewDocNote">${escapeHtml(v)}</div></div>` : "";

    const docDate = val(data.docDate);
    const urgency = val(data.urgency);
    const project = val(data.project);
    const requester = val(data.requester);
    const phone = val(data.phone);
    const forMode = val(data.forMode || data.for); // tolerate legacy key
    const note = val(data.note);
    const exportBy = Array.isArray(data.exportBy) ? data.exportBy.filter(Boolean) : (val(data.exportBy) ? [val(data.exportBy)] : []);
    const attachCount = data.attachCount != null ? String(data.attachCount) : "";

    const items = Array.isArray(data.items) ? data.items : [];
    const itemsRows = items.map((it, i)=>{
      const c = (x)=> escapeHtml(val(x));
      return `
        <tr>
          <td style="width:34px">${i+1}</td>
          <td>${c(it.name)}</td>
          <td>${c(it.model)}</td>
          <td>${c(it.code)}</td>
          <td style="width:70px">${c(it.qty)}</td>
          <td style="width:80px">${c(it.unit)}</td>
          <td>${c(it.detail)}</td>
        </tr>
      `;
    }).join("");

    __pvTarget.innerHTML = `
      <div class="mfPreviewDocPaper" id="mfPreviewDocPaper">
        <div class="mfPreviewDocHeader">
          <div>
            <div class="mfPreviewDocTitle">Quotation Request</div>
            <div class="mfPreviewDocMeta">Preview only (ยังไม่ส่งจริง)</div>
          </div>
          <div class="mfPreviewDocMeta" style="text-align:right">
            ${docDate ? `Doc Date: ${escapeHtml(docDate)}<br>` : ``}
            ${urgency ? `Urgency: ${escapeHtml(urgency)}<br>` : ``}
            ${data.docNo ? `Doc No: ${escapeHtml(data.docNo)}<br>` : ``}
          </div>
        </div>

        <div class="mfPreviewDocGrid">
          <div class="mfPreviewDocBlock">
            <h3>Section 1</h3>
            ${line("Project", project)}
            ${line("Requester", requester)}
            ${line("Claim", phone)}
            ${line("FOR", forMode)}
            ${noteLine("Note", note)}
          </div>

          <div class="mfPreviewDocBlock">
            <h3>Section 2</h3>
            ${exportBy.length ? `<div class="mfPreviewDocLine"><b>Export By</b><div>${escapeHtml(exportBy.join(", "))}</div></div>` : ``}
            ${attachCount ? line("Attach", attachCount) : ``}
            <div class="mfPreviewDocLine"><b>Items</b><div>${items.length} รายการ</div></div>
            <div class="mfPreviewDocPill" style="margin-top:10px;">ตรวจสอบก่อน Submit</div>
          </div>
        </div>

        ${items.length ? `
          <table class="mfPreviewDocTable" aria-label="Items table">
            <thead>
              <tr>
                <th style="width:34px">#</th>
                <th>Name</th>
                <th>Model</th>
                <th>Code</th>
                <th style="width:70px">QTY</th>
                <th style="width:80px">Unit</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
          </table>
        ` : `<div class="mfPreviewDocFooter"><div>ยังไม่มีรายการ Items</div></div>`}

        <div class="mfPreviewDocFooter">
          <div>${requester ? `Prepared by: ${escapeHtml(requester)}` : ``}</div>
          <div>${nowISO ? `Generated: ${escapeHtml(nowISO().slice(0,19).replace("T"," "))}` : ``}</div>
        </div>
      </div>
    `;

    $("#previewModal")?.classList.add("is-open");
  };

  const collectQRFromForm = ({strict=true}={}) => {
    const form = $("#frmCreate");
    if(!form) throw new Error("Form not ready");

    const getFormVal = (name)=>{
      const el = form.elements ? form.elements[name] : null;
      return (el && typeof el.value === "string") ? el.value : (el && el.value != null ? String(el.value) : "");
    };
    const getTrim = (name)=> (getFormVal(name) || "").trim();

    const requester = getTrim("requester");
    const phone = getTrim("phone");

    const itemsBlocks = itemsEl ? Array.from(itemsEl.children) : [];
    const items = itemsBlocks.map((blk, idx)=>{
      const q = (sel)=> blk ? blk.querySelector(sel) : null;
      const v = (sel)=> {
        const el = q(sel);
        return el && el.value != null ? String(el.value) : "";
      };
      const t = (sel)=> (v(sel) || "").trim();

      const name = t('input[name="item_name"]');
      const model = t('input[name="item_model"]');
      const code = t('input[name="item_code"]');

      const qtyRaw = v('input[name="qty"]');
      const qty = Number(qtyRaw || 0);

      // unit can be select or input; always query by [name="unit"]
      const unit = (t('[name="unit"]') || "");

      const detailEl = q('textarea[name="detail"], input[name="detail"]');
      const detail = (detailEl && detailEl.value != null ? String(detailEl.value) : "").trim();

      const sea = !!q('input[name="exportSea"]')?.checked;
      const land = !!q('input[name="exportLand"]')?.checked;
      const air = !!q('input[name="exportAir"]')?.checked;

      const exportParts = [];
      if(sea) exportParts.push("By Sea");
      if(land) exportParts.push("By Land");
      if(air) exportParts.push("By Air");

      const remarkInput = q('input[name="remark"]');
      const remark = exportParts.length ? exportParts.join(" / ") : ((remarkInput && remarkInput.value != null ? String(remarkInput.value) : "").trim());

      const photosInput = q('input[name="photos"]');
      const photos = photosInput && photosInput.files ? Array.from(photosInput.files).map(f=>f.name) : [];

      return { lineNo: idx+1, code, name, model, qty, unit, detail, remark, photos, exportBy: exportParts };
    });

    const forListEl = $("#forList");
    const forBy = forListEl ? Array.from(forListEl.querySelectorAll('input[type="checkbox"]:checked')).map(x=>x.value) : [];

    return {
      docDate: getFormVal("docDate"),
      urgency: getFormVal("urgency"),
      project: getTrim("project"),
      subject: getTrim("subject"),
      requester, phone,
      forBy,
      note: getTrim("note"),
      items
    };
  };


  // Helpers: treat a completely blank form as "no preview"
  // We consider "blank" = user hasn't typed anything meaningful.
  // Default values like docDate, urgency, qty=1, unit default don't count as meaningful.
  const isAllEmptyQR = (d)=>{
    if(!d) return true;

    const anyTop = !!((d.project||"").trim() || (d.subject||"").trim() || (d.requester||"").trim() || (d.phone||"").trim() || (d.note||"").trim());
    const anyFor = Array.isArray(d.forBy) && d.forBy.length>0;

    const anyItems = Array.isArray(d.items) && d.items.some(it=>{
      const hasText = !!((it.name||"").trim() || (it.model||"").trim() || (it.code||"").trim() || (it.detail||"").trim());
      const hasRemark = !!((it.remark||"").trim());
      const hasPhotos = Array.isArray(it.photos) && it.photos.length>0;
      const hasExport = Array.isArray(it.exportBy) && it.exportBy.length>0;
      // qty/unit alone doesn't count
      return hasText || hasRemark || hasPhotos || hasExport;
    });

    return !(anyTop || anyFor || anyItems);
  };



  // Wire Preview button
  const btnPreview = $("#btnPreview");
  if(btnPreview){
    btnPreview.onclick = ()=>{
      try{
        const data = collectQRFromForm({strict:false});
        if(isAllEmptyQR(data)){
          toast("กรุณากรอกข้อมูลก่อนพรีวิว");
          // try focus requester field if exists
          const f = $("#frmCreate");
          if(f && f.requester) f.requester.focus();
          return;
        }
        renderPreviewFromData(data);
        toast("เปิดพรีวิวแล้ว");
      }catch(err){
        toast(err?.message || "Preview error");
      }
    };
  }

  // Modal wiring
  if(submitModal){
    submitModal.addEventListener("click", (ev)=>{
      const t = ev.target;
      if(t && t.getAttribute && t.getAttribute("data-close")==="1"){ closeSubmitModal(); }
    });
  }

  const previewModal = $("#previewModal");
  const closePreviewModal = ()=> previewModal?.classList.remove("is-open");
  if(previewModal){
    previewModal.addEventListener("click",(ev)=>{
      const t = ev.target;
      if(t && t.getAttribute && t.getAttribute("data-close")==="1"){ closePreviewModal(); }
    });
  }
  const btnClosePreview = $("#btnClosePreview");
  if(btnClosePreview) btnClosePreview.onclick = ()=> closePreviewModal();


  const btnPrintPreview = $("#btnPrintPreview");
  if(btnPrintPreview){
    btnPrintPreview.onclick = ()=>{
      try{
        // print the preview document only
        $("#previewModal")?.classList.add("is-open");
        window.print();
      }catch(e){
        toast("Print error");
      }
    };
  }


  const btnCancelSubmit = $("#btnCancelSubmit");
  if(btnCancelSubmit) btnCancelSubmit.onclick = ()=> closeSubmitModal();

  $("#frmCreate").onsubmit = (e)=>{
    e.preventDefault();
    // show Preview reminder before submit
    openSubmitModal();
  };

  // Confirm submit -> run the original submit logic
  const btnConfirmSubmit = $("#btnConfirmSubmit");
  if(btnConfirmSubmit){
    btnConfirmSubmit.onclick = ()=>{
      closeSubmitModal();
      const form = $("#frmCreate");
          const requester = form.requester.value.trim();
          const phone = form.phone.value.trim();
          if(!requester){
            toast("ต้องกรอก Requester ก่อนส่ง");
            return;
          }

          const itemBlocks = Array.from(itemsEl.children);
          if(!itemBlocks.length){
            toast("ต้องมีอย่างน้อย 1 รายการ");
            return;
          }

          const items = itemBlocks.map((blk, idx)=>{
            const name = blk.querySelector('input[name="item_name"]').value.trim();
            const model = blk.querySelector('input[name="item_model"]').value.trim();
            const code = blk.querySelector('input[name="item_code"]').value.trim();
            const qty = Number(blk.querySelector('input[name="qty"]').value || 0);
            const unit = blk.querySelector('[name="unit"]').value.trim();
            const detailEl = blk.querySelector('textarea[name="detail"], input[name="detail"]');
            const detail = (detailEl ? detailEl.value : "").trim();

            // Export By (checkboxes) -> store into remark (backward compatible)
            const sea = !!blk.querySelector('input[name="exportSea"]')?.checked;
            const land = !!blk.querySelector('input[name="exportLand"]')?.checked;
            const air = !!blk.querySelector('input[name="exportAir"]')?.checked;
            const exportParts = [];
            if(sea) exportParts.push("By Sea");
            if(land) exportParts.push("By Land");
            if(air) exportParts.push("By Air");

            const remarkInput = blk.querySelector('input[name="remark"]');
            const remark = exportParts.length ? exportParts.join(" / ") : ((remarkInput ? remarkInput.value : "").trim());
            const photos = Array.from(blk.querySelector('input[name="photos"]').files || []).map(f=>f.name);

            if(!name || !(qty > 0)){
              throw new Error(`รายการที่ ${idx+1} ต้องมี Name และ QTY>0`);
            }
            return { lineNo: idx+1, code, name, model, qty, unit, detail, remark, photos };
          });

          try{
            items.forEach((it, i)=>{
              if(!it.name || !(it.qty>0) || !it.unit) throw new Error(`รายการที่ ${i+1} ไม่ครบ`);
            });
          }catch(err){
            toast(err.message);
            return;
          }

          const docDate = form.docDate.value;
          const docNo = newDocNo("QR", docDate);
          const db = loadDB();
          db.qr = db.qr || [];

          const reqObj = {
            kind: "QR",
            id: nanoid(12),
            docNo,
            docDate,
            project: form.project.value.trim(),
            requester,
            phone,
            forStock: !!form.forStock?.checked,
            forRepair: !!form.forRepair?.checked,
            forRepairTxt: (form.forRepairTxt?.value || "").trim(),
            forSale: !!form.forSale?.checked,
            forSaleTxt: (form.forSaleTxt?.value || "").trim(),
            urgency: form.urgency.value,
            note: form.note.value.trim(),
            status: "Submitted",
            editToken: nanoid(24),
            createdAt: nowISO(),
            updatedAt: nowISO(),
            items: items.map(it=> ({...it, photos: it.photos.map(n=> ({ name:n, addedAt: nowISO() }))})),
            files: { quotation: [], po: [], shipping: [] },
            activity: [{ at: nowISO(), actor: `${requester} (${phone})`, action:"SUBMIT", detail:"" }]
    };
  }

    db.qr.unshift(reqObj);
    saveDB(db);

    $("#preview").innerHTML = `
      <div class="pill">สร้างคำขอสำเร็จ: <b class="mono">${docNo}</b></div>
      <div class="hr"></div>
      <div><b>Project:</b> ${escapeHtml(reqObj.project||"-")}</div>
      <div><b>Requester:</b> ${escapeHtml(reqObj.requester)} (${escapeHtml(reqObj.phone)})</div>
      <div><b>Items:</b> ${reqObj.items.length}</div>
      <div class="hr"></div>
      <button class="btn btn-primary" id="btnGoDetail">เปิดเคสนี้</button>
    `;

    $("#btnGoDetail").onclick = ()=> location.hash = `#/detail/${encodeURIComponent(docNo)}`;
    toast("สร้าง PR สำเร็จ: " + docNo);
  };
}

function renderSummaryPR(el){
  setPageTitle("Summary PR", "ค้นหาได้ทุกมิติ: PR / ชื่อคน / เบอร์ / รายการ / code / detail");
  const db = loadDB();
  const q = ($("#globalSearch").value || "").trim().toLowerCase();
  const rows = filterPR(db.pr||[], q);

  el.innerHTML = `
    <div class="card">
      <div class="section-title">
        <h2>รายการ PR</h2>
        <div class="row tight">
          <button class="btn btn-primary" id="btnCreatePR2">➕ Request PR</button>
          <button class="btn btn-ghost" id="btnResetPR">Reset demo</button>
        </div>
      </div>
      <div class="subtext">ผลการค้นหา: <b>${escapeHtml(q || "ทั้งหมด")}</b> (${rows.length} รายการ)</div>
      <div class="hr"></div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Doc Date</th>
              <th>PR No.</th>
              <th>Subject</th>
              <th>Requester</th>
              <th>Status</th>
              <th>#Items</th>
              <th>Total</th>
              <th>Last update</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r=>{
              const total = (r.items||[]).reduce((s,it)=> s + Number(it.total||0), 0);
              return `
                <tr>
                  <td class="mono">${r.docDate}</td>
                  <td class="mono"><a href="#/detail/${encodeURIComponent(r.docNo)}">${r.docNo}</a></td>
                  <td>${escapeHtml(r.subject||"")}</td>
                  <td>${escapeHtml(r.requester)}<div class="subtext">${escapeHtml(r.phone)}</div></td>
                  <td>${badge(r.status)}</td>
                  <td>${(r.items||[]).length}</td>
                  <td class="mono">${Number(total).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                  <td class="mono">${(r.updatedAt||"").slice(0,10)}</td>
                  <td>
                    <div class="actions">
                      <button class="btn btn-small" data-open="${r.docNo}">Open</button>
                      <button class="kebab" data-kebab="${r.docNo}">⋯</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join("") || `<tr><td colspan="9">ไม่พบข้อมูล</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $("#btnCreatePR2").onclick = ()=> location.hash = "#/request-pr";
  $("#btnResetPR").onclick = ()=>{
    localStorage.removeItem(LS_KEY);
    toast("รีเซ็ตข้อมูลเดโมแล้ว");
    renderRoute();
  };
  $$("[data-open]").forEach(b=>{
    b.onclick = ()=> location.hash = `#/detail/${encodeURIComponent(b.dataset.open)}`;
  });
  setupKebabs();
}

function filterPR(reqs, q){
  if(!q) return reqs;
  const qq = q.toLowerCase();
  return reqs.filter(r=>{
    const hay = [r.docNo, r.docDate, r.subject, r.requester, r.phone, r.status, r.remark].filter(Boolean).join(" ").toLowerCase();
    if(hay.includes(qq)) return true;
    for(const it of r.items||[]){
      const ih = [it.detail, it.code, it.unit].filter(Boolean).join(" ").toLowerCase();
      if(ih.includes(qq)) return true;
      for(const p of it.photos||[]){
        if((p.name||"").toLowerCase().includes(qq)) return true;
      }
    }
    return false;
  });
}

/* ---------- (ส่วนที่เหลือของไฟล์มึง ไม่เกี่ยวกับ “label หน้าแบบฟอร์ม”) ---------- */
/*  - renderDetail / renderHelp / search / kebab / bindGlobal ฯลฯ
    กูไม่ได้ยุ่ง logic อื่นนะ (แต่ถ้ามึงต้องการให้ Activity/Detail ก็ 2 ภาษา เดี๋ยวค่อยสั่ง) */

function renderSummaryPO(el){
  setPageTitle("Summary PO", "แยก 3 ส่วน: PURCHASE / ACCOUNTING / CLAIM (ทำแบบไม่ทำตารางแตก)");
  const db = loadDB();
  db.po = db.po || [];
  saveDB(db);

  const q = ($("#globalSearch").value || "").trim().toLowerCase();
  const rows = filterPO(db.po, q);

  // Keep open state in-memory only (low-risk)
  const openPoNo = window.__po_open || "";
  const openPo = openPoNo ? rows.find(x => (x.poNo||"") === openPoNo) || (db.po||[]).find(x => (x.poNo||"")===openPoNo) : null;

  const refText = (p)=> [p?.refs?.qrNo, p?.refs?.prNo, p?.refs?.qtNo].filter(Boolean).join(" / ");

  el.innerHTML = `
    <div class="card">
      <div class="section-title">
        <h2 style="margin:0">รายการ PO</h2>
        <div class="row tight">
          <button class="btn btn-primary" id="btnPOImport">📥 Import (mock)</button>
          <button class="btn btn-ghost" id="btnPOExport">📤 Export (mock)</button>
          <button class="btn btn-ghost" id="btnPONew">➕ New PO</button>
        </div>
      </div>

      <div class="subtext">ผลการค้นหา: <b>${escapeHtml(q || "ทั้งหมด")}</b> (${rows.length} รายการ)</div>
      <div class="hr"></div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
            <th>Date</th>
            <th>PO No.</th>
            <th>Supplier</th>
            <th>Reff (QR/PR/QT)</th>
            <th>Requester</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
          </thead>
          <tbody>
            ${rows.map(p=>{
              const grand = poGrandTotal(p);
              const paid = poPaidTotal(p);
              const bal = Math.max(0, grand - paid);
              const isOpen = (p.poNo||"") === openPoNo;
              return `
                <tr ${isOpen ? 'style="background: rgba(255,153,102,0.10)"' : ""}>
                  <td class="mono">${escapeHtml(p.date||"")}</td>
                  <td class="mono">${escapeHtml(p.poNo||"")}</td>
                  <td>${escapeHtml(p.supplier||"")}</td>
                  <td class="mono">${escapeHtml(refText(p)||"-")}</td>
                  <td>${escapeHtml(p.requester || p.purchase?.requester || "-")}</td>
                  <td>${badge(p.status||"Open")}</td>
                  <td>
                    <button class="btn btn-small" data-poopen="${escapeHtml(p.poNo||"")}">${isOpen ? "Hide" : "Open"}</button>
                  </td>
                </tr>
              `;
            }).join("") || `<tr><td colspan="7">ไม่พบข้อมูล</td></tr>`}
          </tbody>
        </table>
      </div>

      ${openPo ? `
        <div class="hr" style="margin-top:14px"></div>
        <div class="section-title" style="margin-top:6px">
          <h2 style="margin:0">PO Detail: <span class="mono">${escapeHtml(openPo.poNo||"")}</span></h2>
          <div class="subtext">แยก 3 ส่วนตามเช็คลิสต์: PURCHASE / ACCOUNTING / CLAIM</div>
        </div>

        ${renderPODetailPanels(openPo)}
      ` : `
        <div class="pill" style="margin-top:10px">
          ทิป: กด Open ที่ PO ใดๆ เพื่อดูรายละเอียดแบบแยก 3 ส่วน (ไม่ยัดคอลัมน์จนตารางพัง)
        </div>
      `}
    </div>
  `;

  $("#btnPOImport").onclick = ()=> toast("Import (mock) — เดี๋ยวต่อ PO Import จริง");
  $("#btnPOExport").onclick = ()=> toast("Export (mock) — เดี๋ยวต่อ Export Excel จริง");

  // Quick create PO (prompt-based, low-risk; no UI changes)
  $("#btnPONew")?.addEventListener("click", ()=>{
    try{
      const db2 = loadDB();
      db2.po = db2.po || [];
      const today = new Date().toISOString().slice(0,10);

      const date = (prompt("PO Date (YYYY-MM-DD):", today) || "").trim() || today;
      const poNo = (prompt("PO No.:", "") || "").trim();
      if(!poNo){ toast("ยกเลิก: ต้องมี PO No."); return; }
      if(db2.po.some(x => (x.poNo||"") === poNo)){ toast("มี PO No นี้แล้ว"); return; }

      const supplier = (prompt("Supplier:", "") || "").trim();
      const requester = (prompt("Requester:", "") || "").trim();
      const status = (prompt("Status (Open/Paid/Partially/etc):", "Open") || "").trim() || "Open";
      const qrNo = (prompt("Reff QR No (ถ้ามี):", "") || "").trim();
      const prNo = (prompt("Reff PR No (ถ้ามี):", "") || "").trim();
      const qtNo = (prompt("Reff QT No (ถ้ามี):", "") || "").trim();

      const po = {
        date,
        poNo,
        supplier,
        requester,
        status,
        currency: "THB",
        refs: { qrNo, prNo, qtNo },
        items: [],
        payments: []
      };
      db2.po.unshift(po);
      saveDB(db2);

      window.__po_open = poNo;
      toast("เพิ่ม PO แล้ว");
      renderRoute();
    }catch(err){
      console.error(err);
      toast("เพิ่ม PO ไม่สำเร็จ");
    }
  });

  $$("[data-poopen]", el).forEach(b=>{
    b.onclick = ()=>{
      const poNo = b.dataset.poopen || "";
      window.__po_open = (window.__po_open === poNo) ? "" : poNo;
      renderSummaryPO(el);
    };
  });

  // Payment Table actions (low-risk; only touches db.po[*].payments)
  $$("[data-popayadd]", el).forEach(btn=>{
    btn.onclick = ()=>{
      const poNo = btn.dataset.popayadd || "";
      const dbx = loadDB();
      dbx.po = dbx.po || [];
      const po = dbx.po.find(x => (x.poNo||"") === poNo);
      if(!po) return toast("ไม่พบ PO ในฐานข้อมูล");
      po.payments = Array.isArray(po.payments) ? po.payments : [];

      const date = prompt("Payment Date (YYYY-MM-DD)", nowISO().slice(0,10));
      if(date === null) return;
      const amtStr = prompt("Amount (THB)", "0");
      if(amtStr === null) return;
      const amt = Number(String(amtStr).replace(/,/g,"").trim());
      if(!isFinite(amt) || amt <= 0) return toast("Amount ต้องเป็นตัวเลขมากกว่า 0");

      const note = prompt("Note (optional)", "") ?? "";
      const slip = prompt("Slip Link (optional)", "") ?? "";

      po.payments.push({ date: String(date).trim(), amountTHB: amt, note: String(note), slipLink: String(slip) });
      saveDB(dbx);
      window.__po_open = poNo; // keep open
      renderSummaryPO(el);
      toast("เพิ่ม Payment แล้ว");
    };
  });

  $$("[data-popaydel]", el).forEach(btn=>{
    btn.onclick = ()=>{
      const poNo = btn.dataset.popaydel || "";
      const idx = Number(btn.dataset.payidx || "-1");
      const ok = confirm("ลบ payment งวดนี้?");
      if(!ok) return;

      const dbx = loadDB();
      dbx.po = dbx.po || [];
      const po = dbx.po.find(x => (x.poNo||"") === poNo);
      if(!po) return toast("ไม่พบ PO ในฐานข้อมูล");
      po.payments = Array.isArray(po.payments) ? po.payments : [];
      if(idx < 0 || idx >= po.payments.length) return;

      po.payments.splice(idx, 1);
      saveDB(dbx);
      window.__po_open = poNo;
      renderSummaryPO(el);
      toast("ลบ Payment แล้ว");
    };
  });

  $$("[data-popayminus]", el).forEach(btn=>{
    btn.onclick = ()=>{
      const poNo = btn.dataset.popayminus || "";
      const ok = confirm("ลบงวดล่าสุด?");
      if(!ok) return;

      const dbx = loadDB();
      dbx.po = dbx.po || [];
      const po = dbx.po.find(x => (x.poNo||"") === poNo);
      if(!po) return toast("ไม่พบ PO ในฐานข้อมูล");
      po.payments = Array.isArray(po.payments) ? po.payments : [];
      if(!po.payments.length) return toast("ยังไม่มี payment");
      po.payments.pop();
      saveDB(dbx);
      window.__po_open = poNo;
      renderSummaryPO(el);
      toast("ลบงวดล่าสุดแล้ว");
    };
  });


}

function renderPODetailPanels(po){
  const grand = poGrandTotal(po);
  const paid = poPaidTotal(po);
  const bal = Math.max(0, grand - paid);

  const refs = po.refs || {};
  const items = Array.isArray(po.items) ? po.items : [];
  const payments = Array.isArray(po.payments) ? po.payments : [];
  const atts = po.attachments || {};

  const attBlock = (label, arr)=>{
    const list = Array.isArray(arr) ? arr : [];
    if(!list.length) return `<div class="subtext">-</div>`;
    return `
      <ul class="subtext" style="margin:6px 0 0 18px">
        ${list.map(a=>{
          if(typeof a === "string") return `<li><span class="mono">${escapeHtml(a)}</span></li>`;
          return `<li>${escapeHtml(a.name||"File")} ${a.url ? `— <span class="mono">${escapeHtml(a.url)}</span>` : ""}</li>`;
        }).join("")}
      </ul>
    `;
  };

  return `
    <div class="row" style="gap:12px; flex-wrap:wrap">
      <div class="card" style="flex:1; min-width:280px">
        <div class="section-title" style="margin:0 0 8px">
          <h2 style="margin:0">A) PURCHASE</h2>
          <div class="subtext">ข้อมูลสั่งซื้อ + รายการสินค้า</div>
        </div>

        <div class="grid2" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><div class="subtext">Date</div><div class="mono"><b>${escapeHtml(po.date||"-")}</b></div></div>
          <div><div class="subtext">PO No.</div><div class="mono"><b>${escapeHtml(po.poNo||"-")}</b></div></div>

          <div><div class="subtext">Reff QT No.</div><div class="mono">${escapeHtml(refs.qtNo||"-")}</div></div>
          <div><div class="subtext">Request Type</div><div>${escapeHtml(po.requestType||"-")}</div></div>

          <div><div class="subtext">For Job</div><div>${escapeHtml(po.forJob||"-")}</div></div>
          <div><div class="subtext">Supplier</div><div>${escapeHtml(po.supplier||"-")}</div></div>

          <div><div class="subtext">Model</div><div>${escapeHtml(po.model||"-")}</div></div>
          <div><div class="subtext">Serial</div><div class="mono">${escapeHtml(po.serial||"-")}</div></div>

          <div><div class="subtext">Requester</div><div>${escapeHtml(po.requester||"-")}</div></div>
          <div><div class="subtext">Contact</div><div class="mono">${escapeHtml(po.contactNo||"-")}</div></div>

          <div><div class="subtext">Receive Date</div><div class="mono">${escapeHtml(refs.receiveDate||"-")}</div></div>
          <div><div class="subtext">Refs (QR/PR)</div><div class="mono">${escapeHtml([refs.qrNo, refs.prNo].filter(Boolean).join(" / ")||"-")}</div></div>
        </div>

        <div class="hr" style="margin:12px 0"></div>

        <div class="subtext"><b>Items</b> (${items.length})</div>
        <div class="table-wrap" style="margin-top:6px">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product Code</th>
                <th>Detail</th>
                <th class="right">QTY</th>
                <th>Unit</th>
                <th class="right">Price/Unit</th>
                <th class="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((it,idx)=>{
                const qty = Number(it.qty||0);
                const price = Number(it.price||it.unitPrice||0);
                const total = Number(it.total|| (qty*price));
                return `
                  <tr>
                    <td class="mono">${idx+1}</td>
                    <td class="mono">${escapeHtml(it.code||it.productCode||"-")}</td>
                    <td>${escapeHtml(it.detail||it.desc||it.description||"-")}</td>
                    <td class="mono right">${escapeHtml(qty||0)}</td>
                    <td class="mono">${escapeHtml(it.unit||"-")}</td>
                    <td class="mono right">${fmtMoney(price)}</td>
                    <td class="mono right">${fmtMoney(total)}</td>
                  </tr>
                `;
              }).join("") || `<tr><td colspan="7">-</td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="hr" style="margin:12px 0"></div>
        <div class="subtext"><b>Attachments</b></div>
        <div style="margin-top:6px">
          <div class="subtext">Customer quotation</div>${attBlock("quotation", atts.customerQuotation)}
          <div class="subtext" style="margin-top:6px">Customer PO</div>${attBlock("customerPO", atts.customerPO)}
          <div class="subtext" style="margin-top:6px">Drawings / Spec</div>${attBlock("spec", atts.spec)}
        </div>
      </div>

      <div class="card" style="flex:1; min-width:280px">
        <div class="section-title" style="margin:0 0 8px">
          <h2 style="margin:0">B) ACCOUNTING</h2>
          <div class="subtext">ภาษี/หัก ณ ที่จ่าย + จ่ายหลายงวด</div>
        </div>

        <div class="grid2" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><div class="subtext">Tax 7%</div><div class="mono">${escapeHtml(String(po.tax7 ?? "-"))}</div></div>
          <div><div class="subtext">WHT</div><div class="mono">${escapeHtml(String(po.wht ?? "-"))}</div></div>
          <div><div class="subtext">Exchange Rate</div><div class="mono">${escapeHtml(String(po.exchangeRate ?? "-"))}</div></div>
          <div><div class="subtext">Cost (THB)</div><div class="mono">${escapeHtml(String(po.costTHB ?? "-"))}</div></div>

          <div><div class="subtext">Grand</div><div class="mono"><b>${fmtMoney(grand)}</b></div></div>
          <div><div class="subtext">Paid / Balance</div><div class="mono"><b>${fmtMoney(paid)}</b> / ${fmtMoney(bal)}</div></div>

          <div><div class="subtext">Payment Status</div><div>${badge(po.paymentStatus || (bal<=0 && grand>0 ? "Paid" : (paid>0 ? "Partially Paid" : "Unpaid")))}</div></div>
          <div><div class="subtext">Payment Date</div><div class="mono">${escapeHtml(po.paymentDate || "-")}</div></div>
        </div>

        <div class="hr" style="margin:12px 0"></div>

        <div class="row tight" style="justify-content:space-between;align-items:center">
  <div class="subtext"><b>Payment Table</b> (${payments.length} งวด)</div>
  <button class="btn btn-primary" data-popayadd="${escapeHtml(po.poNo||"")}">➕ Add Payment</button>
              <button class="btn btn-ghost" data-popayminus="${escapeHtml(po.poNo||"")}" title="Remove last payment">➖</button>
</div>
        <div class="table-wrap" style="margin-top:6px">
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Date</th>
                <th class="right">Amount (THB)</th>
                <th>Note</th>
                <th>Slip Link</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map((pm, idx)=>{
                const amt = Number(pm.amountTHB || pm.amount || 0);
                return `
                  <tr>
                    <td class="mono">${idx+1}</td>
                    <td class="mono">${escapeHtml(pm.date||"-")}</td>
                    <td class="mono right">${fmtMoney(amt)}</td>
                    <td>${escapeHtml(pm.note||"")}</td>
                    <td class="mono">${escapeHtml(pm.slipLink||pm.slip||"-")}</td>
                    <td><button class="btn btn-ghost" data-popaydel="${escapeHtml(po.poNo||"")}" data-payidx="${idx}">🗑️</button></td>
                  </tr>
                `;
              }).join("") || `<tr><td colspan="5">-</td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="hr" style="margin:12px 0"></div>
        <div class="subtext"><b>Attachments</b></div>
        <div style="margin-top:6px">
          <div class="subtext">Supplier payment documents</div>${attBlock("supplierDocs", atts.supplierDocs)}
          <div class="subtext" style="margin-top:6px">Supplier payment slip</div>${attBlock("supplierSlip", atts.supplierSlip)}
          <div class="subtext" style="margin-top:6px">Customer payment slip</div>${attBlock("customerSlip", atts.customerSlip)}
        </div>

        <div class="hr" style="margin:12px 0"></div>
        <div class="subtext"><b>PO Folder</b></div>
        <div class="mono" style="margin-top:6px">${escapeHtml(po.poFolderLink || "-")}</div>
      </div>

      <div class="card" style="flex:1; min-width:280px">
        <div class="section-title" style="margin:0 0 8px">
          <h2 style="margin:0">C) CLAIM / REPAIR</h2>
          <div class="subtext">ลิงก์เคลม/ซ่อม (ถ้ามี)</div>
        </div>

        <div class="grid2" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><div class="subtext">Doc No.</div><div class="mono">${escapeHtml(po.claim?.docNo || "-")}</div></div>
          <div><div class="subtext">Status Claim</div><div>${badge(po.claim?.status || "-")}</div></div>

          <div><div class="subtext">Reff QT (Claim)</div><div class="mono">${escapeHtml(po.claim?.qtNo || "-")}</div></div>
          <div><div class="subtext">Reff PO (Claim)</div><div class="mono">${escapeHtml(po.claim?.poNo || "-")}</div></div>
        </div>

        <div class="hr" style="margin:12px 0"></div>
        <div class="subtext"><b>Attachments</b></div>
        <div style="margin-top:6px">
          <div class="subtext">CI / packing list / BL etc.</div>${attBlock("shippingDocs", atts.shippingDocs)}
        </div>
      </div>
    </div>
  `;
}

function renderShippingPlan(el){
  setPageTitle("Shipping Plan", "ติดตามการจัดส่ง (BL/ETD/ETA/Container)");
  el.innerHTML = `<div class="card"><b>Shipping Plan</b><div class="subtext" style="margin-top:6px">Coming soon (เดี๋ยวค่อยใส่ฟอร์ม/ตารางจริง)</div></div>`;
}

function renderClaimMO(el){
  setPageTitle("Claim / Repair (MO)", "ฟอร์ม Maintenance Order");
  el.innerHTML = `<div class="card"><b>Claim / Repair (MO)</b><div class="subtext" style="margin-top:6px">Coming soon (เดี๋ยวค่อยใส่ฟอร์ม/ตารางจริง)</div></div>`;
}

function renderSummaryMO(el){
  setPageTitle("Summary MO", "สรุปรายการ MO ทั้งหมด");
  el.innerHTML = `<div class="card"><b>Summary MO</b><div class="subtext" style="margin-top:6px">Coming soon (เดี๋ยวค่อยใส่ฟอร์ม/ตารางจริง)</div></div>`;
}

function renderCost(el){
  setPageTitle("Cost", "ค้นหาต้นทุนจากรหัสสินค้า/PO/Delivery Plan");
  el.innerHTML = `<div class="card"><b>Cost</b><div class="subtext" style="margin-top:6px">Coming soon (เดี๋ยวค่อยใส่ฟอร์ม/ตารางจริง)</div></div>`;
}

function renderDetail(el, docNo){
  const db = loadDB();

  let req = (db.qr||[]).find(r => r.docNo === docNo);
  let isPR = false;

  if(!req){
    req = (db.pr||[]).find(r => r.docNo === docNo);
    isPR = !!req;
  }

  if(!req){
    el.innerHTML = `<div class="card">ไม่พบเอกสาร ${escapeHtml(docNo)}</div>`;
    return;
  }

  setPageTitle(req.docNo, isPR ? "รายละเอียด PR ใบนี้ (แนบ Receipt / Activity)" : "ทุกอย่างผูกกับ QR ใบนี้ (Quotation / PO / Shipping)");

  const admin = isAdmin();
  const tabState = window.__tab || (isPR ? "pr" : "qr");

  el.innerHTML = `
    <div class="card">
      <div class="section-title">
        <div>
          <h2 style="margin:0">${req.docNo}</h2>
          <div class="subtext">Doc date: <span class="mono">${req.docDate}</span> • Requester: <b>${escapeHtml(req.requester)}</b> (${escapeHtml(req.phone)})</div>
          ${isPR
            ? `<div class="subtext">Subject: ${escapeHtml(req.subject||"-")} • For job: ${escapeHtml(req.forJob||"-")}</div>`
            : `<div class="subtext">Project: ${escapeHtml(req.project||"-")}</div>`
          }
        </div>
        <div class="row tight">
          ${badge(req.status)}
          ${admin ? (isPR ? `
            <button class="btn btn-primary" id="btnAddReceipt">➕ Add Receipt</button>
          ` : `
            <button class="btn btn-primary" id="btnAddQuotation">➕ Add Quotation</button>
            <button class="btn btn-primary" id="btnAddPO">➕ Add PO</button>
            <button class="btn btn-primary" id="btnShip">➕ Update Shipping</button>
          `) : `
            <button class="btn btn-ghost" id="btnReqEdit">✍️ ขอแก้ไข</button>
          `}
        </div>
      </div>

      <div class="hr"></div>

      <div class="tabs">
        ${isPR ? `
          <button class="tab ${tabState==="pr"?"active":""}" data-tab="pr">Purchase Requisition</button>
          <button class="tab ${tabState==="act"?"active":""}" data-tab="act">Activity</button>
        ` : `
          <button class="tab ${tabState==="qr"?"active":""}" data-tab="qr">Quotation Request</button>
          <button class="tab ${tabState==="quote"?"active":""}" data-tab="quote">Quotation</button>
          <button class="tab ${tabState==="po"?"active":""}" data-tab="po">Purchase Orders</button>
          <button class="tab ${tabState==="ship"?"active":""}" data-tab="ship">Shipping Plan</button>
          <button class="tab ${tabState==="act"?"active":""}" data-tab="act">Activity</button>
        `}
      </div>

      <div class="hr"></div>

      <div id="tabContent"></div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="section-title">
        <h2 style="margin:0; font-size: 16px">Search within this ${isPR ? "PR" : "QR"}</h2>
        <div class="subtext">ค้นในรายการสินค้า / รายละเอียด / ชื่อไฟล์แนบ</div>
      </div>
      <div class="row">
        <input class="input" id="caseSearch" placeholder="เช่น XR280 / pump / bolt / quotation..." />
        <button class="btn btn-ghost" id="btnCaseSearch">Search</button>
      </div>
      <div class="subtext" id="caseSearchResult"></div>
    </div>
  `;

  $$("[data-tab]").forEach(b=>{
    b.onclick = ()=>{
      window.__tab = b.dataset.tab;
      renderRoute();
    };
  });

  const tc = $("#tabContent");

  if(!isPR && tabState === "qr"){
    tc.innerHTML = `
      <div class="grid cols-2">
        <div>
          <div class="subtext"><b>Urgency:</b> ${escapeHtml(req.urgency)}</div>
          <div class="subtext"><b>Note:</b> ${escapeHtml(req.note||"-")}</div>
          <div class="hr"></div>
          <div class="section-title"><h2 style="margin:0; font-size: 14px">Items (${req.items.length})</h2></div>
          <div class="hr"></div>
          ${req.items.map(it=>`
            <div class="card" style="box-shadow:none; margin-bottom:10px">
              <div class="row">
                <div style="flex:2">
                  <div><b>#${it.lineNo} ${escapeHtml(it.name)}</b> <span class="subtext">${escapeHtml(it.model||"")}</span></div>
                  <div class="subtext">Code: ${escapeHtml(it.code||"-")} • QTY: ${it.qty} ${escapeHtml(it.unit)}</div>
                  <div class="subtext">Detail: ${escapeHtml(it.detail||"-")}</div>
                  <div class="subtext">Remark: ${escapeHtml(it.remark||"-")}</div>
                </div>
              </div>
              <div class="hr"></div>
              <div class="subtext"><b>Photos:</b> ${it.photos?.length ? "" : "—"}</div>
              <div class="row">
                ${(it.photos||[]).map(p=> `<span class="pill">🖼 ${escapeHtml(p.name)}</span>`).join("")}
              </div>
            </div>
          `).join("")}
        </div>

        <div>
          <div class="section-title">
            <h2 style="margin:0; font-size: 14px">Exports (mock)</h2>
            <div class="subtext">ของจริง: PDF/Excel จะถูกสร้างและอัปโหลดเข้า Drive อัตโนมัติ</div>
          </div>
          <div class="hr"></div>
          <div class="file">
            <div class="meta">
              <div class="name">${req.docNo}.pdf</div>
              <div class="small">Category: QR • Stored in Drive</div>
            </div>
            <button class="btn btn-small">Open</button>
          </div>
          <div style="height:8px"></div>
          <div class="file">
            <div class="meta">
              <div class="name">${req.docNo}.xlsx</div>
              <div class="small">Category: QR • Stored in Drive</div>
            </div>
            <button class="btn btn-small">Open</button>
          </div>
        </div>
      </div>
    `;
  }

  if(isPR && tabState === "pr"){
    const fmt = (n)=> Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2});
    const grand = (req.items||[]).reduce((s,it)=> s + Number(it.total || (Number(it.qty||0)*Number(it.price||0))), 0);

    tc.innerHTML = `
      <div class="grid cols-2">
        <div>
          <div class="subtext"><b>Subject:</b> ${escapeHtml(req.subject||"-")}</div>
          <div class="subtext"><b>For job:</b> ${escapeHtml(req.forJob||"-")}</div>
          <div class="subtext"><b>Remark:</b> ${escapeHtml(req.remark||"-")}</div>
          <div class="hr"></div>

          <div class="section-title"><h2 style="margin:0; font-size: 14px">Items (${(req.items||[]).length})</h2></div>
          <div class="hr"></div>

          ${(req.items||[]).map(it=>`
            <div class="card" style="box-shadow:none; margin-bottom:10px">
              <div><b>#${it.lineNo} ${escapeHtml(it.detail||"")}</b></div>
              <div class="subtext">Code: ${escapeHtml(it.code||"-")} • QTY: ${it.qty} ${escapeHtml(it.unit||"")}</div>
              <div class="subtext">Price/Unit: ${fmt(it.price||0)} • Total: <b class="mono">${fmt(it.total || (Number(it.qty||0)*Number(it.price||0)))}</b></div>
              <div class="hr"></div>
              <div class="subtext"><b>Photos:</b> ${(it.photos||[]).length ? "" : "—"}</div>
              <div class="row">
                ${(it.photos||[]).map(p=> `<span class="pill">🖼 ${escapeHtml(p.name)}</span>`).join("")}
              </div>
            </div>
          `).join("")}
        </div>

        <div>
          <div class="section-title">
            <h2 style="margin:0; font-size: 14px">Grand Total</h2>
            <div class="subtext">รวมเงิน (เดโม)</div>
          </div>
          <div class="hr"></div>
          <div class="kpi">
            <div>
              <div class="num">${fmt(grand)}</div>
              <div class="label">THB</div>
            </div>
            <div class="chip">Auto</div>
          </div>

          <div class="hr"></div>

          <div class="section-title">
            <h2 style="margin:0; font-size: 14px">Signatures (optional)</h2>
            <div class="subtext">Prepared / Order / Approve</div>
          </div>
          <div class="hr"></div>
          <div class="subtext"><b>Prepared by:</b> ${escapeHtml(req.approvals?.preparedBy||"-")}</div>
          <div class="subtext"><b>Order by:</b> ${escapeHtml(req.approvals?.orderedBy||"-")}</div>
          <div class="subtext"><b>Approve by:</b> ${escapeHtml(req.approvals?.approvedBy||"-")}</div>

          <div class="hr"></div>
          <div class="section-title">
            <h2 style="margin:0; font-size: 14px">Receipts (admin)</h2>
            <div class="subtext">ของจริง: ใบเสร็จ/หลักฐานแนบ</div>
          </div>
          <div class="hr"></div>
          ${(req.files?.receipts||[]).length ? (req.files.receipts||[]).map(f=>`
            <div class="file">
              <div class="meta">
                <div class="name">${escapeHtml(f.name)}</div>
                <div class="small">by ${escapeHtml(f.by)} • <span class="mono">${f.at}</span></div>
              </div>
              <button class="btn btn-small">Open</button>
            </div>
            <div style="height:8px"></div>
          `).join("") : `<div class="subtext">ยังไม่มีไฟล์แนบ</div>`}
          <div class="pill">ตัวอย่าง: รูปใบเสร็จ / ใบกำกับภาษี</div>
        </div>
      </div>
    `;
  }

  if(!isPR && tabState === "quote"){
    tc.innerHTML = renderFileTab("Quotation", req.files.quotation, admin, "quotation");
  }
  if(!isPR && tabState === "po"){
    tc.innerHTML = renderFileTab("Purchase Orders", req.files.po, admin, "po");
  }
  if(!isPR && tabState === "ship"){
    tc.innerHTML = renderShipTab(req, admin);
  }
  if(tabState === "act"){
    tc.innerHTML = `
      <div class="subtext">Activity log (เดโม): ประวัติการทำรายการ / การเปลี่ยนแปลงในเอกสาร</div>
      <div class="hr"></div>
      ${(req.activity||[]).map(a=>`
        <div class="file">
          <div class="meta">
            <div class="name">${escapeHtml(a.action)}</div>
            <div class="small">${escapeHtml(a.actor)} • <span class="mono">${a.at}</span></div>
            ${a.detail ? `<div class="small">${escapeHtml(a.detail)}</div>` : ""}
          </div>
        </div>
        <div style="height:8px"></div>
      `).join("")}
    `;
  }

  if(admin){
    if(isPR){
      $("#btnAddReceipt").onclick = ()=> openUploadModal(req, "receipts");
    }else{
      $("#btnAddQuotation").onclick = ()=> openUploadModal(req, "quotation");
      $("#btnAddPO").onclick = ()=> openUploadModal(req, "po");
      $("#btnShip").onclick = ()=> openShippingModal(req);
    }
  }else{
    $("#btnReqEdit").onclick = ()=>{
      const reason = prompt("เหตุผลขอแก้ไข (สั้นๆ):") || "";
      if(!reason.trim()) return;
      req.status = "EditRequested";
      req.activity.unshift({ at: nowISO(), actor: `${req.requester} (${req.phone})`, action:"REQUEST_EDIT", detail: reason });
      req.updatedAt = nowISO();
      saveBack(req);
      toast("ส่งคำขอแก้ไขแล้ว");
      renderRoute();
    };
  }

  $("#btnCaseSearch").onclick = ()=>{
    const q = ($("#caseSearch").value||"").trim().toLowerCase();
    const res = caseSearch(req, q);
    $("#caseSearchResult").textContent = q ? `พบ ${res} จุดที่เกี่ยวข้องกับ "${q}"` : "";
  };
}

function renderFileTab(title, files, admin, bucket){
  const list = (files||[]).map(f=>`
    <div class="file">
      <div class="meta">
        <div class="name">${escapeHtml(f.name)}</div>
        <div class="small">by ${escapeHtml(f.by)} • <span class="mono">${f.at}</span></div>
      </div>
      <div class="row tight">
        <button class="btn btn-small">Open</button>
        ${admin ? `<button class="btn btn-small btn-danger" data-del="${escapeHtml(f.id)}">Remove</button>` : ""}
      </div>
    </div>
    <div style="height:8px"></div>
  `).join("");

  const empty = `<div class="subtext">ยังไม่มีไฟล์แนบในหมวดนี้</div>`;
  return `
    <div class="section-title">
      <h2 style="margin:0; font-size: 14px">${escapeHtml(title)}</h2>
      <div class="subtext">${admin ? "Admin สามารถเพิ่ม/ลบได้" : "Read-only"}</div>
    </div>
    <div class="hr"></div>
    ${list || empty}
    <div class="pill">ของจริง: อัปโหลดผ่านระบบ → ระบบเก็บเข้า Drive ในโฟลเดอร์ QR อัตโนมัติ</div>
  `;
}

function renderShipTab(req, admin){
  const ship = req.shipping || { etd:"", eta:"", tracking:"", notes:"" };
  return `
    <div class="grid cols-2">
      <div class="card" style="box-shadow:none">
        <h3>Shipping Plan</h3>
        <div class="subtext"><b>ETD:</b> ${escapeHtml(ship.etd||"-")}</div>
        <div class="subtext"><b>ETA:</b> ${escapeHtml(ship.eta||"-")}</div>
        <div class="subtext"><b>Tracking/BL/Container:</b> ${escapeHtml(ship.tracking||"-")}</div>
        <div class="subtext"><b>Notes:</b> ${escapeHtml(ship.notes||"-")}</div>
        ${admin ? `<div class="hr"></div><button class="btn btn-primary" id="btnEditShip">Edit Shipping</button>` : ""}
      </div>
      <div class="card" style="box-shadow:none">
        <h3>Shipping Documents</h3>
        ${(req.files.shipping||[]).length ? (req.files.shipping||[]).map(f=>`
          <div class="file">
            <div class="meta">
              <div class="name">${escapeHtml(f.name)}</div>
              <div class="small">by ${escapeHtml(f.by)} • <span class="mono">${f.at}</span></div>
            </div>
            <button class="btn btn-small">Open</button>
          </div>
          <div style="height:8px"></div>
        `).join("") : `<div class="subtext">ยังไม่มีเอกสารแนบ</div>`}
        <div class="pill">ตัวอย่าง: BL / Packing List / Invoice</div>
      </div>
    </div>
  `;
}

function openUploadModal(req, bucket){
  const title = bucket === "quotation" ? "Add Quotation"
    : bucket === "po" ? "Add Purchase Order"
    : bucket === "receipts" ? "Add Receipt"
    : "Upload";

  const name = prompt(`${title}: ใส่ชื่อไฟล์ (เดโม)`,
    bucket === "quotation" ? "VendorA_Quote.pdf"
    : bucket === "po" ? "PO2601-xxx.pdf"
    : "Receipt.jpg"
  );
  if(!name) return;

  req.files = req.files || {};
  req.files[bucket] = req.files[bucket] || [];
  req.files[bucket].unshift({ id:nanoid(10), name, by:"admin", at: nowISO() });
  req.activity = req.activity || [];
  req.activity.unshift({ at: nowISO(), actor:"admin", action:`ADD_${bucket.toUpperCase()}`, detail: name });
  req.updatedAt = nowISO();

  if(req.kind !== "PR"){
    if(bucket === "quotation" && req.status === "Submitted") req.status = "Quoted";
    if(bucket === "po") req.status = "PO Issued";
  }

  saveBack(req);
  toast("แนบไฟล์แล้ว (เดโม): " + name);
  renderRoute();
}

function openShippingModal(req){
  const etd = prompt("ETD (YYYY-MM-DD)", req.shipping?.etd || "");
  if(etd === null) return;
  const eta = prompt("ETA (YYYY-MM-DD)", req.shipping?.eta || "");
  if(eta === null) return;
  const tracking = prompt("Tracking/BL/Container", req.shipping?.tracking || "");
  if(tracking === null) return;
  const notes = prompt("Notes", req.shipping?.notes || "");
  if(notes === null) return;

  req.shipping = { etd, eta, tracking, notes };
  req.status = "Shipping";
  req.activity.unshift({ at: nowISO(), actor:"admin", action:"UPDATE_SHIPPING", detail:`ETD=${etd} ETA=${eta}` });
  req.updatedAt = nowISO();
  saveBack(req);
  toast("อัปเดต Shipping แล้ว (เดโม)");
  renderRoute();
}

function saveBack(updated){
  const db = loadDB();
  if(updated.kind === "PR"){
    db.pr = db.pr || [];
    const idx = db.pr.findIndex(r => r.docNo === updated.docNo);
    if(idx >= 0) db.pr[idx] = updated;
    else db.pr.unshift(updated);
  }else{
    db.qr = db.qr || [];
    const idx = db.qr.findIndex(r => r.docNo === updated.docNo);
    if(idx >= 0) db.qr[idx] = updated;
    else db.qr.unshift(updated);
  }
  saveDB(db);
}

function renderHelp(el){
  setPageTitle("วิธีใช้งาน", "สั้น ๆ แต่ใช้ได้จริง (โปรโตไทป์)");
  el.innerHTML = `
    <div class="card">
      <h2 style="margin:0 0 6px">How it works (MVP)</h2>
      <div class="subtext">
        <ol>
          <li>พนักงานสร้างคำขอจากหน้าแรก → กรอกข้อมูล + แนบรูปต่อรายการ</li>
          <li>กด Submit → ระบบออกเลข <span class="mono">QRYY-MM.NNN</span> หรือ <span class="mono">PRYY-MM.NNN</span> อัตโนมัติ</li>
          <li>แอดมินเข้าเคส → กด <b>Add Quotation</b> / <b>Add PO</b> / <b>Update Shipping</b> หรือแนบ <b>Receipt</b></li>
          <li>ทุกอย่างผูกกับเคสนั้น และ (ของจริง) อัปโหลดลง Drive อัตโนมัติ</li>
          <li>ใครถามสถานะ → ให้ค้นใน Summary จากชื่อตัวเอง/ชื่อสินค้าได้เลย</li>
        </ol>
      </div>
      <div class="pill">โปรโตไทป์นี้เป็น HTML ล้วน เพื่อดูหน้าตา + UX ก่อนทำระบบจริง</div>
    </div>
  `;
}

/* Search */
function filterRequests(reqs, q){
  if(!q) return reqs;
  const qq = q.toLowerCase();
  return reqs.filter(r=>{
    const hay = [
      r.docNo, r.docDate, r.project, r.requester, r.phone, r.status, r.urgency, r.note
    ].filter(Boolean).join(" ").toLowerCase();

    if(hay.includes(qq)) return true;

    for(const it of r.items||[]){
      const ih = [it.name, it.model, it.code, it.detail, it.remark].filter(Boolean).join(" ").toLowerCase();
      if(ih.includes(qq)) return true;
    }

    const fileNames = []
      .concat((r.files?.quotation||[]).map(f=>f.name))
      .concat((r.files?.po||[]).map(f=>f.name))
      .concat((r.files?.shipping||[]).map(f=>f.name))
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if(fileNames.includes(qq)) return true;

    return false;
  });
}

function caseSearch(req, q){
  if(!q) return 0;
  let hits = 0;
  const h = [req.docNo, req.project, req.subject, req.requester, req.phone, req.note, req.remark].filter(Boolean).join(" ").toLowerCase();
  if(h.includes(q)) hits++;

  (req.items||[]).forEach(it=>{
    const ih = [it.name, it.model, it.code, it.detail, it.remark].filter(Boolean).join(" ").toLowerCase();
    if(ih.includes(q)) hits++;
    (it.photos||[]).forEach(p=>{
      if((p.name||"").toLowerCase().includes(q)) hits++;
    });
  });

  ["quotation","po","shipping","receipts"].forEach(k=>{
    (req.files?.[k]||[]).forEach(f=>{
      if((f.name||"").toLowerCase().includes(q)) hits++;
    });
  });

  return hits;
}

/* Kebab actions (mock) */
function setupKebabs(){
  $$("[data-kebab]").forEach(btn=>{
    btn.onclick = ()=>{
      const docNo = btn.dataset.kebab;
      const admin = isAdmin();
      const isPR = String(docNo||"").startsWith("PR");
      const actions = admin
        ? (isPR
            ? "1) Open\n2) Add Receipt\n3) Close"
            : "1) Open\n2) Add Quotation\n3) Add PO\n4) Update Shipping\n5) Close"
          )
        : "1) Open\n2) Request Edit";
      const pick = prompt(`Actions for ${docNo}\n${actions}\n\nพิมพ์เลข:`);
      if(!pick) return;

      if(pick==="1") location.hash = `#/detail/${encodeURIComponent(docNo)}`;

      if(!admin && pick==="2") location.hash = `#/detail/${encodeURIComponent(docNo)}`;

      if(admin && !isPR && pick==="2"){ location.hash = `#/detail/${encodeURIComponent(docNo)}`; window.__tab="quote"; toast("ไปแท็บ Quotation"); renderRoute(); }
      if(admin && !isPR && pick==="3"){ location.hash = `#/detail/${encodeURIComponent(docNo)}`; window.__tab="po"; toast("ไปแท็บ PO"); renderRoute(); }
      if(admin && !isPR && pick==="4"){ location.hash = `#/detail/${encodeURIComponent(docNo)}`; window.__tab="ship"; toast("ไปแท็บ Shipping"); renderRoute(); }

      if(admin && isPR && pick==="2"){ location.hash = `#/detail/${encodeURIComponent(docNo)}`; window.__tab="act"; toast("ไปแท็บ Activity"); renderRoute(); }

      const closePick = admin && ((isPR && pick==="3") || (!isPR && pick==="5"));
      if(closePick){
        const db = loadDB();
        const arr = isPR ? (db.pr||[]) : (db.qr||[]);
        const r = arr.find(x=>x.docNo===docNo);
        if(r){
          r.status="Closed";
          r.updatedAt=nowISO();
          r.activity = r.activity || [];
          r.activity.unshift({ at: nowISO(), actor:"admin", action:"CLOSE", detail:"" });
          saveDB(db);
          toast("ปิดงานแล้ว");
          renderRoute();
        }
      }
    };
  });
}

/* Init bindings */

/* Sidebar label guard (EN only) — do NOT let bilingual labels leak into sidebar */
function normalizeSidebarNavLabels(){
  const map = {
    "home": "Home",
    "request-qr": "Request QR",
    "summary-qr": "Summary QR",
    "request-pr": "Request PR",
    "summary-pr": "Summary PR",
    "help": "Help"
  };

  const items = $$(".nav-item");
  items.forEach(a=>{
    const r = a.dataset.route || "";
    const want = map[r];
    if(!want) return;

    // Try to update only the text label node without killing the icon SVG
    let labelEl =
      a.querySelector(".nav-text") ||
      a.querySelector(".nav-label") ||
      a.querySelector(".label") ||
      a.querySelector("span:last-of-type");

    // Fallback: find a child element that actually contains text (not svg)
    if(!labelEl){
      const els = Array.from(a.querySelectorAll("*")).reverse();
      labelEl = els.find(el=>{
        const tag = (el.tagName||"").toLowerCase();
        if(tag === "svg" || tag === "path") return false;
        return (el.childElementCount === 0) && (el.textContent||"").trim().length > 0;
      }) || null;
    }

    if(labelEl){
      labelEl.textContent = want;
      return;
    }

    // Last fallback: append a span for label (keeps icon if any)
    const sp = document.createElement("span");
    sp.className = "nav-text";
    sp.textContent = want;
    a.appendChild(sp);
  });
}


function bindGlobal(){
  normalizeSidebarNavLabels();

  // FIX: route ไม่มี "#/create" ให้ไป request-qr แทน
  $("#btnCreateTop").onclick = ()=> location.hash = "#/request-qr";

  $("#globalSearch").addEventListener("input", ()=>{
    const { r } = route();
    if(r === "summary-qr" || r === "summary-pr") renderRoute();
  });

  $("#btnToggleSidebar").onclick = ()=>{
    const sb = $(".sidebar");
    sb.classList.toggle("hidden");
  };

  // admin mode demo
  const adminBtn = $("#btnAdminSet");
  if(adminBtn){
    adminBtn.onclick = ()=>{
      const pass = $("#adminPass").value.trim();
      setAdminMode(!!pass);
    };
  }

  const role = $("#roleLabel");
  if(role) role.textContent = isAdmin() ? "Admin" : "Requester";
}

window.addEventListener("hashchange", renderRoute);

bindGlobal();
renderRoute();
