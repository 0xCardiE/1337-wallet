try {
  if (chrome.runtime.getManifest().update_url) {
    document.body.textContent = 'Reload is unpacked-only.';
  } else {
    chrome.runtime.reload();
  }
} catch (err) {
  document.body.textContent = String(err);
}
