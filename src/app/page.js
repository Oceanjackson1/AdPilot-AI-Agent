'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar/Navbar';
import ParticleBird from '@/components/ParticleBird/ParticleBird';
import styles from './page.module.css';

/* ---- Magnetic tilt for feature cards ---- */
function useMagneticCards() {
  const containerRef = useRef(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cards = container.querySelectorAll('[data-magnetic]');
    const handlers = [];
    cards.forEach(card => {
      const onMove = (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateY = ((x - centerX) / centerX) * 8;
        const rotateX = ((centerY - y) / centerY) * 8;
        card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        const glowEl = card.querySelector('[data-glow]');
        if (glowEl) { glowEl.style.left = `${x}px`; glowEl.style.top = `${y}px`; glowEl.style.opacity = '1'; }
      };
      const onLeave = () => {
        card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale(1)';
        const glowEl = card.querySelector('[data-glow]');
        if (glowEl) glowEl.style.opacity = '0';
      };
      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', onLeave);
      handlers.push({ card, onMove, onLeave });
    });
    return () => { handlers.forEach(({ card, onMove, onLeave }) => { card.removeEventListener('mousemove', onMove); card.removeEventListener('mouseleave', onLeave); }); };
  }, []);
  return containerRef;
}

/* ---- Scroll Reveal (multiple variants) ---- */
function useScrollReveal() {
  useEffect(() => {
    const selectors = [styles.reveal, styles.revealLeft, styles.revealScale].map(s => `.${s}`).join(',');
    const elements = document.querySelectorAll(selectors);
    if (!elements.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.revealed);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );
    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/* ---- Direction-aware Navbar ---- */
function useNavbarScroll() {
  const [hidden, setHidden] = useState(false);
  const lastScroll = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY;
      if (current > 80) {
        setHidden(current > lastScroll.current);
      } else {
        setHidden(false);
      }
      lastScroll.current = current;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return hidden;
}

/* ---- Animated counter ---- */
function AnimatedStat({ value, suffix = '', label }) {
  const [display, setDisplay] = useState('0');
  const ref = useRef(null);
  const hasAnimated = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const numericValue = parseFloat(value);
          const duration = 1200;
          const start = performance.now();
          const tick = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(eased * numericValue);
            setDisplay(`${current}${suffix}`);
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, suffix]);
  return (
    <div className={styles.stat} ref={ref}>
      <div className={styles.statValue}>{display}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

/* ---- Platform data ---- */
const PLATFORMS_ROW1 = ['Facebook Ads', 'Google Ads', 'TikTok Ads', '小红书聚光', '巨量引擎', '腾讯广告', 'Apple Search Ads', 'Twitter Ads', 'LinkedIn Ads', 'Pinterest Ads'];
const PLATFORMS_ROW2 = ['Meta Business', '百度推广', '快手磁力', 'Snapchat Ads', 'YouTube Ads', '微博粉丝通', 'Amazon Ads', '知乎效果广告', 'Unity Ads', 'Spotify Ads'];

export default function Home() {
  const featuresRef = useMagneticCards();
  useScrollReveal();
  const navHidden = useNavbarScroll();

  return (
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)', transform: navHidden ? 'translateY(-100%)' : 'translateY(0)' }}>
        <Navbar />
      </div>

      {/* === Hero === */}
      <section className={styles.hero} id="hero">
        <ParticleBird />
        <div className={styles.heroGrid}></div>

        <div className={styles.heroContent}>
          <div className={styles.heroTag}>
            <span className={styles.heroTagDot}></span>
            AI-Powered Ad Optimization
          </div>

          <h1 className={styles.heroTitle}>
            <span className={styles.heroTitleGlow}>AdPilot</span>
            <span className={styles.heroTitleDynamic}>
              让广告投放{' '}
              <span className={styles.heroWordCarousel}>
                <span className={styles.heroWordTrack}>
                  <span className={styles.heroWord}>更精准</span>
                  <span className={styles.heroWord}>更高效</span>
                  <span className={styles.heroWord}>更智能</span>
                </span>
              </span>
            </span>
          </h1>

          <p className={styles.heroSubtitle}>
            将广告优化分析师的完整工作流浓缩为一次 AI 对话。
            <br />
            上传投放报表，自动完成数据诊断、归因分析与策略输出。
          </p>

          <div className={styles.heroCtas}>
            <Link href="/chat">
              <button className={styles.heroBtnPrimary}>
                <span>开始分析</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </Link>
            <a href="#workflow" className={styles.heroBtnSecondary}>
              了解工作流
            </a>
          </div>

          <div className={styles.stats}>
            <AnimatedStat value="50" suffix="+" label="分析维度" />
            <div className={styles.statDivider}></div>
            <AnimatedStat value="6" suffix="" label="主流平台" />
            <div className={styles.statDivider}></div>
            <AnimatedStat value="30" suffix="s" label="极速分析" />
          </div>
        </div>

        <div className={styles.heroFade}></div>
      </section>

      <div className={styles.sectionDivider}></div>

      {/* === Workflow === */}
      <section className={styles.workflow} id="workflow">
        <div className={styles.sectionGlow}></div>
        <div className={`${styles.sectionHeader} ${styles.revealLeft}`}>
          <div className={styles.sectionTag}>工作流</div>
          <h2 className={styles.sectionTitle}>还原广告优化师的分析路径</h2>
          <p className={styles.sectionSubtitle}>
            AdPilot 模拟资深优化师的思维方式，从数据清洗到策略输出，每一步都有据可依
          </p>
        </div>

        <div className={styles.workflowTimeline}>
          <div className={styles.workflowLine}></div>
          {[
            { num: '01', title: '数据接入与清洗', desc: '上传各广告平台导出的投放报表（Excel / CSV），AI 自动识别字段语义、清洗异常值、统一数据口径', tags: ['字段自动映射', '异常值检测', '多平台数据统一'] },
            { num: '02', title: '效果诊断与归因', desc: 'AI 从花费、曝光、点击、转化全链路分析投放数据，定位低效计划、异常波动和成本拐点', tags: ['漏斗分析', '趋势拐点检测', 'ROI / ROAS 归因'] },
            { num: '03', title: '人群与素材洞察', desc: '交叉分析受众画像与素材表现，发现高价值人群组合，识别素材疲劳和创意衰退信号', tags: ['人群交叉分析', '素材效果排名', '创意疲劳预警'] },
            { num: '04', title: '预算分配与策略建议', desc: '基于分析结论输出可执行的优化策略：预算再分配方案、出价调整建议、定向优化方向和素材迭代建议', tags: ['预算优化方案', '出价策略调整', '可执行 Action List'] },
          ].map((step, i) => (
            <div className={`${styles.workflowStep} ${styles.reveal}`} key={step.num} style={{ '--delay': `${i * 0.12}s` }}>
              <div className={styles.workflowStepNum}>{step.num}</div>
              <div className={styles.workflowStepContent}>
                <h3 className={styles.workflowStepTitle}>{step.title}</h3>
                <p className={styles.workflowStepDesc}>{step.desc}</p>
                <div className={styles.workflowStepTags}>
                  {step.tags.map(tag => <span key={tag}>{tag}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.sectionDivider}></div>

      {/* === Features === */}
      <section className={styles.features} id="features">
        <div className={styles.sectionGlow}></div>
        <div className={`${styles.sectionHeader} ${styles.revealLeft}`}>
          <div className={styles.sectionTag}>核心能力</div>
          <h2 className={styles.sectionTitle}>为广告优化而生</h2>
          <p className={styles.sectionSubtitle}>
            不只是数据可视化，而是真正理解广告投放逻辑的 AI 分析伙伴
          </p>
        </div>

        <div className={styles.featuresGrid} ref={featuresRef}>
          {[
            { icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>, title: '智能报表解析', desc: '支持 Excel / CSV 格式，自动识别投放平台字段语义，无需手动映射', gradient: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(129,140,248,0.08))', wide: false },
            { icon: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />, title: '全链路漏斗分析', desc: '从曝光到转化，自动构建投放漏斗，定位每个环节的流失原因与优化空间', gradient: 'linear-gradient(135deg, rgba(129,140,248,0.1), rgba(99,102,241,0.08))', wide: true },
            { icon: <><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>, title: '多维度交叉对比', desc: '按计划、素材、人群、时段等多维度拆解数据，发现隐藏的效果差异', gradient: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(79,70,229,0.08))', wide: false },
            { icon: <><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></>, title: '对话式深度分析', desc: '通过自然语言追问，深入探索具体问题：为什么 CPC 突然升高？哪个素材该替换？', gradient: 'linear-gradient(135deg, rgba(129,140,248,0.1), rgba(99,102,241,0.06))', wide: false },
            { icon: <><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></>, title: '预算优化建议', desc: '基于边际效益分析，输出预算再分配方案，让每一分钱都花得更有效率', gradient: 'linear-gradient(135deg, rgba(129,140,248,0.1), rgba(99,102,241,0.06))', wide: true },
            { icon: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>, title: '分析报告导出', desc: '将分析结论与优化建议自动整理为结构化报告，可直接用于团队汇报', gradient: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(129,140,248,0.06))', wide: false },
          ].map((feat, i) => (
            <div
              className={`${styles.featureCard} ${feat.wide ? styles.featureCardWide : ''} ${styles.revealScale}`}
              key={feat.title}
              data-magnetic
              style={{ '--delay': `${i * 0.08}s` }}
            >
              <div className={styles.featureGlow} data-glow></div>
              <div className={styles.featureCardBorder}></div>
              <div className={styles.featureIcon} style={{ background: feat.gradient }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {feat.icon}
                </svg>
              </div>
              <div className={styles.featureTitle}>{feat.title}</div>
              <div className={styles.featureDesc}>{feat.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.sectionDivider}></div>

      {/* === Platforms — Dual Marquee === */}
      <section className={styles.platforms}>
        <div className={`${styles.sectionHeader} ${styles.reveal}`}>
          <div className={styles.sectionTag}>平台支持</div>
          <h2 className={styles.sectionTitle}>覆盖主流广告平台</h2>
          <p className={styles.sectionSubtitle}>
            支持多平台投放数据的统一分析，识别跨平台效果差异
          </p>
        </div>

        <div className={styles.marqueeContainer}>
          <div className={styles.marqueeRowLeft}>
            {[...PLATFORMS_ROW1, ...PLATFORMS_ROW1].map((name, i) => (
              <div className={styles.platformBadge} key={`r1-${i}`}>{name}</div>
            ))}
          </div>
          <div className={styles.marqueeRowRight}>
            {[...PLATFORMS_ROW2, ...PLATFORMS_ROW2].map((name, i) => (
              <div className={styles.platformBadge} key={`r2-${i}`}>{name}</div>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.sectionDivider}></div>

      {/* === CTA === */}
      <section className={styles.cta}>
        <div className={`${styles.ctaContainer} ${styles.revealScale}`}>
          <div className={`${styles.ctaBorderLine} ${styles.ctaBorderLineTop}`}></div>
          <div className={`${styles.ctaBorderLine} ${styles.ctaBorderLineBottom}`}></div>
          <div className={styles.ctaGlow}></div>
          <div className={styles.ctaGlow2}></div>
          <h2 className={styles.ctaTitle}>用 AI 重新定义广告优化的效率</h2>
          <p className={styles.ctaDesc}>
            上传一份投放报表，体验 30 秒内获得专业级分析报告
          </p>
          <Link href="/chat">
            <button className={styles.ctaBtn}>
              <span>免费开始使用</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </Link>
        </div>
      </section>

      {/* === Footer === */}
      <footer className={styles.footer}>
        <div className={styles.footerMain}>
          <div className={styles.footerBrand}>
            <div className={styles.footerLogoRow}>
              <Image src="/logo.svg" alt="AdPilot" width={24} height={24} />
              <span className={styles.footerLogo}>AdPilot</span>
            </div>
            <p className={styles.footerBrandDesc}>
              基于 AI 的广告投放优化平台，帮助营销团队用数据驱动决策，提升每一分广告预算的回报。
            </p>
          </div>
          <div className={styles.footerColumn}>
            <div className={styles.footerColumnTitle}>产品</div>
            <Link href="/chat" className={styles.footerLink}>开始分析</Link>
            <a href="#workflow" className={styles.footerLink}>工作流</a>
            <a href="#features" className={styles.footerLink}>核心功能</a>
          </div>
          <div className={styles.footerColumn}>
            <div className={styles.footerColumnTitle}>支持</div>
            <a href="#" className={styles.footerLink}>使用文档</a>
            <a href="#" className={styles.footerLink}>常见问题</a>
            <a href="#" className={styles.footerLink}>联系我们</a>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span className={styles.footerCopyright}>&copy; 2026 AdPilot. All rights reserved.</span>
          <div className={styles.footerBottomLinks}>
            <a href="#" className={styles.footerLink}>隐私政策</a>
            <a href="#" className={styles.footerLink}>使用条款</a>
          </div>
        </div>
      </footer>
    </>
  );
}
