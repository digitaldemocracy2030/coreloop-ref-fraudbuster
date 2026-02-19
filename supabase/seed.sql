BEGIN;

-- Re-seeding safety: clear data while keeping schema.
TRUNCATE TABLE
  announcement_tag_relations,
  announcement_tags,
  report_images,
  report_timelines,
  announcements,
  banners,
  reports,
  users,
  admins,
  daily_statistics,
  report_statuses,
  fraud_categories,
  platforms
RESTART IDENTITY CASCADE;

-- =============================================
-- 1) Master data
-- =============================================

INSERT INTO fraud_categories (name, color_code, display_order, is_active) VALUES
  ('製品/サービス', '#3B82F6', 1, TRUE),
  ('投資', '#F59E0B', 2, TRUE),
  ('ロマンス', '#EC4899', 3, TRUE),
  ('求人', '#8B5CF6', 4, TRUE),
  ('なりすまし', '#EF4444', 5, TRUE),
  ('脅迫', '#DC2626', 6, TRUE),
  ('寄付詐欺', '#10B981', 7, TRUE),
  ('フィッシング', '#F97316', 8, TRUE);

INSERT INTO platforms (name, icon_url, is_active) VALUES
  ('Facebook', '/icons/platforms/facebook.svg', TRUE),
  ('LINE', '/icons/platforms/line.svg', TRUE),
  ('Instagram', '/icons/platforms/instagram.svg', TRUE),
  ('Threads', '/icons/platforms/threads.svg', TRUE),
  ('Google', '/icons/platforms/google.svg', TRUE),
  ('TikTok', '/icons/platforms/tiktok.svg', TRUE),
  ('Meta Audience Network', '/icons/platforms/meta-audience-network.svg', TRUE);

INSERT INTO report_statuses (status_code, label, badge_color) VALUES
  ('PENDING', '処理待ち', 'gray'),
  ('UNDER_REVIEW', '調査中', 'blue'),
  ('HIGH_RISK', '高リスク', 'orange'),
  ('CONFIRMED_FRAUD', '詐欺確定', 'red'),
  ('SAFE', '安全', 'green'),
  ('INSUFFICIENT_INFO', '判断不能', 'zinc');

-- =============================================
-- 2) Users & admins
-- =============================================

INSERT INTO admins (id, email, password_hash, name, role, created_at) VALUES
  ('10000000-0000-4000-8000-000000000001', 'admin@example.com', '$2b$12$admin.seed.hash.placeholder', '運営管理者', 'SUPER_ADMIN', CURRENT_TIMESTAMP - INTERVAL '30 days'),
  ('10000000-0000-4000-8000-000000000002', 'moderator@example.com', '$2b$12$moderator.seed.hash.placeholder', '審査担当', 'MODERATOR', CURRENT_TIMESTAMP - INTERVAL '15 days');

INSERT INTO users (id, email, created_at, last_login_at) VALUES
  ('20000000-0000-4000-8000-000000000001', 'reporter1@example.com', CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '1 day'),
  ('20000000-0000-4000-8000-000000000002', 'reporter2@example.com', CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '2 days'),
  ('20000000-0000-4000-8000-000000000003', 'reporter3@example.com', CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '6 hours');

-- =============================================
-- 3) Reports / cases
-- =============================================

