const SUPABASE_URL = 'https://uipapbtndjctyzvlreoa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Inoee5YHcjCLCamrmE-vfA_LLWPK7CT';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = selector => document.querySelector(selector);
const money = value => `MVR ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`;
const preciseMoney = value => `MVR ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Maldives', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const navigation = [
  ['entry', 'New bill'],
  ['bills', 'Bills'],
  ['rates', 'Rates'],
  ['suppliers', 'Suppliers']
];
const units = ['PC', 'G', 'KG', 'ML', 'L', 'M', 'DOZ', 'PKT', 'BOX', 'PACKAGE'];

const state = {
  view: 'entry',
  products: [], vendors: [], bills: [], billItems: [], rates: [],
  draftItems: [], editingBillId: null, editingSupplierId: null, lastSaved: null,
  draft: { vendorId: '', date: today(), invoice: '' }
};

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 2600);
}

async function fetchAll(table, order, ascending = true) {
  const result = [];
  for (let from = 0; ; from += 1000) {
    let query = db.from(table).select('*').range(from, from + 999);
    if (order) query = query.order(order, { ascending });
    const { data, error } = await query;
    if (error) throw error;
    result.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return result;
}

async function loadData() {
  const { data: member, error: memberError } = await db.from('supply_members').select('active').maybeSingle();
  if (memberError) throw memberError;
  if (!member?.active) throw new Error('This account is not an active SupplyFlow member.');
  const [products, vendors, bills, billItems, rates] = await Promise.all([
    fetchAll('supply_products', 'name'),
    fetchAll('supply_vendors', 'vendor_name'),
    fetchAll('supply_bills', 'bill_date', false),
    fetchAll('supply_bill_items'),
    fetchAll('supply_rate_history', 'effective_date', false)
  ]);
  Object.assign(state, { products, vendors, bills, billItems, rates });
  $('#liveStatus').textContent = `● Live · ${products.length} products`;
}

function renderNav() {
  $('#nav').innerHTML = navigation.map(([id, label], index) => `<button data-view="${id}" class="${state.view === id ? 'active' : ''}"><span>${index + 1}</span> ${label}</button>`).join('');
  document.querySelectorAll('[data-view]').forEach(button => button.onclick = event => {
    event.preventDefault();
    go(button.dataset.view);
  });
}

function go(view) {
  state.view = view;
  renderNav();
  render();
  $('#nav').classList.remove('open');
  $('#mobileBackdrop').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.go = go;

function pageHead(title, subtitle, action = '') {
  return `<div class="page-head"><div><p class="kicker">SUPPLYFLOW</p><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
}

function parsePack(value) {
  const match = String(value || '').trim().match(/^(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)$/);
  return match ? { quantity: Number(match[1]), size: Number(match[2]) } : null;
}

function inferPack(product) {
  const text = `${product?.name || ''} ${product?.unit || ''}`.replace(/,/g, '');
  const matches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(kg|g|gm|ml|l|pcs?|pc)\b/gi)];
  const match = matches.at(-1);
  if (match) {
    const raw = match[3].toUpperCase();
    return { quantity: Number(match[1]), size: Number(match[2]), unit: /GM/.test(raw) ? 'G' : /PCS?/.test(raw) ? 'PC' : raw };
  }
  return { quantity: Number(product?.pack_quantity) || 1, size: Number(product?.pack_size) || 1, unit: String(product?.pack_size_unit || product?.unit || 'PC').toUpperCase() };
}

function conversion(rate, packQuantity, packSize, unit) {
  const count = Number(packQuantity) * Number(packSize);
  const base = count > 0 ? Number(rate) / count : 0;
  const normalized = String(unit || '').toUpperCase();
  const small = normalized === 'G' ? base : normalized === 'KG' ? base / 1000 : normalized === 'ML' ? base : normalized === 'L' ? base / 1000 : null;
  return { base, small, smallLabel: ['G', 'KG'].includes(normalized) ? '1 gram' : ['ML', 'L'].includes(normalized) ? '1 ml' : '' };
}

