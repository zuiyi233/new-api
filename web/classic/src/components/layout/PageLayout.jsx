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

import HeaderBar from './headerbar';
import { Layout } from '@douyinfe/semi-ui';
import SiderBar from './SiderBar';
import App from '../../App';
import FooterBar from './Footer';
import { ToastContainer } from 'react-toastify';
import React, { useContext, useEffect, useState } from 'react';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { useSidebarCollapsed } from '../../hooks/common/useSidebarCollapsed';
import { useTranslation } from 'react-i18next';
import {
  API,
  getLogo,
  getSystemName,
  showError,
  setStatusData,
} from '../../helpers';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { useLocation } from 'react-router-dom';
import { normalizeLanguage } from '../../i18n/language';
const { Sider, Content, Header } = Layout;

const BRAND_FAVICON_PATH = '/miaowu-favicon.svg';
const BRAND_FAVICON_VERSION = '20260423';
const BRAND_FAVICON_URL = `${BRAND_FAVICON_PATH}?v=${BRAND_FAVICON_VERSION}`;
const LEGACY_LOGO_PATH = '/logo.png';
const LEGACY_FAVICON_PATH = '/favicon.ico';
const LEGACY_FAVICON_PATHS = new Set([
  '/logo.png',
  'logo.png',
  '/favicon.ico',
  'favicon.ico',
]);
const SAFE_DATA_IMAGE_PREFIX = /^data:image\//i;
const SAFE_HTTP_PREFIX = /^https?:\/\//i;
const SAFE_ABSOLUTE_PATH = /^\/(?!\/)/;
const SAFE_RELATIVE_PATH = /^\.{0,2}\/.+/;

const extractPathname = (urlLike) => {
  try {
    return new URL(urlLike, window.location.origin).pathname.toLowerCase();
  } catch {
    return String(urlLike || '')
      .split('?')[0]
      .split('#')[0]
      .toLowerCase();
  }
};

const isSafeFaviconUrl = (urlLike) => {
  if (!urlLike) return false;
  if (SAFE_DATA_IMAGE_PREFIX.test(urlLike)) return true;
  if (SAFE_HTTP_PREFIX.test(urlLike)) return true;
  if (SAFE_ABSOLUTE_PATH.test(urlLike)) return true;
  if (SAFE_RELATIVE_PATH.test(urlLike)) return true;
  return false;
};

const resolveFavicon = (logoUrl) => {
  const normalizedLogoUrl =
    typeof logoUrl === 'string' ? logoUrl.trim() : '';
  const normalizedLower = normalizedLogoUrl.toLowerCase();
  const isEmptyLike =
    !normalizedLower ||
    normalizedLower === 'null' ||
    normalizedLower === 'undefined' ||
    normalizedLower === 'false';

  if (isEmptyLike) {
    return { url: BRAND_FAVICON_URL, forcedBrand: true };
  }

  const pathname = extractPathname(normalizedLogoUrl);
  const isLegacyPath =
    LEGACY_FAVICON_PATHS.has(pathname) ||
    pathname.endsWith(LEGACY_LOGO_PATH) ||
    pathname.endsWith(LEGACY_FAVICON_PATH);
  if (isLegacyPath) {
    return { url: BRAND_FAVICON_URL, forcedBrand: true };
  }

  if (!isSafeFaviconUrl(normalizedLogoUrl)) {
    return { url: BRAND_FAVICON_URL, forcedBrand: true };
  }

  return { url: normalizedLogoUrl, forcedBrand: false };
};

const applyFavicon = (logoUrl) => {
  const { url: faviconUrl, forcedBrand } = resolveFavicon(logoUrl);
  const isBrandFavicon = faviconUrl.startsWith(BRAND_FAVICON_PATH);

  let iconLinkElement = document.querySelector("link[rel~='icon']");
  if (!iconLinkElement) {
    iconLinkElement = document.createElement('link');
    iconLinkElement.rel = 'icon';
    document.head.appendChild(iconLinkElement);
  }
  iconLinkElement.type = isBrandFavicon ? 'image/svg+xml' : '';
  iconLinkElement.href = faviconUrl;

  let shortcutIconLinkElement = document.querySelector(
    "link[rel='shortcut icon']",
  );
  if (!shortcutIconLinkElement) {
    shortcutIconLinkElement = document.createElement('link');
    shortcutIconLinkElement.rel = 'shortcut icon';
    document.head.appendChild(shortcutIconLinkElement);
  }
  shortcutIconLinkElement.type = isBrandFavicon ? 'image/svg+xml' : '';
  shortcutIconLinkElement.href = faviconUrl;

  if (forcedBrand) {
    try {
      localStorage.setItem('logo', BRAND_FAVICON_PATH);
    } catch {
      // ignore storage errors
    }
  }
};

