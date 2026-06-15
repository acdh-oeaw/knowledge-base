-- Site metadata
INSERT INTO "site_metadata" ("id", "title", "description")
VALUES (1, 'DARIAH-EU', 'The pan-European infrastructure for arts and humanities scholars.')
ON CONFLICT ("id") DO NOTHING;

--> statement-breakpoint

-- Primary navigation menu
INSERT INTO "navigation_menus" ("id", "name")
VALUES ('019680a1-0000-7000-8000-000000000001', 'primary')
ON CONFLICT ("name") DO NOTHING;

--> statement-breakpoint

INSERT INTO "navigation_items" ("id", "menu_id", "parent_id", "label", "href", "is_external", "position")
VALUES
	-- Top-level items
	('019680a1-0001-7000-8000-000000000002', '019680a1-0000-7000-8000-000000000001', NULL, 'About',          NULL,        false, 0),
	('019680a1-0001-7000-8000-000000000003', '019680a1-0000-7000-8000-000000000001', NULL, 'Network',        NULL,        false, 1),
	('019680a1-0001-7000-8000-000000000004', '019680a1-0000-7000-8000-000000000001', NULL, 'Resources',      NULL,        false, 2),
	('019680a1-0001-7000-8000-000000000005', '019680a1-0000-7000-8000-000000000001', NULL, 'Projects',       '/projects', false, 3),
	('019680a1-0001-7000-8000-000000000006', '019680a1-0000-7000-8000-000000000001', NULL, 'News and events', NULL,       false, 4),
	('019680a1-0001-7000-8000-000000000007', '019680a1-0000-7000-8000-000000000001', NULL, 'Get involved',   NULL,        false, 5),
	-- About children
	('019680a1-0002-7000-8000-000000000001', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000002', 'DARIAH in a nutshell',        '/about/dariah-in-a-nutshell',        false, 0),
	('019680a1-0002-7000-8000-000000000002', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000002', 'Strategy',                    '/about/strategy',                    false, 1),
	('019680a1-0002-7000-8000-000000000003', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000002', 'Organisation and governance', '/about/organisation-and-governance',  false, 2),
	('019680a1-0002-7000-8000-000000000004', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000002', 'Impact case studies',         '/about/impact-case-studies',         false, 3),
	('019680a1-0002-7000-8000-000000000005', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000002', 'Documents and policies',      '/about/documents',                   false, 4),
	-- Network children
	('019680a1-0003-7000-8000-000000000001', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000003', 'Members and partners',            '/network/members-and-partners',             false, 0),
	('019680a1-0003-7000-8000-000000000002', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000003', 'Regional hubs',                   '/network/regional-hubs',                    false, 1),
	('019680a1-0003-7000-8000-000000000003', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000003', 'Working groups',                  '/network/working-groups',                   false, 2),
	('019680a1-0003-7000-8000-000000000004', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000003', 'Partnerships and collaborations', '/network/partnerships-and-collaborations',   false, 3),
	-- Resources children
	('019680a1-0004-7000-8000-000000000001', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000004', 'DARIAH resource catalogue', '/resources/dariah-resource-catalogue', false, 0),
	('019680a1-0004-7000-8000-000000000002', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000004', 'DARIAH-Campus',             '/resources/dariah-campus',             false, 1),
	('019680a1-0004-7000-8000-000000000003', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000004', 'Transformations',           '/resources/transformations',           false, 2),
	('019680a1-0004-7000-8000-000000000004', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000004', 'SSH Open Marketplace',      '/resources/ssh-open-marketplace',      false, 3),
	-- News and events children
	('019680a1-0005-7000-8000-000000000001', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000006', 'News',          '/news',                         false, 0),
	('019680a1-0005-7000-8000-000000000002', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000006', 'Events',        '/events',                       false, 1),
	('019680a1-0005-7000-8000-000000000003', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000006', 'Spotlights',    '/spotlights',                   false, 2),
	('019680a1-0005-7000-8000-000000000004', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000006', 'Annual events', 'https://annualevent.dariah.eu', true,  3),
	('019680a1-0005-7000-8000-000000000005', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000006', 'Newsletters',   '/newsletters',                  false, 4),
	-- Get involved children
	('019680a1-0006-7000-8000-000000000001', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000007', 'Join DARIAH',                  '/get-involved/join-dariah',                  false, 0),
	('019680a1-0006-7000-8000-000000000002', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000007', 'Funding calls',               '/get-involved/funding-calls',                false, 1),
	('019680a1-0006-7000-8000-000000000004', '019680a1-0000-7000-8000-000000000001', '019680a1-0001-7000-8000-000000000007', 'Opportunities',               '/get-involved/opportunities',                false, 2)
ON CONFLICT ("id") DO NOTHING;

--> statement-breakpoint

-- Secondary navigation menu
INSERT INTO "navigation_menus" ("id", "name")
VALUES ('019680a1-0000-7000-8000-000000000002', 'secondary')
ON CONFLICT ("name") DO NOTHING;

--> statement-breakpoint

INSERT INTO "navigation_items" ("id", "menu_id", "parent_id", "label", "href", "is_external", "position")
VALUES
	-- Top-level items
	('019680a2-0001-7000-8000-000000000002', '019680a1-0000-7000-8000-000000000002', NULL, 'Contact Dariah',    NULL,   false, 0),
	('019680a2-0001-7000-8000-000000000003', '019680a1-0000-7000-8000-000000000002', NULL, 'Privacy and Legal', NULL,   false, 1),
	('019680a2-0001-7000-8000-000000000004', '019680a1-0000-7000-8000-000000000002', NULL, 'Quick menu',        NULL,   false, 2),
	-- Contact Dariah children
	('019680a2-0002-7000-8000-000000000001', '019680a1-0000-7000-8000-000000000002', '019680a2-0001-7000-8000-000000000002', 'Helpdesk', '/contact', false, 0),
	-- Privacy and Legal children
	('019680a2-0003-7000-8000-000000000001', '019680a1-0000-7000-8000-000000000002', '019680a2-0001-7000-8000-000000000003', 'Legal notice',             '/', false, 0),
	('019680a2-0003-7000-8000-000000000002', '019680a1-0000-7000-8000-000000000002', '019680a2-0001-7000-8000-000000000003', 'Practice',                 '/', false, 1),
	('019680a2-0003-7000-8000-000000000003', '019680a1-0000-7000-8000-000000000002', '019680a2-0001-7000-8000-000000000003', 'Accessibility declaration', '/', false, 2),
	-- Quick menu children
	('019680a2-0004-7000-8000-000000000001', '019680a1-0000-7000-8000-000000000002', '019680a2-0001-7000-8000-000000000004', 'DARIAH in Nutshell',   '/', false, 0),
	('019680a2-0004-7000-8000-000000000002', '019680a1-0000-7000-8000-000000000002', '019680a2-0001-7000-8000-000000000004', 'Members and Partners', '/', false, 1),
	('019680a2-0004-7000-8000-000000000003', '019680a1-0000-7000-8000-000000000002', '019680a2-0001-7000-8000-000000000004', 'Projects',             '/', false, 2),
	('019680a2-0004-7000-8000-000000000004', '019680a1-0000-7000-8000-000000000002', '019680a2-0001-7000-8000-000000000004', 'Events Calendar',      '/', false, 3),
	('019680a2-0004-7000-8000-000000000005', '019680a1-0000-7000-8000-000000000002', '019680a2-0001-7000-8000-000000000004', 'Website User Survey',  '/', false, 4)
ON CONFLICT ("id") DO NOTHING;
