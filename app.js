import { upload } from "@vercel/blob/client";

const $ = (id) => document.getElementById(id);
const state = { files: [], view: "grid", filter: "all", search: "" };
let deleteTokens = JSON.parse(localStorage.getItem("openfiles-delete-tokens") || "{}");

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes/1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes/1024**2).toFixed(1)} MB`;
  return `${(bytes/1024**3).toFixed(2)} GB`;
}
function formatDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Recently" : d.toLocaleDateString(undefined, {month:"short",day:"numeric",year:"numeric"});
}
function kind(file) {
  const mime = (file.contentType || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.includes("pdf") || mime.includes("word") || mime.includes("officedocument") || mime.startsWith("text/")) return "document";
  return "other";
}
function icon(file) {
  const mime = (file.contentType || "").toLowerCase();
  if (mime.startsWith("image/")) return ["▧","image"];
  if (mime.includes("pdf")) return ["PDF","pdf"];
  if (mime.includes("word") || mime.includes("officedocument.word")) return ["W","document"];
  if (mime.startsWith("video/")) return ["▶","video"];
  if (mime.includes("zip") || mime.includes("compressed")) return ["ZIP","other"];
  if (mime.startsWith("text/")) return ["TXT","document"];
  return ["▤","other"];
}
function toast(message, error = false) {
  const node = document.createElement("div");
  node.className = `toast${error ? " error" : ""}`;
  node.textContent = message;
  $("toastRegion").appendChild(node);
  setTimeout(() => node.remove(), 4000);
}
function showMessage(text, error = false) {
  const el = $("message");
  el.textContent = text;
  el.className = `message ${error ? "error" : "success"}`;
}
async function loadFiles() {
  try {
    const res = await fetch("/api/files");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Could not load files (${res.status})`);
    state.files = data.files || [];
    renderFiles();
    $("message").classList.add("hidden");
  } catch (err) {
    state.files = [];
    renderFiles();
    showMessage(`Storage API error: ${err.message}. Check the Vercel deployment logs and Blob connection.`, true);
  }
}
function renderFiles() {
  const filtered = state.files.filter(f => {
    const matchesSearch = (f.name || "").toLowerCase().includes(state.search.toLowerCase());
    const matchesType = state.filter === "all" || kind(f) === state.filter;
    return matchesSearch && matchesType;
  });
  $("navCount").textContent = state.files.length;
  $("fileCount").textContent = `${filtered.length} ${filtered.length === 1 ? "item" : "items"}`;
  const grid = $("fileGrid");
  grid.className = `file-grid${state.view === "list" ? " list-mode" : ""}`;
  if (!filtered.length) {
    grid.innerHTML = "";
    $("emptyState").classList.add("show");
    $("emptyState").querySelector("h3").textContent = state.files.length ? "No files match your search" : "Your shared space is ready";
    $("emptyState").querySelector("p").textContent = state.files.length ? "Try another search term or file type." : "Upload your first file and it will appear here for everyone.";
    $("emptyState").querySelector("button").classList.toggle("hidden", state.files.length > 0);
    return;
  }
  $("emptyState").classList.remove("show");
  grid.innerHTML = filtered.map(file => {
    const [glyph, cls] = icon(file);
    const owned = Boolean(deleteTokens[file.id]);
    return `<article class="file-card">
      <div class="file-top"><div class="file-type-icon ${cls}">${glyph}</div><div class="file-menu"><button class="mini-action" title="Preview" data-action="preview" data-id="${escapeHtml(file.id)}">↗</button></div></div>
      <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
      <div class="file-meta"><span>${formatSize(file.size)}</span><span>${formatDate(file.createdAt)}</span></div>
      <div class="file-divider"></div>
      <div class="file-actions"><button class="file-action" data-action="preview" data-id="${escapeHtml(file.id)}">◉ <span>Preview</span></button><a class="file-action" href="${escapeHtml(file.url)}" target="_blank" rel="noopener" download="${escapeHtml(file.name)}">↓ <span>Download</span></a>${owned ? `<button class="file-action delete" data-action="delete" data-id="${escapeHtml(file.id)}">× <span>Delete</span></button>` : ""}</div>
    </article>`;
  }).join("");
}
async function uploadFiles(files) {
  if (!files || !files.length) return;
  $("uploadProgress").classList.remove("hidden");
  let done = 0;
  const total = files.length;
  for (const file of files) {
    try {
      $("progressLabel").textContent = `Uploading ${file.name} (${done + 1} of ${total})`;
      const ownerToken = crypto.randomUUID() + crypto.randomUUID();
      const safeName = file.name.replace(/[^\w.\- ()]/g, "_").slice(-140) || "file";
      const pathname = `openfiles-uploads/${crypto.randomUUID()}-${safeName}`;
      const result = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        multipart: file.size > 5 * 1024 * 1024,
        clientPayload: JSON.stringify({ ownerToken }),
        onUploadProgress: (event) => {
          const percent = Math.round(((done + event.percentage / 100) / total) * 100);
          $("progressPercent").textContent = `${percent}%`;
          $("progressBar").style.width = `${percent}%`;
        }
      });
      deleteTokens[result.pathname] = ownerToken;
      localStorage.setItem("openfiles-delete-tokens", JSON.stringify(deleteTokens));
      done++;
    } catch (err) {
      toast(`${file.name}: ${err.message || "Upload failed"}`, true);
    }
  }
  $("progressBar").style.width = "100%";
  $("progressPercent").textContent = "Done";
  setTimeout(() => $("uploadProgress").classList.add("hidden"), 900);
  $("fileInput").value = "";
  await loadFiles();
  if (done) toast(`${done} file${done === 1 ? "" : "s"} uploaded successfully`);
}
async function previewFile(id) {
  const file = state.files.find(f => f.id === id);
  if (!file) return;
  $("previewName").textContent = file.name;
  $("previewMeta").textContent = `${formatSize(file.size)} · ${formatDate(file.createdAt)}`;
  $("previewDownload").href = file.url;
  $("previewDownload").download = file.name;
  const content = $("previewContent");
  content.innerHTML = `<div class="preview-unavailable"><div class="big-icon">◌</div>Loading preview…</div>`;
  $("previewModal").classList.remove("hidden");
  const mime = (file.contentType || "").toLowerCase();
  const url = file.url;
  if (mime.startsWith("image/")) content.innerHTML = `<img src="${escapeHtml(url)}" alt="${escapeHtml(file.name)}">`;
  else if (mime === "application/pdf" || mime.includes("pdf")) content.innerHTML = `<iframe title="PDF preview" src="${escapeHtml(url)}"></iframe>`;
  else if (mime.startsWith("text/") || /\.(txt|md|json|csv|log|html|css|js)$/i.test(file.name)) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Preview unavailable");
      const text = await res.text();
      content.innerHTML = `<pre>${escapeHtml(text.slice(0, 500000))}${text.length > 500000 ? "\n\n[Preview truncated]" : ""}</pre>`;
    } catch {
      content.innerHTML = `<div class="preview-unavailable"><div class="big-icon">▤</div>Preview is unavailable.<br>Try downloading the file.</div>`;
    }
  } else if (mime.startsWith("video/")) content.innerHTML = `<video controls style="max-width:100%;max-height:100%" src="${escapeHtml(url)}"></video>`;
  else if (mime.startsWith("audio/")) content.innerHTML = `<audio controls src="${escapeHtml(url)}" style="width:min(600px,100%)"></audio>`;
  else content.innerHTML = `<div class="preview-unavailable"><div class="big-icon">▤</div><strong>No in-browser preview for this format</strong><p>You can still download this file.</p><a class="secondary-btn" href="${escapeHtml(url)}" target="_blank" rel="noopener">↓ Download file</a></div>`;
}
async function deleteFile(id) {
  const ownerToken = deleteTokens[id];
  if (!ownerToken) return toast("Delete is only available in the browser that uploaded this file.", true);
  const file = state.files.find(f => f.id === id);
  if (!confirm(`Delete "${file?.name || "this file"}"? This cannot be undone.`)) return;
  try {
    const res = await fetch("/api/delete", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ownerToken}` }, body: JSON.stringify({ pathname: id }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not delete file");
    delete deleteTokens[id];
    localStorage.setItem("openfiles-delete-tokens", JSON.stringify(deleteTokens));
    toast("File deleted");
    await loadFiles();
  } catch (err) { toast(err.message, true); }
}
$("browseBtn").addEventListener("click", e => { e.stopPropagation(); $("fileInput").click(); });
$("uploadTop").addEventListener("click", () => $("fileInput").click());
$("emptyUpload").addEventListener("click", () => $("fileInput").click());
$("dropzone").addEventListener("click", e => { if (!e.target.closest("button")) $("fileInput").click(); });
$("fileInput").addEventListener("change", e => uploadFiles([...e.target.files]));
$("dropzone").addEventListener("dragover", e => { e.preventDefault(); $("dropzone").classList.add("dragover"); });
$("dropzone").addEventListener("dragleave", () => $("dropzone").classList.remove("dragover"));
$("dropzone").addEventListener("drop", e => { e.preventDefault(); $("dropzone").classList.remove("dragover"); uploadFiles([...e.dataTransfer.files]); });
$("searchInput").addEventListener("input", e => { state.search = e.target.value; renderFiles(); });
$("typeFilter").addEventListener("change", e => { state.filter = e.target.value; renderFiles(); });
$("gridView").addEventListener("click", () => { state.view = "grid"; $("gridView").classList.add("selected"); $("listView").classList.remove("selected"); renderFiles(); });
$("listView").addEventListener("click", () => { state.view = "list"; $("listView").classList.add("selected"); $("gridView").classList.remove("selected"); renderFiles(); });
$("fileGrid").addEventListener("click", e => { const btn = e.target.closest("[data-action]"); if (!btn) return; const {action,id} = btn.dataset; if (action === "preview") previewFile(id); if (action === "delete") deleteFile(id); });
$("closePreview").addEventListener("click", () => $("previewModal").classList.add("hidden"));
$("previewModal").addEventListener("click", e => { if (e.target === $("previewModal")) $("previewModal").classList.add("hidden"); });
document.addEventListener("keydown", e => { if (e.key === "Escape") $("previewModal").classList.add("hidden"); });
$("themeBtn").addEventListener("click", () => { document.body.classList.toggle("dark"); localStorage.setItem("openfiles-theme", document.body.classList.contains("dark") ? "dark" : "light"); });
if (localStorage.getItem("openfiles-theme") === "dark") document.body.classList.add("dark");
loadFiles();
setInterval(loadFiles, 60000);
