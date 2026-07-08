-- Additive premium entitlements for app_accounts.
-- Keeps legacy Telegram subscriptions untouched.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
  product TEXT NOT NULL DEFAULT 'premium',
  source TEXT NOT NULL,
  active_until TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_entitlements_account_id
  ON app_entitlements(account_id);

CREATE INDEX IF NOT EXISTS idx_app_entitlements_active_until
  ON app_entitlements(active_until);

CREATE INDEX IF NOT EXISTS idx_app_entitlements_product
  ON app_entitlements(product);
