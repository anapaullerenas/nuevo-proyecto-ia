update storage.buckets
set
  file_size_limit = 2147483648,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-m4v',
    'application/pdf',
    'text/plain'
  ]
where id = 'creative-assets';
