import { createCipheriv, randomBytes } from "node:crypto";

import { assert, log } from "@acdh-oeaw/lib";
import { createDatabaseService } from "@dariah-eric/database";
import * as schema from "@dariah-eric/database/schema";
import { and, eq, sql } from "@dariah-eric/database/sql";
import { hash } from "@node-rs/argon2";

import { env } from "../config/env.config";

const password = "local-persona-password";
const totpKey = Buffer.from("local-persona-totp!!", "utf-8");
const recoveryCode = "LOCALPERSONARECOVERY";

const personas = [
	{
		email: "local-admin@example.com",
		name: "Local Administrator",
		actor: { type: "admin" as const },
	},
	{
		email: "local-country@example.com",
		name: "Local Country Account",
		actor: { type: "country" as const },
	},
	{
		email: "local-national-coordinator@example.com",
		name: "Local National Coordinator",
		actor: {
			type: "person" as const,
			role: "national_coordinator" as const,
			target: "country" as const,
		},
	},
	{
		email: "local-national-coordinator-deputy@example.com",
		name: "Local National Coordinator Deputy",
		actor: {
			type: "person" as const,
			role: "national_coordinator_deputy" as const,
			target: "country" as const,
		},
	},
	{
		email: "local-national-coordination-staff@example.com",
		name: "Local National Coordination Staff",
		actor: {
			type: "person" as const,
			role: "national_coordination_staff" as const,
			target: "country" as const,
		},
	},
	{
		email: "local-national-representative@example.com",
		name: "Local National Representative",
		actor: {
			type: "person" as const,
			role: "national_representative" as const,
			target: "country" as const,
		},
	},
	{
		email: "local-working-group-member@example.com",
		name: "Local Working Group Member",
		actor: {
			type: "person" as const,
			role: "is_member_of" as const,
			target: "working_group" as const,
		},
	},
	{
		email: "local-working-group-chair@example.com",
		name: "Local Working Group Chair",
		actor: {
			type: "person" as const,
			role: "is_chair_of" as const,
			target: "working_groups" as const,
		},
	},
	{
		email: "local-unprivileged@example.com",
		name: "Local Unprivileged User",
		actor: { type: "none" as const },
	},
] as const;

const db = createDatabaseService({
	connection: {
		database: env.DATABASE_NAME,
		host: env.DATABASE_HOST,
		password: env.DATABASE_PASSWORD,
		port: env.DATABASE_PORT,
		ssl: env.DATABASE_SSL_CONNECTION === "enabled",
		user: env.DATABASE_USER,
	},
	logger: false,
}).unwrap();

function encrypt(data: Buffer, encryptionKey: Buffer): Buffer {
	const iv = randomBytes(16);
	const cipher = createCipheriv("aes-128-gcm", encryptionKey, iv);
	return Buffer.concat([iv, cipher.update(data), cipher.final(), cipher.getAuthTag()]);
}

