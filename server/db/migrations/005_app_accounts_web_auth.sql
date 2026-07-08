-- Non-destructive migration for unified web/telegram accounts.
-- Adds new tables only; does not alter existing Telegram payment schema.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 TEXT UNIQUE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_account_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS telegram_link_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS web_auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_account_identities_account_id
  ON app_account_identities(account_id);

CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_account_id_status
  ON telegram_link_codes(account_id, status);

CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_expires_at
  ON telegram_link_codes(expires_at);

CREATE INDEX IF NOT EXISTS idx_web_auth_sessions_account_id_expires_at
  ON web_auth_sessions(account_id, expires_at);
