#!/bin/bash
# Postgres init script — runs once when the volume is first created.
# Creates a second `gr26` database for the local gr26 ingest service.
# The relay uses the default `tcm26` database; isolating gr26 avoids
# AutoMigrate conflicts on the `ping` table (different primary key
# constraints between the two services).

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" <<-EOSQL
    CREATE DATABASE gr26;
    GRANT ALL PRIVILEGES ON DATABASE gr26 TO $POSTGRES_USER;
EOSQL
