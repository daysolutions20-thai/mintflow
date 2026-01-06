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
  const count = (db._seq?.[prefix]?.[key] ?? 0) + 1;
  db._seq = db._seq || {};
  db._seq[prefix] = db._seq[prefix] || {};
  db._seq[prefix][key] = count;
  saveDB(db);
  return `${prefix}-${yy}${mm}-${pad3(count)}`;
}

function loadDB(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return { qrs:[], prs:[], _seq:{} };
    const db = JSON.parse(raw);
    db.qrs = db.qrs || [];
    db.prs = db.prs || [];
    db._seq = db._seq || {};
    return db;
  }catch(e){
    console.warn("LS load failed", e);
    return { qrs:[], prs:[], _seq:{} };
  }
}
function saveDB(db){
  localStorage.setItem(LS_KEY, JSON.stringify(db));
}

function getAdmin(){
  try{ return localStorage.getItem(LS_ADMIN) === "1"; }
  catch(e){ return false; }
}
function setAdmin(v){
  localStorage.setItem(LS_ADMIN, v ? "1" : "0");
}

function fmtDate(d){
  if(!d) return "";
  try{
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth()+1).padStart(2,"0");
    const da = String(dt.getDate()).padStart(2,"0");
    return `${y}-${m}-${da}`;
  }catch(e){ return d; }
}

function escapeHTML(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

/* ---------- Routing ---------- */
function setRoute(route, params={}){
  const qs = new URLSearchParams(params).toString();
  location.hash = qs ? `#${route}?${qs}` : `#${route}`;
}
function parseHash(){
  const h = (location.hash || "#home").slice(1);
  const [path, qs] = h.split("?");
  const params = Object.fromEntries(new URLSearchParams(qs || ""));
  return { path: path || "home", params };
}

function render(){
  const {path, params} = parseHash();

  // highlight nav
  $$(".nav-item").forEach(a=>{
    a.classList.toggle("active", a.dataset.route === path);
  });

  // pages container
  $$(".page").forEach(p=> p.hidden = true);

  const page = $(`.page[data-page="${path}"]`);
  if(!page){
    const fallback = $(`.page[data-page="home"]`);
    if(fallback) fallback.hidden = false;
    return;
  }
  page.hidden = false;

  // per-page render
  if(path === "home") renderHome();
  if(path === "request-qr") renderRequest("qr");
  if(path === "summary-qr") renderSummary("qr");
  if(path === "request-pr") renderRequest("pr");
  if(path === "summary-pr") renderSummary("pr");
  if(path === "detail") renderDetail(params.type, params.id);
  if(path === "help") renderHelp();
}

/* ---------- Helpers / UI ---------- */

function toast(msg){
  const t = $(".toast");
  if(!t) return alert(msg);
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=> t.classList.remove("show"), 1800);
}

/* bilingual label helper — use ONLY for <label> on form fields (NOT sidebar/nav) */
function biLabel(en, th){
  return `
    <div class="bi-label">
      <div class="bi-en">${escapeHTML(en)}</div>
      <div class="bi-th">${escapeHTML(th)}</div>
    </div>
  `;
}

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

/* ---------- Home ---------- */

function renderHome(){
  const db = loadDB();
  const qrCount = db.qrs.length;
  const prCount = db.prs.length;

  const el = $(".home-stats");
  if(el){
    el.innerHTML = `
      <div class="stat">
        <div class="stat-num">${qrCount}</div>
        <div class="stat-label">QR docs</div>
      </div>
      <div class="stat">
        <div class="stat-num">${prCount}</div>
        <div class="stat-label">PR docs</div>
      </div>
    `;
  }
}

/* ---------- Request (Create) ---------- */

