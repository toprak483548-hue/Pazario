import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, updateProfile, sendPasswordResetEmail, sendEmailVerification, reload
} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, limit, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js';
import { CITIES, CATEGORIES, CATEGORY_ICON_PATHS } from './data.js';
import { firebaseConfig, ADMIN_UIDS, isFirebaseConfigured } from './firebase-config.js';
import { cloudinaryConfig, isCloudinaryConfigured } from './cloudinary-config.js';

const $ = (id) => document.getElementById(id);
const PRICE = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
const state = {
  configured: isFirebaseConfigured(), user: null, profile: null, listings: [], myListings: [],
  favorites: new Set(), savedSearches: [], adminReports: [], filters: {}, authMode: 'login',
  listingStep: 1, selectedFiles: [], previewUrls: [], existingPhotos: [], editingListingId: null, currentDetail: null,
  currentConversationId: null, currentConversation: null, unsubListings: null,
  unsubFavorites: null, unsubSaved: null, unsubMessages: null, unsubChat: null,
  view: 'grid', pendingFavoriteId: null, adminListings: [], selectedDetailPhoto: 0
};
let auth = null;
let db = null;
let categoryCounts = {};

const ICON_SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/></svg>';
const EMPTY_FILTERS = () => ({ q: '', categoryId: '', subcategory: '', city: '', district: '', minPrice: '', maxPrice: '', listingType: '', condition: '', photoOnly: false, negotiable: false, shipping: false, attributes: {} });

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function safeImageUrl(value) {
  const text = String(value ?? '').trim();
  return /^https:\/\/[a-z0-9.-]+(?::\d+)?\//i.test(text) ? text : '';
}
function formatPrice(value) {
  const number = Number(value);
  return Number.isFinite(number) ? PRICE.format(number) : 'Fiyat belirtilmedi';
}
function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
function formatDate(value) {
  const date = toDate(value);
  return date ? date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Yeni';
}
function showToast(message, type = 'success', duration = 4200) {
  const node = document.createElement('div');
  node.className = `toast ${type === 'error' ? 'error' : type === 'warning' ? 'warning' : ''}`.trim();
  node.textContent = message;
  $('toastRegion').append(node);
  window.setTimeout(() => node.remove(), duration);
}
function openDialog(id) {
  const dialog = $(id);
  if (!dialog) return;
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('modal-open');
}
function closeDialog(id) {
  const dialog = $(id);
  if (dialog?.open) dialog.close();
  refreshModalBodyLock();
}
function refreshModalBodyLock() {
  if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
}
function firebaseNotReadyMessage() {
  showToast('Firebase kurulumu tamamlanmamış. README.md dosyasındaki adımları uygula.', 'warning', 6000);
}
function firebaseCallAllowed() {
  if (!state.configured || !auth || !db) {
    firebaseNotReadyMessage();
    return false;
  }
  return true;
}
function getCategory(id) { return CATEGORIES.find((category) => category.id === id) ?? null; }
function iconSvg(categoryId) {
  const path = CATEGORY_ICON_PATHS[categoryId] || '<circle cx="12" cy="12" r="8"/>';
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
}
function populateSelect(selectId, values, firstLabel, selected = '') {
  const select = $(selectId);
  if (!select) return;
  select.innerHTML = `<option value="">${escapeHtml(firstLabel)}</option>` + values.map((value) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('');
}
function populateCategories(selectId, firstLabel, selected = '') {
  const select = $(selectId);
  if (!select) return;
  select.innerHTML = `<option value="">${escapeHtml(firstLabel)}</option>` + CATEGORIES.map((category) => `<option value="${escapeHtml(category.id)}" ${category.id === selected ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('');
}
function updateSubcategorySelect(select, categoryId, firstLabel = 'Tüm alt kategoriler', selected = '') {
  if (typeof select === 'string') select = $(select);
  if (!select) return;
  const category = getCategory(categoryId);
  const list = category?.subcategories ?? [];
  select.innerHTML = `<option value="">${escapeHtml(category ? firstLabel : 'Önce kategori seç')}</option>` + list.map((name) => `<option value="${escapeHtml(name)}" ${name === selected ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('');
}
function fieldControl(field, prefix, value = '') {
  const id = `${prefix}-${field.key}`;
  let control = '';
  if (field.type === 'select') {
    control = `<select id="${escapeHtml(id)}" data-attribute-key="${escapeHtml(field.key)}"><option value="">Tümü</option>${field.options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select>`;
  } else {
    control = `<input id="${escapeHtml(id)}" data-attribute-key="${escapeHtml(field.key)}" type="${field.type === 'number' ? 'number' : 'text'}" ${field.type === 'number' ? `min="${field.min ?? 0}" max="${field.max ?? 99999999}"` : `maxlength="${field.maxLength ?? 70}"`} value="${escapeHtml(value)}" placeholder="${field.type === 'number' ? 'Belirt' : 'Örn. ...'}">`;
  }
  return `<div class="form-field"><label for="${escapeHtml(id)}">${escapeHtml(field.label)}</label>${control}</div>`;
}
function renderCategoryCards() {
  categoryCounts = {};
  state.listings.forEach((listing) => { categoryCounts[listing.categoryId] = (categoryCounts[listing.categoryId] || 0) + 1; });
  $('categoryGrid').innerHTML = CATEGORIES.map((category) => `
    <button type="button" class="category-card" data-category-pick="${escapeHtml(category.id)}">
      <span class="category-icon">${iconSvg(category.id)}</span><span><strong>${escapeHtml(category.name)}</strong><small>${categoryCounts[category.id] || 0} ilan</small></span>
    </button>`).join('');
}
function renderDynamicSearchFilters() {
  const category = getCategory($('filterCategory').value);
  $('dynamicSearchFilters').innerHTML = category?.fields?.length
    ? `<div class="filter-group dynamic-filter-group"><span class="field-title">${escapeHtml(category.name)} özellikleri</span><div class="dynamic-search-fields">${category.fields.map((field) => fieldControl(field, 'searchAttr', state.filters.attributes?.[field.key] ?? '')).join('')}</div></div>` : '';
}
function renderDynamicListingFields() {
  const category = getCategory($('listingCategory').value);
  $('listingDynamicFields').innerHTML = category?.fields?.length
    ? category.fields.map((field) => fieldControl(field, 'listingAttr')).join('') : '';
}
function getAttributes(prefix) {
  const result = {};
  document.querySelectorAll(`[id^="${prefix}-"][data-attribute-key]`).forEach((input) => {
    if (input.value !== '') result[input.dataset.attributeKey] = input.type === 'number' ? Number(input.value) : input.value.trim();
  });
  return result;
}
function initSelects() {
  populateCategories('heroCategory', 'Tüm kategoriler');
  populateCategories('filterCategory', 'Tüm kategoriler');
  populateCategories('listingCategory', 'Kategori seç');
  for (const id of ['heroCity', 'filterCity', 'listingCity']) populateSelect(id, CITIES, id === 'listingCity' ? 'İl seç' : 'Türkiye geneli');
  updateSubcategorySelect('filterSubcategory', '', 'Tüm alt kategoriler');
  updateSubcategorySelect('listingSubcategory', '', 'Alt kategori seç');
  $('currentYear').textContent = String(new Date().getFullYear());
}
function listingPhoto(listing, index = 0) {
  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  const chosen = photos[index] || photos[0];
  return safeImageUrl(typeof chosen === 'string' ? chosen : chosen?.url);
}
function photoMarkup(listing) {
  const image = listingPhoto(listing);
  if (image) return `<img class="listing-image" src="${escapeHtml(image)}" alt="${escapeHtml(listing.title)}" loading="lazy" referrerpolicy="no-referrer">`;
  return `<div class="listing-no-photo"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 3 3 3-4 5 6"/></svg><span>Fotoğraf eklenmemiş</span></div>`;
}
function categoryDisplay(listing) {
  const category = getCategory(listing.categoryId);
  return category?.name || 'Diğer';
}
function matchesFilters(listing, filters) {
  if (filters.q) {
    const searchText = [listing.title, listing.description, listing.city, listing.district, categoryDisplay(listing), listing.subcategory, ...Object.values(listing.attributes || {})].join(' ').toLocaleLowerCase('tr-TR');
    const terms = filters.q.toLocaleLowerCase('tr-TR').split(/\s+/).filter(Boolean);
    if (!terms.every((term) => searchText.includes(term))) return false;
  }
  if (filters.categoryId && listing.categoryId !== filters.categoryId) return false;
  if (filters.subcategory && listing.subcategory !== filters.subcategory) return false;
  if (filters.city && listing.city !== filters.city) return false;
  if (filters.district && !String(listing.district || '').toLocaleLowerCase('tr-TR').includes(filters.district.toLocaleLowerCase('tr-TR'))) return false;
  if (filters.minPrice !== '' && Number(listing.price) < Number(filters.minPrice)) return false;
  if (filters.maxPrice !== '' && Number(listing.price) > Number(filters.maxPrice)) return false;
  if (filters.listingType && listing.listingType !== filters.listingType) return false;
  if (filters.condition && listing.condition !== filters.condition) return false;
  if (filters.photoOnly && !(Array.isArray(listing.photos) && listing.photos.length)) return false;
  if (filters.negotiable && !listing.negotiable) return false;
  if (filters.shipping && !listing.shipping) return false;
  for (const [key, value] of Object.entries(filters.attributes || {})) {
    if (value === '' || value == null) continue;
    const actual = listing.attributes?.[key];
    if (actual == null || !String(actual).toLocaleLowerCase('tr-TR').includes(String(value).toLocaleLowerCase('tr-TR'))) return false;
  }
  return true;
}
function currentFiltersFromForm() {
  const attributes = getAttributes('searchAttr');
  return {
    q: $('searchQuery').value.trim(), categoryId: $('filterCategory').value || '',
    subcategory: $('filterSubcategory').value, city: $('filterCity').value || '',
    district: $('filterDistrict').value.trim(), minPrice: $('minPrice').value, maxPrice: $('maxPrice').value,
    listingType: $('filterListingType').value, condition: $('filterCondition').value,
    photoOnly: $('photoOnlyFilter').checked, negotiable: $('negotiableFilter').checked,
    shipping: $('shippingFilter').checked, attributes
  };
}
function applyFiltersToForm(filters = {}) {
  const merged = { ...EMPTY_FILTERS(), ...filters, attributes: { ...(filters.attributes || {}) } };
  state.filters = merged;
  $('searchQuery').value = merged.q || '';
  $('heroCategory').value = merged.categoryId || '';
  $('heroCity').value = merged.city || '';
  $('filterCategory').value = merged.categoryId || '';
  updateSubcategorySelect('filterSubcategory', merged.categoryId, 'Tüm alt kategoriler', merged.subcategory || '');
  $('filterCity').value = merged.city || '';
  $('filterDistrict').value = merged.district || '';
  $('minPrice').value = merged.minPrice ?? '';
  $('maxPrice').value = merged.maxPrice ?? '';
  $('filterListingType').value = merged.listingType || '';
  $('filterCondition').value = merged.condition || '';
  $('photoOnlyFilter').checked = Boolean(merged.photoOnly);
  $('negotiableFilter').checked = Boolean(merged.negotiable);
  $('shippingFilter').checked = Boolean(merged.shipping);
  renderDynamicSearchFilters();
  for (const [key, value] of Object.entries(merged.attributes || {})) {
    const input = $(`searchAttr-${key}`);
    if (input) input.value = value;
  }
  renderListings();
}
function sortedListings(items) {
  const sort = $('sortSelect').value;
  return items.slice().sort((a, b) => {
    if (sort === 'priceAsc') return Number(a.price) - Number(b.price);
    if (sort === 'priceDesc') return Number(b.price) - Number(a.price);
    const ad = toDate(a.createdAt)?.getTime() || 0;
    const bd = toDate(b.createdAt)?.getTime() || 0;
    return bd - ad;
  });
}
function renderListings() {
  const filters = state.filters && Object.keys(state.filters).length ? state.filters : EMPTY_FILTERS();
  const result = sortedListings(state.listings.filter((listing) => matchesFilters(listing, filters)));
  $('resultsCount').innerHTML = `<strong>${result.length}</strong> ${result.length === 1 ? 'ilan bulundu' : 'ilan bulundu'}`;
  $('resultsHeading').textContent = filters.categoryId ? `${categoryDisplay({ categoryId: filters.categoryId })} ilanları` : filters.q ? 'Arama sonuçları' : 'Yayınlanan ilanlar';
  $('resultsDescription').textContent = result.length ? 'İlan ayrıntılarını incele, seçenekleri karşılaştır.' : 'Yalnızca incelemeden geçerek yayınlanmış ilanlar burada gösterilir.';
  const countSuffix = state.listings.length >= 100 ? ' · En son 100 ilan içinde arama yapılıyor' : '';
  $('resultsCount').title = countSuffix.trim();
  if (!result.length) {
    $('listingGrid').innerHTML = '';
    $('emptyState').hidden = false;
    $('pagination').hidden = true;
    if (!state.configured) {
      $('emptyTitle').textContent = 'İlan sistemi henüz bağlanmadı';
      $('emptyText').textContent = 'Gerçek ilanları göstermek için Firebase yapılandırması gerekiyor. README.md içindeki kurulum adımlarını tamamladıktan sonra yayınlanmış ilanlar burada listelenecek.';
      $('emptyCreateListing').disabled = true;
      $('emptyCreateListing').title = 'Önce Firebase kurulumu gerekli';
    } else if (Object.values(filters).some((value) => value && (typeof value !== 'object' || Object.keys(value).length))) {
      $('emptyTitle').textContent = 'Bu filtrelerde ilan bulunamadı';
      $('emptyText').textContent = 'Arama ifadesini değiştirebilir veya filtrelerin bir kısmını temizleyebilirsin. Burada örnek ilan gösterilmez.';
      $('emptyCreateListing').disabled = false;
      $('emptyCreateListing').title = '';
    } else {
      $('emptyTitle').textContent = 'Henüz yayınlanmış ilan yok';
      $('emptyText').textContent = 'Burada yalnızca gerçek kullanıcıların eklediği ve incelemeden geçerek yayınlanmış ilanlar gösterilir. İlk ilanı sen oluşturabilirsin.';
      $('emptyCreateListing').disabled = false;
      $('emptyCreateListing').title = '';
    }
  } else {
    $('emptyState').hidden = true;
    $('pagination').hidden = true;
    $('listingGrid').innerHTML = result.map((listing) => listingCardMarkup(listing)).join('');
  }
  $('listingGrid').classList.toggle('list-view', state.view === 'list');
  $('gridViewBtn').classList.toggle('active', state.view === 'grid');
  $('listViewBtn').classList.toggle('active', state.view === 'list');
  $('gridViewBtn').setAttribute('aria-pressed', String(state.view === 'grid'));
  $('listViewBtn').setAttribute('aria-pressed', String(state.view === 'list'));
  $('favoritesCount').textContent = String(state.favorites.size);
  renderCategoryCards();
  renderActiveFilterHints(filters);
}
function listingCardMarkup(listing) {
  const isFavorite = state.favorites.has(listing.id);
  const location = [listing.district, listing.city].filter(Boolean).join(', ') || 'Konum belirtilmedi';
  const type = listing.listingType ? `<span>${escapeHtml(listing.listingType)}</span>` : '';
  return `<article class="listing-card" data-card-id="${escapeHtml(listing.id)}">
    <div class="listing-image-wrap">${photoMarkup(listing)}<div class="listing-image-actions"><button type="button" class="icon-action ${isFavorite ? 'is-favorite' : ''}" data-favorite="${escapeHtml(listing.id)}" aria-label="${isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}" aria-pressed="${isFavorite}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.3 8.7c0 5.2-8.3 10-8.3 10s-8.3-4.8-8.3-10A4.3 4.3 0 0 1 12 6.4a4.3 4.3 0 0 1 8.3 2.3Z"/></svg></button></div></div>
    <div class="listing-card-content"><div class="listing-card-category"><span>${escapeHtml(categoryDisplay(listing))}</span>${listing.subcategory ? `<span class="dot"></span><span>${escapeHtml(listing.subcategory)}</span>` : ''}</div><h3 class="listing-card-title"><button type="button" data-detail="${escapeHtml(listing.id)}">${escapeHtml(listing.title)}</button></h3><div class="listing-card-price">${formatPrice(listing.price)}</div><div class="listing-card-meta"><span class="location">${escapeHtml(location)}</span><span class="date">${escapeHtml(formatDate(listing.createdAt))}</span></div></div>${type ? `<span class="visually-hidden">${type}</span>` : ''}</article>`;
}
function renderActiveFilterHints(filters) {
  const labels = [];
  if (filters.categoryId) labels.push(categoryDisplay({ categoryId: filters.categoryId }));
  if (filters.city) labels.push(filters.city);
  if (filters.district) labels.push(filters.district);
  if (filters.minPrice !== '') labels.push(`Min. ${filters.minPrice} ₺`);
  if (filters.maxPrice !== '') labels.push(`Maks. ${filters.maxPrice} ₺`);
  $('resultsCount').dataset.activeFilters = labels.join(' · ');
}
function setCurrentListingQueryFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const filters = EMPTY_FILTERS();
  filters.q = params.get('q') || '';
  const category = params.get('category');
  filters.categoryId = getCategory(category)?.id || '';
  filters.city = CITIES.includes(params.get('city')) ? params.get('city') : '';
  applyFiltersToForm(filters);
}
function setSearchUrl() {
  const url = new URL(window.location.href);
  const f = state.filters;
  for (const k of ['q', 'city']) {
    if (f[k]) url.searchParams.set(k, f[k]); else url.searchParams.delete(k);
  }
  if (f.categoryId) url.searchParams.set('category', f.categoryId); else url.searchParams.delete('category');
  window.history.replaceState({}, '', url);
}

function setAuthMode(mode) {
  state.authMode = mode;
  const register = mode === 'register';
  $('loginTab').classList.toggle('active', !register);
  $('registerTab').classList.toggle('active', register);
  $('authTitle').textContent = register ? 'Yeni hesap oluştur' : 'Hesabına giriş yap';
  $('authDescription').textContent = register ? 'İlan vermek, favorilerini saklamak ve mesajlaşmak için hesabını oluştur.' : 'İlanlarını yönetmek ve satıcılarla iletişim kurmak için giriş yap.';
  $('authNameField').hidden = !register;
  $('authName').required = register;
  $('authConsentRow').hidden = !register;
  $('authConsent').required = register;
  if (!register) $('authConsent').checked = false;
  $('authPassword').autocomplete = register ? 'new-password' : 'current-password';
  $('authSubmit').textContent = register ? 'Hesap oluştur' : 'Giriş yap';
  $('passwordResetBtn').hidden = register;
  $('authError').hidden = true;
  $('authError').textContent = '';
}
function openAuth(mode = 'login') {
  if (!firebaseCallAllowed()) return;
  setAuthMode(mode);
  openDialog('authDialog');
}
function authErrorText(error) {
  const code = error?.code || '';
  const map = {
    'auth/invalid-email': 'E-posta adresi geçerli görünmüyor.',
    'auth/missing-password': 'Şifreni gir.',
    'auth/weak-password': 'Daha güçlü, en az 8 karakterli bir şifre seç.',
    'auth/email-already-in-use': 'Bu e-posta adresiyle zaten hesap var. Giriş yapmayı dene.',
    'auth/invalid-credential': 'E-posta veya şifre hatalı.',
    'auth/user-not-found': 'Bu e-posta ile kayıtlı hesap bulunamadı.',
    'auth/wrong-password': 'E-posta veya şifre hatalı.',
    'auth/too-many-requests': 'Çok fazla deneme yapıldı. Bir süre sonra tekrar dene.',
    'auth/network-request-failed': 'Bağlantı sorunu var. İnternet bağlantını kontrol et.'
  };
  return map[code] || `İşlem tamamlanamadı: ${error?.message || 'Bilinmeyen hata'}`;
}
async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!firebaseCallAllowed()) return;
  const email = $('authEmail').value.trim().toLowerCase();
  const password = $('authPassword').value;
  const submit = $('authSubmit');
  const errorNode = $('authError');
  errorNode.hidden = true;
  submit.disabled = true;
  submit.textContent = state.authMode === 'register' ? 'Hesap oluşturuluyor…' : 'Giriş yapılıyor…';
  try {
    if (state.authMode === 'register') {
      if (!$('authConsent').checked) { $('authError').textContent = 'Hesap oluşturmak için kullanım koşulları ve gizlilik bildirimini onaylamalısın.'; $('authError').hidden = false; submit.disabled = false; submit.textContent = 'Hesap oluştur'; return; }
      const name = $('authName').value.trim();
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });
      await setDoc(doc(db, 'users', credential.user.uid), {
        displayName: name, email: credential.user.email || email, phone: '', city: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      try { await sendEmailVerification(credential.user); } catch (mailError) { console.warn('Verification email could not be sent', mailError); }
      closeDialog('authDialog');
      $('authForm').reset();
      showToast('Hesabın oluşturuldu. E-posta doğrulama bağlantını kontrol et; ilan vermeden önce adresini doğrula.', 'success', 7000);
    } else {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      closeDialog('authDialog');
      $('authForm').reset();
      showToast(`Hoş geldin${credential.user.displayName ? `, ${credential.user.displayName}` : ''}.`);
    }
  } catch (error) {
    errorNode.textContent = authErrorText(error);
    errorNode.hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = state.authMode === 'register' ? 'Hesap oluştur' : 'Giriş yap';
  }
}
async function ensureVerified() {
  if (!state.user) { openAuth('login'); return false; }
  try {
    await reload(state.user);
    await state.user.getIdToken(true);
    if (!state.user.emailVerified) {
      showToast('Bu işlem için e-posta adresini doğrulaman gerekiyor. Gelen kutundaki doğrulama bağlantısını açıp sayfayı yenile.', 'warning', 7000);
      return false;
    }
    return true;
  } catch (error) {
    showToast(authErrorText(error), 'error');
    return false;
  }
}
function clearSubscription(key) {
  if (typeof state[key] === 'function') state[key]();
  state[key] = null;
}
async function loadUserProfile(user) {
  try {
    const profileRef = doc(db, 'users', user.uid);
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) state.profile = profileSnap.data();
    else {
      state.profile = { displayName: user.displayName || 'Pazario kullanıcısı', email: user.email || '', phone: '', city: '' };
      await setDoc(profileRef, { ...state.profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
  } catch (error) {
    console.warn('Profile load failed', error);
    state.profile = { displayName: user.displayName || 'Pazario kullanıcısı', email: user.email || '', phone: '', city: '' };
  }
}
function bindUserSubscriptions() {
  clearSubscription('unsubFavorites');
  clearSubscription('unsubSaved');
  state.favorites = new Set();
  state.savedSearches = [];
  if (!state.user || !db) { renderListings(); updateSavedSearchCount(); return; }
  state.unsubFavorites = onSnapshot(collection(db, 'users', state.user.uid, 'favorites'), (snap) => {
    state.favorites = new Set(snap.docs.map((item) => item.id));
    renderListings();
  }, (error) => console.warn('Favorite subscription failed', error));
  state.unsubSaved = onSnapshot(collection(db, 'users', state.user.uid, 'savedSearches'), (snap) => {
    state.savedSearches = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    state.savedSearches.sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
    updateSavedSearchCount();
    if ($('savedSearchDialog').open) renderSavedSearches();
  }, (error) => console.warn('Saved search subscription failed', error));
}
function updateAccountButtons() {
  const label = state.user ? 'Çıkış yap' : 'Giriş yap';
  $('accountBtn').textContent = label;
  $('mobileAccount').textContent = state.user ? 'Çıkış yap' : 'Hesabım / Giriş';
  $('myListingsBtn').textContent = state.user ? 'İlanlarım' : 'İlanlarım';
  $('myMessagesBtn').textContent = state.user ? 'Mesajlar' : 'Mesajlar';
  const adminButtonExists = $('adminNavButton');
  const isAdmin = state.user && ADMIN_UIDS.includes(state.user.uid);
  if (isAdmin && !adminButtonExists) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'adminNavButton'; btn.className = 'text-button'; btn.textContent = 'Yönetim';
    btn.addEventListener('click', openAdminPanel);
    document.querySelector('.header-actions').prepend(btn);
  } else if (!isAdmin && adminButtonExists) adminButtonExists.remove();
}
function initializeDataSubscriptions() {
  if (!state.configured || !db) return;
  clearSubscription('unsubListings');
  state.unsubListings = onSnapshot(query(collection(db, 'listings'), where('status', '==', 'published'), limit(100)), (snapshot) => {
    state.listings = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    state.listings.sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
    renderListings();
  }, (error) => {
    console.error('Public listings query failed', error);
    showToast('İlanlar yüklenemedi. Firestore güvenlik kurallarını ve bağlantı ayarlarını kontrol et.', 'error', 6500);
  });
}
function initializeFirebase() {
  if (!state.configured) {
    if (location.hostname === 'localhost' || new URLSearchParams(location.search).has('setup')) $('setupNotice').hidden = false;
    state.listings = [];
    renderListings();
    return;
  }
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    initializeDataSubscriptions();
    onAuthStateChanged(auth, async (user) => {
      state.user = user;
      state.profile = null;
      updateAccountButtons();
      if (user) {
        await loadUserProfile(user);
        bindUserSubscriptions();
        if (state.pendingFavoriteId) {
          const id = state.pendingFavoriteId;
          state.pendingFavoriteId = null;
          await toggleFavorite(id, true);
        }
      } else {
        clearSubscription('unsubFavorites'); clearSubscription('unsubSaved');
        state.favorites = new Set(); state.savedSearches = [];
        state.myListings = [];
        renderListings(); updateSavedSearchCount();
      }
      updateAccountButtons();
    }, (error) => {
      console.error('Auth initialization failed', error);
      showToast('Oturum sistemi başlatılamadı. Firebase Authentication ayarlarını kontrol et.', 'error', 6500);
    });
  } catch (error) {
    console.error('Firebase initialization failed', error);
    showToast('Firebase ayarları geçersiz. firebase-config.js dosyasını kontrol et.', 'error', 7000);
  }
}

