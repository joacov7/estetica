-- Reserve routes used by the self-service manage flow so no org can claim them.
INSERT INTO "reserved_slugs" ("slug") VALUES ('gestionar'), ('turno')
ON CONFLICT DO NOTHING;
