(() => {
  'use strict';
  if (window.__FM_FB_DEFAULTS__) return;
  window.__FM_FB_DEFAULTS__ = true;

  // ✅ TU CONFIG (se usará como default si los inputs están vacíos)
  const CFG = {
    apiKey: "AIzaSyDgBBnuISNIaQF2hluowQESzVaE-pEiUsY",
    authDomain: "factumiral.firebaseapp.com",
    projectId: "factumiral",
    storageBucket: "factumiral.firebasestorage.app",
    messagingSenderId: "576821038417",
    appId: "1:576821038417:web:aba329f36563134bb01770",
    measurementId: "G-HJVL8ET49L",
    databaseURL: "https://factumiral-default-rtdb.europe-west1.firebasedatabase.app"
  };

  // Export global para otros parches (y por si firebase-cloud.js lo usa)
  window.FM_FIREBASE_DEFAULT_CONFIG = CFG;

  const $ = (s, r=document) => r.querySelector(s);

  function fillIfEmpty(id, val){
    const el = $(id);
    if (!el) return;
    if ((el.value || '').trim()) return;
    el.value = val || '';
    el.dispatchEvent(new Event('input', { bubbles:true }));
    el.dispatchEvent(new Event('change', { bubbles:true }));
  }

  function applyDefaults(){
    fillIfEmpty('#fbApiKey',     CFG.apiKey);
    fillIfEmpty('#fbAuthDomain', CFG.authDomain);
    fillIfEmpty('#fbProjectId',  CFG.projectId);
    fillIfEmpty('#fbAppId',      CFG.appId);
    fillIfEmpty('#fbStorage',    CFG.storageBucket);
    fillIfEmpty('#fbDbUrl',      CFG.databaseURL);

    const on = $('#ajCloudOn');
    if (on && !on.checked) {
      on.checked = true;
      on.dispatchEvent(new Event('change', { bubbles:true }));
    }
  }

  document.addEventListener('DOMContentLoaded', applyDefaults);
})();
