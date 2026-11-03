import type { Dictionary } from "../i18n/en";
import type { PresentedResult } from "../lib/present";
import type { StatsSnapshot } from "../lib/stats";
import { dayInitial, formatBytes, formatClock, formatDate, formatInt } from "../lib/format";
import { TOOLS, type Tool } from "../config";
import { Fleuron, ToolIcon } from "./artwork";

export function SectionHead(props: { index: string; title: string; lede?: string; id?: string }) {
  const { index, title, lede, id } = props;
  return (
    <header class="section-head">
      <p class="section-index mono">{index}</p>
      <div>
        <h2 class="display-2" id={id}>
          {title}
        </h2>
        {lede ? <p class="section-lede">{lede}</p> : null}
      </div>
    </header>
  );
}

export function SearchForm(props: {
  action: string;
  placeholder: string;
  dict: Dictionary;
  tool: string;
  locale: string;
  value?: string;
  autoFocus?: boolean;
}) {
  const { action, placeholder, dict, tool, locale, value, autoFocus } = props;
  return (
    <form class="search" id="search-form" method="post" action={action} data-tool={tool}>
      <label class="search-label mono" for="s_input">
        {dict.hero.inputLabel}
      </label>
      <div class="search-box">
        <input
          id="s_input"
          name="q"
          type="text"
          inputmode="url"
          autocomplete="off"
          autocapitalize="off"
          spellcheck={false}
          placeholder={placeholder}
          value={value ?? ""}
          autofocus={autoFocus}
          required
        />
        <button
          class="btn ghost paste"
          type="button"
          id="paste"
          data-label-paste={dict.hero.paste}
          data-label-clear={dict.hero.clear}
        >
          {dict.hero.paste}
        </button>
        <button class="btn primary submit" type="submit" id="submit">
          <span class="btn-label">{dict.hero.submit}</span>
          <span aria-hidden="true">↓</span>
        </button>
      </div>
      <p class="search-hint mono">
        {dict.hero.quick}:{" "}
        {TOOLS.slice(0, 4).map((item, index) => (
          <>
            {index > 0 ? " · " : ""}
            <a href={`/${locale}/${item.slug}`}>{item.nav}</a>
          </>
        ))}
      </p>
    </form>
  );
}

