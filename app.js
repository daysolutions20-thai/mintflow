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
    label .lb-th{ display:block; font-size:12px; font-weight:300; opacity:.72; margin-top:3px; line-height:1.15; }

    /* mintflow-patch: form spacing + checkbox rows */
    .field{ gap:0; }
    .field > label{ display:block; margin:0 0 12px; }
    .row{ align-items:flex-start; }
    .for-list{ display:flex; flex-direction:column; gap:10px; margin-top:2px; }
    .chk{ display:flex; align-items:center; gap:10px; font-weight:500; }
    .chk input{ width:16px; height:16px; }
    .chkline{ display:flex; align-items:center; gap:12px; }
    .chkline .input{ flex:1; min-width:220px; }
    .checks-inline{ display:flex; flex-wrap:wrap; gap:14px; margin-top:2px; }
    .checks-inline .chk{ font-weight:400; }
    .for-note-row{ align-items:stretch; }
    .for-note-row textarea{ min-height:96px; height:100%; resize:vertical; }
    

  `;
  const style = document.createElement("style");
  style.setAttribute("data-mintflow", "bilingual-labels");
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
            <div class="ico"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c3 0 5 2 5 5v1l2-1v4c0 5-3 9-7 9s-7-4-7-9V7l2 1V7c0-3 2-5 5-5z"/><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M9 16c1 .8 2 .8 3 .8s2 0 3-.8"/></svg></div>
            <div>
              <div class="t-title">นโยบายกันลำไย</div>
              <div class="t-sub">“ไม่อยู่ในระบบ = ยังไม่ส่ง”</div>
            </div>
          </div>
          <button class="btn btn-ghost" id="goSummaryQR2">Summary QR</button>
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
  $("#goSummaryQR2").onclick = () => location.hash = "#/summary-qr";
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
        <h2 style="margin:0 0 10px">Create Quotation Request (QR)</h2>
        <div class="subtext">* โปรโตไทป์นี้จะบันทึกลงเครื่อง (localStorage) เพื่อดูหน้าตาระบบ</div>
        <div class="hr"></div>

        <form class="form" id="frmCreate">
          <div class="row">
            <div class="field">
              <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Doc Date", "วันที่")}</label>
              <input class="input" name="docDate" type="date" value="${today}" />
            </div>
            <div class="field">
              <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Urgency", "ความเร่งด่วน")}</label>
              <select name="urgency">
                <option>Normal</option>
                <option>Urgent</option>
                <option>Very Urgent</option>
              </select>
            </div>
          </div>

          <div class="field">
            <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Project / Subject", "โครงการ / หัวข้อ")}</label>
            <input class="input" name="project" />
          </div>

          <div class="row">
            <div class="field">
              <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Requester (Required)", "ชื่อผู้ขอ (จำเป็น)")}</label>
              <input class="input" name="requester" required />
            </div>
            <div class="field">
              <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Phone (Required)", "เบอร์โทร (จำเป็น)")}</label>
              <input class="input" name="phone" required />
            </div>
          </div>

          <div class="row for-note-row">
            <div class="field" style="flex:1">
              <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("FOR", "สำหรับ")}</label>

              <div class="for-list">
                <label class="chk">
                  <input type="checkbox" name="forStock" />
                  <span>Stock</span>
                </label>

                <div class="chkline">
                  <label class="chk" style="margin:0">
                    <input type="checkbox" name="forRepair" />
                    <span>Repair</span>
                  </label>
                  <input class="input" name="forRepairDetail" placeholder="For Sale / For Customer" disabled />
                </div>

                <div class="chkline">
                  <label class="chk" style="margin:0">
                    <input type="checkbox" name="forSale" />
                    <span>Sale</span>
                  </label>
                  <input class="input" name="forSaleCustomer" placeholder="Name Customer" disabled />
                </div>
              </div>
            </div>

            <div class="field" style="flex:1">
              <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Note", "หมายเหตุเพิ่มเติม")}</label>
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
        </form>
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
          <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Name (Required)", "ชื่อสินค้า/อะไหล่ (จำเป็น)")}</label>
          <input class="input" name="item_name" placeholder="ชื่ออะไหล่/สินค้า" required />
        </div>
        <div class="field">
          <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Model", "รุ่น")}</label>
          <input class="input" name="item_model" placeholder="XR280E / XR320E ..." />
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Code", "รหัสสินค้า")}</label>
          <input class="input" name="item_code" placeholder="ถ้ามี" />
        </div>
        <div class="field">
          <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("QTY (Required)", "จำนวน (จำเป็น)")}</label>
          <input class="input" name="qty" type="number" min="0" step="0.01" value="1" required />
        </div>
        <div class="field">
          <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Unit", "หน่วย")}</label>
          <input class="input" name="unit" list="unitList" />
        </div>
      </div>

      <div class="row">
        <div class="field" style="flex:2">
          <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Detail", "รายละเอียด/สเปก")}</label>
          <input class="input" name="detail" />
        </div>
      </div>

      <div class="row">
        <div class="field" style="flex:1.35">
          <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Export By.", "ส่งออกทาง")}</label>
          <div class="checks-inline">
            <label class="chk"><input type="checkbox" class="exportBy" value="By Sea" /> <span>By Sea</span></label>
            <label class="chk"><input type="checkbox" class="exportBy" value="By Land" /> <span>By Land</span></label>
            <label class="chk"><input type="checkbox" class="exportBy" value="By Air" /> <span>By Air</span></label>
          </div>
        </div>
        <div class="field" style="flex:1.65">
          <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Remark", "หมายเหตุย่อย")}</label>
          <input class="input" name="remark" />
        </div>
      </div>

      <div class="field">
        <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Attach photos per item", "แนบรูปต่อรายการ")}</label>
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
  $("#btnCancel").onclick = ()=> location.hash = "#/home";

  addItem();


  // Unit list (datalist) — allows custom values too
  if(!document.getElementById("unitList")){
    const dl = document.createElement("datalist");
    dl.id = "unitList";
    dl.innerHTML = `
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
    `;
    document.body.appendChild(dl);
  }

  // FOR checkboxes logic
  const frm = $("#frmCreate");
  const cbRepair = frm.querySelector('[name="forRepair"]');
  const cbSale   = frm.querySelector('[name="forSale"]');
  const inRepair = frm.querySelector('[name="forRepairDetail"]');
  const inSale   = frm.querySelector('[name="forSaleCustomer"]');

  const syncFOR = ()=>{
    if(inRepair){
      inRepair.disabled = !(cbRepair && cbRepair.checked);
      if(inRepair.disabled) inRepair.value = "";
    }
    if(inSale){
      inSale.disabled = !(cbSale && cbSale.checked);
      if(inSale.disabled) inSale.value = "";
    }
  };
  if(cbRepair) cbRepair.addEventListener("change", syncFOR);
  if(cbSale) cbSale.addEventListener("change", syncFOR);
  syncFOR();


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

      if(!name || !(qty > 0) || !unit){
        throw new Error(`รายการที่ ${idx+1} ต้องมี Name, QTY>0 และ Unit`);
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
      urgency: form.urgency.value,
      note: form.note.value.trim(),
      forStock,
      forRepair,
      forSale,
      forRepairDetail,
      forSaleCustomer,
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
              <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Doc Date", "วันที่")}</label>
              <input class="input" name="docDate" type="date" value="${today}" />
            </div>
            <div class="field">
              <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Subject / Project Name", "หัวข้อ / ชื่องาน")}</label>
              <select class="input" name="subject" required>
                <option value="">-- Select --</option>
                <option value="Petty cash">Petty cash</option>
                <option value="Work order">Work order</option>
              </select>
            </div>

            <div class="field">
              <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("For job", "ใช้กับงาน")}</label>
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
              <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Requester (Required)", "ชื่อผู้ขอ (จำเป็น)")}</label>
              <input class="input" name="requester" placeholder="ชื่อ-นามสกุล" required />
            </div>
            <div class="field">
              <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Phone (Required)", "เบอร์โทร (จำเป็น)")}</label>
              <input class="input" name="phone" placeholder="0812345678" required />
            </div>
          </div>

          <div class="field">
            <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Remark", "หมายเหตุเพิ่มเติม")}</label>
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
              <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Prepared by (optional)", "ผู้จัดทำ (ไม่บังคับ)")}</label>
              <input class="input" name="preparedBy" placeholder="ชื่อผู้เตรียมเอกสาร" />
            </div>
            <div class="field">
              <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Order by (optional)", "ผู้สั่งซื้อ (ไม่บังคับ)")}</label>
              <input class="input" name="orderedBy" placeholder="ชื่อผู้สั่งซื้อ" />
            </div>
            <div class="field">
              <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Approve by (optional)", "ผู้อนุมัติ (ไม่บังคับ)")}</label>
              <input class="input" name="approvedBy" placeholder="ชื่อผู้อนุมัติ" />
            </div>
          </div>

          <div class="row">
            <button class="btn btn-primary" type="submit">Submit & Generate PR</button>
            <button class="btn btn-ghost" type="button" id="btnCancelPR">Cancel</button>
          </div>

          <div class="pill">เลขเอกสารจะรันเป็น <span class="mono">PRYY-MM.NNN</span> (ต่างจาก QR แค่ Prefix)</div>
        </form>
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
          <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Code", "รหัส")}</label>
          <input class="input" name="code" />
        </div>
        <div class="field" style="flex:2">
          <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Detail (Required)", "รายละเอียด (จำเป็น)")}</label>
          <input class="input" name="detail" required />
        </div>
      </div>

      <div class="row">
        <div class="field">
          <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("QTY (Required)", "จำนวน (จำเป็น)")}</label>
          <input class="input" name="qty" type="number" min="0" step="0.01" value="1" required />
        </div>
        <div class="field">
          <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Unit", "หน่วย")}</label>
          <input class="input" name="unit" list="unitList" />
        </div>
        <div class="field">
          <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Price/Unit (THB)", "ราคา/หน่วย (บาท)")}</label>
          <input class="input" name="price" type="number" min="0" step="0.01" value="0" />
        </div>
        <div class="field">
          <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Total", "รวม")}</label>
          <div class="input" style="background:#fff7ed80" data-line-total>0.00</div>
        </div>
      </div>

      <div class="field">
        <label style="display:block;margin:0 0 8px;line-height:1.15;">${biLabel("Attach photos per item", "แนบรูปต่อรายการ")}</label>
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


  // Unit list (datalist) — allows custom values too
  if(!document.getElementById("unitList")){
    const dl = document.createElement("datalist");
    dl.id = "unitList";
    dl.innerHTML = `
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
    `;
    document.body.appendChild(dl);
  }


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
        const unit = blk.querySelector('input[name="unit"]').value.trim();
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
 
