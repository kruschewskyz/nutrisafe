// Aplica o tema salvo (ou o do sistema) antes da página renderizar. Não guarda nenhum dado sensível.
(function () {
  try {
    var saved = localStorage.getItem('ns-theme');
    var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {
    /* localStorage indisponível: segue com o tema padrão */
  }
})();
