-- Add the Creative Commons Public Domain Mark 1.0 (PDM) license. Unlike CC0 (a rights waiver), PDM
-- labels works already free of known copyright worldwide. Idempotent: re-runs hit the `code` unique
-- conflict and do nothing.
INSERT INTO
	"licenses" ("code", "name", "url")
VALUES
	(
		'CC-PDM-1.0',
		'Creative Commons Public Domain Mark 1.0 Universal',
		'https://creativecommons.org/publicdomain/mark/1.0/'
	)
ON CONFLICT ("code") DO NOTHING;
