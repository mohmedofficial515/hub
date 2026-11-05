-- TOTP recovery codes, stored hashed (docs/04 §3.2 POST /auth/totp/confirm).
ALTER TABLE "users" ADD COLUMN "totp_recovery_codes" TEXT[] DEFAULT ARRAY[]::TEXT[];
