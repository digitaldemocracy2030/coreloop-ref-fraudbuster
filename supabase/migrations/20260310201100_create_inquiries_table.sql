-- ユーザーからのお問い合わせ
CREATE TABLE inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inquiries_is_read ON inquiries(is_read);
CREATE INDEX idx_inquiries_created_at ON inquiries(created_at DESC);

COMMENT ON TABLE inquiries IS 'ユーザーからのお問い合わせ';