function blankDoc(type){
  const prefix = type === "qr" ? "QR" : "PR";
  const today = fmtDate(new Date());
  return {
    id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2),
    type,
    docNo: newDocNo(prefix, today),
    docDate: today,
    project: "",
    requester: "",
    phone: "",
    dept: "",
    note: "",
    items: [
      { name:"", model:"", code:"", detail:"", qty:1, unit:"", remark:"" }
    ],
    createdAt: nowISO(),
    updatedAt: nowISO(),
    status: "draft"
  };
}

function getListByType(db, type){
  return type === "qr" ? db.qrs : db.prs;
}
function setListByType(db, type, list){
  if(type === "qr") db.qrs = list;
  else db.prs = list;
}

function renderRequest(type){
  const page = $(`.page[data-page="request-${type}"]`);
  if(!page) return;

  // Always create a fresh blank doc in UI (MVP)
  const doc = blankDoc(type);
  page.dataset.draftId = doc.id;
  page._draftDoc = doc;

  // Fill header info
  const hDocNo = page.querySelector(".docno");
  if(hDocNo) hDocNo.textContent = doc.docNo;

  // Form labels bilingual ONLY here (not sidebar)
  // Header fields
  const labelDocDate = page.querySelector('label[for="docDate"]');
  if(labelDocDate) labelDocDate.innerHTML = biLabel("Doc Date", "วันที่");

  const labelProject = page.querySelector('label[for="project"]');
  if(labelProject) labelProject.innerHTML = biLabel("Project", "โปรเจกต์");

  const labelRequester = page.querySelector('label[for="requester"]');
  if(labelRequester) labelRequester.innerHTML = biLabel("Requester", "ผู้ขอ");

  const labelPhone = page.querySelector('label[for="phone"]');
  if(labelPhone) labelPhone.innerHTML = biLabel("Phone", "เบอร์โทร");

  const labelDept = page.querySelector('label[for="dept"]');
  if(labelDept) labelDept.innerHTML = biLabel("Department", "แผนก");

  const labelNote = page.querySelector('label[for="note"]');
  if(labelNote) labelNote.innerHTML = biLabel("Note", "หมายเหตุ");

  // items table labels (if exist as headers)
  const thName = page.querySelector('[data-th="name"]');
  if(thName) thName.innerHTML = biLabel("Item name", "ชื่อรายการ");

  const thModel = page.querySelector('[data-th="model"]');
  if(thModel) thModel.innerHTML = biLabel("Model", "รุ่น");

  const thCode = page.querySelector('[data-th="code"]');
  if(thCode) thCode.innerHTML = biLabel("Code", "รหัส");

  const thDetail = page.querySelector('[data-th="detail"]');
  if(thDetail) thDetail.innerHTML = biLabel("Detail", "รายละเอียด");

  const thQty = page.querySelector('[data-th="qty"]');
  if(thQty) thQty.innerHTML = biLabel("Qty", "จำนวน");

  const thUnit = page.querySelector('[data-th="unit"]');
  if(thUnit) thUnit.innerHTML = biLabel("Unit", "หน่วย");

  const thRemark = page.querySelector('[data-th="remark"]');
  if(thRemark) thRemark.innerHTML = biLabel("Remark", "หมายเหตุ");

  // Fill inputs
  page.querySelector("#docDate").value = doc.docDate;
  page.querySelector("#project").value = doc.project;
  page.querySelector("#requester").value = doc.requester;
  page.querySelector("#phone").value = doc.phone;
  page.querySelector("#dept").value = doc.dept;
  page.querySelector("#note").value = doc.note;

  renderItemsTable(page, doc);

  // Buttons
  const btnAdd = page.querySelector(".btn-add-item");
  const btnSave = page.querySelector(".btn-save");
  const btnSubmit = page.querySelector(".btn-submit");
  const btnReset = page.querySelector(".btn-reset");

  if(btnAdd) btnAdd.onclick = ()=>{
    doc.items.push({ name:"", model:"", code:"", detail:"", qty:1, unit:"", remark:"" });
    doc.updatedAt = nowISO();
    renderItemsTable(page, doc);
  };

  if(btnReset) btnReset.onclick = ()=>{
    const fresh = blankDoc(type);
    page.dataset.draftId = fresh.id;
    page._draftDoc = fresh;
    renderRequest(type);
    toast("Reset form");
  };

  const collect = ()=>{
    doc.docDate = page.querySelector("#docDate").value;
    doc.project = page.querySelector("#project").value.trim();
    doc.requester = page.querySelector("#requester").value.trim();
    doc.phone = page.querySelector("#phone").value.trim();
    doc.dept = page.querySelector("#dept").value.trim();
    doc.note = page.querySelector("#note").value.trim();
    doc.updatedAt = nowISO();
  };

  if(btnSave) btnSave.onclick = ()=>{
    collect();
    doc.status = "draft";
    persistDoc(doc);
    toast("Saved (draft)");
  };

  if(btnSubmit) btnSubmit.onclick = ()=>{
    collect();
    doc.status = "submitted";
    persistDoc(doc);
    toast("Submitted");
    // go summary
    setRoute(`summary-${type}`);
  };
}

