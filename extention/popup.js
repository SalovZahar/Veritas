const apiInput = document.getElementById("apiUrl");
const saveBtn  = document.getElementById("saveBtn");
const savedMsg = document.getElementById("savedMsg");

chrome.storage.local.get("apiBase", (data) => {
  apiInput.value = data.apiBase || "http://localhost:8000";
});

saveBtn.addEventListener("click", () => {
  const val = apiInput.value.trim().replace(/\/$/, "");
  if (!val) return;
  chrome.storage.local.set({ apiBase: val }, () => {
    savedMsg.textContent = "✓ Saved";
    setTimeout(() => { savedMsg.textContent = ""; }, 2000);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "UPDATE_API_BASE", apiBase: val });
      }
    });
  });
});