async function onAccountButton() {
  if (!state.user) { openAuth('login'); return; }
  const confirmLogout = window.confirm('Pazario hesabından çıkış yapmak istiyor musun?');
  if (!confirmLogout) return;
  try { await signOut(auth); showToast('Oturum kapatıldı.'); }
  catch (error) { showToast(authErrorText(error), 'error'); }
}
async function toggleFavorite(listingId, forceAdd = false) {
  if (!state.configured || !db) { firebaseNotReadyMessage(); return; }
  if (!state.user) {
    state.pendingFavoriteId = listingId;
    openAuth('login');
    showToast('Favorilerini hesabında saklamak için giriş yap.', 'warning');
    return;
  }
  const favoriteRef = doc(db, 'users', state.user.uid, 'favorites', listingId);
  try {
    if (state.favorites.has(listingId) && !forceAdd) {
      await deleteDoc(favoriteRef);
      showToast('İlan favorilerden çıkarıldı.');
    } else if (!state.favorites.has(listingId)) {
      await setDoc(favoriteRef, { listingId, createdAt: serverTimestamp() });
      showToast('İlan favorilerine eklendi.');
    }
  } catch (error) {
    console.error(error);
    showToast('Favori kaydedilemedi. Hesabını ve Firestore kurallarını kontrol et.', 'error');
  }
}
function openListingForm() {
  if (!state.configured) { firebaseNotReadyMessage(); return; }
  if (!state.user) { openAuth('register'); showToast('İlan vermek için önce ücretsiz hesap oluştur.', 'warning'); return; }
  ensureVerified().then((verified) => {
    if (!verified) return;
    resetListingForm();
    openDialog('listingDialog');
  });
}
function resetListingForm() {
  $('listingDialog').querySelector('.modal-heading h2').textContent = 'İlanını oluştur';
  $('listingDialog').querySelector('.modal-heading p:not(.section-kicker)').textContent = 'Bilgileri doğru gir. İlanın yayınlanmadan önce incelemeye alınır.';
  $('publishListingBtn').textContent = 'İncelemeye gönder';
  $('listingForm').reset();
  state.listingStep = 1;
  state.selectedFiles = [];
  state.existingPhotos = [];
  state.editingListingId = null;
  state.previewUrls.forEach((url) => URL.revokeObjectURL(url));
  state.previewUrls = [];
  $('photoPreview').innerHTML = '';
  $('listingError').hidden = true;
  $('descriptionCount').textContent = '0';
  updateSubcategorySelect('listingSubcategory', '', 'Alt kategori seç');
  renderDynamicListingFields();
  renderWizard();
  updateReview();
  $('uploadConfigNote').textContent = isCloudinaryConfigured() ? 'Fotoğraflar ücretsiz Cloudinary alanına yüklenecek.' : 'Cloudinary ayarı yok. Şimdilik doğrudan fotoğraf bağlantısı ekleyebilirsin.';
}
function renderWizard() {
  document.querySelectorAll('[data-wizard-panel]').forEach((panel) => { panel.hidden = Number(panel.dataset.wizardPanel) !== state.listingStep; });
  document.querySelectorAll('[data-wizard-indicator]').forEach((item) => {
    const step = Number(item.dataset.wizardIndicator);
    item.classList.toggle('current', step === state.listingStep);
    item.classList.toggle('done', step < state.listingStep);
  });
  $('wizardBack').hidden = state.listingStep === 1;
  $('wizardNext').hidden = state.listingStep === 3;
  $('publishListingBtn').hidden = state.listingStep !== 3;
}
function validateCurrentStep() {
  const panel = document.querySelector(`[data-wizard-panel="${state.listingStep}"]`);
  const inputs = [...panel.querySelectorAll('input,select,textarea')].filter((input) => !input.disabled && input.type !== 'file' && input.type !== 'checkbox' && !input.closest('[hidden]'));
  for (const input of inputs) {
    if (!input.checkValidity()) { input.reportValidity(); input.focus(); return false; }
  }
  return true;
}
function updateReview() {
  $('reviewTitle').textContent = $('listingTitle').value.trim() || '—';
  const category = getCategory($('listingCategory').value);
  $('reviewCategory').textContent = category ? `${category.name}${$('listingSubcategory').value ? ` / ${$('listingSubcategory').value}` : ''}` : '—';
  $('reviewPrice').textContent = $('listingPrice').value !== '' ? formatPrice($('listingPrice').value) : '—';
  $('reviewCity').textContent = [$('listingDistrict').value.trim(), $('listingCity').value].filter(Boolean).join(', ') || '—';
}
function renderPhotoPreview() {
  const existing = state.existingPhotos.map((photo, index) => {
    const url = safeImageUrl(typeof photo === 'string' ? photo : photo?.url);
    return url ? `<div class="photo-preview-item"><img src="${escapeHtml(url)}" alt="Kayıtlı fotoğraf ${index + 1}"><button type="button" data-remove-existing-photo="${index}" aria-label="Kayıtlı fotoğrafı kaldır">×</button></div>` : '';
  }).join('');
  const uploads = state.selectedFiles.map((file, index) => {
    const url = state.previewUrls[index];
    return `<div class="photo-preview-item"><img src="${escapeHtml(url)}" alt="Yeni fotoğraf ${index + 1}"><button type="button" data-remove-photo="${index}" aria-label="Fotoğrafı kaldır">×</button></div>`;
  }).join('');
  $('photoPreview').innerHTML = existing + uploads;
}
function acceptSelectedFiles(fileList) {
  const all = [...state.selectedFiles];
  const chosen = [...fileList];
  const available = Math.max(0, 5 - state.existingPhotos.length - all.length);
  const tooMany = Math.max(0, chosen.length - available);
  for (const file of chosen.slice(0, available)) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { showToast(`${file.name}: yalnızca JPG, PNG ve WebP dosyaları kabul edilir.`, 'warning'); continue; }
    if (file.size > 5 * 1024 * 1024) { showToast(`${file.name}: dosya 5 MB sınırını aşıyor.`, 'warning'); continue; }
    all.push(file);
  }
  if (tooMany) showToast('Bir ilana en fazla 5 fotoğraf ekleyebilirsin.', 'warning');
  state.previewUrls.forEach((url) => URL.revokeObjectURL(url));
  state.selectedFiles = all;
  state.previewUrls = all.map((file) => URL.createObjectURL(file));
  renderPhotoPreview();
  $('listingPhotos').value = '';
}
async function uploadPhoto(file) {
  if (!isCloudinaryConfigured()) throw new Error('Cloudinary ayarı eksik. cloudinary-config.js dosyasını doldur veya fotoğraf URL alanını kullan.');
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', cloudinaryConfig.uploadPreset);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudinaryConfig.cloudName)}/image/upload`, { method: 'POST', body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.secure_url) throw new Error(data.error?.message || 'Fotoğraf yüklenemedi. Cloudinary preset ayarlarını kontrol et.');
  return { url: data.secure_url, publicId: data.public_id || '' };
}
async function getPhotosForListing() {
  const photos = state.existingPhotos.map((photo) => typeof photo === 'string' ? { url: photo, publicId: '' } : { url: photo.url, publicId: photo.publicId || '' });
  for (let i = 0; i < state.selectedFiles.length && photos.length < 5; i++) {
    $('publishListingBtn').textContent = `Fotoğraflar yükleniyor (${i + 1}/${state.selectedFiles.length})…`;
    photos.push(await uploadPhoto(state.selectedFiles[i]));
  }
  const fallback = safeImageUrl($('photoUrlFallback').value);
  if (fallback && photos.length < 5 && !photos.some((photo) => photo.url === fallback)) photos.push({ url: fallback, publicId: '' });
  return photos.slice(0, 5);
}
async function publishListing(event) {
  event.preventDefault();
  if (state.listingStep < 3) { $('wizardNext').click(); return; }
  $('listingError').hidden = true;
  if (!$('listingConsent').checked) { $('listingError').textContent = 'İlanı göndermek için doğruluk onayını işaretle.'; $('listingError').hidden = false; return; }
  const verified = await ensureVerified();
  if (!verified) return;
  const title = $('listingTitle').value.trim();
  const description = $('listingDescription').value.trim();
  if (title.length < 8 || description.length < 20) { $('listingError').textContent = 'Başlık en az 8, açıklama en az 20 karakter olmalı.'; $('listingError').hidden = false; return; }
  if (!$('listingCity').value || !$('listingCategory').value) { $('listingError').textContent = 'Kategori ve il seçimi zorunludur.'; $('listingError').hidden = false; return; }
  const submit = $('publishListingBtn');
  submit.disabled = true;
  submit.textContent = 'İlan hazırlanıyor…';
  try {
    const photos = await getPhotosForListing();
    const profileName = (state.profile?.displayName || state.user.displayName || 'Pazario kullanıcısı').trim().slice(0, 70);
    const listing = {
      title, description, price: Number($('listingPrice').value), categoryId: $('listingCategory').value,
      subcategory: $('listingSubcategory').value || '', listingType: $('listingType').value,
      condition: $('listingCondition').value, city: $('listingCity').value,
      district: $('listingDistrict').value.trim().slice(0, 70), sellerType: $('sellerType').value,
      negotiable: $('listingNegotiable').checked, shipping: $('listingShipping').checked,
      photos, attributes: getAttributes('listingAttr'), ownerId: state.user.uid,
      ownerName: profileName, status: 'pending', updatedAt: serverTimestamp()
    };
    let savedId = state.editingListingId;
    if (savedId) {
      await updateDoc(doc(db, 'listings', savedId), listing);
      showToast('İlan güncellendi ve yeniden incelemeye gönderildi.', 'success', 7000);
    } else {
      listing.createdAt = serverTimestamp();
      const created = await addDoc(collection(db, 'listings'), listing);
      savedId = created.id;
      showToast('İlanın incelemeye gönderildi. Yönetici onayından sonra yayına alınacak.', 'success', 7000);
    }
    closeDialog('listingDialog');
    state.previewUrls.forEach((url) => URL.revokeObjectURL(url));
    state.selectedFiles = []; state.previewUrls = []; state.existingPhotos = []; state.editingListingId = null;
    await openMyListings();
    console.info('Listing saved', savedId);
  } catch (error) {
    console.error(error);
    $('listingError').textContent = error.message || 'İlan kaydedilemedi. Firebase güvenlik kuralları ve yapılandırmayı kontrol et.';
    $('listingError').hidden = false;
    submit.textContent = 'Tekrar dene';
  } finally {
    submit.disabled = false;
    if (state.listingStep === 3 && submit.textContent === 'İlan hazırlanıyor…') submit.textContent = 'İncelemeye gönder';
  }
}