INSERT INTO reports (
  id, user_id, url, title, description, platform_id, category_id, status_id,
  risk_score, view_count, report_count, source_ip, privacy_policy_agreed_at, created_at, updated_at
) VALUES
  (
    'rpt8k2m1xq9v',
    '20000000-0000-4000-8000-000000000001',
    'https://line-support-check.example.com/login',
    'LINEサポートを装った認証誘導',
    'LINEアカウント凍結を装うメッセージ経由で偽ログインページへ誘導される事例。',
    (SELECT id FROM platforms WHERE name = 'LINE'),
    (SELECT id FROM fraud_categories WHERE name = 'フィッシング'),
    (SELECT id FROM report_statuses WHERE status_code = 'CONFIRMED_FRAUD'),
    92, 1450, 12, '203.0.113.10',
    CURRENT_TIMESTAMP - INTERVAL '9 days',
    CURRENT_TIMESTAMP - INTERVAL '9 days',
    CURRENT_TIMESTAMP - INTERVAL '2 days'
  ),
  (
    'rpt4d7n3b6ty',
    '20000000-0000-4000-8000-000000000002',
    'https://guaranteed-profit-invest.example.net',
    '高配当をうたう投資グループ勧誘',
    'SNS広告から外部チャットへ誘導され、保証付き高収益を強調して入金を迫る。',
    (SELECT id FROM platforms WHERE name = 'Facebook'),
    (SELECT id FROM fraud_categories WHERE name = '投資'),
    (SELECT id FROM report_statuses WHERE status_code = 'HIGH_RISK'),
    84, 980, 7, '198.51.100.27',
    CURRENT_TIMESTAMP - INTERVAL '6 days',
    CURRENT_TIMESTAMP - INTERVAL '6 days',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
  ),
  (
    'rpt1z5c8w2hj',
    '20000000-0000-4000-8000-000000000003',
    'https://job-fastincome.example.org/apply',
    '即日高収入求人の個人情報収集',
    '応募直後に本人確認名目で身分証画像の提出を求められる。現時点では調査中。',
    (SELECT id FROM platforms WHERE name = 'Instagram'),
    (SELECT id FROM fraud_categories WHERE name = '求人'),
    (SELECT id FROM report_statuses WHERE status_code = 'UNDER_REVIEW'),
    66, 430, 3, '192.0.2.55',
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    CURRENT_TIMESTAMP - INTERVAL '3 days',
    CURRENT_TIMESTAMP - INTERVAL '6 hours'
  );

INSERT INTO report_images (id, report_id, image_url, display_order, created_at) VALUES
  ('31000000-0000-4000-8000-000000000001', 'rpt8k2m1xq9v', 'https://cdn.example.com/reports/line-phishing-01.png', 1, CURRENT_TIMESTAMP - INTERVAL '9 days'),
  ('31000000-0000-4000-8000-000000000002', 'rpt8k2m1xq9v', 'https://cdn.example.com/reports/line-phishing-02.png', 2, CURRENT_TIMESTAMP - INTERVAL '9 days'),
  ('31000000-0000-4000-8000-000000000003', 'rpt4d7n3b6ty', 'https://cdn.example.com/reports/invest-01.png', 1, CURRENT_TIMESTAMP - INTERVAL '6 days'),
  ('31000000-0000-4000-8000-000000000004', 'rpt1z5c8w2hj', 'https://cdn.example.com/reports/job-01.png', 1, CURRENT_TIMESTAMP - INTERVAL '3 days');

INSERT INTO report_timelines (id, report_id, action_label, description, created_by, occurred_at) VALUES
  ('32000000-0000-4000-8000-000000000001', 'rpt8k2m1xq9v', 'ユーザー通報受付', '通報フォームから案件を受理。', NULL, CURRENT_TIMESTAMP - INTERVAL '9 days'),
  ('32000000-0000-4000-8000-000000000002', 'rpt8k2m1xq9v', 'プラットフォームへ通知', 'LINE運営窓口に削除依頼を送信。', '10000000-0000-4000-8000-000000000002', CURRENT_TIMESTAMP - INTERVAL '8 days'),
  ('32000000-0000-4000-8000-000000000003', 'rpt8k2m1xq9v', '詐欺確定', '複数の同種報告と照合し詐欺確定と判定。', '10000000-0000-4000-8000-000000000001', CURRENT_TIMESTAMP - INTERVAL '7 days'),
  ('32000000-0000-4000-8000-000000000004', 'rpt4d7n3b6ty', '調査開始', '投資勧誘の証拠資料を精査中。', '10000000-0000-4000-8000-000000000002', CURRENT_TIMESTAMP - INTERVAL '5 days'),
  ('32000000-0000-4000-8000-000000000005', 'rpt1z5c8w2hj', '追加情報待ち', '投稿者へ追加スクリーンショット提出を依頼。', '10000000-0000-4000-8000-000000000002', CURRENT_TIMESTAMP - INTERVAL '2 days');