function renderItemsTable(page, doc){
  const tbody = page.querySelector("tbody.items");
  if(!tbody) return;
  tbody.innerHTML = "";

  doc.items.forEach((it, idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input class="it-name"  value="${escapeHTML(it.name)}"  placeholder=""/></td>
      <td><input class="it-model" value="${escapeHTML(it.model)}" placeholder=""/></td>
      <td><input class="it-code"  value="${escapeHTML(it.code)}"  placeholder=""/></td>
      <td><textarea class="it-detail" rows="1" placeholder="">${escapeHTML(it.detail)}</textarea></td>
      <td><input class="it-qty" type="number" min="1" value="${escapeHTML(it.qty)}"/></td>
      <td><input class="it-unit"  value="${escapeHTML(it.unit)}"  placeholder=""/></td>
      <td><input class="it-remark" value="${escapeHTML(it.remark)}" placeholder=""/></td>
      <td class="cell-actions">
        <button class="btn-mini btn-del" title="Delete">✕</button>
      </td>
    `;

    // bind change
    tr.querySelector(".it-name").oninput = e=>{ it.name = e.target.value; doc.updatedAt = nowISO(); };
    tr.querySelector(".it-model").oninput = e=>{ it.model = e.target.value; doc.updatedAt = nowISO(); };
    tr.querySelector(".it-code").oninput = e=>{ it.code = e.target.value; doc.updatedAt = nowISO(); };
    tr.querySelector(".it-detail").oninput = e=>{ it.detail = e.target.value; doc.updatedAt = nowISO(); };
    tr.querySelector(".it-qty").oninput = e=>{ it.qty = Number(e.target.value || 1); doc.updatedAt = nowISO(); };
    tr.querySelector(".it-unit").oninput = e=>{ it.unit = e.target.value; doc.updatedAt = nowISO(); };
    tr.querySelector(".it-remark").oninput = e=>{ it.remark = e.target.value; doc.updatedAt = nowISO(); };

    tr.querySelector(".btn-del").onclick = ()=>{
      doc.items.splice(idx, 1);
      if(doc.items.length === 0){
        doc.items.push({ name:"", model:"", code:"", detail:"", qty:1, unit:"", remark:"" });
      }
      doc.updatedAt = nowISO();
      renderItemsTable(page, doc);
    };

    tbody.appendChild(tr);
  });
}

function persistDoc(doc){
  const db = loadDB();
  const list = getListByType(db, doc.type);
  const i = list.findIndex(x=> x.id === doc.id);
  if(i >= 0) list[i] = doc;
  else list.unshift(doc);
  setListByType(db, doc.type, list);
  saveDB(db);
}

/* ---------- Summary ---------- */

function renderSummary(type){
  const page = $(`.page[data-page="summary-${type}"]`);
  if(!page) return;

  const db = loadDB();
  const list = getListByType(db, type);

  const q = page.querySelector(".summary-search")?.value?.trim().toLowerCase() ?? "";
  const filtered = q ? list.filter(doc => docMatches(doc, q)) : list;

  const tbody = page.querySelector("tbody.summary");
  if(!tbody) return;

  tbody.innerHTML = "";

  filtered.forEach(doc=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${escapeHTML(doc.docNo)}</td>
      <td>${escapeHTML(doc.project)}</td>
      <td>${escapeHTML(doc.requester)}</td>
      <td class="mono">${escapeHTML(doc.phone)}</td>
      <td>${escapeHTML(doc.status)}</td>
      <td class="mono">${escapeHTML(fmtDate(doc.docDate))}</td>
      <td class="cell-actions">
        <button class="btn-mini btn-view">View</button>
        ${getAdmin() ? `<button class="btn-mini btn-del">Delete</button>` : ``}
      </td>
    `;
    tr.querySelector(".btn-view").onclick = ()=>{
      setRoute("detail", { type: doc.type, id: doc.id });
    };
    if(getAdmin()){
      const btnDel = tr.querySelector(".btn-del");
      if(btnDel) btnDel.onclick = ()=>{
        if(confirm("Delete this document?")){
          deleteDoc(type, doc.id);
          renderSummary(type);
        }
      };
    }
    tbody.appendChild(tr);
  });

  // show count
  const countEl = page.querySelector(".summary-count");
  if(countEl) countEl.textContent = `${filtered.length} / ${list.length}`;
}

