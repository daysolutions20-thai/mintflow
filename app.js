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

          <div class="pill">หลัง Submit: ระบบจะสร้าง QR + ไฟล์ PDF/Excel (ของจริง) และเก็บลง Drive อัตโนมัติ</div>
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
      <div class="row row-export-attach">
        <div class="field">
          <label>${biLabel("Export By :", "การส่งออกทาง")}</label>
          <div class="exportByRow">
            <label class="chkLine" ><input type="checkbox" name="exportSea" /> <span>By Sea</span></label>
            <label class="chkLine" ><input type="checkbox" name="exportLand" /> <span>By Land</span></label>
            <label class="chkLine" ><input type="checkbox" name="exportAir" /> <span>By Air</span></label>
          </div>
        </div>

        <div class="field">
          <label>${biLabel("Attach photos", "แนบรูปต่อรายการ")}</label>
          <input class="input" name="photos" type="file" accept="image/*" multiple />
          <div class="subtext" data-ph-list></div>

          <div class="row tight itemControls">
            <button class="btn btn-danger btn-small" type="button" data-action="delItem">ลบ</button>
            <button class="btn btn-ghost" type="button" data-action="addItem">+ เพิ่มรายการ</button>
          </div>

          
        </div>
      </div>
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
            ${line("Phone", phone)}
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
