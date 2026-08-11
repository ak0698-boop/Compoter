// Compoter booking-tracking chatbot widget.
// Drop `<script type="module" src="chatbot.js"></script>` before </body> on any page.
// Reads live from Firestore (bookings / bookingsByPhone) — no manual updates needed;
// admin.html is the only thing that ever writes status/engineer, and this widget
// reflects those writes instantly via onSnapshot.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeFirestore, getFirestore, doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA80s9jtewt93rsveqQyXD2xslm1chJuME",
  authDomain: "expertinc-tools.firebaseapp.com",
  projectId: "expertinc-tools",
  storageBucket: "expertinc-tools.firebasestorage.app",
  messagingSenderId: "86282664413",
  appId: "1:86282664413:web:ec3374c7ffe1d99e70de34"
};

const app = getApps().some(a => a.name === "compoter-chatbot")
  ? getApp("compoter-chatbot")
  : initializeApp(firebaseConfig, "compoter-chatbot");
// Auto-fallback to long-polling — some networks block/throttle Firestore's
// default QUIC/WebChannel connection. initializeFirestore throws if called
// twice for the same app (e.g. chatbot.js injected more than once), so fall
// back to the already-initialized instance in that case.
let db;
try {
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
} catch (e) {
  db = getFirestore(app);
}

const STATUS_STEPS = [
  { key: 'pending',     label: 'Booked',              icon: '📝' },
  { key: 'assigned',    label: 'Engineer Assigned',   icon: '🧑‍🔧' },
  { key: 'on_the_way',  label: 'On the Way',          icon: '🚗' },
  { key: 'in_progress', label: 'In Progress',         icon: '🔧' },
  { key: 'completed',   label: 'Completed',           icon: '✅' },
];