function ResultCard({ result, dict }: { result: PresentedResult; dict: Dictionary }) {
  const expires = new Date(result.expiresAt * 1000);
  return (
    <section class="result" id="result" aria-live="polite">
      <div class="result-head">
        <div>
          <h2>{dict.result.ready}</h2>
          {result.author?.username ? (
            <p class="muted byline">
              {result.author.avatar ? (
                <img
                  class="avatar"
                  src={result.author.avatar}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width="24"
                  height="24"
                  referrerpolicy="no-referrer"
                />
              ) : null}
              <span>
                {dict.result.author}: <b>@{result.author.username}</b>
                {result.author.fullName ? ` · ${result.author.fullName}` : ""}
              </span>
            </p>
          ) : null}
        </div>
        <span class="badge" title={dict.result.source}>
          {result.provider}
        </span>
      </div>

      {result.caption ? <p class="caption">{result.caption}</p> : null}

      {result.items.length > 1 ? (
        <div class="result-actions">
          <button type="button" class="btn primary save-all" data-save-all>
            {dict.result.saveAll} · {result.items.length}
          </button>
        </div>
      ) : null}

      <ul class="items">
        {result.items.map((item) => (
          <li class="item">
            {item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt=""
                loading="lazy"
                decoding="async"
                width="56"
                height="56"
                referrerpolicy="no-referrer"
              />
            ) : (
              <span class="thumb-fallback" aria-hidden="true" />
            )}
            <div class="item-body">
              <b>{item.label}</b>
              <span class="muted">
                {[item.quality, item.width && item.height ? `${item.width}×${item.height}` : null]
                  .filter(Boolean)
                  .join(" · ") || (item.kind === "video" ? "MP4" : "JPG")}
              </span>
              <span class="filename">{item.filename}</span>
            </div>
            <a class="btn primary" href={item.href} download={item.filename} rel="nofollow noopener">
              {dict.result.save} ↓
            </a>
          </li>
        ))}
      </ul>

      <p class="fineprint">
        {dict.result.expires}: {expires.toISOString().replace("T", " ").slice(0, 16)} UTC · 30 min
      </p>
      {result.warnings.length > 0 ? (
        <ul class="warnings">
          {result.warnings.map((warning) => (
            <li>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function ResultSection({ result, dict }: { result: PresentedResult; dict: Dictionary }) {
  return <ResultCard result={result} dict={dict} />;
}

export function Ledger({ snapshot, dict }: { snapshot: StatsSnapshot; dict: Dictionary }) {
  const { totals, today, last_7_days: last7 } = snapshot;
  const peak = Math.max(1, ...last7.map((day) => day.downloads));
  const since = snapshot.since ? formatDate(snapshot.since) : null;

  return (
    <aside class="ledger" aria-label={dict.stats.title}>
      <div class="ledger-head mono">
        <span>{dict.stats.kicker}</span>
        <span>{since ? `${dict.stats.since} ${since}` : "—"}</span>
      </div>

      {snapshot.available ? (
        <>
          <div class="ledger-big">
            <span class="ledger-num" data-stat="downloads">
              {formatInt(totals.downloads)}
            </span>
            <span class="ledger-label">{dict.stats.files}</span>
          </div>

          <dl class="ledger-rows">
            <div>
              <dt>{dict.stats.bytes}</dt>
              <dd data-stat="bytes">{formatBytes(totals.bytes)}</dd>
            </div>
            <div>
              <dt>{dict.stats.resolves}</dt>
              <dd data-stat="resolves">{formatInt(totals.resolves)}</dd>
            </div>
            <div>
              <dt>{dict.stats.today}</dt>
              <dd data-stat="today">{formatInt(today.downloads)} {dict.stats.saved}</dd>
            </div>
          </dl>

          <div class="ledger-bars" aria-hidden="true">
            {last7.map((day) => (
              <span
                class={day.downloads === 0 ? "is-zero" : ""}
                style={`height:${Math.max(4, Math.round((day.downloads / peak) * 100))}%`}
              />
            ))}
          </div>
          <div class="ledger-bar-labels" aria-hidden="true">
            {last7.map((day) => (
              <span>{dayInitial(day.day)}</span>
            ))}
          </div>

          <div class="ledger-foot mono">
            <span>
              <span class="ledger-dot" aria-hidden="true" />
              {dict.stats.updated} <span data-stat="updated">{formatClock(snapshot.updated_at)}</span>
            </span>
            <a href="/stats">{dict.stats.full} →</a>
          </div>
          <p class="ledger-note">{dict.stats.privacy}</p>
        </>
      ) : (
        <>
          <div class="ledger-big">
            <span class="ledger-num">0</span>
            <span class="ledger-label">{dict.stats.files}</span>
          </div>
          <p class="ledger-note">{dict.stats.unavailable}</p>
          <div class="ledger-foot mono">
            <span>{dict.stats.live}</span>
            <a href="/stats">{dict.stats.full} →</a>
          </div>
        </>
      )}
    </aside>
  );
}

export function ToolGrid({ locale, dict, tools }: { locale: string; dict: Dictionary; tools: Tool[] }) {
  return (
    <section class="section" id="tools">
      <div class="wrap">
        <SectionHead index="01" title={dict.sections.indexTitle} lede={dict.sections.indexLede} />
        <ul class="index-list">
          {tools.map((tool, index) => (
            <li class="index-row">
              <a href={`/${locale}/${tool.slug}`}>
                <span class="index-num" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span class="index-icon" aria-hidden="true">
                  <ToolIcon name={tool.key} size={22} />
                </span>
                <span class="index-body">
                  <b>{tool.title}</b>
                  <span class="index-desc">{tool.lede}</span>
                </span>
                <span class="index-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function HowItWorks({ dict }: { dict: Dictionary }) {
  return (
    <section class="section section-alt" id="how">
      <div class="wrap">
        <SectionHead index="02" title={dict.sections.howTitle} lede={dict.sections.howLede} />
        <ol class="steps">
          {dict.how.map((step, index) => (
            <li>
              <span class="step-num" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function TrustNotes({ dict }: { dict: Dictionary }) {
  return (
    <section class="section" id="promise">
      <div class="wrap">
        <SectionHead index="03" title={dict.sections.trustTitle} lede={dict.sections.trustLede} />
        <div class="notes">
          {dict.sections.trust.map((note, index) => (
            <div class="note-col">
              <p class="mono">
                <Fleuron size={10} /> {String(index + 1).padStart(2, "0")}
              </p>
              <h3>{note.title}</h3>
              <p>{note.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Faq(props: { items: { q: string; a: string }[]; title: string; id?: string; index?: string; lede?: string }) {
  const { items, title, id = "faq", index = "04", lede } = props;
  return (
    <section class="section section-alt" id={id}>
      <div class="wrap faq-layout">
        <div class="faq-side">
          <p class="section-index mono">{index}</p>
          <h2 class="display-2">{title}</h2>
          {lede ? <p class="section-lede">{lede}</p> : null}
        </div>
        <div class="faq">
          {items.map((item) => (
            <details>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RelatedTools(props: { locale: string; dict: Dictionary; current: Tool; index?: string }) {
  const { locale, dict, current, index = "05" } = props;
  const others = TOOLS.filter((tool) => tool.slug !== current.slug).slice(0, 4);
  return (
    <section class="section">
      <div class="wrap">
        <SectionHead index={index} title={dict.sections.relatedTitle} />
        <ul class="pill-row">
          {others.map((tool) => (
            <li>
              <a class="pill" href={`/${locale}/${tool.slug}`}>
                {tool.nav} / {tool.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
