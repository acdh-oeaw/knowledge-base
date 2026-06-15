DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'persons'
			AND column_name = 'image_id'
			AND is_nullable = 'NO'
	) THEN
		ALTER TABLE "persons" ALTER COLUMN "image_id" DROP NOT NULL;
	END IF;
END $$;
