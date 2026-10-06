// ---------- Data (hard-coded: simple, no server needed) ----------
const PRODUCTS = [
  {id:1,name:"Rice Meal",price:60,icon:"🍚"},
  {id:2,name:"Fried Chicken",price:55,icon:"🍗"},
  {id:3,name:"Burger",price:40,icon:"🍔"},
  {id:4,name:"Pancit",price:35,icon:"🍜"},
  {id:5,name:"Siopao",price:25,icon:"🥟"},
  {id:6,name:"Iced Tea",price:20,icon:"🧃"}
];
const MAX_QTY = 99;
const STEPS = ["Select items","Review","Pay","Done","Receipt"];
const SCREEN_STEP = {select:0,summary:1,method:2,cash:2,qr:2,card:2,success:3,receipt:4};

// ---------- State ----------
let cart = {};      // {productId: qty}
let method = null;
let last = null;    // completed transaction snapshot
let busy = false;

const $ = s => document.querySelector(s);
const peso = n => "₱" + n.toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
const lines = () => PRODUCTS.filter(p => cart[p.id]).map(p => ({...p, qty:cart[p.id], sub:p.price*cart[p.id]}));
const total = () => lines().reduce((s,l) => s + l.sub, 0);

// ---------- UI helpers ----------
let tt;
function toast(msg, err){
  const t = $("#toast"); t.textContent = msg; t.className = "show" + (err ? " err" : "");
  clearTimeout(tt); tt = setTimeout(() => t.className = "", 2200);
}
function go(name){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $("#s-"+name).classList.add("active");
  $("#steps").innerHTML = STEPS.map((s,i) => `<span class="${i===SCREEN_STEP[name]?"on":""}">${s}</span>`).join("");
  document.querySelectorAll(".t-total").forEach(e => e.textContent = peso(total()));
  window.scrollTo(0,0);
}

// ---------- Item selection & cart ----------
function renderProducts(){
  $("#products").innerHTML = PRODUCTS.map(p => `
    <button class="item" data-add="${p.id}" aria-label="Add ${p.name}, ${peso(p.price)}">
      ${cart[p.id] ? `<span class="badge">${cart[p.id]}</span>` : ""}
      <span class="em">${p.icon}</span><span class="nm">${p.name}</span><span class="pr">${peso(p.price)}</span>
    </button>`).join("");
}
function cartTable(editable){
  const L = lines();
  if(!L.length) return `<p class="empty">No items yet. Tap a product to add it.</p>`;
  if(editable) return `<div class="cart">${L.map(l => `<div class="crow"><div class="cname"><b>${l.name}</b><small>${peso(l.price)} each</small></div>
      <span class="qty"><button data-dec="${l.id}" aria-label="Decrease ${l.name}">−</button><b>${l.qty}</b><button data-inc="${l.id}" aria-label="Increase ${l.name}">+</button><button class="rm" data-rm="${l.id}" aria-label="Remove ${l.name}">✕</button></span>
      <div class="csub">${peso(l.sub)}</div></div>`).join("")}
    <div class="ctotal"><span>TOTAL</span><span>${peso(total())}</span></div></div>`;
  return `<table><tr><th>Product</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Subtotal</th></tr>
    ${L.map(l => `<tr><td>${l.name}</td>
      <td class="r">${editable ? `<span class="qty"><button data-dec="${l.id}" aria-label="Decrease ${l.name}">−</button><b>${l.qty}</b><button data-inc="${l.id}" aria-label="Increase ${l.name}">+</button><button class="rm" data-rm="${l.id}" aria-label="Remove ${l.name}">✕</button></span>` : l.qty}</td>
      <td class="r">${peso(l.price)}</td><td class="r">${peso(l.sub)}</td></tr>`).join("")}
    <tr class="total"><td colspan="3">TOTAL</td><td class="r">${peso(total())}</td></tr></table>`;
}
function refresh(){
  renderProducts();
  $("#cart-select").innerHTML = cartTable(true);
  $("#cart-summary").innerHTML = cartTable(false);
  $("#to-summary").disabled = !lines().length;
  $("#to-method").disabled = !lines().length;
}
function add(id){
  if((cart[id]||0) >= MAX_QTY) return toast("Invalid quantity: maximum is "+MAX_QTY, true);
  cart[id] = (cart[id]||0)+1; refresh(); toast("Product added");
}
function dec(id){
  if(!cart[id]) return;
  cart[id]--; if(cart[id] <= 0) delete cart[id];   // never negative
  refresh();
}
function removeItem(id){ delete cart[id]; refresh(); toast("Product removed"); }

