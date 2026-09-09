(function () {
  var installPrompt = null;
  var button = document.querySelector('[data-install-app]');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    installPrompt = event;
    if (button) button.setAttribute('data-ready', '');
  });

  window.addEventListener('appinstalled', function () {
    installPrompt = null;
    if (button) button.removeAttribute('data-ready');
  });

  if (button) {
    button.addEventListener('click', function () {
      if (!installPrompt) return;
      installPrompt.prompt();
      installPrompt.userChoice.finally(function () {
        installPrompt = null;
        button.removeAttribute('data-ready');
      });
    });
  }
})();