function docMatches(doc, q){
  const bag = [
    doc.docNo, doc.project, doc.requester, doc.phone, doc.dept, doc.note,
    ...(doc.items||[]).flatMap(it => [it.name, it.model, it.code, it.detail, it.remark, it.unit])
  ].join(" ").toLowerCase();
  return bag.includes(q);
}

function deleteDoc(type, id){
  const db = loadDB();
  const list = getListByType(db, type);
  const next = list.filter(x=> x.id !== id);
  setListByType(db, type, next);
  saveDB(db);
}

/* ---------- Detail ---------- */

function renderDetail(type, id){
  const page = $(`.page[data-page="detail"]`);
  if(!page) return;

  const db = loadDB();
  const list = getListByType(db, type);
  const doc = list.find(x=> x.id === id);
  if(!doc){
    page.querySelector(".detail-wrap").innerHTML = `<div class="empty">Not found</div>`;
    return;
  }

  page.querySelector(".detail-title").textContent = `${doc.docNo} (${doc.type.toUpperCase()})`;

  const itemsHTML = (doc.items||[]).map((it, idx)=>`
    <tr>
      <td>${idx+1}</td>
      <td>${escapeHTML(it.name)}</td>
      <td>${escapeHTML(it.model)}</td>
      <td>${escapeHTML(it.code)}</td>
      <td>${escapeHTML(it.detail)}</td>
      <td class="mono">${escapeHTML(it.qty)}</td>
      <td>${escapeHTML(it.unit)}</td>
      <td>${escapeHTML(it.remark)}</td>
    </tr>
  `).join("");

  page.querySelector(".detail-wrap").innerHTML = `
    <div class="card">
      <div class="grid2">
        <div><div class="k">Doc No</div><div class="v mono">${escapeHTML(doc.docNo)}</div></div>
        <div><div class="k">Doc Date</div><div class="v mono">${escapeHTML(fmtDate(doc.docDate))}</div></div>
        <div><div class="k">Project</div><div class="v">${escapeHTML(doc.project)}</div></div>
        <div><div class="k">Requester</div><div class="v">${escapeHTML(doc.requester)}</div></div>
        <div><div class="k">Phone</div><div class="v mono">${escapeHTML(doc.phone)}</div></div>
        <div><div class="k">Department</div><div class="v">${escapeHTML(doc.dept)}</div></div>
        <div class="span2"><div class="k">Note</div><div class="v">${escapeHTML(doc.note)}</div></div>
        <div><div class="k">Status</div><div class="v">${escapeHTML(doc.status)}</div></div>
        <div><div class="k">Updated</div><div class="v mono">${escapeHTML(doc.updatedAt)}</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-h">Items</div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>#</th><th>Name</th><th>Model</th><th>Code</th><th>Detail</th><th>Qty</th><th>Unit</th><th>Remark</th>
            </tr>
          </thead>
          <tbody>${itemsHTML || `<tr><td colspan="8" class="empty">No items</td></tr>`}</tbody>
        </table>
      </div>
    </div>

    <div class="detail-actions">
      <button class="btn" data-back>Back</button>
      <button class="btn" data-dup>Duplicate</button>
      ${getAdmin() ? `<button class="btn danger" data-del>Delete</button>` : ``}
    </div>
  `;

  page.querySelector("[data-back]").onclick = ()=>{
    // go back to summary based on type
    setRoute(type === "qr" ? "summary-qr" : "summary-pr");
  };

  page.querySelector("[data-dup]").onclick = ()=>{
    const clone = JSON.parse(JSON.stringify(doc));
    clone.id = crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
    clone.docNo = newDocNo(doc.type === "qr" ? "QR" : "PR", fmtDate(new Date()));
    clone.status = "draft";
    clone.createdAt = nowISO();
    clone.updatedAt = nowISO();
    persistDoc(clone);
    toast("Duplicated");
    setRoute("detail", { type: clone.type, id: clone.id });
  };

  if(getAdmin()){
    const delBtn = page.querySelector("[data-del]");
    if(delBtn) delBtn.onclick = ()=>{
      if(confirm("Delete this document?")){
        deleteDoc(type, id);
        toast("Deleted");
        setRoute(type === "qr" ? "summary-qr" : "summary-pr");
      }
    };
  }
}

