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

const createDefaultPricingConfig = () => ({
  enabled: true,
  requireAuth: false,
});

const createDefaultCustomExternalLink = () => ({
  enabled: false,
  text: '',
  url: '',
});

export const getDefaultHeaderNavModules = () => ({
  home: true,
  console: true,
  pricing: createDefaultPricingConfig(),
  docs: true,
  about: true,
  customExternalLink: createDefaultCustomExternalLink(),
});

const normalizeBooleanModule = (value, fallback) =>
  typeof value === 'boolean' ? value : fallback;

const normalizePricingModule = (value) => {
  const fallback = createDefaultPricingConfig();
  if (typeof value === 'boolean') {
    return {
      enabled: value,
      requireAuth: false,
    };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  return {
    enabled:
      typeof value.enabled === 'boolean' ? value.enabled : fallback.enabled,
    requireAuth:
      typeof value.requireAuth === 'boolean'
        ? value.requireAuth
        : fallback.requireAuth,
  };
};

const normalizeCustomExternalLink = (value) => {
  const fallback = createDefaultCustomExternalLink();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  return {
    enabled:
      typeof value.enabled === 'boolean' ? value.enabled : fallback.enabled,
    text: typeof value.text === 'string' ? value.text.trim() : fallback.text,
    url: typeof value.url === 'string' ? value.url.trim() : fallback.url,
  };
};

export const normalizeHeaderNavModules = (value) => {
  const fallback = getDefaultHeaderNavModules();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  return {
    ...value,
    home: normalizeBooleanModule(value.home, fallback.home),
    console: normalizeBooleanModule(value.console, fallback.console),
    pricing: normalizePricingModule(value.pricing),
    docs: normalizeBooleanModule(value.docs, fallback.docs),
    about: normalizeBooleanModule(value.about, fallback.about),
    customExternalLink: normalizeCustomExternalLink(value.customExternalLink),
  };
};

export const parseHeaderNavModules = (value) => {
  if (!value) {
    return getDefaultHeaderNavModules();
  }

  if (typeof value === 'string') {
    try {
      return normalizeHeaderNavModules(JSON.parse(value));
    } catch (error) {
      return getDefaultHeaderNavModules();
    }
  }

  return normalizeHeaderNavModules(value);
};

export const getPricingRequireAuth = (modules) =>
  parseHeaderNavModules(modules).pricing.requireAuth;

const isSafeExternalUrl = (value) => /^https?:\/\//i.test(value);

export const shouldShowCustomExternalLink = (modules) => {
  const normalized = parseHeaderNavModules(modules);
  const customLink = normalized.customExternalLink;

  return (
    customLink.enabled &&
    customLink.text !== '' &&
    customLink.url !== '' &&
    isSafeExternalUrl(customLink.url)
  );
};
