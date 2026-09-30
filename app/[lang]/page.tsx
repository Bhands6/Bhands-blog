import Link from "next/link";
import type { Metadata } from "next";
import Reveal from "@/components/reveal";
import SiteFooter from "@/components/site-footer";
import Starfield from "@/components/starfield";
import ParticleTrail from "@/components/particle-trail";
import NexusGauge from "@/components/nexus-gauge";
import NexusStarmap from "@/components/nexus-starmap";
import NexusTerminal from "@/components/nexus-terminal";
import { getDict } from "@/lib/i18n";
import {
  getCategories,
  getPostsForLang,
  getTags,
  isLang,
  type CategoryKey,
} from "@/lib/posts";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "zh";
  return {
    title: lang === "zh" ? "Bhands-Blog — 星际枢纽" : "Bhands-Blog — Stellar Hub",
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "zh";
  const t = getDict(lang);
  const n = t.nexus;

  // 真实博客数据：仪表盘统计 + 最新文章
  const allPosts = getPostsForLang(lang);
  const latestPosts = allPosts.slice(0, 5);
  const totalMinutes = allPosts.reduce((s, p) => s + p.readingMinutes, 0);
  const catCount = getCategories(lang).length;
  const tagCount = getTags(lang).length;
  // eslint-disable-next-line react-hooks/purity -- SSG 下该值冻结在构建期，属预期行为
  const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
  const recentCount = allPosts.filter((p) => new Date(p.date).getTime() >= monthAgo).length;
  const pct = (v: number, cap: number) => Math.min(100, Math.round((v / cap) * 100));
  const gauges = [
    {
      value: pct(allPosts.length, 12),
      color: "#00f0ff",
      label: String(allPosts.length),
      unit: "POSTS",
      text: n.dashboard.stats.posts,
      trend: recentCount > 0 ? n.dashboard.recentTrend(recentCount) : n.dashboard.trends.stable,
      trendCls: recentCount > 0 ? "up" : "stable",
    },
    {
      value: pct(totalMinutes, 30),
      color: "#44ff88",
      label: String(totalMinutes),
      unit: "MIN",
      text: n.dashboard.stats.minutes,
      trend: n.dashboard.trends.stable,
      trendCls: "stable",
    },
    {
      value: pct(catCount, 6),
      color: "#f0c040",
      label: String(catCount),
      unit: "CATS",
      text: n.dashboard.stats.cats,
      trend: n.dashboard.trends.nominal,
      trendCls: "stable",
    },
    {
      value: pct(tagCount, 18),
      color: "#00f0ff",
      label: String(tagCount),
      unit: "TAGS",
      text: n.dashboard.stats.tags,
      trend: n.dashboard.trends.stable,
      trendCls: "stable",
    },
  ];
  const postCls = (c: CategoryKey) => (c === "tech" ? "priority" : c === "essay" ? "critical" : "routine");

  return (
    <>
      <Starfield />
      <ParticleTrail />
      <div className="glow-orb cyan" aria-hidden="true" />
      <div className="glow-orb magenta" aria-hidden="true" />
      <div className="glow-orb gold" aria-hidden="true" />

      {/* ═══ Hero ═══ */}
      <section className="hero" id="hero">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-status">
          <span className="status-line" aria-hidden="true" />
          {n.hero.eyebrow}
          <span className="status-line right" aria-hidden="true" />
        </div>
        <h1>
          <span className="glitch" data-text={n.hero.titleA}>
            {n.hero.titleA}
          </span>
          <br />
          {n.hero.titleB}
        </h1>
        <div className="hero-log">
          <span className="log-bar" aria-hidden="true" />
          {n.hero.log}
          <span className="log-bar" aria-hidden="true" />
        </div>
        <p className="hero-sub">{n.hero.sub}</p>
        <p className="hero-coords">{n.hero.coords}</p>
        <div className="hero-cta">
          <Link href={`/${lang}/login`} className="btn-primary">
            {n.hero.primary}
          </Link>
          <a href="#posts" className="btn-ghost">
            {n.hero.ghost}
          </a>
        </div>
      </section>

      {/* ═══ 数据流 + 轨道视觉 ═══ */}
      <section className="nx-sec" id="about">
        <div className="data-streams">
          <Reveal variant="left">
            <div className="section-label">{n.about.label}</div>
            <h2 className="section-title">
              {n.about.titleA}
              <br />
              {n.about.titleB}
            </h2>
            <p className="section-desc">{n.about.desc}</p>
          </Reveal>
          <Reveal variant="right">
            <div className="data-visual">
              <div className="orbit-ring" aria-hidden="true" />
              <div className="orbit-ring" aria-hidden="true" />
              <div className="orbit-ring" aria-hidden="true" />
              <div className="orbit-core" aria-hidden="true" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 仪表盘 ═══ */}
      <section className="nx-sec" id="dashboard">
        <div className="dashboard">
          <Reveal className="dashboard-header">
            <div className="section-label">{n.dashboard.label}</div>
            <h2 className="section-title">{n.dashboard.title}</h2>
            <p className="section-desc">{n.dashboard.desc}</p>
          </Reveal>
          <div className="gauges-grid">
            {gauges.map((g, i) => (
              <Reveal key={g.text} delay={0.1 + i * 0.1} className="h-full">
                <div className="gauge-card h-full">
                  <NexusGauge value={g.value} color={g.color} label={g.label} unit={g.unit} />
                  <div className="gauge-label">{g.text}</div>
                  <div className={`gauge-trend ${g.trendCls}`}>{g.trend}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 舰队 ═══ */}
      <section className="nx-sec" id="fleet">
        <div className="fleet-section">
          <Reveal>
            <div className="section-label">{n.fleet.label}</div>
            <h2 className="section-title">{n.fleet.title}</h2>
            <p className="section-desc">{n.fleet.desc}</p>
          </Reveal>
          <div className="fleet-grid">
            {n.fleet.ships.map((s, i) => (
              <Reveal key={s.id} delay={i * 0.1} className="h-full">
                <div className="fleet-card h-full">
                  <div className="fleet-card-id">{s.id}</div>
                  <div className="fleet-card-title">{s.title}</div>
                  <p className="fleet-card-text">{s.text}</p>
                  <div className="fleet-card-specs">
                    {s.specs.map((sp) => (
                      <div className="spec-item" key={sp.k}>
                        {sp.k}
                        <span>{sp.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 星图 ═══ */}
      <section className="nx-sec" id="starmap">
        <div className="starmap-section">
          <Reveal>
            <div className="section-label">{n.starmap.label}</div>
            <h2 className="section-title">{n.starmap.title}</h2>
            <p className="section-desc">{n.starmap.desc}</p>
          </Reveal>
          <Reveal delay={0.15}>
            <NexusStarmap
              systems={n.starmap.systems}
              conns={n.starmap.conns}
              hudCoverage={n.starmap.hud.coverage}
              hudCoverageVal={n.starmap.hud.coverageVal}
              hudNodes={n.starmap.hud.nodes}
              hudNodesVal={n.starmap.hud.nodesVal}
            />
          </Reveal>
        </div>
      </section>

      {/* ═══ 通讯流 ═══ */}
      <section className="nx-sec" id="comms">
        <div className="comms-section">
          <Reveal>
            <div className="section-label">{n.comms.label}</div>
            <h2 className="section-title">{n.comms.title}</h2>
            <p className="section-desc">{n.comms.desc}</p>
          </Reveal>
          <div className="comms-feed">
            {n.comms.msgs.map((m, i) => (
              <Reveal key={i} variant="left" delay={i * 0.12}>
                <div className="comm-msg">
                  <span className={`comm-class ${m.cls}`}>{m.cls.toUpperCase()}</span>
                  <div className="comm-body">
                    <div className="comm-header">
                      <span className="comm-sender">{m.sender}</span>
                      <span className="comm-time">{m.time}</span>
                    </div>
                    <p className="comm-text" dangerouslySetInnerHTML={{ __html: m.text }} />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 最新文章 ═══ */}
      <section className="nx-sec" id="posts">
        <div className="comms-section">
          <Reveal>
            <div className="section-label">{n.posts.label}</div>
            <h2 className="section-title">{n.posts.title}</h2>
            <p className="section-desc">{n.posts.desc}</p>
          </Reveal>
          <div className="comms-feed">
            {latestPosts.map((p, i) => (
              <Reveal key={`${p.slug}-${p.lang}`} variant="left" delay={i * 0.12}>
                <Link href={`/${lang}/blog/${p.slug}`} className="comm-msg">
                  <span className={`comm-class ${postCls(p.category)}`}>
                    {p.category.toUpperCase()}
                  </span>
                  <div className="comm-body">
                    <div className="comm-header">
                      <span className="comm-sender">{p.title}</span>
                      <span className="comm-time">
                        {p.date} {"//"} {t.post.minutes(p.readingMinutes)}
                      </span>
                    </div>
                    <p className="comm-text">{p.summary}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
            {latestPosts.length === 0 && (
              <p className="comm-text" style={{ padding: "2rem 0", textAlign: "center" }}>
                {n.posts.empty}
              </p>
            )}
          </div>
          <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
            <Link href={`/${lang}/blog`} className="btn-ghost">
              {n.posts.viewAll}
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ 编年史 ═══ */}
      <section className="nx-sec" id="timeline">
        <div className="timeline-section">
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: "4rem" }}>
              <div className="section-label" style={{ justifyContent: "center" }}>
                {n.timeline.label}
              </div>
              <h2 className="section-title">{n.timeline.title}</h2>
            </div>
          </Reveal>
          {n.timeline.events.map((ev) => (
            <Reveal key={ev.year} className="timeline-item">
              <div className="timeline-content">
                <div className="timeline-year">{ev.year}</div>
                <div className="timeline-title">{ev.title}</div>
                <p className="timeline-desc">{ev.desc}</p>
              </div>
              <div className="timeline-dot" aria-hidden="true" />
              <div className="timeline-content" />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══ 系统日志 ═══ */}
      <section className="nx-sec" id="system">
        <Reveal className="terminal-section">
          <div className="section-label">{n.system.label}</div>
          <h2 className="section-title">{n.system.title}</h2>
          <NexusTerminal titleBar={n.system.titleBar} lines={n.system.lines} />
        </Reveal>
      </section>

      {/* ═══ 指挥官档案 ═══ */}
      <section className="nx-sec" id="commander">
        <div className="crew-section">
          <Reveal>
            <div className="section-label">{n.commander.label}</div>
            <h2 className="section-title">{n.commander.title}</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="crew-card">
              <div className="crew-avatar-area">
                <div className="crew-avatar">
                  <div className="avatar-ring" aria-hidden="true" />
                  <span className="crew-avatar-initials">{n.commander.initials}</span>
                </div>
                <div className="crew-avatar-label">{n.commander.avatarLabel}</div>
                <div className="crew-avatar-id">{n.commander.avatarId}</div>
              </div>
              <div className="crew-info">
                <h3 className="crew-name">{n.commander.name}</h3>
                <div className="crew-title">{n.commander.role}</div>
                <p className="crew-bio">{n.commander.bio}</p>
                <div className="crew-stats-row">
                  {n.commander.stats.map((s) => (
                    <div className="crew-stat" key={s.k}>
                      {s.k}
                      <span className="value">{s.v}</span>
                    </div>
                  ))}
                </div>
                <blockquote className="crew-quote">
                  {n.commander.quote}
                  <span className="attribution">{n.commander.attribution}</span>
                </blockquote>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter lang={lang} />
    </>
  );
}
