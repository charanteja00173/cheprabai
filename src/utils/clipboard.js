// Clipboard helper that works everywhere — including non-HTTPS origins
// (LAN IPs, http previews) where navigator.clipboard is undefined.

export async function safeCopyText(text) {
  if (!text && text !== "") return false;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    // fall through to legacy path (also covers permission denials)
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, String(text).length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch (err) {
    return false;
  }
}

// Copies an image blob to the clipboard when supported (HTTPS + PNG),
// otherwise falls back to copying the source URL as text.
export async function safeCopyImage(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    if (
      blob.type === "image/png" &&
      navigator.clipboard &&
      typeof window.ClipboardItem === "function" &&
      typeof navigator.clipboard.write === "function"
    ) {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return { ok: true, mode: "image" };
    }
  } catch (err) {
    // fall through to URL copy
  }
  const ok = await safeCopyText(imageUrl);
  return { ok, mode: "url" };
}
