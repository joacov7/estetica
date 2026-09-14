-- Reserve the password-reset routes so no organization can claim them.
INSERT INTO "reserved_slugs" ("slug") VALUES ('olvide'), ('restablecer'), ('recuperar')
ON CONFLICT DO NOTHING;
