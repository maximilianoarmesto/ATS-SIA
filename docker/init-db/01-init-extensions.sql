-- =============================================================================
-- ATS – SIA  |  docker/init-db/01-init-extensions.sql
--
-- This script is executed by the postgres:16-alpine official image on the
-- very first container start (when the data directory is empty).  It runs
-- as the superuser before any application migrations.
--
-- Files placed in /docker-entrypoint-initdb.d are executed in alphabetical
-- order, once only, against the database specified by POSTGRES_DB.
-- =============================================================================

-- pg_trgm enables trigram-based similarity search and GIN/GiST index support
-- for LIKE / ILIKE queries.  Enable it now so Prisma migrations never need
-- superuser privileges to create the extension later.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
