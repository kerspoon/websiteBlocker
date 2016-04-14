chrome.extension.onRequest.addListener(function(request, sender) {
  console.log('onRequest', sender.tab.id, request.redirect);
  chrome.tabs.update(sender.tab.id, {url: request.redirect});
});