function getListingById(id) {
  return state.listings.find((listing) => listing.id === id) || state.myListings.find((listing) => listing.id === id) || state.adminListings.find((listing) => listing.id === id) || null;
}
function openListingDetail(id) {
  let listing = getListingById(id);
  if (!listing) { showToast('Bu ilan artık görüntülenemiyor.', 'warning'); return; }
  if (listing.status !== 'published' && listing.ownerId !== state.user?.uid && !ADMIN_UIDS.includes(state.user?.uid)) {
    showToast('Bu ilan şu anda yayınlanmıyor.', 'warning'); return;
  }
  state.currentDetail = listing;
  state.selectedDetailPhoto = 0;
  $('detailTitle').textContent = listing.title || 'İlan detayları';
  $('detailMeta').textContent = `${categoryDisplay(listing)}${listing.subcategory ? ` · ${listing.subcategory}` : ''} · ${formatDate(listing.createdAt)}`;
  renderListingDetail();
  openDialog('detailDialog');
}
function renderListingDetail() {
  const listing = state.currentDetail;
  if (!listing) return;
  const photos = (Array.isArray(listing.photos) ? listing.photos : []).map((photo) => safeImageUrl(typeof photo === 'string' ? photo : photo?.url)).filter(Boolean);
  const mainImage = photos[state.selectedDetailPhoto] || photos[0] || '';
  const isOwner = state.user?.uid === listing.ownerId;
  const statusClass = listing.status === 'published' ? 'status-published' : listing.status === 'rejected' ? 'status-rejected' : 'status-pending';
  const statusText = listing.status === 'published' ? 'Yayında' : listing.status === 'rejected' ? 'Reddedildi' : 'İncelemede';
  const detailFacts = [
    ['Kategori', categoryDisplay(listing)], ['Alt kategori', listing.subcategory || 'Belirtilmedi'],
    ['Konum', [listing.district, listing.city].filter(Boolean).join(', ') || 'Belirtilmedi'],
    ['İlan türü', listing.listingType || 'Belirtilmedi'], ['Ürün durumu', listing.condition || 'Belirtilmedi'],
    ['Satıcı türü', listing.sellerType || 'Bireysel'], ['İlan tarihi', formatDate(listing.createdAt)]
  ];
  for (const [key, value] of Object.entries(listing.attributes || {})) {
    const field = getCategory(listing.categoryId)?.fields?.find((x) => x.key === key);
    detailFacts.push([field?.label || key, String(value)]);
  }
  $('detailBody').innerHTML = `
    <div class="detail-gallery"><div class="detail-gallery-main">${mainImage ? `<img src="${escapeHtml(mainImage)}" alt="${escapeHtml(listing.title)}" referrerpolicy="no-referrer">` : `<div class="listing-no-photo"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 3 3 3-4 5 6"/></svg><span>Fotoğraf eklenmemiş</span></div>`}</div>
      ${photos.length > 1 ? `<div class="detail-thumbnails">${photos.map((photo, index) => `<button class="${index === state.selectedDetailPhoto ? 'selected' : ''}" data-detail-photo="${index}" type="button" aria-label="Fotoğraf ${index + 1}"><img src="${escapeHtml(photo)}" alt=""></button>`).join('')}</div>` : ''}</div>
    <div class="detail-info"><div class="detail-price">${formatPrice(listing.price)}</div><div class="detail-badges">${listing.negotiable ? '<span class="detail-badge">Pazarlık payı</span>' : ''}${listing.shipping ? '<span class="detail-badge">Kargo seçeneği</span>' : ''}<span class="status-pill ${statusClass}">${statusText}</span></div>
      <div class="seller-box"><h3>${escapeHtml(listing.ownerName || 'Pazario kullanıcısı')}</h3><p>${escapeHtml(listing.sellerType || 'Bireysel')} satıcı · ${escapeHtml([listing.district, listing.city].filter(Boolean).join(', '))}</p></div>
      <div class="detail-facts">${detailFacts.map(([label, value]) => `<div class="detail-fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>
      <div class="detail-actions">${!isOwner && listing.status === 'published' ? `<button type="button" class="button button-primary" data-contact-seller="${escapeHtml(listing.id)}">Satıcıya mesaj gönder</button><button type="button" class="button button-outline" data-report-listing="${escapeHtml(listing.id)}">Şikâyet et</button>` : ''}${isOwner ? `<button type="button" class="button button-outline" data-edit-listing="${escapeHtml(listing.id)}">Düzenle</button><button type="button" class="button button-outline" data-delete-listing="${escapeHtml(listing.id)}">İlanı sil</button>` : ''}<button type="button" class="button button-outline" data-detail-favorite="${escapeHtml(listing.id)}">${state.favorites.has(listing.id) ? 'Favorilerden çıkar' : 'Favorilere ekle'}</button></div>
    </div><div class="detail-description"><h3>İlan açıklaması</h3><p>${escapeHtml(listing.description || 'Satıcı açıklama eklememiş.')}</p></div>`;
}
async function openEditListing(id) {
  if (!state.user) { openAuth('login'); return; }
  let listing = getListingById(id);
  if (!listing || listing.ownerId !== state.user.uid) { showToast('Yalnızca kendi ilanını düzenleyebilirsin.', 'error'); return; }
  if (!(await ensureVerified())) return;
  resetListingForm();
  state.editingListingId = listing.id;
  state.existingPhotos = (Array.isArray(listing.photos) ? listing.photos : []).slice(0, 5).map((photo) => typeof photo === 'string' ? { url: photo, publicId: '' } : photo);
  $('listingTitle').value = listing.title || '';
  $('listingCategory').value = listing.categoryId || '';
  updateSubcategorySelect('listingSubcategory', listing.categoryId || '', 'Alt kategori seç', listing.subcategory || '');
  renderDynamicListingFields();
  for (const [key, value] of Object.entries(listing.attributes || {})) {
    const input = $(`listingAttr-${key}`);
    if (input) input.value = String(value);
  }
  $('listingPrice').value = listing.price ?? '';
  $('listingType').value = listing.listingType || 'Satılık';
  $('listingCity').value = listing.city || '';
  $('listingDistrict').value = listing.district || '';
  $('listingCondition').value = listing.condition || 'Belirtilmedi';
  $('sellerType').value = listing.sellerType || 'Bireysel';
  $('listingDescription').value = listing.description || '';
  $('descriptionCount').textContent = String($('listingDescription').value.length);
  $('listingNegotiable').checked = Boolean(listing.negotiable);
  $('listingShipping').checked = Boolean(listing.shipping);
  $('photoUrlFallback').value = '';
  $('listingConsent').checked = false;
  $('listingDialog').querySelector('.modal-heading h2').textContent = 'İlanını düzenle';
  $('listingDialog').querySelector('.modal-heading p:not(.section-kicker)').textContent = 'Kaydettiğinde ilan yeniden incelemeye gönderilir.';
  $('publishListingBtn').textContent = 'Değişiklikleri incelemeye gönder';
  renderPhotoPreview(); updateReview(); state.listingStep = 1; renderWizard(); openDialog('listingDialog');
}

async function openMyListings() {
  if (!state.user) { openAuth('login'); return; }
  if (!state.configured) { firebaseNotReadyMessage(); return; }
  $('myListingsContent').innerHTML = '<div class="account-empty">İlanlar yükleniyor…</div>';
  openDialog('myListingsDialog');
  try {
    const snapshot = await getDocs(query(collection(db, 'listings'), where('ownerId', '==', state.user.uid)));
    state.myListings = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a,b)=>(toDate(b.createdAt)?.getTime()||0)-(toDate(a.createdAt)?.getTime()||0));
    renderMyListings();
  } catch (error) {
    console.error(error);
    $('myListingsContent').innerHTML = '<div class="account-empty">İlanlar getirilemedi. Firestore kurallarını kontrol et.</div>';
  }
}
function renderMyListings() {
  if (!state.myListings.length) {
    $('myListingsContent').innerHTML = '<div class="account-empty">Henüz ilan oluşturmadın. İlan verdiğinde yayın ve inceleme durumunu burada görebilirsin.</div><button type="button" class="button button-primary" id="myListingsCreate">İlk ilanını oluştur</button>';
    $('myListingsCreate')?.addEventListener('click', () => { closeDialog('myListingsDialog'); openListingForm(); });
    return;
  }
  $('myListingsContent').innerHTML = state.myListings.map((listing) => {
    const statusClass = listing.status === 'published' ? 'status-published' : listing.status === 'rejected' ? 'status-rejected' : 'status-pending';
    const statusText = listing.status === 'published' ? 'Yayında' : listing.status === 'rejected' ? 'Reddedildi' : 'İncelemede';
    return `<div class="account-row"><div class="account-row-image">${listingPhoto(listing) ? `<img src="${escapeHtml(listingPhoto(listing))}" alt="">` : ''}</div><div class="account-row-main"><strong>${escapeHtml(listing.title)}</strong><p>${formatPrice(listing.price)} · ${escapeHtml(categoryDisplay(listing))} · ${escapeHtml(formatDate(listing.createdAt))}</p><p><span class="status-pill ${statusClass}">${statusText}</span>${listing.status === 'rejected' && listing.moderationNote ? ` · ${escapeHtml(listing.moderationNote)}` : ''}</p></div><div class="account-row-actions"><button class="small-button" type="button" data-detail="${escapeHtml(listing.id)}">Görüntüle</button><button class="small-button" type="button" data-edit-listing="${escapeHtml(listing.id)}">Düzenle</button><button class="small-button danger" type="button" data-delete-listing="${escapeHtml(listing.id)}">Sil</button></div></div>`;
  }).join('');
}
async function deleteListing(id) {
  if (!state.user || !db) return;
  if (!window.confirm('Bu ilanı kalıcı olarak silmek istiyor musun?')) return;
  try {
    await deleteDoc(doc(db, 'listings', id));
    state.myListings = state.myListings.filter((item) => item.id !== id);
    state.adminListings = state.adminListings.filter((item) => item.id !== id);
    if (state.currentDetail?.id === id) closeDialog('detailDialog');
    if ($('myListingsDialog').open) renderMyListings();
    if ($('adminDialog').open) renderAdminListings();
    showToast('İlan silindi.');
  } catch (error) {
    console.error(error);
    showToast('İlan silinemedi. Yalnızca kendi ilanlarını silebilirsin.', 'error');
  }
}

