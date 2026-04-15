const apiInput = document.getElementById("apiUrl");
const saveBtn  = document.getElementById("saveBtn");
const savedMsg = document.getElementById("savedMsg");

chrome.storage.local.get("apiBase", (data) => {
  apiInput.value = data.apiBase || "http://localhost:8000";
});
