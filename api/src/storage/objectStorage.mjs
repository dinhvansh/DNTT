import crypto from 'node:crypto';
import { Client as MinioClient } from 'minio';

function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function inferContentType(fileName) {
  const normalized = String(fileName || '').toLowerCase();

  if (normalized.endsWith('.pdf')) return 'application/pdf';
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.gif')) return 'image/gif';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.txt')) return 'text/plain; charset=utf-8';
  if (normalized.endsWith('.csv')) return 'text/csv; charset=utf-8';
  if (normalized.endsWith('.doc')) return 'application/msword';
  if (normalized.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (normalized.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (normalized.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }

  return 'application/octet-stream';
}

function parseMinioFilePath(filePath) {
  if (!filePath?.startsWith('minio://')) {
    return null;
  }

  const withoutScheme = filePath.replace(/^minio:\/\//, '');
  const firstSlash = withoutScheme.indexOf('/');
  if (firstSlash <= 0) {
    return null;
  }

  return {
    bucketName: withoutScheme.slice(0, firstSlash),
    objectName: withoutScheme.slice(firstSlash + 1),
  };
}

function buildMinioClient(config) {
  if (
    !config.storageEndpoint ||
    !config.storageBucket ||
    !config.storageAccessKey ||
    !config.storageSecretKey
  ) {
    return null;
  }

  const endpoint = new URL(config.storageEndpoint);
  return new MinioClient({
    endPoint: endpoint.hostname,
    port: Number(endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80)),
    useSSL: endpoint.protocol === 'https:',
    accessKey: config.storageAccessKey,
    secretKey: config.storageSecretKey,
  });
}

let ensuredBucketKey = null;
let ensuredBucketPromise = null;

async function ensureBucketExists(client, bucketName) {
  const cacheKey = `${bucketName}`;
  if (ensuredBucketKey === cacheKey && ensuredBucketPromise) {
    return ensuredBucketPromise;
  }

  ensuredBucketKey = cacheKey;
  ensuredBucketPromise = (async () => {
    const exists = await client.bucketExists(bucketName);
    if (!exists) {
      await client.makeBucket(bucketName, 'ap-southeast-1');
    }
  })();

  return ensuredBucketPromise;
}

export async function uploadAttachmentBinary({ config, actorId, fileName, contentType, data }) {
  const normalizedName = sanitizeFileName(fileName || 'attachment.bin');
  const size = Buffer.byteLength(data);
  const uploadedAt = new Date().toISOString();

  const client = buildMinioClient(config);
  if (!client) {
    return {
      fileName: normalizedName,
      filePath: `local-upload/${normalizedName}`,
      fileSize: size,
      uploadedAt,
    };
  }

  await ensureBucketExists(client, config.storageBucket);

  const objectName = `attachments/${uploadedAt.slice(0, 10)}/${crypto.randomUUID()}-${normalizedName}`;
  await client.putObject(
    config.storageBucket,
    objectName,
    data,
    size,
    {
      'Content-Type': contentType || 'application/octet-stream',
      'X-Amz-Meta-Actor-Id': actorId || 'unknown',
      'X-Amz-Meta-Original-Name': normalizedName,
    }
  );

  return {
    fileName: normalizedName,
    filePath: `minio://${config.storageBucket}/${objectName}`,
    fileSize: size,
    uploadedAt,
  };
}

export async function getAttachmentBinary({ config, filePath, fileName }) {
  if (filePath?.startsWith('local-upload/')) {
    throw new Error('Legacy local-upload attachments do not have retrievable binary content.');
  }

  const parsedPath = parseMinioFilePath(filePath);
  if (!parsedPath) {
    throw new Error('Attachment storage path is invalid.');
  }

  const client = buildMinioClient(config);
  if (!client) {
    throw new Error('Object storage is not configured.');
  }

  const stream = await client.getObject(parsedPath.bucketName, parsedPath.objectName);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  let contentType = inferContentType(fileName);
  try {
    const objectStat = await client.statObject(parsedPath.bucketName, parsedPath.objectName);
    const metaType = objectStat?.metaData?.['content-type'] ?? objectStat?.metaData?.['Content-Type'];
    if (typeof metaType === 'string' && metaType.trim()) {
      contentType = metaType.trim();
    }
  } catch {
    // Fall back to extension-based detection when metadata cannot be read.
  }

  return {
    data: Buffer.concat(chunks),
    contentType,
    fileName,
  };
}
