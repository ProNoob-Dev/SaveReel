import { LOCALES, STATIC_BY_SLUG, TOOLS } from "../config";

export function buildSitemap(base: string): string {
  const enabled = LOCALES.filter((locale) => locale.enabled);
  const paths = [
    "",
    ...TOOLS.map((tool) => `/${tool.slug}`),
    ...Array.from(STATIC_BY_SLUG.keys()).map((slug) => `/${slug}`),
  ];
  const today = new Date().toISOString().slice(0, 10);

  const urls = enabled.flatMap((locale) =>
    paths.map((path) => {
      const loc = `${base}/${locale.code}${path}`;
      const priority = path === "" ? "1.0" : "0.8";
      return `<url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${priority}</priority></url>`;
    }),
  );

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
}

export function buildRobots(base: string): string {
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`;
}
