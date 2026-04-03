const HTML_HREF_REGEX = /href\s*=\s*["']([^"']+)["']/i;
const URL_REGEX = /https?:\/\/[^\s<>"']+/i;

function toAbsoluteUrl(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function findDescriptionHref(description) {
  if (!description) {
    return null;
  }

  const htmlMatch = description.match(HTML_HREF_REGEX);
  if (htmlMatch) {
    return toAbsoluteUrl(htmlMatch[1]);
  }

  const textMatch = description.match(URL_REGEX);
  if (textMatch) {
    return toAbsoluteUrl(textMatch[0]);
  }

  return null;
}

function pickEventUrl(event) {
  const candidates = [
    event.url,
    event.htmlLink,
    event?.google?.htmlLink,
    event?.metadata?.htmlLink,
  ];

  for (const candidate of candidates) {
    const url = toAbsoluteUrl(candidate);
    if (url) {
      return url;
    }
  }

  return null;
}

module.exports = {
  findDescriptionHref,
  pickEventUrl,
  toAbsoluteUrl,
};