const PageLayout = () => {
  const [userState, userDispatch] = useContext(UserContext);
  const [, statusDispatch] = useContext(StatusContext);
  const isMobile = useIsMobile();
  const [collapsed, , setCollapsed] = useSidebarCollapsed();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { i18n } = useTranslation();
  const location = useLocation();

  const cardProPages = [
    '/console/channel',
    '/console/log',
    '/console/code-center',
    '/console/redemption',
    '/console/user',
    '/console/token',
    '/console/midjourney',
    '/console/task',
    '/console/models',
    '/pricing',
  ];

  const shouldHideFooter = cardProPages.includes(location.pathname);

  const shouldInnerPadding =
    location.pathname.includes('/console') &&
    !location.pathname.startsWith('/console/chat') &&
    location.pathname !== '/console/playground';

  const isConsoleRoute = location.pathname.startsWith('/console');
  const showSider = isConsoleRoute && (!isMobile || drawerOpen);

  useEffect(() => {
    if (isMobile && drawerOpen && collapsed) {
      setCollapsed(false);
    }
  }, [isMobile, drawerOpen, collapsed, setCollapsed]);

  const loadUser = () => {
    let user = localStorage.getItem('user');
    if (user) {
      let data = JSON.parse(user);
      userDispatch({ type: 'login', payload: data });
    }
  };

  const loadStatus = async () => {
    try {
      const res = await API.get('/api/status');
      const { success, data } = res.data;
      if (success) {
        statusDispatch({ type: 'set', payload: data });
        setStatusData(data);
        if (data?.system_name) {
          document.title = data.system_name;
        }
        applyFavicon(data?.logo);
      } else {
        showError('Unable to connect to server');
      }
    } catch (error) {
      showError('Failed to load status');
    }
  };

  useEffect(() => {
    loadUser();
    loadStatus().catch(console.error);
    let systemName = getSystemName();
    if (systemName) {
      document.title = systemName;
    }
    applyFavicon(getLogo());
  }, []);

  useEffect(() => {
    let preferredLang;

    if (userState?.user?.setting) {
      try {
        const settings = JSON.parse(userState.user.setting);
        preferredLang = normalizeLanguage(settings.language);
      } catch (e) {
        // Ignore parse errors
      }
    }

    if (!preferredLang) {
      const savedLang = localStorage.getItem('i18nextLng');
      if (savedLang) {
        preferredLang = normalizeLanguage(savedLang);
      }
    }

    if (preferredLang) {
      localStorage.setItem('i18nextLng', preferredLang);
      if (preferredLang !== i18n.language) {
        i18n.changeLanguage(preferredLang);
      }
    }
  }, [i18n, userState?.user?.setting]);

  return (
    <Layout
      className='app-layout'
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: isMobile ? 'visible' : 'hidden',
      }}
    >
      <Header
        style={{
          padding: 0,
          height: 'auto',
          lineHeight: 'normal',
          position: 'fixed',
          width: '100%',
          top: 0,
          zIndex: 100,
        }}
      >
        <HeaderBar
          onMobileMenuToggle={() => setDrawerOpen((prev) => !prev)}
          drawerOpen={drawerOpen}
        />
      </Header>
      <Layout
        style={{
          overflow: isMobile ? 'visible' : 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {showSider && (
          <Sider
            className='app-sider'
            style={{
              position: 'fixed',
              left: 0,
              top: '64px',
              zIndex: 99,
              border: 'none',
              paddingRight: '0',
              width: 'var(--sidebar-current-width)',
            }}
          >
            <SiderBar
              onNavigate={() => {
                if (isMobile) setDrawerOpen(false);
              }}
            />
          </Sider>
        )}
        <Layout
          style={{
            marginLeft: isMobile
              ? '0'
              : showSider
                ? 'var(--sidebar-current-width)'
                : '0',
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Content
            style={{
              flex: '1 0 auto',
              overflowY: isMobile ? 'visible' : 'hidden',
              WebkitOverflowScrolling: 'touch',
              padding: shouldInnerPadding ? (isMobile ? '5px' : '24px') : '0',
              position: 'relative',
            }}
          >
            <App />
          </Content>
          {!shouldHideFooter && (
            <Layout.Footer
              style={{
                flex: '0 0 auto',
                width: '100%',
              }}
            >
              <FooterBar />
            </Layout.Footer>
          )}
        </Layout>
      </Layout>
      <ToastContainer />
    </Layout>
  );
};

export default PageLayout;
