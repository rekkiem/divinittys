-- DIVINITTYS - PostgreSQL Initialization
-- This script runs once when the container is first created

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS "unaccent"; -- For accent-insensitive search

-- Performance: Create index for text search after Prisma migrations
-- These will be added after tables are created by Prisma

DO $$
BEGIN
  RAISE NOTICE 'DIVINITTYS database initialized successfully';
END
$$;