-- =============================================
-- 4) CMS
-- =============================================

INSERT INTO announcements (id, title, content, thumbnail_url, is_important, is_published, published_at, created_by, created_at) VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '投資詐欺の急増に関する注意喚起',
    'SNS上の高配当・元本保証をうたう勧誘に注意してください。疑わしいURLは必ず検索してからアクセスしてください。',
    'https://cdn.example.com/announcements/invest-alert.png',
    TRUE, TRUE, CURRENT_TIMESTAMP - INTERVAL '4 days',
    '10000000-0000-4000-8000-000000000001',
    CURRENT_TIMESTAMP - INTERVAL '4 days'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    'システムメンテナンス予定',
    '毎週日曜日 02:00-03:00 に定期メンテナンスを実施します。検索機能が一時的に遅延する可能性があります。',
    NULL,
    FALSE, TRUE, CURRENT_TIMESTAMP - INTERVAL '1 day',
    '10000000-0000-4000-8000-000000000002',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
  );

INSERT INTO announcement_tags (name) VALUES
  ('重要情報'),
  ('詐欺トレンド'),
  ('メンテナンス');

INSERT INTO announcement_tag_relations (announcement_id, tag_id) VALUES
  ('40000000-0000-4000-8000-000000000001', (SELECT id FROM announcement_tags WHERE name = '重要情報')),
  ('40000000-0000-4000-8000-000000000001', (SELECT id FROM announcement_tags WHERE name = '詐欺トレンド')),
  ('40000000-0000-4000-8000-000000000002', (SELECT id FROM announcement_tags WHERE name = 'メンテナンス'));

INSERT INTO banners (
  id, title, message, link_url, bg_color, text_color,
  is_active, display_order, starts_at, ends_at, created_by, created_at, updated_at
) VALUES
  (
    '50000000-0000-4000-8000-000000000001',
    '緊急: LINE偽認証ページ多発',
    'LINE公式を装うURLへのアクセスが急増しています。受信したURLは必ず本サイトで確認してください。',
    'https://example.com/announcements/line-phishing-alert',
    '#FFF3CD', '#664D03',
    TRUE, 1,
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP + INTERVAL '5 days',
    '10000000-0000-4000-8000-000000000001',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
  );

-- =============================================
-- 5) Daily statistics
-- =============================================

INSERT INTO daily_statistics (
  date, total_reports, high_risk_count, confirmed_fraud_count,
  platform_stats, category_stats, status_stats, created_at
) VALUES
  (
    CURRENT_DATE - 2,
    14,
    5,
    4,
    '{"LINE": 6, "Facebook": 4, "Instagram": 2, "Google": 2}'::jsonb,
    '{"フィッシング": 5, "投資": 4, "求人": 2, "なりすまし": 3}'::jsonb,
    '{"PENDING": 1, "UNDER_REVIEW": 4, "HIGH_RISK": 5, "CONFIRMED_FRAUD": 4}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '2 days'
  ),
  (
    CURRENT_DATE - 1,
    18,
    6,
    7,
    '{"LINE": 7, "Facebook": 5, "Instagram": 3, "TikTok": 3}'::jsonb,
    '{"フィッシング": 6, "投資": 6, "求人": 3, "ロマンス": 3}'::jsonb,
    '{"PENDING": 2, "UNDER_REVIEW": 3, "HIGH_RISK": 6, "CONFIRMED_FRAUD": 7}'::jsonb,
    CURRENT_TIMESTAMP - INTERVAL '1 day'
  ),
  (
    CURRENT_DATE,
    9,
    3,
    2,
    '{"LINE": 3, "Facebook": 3, "Instagram": 1, "Threads": 2}'::jsonb,
    '{"フィッシング": 3, "投資": 2, "求人": 2, "寄付詐欺": 2}'::jsonb,
    '{"PENDING": 2, "UNDER_REVIEW": 2, "HIGH_RISK": 3, "CONFIRMED_FRAUD": 2}'::jsonb,
    CURRENT_TIMESTAMP
  );

COMMIT;
