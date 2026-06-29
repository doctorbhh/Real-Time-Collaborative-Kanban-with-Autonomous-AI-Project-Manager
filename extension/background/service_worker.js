

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_AUTH_TOKEN') {
    chrome.storage.local.get('token').then(result => {
      sendResponse({ token: result.token ?? null });
    });
    return true; 
  }
});
