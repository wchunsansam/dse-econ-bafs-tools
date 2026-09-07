const COOKIE = "htms-pp=1";

export const config = {
  matcher: ["/past_papers.html", "/past_papers/:path*"]
};

function cookieOk(request) {
  const raw = request.headers.get("cookie") || "";
  return raw.split(";").some(function (part) {
    return part.trim() === COOKIE;
  });
}

export default function middleware(request) {
  if (cookieOk(request)) return;
  const url = new URL(request.url);
  const home = new URL("/index.html", url);
  home.searchParams.set("lang", url.searchParams.get("lang") || "en");
  home.searchParams.set("pp", "1");
  return Response.redirect(home, 302);
}
