-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Businesses Table (Tenants & API configurations)
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    industry_vertical TEXT NOT NULL, -- 'Streaming', 'EdTech', or 'SaaS'
    webhook_url TEXT DEFAULT NULL,
    webhook_secret TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Business Users Table (Multi-tenant logins + RBAC Roles)
CREATE TABLE IF NOT EXISTS business_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'VIEWER', -- 'ADMIN' or 'VIEWER'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Customers Table (Calculated Churn Scores & Explanations)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    external_user_id TEXT NOT NULL,
    monthly_contract_value DECIMAL(10, 2) NOT NULL,
    churn_risk_probability DOUBLE PRECISION DEFAULT 0.0,
    risk_classification_status TEXT DEFAULT 'HEALTHY', -- 'HEALTHY', 'AT_RISK', 'CRITICAL'
    shap_explanation JSONB DEFAULT '[]'::jsonb,
    webhook_fired_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    last_computed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, external_user_id)
);

-- 4. Customer Risk History Table (Time-Series tracking)
CREATE TABLE IF NOT EXISTS customer_risk_history (
    id BIGSERIAL PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    churn_risk_probability DOUBLE PRECISION NOT NULL,
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Usage Events Table (High-volume Raw Events)
CREATE TABLE IF NOT EXISTS usage_events (
    id BIGSERIAL PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    external_user_id TEXT NOT NULL,
    standardized_metric_type TEXT NOT NULL, -- 'ENGAGEMENT_SUCCESS' or 'ENGAGEMENT_DROP'
    native_action_label TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Customer Notes Table (Mini-CRM notes)
CREATE TABLE IF NOT EXISTS customer_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    business_user_id UUID NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
    note_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Interventions Table (Alert history logs)
CREATE TABLE IF NOT EXISTS interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- e.g. 'EMAIL_ALERT'
    status TEXT NOT NULL, -- e.g. 'SENT', 'FAILED'
    details TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_businesses_api_key ON businesses(api_key);
CREATE INDEX IF NOT EXISTS idx_customers_business_risk ON customers(business_id, churn_risk_probability DESC);
CREATE INDEX IF NOT EXISTS idx_events_metrics ON usage_events(business_id, external_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_history_lookup ON customer_risk_history(customer_id, computed_at DESC);