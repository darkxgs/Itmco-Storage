-- Add security logs table for monitoring security events
CREATE TABLE IF NOT EXISTS security_logs (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  details TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_security_logs_timestamp ON security_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_severity ON security_logs(severity);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip ON security_logs(ip_address);

-- Add auto-backup configuration table
CREATE TABLE IF NOT EXISTS backup_config (
  id SERIAL PRIMARY KEY,
  auto_backup_enabled BOOLEAN DEFAULT false,
  backup_frequency VARCHAR(20) DEFAULT 'daily' CHECK (backup_frequency IN ('hourly', 'daily', 'weekly')),
  backup_retention_days INTEGER DEFAULT 30,
  last_backup_at TIMESTAMP WITH TIME ZONE,
  next_backup_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default backup configuration
INSERT INTO backup_config (auto_backup_enabled, backup_frequency, backup_retention_days) 
VALUES (true, 'daily', 30)
ON CONFLICT DO NOTHING;

-- Add backup history table
CREATE TABLE IF NOT EXISTS backup_history (
  id SERIAL PRIMARY KEY,
  backup_id VARCHAR(100) UNIQUE NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('manual', 'auto', 'scheduled')),
  record_counts JSONB,
  size BIGINT,
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for backup history
CREATE INDEX IF NOT EXISTS idx_backup_history_timestamp ON backup_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_backup_history_type ON backup_history(type);
CREATE INDEX IF NOT EXISTS idx_backup_history_status ON backup_history(status);

-- Create function to create backup history table (for RPC call)
CREATE OR REPLACE FUNCTION create_backup_history_table()
RETURNS void AS $$
BEGIN
  -- This function ensures the backup_history table exists
  -- It's called from the backup system initialization
  PERFORM 1;
END;
$$ LANGUAGE plpgsql;