async function getKitchenSinkUnit(slug: string, type: "country" | "working_group") {
	const unit = await db
		.select({ documentId: schema.entities.id })
		.from(schema.entities)
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.entities.id),
		)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.draftId}, ${schema.documentLifecycle.publishedId})`,
		)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.organisationalUnits.id))
		.where(and(eq(schema.slugs.value, slug), eq(schema.organisationalUnitTypes.type, type)))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	if (unit == null) {
		throw new Error(
			`Missing ${type} "${slug}". Run the kitchen-sink seed before creating local personas.`,
		);
	}

	return unit;
}

/**
 * A document-only "person" — no `entityVersions`/`persons` row of its own beyond what is needed to
 * carry a slug, since it exists purely as a stable relation target for these local personas. A slug
 * now lives on a version, not on `entities` directly, so a minimal published version is created
 * alongside it to keep this idempotent across re-runs.
 */
async function getOrCreatePersonDocument(slug: string, localeId: string): Promise<string> {
	const personType = await db.query.entityTypes.findFirst({
		where: { type: "persons" },
		columns: { id: true },
	});
	assert(personType, 'Missing entity type "persons".');

	const existing = await db.query.slugs.findFirst({
		where: { value: slug, typeId: personType.id, localeId },
		columns: { entityId: true },
	});
	if (existing != null) {
		return existing.entityId;
	}

	const publishedStatus = await db.query.entityStatus.findFirst({
		where: { type: "published" },
		columns: { id: true },
	});
	assert(publishedStatus, 'Missing entity status "published".');

	const [created] = await db
		.insert(schema.entities)
		.values({ typeId: personType.id })
		.returning({ id: schema.entities.id });
	assert(created);

	const [version] = await db
		.insert(schema.entityVersions)
		.values({ entityId: created.id, statusId: publishedStatus.id, localeId })
		.returning({ id: schema.entityVersions.id });
	assert(version);

	await db.insert(schema.slugs).values({
		entityVersionId: version.id,
		entityId: created.id,
		typeId: personType.id,
		localeId,
		value: slug,
		isPublished: true,
	});

	return created.id;
}

async function main(): Promise<void> {
	const encryptionKey = Buffer.from(env.AUTH_ENCRYPTION_KEY, "hex");
	assert(encryptionKey.length === 16, "AUTH_ENCRYPTION_KEY must be 16 bytes encoded as hex.");
	assert(totpKey.length === 20);

	const defaultLocale = await db.query.locales.findFirst({ where: { isDefault: true } });
	assert(defaultLocale, "Default locale not found — run seed-cms first.");
	const defaultLocaleId = defaultLocale.id;

	const [country, workingGroup, secondWorkingGroup, passwordHash] = await Promise.all([
		getKitchenSinkUnit("kitchen-sink-country", "country"),
		getKitchenSinkUnit("kitchen-sink-working-group", "working_group"),
		getKitchenSinkUnit("kitchen-sink-working-group-two", "working_group"),
		hash(password, { memoryCost: 19_456, timeCost: 2, outputLen: 32, parallelism: 1 }),
	]);

	for (const persona of personas) {
		let personDocumentId: string | null = null;
		let organisationalUnitDocumentId: string | null = null;

		if (persona.actor.type === "country") {
			organisationalUnitDocumentId = country.documentId;
		} else if (persona.actor.type === "person") {
			const personaPersonDocumentId = await getOrCreatePersonDocument(
				`local-persona-${persona.actor.role}`,
				defaultLocaleId,
			);
			personDocumentId = personaPersonDocumentId;
			const role = await db.query.personRoleTypes.findFirst({
				where: { type: persona.actor.role },
				columns: { id: true },
			});
			assert(role, `Missing person role type "${persona.actor.role}".`);

			await db
				.delete(schema.personsToOrganisationalUnits)
				.where(eq(schema.personsToOrganisationalUnits.personDocumentId, personaPersonDocumentId));
			const targetDocumentIds =
				persona.actor.target === "country"
					? [country.documentId]
					: persona.actor.target === "working_groups"
						? [workingGroup.documentId, secondWorkingGroup.documentId]
						: [workingGroup.documentId];
			await db.insert(schema.personsToOrganisationalUnits).values(
				targetDocumentIds.map((organisationalUnitDocumentId) => {
					return {
						personDocumentId: personaPersonDocumentId,
						organisationalUnitDocumentId,
						roleTypeId: role.id,
						duration: { start: new Date("2025-01-01T00:00:00.000Z") },
					};
				}),
			);
		}

		const isAdmin = persona.actor.type === "admin";
		const userValues = {
			name: persona.name,
			role: isAdmin ? ("admin" as const) : ("user" as const),
			canManageAdmins: isAdmin,
			isEmailVerified: true,
			passwordHash,
			twoFactorTotpKey: encrypt(totpKey, encryptionKey),
			twoFactorRecoveryCode: encrypt(Buffer.from(recoveryCode, "utf-8"), encryptionKey),
			personDocumentId,
			organisationalUnitDocumentId,
		};

		const existing = await db.query.users.findFirst({
			where: { email: persona.email },
			columns: { id: true },
		});
		const userId =
			existing == null
				? await db
						.insert(schema.users)
						.values({ email: persona.email, ...userValues })
						.returning({ id: schema.users.id })
						.then((rows) => rows[0]!.id)
				: await db
						.update(schema.users)
						.set(userValues)
						.where(eq(schema.users.id, existing.id))
						.returning({ id: schema.users.id })
						.then((rows) => rows[0]!.id);

		await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
		log.info(`Seeded ${persona.email}.`);
	}

	log.success(`Seeded ${personas.length} local users.`);
}

main()
	.catch((error: unknown) => {
		log.error("Failed to create local users.\n", error);
		process.exitCode = 1;
	})
	// oxlint-disable-next-line typescript/no-misused-promises
	.finally(() =>
		// oxlint-disable-next-line typescript/strict-void-return
		db.$client.end().catch((error: unknown) => {
			log.error("Failed to close database connection.\n", error);
			process.exitCode = 1;
		}),
	);
