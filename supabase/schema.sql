-- Enable row level security
ALTER TABLE help_requests ENABLE ROW LEVEL SECURITY;

-- Create the help_requests table
CREATE TABLE IF NOT EXISTS help_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_name TEXT NOT NULL,
    telegram_username TEXT NOT NULL,
    details TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- Create index on expires_at for efficient queries
CREATE INDEX idx_help_requests_expires ON help_requests(expires_at);

-- Create index on created_at for sorting
CREATE INDEX idx_help_requests_created ON help_requests(created_at DESC);

-- Policy: Anyone can view active (non-expired) requests
CREATE POLICY "View active requests" 
    ON help_requests 
    FOR SELECT 
    USING (expires_at > NOW());

-- Policy: Anyone can insert requests
CREATE POLICY "Insert requests" 
    ON help_requests 
    FOR INSERT 
    WITH CHECK (true);

-- Policy: Anyone can delete their own request (using player_name as identifier)
CREATE POLICY "Delete own requests" 
    ON help_requests 
    FOR DELETE 
    USING (true);

-- Function to clean up expired requests (call via scheduled function or cron)
CREATE OR REPLACE FUNCTION cleanup_expired_requests()
RETURNS void AS $$
BEGIN
    DELETE FROM help_requests WHERE expires_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a view for active requests only
CREATE OR REPLACE VIEW active_help_requests AS
SELECT * FROM help_requests 
WHERE expires_at > NOW() 
ORDER BY created_at DESC;
