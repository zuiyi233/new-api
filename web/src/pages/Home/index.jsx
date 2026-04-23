/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from 'react';
import { API, showError } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { useActualTheme } from '../../context/Theme';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import NoticeModal from '../../components/layout/NoticeModal';
import { StatusContext } from '../../context/Status';

const Globe = lazy(() => import('./Globe'));
const LoadingScreen = lazy(() => import('./LoadingScreen'));
const AmbientParticles = lazy(() => import('./AmbientParticles'));
const HOME_PAGE_CACHE_KEY = 'home_page_content';
const easeOutStrong = [0.215, 0.61, 0.355, 1];
const HOME_IFRAME_ALLOWLIST_KEYS = [
  'home_page_iframe_allowlist',
  'home_page_iframe_allow_list',
  'home_page_content_iframe_allowlist',
  'home_page_content_iframe_allow_list',
];
const BLOCKED_HTML_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'meta',
  'link',
  'style',
  'base',
]);
const URL_ATTRS = new Set([
  'href',
  'src',
  'xlink:href',
  'formaction',
  'action',
]);
const SAFE_URL_PREFIX = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i;
const SAFE_EXTERNAL_HTTP_URL = /^https?:\/\/\S+$/i;
const VISUALLY_HIDDEN_STYLE = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

function useScrollReveal(threshold, delay = 0) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') {
      setVisible(true);
      return;
    }

    const timerIds = [];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = window.setTimeout(() => {
              setVisible(true);
            }, delay);
            timerIds.push(id);
            observer.unobserve(el);
          }
        });
      },
      { threshold },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      timerIds.forEach((id) => window.clearTimeout(id));
    };
  }, [threshold, delay]);

  return [ref, visible];
}

function getStatusValue(statusState, key) {
  if (!statusState || !key) return undefined;
  if (Object.prototype.hasOwnProperty.call(statusState, key)) {
    return statusState[key];
  }
  if (
    statusState.status &&
    typeof statusState.status === 'object' &&
    Object.prototype.hasOwnProperty.call(statusState.status, key)
  ) {
    return statusState.status[key];
  }
  return undefined;
}

function getHomeIframeAllowedOrigins(statusState) {
  const origins = new Set();
  for (const key of HOME_IFRAME_ALLOWLIST_KEYS) {
    const val = getStatusValue(statusState, key);
    if (typeof val === 'string' && val.trim()) {
      val
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => origins.add(s));
    }
  }
  return origins;
}

function getDocsExternalUrl(statusState) {
  const candidates = [
    getStatusValue(statusState, 'docs_url'),
    getStatusValue(statusState, 'docs_link'),
    getStatusValue(statusState, 'docsUrl'),
    getStatusValue(statusState, 'docsLink'),
  ];

  for (const value of candidates) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (SAFE_EXTERNAL_HTTP_URL.test(normalized)) {
      return normalized;
    }
  }

  return '';
}

function isAllowedHomeIframeUrl(url, allowedOrigins) {
  if (!url || !url.startsWith('https://')) return false;
  try {
    const parsed = new URL(url);
    const origin = parsed.origin;
    if (allowedOrigins.has(origin)) return true;
    for (const allowed of allowedOrigins) {
      if (allowed.endsWith('/*')) {
        const prefix = allowed.slice(0, -1);
        if (origin.startsWith(prefix)) return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function getCachedHomePageContent() {
  try {
    return localStorage.getItem(HOME_PAGE_CACHE_KEY) || '';
  } catch {
    return '';
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function normalizeHomePageContent(content) {
  if (content === null || content === undefined) return '';
  if (typeof content !== 'string') {
    try {
      return String(content);
    } catch {
      return '';
    }
  }
  return content.trim();
}

function sanitizeHtmlContent(raw) {
  if (!raw || typeof raw !== 'string') return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'text/html');

  const walk = (node) => {
    if (!node) return;
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      if (BLOCKED_HTML_TAGS.has(tag)) {
        node.remove();
        return;
      }
      for (const attr of Array.from(node.attributes)) {
        const name = attr.name.toLowerCase();
        if (URL_ATTRS.has(name)) {
          const val = attr.value.trim();
          if (val && !SAFE_URL_PREFIX.test(val)) {
            node.removeAttribute(attr.name);
          }
        }
        if (
          name.startsWith('on') ||
          name === 'srcdoc' ||
          name === 'javascript'
        ) {
          node.removeAttribute(attr.name);
        }
      }
    }
    Array.from(node.childNodes).forEach(walk);
  };

  walk(doc.body);

  let sanitized = '';
  for (const child of Array.from(doc.body.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      sanitized += (child).outerHTML;
    } else if (child.nodeType === Node.TEXT_NODE) {
      sanitized += child.textContent;
    }
  }
  return sanitized;
}

// Feature cards data - matching reference image icons
const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: '统一接入',
    desc: '一次接入，调用全球 40+ 主流 AI 模型提供商，降低集成成本',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 6.34L2.1 2.1m17.8 17.8l-4.24-4.24M6.34 17.66l-4.24 4.24M23 12h-6m-6 0H1m20.07-4.93l-4.24 4.24M6.34 6.34l-4.24-4.24" />
      </svg>
    ),
    title: '智能路由',
    desc: '多维度智能路由策略，自动选择最优模型，提升成功率和响应速度',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: '稳定可靠',
    desc: '企业级高可用架构，99.9% 服务可用性，保障业务稳定运行',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V10M18 20V4M6 20v-4" />
      </svg>
    ),
    title: '灵活计费',
    desc: '按量计费，价格透明，无隐藏费用，帮助您有效控制成本',
  },
];

