export function buildRoomShareUrl(roomId, { includeOrigin = true } = {}) {
  const path = `/room/${encodeURIComponent(roomId)}`;
  if (includeOrigin && typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  return path;
}

export async function copyRoomShareLink(roomId) {
  const url = buildRoomShareUrl(roomId);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return url;
  }
  const textarea = document.createElement("textarea");
  textarea.value = url;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  return url;
}

export function parseRoomRouteParams(params, searchParams) {
  const roomId = params?.roomId ? decodeURIComponent(params.roomId) : "";
  const stealthToken = searchParams?.get("stealth") || "";
  return { roomId, stealthToken };
}
