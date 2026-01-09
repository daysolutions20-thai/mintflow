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
  const base = { counters: { QR: {}, PR: {} }, qr: [], pr: [] };

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
    #items .card .row.row-codeqty > .field{ min-width: 0; }
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

  el.innerHTML = `
    <div class="card">
      <div class="section-title">
        <h2 style="margin:0">Welcome to <span style="color:var(--orange)">MintFlow</span> 🍊</h2>
        <div class="subtext">โปรโตไทป์หน้าตา/โฟลว์ เพื่อคุยงานก่อนทำของจริง</div>
      </div>

      <div class="hr"></div>

      <div class="tiles">
        <div class="tile">
          <div class="row tight" style="gap:12px; align-items:center">
            <div class="ico"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h6v6H4z"/><path d="M14 4h6v6h-6z"/><path d="M4 14h6v6H4z"/><path d="M14 14h3"/><path d="M14 17h6"/><path d="M17 14v6"/><path d="M20 20v0"/></svg></div>
            <div>
              <div class="t-title">Request QR</div>
              <div class="t-sub">ขอราคา + แนบรูปต่อรายการ</div>
            </div>
          </div>
          <button class="btn btn-primary" id="goRequestQR">Go</button>
        </div>

        <div class="tile">
          <div class="row tight" style="gap:12px; align-items:center">
            <div class="ico"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg></div>
            <div>
              <div class="t-title">Summary QR</div>
              <div class="t-sub">ค้นหา QR ได้ทุกมิติ (ทั้งหมด ${qrTotal})</div>
            </div>
          </div>
          <button class="btn btn-primary" id="goSummaryQR">Go</button>
        </div>

        <div class="tile">
          <div class="row tight" style="gap:12px; align-items:center">
            <div class="ico"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1-2 1V3z"/><path d="M9 7h6"/><path d="M9 11h6"/><path d="M9 15h4"/></svg></div>
            <div>
              <div class="t-title">Request PR</div>
              <div class="t-sub">ขอเบิก/ขอซื้อ + แนบรูปต่อรายการ</div>
            </div>
          </div>
          <button class="btn btn-primary" id="goRequestPR">Go</button>
        </div>

        <div class="tile">
          <div class="row tight" style="gap:12px; align-items:center">
            <div class="ico"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg></div>
            <div>
              <div class="t-title">Summary PR</div>
              <div class="t-sub">ค้นหา PR ได้ทุกมิติ (ทั้งหมด ${prTotal})</div>
            </div>
          </div>
          <button class="btn btn-primary" id="goSummaryPR">Go</button>
        </div>

        <div class="tile">
          <div class="row tight" style="gap:12px; align-items:center">
            <div class="ico"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2-3 4"/><path d="M12 17h.01"/><path d="M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z"/></svg></div>
            <div>
              <div class="t-title">กติกาการใช้งาน</div>
              <div class="t-sub">มีโน้ตให้อ่านก่อนเริ่ม</div>
            </div>
          </div>
          <button class="btn btn-ghost" id="goHelp">Open</button>
        </div>

                <div class="tile">
          <div class="row tight" style="gap:12px; align-items:center">
            <div class="ico"><img src="data:image/png;base64,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" alt="warning" style="width:34px;height:34px;display:block"/></div>
            <div>
              <div class="t-title">ไม่อยู่ในระบบ = ยังไม่ส่ง</div>
              <div class="t-sub">กรุณาค้นหาเองก่อนถาม</div>
            </div>
          </div>
        </div>
      </div>

      <div class="hr"></div>

      <div class="pill">Tip: ค้นจาก “ชื่อตัวเอง / เบอร์ / ชื่อสินค้า / model” ได้เลย ไม่ต้องไถไลน์ 😇</div>
      <div class="subtext" style="margin-top:10px">
        <ul style="margin:8px 0 0 18px">
          <li><b>พนักงาน</b>: สร้าง Request QR/PR + ดูสถานะของตัวเอง</li>
          <li><b>แอดมิน</b>: เพิ่มเอกสารต่อท้าย (Quotation/PO/Shipping/Receipt) ผ่านปุ่มในเคส</li>
          <li>เวลาถามสถานะ → ให้ยึดเลข <span class="mono">QR/PR</span> หรือให้เขาค้นเองใน Summary</li>
        </ul>
      </div>
    </div>
  `;

  $("#goRequestQR").onclick = () => location.hash = "#/request-qr";
  $("#goSummaryQR").onclick = () => location.hash = "#/summary-qr";
  $("#goRequestPR").onclick = () => location.hash = "#/request-pr";
  $("#goSummaryPR").onclick = () => location.hash = "#/summary-pr";
  $("#goHelp").onclick = () => location.hash = "#/help";
  const _goSummaryQR2 = $("#goSummaryQR2");
  if(_goSummaryQR2) _goSummaryQR2.onclick = () => location.hash = "#/summary-qr";
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
    <div class="grid cols-2">
      <div class="card">
        <style>
          .for-list{display:flex;flex-direction:column;gap:10px}
          .for-line{display:flex;align-items:center;gap:10px}
          .chk{display:flex;align-items:center;gap:10px;white-space:nowrap}
          .for-line .input{flex:1}
          textarea[name="note"]{min-height:96px}
        </style>

        <h2 style="margin:0 0 10px">Create Quotation Request (QR)</h2>
        <div class="subtext">* โปรโตไทป์นี้จะบันทึกลงเครื่อง (localStorage) เพื่อดูหน้าตาระบบ</div>
        <div class="hr"></div>

        <form class="form" id="frmCreate">
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
          </div>

          <div class="field">
            <label>${biLabel("Project / Subject", "โครงการ / หัวข้อ")}</label>
            <input class="input" name="project" placeholder="เช่น XR280E spare parts / Pump / Track bolts" />
          </div>

          <div class="row">
            <div class="field">
              <label>${biLabel("Requester (Required)", "ชื่อผู้ขอ (จำเป็น)")}</label>
              <input class="input" name="requester" required />
            </div>
            <div class="field">
              <label>${biLabel("Phone (Required)", "เบอร์โทร (จำเป็น)")}</label>
              <input class="input" name="phone" required />
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

          <div class="hr"></div>
          <div class="section-title">
            <h2 style="margin:0; font-size: 14px">Items</h2>
            <div class="row tight">
              <button class="btn btn-ghost" type="button" id="btnAddItem">+ เพิ่มรายการ</button>
            </div>
          </div>
          <div id="items"></div>

          <div class="row">
            <button class="btn btn-primary" type="submit">Submit & Generate QR</button>
            <button class="btn btn-ghost" type="button" id="btnCancel">Cancel</button>
          </div>

          <div class="pill">หลัง Submit: ระบบจะสร้าง QR + ไฟล์ PDF/Excel (ของจริง) และเก็บลง Drive อัตโนมัติ</div>
        
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
</form>
      </div>

      <div class="card">
        <div class="section-title">
          <h2 style="margin:0; font-size: 16px">Preview (เดโม)</h2>
          <div class="subtext">ดูว่าเวลาส่งแล้วจะหน้าตาประมาณไหน</div>
        </div>
        <div class="hr"></div>
        <div id="preview" class="subtext">กรอกข้อมูลแล้วกด Submit เพื่อสร้างเคส</div>
      </div>
    </div>
  `;

  
  // v9: keep NOTE textarea bottom aligned with FOR block
  setTimeout(()=>{ requestAnimationFrame(()=>{ balanceForNoteRow(); }); }, 0);
  window.addEventListener('resize', balanceForNoteRow);
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
        <button class="btn btn-danger btn-small" type="button" data-remove>ลบ</button>
      </div>
      <div class="row">
        <div class="field">
          <label>${biLabel("Name (Required)", "ชื่อสินค้า/อะไหล่ (จำเป็น)")}</label>
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
          <label>${biLabel("QTY (Required)", "จำนวน (จำเป็น)")}</label>
          <input class="input" name="qty" type="number" min="0" step="0.01" value="1" required />
        </div>
        <div class="field">
          <label>${biLabel("Unit (Required)", "หน่วย (จำเป็น)")}</label>
          <input class="input" name="unit" list="unitList" />
        </div>
      </div>

      <div class="row">
        <div class="field" style="flex:2">
          <label>${biLabel("Detail", "รายละเอียด/สเปก")}</label>
          <input class="input" name="detail" placeholder="สเปก/รายละเอียด เช่น Original/OEM, size, length..." />
        </div>
        <div class="field" style="flex:1">
          <label>${biLabel("Remark", "หมายเหตุย่อย")}</label>
          <input class="input" name="remark" placeholder="Export by sea / air plus..." />
        </div>
      </div>

      <div class="field">
        <label>${biLabel("Attach photos per item", "แนบรูปต่อรายการ")}</label>
        <input class="input" name="photos" type="file" accept="image/*" multiple />
        <div class="subtext">โปรโตไทป์: ยังไม่อัปโหลดจริง แค่โชว์ชื่อไฟล์</div>
        <div class="subtext" data-ph-list></div>
      </div>
    `;
    block.querySelector("[data-remove]").onclick = ()=>{
      block.remove();
      renumberItems();
    };
    const fileInput = block.querySelector('input[name="photos"]');
    const phList = block.querySelector("[data-ph-list]");
    fileInput.onchange = ()=>{
      const names = Array.from(fileInput.files||[]).map(f=>f.name);
      phList.textContent = names.length ? "แนบแล้ว: " + names.join(", ") : "";
    };
    itemsEl.appendChild(block);
  };

  const renumberItems = ()=>{
    Array.from(itemsEl.children).forEach((c, i)=>{
      const h3 = c.querySelector("h3");
      if(h3) h3.textContent = `Item #${i+1}`;
    });
  };

  $("#btnAddItem").onclick = addItem;

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

  $("#frmCreate").onsubmit = (e)=>{
    e.preventDefault();
    const form = e.target;

    const requester = form.requester.value.trim();
    const phone = form.phone.value.trim();
    if(!requester || !phone){
      toast("ต้องกรอกชื่อ + เบอร์ ก่อนส่ง");
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
      const unit = blk.querySelector('input[name="unit"]').value.trim();
      const detail = blk.querySelector('input[name="detail"]').value.trim();
      const remark = blk.querySelector('input[name="remark"]').value.trim();
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
    toast("สร้าง QR สำเร็จ: " + docNo);
  };
}

