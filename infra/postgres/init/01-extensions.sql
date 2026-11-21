-- Runs once on a new data directory. Migration 0000_init repeats these with IF NOT EXISTS, so a
-- database created without this script (Testcontainers) ends up the same.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS vector;
