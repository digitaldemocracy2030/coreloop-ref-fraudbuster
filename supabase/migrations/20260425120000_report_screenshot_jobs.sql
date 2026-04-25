DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_type
		WHERE typname = 'ReportScreenshotJobStatus'
	) THEN
		CREATE TYPE "ReportScreenshotJobStatus" AS ENUM (
			'QUEUED',
			'RUNNING',
			'SUCCEEDED',
			'FAILED'
		);
	END IF;
END $$;

CREATE TABLE IF NOT EXISTS report_screenshot_jobs (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	report_id VARCHAR(64) NOT NULL UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
	url TEXT NOT NULL,
	status "ReportScreenshotJobStatus" NOT NULL DEFAULT 'QUEUED',
	attempts INTEGER NOT NULL DEFAULT 0,
	next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	locked_at TIMESTAMPTZ,
	completed_at TIMESTAMPTZ,
	last_error TEXT,
	image_id UUID UNIQUE REFERENCES report_images(id) ON DELETE SET NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_screenshot_jobs_status_next_run_at_created_at_idx
	ON report_screenshot_jobs (status, next_run_at, created_at);

CREATE INDEX IF NOT EXISTS report_screenshot_jobs_locked_at_idx
	ON report_screenshot_jobs (locked_at);
