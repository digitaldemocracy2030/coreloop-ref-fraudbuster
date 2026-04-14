CREATE TEMP TABLE report_label_relation_legacy AS
SELECT
	relation.report_id,
	label.name AS legacy_name
FROM report_label_relations AS relation
INNER JOIN report_labels AS label
	ON label.id = relation.label_id;

TRUNCATE TABLE report_label_relations;

ALTER TABLE report_labels
	ADD COLUMN IF NOT EXISTS code VARCHAR(64),
	ADD COLUMN IF NOT EXISTS group_code VARCHAR(30),
	ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;

ALTER TABLE report_labels
	DROP CONSTRAINT IF EXISTS report_labels_name_key;

DELETE FROM report_labels;

INSERT INTO report_labels (code, name, group_code, display_order) VALUES
	('GENRE_ONLINE_CASINO', 'オンラインカジノ', 'GENRE', 10),
	('GENRE_ONLINE_SHOPPING', 'オンラインショッピング', 'GENRE', 11),
	('GENRE_INVESTMENT', '投資系', 'GENRE', 12),
	('GENRE_BEAUTY', '美容系', 'GENRE', 13),
	('GENRE_HEALTH', '健康系', 'GENRE', 14),
	('GENRE_ADULT', '性的広告', 'GENRE', 15),
	('GENRE_ROMANCE', 'デート（ロマンス）', 'GENRE', 16),
	('GENRE_HIGH_PAYING_JOB', '高額バイト', 'GENRE', 17),
	('GENRE_CONSUMER_FINANCE', '消費者金融', 'GENRE', 18),
	('GENRE_OTHER', 'その他（動物・宗教）', 'GENRE', 19),
	('IMPERSONATION_CELEBRITY_USED', '有名人を使っている', 'IMPERSONATION', 20),
	('IMPERSONATION_NONE', '有名人を使っていない', 'IMPERSONATION', 21),
	('MEDIA_NHK', 'NHK', 'MEDIA_SPOOF', 30),
	('MEDIA_YOMIURI', '読売新聞', 'MEDIA_SPOOF', 31),
	('MEDIA_YAHOO_SHOPPING', 'Yahoo!ショッピング', 'MEDIA_SPOOF', 32),
	('MEDIA_AMAZON', 'amazon', 'MEDIA_SPOOF', 33),
	('MEDIA_NONE', '騙っていない', 'MEDIA_SPOOF', 34),
	('EXPRESSION_EXAGGERATED', '誇大表現', 'EXPRESSION', 40),
	('EXPRESSION_VIRUS', 'ウィルス感染', 'EXPRESSION', 41),
	('EXPRESSION_NONE', '誇大表現はない', 'EXPRESSION', 42);

INSERT INTO report_label_relations (report_id, label_id)
SELECT
	legacy.report_id,
	label.id
FROM report_label_relation_legacy AS legacy
INNER JOIN report_labels AS label
	ON label.name = legacy.legacy_name
ON CONFLICT (report_id, label_id) DO NOTHING;

ALTER TABLE report_labels
	ALTER COLUMN code SET NOT NULL,
	ALTER COLUMN group_code SET NOT NULL,
	ALTER COLUMN display_order SET DEFAULT 0;

ALTER TABLE report_labels
	ADD CONSTRAINT report_labels_code_key UNIQUE (code);

ALTER TABLE report_labels
	ADD CONSTRAINT report_labels_group_code_name_key UNIQUE (group_code, name);

CREATE INDEX IF NOT EXISTS report_labels_group_code_display_order_idx
	ON report_labels (group_code, display_order);

DROP TABLE report_label_relation_legacy;