async function saveCurrentSearch() {
  if (!state.user) { openAuth('login'); showToast('Aramaları hesabında saklamak için giriş yap.', 'warning'); return; }
  const filters = { ...state.filters, attributes: { ...(state.filters.attributes || {}) } };
  const name = [filters.q || '', getCategory(filters.categoryId)?.name || '', filters.city || ''].filter(Boolean).join(' · ') || 'Tüm ilanlar';
  try {
    await addDoc(collection(db, 'users', state.user.uid, 'savedSearches'), { name: name.slice(0, 100), filters, createdAt: serverTimestamp() });
    showToast('Arama kaydedildi.');
  } catch (error) { console.error(error); showToast('Arama kaydedilemedi.', 'error'); }
}
function updateSavedSearchCount() { $('savedSearchCount').textContent = String(state.savedSearches.length); }
function renderSavedSearches() {
  if (!state.savedSearches.length) {
    $('savedSearchContent').innerHTML = '<div class="account-empty">Henüz kayıtlı araman yok.</div>';
    return;
  }
  $('savedSearchContent').innerHTML = state.savedSearches.map((saved) => `<div class="saved-search-row"><div class="saved-search-main"><strong>${escapeHtml(saved.name || 'Kayıtlı arama')}</strong><p>${escapeHtml(saved.filters?.city || 'Türkiye geneli')}${saved.filters?.q ? ` · ${escapeHtml(saved.filters.q)}` : ''}</p></div><button type="button" class="small-button" data-apply-search="${escapeHtml(saved.id)}">Uygula</button><button type="button" class="small-button danger" data-delete-search="${escapeHtml(saved.id)}">Sil</button></div>`).join('');
}
async function openSavedSearches() {
  if (!state.user) { openAuth('login'); return; }
  openDialog('savedSearchDialog');
  renderSavedSearches();
}
async function deleteSavedSearch(id) {
  try { await deleteDoc(doc(db, 'users', state.user.uid, 'savedSearches', id)); showToast('Kayıtlı arama silindi.'); }
  catch (error) { showToast('Arama silinemedi.', 'error'); }
}

