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
    let triggered = false;

    const reveal = (revealDelay = delay) => {
      if (triggered) {
        return;
      }
      triggered = true;
      const timerId = window.setTimeout(
        () => setVisible(true),
        Math.max(0, revealDelay),
      );
      timerIds.push(timerId);
    };

    if (!('IntersectionObserver' in window)) {
      reveal(delay);
      return () => {
        timerIds.forEach((timerId) => window.clearTimeout(timerId));
      };
    }

    const fallbackTimer = window.setTimeout(() => reveal(delay), 1500);
    timerIds.push(fallbackTimer);

    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          reveal(delay);
          observer.unobserve(el);
        }
      },
      { threshold },
    );

    observer.observe(el);

    if (
      el.getBoundingClientRect().top <
      window.innerHeight * (1 - threshold + 0.15)
    ) {
      reveal(delay + 100);
      observer.unobserve(el);
    }

    return () => {
      observer.disconnect();
      timerIds.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [threshold, delay]);

  return [ref, visible];
}

function safeStorageGet(key) {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function safeStorageSet(key, value) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage set failure
  }
}

function safeStorageRemove(key) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage remove failure
  }
}

function getCachedHomePageContent() {
  return safeStorageGet(HOME_PAGE_CACHE_KEY);
}

function getUrlOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function parseHomeIframeAllowlist(raw) {
  if (!raw) {
    return [];
  }
  return String(raw)
    .split(/[\n,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      try {
        return new URL(item).origin;
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

function getHomeIframeAllowedOrigins(statusState) {
  const origins = new Set();
  if (typeof window !== 'undefined') {
    origins.add(window.location.origin);
  }
  const status = statusState?.status || {};
  HOME_IFRAME_ALLOWLIST_KEYS.forEach((key) => {
    parseHomeIframeAllowlist(status[key]).forEach((origin) => {
      origins.add(origin);
    });
  });
  return origins;
}

function isAllowedHomeIframeUrl(url, allowedOrigins) {
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    return false;
  }
  const origin = getUrlOrigin(url);
  return !!origin && allowedOrigins.has(origin);
}

function isSafeAttributeUrl(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return false;
  }
  return SAFE_URL_PREFIX.test(normalized) && !/^javascript:/i.test(normalized);
}

function sanitizeHtmlContent(rawHtml) {
  if (typeof rawHtml !== 'string') {
    return '';
  }
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return rawHtml
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');
  const sanitizeNode = (node) => {
    const children = Array.from(node.children || []);
    children.forEach((child) => {
      const tag = child.tagName?.toLowerCase();
      if (BLOCKED_HTML_TAGS.has(tag)) {
        child.remove();
        return;
      }

      Array.from(child.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value;

        if (name.startsWith('on')) {
          child.removeAttribute(attr.name);
          return;
        }

        if (URL_ATTRS.has(name) && !isSafeAttributeUrl(value)) {
          child.removeAttribute(attr.name);
          return;
        }

        if (name === 'target') {
          child.setAttribute('rel', 'noopener noreferrer');
        }
      });

      sanitizeNode(child);
    });
  };

  sanitizeNode(doc.body);
  return doc.body.innerHTML;
}

function normalizeHomePageContent(raw) {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw.trim();
}

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const actualTheme = useActualTheme();
  const homeIframeAllowedOrigins = useMemo(
    () => getHomeIframeAllowedOrigins(statusState),
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
          if (success && data && data.trim() !== '') {
            setNoticeVisible(true);
          }
        } catch {
          // ignore notice failure
        }
      }
    };

    checkNoticeAndShow();
  }, []);

  useEffect(() => {
    displayHomePageContent();
  }, [homeIframeAllowedOrigins, t]);

  useEffect(() => {
    if (!homePageContent?.startsWith('https://')) {
      return;
    }
    const iframe = iframeRef.current;
    if (!iframe) {
      return;
    }
    const targetOrigin = getUrlOrigin(homePageContent);
    if (!targetOrigin || !homeIframeAllowedOrigins.has(targetOrigin)) {
      return;
    }

    const syncContext = () => {
      if (!iframe.contentWindow) {
        return;
      }
      iframe.contentWindow.postMessage(
        { themeMode: actualTheme },
        targetOrigin,
      );
      iframe.contentWindow.postMessage({ lang: i18n.language }, targetOrigin);
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
    <div className='w-full overflow-x-hidden'>
      <NoticeModal
        visible={noticeVisible}
        onClose={() => setNoticeVisible(false)}
        isMobile={isMobile}
      />
      {showHero ? (
        <div className='home-hero'>
          <div className='home-hero-inner'>
            <div
              ref={textRef}
              className='home-text-section'
              style={{
                opacity: textVisible ? 1 : 0,
                transform: textVisible ? 'translateY(0)' : 'translateY(30px)',
                transition: `opacity 1s cubic-bezier(${easeOutStrong.join(',')}), transform 1s cubic-bezier(${easeOutStrong.join(',')})`,
              }}
            >
              <h1 className='home-title'>
                {t('连接全球 AI 生态')}
                <br />
                <span className='home-title-gradient'>
                  {t('一站式智能网关')}
                </span>
              </h1>
              <p className='home-description'>
                {t(
                  '统一接入 40+ AI 模型提供商，智能路由、计费与限流，一个接口连接全球生态。',
                )}
              </p>
              <Link to='/console' className='home-cta'>
                {t('立即开始')}
              </Link>
              {homePageContentLoaded && homePageContentError ? (
                <p className='home-error-hint'>{homePageContentError}</p>
              ) : null}
            </div>

            <div
              ref={globeRef}
              className='home-globe-section'
              style={{
                opacity: globeVisible ? 1 : 0,
                transform: globeVisible ? 'scale(1)' : 'scale(0.5)',
                transition: `opacity 1s cubic-bezier(${easeOutStrong.join(',')}) 0.15s, transform 1s cubic-bezier(${easeOutStrong.join(',')}) 0.15s`,
              }}
            >
              <div className='home-globe-container'>
                <Suspense fallback={<div className='home-globe-placeholder' />}>
                  <Globe isActive={globeVisible && showHero} />
                </Suspense>
                <div className='home-globe-fade' />
              </div>
            </div>
          </div>
        </div>
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
    </div>
  );
};

export default Home;
