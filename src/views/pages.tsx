import { Layout } from "./layout";
import {
  Faq,
  HowItWorks,
  Ledger,
  RelatedTools,
  ResultSection,
  SearchForm,
  SectionHead,
  ToolGrid,
  TrustNotes,
} from "./components";
import type { Dictionary } from "../i18n/en";
import type { PresentedResult } from "../lib/present";
import type { StatsSnapshot } from "../lib/stats";
import { TOOLS, type Tool } from "../config";

export type PageProps = {
  brand: string;
  origin: string;
  locale: string;
  dict: Dictionary;
  result?: PresentedResult;
  query?: string;
  error?: { message: string; hint?: string };
  status?: number;
  stats?: StatsSnapshot;
};

function ErrorBlock({ error }: { error: { message: string; hint?: string } }) {
  return (
    <div class="alert" role="alert">
      <b>{error.message}</b>
      {error.hint ? <span>{error.hint}</span> : null}
    </div>
  );
}

const HOME_FAQ: { q: string; a: string }[] = [
  {
    q: "Is this free to use?",
    a: "Yes. There is no account, no quota and no upsell. The Worker runs on Cloudflare's free tier, so the only ceiling is Cloudflare's request allowance.",
  },
  {
    q: "Do I need to log in with Instagram?",
    a: "No. Public posts, reels and photos resolve anonymously. Stories, highlights and private accounts need the site operator to configure an Instagram session — that is a server-side secret, never something you enter here.",
  },
  {
    q: "Can you see the links I paste?",
    a: "The link itself is not stored. It is processed in the request and the resolved descriptor is cached for ten minutes so repeated lookups stay cheap. The only thing written down is an aggregate counter, and it contains no IP address, user agent or link.",
  },
  {
    q: "What do the counters on this page count?",
    a: "Files actually served, their total size, successful resolutions, and the downloads that happened today. They are integers per day in a small database — no per-visitor rows, no advertising pixels, nothing to opt out of.",
  },
  {
    q: "Why does a download link stop working?",
    a: "Every file link is signed for 30 minutes, and Instagram's own CDN URLs rotate on top of that. If a link expires, run the same search again.",
  },
  {
    q: "Does this remove watermarks?",
    a: "It does not have to. Resolution reads the same public file Instagram serves, which carries no downloader watermark. Any text baked in by the creator stays.",
  },
  {
    q: "What about private accounts?",
    a: "No tool can read a private account it has no access to. The private tool reuses a session account's own permissions, which means it only works for posts that account can already see in the app.",
  },
  {
    q: "How much does it cost to run?",
    a: "One Worker, Cloudflare's cache and a tiny D1 database for the counters — typically inside the free tier for a small site. There is no queue, no container and no media storage.",
  },
];

function StructuredData(props: {
  brand: string;
  origin: string;
  locale: string;
  description: string;
  faq: { q: string; a: string }[];
}) {
  const { brand, origin, locale, description, faq } = props;
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: brand,
      url: `${origin}/${locale}`,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any",
      description,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: TOOLS.map((tool) => tool.h1),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ];
}

export function HomePage(props: PageProps) {
  const { brand, origin, locale, dict, result, query, error, stats } = props;
  const description = dict.hero.lede;

  return (
    <Layout
      brand={brand}
      origin={origin}
      locale={locale}
      dict={dict}
      title={`${brand} — ${dict.hero.h1}`}
      description={description}
      path=""
      jsonLd={StructuredData({ brand, origin, locale, description, faq: HOME_FAQ })}
    >
      <section class="hero">
        <div class="wrap hero-grid">
          <div class="hero-inner hero-lead">
            <h1 class="display-1">
              <span class="h1-kicker">{dict.hero.h1}</span>
              {dict.hero.displayA}
              <br />
              <em>{dict.hero.displayB}</em>
            </h1>
            <p class="hero-lede">{dict.hero.lede}</p>

            <SearchForm
              action={`/${locale}`}
              placeholder={dict.hero.placeholder}
              dict={dict}
              tool="video"
              locale={locale}
              value={query}
              autoFocus={!result}
            />

            <div id="result-slot">
              {error ? <ErrorBlock error={error} /> : null}
              {result ? <ResultSection result={result} dict={dict} /> : null}
            </div>

            <p class="hero-meta mono">{dict.hero.meta}</p>
          </div>

          <div class="hero-aside">{stats ? <Ledger snapshot={stats} dict={dict} /> : null}</div>
        </div>
      </section>

      <div class="ticker">
        <div class="wrap ticker-inner">
          {TOOLS.map((tool, index) => (
            <span>
              {index > 0 ? <i aria-hidden="true">·</i> : null}
              {tool.nav}
            </span>
          ))}
        </div>
      </div>

      <ToolGrid locale={locale} dict={dict} tools={TOOLS} />
      <HowItWorks dict={dict} />
      <TrustNotes dict={dict} />

      <Faq items={HOME_FAQ} title={dict.sections.faqTitle} lede={dict.sections.faqLede} index="04" />

      <section class="section">
        <div class="wrap">
          <div class="install">
            <div>
              <h2 class="display-3">{dict.sections.appTitle}</h2>
              <p>{dict.sections.appLede}</p>
            </div>
            <button class="btn primary" id="install-app" type="button" hidden>
              {dict.sections.appButton}
            </button>
          </div>
        </div>
      </section>
    </Layout>
  );
}