async function openContactSeller(listingId) {
  const listing = getListingById(listingId);
  if (!listing || listing.status !== 'published') return;
  if (!state.user) { openAuth('login'); showToast('Satıcıya mesaj göndermek için giriş yap.', 'warning'); return; }
  if (listing.ownerId === state.user.uid) { showToast('Kendi ilanına mesaj gönderemezsin.', 'warning'); return; }
  if (!(await ensureVerified())) return;
  try {
    const existingSnapshot = await getDocs(query(collection(db, 'conversations'), where('participantIds', 'array-contains', state.user.uid)));
    const existing = existingSnapshot.docs.find((item) => item.data().listingId === listing.id && item.data().ownerId === listing.ownerId);
    if (existing) {
      const conversation = { id: existing.id, ...existing.data() };
      await openChat(conversation);
      return;
    }
    const participants = [state.user.uid, listing.ownerId];
    const newConversation = await addDoc(collection(db, 'conversations'), {
      listingId: listing.id, listingTitle: listing.title, buyerId: state.user.uid,
      buyerName: state.profile?.displayName || state.user.displayName || 'Kullanıcı',
      ownerId: listing.ownerId, ownerName: listing.ownerName || 'Satıcı', participantIds: participants,
      lastMessage: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    await openChat({ id: newConversation.id, listingId: listing.id, listingTitle: listing.title, buyerId: state.user.uid, buyerName: state.profile?.displayName || state.user.displayName || 'Kullanıcı', ownerId: listing.ownerId, ownerName: listing.ownerName || 'Satıcı', participantIds: participants });
  } catch (error) {
    console.error(error);
    showToast('Mesajlaşma başlatılamadı. E-posta doğrulamasını ve Firestore kurallarını kontrol et.', 'error', 6000);
  }
}
async function openMyMessages() {
  if (!state.user) { openAuth('login'); return; }
  $('conversationList').innerHTML = '<div class="account-empty">Mesajlar yükleniyor…</div>';
  openDialog('messagesDialog');
  try {
    const snapshot = await getDocs(query(collection(db, 'conversations'), where('participantIds', 'array-contains', state.user.uid), limit(100)));
    const conversations = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a,b)=>(toDate(b.updatedAt)?.getTime()||0)-(toDate(a.updatedAt)?.getTime()||0));
    renderConversations(conversations);
  } catch (error) { console.error(error); $('conversationList').innerHTML = '<div class="account-empty">Mesajlar getirilemedi. Kuralları kontrol et.</div>'; }
}
function renderConversations(conversations) {
  if (!conversations.length) { $('conversationList').innerHTML = '<div class="account-empty">Henüz mesajlaşman yok. Yayındaki bir ilanın detayından satıcıya mesaj gönderebilirsin.</div>'; return; }
  $('conversationList').innerHTML = conversations.map((conversation) => {
    const otherName = state.user.uid === conversation.buyerId ? conversation.ownerName : conversation.buyerName;
    return `<button type="button" class="conversation-row" data-open-chat="${escapeHtml(conversation.id)}"><span class="conversation-avatar">${escapeHtml((otherName || 'P').charAt(0).toLocaleUpperCase('tr-TR'))}</span><span class="conversation-main"><strong>${escapeHtml(conversation.listingTitle || 'İlan görüşmesi')}</strong><p>${escapeHtml(otherName || 'Pazario kullanıcısı')} · ${escapeHtml(conversation.lastMessage || 'Sohbeti aç')}</p></span><span class="conversation-date">${escapeHtml(formatDate(conversation.updatedAt))}</span></button>`;
  }).join('');
  state._conversationCache = conversations;
}
async function openChat(conversation) {
  state.currentConversation = conversation;
  state.currentConversationId = conversation.id;
  $('chatTitle').textContent = conversation.listingTitle || 'İlan görüşmesi';
  const otherName = state.user.uid === conversation.buyerId ? conversation.ownerName : conversation.buyerName;
  $('chatSubtitle').textContent = `Görüştüğün kişi: ${otherName || 'Pazario kullanıcısı'}`;
  $('chatMessages').innerHTML = '<div class="account-empty">Mesajlar yükleniyor…</div>';
  closeDialog('messagesDialog');
  openDialog('chatDialog');
  clearSubscription('unsubChat');
  state.unsubChat = onSnapshot(query(collection(db, 'conversations', conversation.id, 'messages'), limit(150)), (snapshot) => {
    const messages = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a,b)=>(toDate(a.createdAt)?.getTime()||0)-(toDate(b.createdAt)?.getTime()||0));
    $('chatMessages').innerHTML = messages.map((message) => `<div class="chat-message ${message.senderId === state.user.uid ? 'mine' : ''}">${escapeHtml(message.text)}<time>${escapeHtml(formatDate(message.createdAt))}</time></div>`).join('') || '<div class="account-empty">İlk mesajı sen gönder.</div>';
    $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
  }, (error) => { console.error(error); showToast('Mesajlar yüklenemedi.', 'error'); });
}
async function sendChatMessage(event) {
  event.preventDefault();
  const text = $('chatInput').value.trim();
  const conversation = state.currentConversation;
  if (!text || !conversation || !state.user) return;
  if (!(await ensureVerified())) return;
  const submit = $('chatForm').querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    await addDoc(collection(db, 'conversations', conversation.id, 'messages'), { senderId: state.user.uid, text: text.slice(0, 2000), createdAt: serverTimestamp() });
    await updateDoc(doc(db, 'conversations', conversation.id), { lastMessage: text.slice(0, 2000), updatedAt: serverTimestamp() });
    $('chatInput').value = '';
  } catch (error) { console.error(error); showToast('Mesaj gönderilemedi. E-posta doğrulaması ve güvenlik kuralları gerekli.', 'error', 6000); }
  finally { submit.disabled = false; }
}
async function reportListing(listingId) {
  if (!state.user) { openAuth('login'); return; }
  if (!(await ensureVerified())) return;
  const reason = window.prompt('Şikâyet nedeni (ör. yanlış bilgi, sahte ilan, yasaklı ürün):');
  if (!reason || reason.trim().length < 3) return;
  const details = window.prompt('Ek açıklama (isteğe bağlı):') || '';
  try {
    await addDoc(collection(db, 'reports'), { listingId, reporterId: state.user.uid, reason: reason.trim().slice(0,80), details: details.trim().slice(0,1000), createdAt: serverTimestamp() });
    showToast('Şikâyetin alındı. Teşekkür ederiz.');
  } catch (error) { console.error(error); showToast('Şikâyet kaydedilemedi. E-posta doğrulamanı kontrol et.', 'error'); }
}
async function openAdminPanel() {
  if (!state.user || !ADMIN_UIDS.includes(state.user.uid)) { showToast('Yönetim yetkin bulunmuyor.', 'error'); return; }
  openDialog('adminDialog');
  $('adminListings').innerHTML = '<div class="account-empty">İnceleme kuyruğu yükleniyor…</div>';
  try {
    const snapshot = await getDocs(query(collection(db, 'listings'), where('status', '==', 'pending'), limit(100)));
    state.adminListings = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a,b)=>(toDate(a.createdAt)?.getTime()||0)-(toDate(b.createdAt)?.getTime()||0));
    renderAdminListings();
    await loadAdminReports();
  } catch (error) { console.error(error); $('adminListings').innerHTML = '<div class="account-empty">İlanlar okunamadı. Yönetici UID ve Firestore kurallarını kontrol et.</div>'; }
}
async function loadAdminReports() {
  if (!state.user || !ADMIN_UIDS.includes(state.user.uid)) return;
  try {
    const snapshot = await getDocs(query(collection(db, 'reports'), limit(100)));
    state.adminReports = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a,b)=>(toDate(b.createdAt)?.getTime()||0)-(toDate(a.createdAt)?.getTime()||0));
    renderAdminReports();
  } catch (error) {
    console.error(error);
    $('adminReports').innerHTML = '<div class="account-empty">Şikâyetler okunamadı. Yönetici UID ve Firestore kurallarını kontrol et.</div>';
  }
}
function renderAdminReports() {
  if (!state.adminReports.length) { $('adminReports').innerHTML = '<div class="account-empty">Henüz şikâyet bulunmuyor.</div>'; return; }
  $('adminReports').innerHTML = state.adminReports.map((report) => {
    const listing = getListingById(report.listingId);
    const heading = listing?.title || `İlan kimliği: ${String(report.listingId || '').slice(0, 12)}`;
    return `<div class="account-row"><div class="account-row-main"><strong>${escapeHtml(heading)}</strong><p>${escapeHtml(report.reason || 'Neden belirtilmedi')} · ${escapeHtml(formatDate(report.createdAt))}</p><p class="report-details">${escapeHtml(report.details || 'Ek açıklama yok')} · Bildiren kullanıcı: ${escapeHtml(String(report.reporterId || '').slice(0, 8))}…</p><p class="report-status">${report.reviewed ? 'İncelendi' : 'İncelenmedi'}</p></div><div class="account-row-actions">${listing ? `<button type="button" class="small-button" data-detail="${escapeHtml(listing.id)}">İlanı aç</button>` : ''}${!report.reviewed ? `<button type="button" class="small-button" data-review-report="${escapeHtml(report.id)}">İncelendi</button>` : ''}<button type="button" class="small-button danger" data-delete-report="${escapeHtml(report.id)}">Sil</button></div></div>`;
  }).join('');
}
async function markReportReviewed(id) {
  if (!state.user || !ADMIN_UIDS.includes(state.user.uid)) return;
  try {
    await updateDoc(doc(db, 'reports', id), { reviewed: true, reviewedBy: state.user.uid, reviewedAt: serverTimestamp() });
    state.adminReports = state.adminReports.map((report) => report.id === id ? { ...report, reviewed: true } : report);
    renderAdminReports();
    showToast('Şikâyet incelendi olarak işaretlendi.');
  } catch (error) { console.error(error); showToast('Şikâyet güncellenemedi.', 'error'); }
}
async function deleteReport(id) {
  if (!state.user || !ADMIN_UIDS.includes(state.user.uid) || !window.confirm('Bu şikâyet kaydını silmek istiyor musun?')) return;
  try {
    await deleteDoc(doc(db, 'reports', id));
    state.adminReports = state.adminReports.filter((report) => report.id !== id);
    renderAdminReports();
    showToast('Şikâyet kaydı silindi.');
  } catch (error) { console.error(error); showToast('Şikâyet silinemedi.', 'error'); }
}
function renderAdminListings() {
  if (!state.adminListings.length) { $('adminListings').innerHTML = '<div class="account-empty">Bekleyen ilan yok.</div>'; return; }
  $('adminListings').innerHTML = state.adminListings.map((listing) => `<div class="account-row"><div class="account-row-image">${listingPhoto(listing) ? `<img src="${escapeHtml(listingPhoto(listing))}" alt="">` : ''}</div><div class="account-row-main"><strong>${escapeHtml(listing.title)}</strong><p>${escapeHtml(listing.ownerName)} · ${escapeHtml(listing.city)} · ${formatPrice(listing.price)}</p><p>${escapeHtml(formatDate(listing.createdAt))}</p></div><div class="account-row-actions"><button type="button" class="small-button" data-detail="${escapeHtml(listing.id)}">İncele</button><button type="button" class="small-button" data-publish="${escapeHtml(listing.id)}">Yayınla</button><button type="button" class="small-button danger" data-reject="${escapeHtml(listing.id)}">Reddet</button></div></div>`).join('');
}
async function moderateListing(id, status) {
  if (!state.user || !ADMIN_UIDS.includes(state.user.uid)) return;
  const note = status === 'rejected' ? (window.prompt('Reddetme nedeni (kullanıcıya gösterilecek):') || 'İlan yayın koşullarına uygun değil.').slice(0,400) : '';
  try {
    const ref = doc(db, 'listings', id);
    const patch = { status, updatedAt: serverTimestamp() };
    if (status === 'published') patch.publishedAt = serverTimestamp();
    else patch.moderationNote = note;
    await updateDoc(ref, patch);
    state.adminListings = state.adminListings.filter((listing) => listing.id !== id);
    renderAdminListings();
    showToast(status === 'published' ? 'İlan yayınlandı.' : 'İlan reddedildi.');
  } catch (error) { console.error(error); showToast('İşlem yapılamadı. Yönetici UID listesini Firestore kurallarıyla eşleştir.', 'error'); }
}

