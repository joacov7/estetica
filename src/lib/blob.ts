/** Whether Vercel Blob is configured (image uploads available). */
export const blobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