function toolSpec(tool: Tool, dict: Dictionary): { accepts: string; format: string; requiresSession: boolean } {
  const accepts =
    tool.accepts === "profile"
      ? dict.spec.acceptsProfile
      : tool.accepts === "story"
        ? dict.spec.acceptsStory
        : dict.spec.acceptsMedia;

  const format =
    tool.key === "photo"
      ? dict.spec.formatPhoto
      : tool.key === "audio"
        ? dict.spec.formatAudio
        : tool.key === "avatar"
          ? dict.spec.formatAvatar
          : dict.spec.formatVideo;

  return { accepts, format, requiresSession: tool.key === "story" || tool.key === "private" };
}

export function ToolPage(props: PageProps & { tool: Tool }) {
  const { brand, origin, locale, dict, tool, result, query, error } = props;
  const description = tool.lede;
  const spec = toolSpec(tool, dict);
  const position = TOOLS.findIndex((item) => item.key === tool.key) + 1;

  return (
    <Layout
      brand={brand}
      origin={origin}
      locale={locale}
      dict={dict}
      title={`${tool.title} — ${brand}`}
      description={description}
      path={`/${tool.slug}`}
      active={tool.key}
      jsonLd={[
        {
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: `${brand} ${tool.h1}`,
          url: `${origin}/${locale}/${tool.slug}`,
          applicationCategory: "MultimediaApplication",
          operatingSystem: "Any",
          description,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: tool.faq.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        },
      ]}
    >
      <section class="hero hero-tool">
        <div class="wrap">
          <nav class="breadcrumb" aria-label="Breadcrumb">
            <a href={`/${locale}`}>{dict.hero.h1}</a>
            <span aria-hidden="true">/</span>
            <span>{tool.nav}</span>
          </nav>

          <div class="tool-head">
            <div>
              <p class="kicker mono">
                {String(position).padStart(2, "0")} / {tool.nav}
              </p>
              <h1 class="display-2">{tool.h1}</h1>
              <p class="hero-lede">{tool.lede}</p>
            </div>

            <aside class="spec">
              <p class="spec-title mono">{dict.spec.title}</p>
              <dl>
                <div>
                  <dt>{dict.spec.accepts}</dt>
                  <dd>{spec.accepts}</dd>
                </div>
                <div>
                  <dt>{dict.spec.format}</dt>
                  <dd>{spec.format}</dd>
                </div>
                <div>
                  <dt>{dict.spec.cost}</dt>
                  <dd>{dict.spec.free}</dd>
                </div>
                <div>
                  <dt>{dict.spec.links}</dt>
                  <dd>{dict.spec.signed}</dd>
                </div>
              </dl>
              {spec.requiresSession ? (
                <p class="spec-note">
                  {dict.spec.requires}: {dict.spec.session}
                </p>
              ) : null}
            </aside>
          </div>

          <SearchForm
            action={`/${locale}/${tool.slug}`}
            placeholder={tool.placeholder}
            dict={dict}
            tool={tool.key}
            locale={locale}
            value={query}
            autoFocus={!result}
          />

          <div id="result-slot">
            {error ? <ErrorBlock error={error} /> : null}
            {result ? <ResultSection result={result} dict={dict} /> : null}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <SectionHead index="02" title={dict.sections.toolHowTitle} />
          <ol class="steps compact">
            {tool.steps.map((step, index) => (
              <li>
                <span class="step-num" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Faq items={tool.faq} title={dict.sections.faqTitle} lede={dict.sections.faqLede} index="03" />
      <RelatedTools locale={locale} dict={dict} current={tool} index="04" />
    </Layout>
  );
}

const LEGAL: Record<string, { title: string; body: (brand: string) => { heading?: string; paras: string[] }[] }> = {
  "about-us": {
    title: "About",
    body: (brand) => [
      {
        paras: [
          `${brand} is a small, open implementation of an Instagram media downloader. It exists to show that the whole product fits in one Cloudflare Worker: no container, no queue, no media bucket.`,
          "The Worker parses the link you paste, resolves it against Instagram's public embed page or its private mobile API when a session is configured, and hands you a signed link back to Instagram's own CDN. Files are never re-hosted.",
        ],
      },
      {
        heading: "What it is not",
        paras: [
          "It is not affiliated with Instagram or Meta. It does not bypass privacy: anything the configured session cannot see in the Instagram app, this tool cannot see either.",
          "It is a demonstration of a stack choice, not a business. If you deploy it, the legal and moderation obligations are yours.",
        ],
      },
    ],
  },
  "terms-of-service": {
    title: "Terms of Service",
    body: (brand) => [
      {
        heading: "Use of the service",
        paras: [
          `${brand} is provided as-is, without warranty of any kind. You are responsible for every request you make through it.`,
          "You may only download content you own, content you have permission to use, or content whose licence allows it. Copyright is enforced by the rights holder, not by this tool.",
        ],
      },
      {
        heading: "Acceptable use",
        paras: [
          "No automated scraping beyond reasonable personal use, no bulk harvesting, no resale of the service, no attempts to overload the Worker or evade its rate limits.",
          "We may change, rate-limit or withdraw the service at any time. Requests that break these terms may be blocked without notice.",
        ],
      },
      {
        heading: "Liability",
        paras: [
          "To the maximum extent permitted by law, the operator is not liable for any loss arising from use of this service, including lost files, expired links or blocked requests.",
        ],
      },
    ],
  },
  "privacy-policy": {
    title: "Privacy Policy",
    body: (brand) => [
      {
        heading: "What is processed",
        paras: [
          `${brand} handles the link you submit, your IP address and basic request metadata. The link is used to resolve media and is cached for ten minutes so repeated lookups do not hit Instagram again.`,
          "No account is created, no email is collected and no advertising identifiers are set.",
        ],
      },
      {
        heading: "What is stored",
        paras: [
          "The link itself is not written to a database. Resolved media descriptors sit in Cloudflare's edge cache for ten minutes and then expire.",
          "One thing is stored: aggregate counters (files served, bytes served, links resolved, page views). They are integers attached to a UTC day. No IP address, user agent, link or per-visitor row is kept.",
          "If a session cookie is configured by the operator, it lives as an encrypted Worker secret and is only used for outbound requests to Instagram.",
        ],
      },
      {
        heading: "Third parties",
        paras: [
          "Requests to resolve media go to Instagram. The site is served by Cloudflare. No analytics, tag manager or ad network is bundled.",
        ],
      },
    ],
  },
  contact: {
    title: "Contact",
    body: (brand) => [
      {
        paras: [
          `For takedown requests, bug reports or questions about ${brand}, contact the operator of the deployment you are using. This build ships without a contact address on purpose — set one before you go live.`,
          "If you are a rights holder, include the URL of the deployment, the exact content at issue and evidence of ownership. Requests that cannot be verified are ignored.",
        ],
      },
    ],
  },
  help: {
    title: "Help",
    body: (brand) => [
      {
        heading: "A link does not resolve",
        paras: [
          "Check the link opens in a logged-out browser. If Instagram itself asks for a login, the post is private or age-restricted and no anonymous resolver can read it.",
          `For stories and highlights, ${brand} needs the deployment's IG_SESSIONID secret. Without it, those tools report that a session is required — that is the intended behaviour, not a bug.`,
        ],
      },
      {
        heading: "Downloads fail on iPhone",
        paras: [
          "Safari saves the file to Files rather than Photos. Open Files, tap the file, then Share → Save Image or Save to Photos.",
          "If the file plays instead of saving, the link was opened directly rather than followed from the result card — the attachment header only applies to the signed download link.",
        ],
      },
      {
        heading: "Rate limited",
        paras: [
          "Twenty searches per ten minutes per IP on the site. The limit resets automatically; reloading does not reset it.",
        ],
      },
    ],
  },
};

export function StaticView(props: PageProps & { slug: string }) {
  const { brand, origin, locale, dict, slug } = props;
  const page = LEGAL[slug];
  const title = page ? `${page.title} — ${brand}` : brand;
  const updated = new Date().toISOString().slice(0, 10);

  return (
    <Layout
      brand={brand}
      origin={origin}
      locale={locale}
      dict={dict}
      title={title}
      description={page ? (page.body(brand)[0]?.paras[0] ?? "") : dict.hero.lede}
      path={`/${slug}`}
      jsonLd={[
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: page?.title ?? brand,
          url: `${origin}/${locale}/${slug}`,
        },
      ]}
    >
      <section class="doc-head">
        <div class="wrap wrap-narrow">
          <p class="kicker mono">
            {dict.legal.updated} {updated}
          </p>
          <h1 class="display-1">{page?.title ?? "Page"}</h1>
        </div>
      </section>

      <div class="wrap">
        <div class="rule" role="presentation" />
      </div>

      <section class="section">
        <div class="wrap wrap-narrow prose">
          {(page?.body(brand) ?? []).map((block) => (
            <>
              {block.heading ? <h2>{block.heading}</h2> : null}
              {block.paras.map((para) => (
                <p>{para}</p>
              ))}
            </>
          ))}
        </div>
      </section>
    </Layout>
  );
}

export function NotFoundPage(props: PageProps) {
  const { brand, origin, locale, dict } = props;
  return (
    <Layout
      brand={brand}
      origin={origin}
      locale={locale}
      dict={dict}
      title={`Not found — ${brand}`}
      description="That page does not exist."
      path="/404"
      noindex
    >
      <section class="not-found">
        <div class="wrap">
          <p class="kicker mono">Error / 404</p>
          <h1 class="display-1">404</h1>
          <p>That page does not exist. The link may be old, or the tool may have moved in the index.</p>
          <p>
            <a class="btn primary" href={`/${locale}`}>
              Back to the desk ↓
            </a>
          </p>
        </div>
      </section>
    </Layout>
  );
}