function lineAmounts(item) {
  const subtotal = Number(item.quantity) * Number(item.rate);
  const gst = item.addGst ? subtotal * 0.08 : 0;
  return { subtotal, gst, total: subtotal + gst };
}

function totals() {
  return state.draftItems.reduce((sum, item) => {
    const line = lineAmounts(item);
    sum.subtotal += line.subtotal;
    sum.gst += line.gst;
    sum.total += line.total;
    return sum;
  }, { subtotal: 0, gst: 0, total: 0 });
}

function productOptions() {
  return state.products.filter(product => product.name?.trim()).map(product => `<option value="${product.id}">${escapeHtml(product.name)}</option>`).join('');
}

function itemRows() {
  if (!state.draftItems.length) return '<div class="empty">No rows yet. Add the first item above.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Description</th><th>Qty</th><th>Packing</th><th>Unit</th><th>Rate</th><th>Base cost</th><th>1 gram/ml</th><th>GST</th><th>Total</th><th></th></tr></thead><tbody>${state.draftItems.map((item, index) => {
    const amounts = lineAmounts(item);
    const converted = conversion(item.rate, item.packQuantity, item.packSize, item.unit);
    return `<tr><td><strong>${escapeHtml(item.productName)}</strong></td><td>${item.quantity}</td><td>${item.packQuantity}x${item.packSize}</td><td>${escapeHtml(item.unit)}</td><td>${money(item.rate)}</td><td>${preciseMoney(converted.base)}</td><td>${converted.small == null ? '—' : preciseMoney(converted.small)}</td><td>${item.addGst ? '8%' : '—'}</td><td class="money">${money(amounts.total)}</td><td><button class="button danger tiny" data-remove="${index}">Remove</button></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function summaryHtml() {
  const value = totals();
  return `<div class="summary"><div><span>Subtotal</span><strong>${money(value.subtotal)}</strong></div><div><span>GST</span><strong>${money(value.gst)}</strong></div><div class="grand"><span>Grand total</span><strong>${money(value.total)}</strong></div></div>`;
}

function entryView() {
  const success = state.lastSaved ? `<div class="success">✓ Bill <strong>${escapeHtml(state.lastSaved.bill_number)}</strong> saved. This form is ready for the next bill.</div>` : '';
  const editing = Boolean(state.editingBillId);
  return `${pageHead(editing ? 'Modify supplier bill' : 'New supplier bill', 'Follow the three simple steps. Totals calculate automatically.')}${success}<div class="timeline">
    <section class="timeline-step ready"><span class="step-dot">1</span><div class="card"><div class="step-title"><h2>Bill details</h2><small>Who and when</small></div><div class="grid three-cols"><label>Supplier<select id="vendor"><option value="">Choose supplier…</option>${state.vendors.map(vendor => `<option value="${vendor.id}" ${String(vendor.id) === String(state.draft.vendorId) ? 'selected' : ''}>${escapeHtml(vendor.vendor_name)}</option>`).join('')}</select></label><label>Invoice date<input id="billDate" type="date" value="${state.draft.date}"></label><label>Invoice number<input id="invoice" value="${escapeHtml(state.draft.invoice)}" placeholder="Enter invoice number"></label></div></div></section>
    <section class="timeline-step ${state.draftItems.length ? 'ready' : ''}"><span class="step-dot">2</span><div class="card"><div class="step-title"><h2>Add item rows</h2><small>Repeat for every item</small></div><div class="grid item-editor"><label>Description<select id="product"><option value="">Choose product…</option>${productOptions()}</select></label><label>Qty<input id="quantity" type="number" min=".001" step=".001" value="1"></label><label>Packing<input id="packing" value="1x1" placeholder="500x10"></label><label>Unit<select id="unit">${units.map(unit => `<option>${unit}</option>`).join('')}</select></label><label>Rate (MVR)<input id="rate" type="number" min="0" step=".001" placeholder="0.00"></label><label class="check-field"><span>Add GST</span><input id="gst" type="checkbox"><small>8% automatic</small></label><div class="live-total"><small>LINE TOTAL</small><strong id="lineTotal">MVR 0.00</strong><small id="unitCost"></small><small id="smallCost"></small></div></div><div class="add-row"><button id="addRow" class="button primary">＋ Add row</button></div><div id="draftRows">${itemRows()}</div></div></section>
    <section class="timeline-step ${state.draftItems.length ? 'ready' : ''}"><span class="step-dot">3</span><div class="card"><div class="step-title"><h2>Review & save</h2><small>${state.draftItems.length} item${state.draftItems.length === 1 ? '' : 's'}</small></div><div class="save-area">${summaryHtml()}<button id="saveBill" class="button primary" ${state.draftItems.length ? '' : 'disabled'}>${editing ? 'Save changes' : 'Save bill'}</button></div><p id="billError" class="error"></p></div></section>
  </div>`;
}

function billTable(rows) {
  if (!rows.length) return '<div class="card empty">No saved bills yet.</div>';
  return `<div class="card table-wrap"><table><thead><tr><th>Date</th><th>Invoice</th><th>Supplier</th><th>Items</th><th>Total</th><th>Actions</th></tr></thead><tbody>${rows.map(bill => `<tr><td>${escapeHtml(bill.bill_date)}</td><td><strong>${escapeHtml(bill.bill_number)}</strong></td><td>${escapeHtml(bill.vendor_name)}</td><td>${state.billItems.filter(item => item.bill_id === bill.id).length}</td><td class="money">${money(bill.total_amount)}</td><td><div class="row-actions"><button class="button tiny" data-view-bill="${bill.id}">View</button><button class="button tiny" data-edit-bill="${bill.id}">Modify</button><button class="button danger tiny" data-delete-bill="${bill.id}">Delete</button></div></td></tr>`).join('')}</tbody></table></div>`;
}

function billsView() {
  return `${pageHead('Bills', 'Search, review or correct a saved supplier bill.', '<button class="button primary" data-view="entry">＋ New bill</button>')}<div class="toolbar"><input id="billSearch" placeholder="Search invoice or supplier…"><span class="badge">${state.bills.length} bills</span></div><div id="billList">${billTable(state.bills)}</div>`;
}

function latestRateRows() {
  const latest = new Map();
  state.rates.forEach(rate => { if (!latest.has(rate.product_id)) latest.set(rate.product_id, rate); });
  state.products.forEach(product => {
    if (!latest.has(product.id) && product.rate != null) latest.set(product.id, { product_id: product.id, product_name: product.name, rate: product.rate, unit: product.unit, effective_date: 'Current' });
  });
  return [...latest.values()];
}

function rateMetrics(rate) {
  const product = state.products.find(value => value.id === rate.product_id) || {};
  const item = state.billItems.find(value => value.bill_id === rate.bill_id && value.product_id === rate.product_id);
  const inferred = inferPack(product);
  const packQuantity = Number(item?.pack_quantity) || inferred.quantity;
  const packSize = Number(item?.pack_size) || inferred.size;
  const unit = String(item?.pack_size_unit || inferred.unit || 'PC').toUpperCase();
  return { packQuantity, packSize, unit, ...conversion(rate.rate, packQuantity, packSize, unit) };
}

function rateCards(rows) {
  if (!rows.length) return '<div class="card empty">No rates found.</div>';
  return `<div class="rate-grid">${rows.map(rate => {
    const metric = rateMetrics(rate);
    return `<article class="card rate-card"><span class="badge">${metric.packQuantity}x${metric.packSize} ${metric.unit}</span><h3>${escapeHtml(rate.product_name)}</h3><div class="rate-main">${money(rate.rate)} <small>pack</small></div><div class="rate-pairs"><div><small>BASE UNIT</small><strong>${preciseMoney(metric.base)} / ${metric.unit}</strong></div><div><small>${metric.smallLabel || 'SMALL UNIT'}</small><strong>${metric.small == null ? '—' : preciseMoney(metric.small)}</strong></div></div></article>`;
  }).join('')}</div>`;
}

function ratesView() {
  const rows = latestRateRows();
  return `${pageHead('Current rates', 'Pack, base-unit and gram costs in one calm view.')}<div class="toolbar"><input id="rateSearch" placeholder="Search product or unit…"><span class="badge">${rows.length} current rates</span></div><div id="rateList">${rateCards(rows)}</div>`;
}

function supplierCards(rows) {
  if (!rows.length) return '<div class="card empty">No suppliers found.</div>';
  return `<div class="supplier-grid">${rows.map(vendor => `<article class="card supplier-card"><div class="supplier-head"><span class="avatar">${escapeHtml(vendor.vendor_name.charAt(0).toUpperCase())}</span><div><h3>${escapeHtml(vendor.vendor_name)}</h3><span class="badge">Supplier</span></div></div><p>☎ ${escapeHtml(vendor.contact_number || 'No phone')}</p><p>⌖ ${escapeHtml(vendor.address || 'No address')}</p><p>Tax ID: ${escapeHtml(vendor.tin_number || 'Not added')}</p><footer><strong>${money(vendor.total_budget)}</strong><button class="button tiny" data-edit-supplier="${vendor.id}">Edit</button></footer></article>`).join('')}</div>`;
}

function suppliersView() {
  return `${pageHead('Suppliers', 'Keep supplier details close to every bill.', '<button id="addSupplier" class="button primary">＋ Add supplier</button>')}<div class="toolbar"><input id="supplierSearch" placeholder="Search suppliers…"><span class="badge">${state.vendors.length} suppliers</span></div><div id="supplierList">${supplierCards(state.vendors)}</div>`;
}

function billDetailView(id) {
  const bill = state.bills.find(value => value.id === id);
  const items = state.billItems.filter(item => item.bill_id === id);
  if (!bill) return billsView();
  return `${pageHead(`Invoice ${escapeHtml(bill.bill_number)}`, `${escapeHtml(bill.vendor_name)} · ${escapeHtml(bill.bill_date)}`, '<button class="button ghost" data-view="bills">← Back to bills</button>')}<section class="card"><div class="table-wrap"><table><thead><tr><th>Description</th><th>Qty</th><th>Packing</th><th>Unit</th><th>Rate</th><th>GST</th><th>Total</th></tr></thead><tbody>${items.map(item => `<tr><td>${escapeHtml(item.product_name)}</td><td>${item.quantity}</td><td>${item.pack_quantity}x${item.pack_size}</td><td>${escapeHtml(item.pack_size_unit)}</td><td>${money(item.rate)}</td><td>${money(item.gst_amount)}</td><td class="money">${money(Number(item.quantity) * Number(item.rate) + Number(item.gst_amount))}</td></tr>`).join('')}</tbody></table></div><div class="save-area">${summaryFromBill(bill)}<div class="row-actions"><button class="button" data-edit-bill="${id}">Modify</button><button class="button danger" data-delete-bill="${id}">Delete</button></div></div></section>`;
}

function summaryFromBill(bill) {
  return `<div class="summary"><div><span>Subtotal</span><strong>${money(bill.subtotal)}</strong></div><div><span>GST</span><strong>${money(bill.gst_amount)}</strong></div><div class="grand"><span>Grand total</span><strong>${money(bill.total_amount)}</strong></div></div>`;
}

function render() {
  const views = { entry: entryView, bills: billsView, rates: ratesView, suppliers: suppliersView };
  $('#main').innerHTML = state.view.startsWith('bill:') ? billDetailView(Number(state.view.split(':')[1])) : (views[state.view] || entryView)();
  $('#main').classList.remove('view-enter');
  void $('#main').offsetWidth;
  $('#main').classList.add('view-enter');
  bindView();
}

function bindView() {
  document.querySelectorAll('[data-view]').forEach(button => button.onclick = event => { event.preventDefault(); go(button.dataset.view); });
  if (state.view === 'entry') bindEntry();
  if (state.view === 'bills') bindBills();
  if (state.view === 'rates') bindRates();
  if (state.view === 'suppliers') bindSuppliers();
  document.querySelectorAll('[data-view-bill]').forEach(button => button.onclick = () => { state.view = `bill:${button.dataset.viewBill}`; renderNav(); render(); });
  document.querySelectorAll('[data-edit-bill]').forEach(button => button.onclick = () => editBill(Number(button.dataset.editBill)));
  document.querySelectorAll('[data-delete-bill]').forEach(button => button.onclick = () => deleteBill(Number(button.dataset.deleteBill)));
}

function bindEntry() {
  const syncDraft = () => {
    state.draft.vendorId = $('#vendor').value;
    state.draft.date = $('#billDate').value;
    state.draft.invoice = $('#invoice').value;
  };
  ['vendor', 'billDate', 'invoice'].forEach(id => $('#' + id).addEventListener('input', syncDraft));
  $('#product').onchange = event => {
    const product = state.products.find(value => String(value.id) === event.target.value);
    if (!product) return;
    const pack = inferPack(product);
    $('#packing').value = `${pack.quantity}x${pack.size}`;
    $('#unit').value = units.includes(pack.unit) ? pack.unit : 'PC';
    $('#rate').value = product.rate ?? '';
    updateLinePreview();
  };
  ['quantity', 'packing', 'unit', 'rate', 'gst'].forEach(id => $('#' + id).addEventListener('input', updateLinePreview));
  $('#addRow').onclick = event => { event.preventDefault(); addRow(); };
  $('#saveBill').onclick = saveBill;
  document.querySelectorAll('[data-remove]').forEach(button => button.onclick = () => {
    state.draftItems.splice(Number(button.dataset.remove), 1);
    render();
  });
}

function updateLinePreview() {
  const pack = parsePack($('#packing').value);
  const rate = Number($('#rate').value) || 0;
  const quantity = Number($('#quantity').value) || 0;
  const withGst = $('#gst').checked;
  const converted = pack ? conversion(rate, pack.quantity, pack.size, $('#unit').value) : { base: 0, small: null, smallLabel: '' };
  $('#lineTotal').textContent = money(quantity * rate * (withGst ? 1.08 : 1));
  $('#unitCost').textContent = pack ? `${preciseMoney(converted.base)} / ${$('#unit').value}` : 'Use packing like 500x10';
  $('#smallCost').textContent = converted.small == null ? '' : `${preciseMoney(converted.small)} / ${converted.smallLabel}`;
}

function addRow() {
  const product = state.products.find(value => String(value.id) === $('#product').value);
  const pack = parsePack($('#packing').value);
  const quantity = Number($('#quantity').value);
  const rate = Number($('#rate').value);
  if (!product) return toast('Choose a product');
  if (!quantity || quantity <= 0) return toast('Enter a valid quantity');
  if (!pack || pack.quantity <= 0 || pack.size <= 0) return toast('Packing must look like 500x10');
  if ($('#rate').value === '' || rate < 0) return toast('Enter a valid rate');
  const unit = $('#unit').value;
  const converted = conversion(rate, pack.quantity, pack.size, unit);
  state.draftItems.push({
    productId: product.id, productName: product.name, category: product.category || 'Uncategorised',
    quantity, packQuantity: pack.quantity, packSize: pack.size, unit, rate,
    purchaseUnit: product.purchase_unit || product.unit || unit, addGst: $('#gst').checked,
    pricePerBaseUnit: converted.base
  });
  render();
  setTimeout(() => $('#product')?.focus(), 50);
}

async function saveBill() {
  const vendor = state.vendors.find(value => String(value.id) === String(state.draft.vendorId));
  if (!vendor) return showBillError('Choose a supplier');
  if (!state.draft.date) return showBillError('Choose an invoice date');
  if (!state.draft.invoice.trim()) return showBillError('Enter an invoice number');
  if (!state.draftItems.length) return showBillError('Add at least one item row');
  const button = $('#saveBill');
  button.disabled = true;
  button.textContent = 'Saving…';
  const value = totals();
  const bill = {
    bill_number: state.draft.invoice.trim(), bill_date: state.draft.date,
    vendor_id: vendor.id, vendor_name: vendor.vendor_name,
    vendor_tin: vendor.tin_number || '', vendor_mobile: vendor.contact_number || '',
    subtotal: value.subtotal, gst_type: value.gst ? 'added' : 'none', gst_rate: value.gst ? 8 : 0,
    gst_amount: value.gst, total_amount: value.total,
    payment_status: 'paid', payment_method: 'cash', notes: ''
  };
  const items = state.draftItems.map(item => ({
    product_id: item.productId, product_name: item.productName, category: item.category,
    quantity: item.quantity, unit: item.purchaseUnit, purchase_unit: item.purchaseUnit,
    pack_quantity: item.packQuantity, pack_size: item.packSize, pack_size_unit: item.unit,
    rate: item.rate, price_per_base_unit: item.pricePerBaseUnit,
    gst_amount: lineAmounts(item).gst
  }));
  try {
    const editing = state.editingBillId;
    const response = editing
      ? await db.rpc('update_supply_bill', { p_bill_id: editing, p_bill: bill, p_items: items })
      : await db.rpc('create_supply_bill', { p_bill: bill, p_items: items });
    if (response.error) throw response.error;
    await loadData();
    state.lastSaved = state.bills.find(value => value.bill_number === bill.bill_number && String(value.vendor_id) === String(vendor.id)) || null;
    resetDraft();
    toast(editing ? 'Bill updated' : 'Bill saved');
    go('entry');
  } catch (error) {
    showBillError(error.message || 'Could not save bill');
    button.disabled = false;
    button.textContent = state.editingBillId ? 'Save changes' : 'Save bill';
  }
}

function showBillError(message) {
  if ($('#billError')) $('#billError').textContent = message;
  toast(message);
}

function resetDraft() {
  state.draftItems = [];
  state.editingBillId = null;
  state.draft = { vendorId: '', date: today(), invoice: '' };
}

function bindBills() {
  $('#billSearch').oninput = event => {
    const query = event.target.value.toLowerCase();
    const rows = state.bills.filter(bill => `${bill.bill_number} ${bill.vendor_name} ${bill.bill_date} ${bill.total_amount}`.toLowerCase().includes(query));
    $('#billList').innerHTML = billTable(rows);
    bindView();
  };
}

function editBill(id) {
  const bill = state.bills.find(value => value.id === id);
  if (!bill) return toast('Bill not found');
  state.editingBillId = id;
  state.lastSaved = null;
  state.draft = { vendorId: bill.vendor_id, date: bill.bill_date, invoice: bill.bill_number };
  state.draftItems = state.billItems.filter(item => item.bill_id === id).map(item => ({
    productId: item.product_id, productName: item.product_name, category: item.category,
    quantity: Number(item.quantity), packQuantity: Number(item.pack_quantity) || 1,
    packSize: Number(item.pack_size) || 1, unit: item.pack_size_unit || 'PC',
    rate: Number(item.rate), purchaseUnit: item.purchase_unit || item.unit,
    addGst: Number(item.gst_amount) > 0, pricePerBaseUnit: Number(item.price_per_base_unit) || 0
  }));
  go('entry');
}

async function deleteBill(id) {
  const bill = state.bills.find(value => value.id === id);
  if (!bill || !confirm(`Delete invoice ${bill.bill_number}?`)) return;
  const { error } = await db.rpc('delete_supply_bill', { p_bill_id: id });
  if (error) return toast(error.message);
  await loadData();
  toast('Bill deleted');
  go('bills');
}

function bindRates() {
  const rows = latestRateRows();
  $('#rateSearch').oninput = event => {
    const query = event.target.value.toLowerCase();
    $('#rateList').innerHTML = rateCards(rows.filter(rate => `${rate.product_name} ${rate.unit}`.toLowerCase().includes(query)));
  };
}

function bindSuppliers() {
  $('#addSupplier').onclick = () => openSupplier();
  $('#supplierSearch').oninput = event => {
    const query = event.target.value.toLowerCase();
    $('#supplierList').innerHTML = supplierCards(state.vendors.filter(vendor => JSON.stringify(vendor).toLowerCase().includes(query)));
    bindSupplierEdits();
  };
  bindSupplierEdits();
}

function bindSupplierEdits() {
  document.querySelectorAll('[data-edit-supplier]').forEach(button => button.onclick = () => openSupplier(Number(button.dataset.editSupplier)));
}

function openSupplier(id = null) {
  state.editingSupplierId = id;
  const dialog = $('#supplierDialog');
  const form = $('#supplierForm');
  form.reset();
  const vendor = state.vendors.find(value => value.id === id);
  dialog.querySelector('h2').textContent = vendor ? 'Edit supplier' : 'Add supplier';
  if (vendor) {
    ['vendor_name', 'contact_number', 'tin_number', 'address', 'bank_details'].forEach(name => form.elements[name].value = vendor[name] || '');
  }
  dialog.showModal();
}

async function saveSupplier(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.target).entries());
  let response;
  if (state.editingSupplierId) {
    response = await db.from('supply_vendors').update(payload).eq('id', state.editingSupplierId).select().single();
  } else {
    payload.source_id = Math.max(0, ...state.vendors.map(value => value.source_id || 0)) + 1;
    payload.total_budget = 0;
    response = await db.from('supply_vendors').insert(payload).select().single();
  }
  if (response.error) return toast(response.error.message);
  await loadData();
  $('#supplierDialog').close();
  toast(state.editingSupplierId ? 'Supplier updated' : 'Supplier added');
  state.editingSupplierId = null;
  if (state.view === 'suppliers') render();
}

async function applySession(session) {
  if (!session) {
    $('#app').classList.add('hidden');
    $('#loginView').classList.remove('hidden');
    return;
  }
  $('#loginView').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#main').innerHTML = '<div class="card empty">Loading your supplier workspace…</div>';
  try {
    await loadData();
    renderNav();
    render();
  } catch (error) {
    $('#main').innerHTML = `<div class="card empty"><strong>Could not load data</strong><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function login(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  $('#loginError').textContent = '';
  const { data, error } = await db.functions.invoke('username-login', { body: { username: $('#loginUsername').value.trim().toLowerCase(), password: $('#loginPassword').value } });
  if (!error && data?.access_token && data?.refresh_token) {
    const result = await db.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
    if (!result.error) { button.disabled = false; return; }
  }
  button.disabled = false;
  $('#loginError').textContent = 'Username or password is incorrect';
}

async function logout() {
  await db.auth.signOut({ scope: 'local' });
  resetDraft();
  state.lastSaved = null;
  $('#loginPassword').value = '';
}

function init() {
  $('#loginForm').onsubmit = login;
  $('#togglePassword').onclick = () => {
    const input = $('#loginPassword');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('#togglePassword').textContent = show ? 'Hide' : 'Show';
  };
  $('#logoutButton').onclick = logout;
  $('#menuButton').onclick = () => { $('#nav').classList.toggle('open'); $('#mobileBackdrop').classList.toggle('open'); };
  $('#mobileBackdrop').onclick = () => { $('#nav').classList.remove('open'); $('#mobileBackdrop').classList.remove('open'); };
  $('#supplierForm').onsubmit = saveSupplier;
  document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => $('#supplierDialog').close());
  db.auth.onAuthStateChange((event, session) => setTimeout(() => applySession(session), 0));
}

init();