function renderCreatePR(el){
  setPageTitle("Request PR", "ขอเบิก/ขอซื้อ (PR) + แนบรูปต่อรายการ + ระบบออกเลข PR อัตโนมัติ");
  const today = new Date().toISOString().slice(0,10);

  el.innerHTML = `
    <div class="grid cols-2">
      <div class="card">
        <h2 style="margin:0 0 10px">Create Purchase Requisition (PR)</h2>
        <div class="subtext">* โปรโตไทป์นี้บันทึกลงเครื่อง (localStorage) เพื่อดูหน้าตา/โฟลว์</div>
        <div class="hr"></div>

        <form class="form" id="frmCreatePR">
          <div class="row">
            <div class="field">
              <label>${biLabel("Doc Date", "วันที่")}</label>
              <input class="input" name="docDate" type="date" value="${today}" />
            </div>
            <div class="field">
              <label>${biLabel("Subject / Project Name", "หัวข้อ / ชื่องาน")}</label>
              <select class="input" name="subject" required>
                <option value="">-- Select --</option>
                <option value="Petty cash">Petty cash</option>
                <option value="Work order">Work order</option>
              </select>
            </div>

            <div class="field">
              <label>${biLabel("For job", "ใช้กับงาน")}</label>
              <select class="input" name="forJob" required>
                <option value="">-- Select --</option>
                <option value="HDD">HDD</option>
                <option value="Rental">Rental</option>
                <option value="EXT-RP (งานนอก)">EXT-RP (งานนอก)</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div class="row">
            <div class="field">
              <label>${biLabel("Requester (Required)", "ชื่อผู้ขอ (จำเป็น)")}</label>
              <input class="input" name="requester" placeholder="ชื่อ-นามสกุล" required />
            </div>
            <div class="field">
              <label>${biLabel("Phone (Required)", "เบอร์โทร (จำเป็น)")}</label>
              <input class="input" name="phone" placeholder="0812345678" required />
            </div>
          </div>

          <div class="field">
            <label>${biLabel("Remark", "หมายเหตุเพิ่มเติม")}</label>
            <textarea name="remark" placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"></textarea>
          </div>

          <div class="hr"></div>
          <div class="section-title">
            <h2 style="margin:0; font-size: 14px">PR Items</h2>
            <div class="row tight">
              <button class="btn btn-ghost" type="button" id="btnAddPRItem">+ เพิ่มรายการ</button>
            </div>
          </div>
          <div id="prItems"></div>

          <div class="hr"></div>
          <div class="grid cols-3" style="gap:10px">
            <div class="field">
              <label>${biLabel("Prepared by (optional)", "ผู้จัดทำ (ไม่บังคับ)")}</label>
              <input class="input" name="preparedBy" placeholder="ชื่อผู้เตรียมเอกสาร" />
            </div>
            <div class="field">
              <label>${biLabel("Order by (optional)", "ผู้สั่งซื้อ (ไม่บังคับ)")}</label>
              <input class="input" name="orderedBy" placeholder="ชื่อผู้สั่งซื้อ" />
            </div>
            <div class="field">
              <label>${biLabel("Approve by (optional)", "ผู้อนุมัติ (ไม่บังคับ)")}</label>
              <input class="input" name="approvedBy" placeholder="ชื่อผู้อนุมัติ" />
            </div>
          </div>

          <div class="row">
            <button class="btn btn-primary" type="submit">Submit & Generate PR</button>
            <button class="btn btn-ghost" type="button" id="btnCancelPR">Cancel</button>
          </div>

          <div class="pill">เลขเอกสารจะรันเป็น <span class="mono">PRYY-MM.NNN</span> (ต่างจาก QR แค่ Prefix)</div>
        </form>
      </div>

      <div class="card">
        <div class="section-title">
          <h2 style="margin:0; font-size: 16px">Live Total (เดโม)</h2>
          <div class="subtext">รวมเงินจะคำนวณจาก QTY × Price/Unit</div>
        </div>
        <div class="hr"></div>
        <div class="kpi">
          <div>
            <div class="num" id="prGrandTotal">0.00</div>
            <div class="label">Grand Total (THB)</div>
          </div>
          <div class="chip">Auto</div>
        </div>
        <div class="hr"></div>
        <div id="prPreview" class="subtext">กรอกข้อมูลแล้วกด Submit เพื่อสร้างเคส PR</div>
      </div>
    </div>
  `;

  const itemsEl = $("#prItems");
  const fmt = (n)=> (Number(n||0)).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2});
  const calcTotal = ()=>{
    let sum = 0;
    Array.from(itemsEl.children).forEach(blk=>{
      const qty = Number(blk.querySelector('input[name="qty"]').value||0);
      const price = Number(blk.querySelector('input[name="price"]').value||0);
      sum += qty * price;
      const line = blk.querySelector("[data-line-total]");
      if(line) line.textContent = fmt(qty*price);
    });
    $("#prGrandTotal").textContent = fmt(sum);
  };

  const addItem = ()=>{
    const idx = itemsEl.children.length + 1;
    const block = document.createElement("div");
    block.className = "card";
    block.style.boxShadow = "none";
    block.style.marginBottom = "10px";
    block.innerHTML = `
      <div class="section-title">
        <h3 style="margin:0">Item #${idx}</h3>
        <button class="btn btn-danger btn-small" type="button" data-remove>ลบ</button>
      </div>

      <div class="row">
        <div class="field">
          <label>${biLabel("Code", "รหัส")}</label>
          <input class="input" name="code" placeholder="ถ้ามี" />
        </div>
        <div class="field" style="flex:2">
          <label>${biLabel("Detail (Required)", "รายละเอียด (จำเป็น)")}</label>
          <input class="input" name="detail" placeholder="เช่น DIESEL FOR TEST MACHINE" required />
        </div>
      </div>

      <div class="row">
        <div class="field">
          <label>${biLabel("QTY (Required)", "จำนวน (จำเป็น)")}</label>
          <input class="input" name="qty" type="number" min="0" step="0.01" value="1" required />
        </div>
        <div class="field">
          <label>${biLabel("Unit (Required)", "หน่วย (จำเป็น)")}</label>
          <select name="unit" required>
            <option value="">เลือก</option>
            <option>pcs</option>
            <option>set</option>
            <option>lot</option>
            <option>m</option>
            <option>box</option>
          </select>
        </div>
        <div class="field">
          <label>${biLabel("Price/Unit (THB)", "ราคา/หน่วย (บาท)")}</label>
          <input class="input" name="price" type="number" min="0" step="0.01" value="0" />
        </div>
        <div class="field">
          <label>${biLabel("Total", "รวม")}</label>
          <div class="input" style="background:#fff7ed80" data-line-total>0.00</div>
        </div>
      </div>

      <div class="field">
        <label>${biLabel("Attach photos per item", "แนบรูปต่อรายการ")}</label>
        <input class="input" name="photos" type="file" accept="image/*" multiple />
        <div class="subtext">โปรโตไทป์: ยังไม่อัปโหลดจริง แค่โชว์ชื่อไฟล์</div>
        <div class="subtext" data-ph-list></div>
      </div>
    `;
    block.querySelector("[data-remove]").onclick = ()=>{
      block.remove();
      renumber();
      calcTotal();
    };
    const fileInput = block.querySelector('input[name="photos"]');
    const phList = block.querySelector("[data-ph-list]");
    fileInput.onchange = ()=>{
      const names = Array.from(fileInput.files||[]).map(f=>f.name);
      phList.textContent = names.length ? "แนบแล้ว: " + names.join(", ") : "";
    };

    ["qty","price"].forEach(k=>{
      block.querySelector(`input[name="${k}"]`).addEventListener("input", calcTotal);
    });

    itemsEl.appendChild(block);
    calcTotal();
  };

  const renumber = ()=>{
    Array.from(itemsEl.children).forEach((c, i)=>{
      const h3 = c.querySelector("h3");
      if(h3) h3.textContent = `Item #${i+1}`;
    });
  };

  $("#btnAddPRItem").onclick = addItem;
  $("#btnCancelPR").onclick = ()=> location.hash = "#/home";

  addItem();

  $("#frmCreatePR").onsubmit = (e)=>{
    e.preventDefault();
    const form = e.target;

    const requester = form.requester.value.trim();
    const phone = form.phone.value.trim();
    if(!requester || !phone){
      toast("ต้องกรอกชื่อ + เบอร์ ก่อนส่ง");
      return;
    }

    const itemBlocks = Array.from(itemsEl.children);
    if(!itemBlocks.length){
      toast("ต้องมีอย่างน้อย 1 รายการ");
      return;
    }

    let items = [];
    try{
      items = itemBlocks.map((blk, idx)=>{
        const code = blk.querySelector('input[name="code"]').value.trim();
        const detail = blk.querySelector('input[name="detail"]').value.trim();
        const qty = Number(blk.querySelector('input[name="qty"]').value||0);
        const unit = blk.querySelector('select[name="unit"]').value.trim();
        const price = Number(blk.querySelector('input[name="price"]').value||0);
        const photos = Array.from(blk.querySelector('input[name="photos"]').files || []).map(f=>f.name);

        if(!detail || !(qty>0) || !unit) throw new Error(`รายการที่ ${idx+1} ต้องมี Detail, QTY>0 และ Unit`);
        return { lineNo: idx+1, code, detail, qty, unit, price, total: qty*price, photos: photos.map(n=>({name:n, addedAt: nowISO()})) };
      });
    }catch(err){
      toast(err.message);
      return;
    }

    const docDate = form.docDate.value;
    const docNo = newDocNo("PR", docDate);
    const db = loadDB();

    const prObj = {
      kind: "PR",
      id: nanoid(12),
      docNo,
      docDate,
      subject: form.subject.value.trim(),
      forJob: form.forJob.value.trim(),
      requester,
      phone,
      remark: form.remark.value.trim(),
      status: "Submitted",
      editToken: nanoid(24),
      createdAt: nowISO(),
      updatedAt: nowISO(),
      items,
      approvals: {
        preparedBy: form.preparedBy.value.trim(),
        orderedBy: form.orderedBy.value.trim(),
        approvedBy: form.approvedBy.value.trim()
      },
      files: { receipts: [] },
      activity: [{ at: nowISO(), actor: `${requester} (${phone})`, action:"SUBMIT", detail:"" }]
    };

    db.pr = db.pr || [];
    db.pr.unshift(prObj);
    saveDB(db);

    $("#prPreview").innerHTML = `
      <div class="pill">สร้าง PR สำเร็จ: <b class="mono">${docNo}</b></div>
      <div class="hr"></div>
      <div><b>Subject:</b> ${escapeHtml(prObj.subject||"-")}</div>
      <div><b>Requester:</b> ${escapeHtml(prObj.requester)} (${escapeHtml(prObj.phone)})</div>
      <div><b>Items:</b> ${prObj.items.length}</div>
      <div><b>Total:</b> ${fmt(prObj.items.reduce((s,it)=>s+it.total,0))}</div>
      <div class="hr"></div>
      <button class="btn btn-primary" id="btnGoPRDetail">เปิดเคสนี้</button>
    `;
    $("#btnGoPRDetail").onclick = ()=> location.hash = `#/detail/${encodeURIComponent(docNo)}`;
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
 
