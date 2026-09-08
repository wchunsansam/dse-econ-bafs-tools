const BAFS_COOKIE = "htms-pp=1";
const ECON_COOKIE = "htms-econ-pp=1";

export const config = {
  matcher: ["/past_papers.html", "/past_papers_econ.html", "/past_papers/:path*"]
};

function hasCookie(request, expected) {
  const raw = request.headers.get("cookie") || "";
  return raw.split(";").some(function (part) {
    return part.trim() === expected;
  });
}

function bounce(request, flag) {
  const url = new URL(request.url);
  const home = new URL("/index.html", url);
  home.searchParams.set("lang", url.searchParams.get("lang") || "en");
  home.searchParams.set(flag, "1");
  return Response.redirect(home, 302);
}

export default function middleware(request) {
  const path = new URL(request.url).pathname.replace(/\\/g, "/");

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