// Stats data with icons matching reference
const STATS = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    value: '40+',
    label: '模型提供商',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
    value: '500+',
    label: '可用模型',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    value: '99.9%',
    label: '服务可用性',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    value: '10ms',
    label: '平均响应时间',
  },
];

// Model providers with brand colors
const PROVIDERS = [
  { name: 'OpenAI', color: '#10a37f' },
  { name: 'ANTHROPIC', color: '#d4a574' },
  { name: 'Google', color: '#4285f4' },
  { name: 'Meta', color: '#0081fb' },
  { name: 'Mistral', color: '#f97316' },
  { name: 'cohere', color: '#ff6b6b' },
];

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const [loading, setLoading] = useState(true);
  const homeIframeAllowedOrigins = useMemo(
    () => getHomeIframeAllowedOrigins(statusState),
    [statusState],
  );
  const docsExternalUrl = useMemo(
    () => getDocsExternalUrl(statusState),
    [statusState],
  );
  const [homePageContent, setHomePageContent] = useState(() =>
    getCachedHomePageContent(),
  );
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContentError, setHomePageContentError] = useState('');
  const [noticeVisible, setNoticeVisible] = useState(false);
  const isMobile = useIsMobile();
  const iframeRef = useRef(null);

  const [textRef, textVisible] = useScrollReveal(0.35, 0);
  const [globeRef, globeVisible] = useScrollReveal(0.2, 150);
  const [featuresRef, featuresVisible] = useScrollReveal(0.2, 0);
  const [providersRef, providersVisible] = useScrollReveal(0.2, 0);

  const handleLoadingComplete = () => {
    setLoading(false);
  };

  const displayHomePageContent = async () => {
    const cachedContent = getCachedHomePageContent();
    if (cachedContent) {
      if (cachedContent.startsWith('https://')) {
        if (isAllowedHomeIframeUrl(cachedContent, homeIframeAllowedOrigins)) {
          setHomePageContent(cachedContent);
        } else {
          safeStorageRemove(HOME_PAGE_CACHE_KEY);
        }
      } else {
        setHomePageContent(sanitizeHtmlContent(cachedContent));
      }
    }

    try {
      const res = await API.get('/api/home_page_content');
      const { success, message, data } = res.data;

      if (!success) {
        const errorMessage = message || t('加载首页内容失败');
        setHomePageContentError(errorMessage);
        if (!cachedContent) {
          showError(errorMessage);
        }
        return;
      }

      const sourceContent = normalizeHomePageContent(data);
      if (!sourceContent) {
        setHomePageContent('');
        safeStorageRemove(HOME_PAGE_CACHE_KEY);
        setHomePageContentError('');
        return;
      }

      let renderedContent = '';
      if (sourceContent.startsWith('https://')) {
        if (!isAllowedHomeIframeUrl(sourceContent, homeIframeAllowedOrigins)) {
          const errorMessage = t(
            '首页外链地址未通过白名单校验，请联系管理员配置白名单后重试',
          );
          setHomePageContent('');
          setHomePageContentError(errorMessage);
          safeStorageRemove(HOME_PAGE_CACHE_KEY);
          showError(errorMessage);
          return;
        }
        renderedContent = sourceContent;
      } else {
        renderedContent = sanitizeHtmlContent(marked.parse(sourceContent));
      }

      setHomePageContent(renderedContent);
      safeStorageSet(HOME_PAGE_CACHE_KEY, renderedContent);
      setHomePageContentError('');
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        t('加载首页内容失败');
      setHomePageContentError(errorMessage);
      if (!cachedContent) {
        showError(errorMessage);
      }
    } finally {
      setHomePageContentLoaded(true);
    }
  };

  useEffect(() => {
    const checkNoticeAndShow = async () => {
      const lastCloseDate = safeStorageGet('notice_close_date');
      const today = new Date().toDateString();
      if (lastCloseDate !== today) {
        try {
          const res = await API.get('/api/notice');
          const { success, data } = res.data;
          if (success && data && data.trim()) {
            setNoticeVisible(true);
          }
        } catch {
          // ignore
        }
      }
    };
    checkNoticeAndShow();
  }, []);

  useEffect(() => {
    displayHomePageContent();
  }, [homeIframeAllowedOrigins, t]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !homePageContent?.startsWith('https://')) return;

    const syncContext = () => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) return;

        const html = iframeDoc.documentElement;
        if (!html) return;

        const isDark = actualTheme === 'dark';
        html.classList.toggle('dark', isDark);

        const existing = iframeDoc.getElementById('injected-theme-style');
        if (existing) existing.remove();

        const style = iframeDoc.createElement('style');
        style.id = 'injected-theme-style';
        style.textContent = `
          html.dark { background: #0a0a0a !important; color: #e5e5e5 !important; }
          html:not(.dark) { background: #fafafa !important; color: #171717 !important; }
        `;
        iframeDoc.head.appendChild(style);
      } catch {
        // ignore cross-origin
      }
    };

    iframe.addEventListener('load', syncContext);
    syncContext();

    return () => {
      iframe.removeEventListener('load', syncContext);
    };
  }, [homePageContent, actualTheme, i18n.language, homeIframeAllowedOrigins]);

  const hasHomePageContent =
    typeof homePageContent === 'string' && homePageContent.trim() !== '';
  const showHero = !hasHomePageContent;

  return (
    <main className='w-full overflow-x-hidden'>
      <Suspense fallback={null}>
        <LoadingScreen onComplete={handleLoadingComplete} />
      </Suspense>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />
      {showHero ? (
        <>
          {/* Hero Section - Two Column Layout */}
          <section className='home-hero' aria-labelledby='home-hero-title'>
            <div className='hero-grid' />
            <Suspense fallback={null}>
              <AmbientParticles isActive={!loading && showHero} />
            </Suspense>
            <div className='home-hero-inner'>
              {/* Left: Text Content */}
              <section
                ref={textRef}
                className='home-text-section'
                style={{
                  opacity: textVisible && !loading ? 1 : 0,
                  transform: textVisible && !loading ? 'translateY(0)' : 'translateY(30px)',
                  transition: `opacity 1s cubic-bezier(${easeOutStrong.join(',')}), transform 1s cubic-bezier(${easeOutStrong.join(',')})`,
                }}
              >
                {/* Badge */}
                <div className='home-badge'>
                  <span className='home-badge-dot' />
                  <span>新一代 AI 基础设施</span>
                </div>

                <h1 id='home-hero-title' className='home-title'>
                  连接全球 <span className='home-title-gradient'>AI 生态</span>
                  <br />
                  一站式智能网关
                </h1>
                <p className='home-description'>
                  统一接入 40+ AI 模型提供商，智能路由、计费与限流，
                  <br />
                  一个接口连接全球 AI 生态。
                </p>

                {/* CTA Buttons */}
                <div className='home-cta-group' role='group' aria-label='首页核心操作'>
                  <Link
                    to='/console'
                    className='home-cta home-cta-primary'
                    aria-label='立即开始使用控制台'
                  >
                    立即开始
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                  {docsExternalUrl ? (
                    <a
                      href={docsExternalUrl}
                      className='home-cta home-cta-secondary'
                      target='_blank'
                      rel='noopener noreferrer'
                      title='浏览文档（新标签页）'
                      aria-label='浏览文档（新标签页打开）'
                    >
                      浏览文档
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                      </svg>
                    </a>
                  ) : (
                    <Link
                      to='/docs'
                      className='home-cta home-cta-secondary'
                      title='浏览文档'
                      aria-label='浏览文档'
                    >
                      浏览文档
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                      </svg>
                    </Link>
                  )}
                </div>

                {/* Stats */}
                <div className='home-stats' role='list' aria-label='平台关键指标'>
                  {STATS.map((stat, i) => (
                    <article key={i} className='home-stat-item' role='listitem'>
                      <div className='home-stat-icon'>{stat.icon}</div>
                      <div className='home-stat-value'>{stat.value}</div>
                      <div className='home-stat-label'>{stat.label}</div>
                    </article>
                  ))}
                </div>

                {homePageContentLoaded && homePageContentError ? (
                  <p className='home-error-hint'>{homePageContentError}</p>
                ) : null}
              </section>

              {/* Right: Globe */}
              <div
                ref={globeRef}
                className='home-globe-section'
                style={{
                  opacity: globeVisible && !loading ? 1 : 0,
                  transform: globeVisible && !loading ? 'scale(1)' : 'scale(0.5)',
                  transition: `opacity 1s cubic-bezier(${easeOutStrong.join(',')}) 0.15s, transform 1s cubic-bezier(${easeOutStrong.join(',')}) 0.15s`,
                }}
              >
                <div className='home-globe-container'>
                  <Suspense fallback={<div className='home-globe-placeholder' />}>
                    <Globe isActive={globeVisible && showHero && !loading} />
                  </Suspense>
                  <div className='home-globe-fade' />
                </div>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section
            ref={featuresRef}
            className='home-features'
            aria-labelledby='home-features-title'
            style={{
              opacity: featuresVisible ? 1 : 0,
              transform: featuresVisible ? 'translateY(0)' : 'translateY(40px)',
              transition: `opacity 0.8s cubic-bezier(${easeOutStrong.join(',')}), transform 0.8s cubic-bezier(${easeOutStrong.join(',')})`,
            }}
          >
            <h2 id='home-features-title' style={VISUALLY_HIDDEN_STYLE}>
              核心能力
            </h2>
            <div className='home-features-grid' role='list'>
              {FEATURES.map((feature, i) => (
                <article key={i} className='home-feature-card' role='listitem'>
                  <div className='home-feature-icon'>{feature.icon}</div>
                  <h3 className='home-feature-title'>{feature.title}</h3>
                  <p className='home-feature-desc'>{feature.desc}</p>
                </article>
              ))}
            </div>
          </section>

          {/* Providers Section */}
          <section
            ref={providersRef}
            className='home-providers'
            aria-labelledby='home-providers-title'
            style={{
              opacity: providersVisible ? 1 : 0,
              transform: providersVisible ? 'translateY(0)' : 'translateY(40px)',
              transition: `opacity 0.8s cubic-bezier(${easeOutStrong.join(',')}), transform 0.8s cubic-bezier(${easeOutStrong.join(',')})`,
            }}
          >
            <h2 id='home-providers-title' className='home-providers-title'>
              丰富的模型生态
            </h2>
            <p className='home-providers-subtitle'>接入全球顶尖 AI 模型，持续更新中...</p>
            <div className='home-providers-grid' role='list' aria-label='模型提供商'>
              {PROVIDERS.map((provider, i) => (
                <article key={i} className='home-provider-item' role='listitem'>
                  <div
                    className='home-provider-icon'
                    style={{ background: provider.color }}
                  >
                    {provider.name.charAt(0)}
                  </div>
                  <span className='home-provider-name'>{provider.name}</span>
                </article>
              ))}
              <article className='home-provider-item home-provider-more' role='listitem'>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                </svg>
                <span>更多模型</span>
              </article>
            </div>
          </section>

          {/* Floating Support Button - Right side vertical */}
          <a
            href="mailto:support@quantumnous.com"
            className='home-support-btn'
            title='联系客服'
            aria-label='联系客服（发送邮件）'
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>联系客服</span>
          </a>
        </>
      ) : (
        <div className='overflow-x-hidden w-full'>
          {homePageContent.startsWith('https://') ? (
            <iframe
              ref={iframeRef}
              src={homePageContent}
              className='w-full h-screen border-none'
              title='home-content'
              sandbox='allow-scripts allow-forms allow-popups allow-downloads'
              referrerPolicy='no-referrer'
              loading='lazy'
            />
          ) : (
            <div
              className='mt-[60px]'
              dangerouslySetInnerHTML={{ __html: homePageContent }}
            />
          )}
        </div>
      )}
    </main>
  );
};

export default Home;