function resetFilters() {
  $('searchForm').reset(); $('filterForm').reset();
  $('heroCategory').value = ''; $('heroCity').value = '';
  updateSubcategorySelect('filterSubcategory', '', 'Tüm alt kategoriler');
  applyFiltersToForm(EMPTY_FILTERS());
  setSearchUrl();
}
function applyCategory(categoryId) {
  const filters = { ...state.filters, categoryId, subcategory: '', attributes: {} };
  $('heroCategory').value = categoryId;
  $('filterCategory').value = categoryId;
  updateSubcategorySelect('filterSubcategory', categoryId, 'Tüm alt kategoriler');
  applyFiltersToForm(filters);
  setSearchUrl();
  $('results').scrollIntoView({ behavior: 'smooth' });
}
function toggleMobileFilters(open) {
  $('filterPanel').classList.toggle('mobile-open', open);
  document.body.classList.toggle('modal-open', open || Boolean(document.querySelector('dialog[open]')));
}
function bindEvents() {
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => closeDialog(button.dataset.close)));
  document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('close', refreshModalBodyLock));
  $('accountBtn').addEventListener('click', onAccountButton);
  $('mobileAccount').addEventListener('click', async () => { $('mobileMenu').hidden = true; await onAccountButton(); });
  $('loginTab').addEventListener('click', () => setAuthMode('login'));
  $('registerTab').addEventListener('click', () => setAuthMode('register'));
  $('authForm').addEventListener('submit', handleAuthSubmit);
  $('passwordResetBtn').addEventListener('click', async () => {
    if (!firebaseCallAllowed()) return;
    const email = $('authEmail').value.trim();
    if (!email) { $('authError').textContent = 'Şifre sıfırlama bağlantısı için önce e-posta adresini gir.'; $('authError').hidden = false; return; }
    try { await sendPasswordResetEmail(auth, email); showToast('Şifre sıfırlama bağlantısı e-posta adresine gönderildi.'); }
    catch (error) { $('authError').textContent = authErrorText(error); $('authError').hidden = false; }
  });
  $('openListing').addEventListener('click', openListingForm);
  $('heroListingLink').addEventListener('click', openListingForm);
  $('bottomListingBtn').addEventListener('click', openListingForm);
  $('emptyCreateListing').addEventListener('click', openListingForm);
  $('listingCategory').addEventListener('change', () => {
    updateSubcategorySelect('listingSubcategory', $('listingCategory').value, 'Alt kategori seç');
    renderDynamicListingFields(); updateReview();
  });
  $('filterCategory').addEventListener('change', () => {
    updateSubcategorySelect('filterSubcategory', $('filterCategory').value, 'Tüm alt kategoriler');
    $('heroCategory').value = $('filterCategory').value;
    renderDynamicSearchFilters();
  });
  $('filterSubcategory').addEventListener('change', () => { state.filters.subcategory = $('filterSubcategory').value; });
  $('searchForm').addEventListener('submit', (event) => {
    event.preventDefault();
    applyFiltersToForm({ ...state.filters, q: $('searchQuery').value.trim(), categoryId: $('heroCategory').value, city: $('heroCity').value });
    setSearchUrl(); $('results').scrollIntoView({ behavior: 'smooth' });
  });
  $('filterForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const filters = currentFiltersFromForm();
    if (!$('filterCategory').value) filters.categoryId = $('heroCategory').value || '';
    if (!$('filterCity').value) filters.city = $('heroCity').value || '';
    applyFiltersToForm(filters); setSearchUrl(); toggleMobileFilters(false);
  });
  $('advancedSearchBtn').addEventListener('click', () => { $('results').scrollIntoView({ behavior: 'smooth' }); if (window.innerWidth <= 850) toggleMobileFilters(true); });
  $('resetFilters').addEventListener('click', resetFilters);
  $('resetFilters').addEventListener('keydown', (e) => { if (e.key === 'Enter') resetFilters(); });
  $('emptyClearFilters').addEventListener('click', resetFilters);
  $('mobileFilterTrigger').addEventListener('click', () => toggleMobileFilters(true));
  $('filterClose').addEventListener('click', () => toggleMobileFilters(false));
  $('sortSelect').addEventListener('change', renderListings);
  $('gridViewBtn').addEventListener('click', () => { state.view = 'grid'; renderListings(); });
  $('listViewBtn').addEventListener('click', () => { state.view = 'list'; renderListings(); });
  $('categoryGrid').addEventListener('click', (event) => { const button = event.target.closest('[data-category-pick]'); if (button) applyCategory(button.dataset.categoryPick); });
  $('allCategoriesBtn').addEventListener('click', () => { $('categoryGrid').scrollIntoView({ behavior: 'smooth' }); });
  $('listingGrid').addEventListener('click', async (event) => {
    const favorite = event.target.closest('[data-favorite]');
    const detail = event.target.closest('[data-detail]');
    if (favorite) { event.stopPropagation(); await toggleFavorite(favorite.dataset.favorite); }
    else if (detail) openListingDetail(detail.dataset.detail);
    else { const card = event.target.closest('[data-card-id]'); if (card) openListingDetail(card.dataset.cardId); }
  });
  $('detailBody').addEventListener('click', async (event) => {
    const photo = event.target.closest('[data-detail-photo]');
    const favorite = event.target.closest('[data-detail-favorite]');
    const contact = event.target.closest('[data-contact-seller]');
    const report = event.target.closest('[data-report-listing]');
    const deletion = event.target.closest('[data-delete-listing]');
    const edit = event.target.closest('[data-edit-listing]');
    if (photo) { state.selectedDetailPhoto = Number(photo.dataset.detailPhoto); renderListingDetail(); }
    if (favorite) { await toggleFavorite(favorite.dataset.detailFavorite); renderListingDetail(); }
    if (contact) await openContactSeller(contact.dataset.contactSeller);
    if (report) await reportListing(report.dataset.reportListing);
    if (edit) { closeDialog('detailDialog'); await openEditListing(edit.dataset.editListing); }
    if (deletion) await deleteListing(deletion.dataset.deleteListing);
  });
  $('myListingsContent').addEventListener('click', async (event) => {
    const detail = event.target.closest('[data-detail]'); const deletion = event.target.closest('[data-delete-listing]'); const edit = event.target.closest('[data-edit-listing]');
    if (detail) openListingDetail(detail.dataset.detail);
    if (edit) { closeDialog('myListingsDialog'); await openEditListing(edit.dataset.editListing); }
    if (deletion) await deleteListing(deletion.dataset.deleteListing);
  });
  $('adminListings').addEventListener('click', async (event) => {
    const detail = event.target.closest('[data-detail]'); const publish = event.target.closest('[data-publish]'); const reject = event.target.closest('[data-reject]');
    if (detail) openListingDetail(detail.dataset.detail);
    if (publish) await moderateListing(publish.dataset.publish, 'published');
    if (reject) await moderateListing(reject.dataset.reject, 'rejected');
  });
  $('adminReports').addEventListener('click', async (event) => {
    const detail = event.target.closest('[data-detail]'); const reviewed = event.target.closest('[data-review-report]'); const deletion = event.target.closest('[data-delete-report]');
    if (detail) openListingDetail(detail.dataset.detail);
    if (reviewed) await markReportReviewed(reviewed.dataset.reviewReport);
    if (deletion) await deleteReport(deletion.dataset.deleteReport);
  });
  $('refreshReportsBtn').addEventListener('click', loadAdminReports);
  $('favoritesBtn').addEventListener('click', () => {
    if (!state.user) { openAuth('login'); showToast('Favorilerini görmek için giriş yap.', 'warning'); return; }
    const favListings = state.listings.filter((listing) => state.favorites.has(listing.id));
    if (!favListings.length) { showToast('Henüz favorilere eklediğin yayınlanmış ilan yok.', 'warning'); return; }
    state.filters = { ...EMPTY_FILTERS(), q: '' };
    $('searchQuery').value = '';
    $('listingGrid').innerHTML = favListings.map(listingCardMarkup).join('');
    $('emptyState').hidden = true;
    $('resultsCount').textContent = `${favListings.length} favori ilan`;
    $('resultsHeading').textContent = 'Favori ilanlarım';
    $('results').scrollIntoView({ behavior: 'smooth' });
  });
  $('saveSearchBtn').addEventListener('click', saveCurrentSearch);
  $('savedSearchesBtn').addEventListener('click', openSavedSearches);
  $('savedSearchContent').addEventListener('click', async (event) => {
    const apply = event.target.closest('[data-apply-search]'); const del = event.target.closest('[data-delete-search]');
    if (apply) { const saved = state.savedSearches.find((x) => x.id === apply.dataset.applySearch); if (saved) { applyFiltersToForm(saved.filters); closeDialog('savedSearchDialog'); setSearchUrl(); $('results').scrollIntoView({ behavior: 'smooth' }); } }
    if (del) await deleteSavedSearch(del.dataset.deleteSearch);
  });
  $('myListingsBtn').addEventListener('click', openMyListings);
  $('mobileMyListings').addEventListener('click', () => { $('mobileMenu').hidden = true; openMyListings(); });
  $('myMessagesBtn').addEventListener('click', openMyMessages);
  $('mobileMyMessages').addEventListener('click', () => { $('mobileMenu').hidden = true; openMyMessages(); });
  $('chatDialog').addEventListener('close', () => clearSubscription('unsubChat'));
  $('messagesDialog').addEventListener('close', refreshModalBodyLock);
  $('conversationList').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-open-chat]'); if (!button) return;
    const conversation = state._conversationCache?.find((item) => item.id === button.dataset.openChat);
    if (conversation) await openChat(conversation);
  });
  $('chatForm').addEventListener('submit', sendChatMessage);
  $('listingForm').addEventListener('submit', publishListing);
  $('wizardNext').addEventListener('click', () => {
    if (!validateCurrentStep()) return;
    if (state.listingStep < 3) { state.listingStep++; renderWizard(); updateReview(); }
  });
  $('wizardBack').addEventListener('click', () => { if (state.listingStep > 1) { state.listingStep--; renderWizard(); } });
  $('listingPhotos').addEventListener('change', (event) => acceptSelectedFiles(event.target.files));
  $('photoPreview').addEventListener('click', (event) => {
    const existing = event.target.closest('[data-remove-existing-photo]');
    if (existing) { state.existingPhotos.splice(Number(existing.dataset.removeExistingPhoto), 1); renderPhotoPreview(); return; }
    const btn = event.target.closest('[data-remove-photo]'); if (!btn) return;
    const index = Number(btn.dataset.removePhoto);
    state.selectedFiles.splice(index, 1);
    state.previewUrls.forEach((url) => URL.revokeObjectURL(url));
    state.previewUrls = state.selectedFiles.map((file) => URL.createObjectURL(file));
    renderPhotoPreview();
  });
  $('listingTitle').addEventListener('input', updateReview);
  $('listingPrice').addEventListener('input', updateReview);
  $('listingCity').addEventListener('change', updateReview);
  $('listingDistrict').addEventListener('input', updateReview);
  $('listingSubcategory').addEventListener('change', updateReview);
  $('listingDescription').addEventListener('input', () => { $('descriptionCount').textContent = String($('listingDescription').value.length); });
  $('mobileMenuToggle').addEventListener('click', () => {
    const menu = $('mobileMenu'); const open = menu.hidden;
    menu.hidden = !open; $('mobileMenuToggle').setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && $('filterPanel').classList.contains('mobile-open')) toggleMobileFilters(false); });
  window.addEventListener('focus', async () => { if (state.user) { try { await reload(state.user); } catch {} } });
}

initSelects();
bindEvents();
setAuthMode('login');
setSearchUrlFromInitialParams();
function setSearchUrlFromInitialParams() {
  const params = new URLSearchParams(window.location.search);
  const filters = EMPTY_FILTERS();
  filters.q = params.get('q') || '';
  const category = params.get('category');
  filters.categoryId = getCategory(category)?.id || '';
  filters.city = CITIES.includes(params.get('city')) ? params.get('city') : '';
  applyFiltersToForm(filters);
}
initializeFirebase();
