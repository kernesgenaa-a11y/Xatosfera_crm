INSERT INTO users (id, email, password_hash, full_name, role, approved, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'kernesgenaa@gmail.com',
  'fe0a356f0e550139d45f655051c4a4c8:041a72ead2fe9592a26727a3d1ba8feb3a8f6e2c1e08594e74ccefa7b49b55b2',
  'Суперюзер',
  'superuser',
  1,
  1,
  datetime('now'),
  datetime('now')
);