// ---------- Payment ----------
function nextTxn(){
  let n;
  try{ n = (parseInt(localStorage.getItem("txnCounter")||"0",10) || 0) + 1; localStorage.setItem("txnCounter", n); }
  catch(e){ n = Date.now() % 100000; }
  return "TXN-" + new Date().getFullYear() + "-" + String(n).padStart(5,"0");
}
function complete(paid){
  const t = total();
  last = {ref:nextTxn(), date:new Date(), items:lines(), total:t, method, paid, change:Math.round((paid-t)*100)/100};
  const rows = [["Transaction amount",peso(t)],["Amount paid",peso(paid)],["Payment method",method],["Reference no.",last.ref]];
  $("#success-info").innerHTML = `<div class="info">${rows.map(r=>`<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join("")}</div>`;
  toast("Transaction completed successfully");
  go("success");
}
function startMethod(m){
  method = m;
  if(m==="Cash"){
    $("#paid").value=""; $("#paid").classList.remove("bad"); $("#change-prev").textContent = peso(0);
    const t = total(), opts = [t,50,100,200,500,1000].filter((v,i,a)=>v>=t && a.indexOf(v)===i).slice(0,5);
    $("#quick").innerHTML = opts.map((v,i)=>`<button class="btn ghost" data-quick="${v}">${i===0?"Exact "+peso(v):peso(v)}</button>`).join("");
    go("cash");
  } else if(m==="QR Payment"){ drawQR(); go("qr"); }
  else {
    $("#card-msg").textContent="Please tap, insert, or swipe your card."; $("#card-icon").classList.remove("busy");
    $("#pay-card").disabled=false; $("#card-back").disabled=false; go("card");
  }
}
function payCash(){
  const inp = $("#paid"), raw = inp.value.trim(), v = Number(raw), t = total();
  const fail = m => { inp.classList.add("bad"); toast(m,true); };
  if(raw==="" || isNaN(v)) return fail("Invalid amount. Please enter the amount paid.");
  if(v < 0) return fail("Invalid amount. Negative values are not allowed.");
  if(v < t) return fail("Insufficient payment. Please enter at least " + peso(t) + ".");
  complete(Math.round(v*100)/100);
}
function payCard(){
  if(busy) return; busy = true;
  $("#card-msg").textContent = "Processing payment…"; $("#card-icon").classList.add("busy");
  $("#pay-card").disabled = true; $("#card-back").disabled = true;
  setTimeout(() => { busy = false; complete(total()); }, 2000);
}
// Placeholder QR pattern (real QR generation is optional)
function drawQR(){
  const n=21, c=9; let seed = Math.round(total()*100)+7, svg="";
  const rnd = () => (seed = (seed*9301+49297)%233280)/233280;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    let on;
    const corner = (x<7||x>n-8) && (y<7||y>n-8) && !(x>n-8&&y>n-8);
    if(corner){
      const fx = x<7?x:x-(n-7), fy = y<7?y:y-(n-7);
      on = fx===0||fx===6||fy===0||fy===6||(fx>=2&&fx<=4&&fy>=2&&fy<=4);
    } else on = rnd()>.5;
    if(on) svg += `<rect x="${x*c}" y="${y*c}" width="${c}" height="${c}" fill="#2f3a14"/>`;
  }
  $("#qr").innerHTML = `<svg width="${n*c}" height="${n*c}" role="img" aria-label="QR code placeholder">${svg}</svg>`;
}

// ---------- Receipt & reset ----------
function showReceipt(){
  const r = last, d = r.date.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}) + " " + r.date.toLocaleTimeString("en-US");
  $("#receipt").innerHTML = `<h3>JADI SHOP</h3>
    <div class="line"><span>Transaction No.:</span><span>${r.ref}</span></div>
    <div class="line"><span>Date:</span><span>${d}</span></div><hr>
    ${r.items.map(i=>`<div class="line"><span>${i.name} ${i.qty} × ${peso(i.price)}</span><span>${peso(i.sub)}</span></div>`).join("")}<hr>
    <div class="line"><b>TOTAL</b><b>${peso(r.total)}</b></div>
    <div class="line"><span>Payment method</span><span>${r.method}</span></div>
    <div class="line"><span>Amount paid</span><span>${peso(r.paid)}</span></div>
    <div class="line"><span>Change</span><span>${peso(r.change)}</span></div>
    <div class="line"><span>Status</span><span>Payment Successful</span></div><hr>
    <p style="text-align:center;margin:0">Thank you!</p>`;
  go("receipt");
}
function newTransaction(){
  cart = {}; method = null; last = null; busy = false;
  $("#paid").value=""; $("#receipt").innerHTML=""; $("#success-info").innerHTML="";
  refresh(); go("select");
}

// ---------- Events ----------
function updChange(){ const v = Number($("#paid").value), t = total(); $("#change-prev").textContent = peso(v>=t ? v-t : 0); }
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  const d = b.dataset;
  if(d.add) add(+d.add);
  else if(d.inc) add(+d.inc);
  else if(d.dec) dec(+d.dec);
  else if(d.rm) removeItem(+d.rm);
  else if(d.go) go(d.go);
  else if(d.method) startMethod(d.method);
  else if(d.quick){ $("#paid").value = d.quick; $("#paid").classList.remove("bad"); updChange(); }
});
$("#paid").addEventListener("input", () => { $("#paid").classList.remove("bad"); updChange(); });
$("#to-summary").onclick = () => go("summary");
$("#to-method").onclick = () => go("method");
$("#pay-cash").onclick = payCash;
$("#pay-qr").onclick = () => complete(total());
$("#pay-card").onclick = payCard;
$("#view-receipt").onclick = showReceipt;
$("#new-txn").onclick = newTransaction;

refresh(); go("select");
