const {toAbsoluteUrl} = require('./extractLinks');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

function normalizeAttachValues(attach) {
  if (!attach) {
    return [];
  }

  if (Array.isArray(attach)) {
    return attach.flatMap(normalizeAttachValues);
  }

  if (typeof attach === 'string') {
    return [attach];
  }

  if (typeof attach === 'object') {
    return [attach.val, attach.uri, attach.url].filter(Boolean);
  }

  return [];
}

function extractGoogleDriveFileId(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /uc\?id=([a-zA-Z0-9_-]+)/,
    /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function toDriveImageUrl(value) {
  const fileId = extractGoogleDriveFileId(value);
  if (!fileId) {
    return null;
  }

  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

function isImageUrl(value) {
  if (!value) {
    return false;
  }

  const lower = value.toLowerCase();
  return IMAGE_EXTENSIONS.some((extension) => lower.includes(extension));
}

function extractFirstImageUrl(text) {
  if (!text) {
    return null;
  }

  const matches = text.match(/https?:\/\/[^\s<>"']+/gi) || [];
  for (const match of matches) {
    const normalized = toAbsoluteUrl(match);
    if (!normalized) {
      continue;
    }

    if (isImageUrl(normalized)) {
      return normalized;
    }

    const driveImage = toDriveImageUrl(normalized);
    if (driveImage) {
      return driveImage;
    }
  }

  return null;
}

function extractImageUrl(event) {
  const attachValues = normalizeAttachValues(event.attach);
  for (const value of attachValues) {
    const normalized = toAbsoluteUrl(value);
    if (!normalized) {
      continue;
    }

    if (isImageUrl(normalized)) {
      return normalized;
    }

    const driveImage = toDriveImageUrl(normalized);
    if (driveImage) {
      return driveImage;
    }
  }

  return extractFirstImageUrl(event.description);
}

module.exports = {
  extractGoogleDriveFileId,
  extractImageUrl,
  toDriveImageUrl,
};

