function setLang(lang) {
  document.querySelectorAll("[data-es]").forEach(el => {
    el.textContent = el.getAttribute("data-" + lang);
  });
}

setLang("ca");