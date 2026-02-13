

/* Helpers */
function normalizeDB(db){
  if(!db || typeof db !== "object") db = {};
  if(!db.counters || typeof db.counters !== "object") db.counters = {};
  if(!db.counters.QR) db.counters.QR = { year: null, seq: 0 };
  if(!db.counters.PR) db.counters.PR = { year: null, seq: 0 };
  if(!db.counters.PO) db.counters.PO = { year: null, seq: 0 };
  if(!Array.isArray(db.qr)) db.qr = [];
  if(!Array.isArray(db.pr)) db.pr = [];
  if(!Array.isArray(db.po)) db.po = [];
  return db;
}

function pad(n, w=4){ n = String(n); return n.length>=w ? n : "0".repeat(w-n.length)+n; }
function todayISO(){
  const d=new Date();
  const mm=String(d.getMonth()+1).padStart(2,"0");
  const dd=String(d.getDate()).padStart(2,"0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function createPO(db){
  db = normalizeDB(db);
  const d = new Date();
  const yyyy = d.getFullYear();
  if(db.counters.PO.year !== yyyy){ db.counters.PO.year = yyyy; db.counters.PO.seq = 0; }
  db.counters.PO.seq += 1;
  const id = `po_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
  const date = todayISO();
  const poNo = `PO${yyyy}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}${pad(db.counters.PO.seq,4)}`;
  const po = {
    id,
    createdAt: Date.now(),
    date,
    poNo,
    supplier: "",
    reff: "",
    requester: "",
    status: "Open",
    hidden: false,
    purchase: { date, reffQt:"", requestType:"", forJob:"", model:"", serial:"", contact:"", receiveDate:"", refs:"", items: [] },
    accounting: { tax7:"", wht:"", exchangeRate:"", costTHB:"", grand:"", paidBalance:"", paymentStatus:"Unpaid", paymentDate:"" },
    claim: { docNo:"", statusClaim:"", reffQtClaim:"", reffPoClaim:"" },
    payments: []
  };
  db.po.push(po);
  return po;
}

function poBox(label, fieldKey, type, value){
  const fieldMap = {
    date: "purchase.date",
    poNo: "poNo",
    reffQt: "purchase.reffQt",
    requestType: "purchase.requestType",
    forJob: "purchase.forJob",
    supplier: "supplier",
    model: "purchase.model",
    serial: "purchase.serial",
    requester: "requester",
    contact: "purchase.contact",
    receiveDate: "purchase.receiveDate",
    refs: "purchase.refs",
    tax7: "accounting.tax7",
    wht: "accounting.wht",
    exchangeRate: "accounting.exchangeRate",
    costTHB: "accounting.costTHB",
    grand: "accounting.grand",
    paidBalance: "accounting.paidBalance",
    paymentDate: "accounting.paymentDate",
    docNo: "claim.docNo",
    statusClaim: "claim.statusClaim",
    reffQtClaim: "claim.reffQtClaim",
    reffPoClaim: "claim.reffPoClaim",
  };
  const path = fieldMap[fieldKey] || fieldKey;
  const inputType = (type==="number" ? "number" : (type==="date" ? "date" : "text"));
  return `
    <div class="po-box">
      <div class="po-box-label">${label}</div>
      <div class="po-box-value">
        <input class="in in-sm" type="${inputType}" value="${escapeAttr(value||"")}" data-field="${path}">
      </div>
    </div>
  `;
}

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
  db.counters = db.counters || { QR:{}, PR:{} };
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
    const seeded = normalizeDB(seedDB());
    localStorage.setItem(LS_KEY, JSON.stringify(seeded));
    return normalizeDB(seeded);
  }
  try { return normalizeDB(JSON.parse(raw)); } catch {
    const seeded = normalizeDB(seedDB());
    localStorage.setItem(LS_KEY, JSON.stringify(seeded));
    return normalizeDB(seeded);
  }
}
function saveDB(db){ localStorage.setItem(LS_KEY, JSON.stringify(db)); }

function seedDB(){
  const base = { counters: {
      PO: { year: null, seq: 0 }, QR: {}, PR: {} }, qr: [], pr: [] };

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

  base.counters.QR["26-01"] = 3;
  base.counters.PR["25-11"] = 1;

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
      position:absolute; left:50%; top:50%; trafunction renderSummaryPO(){
  const db = loadDB();
  const { param } = route();
  const selectedId = (param || "").trim();
  const poList = (db.po || []).slice().sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));

  // If no PO exists, create one sample (keeps UI from being empty)
  if(poList.length === 0){
    const p = createPO(db);
    saveDB(db);
    location.hash = `#/summary-po/${p.id}`;
    return;
  }

  const selected = selectedId ? (db.po || []).find(p=>p.id===selectedId) : poList[0];
  const selId = selected?.id || "";

  const rowsHtml = poList.map(p=>{
    const statusLabel = p.hidden ? "Hide" : (p.status || "Open");
    const statusClass = p.hidden ? "badge-muted" : "badge-open";
    return `
      <tr class="${p.id===selId ? "is-selected" : ""}">
        <td>${escapeHtml(p.date || "-")}</td>
        <td>${escapeHtml(p.poNo || "-")}</td>
        <td>${escapeHtml(p.supplier || "-")}</td>
        <td>${escapeHtml(p.reff || "-")}</td>
        <td>${escapeHtml(p.requester || "-")}</td>
        <td><span class="badge ${statusClass}">${escapeHtml(statusLabel)}</span></td>
        <td class="po-actions">
          <a class="btn btn-xs" href="#/summary-po/${p.id}">Open</a>
          <button class="btn btn-xs btn-outline" data-action="toggleHide" data-id="${p.id}">${p.hidden ? "Unhide" : "Hide"}</button>
        </td>
      </tr>
    `;
  }).join("");

  const detail = selected;
  const purchase = detail.purchase || {};
  const accounting = detail.accounting || {};
  const claim = detail.claim || {};
  const payments = detail.payments || [];

  const paymentRows = payments.map((pay, i)=>`
    <tr>
      <td>${i+1}</td>
      <td><input class="in in-sm" type="date" value="${escapeAttr(pay.date||"")}" data-action="payEdit" data-i="${i}" data-k="date"></td>
      <td><input class="in in-sm" type="number" step="0.01" value="${escapeAttr(pay.amount||"")}" data-action="payEdit" data-i="${i}" data-k="amount" placeholder="0.00"></td>
      <td><input class="in in-sm" type="text" value="${escapeAttr(pay.note||"")}" data-action="payEdit" data-i="${i}" data-k="note" placeholder="Note"></td>
      <td><button class="btn btn-xs btn-danger" data-action="payRemove" data-i="${i}">×</button></td>
    </tr>
  `).join("");

  const paymentStatus = accounting.paymentStatus || "Unpaid";

  $("#main").innerHTML = `
    <div class="page page-summary-po">
      <div class="toolbar-row">
        <div class="toolbar-left">
          <h2 class="page-h2">รายการ PO</h2>
          <div class="page-sub">ผลการค้นหา: <b>${poList.length}</b> รายการ</div>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-pill btn-orange" disabled>Import (mock)</button>
          <button class="btn btn-pill" disabled>Export (mock)</button>
          <button class="btn btn-pill" data-action="newPO">+ New PO</button>
        </div>
      </div>

      <div class="card card-soft">
        <div class="table-wrap">
          <table class="table table-po">
            <thead>
              <tr>
                <th>Date</th><th>PO No.</th><th>Supplier</th><th>Reff (QR/PR/QT)</th><th>Requester</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="7" class="muted">No PO</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="po-detail-head">
        <div><b>PO Detail:</b> <span class="muted">${escapeHtml(detail.poNo||detail.id)}</span></div>
        <div class="muted">แยก 3 ส่วนตามเช็คลิสต์: PURCHASE / ACCOUNTING / CLAIM</div>
      </div>

      <div class="po-3col">
        <!-- A) PURCHASE -->
        <div class="card po-card">
          <div class="po-card-title">
            <div class="po-card-title-left"><span class="po-card-letter">A)</span> <b>PURCHASE</b></div>
            <div class="muted">ข้อมูลสั่งซื้อ • รายการสินค้า</div>
          </div>

          <div class="po-box-grid">
            ${poBox("Date", "date", "date", purchase.date || detail.date)}
            ${poBox("PO No.", "poNo", "text", detail.poNo)}
            ${poBox("Reff QT No.", "reffQt", "text", purchase.reffQt || detail.reff)}
            ${poBox("Request Type", "requestType", "text", purchase.requestType)}
            ${poBox("For Job", "forJob", "text", purchase.forJob)}
            ${poBox("Supplier", "supplier", "text", detail.supplier)}
            ${poBox("Model", "model", "text", purchase.model)}
            ${poBox("Serial", "serial", "text", purchase.serial)}
            ${poBox("Requester", "requester", "text", detail.requester)}
            ${poBox("Contact", "contact", "text", purchase.contact)}
            ${poBox("Receive Date", "receiveDate", "date", purchase.receiveDate)}
            ${poBox("Refs (QR/PR)", "refs", "text", purchase.refs)}
          </div>

          <div class="po-section">
            <div class="po-section-title">Items <span class="muted">(${(purchase.items||[]).length||0})</span></div>
            <div class="table-wrap">
              <table class="table table-items">
                <thead>
                  <tr><th>#</th><th>Product Code</th><th>Detail</th><th>QTY</th><th>Unit</th></tr>
                </thead>
                <tbody id="poItemsBody"></tbody>
              </table>
            </div>
            <div class="row-actions">
              <button class="btn btn-xs" data-action="itemAdd">+ เพิ่มรายการ</button>
            </div>
          </div>

          <div class="po-section">
            <div class="po-section-title">Attachments</div>
            <div class="muted">Customer quotation / Customer PO / Drawings / Spec</div>
          </div>
        </div>

        <!-- B) ACCOUNTING -->
        <div class="card po-card">
          <div class="po-card-title">
            <div class="po-card-title-left"><span class="po-card-letter">B)</span> <b>ACCOUNTING</b></div>
            <div class="muted">ภาษี/หัก ณ ที่จ่าย • จ่ายหลายงวด</div>
          </div>

          <div class="po-box-grid">
            ${poBox("Tax 7%", "tax7", "text", accounting.tax7)}
            ${poBox("WHT", "wht", "text", accounting.wht)}
            ${poBox("Exchange Rate", "exchangeRate", "number", accounting.exchangeRate)}
            ${poBox("Cost (THB)", "costTHB", "number", accounting.costTHB)}
            ${poBox("Grand", "grand", "number", accounting.grand)}
            ${poBox("Paid / Balance", "paidBalance", "text", accounting.paidBalance)}
            <div class="po-box">
              <div class="po-box-label">Payment Status</div>
              <div class="po-box-value">
                <select class="in in-sm" data-field="accounting.paymentStatus">
                  ${["Unpaid","Partial","Paid"].map(s=>`<option value="${s}" ${paymentStatus===s?"selected":""}>${s}</option>`).join("")}
                </select>
              </div>
            </div>
            ${poBox("Payment Date", "paymentDate", "date", accounting.paymentDate)}
          </div>

          <div class="po-section po-payments">
            <div class="po-pay-head">
              <div class="po-section-title">Payment Table <span class="muted">(${payments.length} งวด)</span></div>
              <div class="po-pay-actions">
                <button class="btn btn-xs btn-outline" data-action="payAdd">+ Add Payment</button>
                <button class="btn btn-xs btn-danger" data-action="payMinus">−</button>
              </div>
            </div>
            <div class="table-wrap">
              <table class="table table-payments">
                <thead><tr><th>No</th><th>Date</th><th>Amount (THB)</th><th>Note</th><th></th></tr></thead>
                <tbody>${paymentRows || `<tr><td colspan="5" class="muted">-</td></tr>`}</tbody>
              </table>
            </div>

            <div class="po-section">
              <div class="po-section-title">Attachments</div>
              <div class="muted">Supplier payment documents / Supplier payment slip / Customer payment slip</div>
            </div>

            <div class="po-section">
              <div class="po-section-title">PO Folder</div>
              <div class="muted">-</div>
            </div>
          </div>
        </div>

        <!-- C) CLAIM / REPAIR -->
        <div class="card po-card">
          <div class="po-card-title">
            <div class="po-card-title-left"><span class="po-card-letter">C)</span> <b>CLAIM / REPAIR</b></div>
            <div class="muted">ลิงก์เคลม/ซ่อม (ถ้ามี)</div>
          </div>

          <div class="po-box-grid">
            ${poBox("Doc No.", "docNo", "text", claim.docNo)}
            ${poBox("Status Claim", "statusClaim", "text", claim.statusClaim)}
            ${poBox("Reff QT (Claim)", "reffQtClaim", "text", claim.reffQtClaim)}
            ${poBox("Reff PO (Claim)", "reffPoClaim", "text", claim.reffPoClaim)}
          </div>

          <div class="po-section">
            <div class="po-section-title">Attachments</div>
            <div class="muted">CI / packing list / BL etc.</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // render items rows
  const items = (purchase.items || []);
  const itemsBody = $("#poItemsBody");
  itemsBody.innerHTML = items.length ? items.map((it, i)=>`
    <tr>
      <td>${i+1}</td>
      <td><input class="in in-sm" type="text" value="${escapeAttr(it.code||"")}" data-action="itemEdit" data-i="${i}" data-k="code"></td>
      <td><input class="in in-sm" type="text" value="${escapeAttr(it.detail||"")}" data-action="itemEdit" data-i="${i}" data-k="detail"></td>
      <td><input class="in in-sm" type="number" step="1" value="${escapeAttr(it.qty||"")}" data-action="itemEdit" data-i="${i}" data-k="qty"></td>
      <td><input class="in in-sm" type="text" value="${escapeAttr(it.unit||"")}" data-action="itemEdit" data-i="${i}" data-k="unit"></td>
    </tr>
  `).join("") : `<tr><td colspan="5" class="muted">-</td></tr>`;

  // wire up editing: update db + save + keep selection
  $(".page-summary-po").addEventListener("input", (e)=>{
    const t = e.target;
    if(!(t instanceof HTMLElement)) return;

    // payment edit
    if(t.getAttribute("data-action")==="payEdit"){
      const i = Number(t.getAttribute("data-i"));
      const k = t.getAttribute("data-k");
      const val = t.value;
      const p = (db.po||[]).find(x=>x.id===selId);
      if(!p) return;
      p.payments = p.payments || [];
      p.payments[i] = p.payments[i] || { date:"", amount:"", note:"" };
      p.payments[i][k] = (k==="amount" ? (val===""?"":Number(val)) : val);
      saveDB(db);
      return;
    }

    // generic po fields
    const field = t.getAttribute("data-field");
    if(field){
      const p = (db.po||[]).find(x=>x.id===selId);
      if(!p) return;
      setByPath(p, field, (t.type==="number" ? (t.value===""?"":Number(t.value)) : t.value));
      // mirror top-level common fields
      if(field==="purchase.date") p.date = p.purchase.date;
      if(field==="purchase.supplier") p.supplier = p.purchase.supplier;
      if(field==="purchase.requester") p.requester = p.purchase.requester;
      saveDB(db);
      return;
    }

    // item edit
    if(t.getAttribute("data-action")==="itemEdit"){
      const i = Number(t.getAttribute("data-i"));
      const k = t.getAttribute("data-k");
      const val = t.value;
      const p = (db.po||[]).find(x=>x.id===selId);
      if(!p) return;
      p.purchase = p.purchase || {};
      p.purchase.items = p.purchase.items || [];
      p.purchase.items[i] = p.purchase.items[i] || {code:"",detail:"",qty:"",unit:""};
      p.purchase.items[i][k] = (k==="qty" ? (val===""?"":Number(val)) : val);
      saveDB(db);
      return;
    }
  });

  $(".page-summary-po").addEventListener("click", (e)=>{
    const t = e.target;
    if(!(t instanceof HTMLElement)) return;
    const action = t.getAttribute("data-action");
    if(!action) return;

    if(action==="newPO"){
      const p = createPO(db);
      saveDB(db);
      location.hash = `#/summary-po/${p.id}`;
      return;
    }

    if(action==="toggleHide"){
      const id = t.getAttribute("data-id");
      const p = (db.po||[]).find(x=>x.id===id);
      if(!p) return;
      p.hidden = !p.hidden;
      saveDB(db);
      renderRoute();
      return;
    }

    if(action==="itemAdd"){
      const p = (db.po||[]).find(x=>x.id===selId);
      if(!p) return;
      p.purchase = p.purchase || {};
      p.purchase.items = p.purchase.items || [];
      p.purchase.items.push({code:"", detail:"", qty:"", unit:""});
      saveDB(db);
      renderRoute();
      return;
    }

    if(action==="payAdd"){
      const p = (db.po||[]).find(x=>x.id===selId);
      if(!p) return;
      p.payments = p.payments || [];
      p.payments.push({date:"", amount:"", note:""});
      saveDB(db);
      renderRoute();
      return;
    }

    if(action==="payMinus"){
      const p = (db.po||[]).find(x=>x.id===selId);
      if(!p) return;
      p.payments = p.payments || [];
      if(p.payments.length) p.payments.pop();
      saveDB(db);
      renderRoute();
      return;
    }

    if(action==="payRemove"){
      const i = Number(t.getAttribute("data-i"));
      const p = (db.po||[]).find(x=>x.id===selId);
      if(!p) return;
      p.payments = p.payments || [];
      p.payments.splice(i,1);
      saveDB(db);
      renderRoute();
      return;
    }
  });
}

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
  setPageTitle("Summary PO", "สรุป PO (Import จาก Excel + Export ได้)");
  el.innerHTML = `<div class="card"><b>Summary PO</b><div class="subtext" style="margin-top:6px">Coming soon (เดี๋ยวค่อยใส่ฟอร์ม/ตารางจริง)</div></div>`;
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