/* ---------- Help ---------- */

function renderHelp(){
  const page = $(`.page[data-page="help"]`);
  if(!page) return;
  const admin = getAdmin();
  const box = page.querySelector(".help-admin");
  if(box){
    box.innerHTML = `
      <div class="row">
        <label class="switch">
          <input type="checkbox" ${admin ? "checked" : ""} class="toggle-admin" />
          <span class="slider"></span>
        </label>
        <div class="help-txt">
          <div class="help-h">Admin mode (prototype)</div>
          <div class="help-d">Enable delete buttons in summary & detail.</div>
        </div>
      </div>
    `;
    box.querySelector(".toggle-admin").onchange = (e)=>{
      setAdmin(e.target.checked);
      toast(e.target.checked ? "Admin ON" : "Admin OFF");
      // rerender current view
      render();
    };
  }
}

/* ---------- Bindings ---------- */

function bindGlobal(){
  normalizeSidebarNavLabels();

  // sidebar nav
  $$(".nav-item").forEach(a=>{
    a.onclick = (e)=>{
      e.preventDefault();
      setRoute(a.dataset.route);
      // auto close on mobile if exists
      const sb = $(".sidebar");
      if(sb) sb.classList.remove("open");
    };
  });

  // hamburger
  const ham = $(".toggleSidebar");
  if(ham) ham.onclick = ()=>{
    const sb = $(".sidebar");
    if(sb) sb.classList.toggle("open");
  };

  // summary search (both)
  $$(".summary-search").forEach(inp=>{
    inp.oninput = ()=>{
      const {path} = parseHash();
      if(path === "summary-qr") renderSummary("qr");
      if(path === "summary-pr") renderSummary("pr");
    };
  });

  // hashchange
  window.addEventListener("hashchange", render);

  // initial route
  if(!location.hash) setRoute("home");
  else render();
}

document.addEventListener("DOMContentLoaded", ()=>{
  bindGlobal();
});
