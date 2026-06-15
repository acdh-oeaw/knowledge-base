ALTER TABLE organisational_units ADD COLUMN IF NOT EXISTS ror text;

UPDATE organisational_units
SET ror = metadata->>'ror'
WHERE metadata->>'ror' IS NOT NULL;

UPDATE organisational_units
SET ror = 'https://ror.org/05n09v162'
WHERE id IN (
    SELECT ev.id
    FROM entity_versions ev
    JOIN entities e ON e.id = ev.entity_id
    WHERE e.slug = 'dariah-eu'
);
