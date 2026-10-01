const BAFS_COOKIE = "htms-pp=1";
const ECON_COOKIE = "htms-econ-pp=1";
const WCS_COOKIE = "htms-wcs=1";
const WCS_ONLY_COOKIE = "htms-wcs-only=1";

export const config = {
  matcher: [
    "/",
    "/index.html",
    "/past_papers.html",
    "/past_papers_econ.html",
    "/past_papers/:path*",
    "/wcs.html",
    "/econ_notes/:path*",
    "/econ_tools/:path*"
  ]
};

function hasCookie(request, expected) {
  const raw = request.headers.get("cookie") || "";
  return raw.split(";").some(function (part) {
    return part.trim() === expected;
  });
}

function bounce(request, flag) {
  const url = new URL(request.url);
  const home = new URL("https://dse-econ-bafs-tools.vercel.app/index.html");
  home.searchParams.set("lang", url.searchParams.get("lang") || "en");
  home.searchParams.set(flag, "1");
  return Response.redirect(home, 302);
}

function wcsHome(request) {
  const url = new URL(request.url);
  const dest = new URL("https://dse-econ-bafs-tools.vercel.app/wcs.html");
  dest.searchParams.set("lang", url.searchParams.get("lang") || "en");
  return Response.redirect(dest, 302);
}

function isWcsHubPath(path) {
  return /\/wcs\.html$/i.test(path);
}

function isWcsNotesPath(path) {
  return /\/econ_notes\/wcs_/i.test(path);
}

function isNotesChromePath(path) {
  return /\/econ_notes\/lib\/[^/]+\.(css|js)$/i.test(path);
}

export default function middleware(request) {
  const path = new URL(request.url).pathname.replace(/\\/g, "/");

  if (isWcsNotesPath(path)) {
    if (hasCookie(request, WCS_COOKIE)) return;
    if (hasCookie(request, WCS_ONLY_COOKIE)) return wcsHome(request);
    return bounce(request, "wcs");
  }

  if (isWcsHubPath(path)) {
    if (hasCookie(request, WCS_COOKIE) || hasCookie(request, WCS_ONLY_COOKIE)) return;
    return bounce(request, "wcs");
  }

  if (isNotesChromePath(path)) return;

  if (hasCookie(request, WCS_ONLY_COOKIE)) return wcsHome(request);

  if (
    /\/past_papers_econ\.html$/i.test(path) ||
    /\/past_papers\/econ\/catalog\.json$/i.test(path) ||
    /\/past_papers\/econ\/.+\.pdf$/i.test(path)
  ) {
    if (hasCookie(request, ECON_COOKIE)) return;
    return bounce(request, "ppe");
  }

  if (/\/past_papers\.html$/i.test(path) || /\/past_papers\/bafs\//i.test(path)) {
    if (hasCookie(request, BAFS_COOKIE)) return;
    return bounce(request, "pp");
  }
}
