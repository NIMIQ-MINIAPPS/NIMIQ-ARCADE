-- NIM-ARCADE — wallet-based login allowlist for the standalone metrics dapp
-- HOW TO APPLY: Supabase dashboard → SQL Editor → paste this whole file → Run.
-- Requires 012_admin_metrics.sql to already be applied.
--
-- admin_wallet_keys holds the raw Ed25519 public keys allowed to log into
-- the metrics dapp as admin (see supabase/functions/verify-admin-wallet).
-- We key on the PUBLIC KEY, not the Nimiq address — deriving a Nimiq address
-- from a public key requires reimplementing Nimiq's Blake2b + base32 +
-- checksum address encoding, which this project doesn't otherwise need and
-- isn't worth the risk of a subtly-wrong reimplementation. The public key is
-- exactly what the Keyguard already returns from signMessage() and is what
-- Ed25519 verification is checked against — no extra derivation needed.
--
-- BOOTSTRAP: while this table is EMPTY, the edge function grants admin to
-- the FIRST wallet that successfully signs a login challenge, and stores its
-- public key here permanently — after that, only a matching public key logs
-- in. This means the window between deploying this migration/function and
-- your own first login is a real (if narrow) exposure: anyone who finds the
-- dapp's URL in that window and connects a Nimiq wallet becomes the
-- permanent admin. Do your own first login immediately after deploying,
-- before sharing the URL anywhere.
create table public.admin_wallet_keys (
  public_key bytea primary key,
  label text,
  created_at timestamptz not null default now()
);

alter table public.admin_wallet_keys enable row level security;
-- Zero policies — only the verify-admin-wallet edge function (service_role)
-- ever reads or writes this table.