function esc(str){
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function statusLabel(key){
  const s = STATUS_STEPS.find(s => s.key === key);
  if (s) return s.label;
  if (key === 'cancelled') return 'Cancelled';
  return 'Pending';
}

function normalizePhone(phone){
  return phone.replace(/\D/g, '').slice(-10);
}

function injectStyles(){
  const style = document.createElement('style');
  style.textContent = `
    #cptr-chat-fab{
      position:fixed; left:20px; bottom:84px; z-index:9999; display:flex; align-items:center; gap:8px;
      background:var(--indigo,#3730A3); color:#fff; border:none; border-radius:999px; padding:14px 18px;
      font-family:var(--body,'Inter',sans-serif); font-weight:600; font-size:14px; cursor:pointer;
      box-shadow:0 8px 24px rgba(0,0,0,0.2); transition:transform .15s ease;
    }
    #cptr-chat-fab:hover{ transform:translateY(-2px); }
    #cptr-chat-fab .cptr-emoji{ font-size:18px; }
    #cptr-chat-panel{
      position:fixed; left:20px; bottom:152px; z-index:9999; width:340px; max-width:calc(100vw - 40px);
      height:460px; max-height:calc(100vh - 140px); background:var(--paper-raised,#fff); border:1px solid var(--line,#E2E6E4);
      border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,0.25); display:flex; flex-direction:column; overflow:hidden;
      font-family:var(--body,'Inter',sans-serif);
    }
    #cptr-chat-panel.cptr-hidden{ display:none; }
    .cptr-chat-header{
      background:var(--indigo,#3730A3); color:#fff; padding:14px 16px; display:flex; align-items:center;
      justify-content:space-between; font-family:var(--display,'Space Grotesk',sans-serif); font-weight:700; font-size:15px;
    }
    .cptr-chat-header button{ background:none; border:none; color:#fff; font-size:16px; cursor:pointer; opacity:0.85; }
    .cptr-chat-header button:hover{ opacity:1; }
    .cptr-chat-messages{ flex:1; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:10px; background:var(--paper,#F8F9FC); }
    .cptr-msg{ max-width:88%; padding:10px 13px; border-radius:12px; font-size:13.5px; line-height:1.5; }
    .cptr-msg--bot{ background:#fff; border:1px solid var(--line,#E2E6E4); align-self:flex-start; border-bottom-left-radius:3px; }
    .cptr-msg--user{ background:var(--indigo,#3730A3); color:#fff; align-self:flex-end; border-bottom-right-radius:3px; }
    .cptr-chat-form{ display:flex; gap:8px; padding:10px; border-top:1px solid var(--line,#E2E6E4); background:#fff; }
    .cptr-chat-form input{
      flex:1; border:1.5px solid var(--line,#E2E6E4); border-radius:8px; padding:9px 12px; font-size:13.5px;
      font-family:var(--body,'Inter',sans-serif); outline:none;
    }
    .cptr-chat-form input:focus{ border-color:var(--indigo,#3730A3); }
    .cptr-chat-form button{
      background:var(--teal,#14B8A6); color:#fff; border:none; border-radius:8px; width:38px; font-size:15px; cursor:pointer;
    }
    .cptr-chat-quick{ display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
    .cptr-chat-chip{
      background:var(--indigo-soft,#EDECFB); color:var(--indigo,#3730A3); border:none; border-radius:999px;
      padding:6px 12px; font-size:12.5px; font-weight:600; cursor:pointer;
    }
    .cptr-chat-chip:hover{ background:var(--indigo,#3730A3); color:#fff; }
    .cptr-chat-card{ background:#fff; }
    .cptr-chat-card-title{ font-family:var(--display,'Space Grotesk',sans-serif); font-weight:700; font-size:14px; margin-bottom:2px; }
    .cptr-chat-card-sub{ color:var(--steel,#57677A); font-size:12px; margin-bottom:10px; }
    .cptr-steps{ display:flex; flex-direction:column; gap:6px; margin:8px 0; }
    .cptr-step{ display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--steel-light,#8A96A3); }
    .cptr-step.done{ color:var(--mint,#1F8A70); }
    .cptr-step.active{ color:var(--indigo,#3730A3); font-weight:700; }
    .cptr-step-dot{ font-size:14px; }
    .cptr-chat-engineer{ margin-top:10px; padding:9px 11px; background:var(--indigo-soft,#EDECFB); border-radius:8px; }
    .cptr-chat-engineer--pending{ background:var(--paper,#F8F9FC); color:var(--steel,#57677A); font-size:12.5px; }
    .cptr-chat-engineer-name{ font-weight:600; font-size:13px; }
    .cptr-chat-engineer-call{ display:inline-block; margin-top:4px; font-size:12.5px; color:var(--teal,#14B8A6); font-weight:600; }
    .cptr-chat-card--cancelled .cptr-chat-card-title{ color:var(--red,#D6362C); }
    .cptr-live-map{ height:160px; border-radius:8px; margin-top:10px; overflow:hidden; }
    .cptr-final-bill{ margin-top:10px; padding:10px 11px; background:var(--paper,#F8F9FC); border:1px solid var(--line,#E2E6E4); border-radius:8px; }
    .cptr-final-bill-title{ font-size:12px; font-weight:700; margin-bottom:5px; }
    .cptr-final-bill-row{ display:flex; justify-content:space-between; font-size:12px; color:var(--steel,#57677A); padding:2px 0; }
    .cptr-final-bill-total{ display:flex; justify-content:space-between; font-size:12.5px; font-weight:700; border-top:1px solid var(--line,#E2E6E4); margin-top:5px; padding-top:6px; }
    .cptr-map-pin{
      background:#fff; border:2px solid var(--indigo,#3730A3); border-radius:50%;
      display:flex; align-items:center; justify-content:center; font-size:13px;
      box-shadow:0 2px 6px rgba(0,0,0,0.25);
    }
    .cptr-map-pin--home{ border-color:var(--teal,#14B8A6); }
  `;
  document.head.appendChild(style);
}

let leafletLoadPromise = null;
function ensureLeaflet(){
  if (window.L) return Promise.resolve();
  if (leafletLoadPromise) return leafletLoadPromise;
  leafletLoadPromise = new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
  return leafletLoadPromise;
}

let messagesEl, inputEl, panelEl;
let currentUnsub = null;
let greeted = false;

function scrollToBottom(){
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addBotHTML(html){
  const div = document.createElement('div');
  div.className = 'cptr-msg cptr-msg--bot';
  div.innerHTML = html;
  messagesEl.appendChild(div);
  scrollToBottom();
}

function addBotText(text){
  addBotHTML(esc(text));
}

function addUserText(text){
  const div = document.createElement('div');
  div.className = 'cptr-msg cptr-msg--user';
  div.textContent = text;
  messagesEl.appendChild(div);
  scrollToBottom();
}

function buildStatusCardHTML(data, mapContainerId){
  if (data.status === 'cancelled') {
    return `<div class="cptr-chat-card cptr-chat-card--cancelled">
      <div class="cptr-chat-card-title">${esc(data.bookingNumber)} — Cancelled</div>
      <div class="cptr-chat-card-sub">${esc(data.service)}</div>
    </div>`;
  }

  let idx = STATUS_STEPS.findIndex(s => s.key === data.status);
  if (idx < 0) idx = 0;

  const steps = STATUS_STEPS.map((s, i) => `
    <div class="cptr-step ${i < idx ? 'done' : i === idx ? 'active' : ''}">
      <span class="cptr-step-dot">${s.icon}</span>
      <span class="cptr-step-label">${esc(s.label)}</span>
    </div>`).join('');

  const engineerHTML = data.assignedEngineer
    ? `<div class="cptr-chat-engineer">
         <div class="cptr-chat-engineer-name">🧑‍🔧 ${esc(data.assignedEngineer)}</div>
         ${data.assignedEngineerPhone ? `<a class="cptr-chat-engineer-call" href="tel:${esc(data.assignedEngineerPhone)}">📞 Call Engineer</a>` : ''}
       </div>`
    : `<div class="cptr-chat-engineer cptr-chat-engineer--pending">An engineer will be assigned shortly.</div>`;

  const showLiveMap = (data.status === 'on_the_way' || data.status === 'in_progress') && mapContainerId;
  const mapHTML = showLiveMap ? `<div class="cptr-live-map" id="${esc(mapContainerId)}"></div>` : '';

  const hasFinalBill = data.finalBillItems && data.finalBillItems.length;
  const showInvoice = hasFinalBill || data.status === 'completed';
  const invoiceItems = hasFinalBill ? data.finalBillItems : (data.addOns || []);
  const invoiceTotal = hasFinalBill ? (data.finalBillTotal || 0) : (data.totalEstimate || data.labourCharge || 0);
  const finalBillHTML = showInvoice
    ? `<div class="cptr-final-bill">
         <div class="cptr-final-bill-title">💰 ${data.status === 'completed' ? 'Invoice' : 'Final Bill'}</div>
         ${invoiceItems.map(i => `<div class="cptr-final-bill-row"><span>${esc(i.name)}${i.qty ? ' x' + i.qty : ''}</span><span>₹${(i.price * (i.qty || 1)).toLocaleString('en-IN')}</span></div>`).join('')}
         ${(!hasFinalBill && data.labourCharge) ? `<div class="cptr-final-bill-row"><span>Visiting &amp; Labour Charge</span><span>₹${Number(data.labourCharge).toLocaleString('en-IN')}</span></div>` : ''}
         <div class="cptr-final-bill-total"><span>Total</span><span>₹${Number(invoiceTotal).toLocaleString('en-IN')}</span></div>
       </div>`
    : '';

  return `<div class="cptr-chat-card">
    <div class="cptr-chat-card-title">${esc(data.bookingNumber)} — ${esc(data.service)}</div>
    <div class="cptr-chat-card-sub">${esc(data.city)} • ${esc(data.date || 'Date TBD')} ${esc(data.time || '')}</div>
    <div class="cptr-steps">${steps}</div>
    ${engineerHTML}
    ${mapHTML}
    ${finalBillHTML}
  </div>`;
}

function buildBookingListHTML(numbers){
  return `Found <b>${numbers.length}</b> bookings under your number. Which one would you like to see?
    <div class="cptr-chat-quick">${numbers.map(n => `<button class="cptr-chat-chip" data-booking="${esc(n)}">${esc(n)}</button>`).join('')}</div>`;
}

let liveMap = null;
let liveMapMarker = null;
let liveMapHomeMarker = null;
let liveMapContainerId = null;

async function updateLiveMap(data){
  if (!liveMapContainerId || !data.engineerLocation) return;
  const el = document.getElementById(liveMapContainerId);
  if (!el) return;

  await ensureLeaflet();
  const engPos = [data.engineerLocation.lat, data.engineerLocation.lng];

  if (!liveMap) {
    liveMap = L.map(liveMapContainerId).setView(engPos, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(liveMap);
    liveMapMarker = L.marker(engPos, {
      icon: L.divIcon({ html: '🧑‍🔧', className: 'cptr-map-pin', iconSize: [26, 26] })
    }).addTo(liveMap);

    if (data.location) {
      liveMapHomeMarker = L.marker([data.location.lat, data.location.lng], {
        icon: L.divIcon({ html: '📍', className: 'cptr-map-pin cptr-map-pin--home', iconSize: [26, 26] })
      }).addTo(liveMap);
      liveMap.fitBounds([engPos, [data.location.lat, data.location.lng]], { padding: [20, 20] });
    }
  } else {
    liveMapMarker.setLatLng(engPos);
    liveMap.panTo(engPos);
  }
}

function watchBooking(bookingNumber){
  if (currentUnsub) { currentUnsub(); currentUnsub = null; }
  liveMap = null;
  liveMapMarker = null;
  liveMapHomeMarker = null;
  liveMapContainerId = null;

  let first = true;
  let lastStatus = null;

  currentUnsub = onSnapshot(doc(db, 'bookings', bookingNumber), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();

    if (first || data.status !== lastStatus) {
      if (!first) {
        addBotHTML(`🔔 <b>Update:</b> ${esc(data.bookingNumber)}'s status is now — <b>${esc(statusLabel(data.status))}</b>`);
      }
      liveMap = null; // fresh card = fresh map container, re-init on next update
      liveMapContainerId = 'cptr-map-' + Math.random().toString(36).slice(2);
      addBotHTML(buildStatusCardHTML(data, liveMapContainerId));
      first = false;
      lastStatus = data.status;
    }

    updateLiveMap(data);
  }, (err) => {
    console.error('Compoter chatbot: booking watch failed', err);
    addBotText('Unable to get a live update right now. Please try again in a bit.');
  });
}

async function lookupByBookingNumber(bookingNumber){
  addBotText('Looking it up...');
  try {
    const snap = await getDoc(doc(db, 'bookings', bookingNumber));
    if (!snap.exists()) {
      addBotText(`No booking found with ID "${bookingNumber}". Please double-check your Booking ID.`);
      return;
    }
    watchBooking(bookingNumber);
  } catch (e) {
    console.error(e);
    addBotText('Something went wrong. Please try again in a bit or contact us on WhatsApp.');
  }
}

async function lookupByPhone(phoneKey){
  addBotText('Looking it up...');
  try {
    const idxSnap = await getDoc(doc(db, 'bookingsByPhone', phoneKey));
    const numbers = idxSnap.exists() ? (idxSnap.data().bookingNumbers || []) : [];
    if (!numbers.length) {
      addBotText('No booking found for this phone number. Try your Booking ID or contact us on WhatsApp.');
      return;
    }
    if (numbers.length === 1) {
      watchBooking(numbers[0]);
      return;
    }
    addBotHTML(buildBookingListHTML(numbers));
  } catch (e) {
    console.error(e);
    addBotText('Something went wrong. Please try again in a bit.');
  }
}

async function handleUserInput(raw){
  const value = raw.trim();
  if (!value) return;
  addUserText(value);

  const bkMatch = value.toUpperCase().match(/^BK-?\s*(\d+)$/);
  if (bkMatch) {
    await lookupByBookingNumber('BK-' + bkMatch[1]);
    return;
  }

  const digits = value.replace(/\D/g, '');
  if (digits.length >= 7) {
    await lookupByPhone(normalizePhone(digits));
    return;
  }

  addBotText("I didn't quite get that 🤔 Please send your Booking ID (e.g. BK-5001) or your 10-digit phone number.");
}

function greet(){
  if (greeted) return;
  greeted = true;
  addBotText("Hi! 👋 I'm the Compoter Assistant. To check your booking's live status, send your Booking ID (e.g. BK-5001) or your registered phone number.");
}

function injectWidget(){
  const root = document.createElement('div');
  root.id = 'cptr-chatbot-root';
  root.innerHTML = `
    <button id="cptr-chat-fab" type="button"><span class="cptr-emoji">💬</span>Track Booking</button>
    <div id="cptr-chat-panel" class="cptr-hidden">
      <div class="cptr-chat-header">
        <span>Compoter Assistant</span>
        <button id="cptr-chat-close" type="button" aria-label="Close">✕</button>
      </div>
      <div id="cptr-chat-messages" class="cptr-chat-messages"></div>
      <form id="cptr-chat-form" class="cptr-chat-form">
        <input id="cptr-chat-input" type="text" placeholder="Booking ID or Phone Number" autocomplete="off">
        <button type="submit" aria-label="Send">➤</button>
      </form>
    </div>
  `;
  document.body.appendChild(root);

  const fab = document.getElementById('cptr-chat-fab');
  panelEl = document.getElementById('cptr-chat-panel');
  messagesEl = document.getElementById('cptr-chat-messages');
  inputEl = document.getElementById('cptr-chat-input');
  const form = document.getElementById('cptr-chat-form');
  const closeBtn = document.getElementById('cptr-chat-close');

  fab.addEventListener('click', () => {
    panelEl.classList.toggle('cptr-hidden');
    if (!panelEl.classList.contains('cptr-hidden')) {
      greet();
      inputEl.focus();
    }
  });

  closeBtn.addEventListener('click', () => panelEl.classList.add('cptr-hidden'));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = inputEl.value;
    inputEl.value = '';
    handleUserInput(value);
  });

  messagesEl.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-booking]');
    if (chip) watchBooking(chip.dataset.booking);
  });
}

injectStyles();
injectWidget();
