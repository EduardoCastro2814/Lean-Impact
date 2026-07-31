-- ==============================================================================
-- LEAN IMPACT - DATABASE INITIALIZATION & MIGRATION SCRIPT
-- For Supabase PostgreSQL (DDL) - PUBLIC / NO AUTH VERSION
-- ==============================================================================

-- 0. EXTENSION AND AUXILIARY FUNCTIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. TABLE: SAVINGS_TARGETS
CREATE TABLE IF NOT EXISTS savings_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year INTEGER NOT NULL,
    quarter VARCHAR(10) NOT NULL, -- 'Q1', 'Q2', 'Q3', 'Q4', 'Annual'
    target_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unique_fiscal_year_quarter UNIQUE(fiscal_year, quarter)
);

COMMENT ON TABLE savings_targets IS 'Targets for quarterly lean program savings';

-- 2. TABLE: PROJECTS_APPROVED
CREATE TABLE IF NOT EXISTS projects_approved (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id VARCHAR(100) UNIQUE NOT NULL,
    project_title TEXT NOT NULL,
    workshop VARCHAR(150) NOT NULL,
    project_type VARCHAR(100) NOT NULL, -- Kaizen, SGA, IKW, etc.
    leader VARCHAR(150) NOT NULL,
    facilitator VARCHAR(150) NOT NULL,
    approval_date DATE NOT NULL,
    completion_date DATE,
    status VARCHAR(100) NOT NULL,
    op_contribution NUMERIC(15,2) DEFAULT 0.00,
    soft_savings NUMERIC(15,2) DEFAULT 0.00,
    inventory_savings NUMERIC(15,2) DEFAULT 0.00,
    fte_savings NUMERIC(15,2) DEFAULT 0.00, -- Ignore in sum, display only
    one_time_savings NUMERIC(15,2) DEFAULT 0.00,
    total_savings NUMERIC(15,2) DEFAULT 0.00, -- Managed by app calculations
    functional_area VARCHAR(150) NOT NULL,
    project_category VARCHAR(150),
    customer VARCHAR(150),
    business VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE projects_approved IS 'Kaizen, SGA, and IKW projects that are completed and approved';

-- 3. TABLE: PROJECTS_OPEN
CREATE TABLE IF NOT EXISTS projects_open (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id VARCHAR(100) UNIQUE NOT NULL,
    project_title TEXT NOT NULL,
    workshop VARCHAR(150) NOT NULL,
    project_type VARCHAR(100) NOT NULL,
    leader VARCHAR(150) NOT NULL,
    facilitator VARCHAR(150) NOT NULL,
    status VARCHAR(100) NOT NULL,
    created_date DATE NOT NULL,
    completion_date DATE,
    op_contribution NUMERIC(15,2) DEFAULT 0.00,
    soft_savings NUMERIC(15,2) DEFAULT 0.00,
    inventory_savings NUMERIC(15,2) DEFAULT 0.00,
    fte_savings NUMERIC(15,2) DEFAULT 0.00,
    one_time_savings NUMERIC(15,2) DEFAULT 0.00,
    potential_savings NUMERIC(15,2) DEFAULT 0.00, -- Managed by app calculations
    functional_area VARCHAR(150) NOT NULL,
    project_category VARCHAR(150),
    customer VARCHAR(150),
    business VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

COMMENT ON TABLE projects_open IS 'Kaizen, SGA, and IKW projects that are currently open/in-progress';

-- 4. TRIGGERS FOR AUTO-UPDATED TIMESTAMP
DROP TRIGGER IF EXISTS update_savings_targets_updated_at ON savings_targets;
CREATE TRIGGER update_savings_targets_updated_at BEFORE UPDATE ON savings_targets 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_approved_updated_at ON projects_approved;
CREATE TRIGGER update_projects_approved_updated_at BEFORE UPDATE ON projects_approved 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_open_updated_at ON projects_open;
CREATE TRIGGER update_projects_open_updated_at BEFORE UPDATE ON projects_open 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_approved_type ON projects_approved(project_type);
CREATE INDEX IF NOT EXISTS idx_approved_facilitator ON projects_approved(facilitator);
CREATE INDEX IF NOT EXISTS idx_approved_approval_date ON projects_approved(approval_date);
CREATE INDEX IF NOT EXISTS idx_approved_customer ON projects_approved(customer);

CREATE INDEX IF NOT EXISTS idx_open_type ON projects_open(project_type);
CREATE INDEX IF NOT EXISTS idx_open_facilitator ON projects_open(facilitator);
CREATE INDEX IF NOT EXISTS idx_open_created_date ON projects_open(created_date);
CREATE INDEX IF NOT EXISTS idx_open_customer ON projects_open(customer);

CREATE INDEX IF NOT EXISTS idx_targets_year_quarter ON savings_targets(fiscal_year, quarter);

-- 6. ROW LEVEL SECURITY (RLS) POLICIES - PUBLIC ACCESS VERSION
-- Since authentication is removed, we allow public read/write access
ALTER TABLE savings_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects_approved ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects_open ENABLE ROW LEVEL SECURITY;

-- Policy for savings_targets
DROP POLICY IF EXISTS "Public access savings_targets" ON savings_targets;
CREATE POLICY "Public access savings_targets" ON savings_targets 
    FOR ALL TO public USING (true) WITH CHECK (true);

-- Policy for projects_approved
DROP POLICY IF EXISTS "Public access projects_approved" ON projects_approved;
CREATE POLICY "Public access projects_approved" ON projects_approved 
    FOR ALL TO public USING (true) WITH CHECK (true);

-- Policy for projects_open
DROP POLICY IF EXISTS "Public access projects_open" ON projects_open;
CREATE POLICY "Public access projects_open" ON projects_open 
    FOR ALL TO public USING (true) WITH CHECK (true);

-- Enable Realtime
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE savings_targets;
        ALTER PUBLICATION supabase_realtime ADD TABLE projects_approved;
        ALTER PUBLICATION supabase_realtime ADD TABLE projects_open;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;
