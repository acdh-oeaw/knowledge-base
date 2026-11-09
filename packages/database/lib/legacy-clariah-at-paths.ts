/**
 * Entities of the previous clariah.at website (github.com/acdh-oeaw/clariah-at-website), which the
 * content of this knowledge base was imported from and still links to. Only
 * `richtext-link-cleanup-service` needs them, to recognise and rewrite those links. They are not
 * the routes of the current CLARIAH-AT website: those live in `@dariah-eric/website-routes`.
 *
 * The old website addressed an item by one id shared by both locales (`/en/projects/{id}`,
 * `/de/projects/{id}`), while the import (`migrate-clariah-at-website.ts`) slugged every locale
 * from its own title, so an old id cannot be turned into a current slug without this table. It maps
 * each old `{collection}/{id}` to the cms entity type and the slugs the import gave it; the cleanup
 * looks those up to find the entity's document id.
 *
 * Generated from the old website's `content/{en,de}` folders with the import's slug rules
 * (`slugify(title)`, `slugify(name)` for consortium members). That content is frozen, so this does
 * not need to be regenerated.
 */

export type LegacyClariahAtEntityType =
	| "events"
	| "news"
	| "organisational_units"
	| "pages"
	| "projects";

export interface LegacyClariahAtEntity {
	type: LegacyClariahAtEntityType;
	/** The slugs the import gave the entity, in any locale. */
	slugs: ReadonlyArray<string>;
}

/** The collections of the old website with a detail page per item, by path segment. */
export const legacyClariahAtCollections = ["consortium", "events", "news", "projects"] as const;

export type LegacyClariahAtCollection = (typeof legacyClariahAtCollections)[number] | "pages";

export function isLegacyClariahAtCollection(
	value: string,
): value is (typeof legacyClariahAtCollections)[number] {
	return (legacyClariahAtCollections as ReadonlyArray<string>).includes(value);
}

/** Old pages which held the intro of a listing page, and the listing they now correspond to. */
export const legacyClariahAtListingPages: Readonly<Record<string, string>> = {
	events: "/events",
	news: "/news",
	projects: "/projects",
};

const legacyClariahAtEntities: Readonly<Record<string, LegacyClariahAtEntity>> = {
	"news/DAC-summer-school-2026-UWK": {
		type: "news",
		slugs: [
			"summer-school-who-cares-collecting-preserving-and-curating-in-museums-archives-and-organizations",
		],
	},
	"news/OA-Sammelband-Schnittstelle-Mediaevistik": {
		type: "news",
		slugs: [
			"interface-medieval-studies-collaborations-in-medieval-research-in-the-digital-age",
			"schnittstelle-mediaevistik-kollaborationen-der-mittelalterforschung-im-digitalen-zeitalter",
		],
	},
	"news/acdh-arche-re-certified-as-clarin-b-centre": {
		type: "news",
		slugs: [
			"acdh-arche-re-certified-as-clarin-b-centre",
			"acdh-arche-rezertifiziert-als-clarin-b-centre",
		],
	},
	"news/acdh-ch-internships-february-2025": {
		type: "news",
		slugs: ["acdh-ch-internships-february-2025", "acdh-ch-volontariate-februar-2025"],
	},
	"news/acdh-ch-lecture-9-1-with-achim-rabus-online": {
		type: "news",
		slugs: [
			"acdh-ch-lecture-9-1-with-achim-rabus-online",
			"acdh-ch-lecture-mit-achim-rabus-ist-online",
		],
	},
	"news/art-internship-2025-oenb-labs": {
		type: "news",
		slugs: [
			"art-internship-oe-nb-labs-in-summer-holidays-digital-artworks",
			"ferialanstellung-bei-den-oe-nb-labs-digitale-kunstwerke",
		],
	},
	"news/artemis-summer-school-2026-call-for-applications": {
		type: "news",
		slugs: ["artemis-summer-school-2026-call-for-applications"],
	},
	"news/call-for-abstracts-clarin-2024": {
		type: "news",
		slugs: ["call-for-abstracts-clarin-annual-conference-2024"],
	},
	"news/call-for-contributions-digital-history-tagung-2026": {
		type: "news",
		slugs: [
			"call-for-contributions-for-the-digital-history-conference-2026",
			"call-for-contributions-fuer-die-digital-history-tagung-2026",
		],
	},
	"news/call-for-contributions-historical-labour-markets-in-text": {
		type: "news",
		slugs: ["call-for-contributions-historical-labour-markets-in-text"],
	},
	"news/call-for-contributions-updating-konde": {
		type: "news",
		slugs: [
			"call-for-contributions-updating-the-white-paper-weissbuch-digital-edition",
			"call-for-contributions-update-weissbuch-digitale-edition",
		],
	},
	"news/call-for-participants-dariah-2024": {
		type: "news",
		slugs: [
			"call-for-participants-dariah-annual-event-2024",
			"einladung-zur-teilnahme-dariah-jahreskonferenz-2024",
		],
	},
	"news/call-second-austrian-meeting-on-digital-linguistics": {
		type: "news",
		slugs: [
			"call-second-austrian-meeting-on-digital-linguistics",
			"call-zweites-oesterreichisches-treffen-zur-digitalen-linguistik",
		],
	},
	"news/cfp-austrian-meeting-on-digital-linguistics-oelt-2023": {
		type: "news",
		slugs: [
			"call-for-papers-austrian-meeting-on-digital-linguistics-recent-developments-in-austria-at-oe-lt-2023",
			"call-for-papers-oesterreichisches-treffen-zur-digitalen-linguistik-rezente-entwicklungen-in-oesterreich-oe-lt-2023",
		],
	},
	"news/cfp-back-and-into-the-future-10th-digital-library-meeting": {
		type: "news",
		slugs: [
			"cf-p-back-and-to-the-future-10th-conference-digital-library",
			"cf-p-zurueck-und-in-die-zukunft-10-tagung-digitale-bibliothek",
		],
	},
	"news/cfp-book-proposal": {
		type: "news",
		slugs: [
			"cf-p-book-proposal-digital-translation-history-processing-historical-data-with-new-methodologies",
			"cf-p-buchentwurf-digital-translation-history-processing-historical-data-with-new-methodologies",
		],
	},
	"news/cfp-clariah-at-summer-school-machine-learning-for-digital-scholarly-editions": {
		type: "news",
		slugs: ["cf-p-clariah-at-summer-school-machine-learning-for-digital-scholarly-editions"],
	},
	"news/cfp-clarin-flagship-projects-2025": {
		type: "news",
		slugs: [
			"call-for-proposals-for-clarin-flagship-projects-2025",
			"aufruf-zur-einreichung-von-vorschlaegen-fuer-clarin-flagship-projekte-2025",
		],
	},
	"news/cfp-dh-data-sprint": {
		type: "news",
		slugs: ["call-for-paricipation-digital-humanties-data-sprint"],
	},
	"news/cfp-drittes-oesterreichisches-treffen-zur-digitalen-linguistik": {
		type: "news",
		slugs: [
			"call-for-papers-third-austrian-meeting-on-digital-linguistics",
			"call-for-papers-drittes-oesterreichisches-treffen-zur-digitalen-linguistik",
		],
	},
	"news/cfp-pressmint-workshop-lrec2026": {
		type: "news",
		slugs: ["call-for-papers-press-mint-workshop-at-lrec-2026"],
	},
	"news/cfp-summerschool2025": {
		type: "news",
		slugs: ["clariah-at-summer-school-machine-learning-for-digital-scholarly-editions"],
	},
	"news/cfp-viertes-oesterreichisches-treffen-zur-digitalen-linguistik": {
		type: "news",
		slugs: [
			"call-for-papers-fourth-austrian-meeting-on-digital-linguistics",
			"viertes-oesterreichisches-treffen-zur-digitalen-linguistik",
		],
	},
	"news/clariah-at-roadshow-2024": {
		type: "news",
		slugs: [
			"the-clariah-at-roadshow-introduction-of-12-dh-projects",
			"die-clariah-at-roadshow-12-projekte-haben-sich-vorgestellt",
		],
	},
	"news/clariah-at-roadshow-2026": {
		type: "news",
		slugs: ["clariah-at-roadshow-2026-save-the-date"],
	},
	"news/clariah-at-to-discontinue-presence-on-x-from-2025": {
		type: "news",
		slugs: [
			"clariah-at-to-discontinue-presence-on-x-from-2025",
			"clariah-at-stellt-ab-2025-seine-praesenz-auf-x-ein",
		],
	},
	"news/clarin-2023-call-for-abstracts": {
		type: "news",
		slugs: ["clarin-annual-conference-2023-call-for-extended-abstracts"],
	},
	"news/clarin-2026-call-for-papers": {
		type: "news",
		slugs: ["clarin-2026-call-for-papers-open", "clarin-2026-call-for-papers-offen"],
	},
	"news/clarin-annual-conference-2025-call-for-extended-abstracts": {
		type: "news",
		slugs: ["clarin-annual-conference-2025-call-for-extended-abstracts"],
	},
	"news/clarin-annual-report-2023": {
		type: "news",
		slugs: ["clarin-annual-report-2023", "clarin-jahresbericht-2023"],
	},
	"news/clarin-conference-2025-vienna": {
		type: "news",
		slugs: ["clarin-conference-2025-will-be-held-in-vienna", "clarin-konferenz-2025-in-wien"],
	},
	"news/conference-newspapers-magazines-aimodels": {
		type: "news",
		slugs: [
			"newspapers-magazines-and-ai-models-training-an-re-use-in-the-digital-humanities",
			"zeitungen-zeitschriften-and-ki-modelle-training-und-nach-nutzung-in-den-digital-humanities",
		],
	},
	"news/dariah-annual-report-2023": {
		type: "news",
		slugs: ["dariah-annual-report-2023", "dariah-jahresbericht-2023"],
	},
	"news/dariah2025-cfp": { type: "news", slugs: ["dariah-annual-event-2025-call-for-papers"] },
	"news/dariah2026-call-for-papers": { type: "news", slugs: ["dariah-2026-call-for-papers"] },
	"news/dazzling-data-lecture-circuit-now-available-online": {
		type: "news",
		slugs: [
			"dazzling-data-lecture-circuit-now-available-online",
			"ringvorlesung-dazzling-data-aufzeichnungen-verfuegbar",
		],
	},
	"news/dh-2025-call-for-proposals": { type: "news", slugs: ["dh-2025-call-for-proposals"] },
	"news/dhd2026-call-for-papers": { type: "news", slugs: ["d-hd2026-call-for-papers"] },
	"news/digitale-edition-kofler-aural": {
		type: "news",
		slugs: ["digital-edition-kofler-aural", "digitale-edition-kofler-aural"],
	},
	"news/euralex2026-call-for-papers": { type: "news", slugs: ["euralex-2026-call-for-papers"] },
	"news/exploresalon2023-save-the-date": {
		type: "news",
		slugs: ["explore-salon-2023-save-the-date"],
	},
	"news/feedback-kulturpool-visuell": {
		type: "news",
		slugs: ["feedback-kulturpool-visual", "feedback-kulturpool-visuell"],
	},
	"news/glam-innovation-lab": {
		type: "news",
		slugs: [
			"glam-innovation-lab-submit-your-digitization-and-innovation-challenges-now",
			"glam-innovation-lab-jetzt-digitalisierungs-und-innovationsherausforderungen-einreichen",
		],
	},
	"news/impressions-of-the-dh-festival": {
		type: "news",
		slugs: ["impressions-of-the-dh-festival", "impressionen-des-dh-festivals"],
	},
	"news/mhdbdb-next-forschen-ohne-datenbankserver": {
		type: "news",
		slugs: [
			"mhdbdb-next-researching-without-a-database-server",
			"mhdbdb-next-forschen-ohne-datenbankserver",
		],
	},
	"news/new-oenb-labs-jupyter-notebooks": {
		type: "news",
		slugs: [
			"new-jupyter-notebooks-in-the-oe-nb-labs-try-them-out-now",
			"neue-jupyter-notebooks-in-den-oe-nb-labs-jetzt-ausprobieren",
		],
	},
	"news/ocr-htr-workshop-zine-out-now": { type: "news", slugs: ["ocr-htr-workshop-zine-out-now"] },
	"news/oesterreich-aus-der-luft": {
		type: "news",
		slugs: ["austria-from-the-air", "oesterreich-aus-der-luft"],
	},
	"news/oesterreich-aus-der-luft-interaktiv": {
		type: "news",
		slugs: [
			"discover-austria-in-aerial-views-with-the-interactive-map",
			"oesterreich-aus-der-luft-interaktiv-erkunden",
		],
	},
	"news/onb-labs-symposium-2024-newspapers-as-datasets": {
		type: "news",
		slugs: [
			"save-the-date-onb-labs-symposium-newspapers-as-datasets",
			"save-the-date-oe-nb-labs-symposium-newspapers-as-datasets",
		],
	},
	"news/report-clariah-at-summer-school-2025": {
		type: "news",
		slugs: [
			"report-on-the-clariah-at-summer-school-2025-machine-learning-for-digital-scholarly-editions",
			"erfahrungsbericht-ueber-die-clariah-at-summer-school-2025-machine-learning-for-digital-scholarly-editions",
		],
	},
	"news/results-from-call-for-projects-announced": {
		type: "news",
		slugs: [
			"results-from-call-for-projects-announced",
			"auswahlergebnis-der-projektausschreibung-veroeffentlicht",
		],
	},
	"news/retrospective-clariah-at-summerschool2024": {
		type: "news",
		slugs: [
			"retrospective-of-the-clariah-at-summer-school-2024",
			"rueckblick-clariah-at-summer-school-2024",
		],
	},
	"news/retrospective-onb-labs-symposium-2024": {
		type: "news",
		slugs: [
			"a-retrospective-of-the-onb-labs-symposium-newspapers-as-datasets",
			"rueckblick-oe-nb-labs-symposium-zeitungen-als-datensaetze",
		],
	},
	"news/rueckblick-zur-dhd2026": { type: "news", slugs: ["rueckblick-zur-d-hd2026"] },
	"news/small-scale-projects-announced": {
		type: "news",
		slugs: [
			"results-from-call-for-small-scale-projects-announced",
			"ergebnisse-des-kleinprojekt-calls-veroeffentlicht",
		],
	},
	"news/stakeholder-forum-2026-call-for-interest": {
		type: "news",
		slugs: ["stakeholder-forum-2026-call-for-interest"],
	},
	"news/summerschool2025-uwk": {
		type: "news",
		slugs: [
			"summer-school-ai-will-sort-it-out-practices-of-collecting-archiving-and-curating-in-the-age-of-digital-transformation",
		],
	},
	"news/sustaining-a-digital-humanities-infrastructure-and-network-for-austria": {
		type: "news",
		slugs: [
			"sustaining-a-digital-humanities-infrastructure-and-network-for-austria",
			"infrastruktur-und-netzwerk-fuer-die-digitalen-geisteswissenschaften-in-oesterreich-nachhaltig-sichern",
		],
	},
	"news/transformations-a-dariah-journal-1st-call-for-contributions": {
		type: "news",
		slugs: ["transformations-a-dariah-journal-1st-call-for-contributions"],
	},
	"events/acdh-ch-lecture-10-1": { type: "events", slugs: ["acdh-ch-lecture-10-1"] },
	"events/acdh-ch-lecture-10-2": { type: "events", slugs: ["acdh-ch-lecture-10-2"] },
	"events/acdh-ch-lecture-10-3": { type: "events", slugs: ["acdh-ch-lecture-10-3"] },
	"events/acdh-ch-lecture-11-1": { type: "events", slugs: ["acdh-ch-lecture-11-1"] },
	"events/acdh-ch-lecture-8-1-the-problem-with-social-media-reserach": {
		type: "events",
		slugs: ["acdh-ch-lecture-8-1-the-problem-with-social-media-research"],
	},
	"events/acdh-ch-lecture-8-2-the-role-of-simplicity-and-linking-in-the-practice-of-digital-archaeology":
		{
			type: "events",
			slugs: [
				"acdh-ch-lecture-8-2-the-role-of-simplicity-and-linking-in-the-practice-of-digital-archaeology",
			],
		},
	"events/acdh-ch-lecture-8-3": {
		type: "events",
		slugs: [
			"acdh-ch-lecture-8-3-cultural-analysis-as-a-multidisciplinary-science",
			"acdh-ch-lecture-8-3-kulturanalyse-als-integrierte-geistes-und-naturwissenschaft",
		],
	},
	"events/acdh-ch-lecture-8-4-contextualizing-museum-data-digitization-infrastructure-and-digital-literacy":
		{
			type: "events",
			slugs: [
				"acdh-ch-lecture-8-4-contextualizing-museum-data-digitization-infrastructure-and-digital-literacy",
			],
		},
	"events/acdh-ch-lecture-9-1": { type: "events", slugs: ["acdh-ch-lecture-9-1"] },
	"events/acdh-ch-lecture-9-2": { type: "events", slugs: ["acdh-ch-lecture-9-2"] },
	"events/acdh-ch-lecture-9-3": { type: "events", slugs: ["acdh-ch-lecture-9-3"] },
	"events/acdh-ch-research-lunch-nikola-ljubesic": {
		type: "events",
		slugs: [
			"acdh-ch-research-lunch-with-nikola-ljubesic",
			"acdh-ch-research-lunch-mit-nikola-ljubesic",
		],
	},
	"events/acdh-ch-tool-gallery-10-1": {
		type: "events",
		slugs: [
			"acdh-ch-tool-gallery-10-1-transkribus-for-beginners",
			"acdh-ch-tool-gallery-10-1-transkribus-fuer-anfaenger-innen",
		],
	},
	"events/acdh-ch-tool-gallery-10-2": {
		type: "events",
		slugs: ["acdh-ch-tool-gallery-10-2-encoding-manuscripts-with-tei-xml-training"],
	},
	"events/acdh-ch-tool-gallery-11-1": { type: "events", slugs: ["acdh-ch-tool-gallery-11-1"] },
	"events/acdh-ch-tool-gallery-11-2": { type: "events", slugs: ["acdh-ch-tool-gallery-11-2"] },
	"events/acdh-ch-tool-gallery-8-2-teaching-digital-humanities": {
		type: "events",
		slugs: ["acdh-ch-tool-gallery-8-2-teaching-digital-humanities"],
	},
	"events/acdh-ch-tool-gallery-9-1-xslt-dh": {
		type: "events",
		slugs: ["acdh-ch-tool-gallery-9-1-xslt-fuer-digital-humanists"],
	},
	"events/acdh-ch-tool-gallery-9-2-transkribus-for-beginners": {
		type: "events",
		slugs: [
			"acdh-ch-tool-gallery-9-2-transkribus-for-beginners",
			"acdh-ch-tool-gallery-9-2-transkribus-fuer-anfaenger-innen",
		],
	},
	"events/acdh-ch-tool-gallery-9-3": {
		type: "events",
		slugs: [
			"acdh-ch-tool-gallery-9-3-transkribus-for-advanced-users",
			"acdh-ch-tool-gallery-9-3-transkribus-fuer-fortgeschrittene",
		],
	},
	"events/acdh-lecture-11-2": { type: "events", slugs: ["acdh-lecture-11-2"] },
	"events/acdh-lecture-11-3": { type: "events", slugs: ["acdh-lecture-11-3"] },
	"events/acdh-lecture-12-1": { type: "events", slugs: ["acdh-lecture-12-1"] },
	"events/acdh-lecture-12-2": { type: "events", slugs: ["acdh-lecture-12-2"] },
	"events/acdh-lecture-12-3": {
		type: "events",
		slugs: [
			"acdh-lecture-12-3-implicitly-abusive-language-data-biases-and-challenges-in-detection",
		],
	},
	"events/acdh-rl-laura-untner": {
		type: "events",
		slugs: ["acdh-research-lunch-with-laura-untner", "acdh-research-lunch-mit-laura-untner"],
	},
	"events/acdh-tool-gallery-11-3": { type: "events", slugs: ["acdh-tool-gallery-11-3"] },
	"events/acdh-tool-gallery-12-2": { type: "events", slugs: ["acdh-tool-gallery-12-2"] },
	"events/acdh-tool-gallery-12-3": { type: "events", slugs: ["acdh-tool-gallery-12-3"] },
	"events/clariah-at-roadshow": { type: "events", slugs: ["clariah-at-roadshow-2024"] },
	"events/clariah-at-roadshow-2026": { type: "events", slugs: ["clariah-at-roadshow-2026"] },
	"events/clariah-at-roadshow-at-CEU": { type: "events", slugs: ["clariah-at-roadshow-2025"] },
	"events/clarin-cafe-computer-assisted-pragmatic-annotation-of-native-and-learner-corpora": {
		type: "events",
		slugs: ["clarin-cafe-computer-assisted-pragmatic-annotation-of-native-and-learner-corpora"],
	},
	"events/clarin-cafe-project-management-in-dh": {
		type: "events",
		slugs: ["clarin-cafe-project-management-in-dh"],
	},
	"events/clarin-cafe-sshoc-marketplace-and-workflows": {
		type: "events",
		slugs: ["clarin-cafe-sshoc-marketplace-and-workflows"],
	},
	"events/clarin-cafe-translation-technologies-and-workflows-for-ssh-researchers": {
		type: "events",
		slugs: ["clarin-cafe-translation-technologies-and-amp-workflows-for-ssh-researchers"],
	},
	"events/computational-language-technologies-for-medievalists": {
		type: "events",
		slugs: ["computational-language-technologies-for-medievalists"],
	},
	"events/computer-vision-for-digital-humanists-a-three-day-winter-school-hosted-by-the-university-of-graz":
		{
			type: "events",
			slugs: [
				"computer-vision-for-digital-humanists-a-three-day-winter-school-hosted-by-the-university-of-graz",
				"computer-vision-for-digital-humanists-eine-dreitaegige-winterschule-organisiert-von-der-universitaet-graz",
			],
		},
	"events/conference-ai-meets-hss": {
		type: "events",
		slugs: [
			"conference-ai-meets-humanities-and-social-sciences",
			"konferenz-ai-meets-humanities-and-social-sciences",
		],
	},
	"events/conference-on-cultural-heritage-new-technologies-cultural-heritage-nextgen": {
		type: "events",
		slugs: [
			"conference-on-cultural-heritage-and-new-technologies-cultural-heritage-next-gen",
			"conference-on-cultural-heritage-and-amp-new-technologies-cultural-heritage-next-gen",
		],
	},
	"events/context-matters-opportunities-challenges-ai-ch-data": {
		type: "events",
		slugs: [
			"context-matters-opportunities-and-challenges-when-working-with-artificial-intelligence-and-cultural-heritage-data",
		],
	},
	"events/dariah-campus-how-to-workshop": {
		type: "events",
		slugs: ["dariah-campus-how-to-workshop"],
	},
	"events/dazzling-data-lectureseries-izmf-23-24": {
		type: "events",
		slugs: [
			"dazzling-data-digital-humanities-in-medieval-and-early-modern-studies",
			"dazzling-data-digital-humanities-in-der-mediaevistik-und-fruehneuzeitforschung",
		],
	},
	"events/dch-speed-dating": { type: "events", slugs: ["d-c-h-speed-dating"] },
	"events/dhd2026": {
		type: "events",
		slugs: ["d-hd-2026-not-only-text-not-only-data", "d-hd-2026-nicht-nur-text-nicht-nur-daten"],
	},
	"events/digedtnt-workshop-meet-the-tools-and-developers": {
		type: "events",
		slugs: ["dig-ed-tn-t-workshop-meet-the-tools-and-developers"],
	},
	"events/digi-roundtable-2024": { type: "events", slugs: ["digi-roundtable-2024"] },
	"events/digital-history-doing-cultural-heritage": {
		type: "events",
		slugs: ["digital-history-doing-cultural-heritage"],
	},
	"events/digital-history-tagung-2026": {
		type: "events",
		slugs: ["digital-history-conference-2026", "digital-history-tagung-2026"],
	},
	"events/digital-humanities-infrastructure-in-austria-presenting-the-results-of-dh-infra-at": {
		type: "events",
		slugs: ["digital-humanities-infrastructure-in-austria-presenting-the-results-of-dh-infra-at"],
	},
	"events/digital-humanities-lecture-circuit-23-24": {
		type: "events",
		slugs: ["digital-humanities-lecture-circuit", "ringvorlesung-digital-humanities"],
	},
	"events/digital-linguistics-recent-developments-in-austria-olt-2023": {
		type: "events",
		slugs: [
			"austrian-meeting-on-digital-linguistics-recent-developments-in-austria-at-oe-lt-2023",
			"oesterreichisches-treffen-zur-digitalen-linguistik-rezente-entwicklungen-in-oesterreich-oe-lt-2023",
		],
	},
	"events/digital-methods-live-seminar": {
		type: "events",
		slugs: ["digital-methods", "digitale-methoden"],
	},
	"events/digitale-bibliothek-2024-zurueck-und-in-die-zukunft": {
		type: "events",
		slugs: ["digitale-bibliothek-2024-zurueck-und-in-die-zukunft"],
	},
	"events/drittes-oesterreichisches-treffen-zur-digitalen-linguistik-oelt-2025": {
		type: "events",
		slugs: [
			"third-austrian-meeting-on-digital-linguistics",
			"drittes-oesterreichisches-treffen-zur-digitalen-linguistik-oe-lt-2025",
		],
	},
	"events/exploresalon-registrations-open": {
		type: "events",
		slugs: ["explore-salon-2023-registrations-are-open", "explore-salon-2023-anmeldung-ist-offen"],
	},
	"events/guest-lecture-nikola-ljubesic": {
		type: "events",
		slugs: ["guest-lecture-nikola-ljubesic"],
	},
	"events/hack-the-pool": { type: "events", slugs: ["hack-the-pool"] },
	"events/hack-the-pool-2026": { type: "events", slugs: ["hack-the-pool-2026"] },
	"events/interacting-with-the-dead-in-antiquity-and-the-middle-ages": {
		type: "events",
		slugs: ["interacting-with-the-dead-in-antiquity-and-the-middle-ages"],
	},
	"events/introduction-dh-sose26": {
		type: "events",
		slugs: ["introduction-to-digital-humanities", "einfuehrung-in-die-digital-humanities"],
	},
	"events/konferenz-zeitungen-zeitschriften-und-ki-modelle": {
		type: "events",
		slugs: [
			"conference-newspapers-magazines-and-ai-models-training-and-re-use-in-the-digital-humanities",
			"konferenz-zeitungen-zeitschriften-and-ki-modelle-training-und-nach-nutzung-in-den-digital-humanities",
		],
	},
	"events/kontrolliertes-vokabular-mit-vocabs": {
		type: "events",
		slugs: ["controlled-vocabulary-with-vocabs", "kontrolliertes-vokabular-mit-vocabs"],
	},
	"events/kulturpool-stakeholder-forum-2026": {
		type: "events",
		slugs: ["kulturpool-stakeholder-forum-2026"],
	},
	"events/machine-learning-and-scholarly-editing-a-contradiction-or-an-exciting-partnership": {
		type: "events",
		slugs: ["machine-learning-and-scholarly-editing-a-contradiction-or-an-exciting-partnership"],
	},
	"events/museum-law-2023-ai-co-creation-nft": {
		type: "events",
		slugs: ["museum-law-2023-ai-co-creation-and-nft", "museum-recht-2023-ki-co-creation-and-nft"],
	},
	"events/music-and-digital-humanities": {
		type: "events",
		slugs: ["music-and-digital-humanities"],
	},
	"events/ocr-htr-workshop": {
		type: "events",
		slugs: ["ocr-htr-workshop-for-under-resourced-and-under-represented-languages"],
	},
	"events/oeaw-ai-winter-school-2025": { type: "events", slugs: ["oe-aw-ai-winter-school-2025"] },
	"events/oeaw-ai-winter-school-2026": { type: "events", slugs: ["oe-aw-ai-winter-school-2026"] },
	"events/oenb-labs-jupyter-notebooks-workshop": {
		type: "events",
		slugs: ["oe-nb-labs-jupyter-notebooks-workshop"],
	},
	"events/onb-labs-symposium-newspapers-as-datasets": {
		type: "events",
		slugs: ["oe-nb-labs-symposium-newspapers-as-datasets"],
	},
	"events/press-mint-interoperable-corpora-of-historical-newspapers": {
		type: "events",
		slugs: ["press-mint-interoperable-corpora-of-historical-newspapers"],
	},
	"events/projectpresentation-digital-edition-baernreither": {
		type: "events",
		slugs: [
			"vom-archiv-ins-digitale-die-tagebuecher-des-altoesterreichischen-politikers-joseph-m-baernreither-projektpraesentation-der-digitalen-edition",
		],
	},
	"events/release-musil-online": { type: "events", slugs: ["release-musil-online"] },
	"events/ssh-open-marketplace-online-workshop-for-phd-students": {
		type: "events",
		slugs: [
			"enhance-your-research-skills-with-ssh-open-marketplace-an-online-workshop-for-ph-d-students",
		],
	},
	"events/summer-school-ml-for-dse": {
		type: "events",
		slugs: [
			"summer-school-machine-learning-for-digital-scholarly-editions-registration-open",
			"summer-school-machine-learning-for-digital-scholarly-editions-anmeldung-offen",
		],
	},
	"events/summer-school-registrations-open": {
		type: "events",
		slugs: [
			"summer-school-vom-archiv-zum-algorithmus-digital-humanities-in-der-praxis-registrations-are-open",
			"summer-school-vom-archiv-zum-algorithmus-digital-humanities-in-der-praxis-anmeldung-ist-geoeffnet",
		],
	},
	"events/summerschool2026": {
		type: "events",
		slugs: ["machine-learning-for-digital-scholarly-editions-clariah-at-summer-school-2026"],
	},
	"events/tag-der-guten-daten-2026": { type: "events", slugs: ["tag-der-guten-daten-2026"] },
	"events/train-the-trainers-proprietary-rights-open-access-in-academic-teaching": {
		type: "events",
		slugs: [
			"train-the-trainers-copyright-and-open-access-in-academic-teaching",
			"train-the-trainers-urheberrecht-and-open-access-in-der-akademischen-lehre",
		],
	},
	"events/transnational-research-infrastructure": {
		type: "events",
		slugs: ["transnational-research-infrastructure-a-journey-through-clarin-knowledge-centres"],
	},
	"events/von-historischen-daten-zu-ki": {
		type: "events",
		slugs: ["from-historical-data-to-ai", "von-historischen-daten-zu-ki"],
	},
	"events/webinar-series-digital-editions-tools-transitions": {
		type: "events",
		slugs: [
			"dig-ed-tn-t-webinar-series-digital-editions-tools-and-transitions",
			"dig-ed-tn-t-webinarreihe-digital-editions-tools-and-transitions",
		],
	},
	"events/workshop-central-european-book-history-data-tools": {
		type: "events",
		slugs: [
			"workshop-central-european-book-history-data-and-tools",
			"workshop-central-european-book-history-data-and-amp-tools",
		],
	},
	"events/workshop-iiif-digital-scholarly-editions": {
		type: "events",
		slugs: ["iiif-in-and-digital-scholarly-editions", "iiif-in-und-digitale-n-editionen"],
	},
	"events/workshop-interface-of-medieval-studies": {
		type: "events",
		slugs: ["workshop-interface-of-medieval-studies", "workshop-schnittstelle-mediaevistik"],
	},
	"events/workshop-re-late-re-use-re-vise": {
		type: "events",
		slugs: ["workshop-re-late-re-use-re-vise"],
	},
	"events/workshop-writing-a-digital-conceptual-history-of-democracy": {
		type: "events",
		slugs: ["writing-a-digital-conceptual-history-of-democracy"],
	},
	"events/worldcafe-nfdi4memory-data-culture": {
		type: "events",
		slugs: [
			"world-cafe-on-historical-research-data-of-the-nfdi-4-memory-task-area-5-data-culture",
			"world-cafe-zu-historischen-forschungsdaten-der-nfdi-4-memory-task-area-5-data-culture",
		],
	},
	"events/zweites-oesterreichisches-treffen-zur-digitalen-linguistik": {
		type: "events",
		slugs: [
			"second-austrian-meeting-on-digital-linguistics",
			"zweites-oesterreichisches-treffen-zur-digitalen-linguistik",
		],
	},
	"projects/3d-digitizing-glaser-squeezes": {
		type: "projects",
		slugs: [
			"3-d-digitizing-of-glaser-squeezes",
			"3-d-digitalisierung-von-seltenen-glaser-abklatschen",
		],
	},
	"projects/abacus-austrian-baroque-corpus": {
		type: "projects",
		slugs: ["a-ba-c-us-austrian-baroque-corpus"],
	},
	"projects/account-books-spaengler-online-aso": {
		type: "projects",
		slugs: ["account-books-spaengler-online-aso", "ausgabenbuecher-spaengler-online-aso"],
	},
	"projects/acdh-ch-open-data-virtual-hackathon-round-two": {
		type: "projects",
		slugs: ["acdh-ch-open-data-virtual-hackathon-round-two"],
	},
	"projects/aldersbach-chronicle": {
		type: "projects",
		slugs: ["aldersbach-chronicle", "chronik-aldersbach"],
	},
	"projects/algorithm-inventarium-ai": { type: "projects", slugs: ["algorithm-inventarium-ai"] },
	"projects/alpenwort": { type: "projects", slugs: ["alpenwort"] },
	"projects/ambraser-heldenbuch": {
		type: "projects",
		slugs: [
			"ambraser-heldenbuch-transcription-and-scientific-dataset",
			"ambraser-heldenbuch-transkription-und-wissenschaftliches-datenset",
		],
	},
	"projects/andreas-okopenko-diaries-poets-estate-hybrid-edition": {
		type: "projects",
		slugs: [
			"andreas-okopenko-diaries-from-the-poets-estate-hybrid-edition",
			"andreas-okopenko-tagebuecher-aus-dem-nachlass-hybridedition",
		],
	},
	"projects/archaeological-collections-university-graz": {
		type: "projects",
		slugs: [
			"archaeological-collections-of-the-university-of-graz",
			"onlineportal-der-archaeologischen-sammlungen-der-karl-franzens-universitaet-graz",
		],
	},
	"projects/arche": { type: "projects", slugs: ["arche"] },
	"projects/arthur-schnitzler-correspondence-writers": {
		type: "projects",
		slugs: [
			"arthur-schnitzler-correspondence-with-writers",
			"arthur-schnitzler-briefwechsel-mit-autorinnen-und-autoren",
		],
	},
	"projects/asynchrones-lernangebot-forschungsdatenmanagement": {
		type: "projects",
		slugs: [
			"asynchronous-learning-resources-on-topics-in-research-data-management",
			"asynchrones-lernangebot-fuer-themen-aus-dem-forschungsdatenmanagement",
		],
	},
	"projects/atlas-viennese-avantgardes": {
		type: "projects",
		slugs: ["atlas-of-the-viennese-avantgardes", "atlas-der-wiener-avantgarden"],
	},
	"projects/austria-literally": {
		type: "projects",
		slugs: ["austria-literally", "oesterreich-am-wort"],
	},
	"projects/austrian-land-registers": {
		type: "projects",
		slugs: ["austrian-land-registers", "kataster-tirol-digital"],
	},
	"projects/austrian-radio-journals-1967-1999-www-journale": {
		type: "projects",
		slugs: [
			"austrian-radio-journals-from-1967-to-1999-www-journale-at",
			"oe1-journale-von-1967-bis-1999-www-journale-at",
		],
	},
	"projects/becoming-urban-reconstructing-city-graz-long-19th-century-beurb": {
		type: "projects",
		slugs: ["becoming-urban-reconstructing-the-city-of-graz-in-the-long-19th-century-be-urb"],
	},
	"projects/bestand-millinger": { type: "projects", slugs: ["bestand-millinger"] },
	"projects/between-composition-and-reception-authority-medieval-charters-becore": {
		type: "projects",
		slugs: [
			"between-composition-and-reception-the-authority-of-medieval-charters-be-co-re",
			"zwischen-erstellung-und-rezeption-die-autoritaet-mittelalterlicher-urkunden-be-co-re",
		],
	},
	"projects/bibliotheca-mozartiana-digital": {
		type: "projects",
		slugs: ["bibliotheca-mozartiana-digital"],
	},
	"projects/biodiversity-cultural-and-linguistic-diversity-movement": {
		type: "projects",
		slugs: [
			"biodiversity-cultural-and-linguistic-diversity-a-movement",
			"biodiversitaet-kulturelle-und-linguistische-diversitaet-eine-bewegung",
		],
	},
	"projects/bring-your-project": { type: "projects", slugs: ["bring-your-project"] },
	"projects/cantus-network": { type: "projects", slugs: ["cantus-network"] },
	"projects/cataloguing-manuscripts-library-matthias-corvinus-austria": {
		type: "projects",
		slugs: [
			"cataloguing-the-manuscripts-from-the-library-of-matthias-corvinus-in-austria",
			"erschliessung-der-handschriften-aus-der-bibliothek-des-matthias-corvinus-in-oesterreich",
		],
	},
	"projects/celtic-divine-names-inscriptions-roman-province-germania-inferior": {
		type: "projects",
		slugs: [
			"celtic-divine-names-in-the-inscriptions-of-the-roman-province-germania-inferior",
			"keltische-goetternamen-in-den-inschriften-der-roemischen-provinz-germania-inferior",
		],
	},
	"projects/cfir-science-roman-small-finds-online": {
		type: "projects",
		slugs: ["cfir-science-roman-small-finds-online", "cfir-science-roemische-kleinfunde-online"],
	},
	"projects/charters-open-research-data": {
		type: "projects",
		slugs: ["charters-open-research-data", "urkunden-als-offene-forschungsdaten"],
	},
	"projects/chia-accessing-and-analysing-cultural-images-new-technologies": {
		type: "projects",
		slugs: ["ch-ia-accessing-and-analysing-cultural-images-with-new-technologies"],
	},
	"projects/cima": { type: "projects", slugs: ["cima"] },
	"projects/clariah-at-platform": {
		type: "projects",
		slugs: ["clariah-at-platform", "clariah-at-plattform"],
	},
	"projects/clarin-fcs-implementation": {
		type: "projects",
		slugs: [
			"unlocking-the-full-potential-of-textual-resources-application-of-fair-data-principles-through-clarin-federated-content-search-implementation",
		],
	},
	"projects/co-op-community-opportunity": {
		type: "projects",
		slugs: ["co-op-community-as-opportunity"],
	},
	"projects/computational-analysis-of-jazz-history": {
		type: "projects",
		slugs: ["gender-networks-and-artistic-success-a-computational-analysis-of-jazz-history"],
	},
	"projects/computer-vision-digital-humanists": {
		type: "projects",
		slugs: ["computer-vision-for-digital-humanists"],
	},
	"projects/corema-cooking-recipes-middle-ages-corpus-analysis-visualisation": {
		type: "projects",
		slugs: [
			"co-re-ma-cooking-recipes-of-the-middle-ages-corpus-analysis-visualisation",
			"kochrezepttexte-des-mittelalters-korpus-analyse-visualisierung",
		],
	},
	"projects/corpus-construction-for-creation-of-new-writing-and-speaking-rating-scales-for-the-entwicklungsverbund-sued-ost":
		{
			type: "projects",
			slugs: [
				"corpus-construction-for-creation-of-new-writing-and-speaking-rating-scales-for-the-entwicklungsverbund-sued-ost",
			],
		},
	"projects/crash-a-hackathon-for-advanced-search-in-cultural-heritage": {
		type: "projects",
		slugs: ["crash-a-hackathon-for-advanced-search-in-cultural-heritage"],
	},
	"projects/cultural-and-scientific-heritage-styria": {
		type: "projects",
		slugs: [
			"cultural-and-scientific-heritage-of-styria",
			"kultur-und-wissenschaftserbe-steiermark",
		],
	},
	"projects/dariah-eu-eldah-gdpr-consent-form-wizard": {
		type: "projects",
		slugs: [
			"the-dariah-eu-eldah-gdpr-consent-form-wizard",
			"dariah-eu-eldah-ds-gvo-generator-fuer-einwilligungserklaerungen",
		],
	},
	"projects/datenanalyse-oenb-labs": {
		type: "projects",
		slugs: ["data-analysis-in-the-oe-nb-labs", "datenanalyse-in-den-oe-nb-labs"],
	},
	"projects/depcha-digital-edition-publishing-cooperative-historical-accounts": {
		type: "projects",
		slugs: ["depcha-digital-edition-publishing-cooperative-for-historical-accounts"],
	},
	"projects/design-4-emergency": { type: "projects", slugs: ["design-4-emergency-at"] },
	"projects/developing-hubert-nlp-algorithm-extending-seshat-global-history-databank": {
		type: "projects",
		slugs: [
			"developing-hu-bert-a-natural-language-processing-algorithm-for-extending-the-seshat-global-history-databank",
		],
	},
	"projects/dialect-cultures": { type: "projects", slugs: ["dialect-cultures"] },
	"projects/dictionary-bavarian-dialects-austria-wboe": {
		type: "projects",
		slugs: [
			"dictionary-of-bavarian-dialects-in-austria-wb-oe",
			"woerterbuch-der-bairischen-mundarten-in-oesterreich-wb-oe",
		],
	},
	"projects/die-korrespondenz-leo-thun-hohenstein": {
		type: "projects",
		slugs: ["die-korrespondenz-von-leo-von-thun-hohenstein"],
	},
	"projects/die-ministerratsprotokolle-oesterreichs-und-der-oesterreichisch-ungarischen-monarchie-1848-1918":
		{
			type: "projects",
			slugs: [
				"die-ministerratsprotokolle-oesterreichs-und-der-oesterreichisch-ungarischen-monarchie-1848-1918",
			],
		},
	"projects/die-sammlung-amadei": {
		type: "projects",
		slugs: [
			"the-amadei-collection-digitization-open-data-public-outreach",
			"die-sammlung-amadei-digitalisierung-open-data-public-outreach",
		],
	},
	"projects/digiculture-improving-digital-competences-and-social-inclusion-adults-creative-industries":
		{
			type: "projects",
			slugs: [
				"digi-culture-improving-the-digital-competences-and-social-inclusion-of-adults-in-creative-industries",
				"digi-culture-verbesserung-der-digitalen-kompetenzen-und-der-sozialen-eingliederung-von-erwachsenen-in-der-kreativwirtschaft",
			],
		},
	"projects/digital-edition-creation-pipelines-tools-and-transitions": {
		type: "projects",
		slugs: ["digital-edition-creation-pipelines-tools-and-transitions"],
	},
	"projects/digital-edition-white-paper-update": {
		type: "projects",
		slugs: ["digital-edition-white-paper-update"],
	},
	"projects/digital-editions-medieval-and-early-modern-accounts": {
		type: "projects",
		slugs: ["digital-editions-of-medieval-and-early-modern-accounts"],
	},
	"projects/digital-history-doing-cultural-heritage-2026": {
		type: "projects",
		slugs: [
			"international-conference-digital-history-doing-cultural-heritage",
			"internationale-tagung-digital-history-doing-cultural-heritage",
		],
	},
	"projects/digital-humanities-data-sprint-2026": {
		type: "projects",
		slugs: ["digital-humanities-data-sprint-2026"],
	},
	"projects/digital-interactive-mozart-edition": {
		type: "projects",
		slugs: ["digital-interactive-mozart-edition", "digital-interaktive-mozart-edition"],
	},
	"projects/digital-memoryscape-austria-erinnerungslandschaft-persecution-and-resistance-during-ns-documentation":
		{
			type: "projects",
			slugs: [
				"digital-memoryscape-austria-erinnerungslandschaft-at-persecution-and-resistance-during-ns-documentation-and-education",
				"digitale-erinnerungslandschaft-oesterreich-derla-verfolgung-und-widerstand-im-nationalsozialismus",
			],
		},
	"projects/digital-scholarly-edition-habsburg-ottoman-diplomatic-sources-1500-1918": {
		type: "projects",
		slugs: [
			"digital-scholarly-edition-of-habsburg-ottoman-diplomatic-sources-1500-1918",
			"digitale-edition-von-quellen-zur-habsburgisch-osmanischen-diplomatie-1500-1918",
		],
	},
	"projects/digital-sustainability-relaunch-mhdbdb": {
		type: "projects",
		slugs: ["digital-sustainability-relaunch-of-the-mhdbdb"],
	},
	"projects/digital-tools-historical-inventories": {
		type: "projects",
		slugs: [
			"digital-tools-for-historical-inventories",
			"digitale-werkzeuge-fuer-historische-inventare",
		],
	},
	"projects/digitaler-arnim-bibliothekskatalog": {
		type: "projects",
		slugs: [
			"authors-libraries-as-knowledge-spaces-digitization-of-the-catalog-of-the-arnim-library",
			"autor-innenbibliotheken-als-wissensraeume-digitalisierung-des-katalogs-der-arnim-bibliothek",
		],
	},
	"projects/digitales-salzarchiv": { type: "projects", slugs: ["digitales-salzarchiv"] },
	"projects/digitas-digital-affects-and-space": {
		type: "projects",
		slugs: ["digit-as-the-digital-affects-and-space"],
	},
	"projects/digitising-patterns-power-dpp": {
		type: "projects",
		slugs: ["digitising-patterns-of-power-dpp"],
	},
	"projects/digitizing-early-farming-cultures": {
		type: "projects",
		slugs: ["digitizing-early-farming-cultures"],
	},
	"projects/digitizing-materiality-premodern-book": {
		type: "projects",
		slugs: ["digitizing-the-materiality-of-the-premodern-book"],
	},
	"projects/distant-spectators-distant-reading-periodicals-enlightenment-dispecs": {
		type: "projects",
		slugs: ["distant-spectators-distant-reading-for-periodicals-of-the-enlightenment-di-specs"],
	},
	"projects/ditah-digital-transformation-austrian-humanities": {
		type: "projects",
		slugs: [
			"di-tah-digital-transformation-of-the-austrian-humanities",
			"di-tah-digitale-transformation-der-oesterreichischen-geisteswissenschaften",
		],
	},
	"projects/dixit": { type: "projects", slugs: ["di-xi-t"] },
	"projects/dylen-diachronic-dynamics-lexical-networks": {
		type: "projects",
		slugs: ["dylen-diachronic-dynamics-of-lexical-networks"],
	},
	"projects/east-epistemology-and-argumentation-south-asia-and-tibet": {
		type: "projects",
		slugs: ["east-epistemology-and-argumentation-in-south-asia-and-tibet"],
	},
	"projects/ephesos-4d-virtual-city": {
		type: "projects",
		slugs: ["ephesos-4-d-the-virtual-city", "ephesos-4-d-die-virtuelle-stadt"],
	},
	"projects/esperanto-newspaper-excerpts": {
		type: "projects",
		slugs: ["esperanto-newspaper-excerpts"],
	},
	"projects/euralex-2026-lexicography-in-the-age-of-ai": {
		type: "projects",
		slugs: [
			"support-for-euralex-2026-lexicography-in-the-age-of-ai",
			"unterstuetzung-fuer-euralex-2026-lexikografie-im-zeitalter-der-ki",
		],
	},
	"projects/european-constitutional-court-network-eccn": {
		type: "projects",
		slugs: [
			"european-constitutional-court-network-eccn",
			"das-netzwerk-europaeischer-verfassungsgerichte",
		],
	},
	"projects/eventsearch-api": { type: "projects", slugs: ["event-search-api"] },
	"projects/exploreat": { type: "projects", slugs: ["explore-at"] },
	"projects/exploring-austrias-culture-through-language-glass-exploreat": {
		type: "projects",
		slugs: ["exploring-austrias-culture-through-the-language-glass-explore-at"],
	},
	"projects/ferdinand-ebner-collected-works-online-edition": {
		type: "projects",
		slugs: [
			"ferdinand-ebner-collected-works-online-edition",
			"ferdinand-ebner-gesammelte-werke-online-edition",
		],
	},
	"projects/fuggerzeitungen": {
		type: "projects",
		slugs: [
			"the-fuggerzeitungen-an-early-modern-informative-medium-and-its-indexing",
			"die-fuggerzeitungen-ein-fruehneuzeitliches-informationsmedium-und-seine-erschliessung",
		],
	},
	"projects/gams": { type: "projects", slugs: ["gams"] },
	"projects/gipsabgusssammlung-salzburg-digitale-sammlung-und-virtueller-rundgang": {
		type: "projects",
		slugs: [
			"cast-collection-of-the-department-of-classical-studies-at-the-old-residence-salzburg-creation-of-a-digital-collection-and-virtual-tour",
			"gipsabgusssammlung-des-fachbereichs-altertumswissenschaften-in-der-alten-residenz-salzburg-erstellung-einer-digitalen-sammlung-und-eines-virtuellen-rundgangs",
		],
	},
	"projects/glaser-collection-open-access": {
		type: "projects",
		slugs: ["glaser-collection-open-access"],
	},
	"projects/glaser-virtual-world-all-about-eduard-glaser": {
		type: "projects",
		slugs: ["glaser-virtual-world-all-about-eduard-glaser"],
	},
	"projects/governance-und-verstetigung-dh-infra-at": {
		type: "projects",
		slugs: ["governance-und-verstetigung-dh-infra-at"],
	},
	"projects/graz-repository-ancient-fables-graf": {
		type: "projects",
		slugs: [
			"graz-repository-of-ancient-fables-g-ra-f",
			"grazer-repositorium-antiker-fabeln-g-ra-f",
		],
	},
	"projects/grotefend-digital": { type: "projects", slugs: ["grotefend-digital"] },
	"projects/hackathon-digital-escape-rooms": {
		type: "projects",
		slugs: [
			"hackathon-for-the-creation-of-digital-educational-escape-rooms-spanish-and-french-l2",
			"hackathon-zur-erstellung-von-digitalen-educational-escape-rooms-spanisch-und-franzoesisch-als-l2",
		],
	},
	"projects/handke-zungen-tongues": {
		type: "projects",
		slugs: ["handke-in-zungen-in-tongues", "handke-in-zungen"],
	},
	"projects/hearth-tax-digital": { type: "projects", slugs: ["hearth-tax-digital"] },
	"projects/hgis-de-las-indas-historical-geographic-information-system-spanish-america-1701-1808": {
		type: "projects",
		slugs: [
			"hgis-de-las-indas-a-historical-geographic-information-system-for-spanish-america-1701-1808",
			"hgis-de-las-indas-ein-historisch-geographisches-informationssystem-von-spanisch-amerika-1701-1808",
		],
	},
	"projects/hineinsehen-heraushoeren": {
		type: "projects",
		slugs: ["hi-nein-sehen-he-raus-h-oe-ren"],
	},
	"projects/hugo-montfort-poetic-work-visual-presentation": {
		type: "projects",
		slugs: [
			"hugo-von-montfort-the-poetic-work-visual-presentation",
			"hugo-von-montfort-das-poetische-werk-augenfassung",
		],
	},
	"projects/hugo-schuchardt-archiv": { type: "projects", slugs: ["hugo-schuchardt-archiv"] },
	"projects/hybridization-two-sides-ukrainian-russian-and-russian-ukrainian-code-mixing-southern-ukraine":
		{
			type: "projects",
			slugs: [
				"hybridization-from-two-sides-ukrainian-russian-and-russian-ukrainian-code-mixing-in-southern-ukraine",
				"hybridisierung-von-zwei-seiten-ukrainisch-russisches-und-russisch-ukrainisches-code-mixing-in-der-s-ue-dukraine",
			],
		},
	"projects/illuminated-charters-gesamtkunstwerk": {
		type: "projects",
		slugs: ["illuminated-charters-as-gesamtkunstwerk"],
	},
	"projects/imperial-diet-regensburg-1576-digital": {
		type: "projects",
		slugs: [
			"the-imperial-diet-of-regensburg-1576-digital",
			"der-regensburger-reichstag-von-1576-digital",
		],
	},
	"projects/intangible-european-heritage-visual-analysis-curation-communication": {
		type: "projects",
		slugs: ["in-tangible-european-heritage-visual-analysis-curation-and-communication"],
	},
	"projects/integrative-science-communication-science-ink": {
		type: "projects",
		slugs: [
			"integrative-science-communication-science-ink",
			"integrative-wissenschaftskommunikation-science-ink",
		],
	},
	"projects/itinerary-paolo-santonino-culinary-history-document": {
		type: "projects",
		slugs: [
			"the-itinerary-of-paolo-santonino-a-culinary-history-document",
			"das-itinerar-des-paolo-santonino-ein-kulinarhistorisches-dokument",
		],
	},
	"projects/iuenna-opening-southern-jauntal-micro-region-future-archaeology": {
		type: "projects",
		slugs: ["iuenna-open-ing-the-so-uth-ern-jau-ntal-as-a-micro-regio-n-for-future-archaeology"],
	},
	"projects/jelinek-online-elfriede-jelinek-work-and-reception": {
		type: "projects",
		slugs: [
			"jelinek-online-elfriede-jelinek-work-and-reception",
			"jelinek-online-elfriede-jelinek-werk-und-rezeption",
		],
	},
	"projects/joseph-von-hammer-purgstall-korrespondenz-fairification-erweiterungsworkflow": {
		type: "projects",
		slugs: [
			"joseph-von-hammer-purgstall-correspondence-fai-rification-and-expansion-workflow",
			"joseph-von-hammer-purgstall-korrespondenz-fai-rification-und-erweiterungsworkflow",
		],
	},
	"projects/karl-wiesinger-digital-edition-diaries-1961-1973": {
		type: "projects",
		slugs: [
			"karl-wiesinger-digital-edition-of-the-diaries-1961-1973",
			"karl-wiesinger-digitale-edition-der-tagebuecher-1961-1973",
		],
	},
	"projects/kofler-intermedial": { type: "projects", slugs: ["kofler-intermedial"] },
	"projects/kulturdatenlab-2025": {
		type: "projects",
		slugs: [
			"cross-institutional-cultural-data-hackathon-culture-data-lab-2025",
			"institutionsuebergreifender-kulturdaten-hackathon-kultur-daten-lab-2025",
		],
	},
	"projects/ladder-project-learners-digital-communication-database-pragmatic-competence-italian-l2":
		{
			type: "projects",
			slugs: [
				"ladder-project-le-arners-digital-communication-a-database-for-pragmatic-competence-in-italian-l2",
			],
		},
	"projects/ladderweb-pragmatically-annotated-web-based-corpus-query-interface-requests-and-cancellations":
		{
			type: "projects",
			slugs: [
				"ladder-web-a-pragmatically-annotated-web-based-corpus-query-interface-for-requests-and-cancellations-in-italian-l1-and-l2",
			],
		},
	"projects/leopold-mozart-violinschule": {
		type: "projects",
		slugs: ["leopold-mozart-violinschule"],
	},
	"projects/linked-and-open-bibliography-aegean-glyptic-bronze-age": {
		type: "projects",
		slugs: [
			"a-linked-and-open-bibliography-for-aegean-glyptic-in-the-bronze-age",
			"bibliografie-zur-aegaeischen-glyptik-der-bronzezeit-linked-and-open",
		],
	},
	"projects/linked-cat-explore-half-century-knowledge-production-academy": {
		type: "projects",
		slugs: ["linked-cat-explore-half-a-century-of-knowledge-production-at-the-academy"],
	},
	"projects/machine-learning-suite-iiif-resources": {
		type: "projects",
		slugs: ["machine-learning-suite-for-iiif-resources"],
	},
	"projects/mapping-difficult-heritage": {
		type: "projects",
		slugs: [
			"mapping-difficult-heritage-digital-documentation-of-colonial-traces-in-austrian-urbanscapes",
		],
	},
	"projects/mapping-historical-networks-apis": {
		type: "projects",
		slugs: ["mapping-historical-networks-apis"],
	},
	"projects/marco-polo-christopher-columbus-francesco-pipinos-latin-version-il-milione": {
		type: "projects",
		slugs: [
			"the-marco-polo-of-christopher-columbus-francesco-pipinos-latin-version-of-il-milione",
			"der-marco-polo-des-christoph-kolumbus-francesco-pipinos-lateinische-version-von-il-milione",
		],
	},
	"projects/maximilian-goes-digital-remembrance-data-storage": {
		type: "projects",
		slugs: [
			"maximilian-goes-digital-from-remembrance-to-data-storage",
			"kaiser-maximilian-goes-digital-vom-gedaechtnis-zum-datenspeicher",
		],
	},
	"projects/mecmua": { type: "projects", slugs: ["mecmua"] },
	"projects/medcon": { type: "projects", slugs: ["medcon"] },
	"projects/medcorpinn": { type: "projects", slugs: ["med-corp-inn"] },
	"projects/media-relations-how-and-why-older-women-care-information-and-communication-technologies":
		{
			type: "projects",
			slugs: [
				"media-relations-how-and-why-older-women-care-for-information-and-communication-technologies",
			],
		},
	"projects/mediality-diplomatic-communication-habsburg-envoys-constantinople-mid-17th-century": {
		type: "projects",
		slugs: [
			"the-mediality-of-diplomatic-communication-habsburg-envoys-in-constantinople-in-the-mid-17th-century",
			"die-medialitaet-diplomatischer-kommunikation-habsburgische-gesandte-in-konstantinopel-in-der-mitte-des-17-jahrhunderts",
		],
	},
	"projects/medieval-explorations-neuro-science-1050-1450-ontology-based-keyword-spotting-manuscript-scans":
		{
			type: "projects",
			slugs: [
				"medieval-explorations-in-neuro-science-1050-1450-ontology-based-keyword-spotting-in-manuscript-scans",
				"mittelalterliche-untersuchungen-in-der-neurowissenschaft-1050-1450-ontologie-basierte-schluesselwortsuche-in-manuskript-scans",
			],
		},
	"projects/medieval-laboratory": {
		type: "projects",
		slugs: ["medieval-laboratory", "mittelalterlabor"],
	},
	"projects/medieval-manuscript-fragments-benedictine-abbey-mondsee": {
		type: "projects",
		slugs: [
			"medieval-manuscript-fragments-from-the-benedictine-abbey-of-mondsee",
			"modellfall-fragmentendigitalisierung-die-mittelalterlichen-fragmente-des-klosters-mondsee",
		],
	},
	"projects/mhdbdb-goes-ai": {
		type: "projects",
		slugs: [
			"mhdbdb-goes-ai-data-preparation-for-the-oer-llm-parziv-ai",
			"mhdbdb-goes-ai-datenaufbereitung-fuer-das-oer-llm-parziv-ai",
		],
	},
	"projects/monasterium-net": { type: "projects", slugs: ["monasterium-net"] },
	"projects/mozart-letters-and-documents-online-edition": {
		type: "projects",
		slugs: [
			"mozart-letters-and-documents-online-edition",
			"mozart-briefe-und-dokumente-online-edition",
		],
	},
	"projects/mozart-libretti-online-edition": {
		type: "projects",
		slugs: ["mozart-libretti-online-edition"],
	},
	"projects/multi-modal-manuscript-representations-m3r": {
		type: "projects",
		slugs: [
			"multi-modal-manuscript-representations-m3-r",
			"multimodale-manuskriptrepraesentationen-m3-r",
		],
	},
	"projects/museum-digital-initiatives-during-coronavirus-pandemic": {
		type: "projects",
		slugs: ["museum-digital-initiatives-during-the-coronavirus-pandemic"],
	},
	"projects/museum-knowledge-sciences": {
		type: "projects",
		slugs: ["museum-of-knowledge-sciences"],
	},
	"projects/musil-online": { type: "projects", slugs: ["musil-online"] },
	"projects/musil-online-TEI-konsolidierung": {
		type: "projects",
		slugs: ["musil-online-tei-consolidation", "musil-online-tei-konsolidierung"],
	},
	"projects/nachhaltige-infrastruktur-fuer-digitale-editionen-der-oesterreichischen-nationalbibliothek":
		{
			type: "projects",
			slugs: [
				"sustainable-infrastructure-for-scholarly-digital-editions-at-the-austrian-national-library",
				"nachhaltige-infrastruktur-fuer-digitale-editionen-an-der-oesterreichischen-nationalbibliothek",
			],
		},
	"projects/narrative-didactics-digital-and-other-didactive-narratives": {
		type: "projects",
		slugs: [
			"narrative-didactics-digital-and-other-didactive-narratives",
			"narrative-didactics-digitale-und-andere-didaktische-narrative",
		],
	},
	"projects/nerdpool-data-pool-named-entity-recognition": {
		type: "projects",
		slugs: [
			"nerd-pool-data-pool-for-named-entity-recognition",
			"nerd-pool-datenpool-fuer-named-entity-recognition",
		],
	},
	"projects/nomansland-nomads-manuscripts-landscape": {
		type: "projects",
		slugs: [
			"no-mans-land-nomads-manuscripts-landscape",
			"no-mans-land-nomadische-manuskriptlandschaften",
		],
	},
	"projects/nuns-and-monks-prosopographical-interfaces-nampi": {
		type: "projects",
		slugs: ["nuns-and-monks-prosopographical-interfaces-nampi"],
	},
	"projects/ocr-htr-workshop-for-under-resourced-and-under-represented-languages-in-digital-humanities":
		{
			type: "projects",
			slugs: [
				"ocr-htr-workshop-for-under-resourced-and-under-represented-languages-in-digital-humanities",
			],
		},
	"projects/odeeg-online-database-research-development-vessel-shapes-and-capacities": {
		type: "projects",
		slugs: [
			"odeeg-online-database-for-research-on-the-development-of-vessel-shapes-and-capacities",
			"odeeg-online-datenbank-zur-erforschung-der-entwicklung-von-gefaessformen-und-massen",
		],
	},
	"projects/oedoen-horvath-historical-critical-edition-digital-edition": {
		type: "projects",
		slugs: [
			"oedoen-von-horvath-historical-critical-edition-digital-edition",
			"oedoen-von-horvath-historisch-kritische-ausgabe-digitale-edition",
		],
	},
	"projects/oenb-labs-symposium-2024": { type: "projects", slugs: ["oe-nb-labs-symposium-2024"] },
	"projects/oenb-labs-video-tutorials": { type: "projects", slugs: ["oe-nb-labs-video-tutorials"] },
	"projects/oim-osservatorio-degli-italianismi-nel-mondo-observatory-italian-loanwords-worldwide": {
		type: "projects",
		slugs: [
			"oim-osservatorio-degli-italianismi-nel-mondo-observatory-on-italian-loanwords-worldwide",
			"oim-observatorium-der-italianismen-weltweit",
		],
	},
	"projects/onama-ontology-narratives-middle-ages": {
		type: "projects",
		slugs: [
			"onama-ontology-of-narratives-of-the-middle-ages",
			"onama-ontologie-der-narrative-des-mittelalters",
		],
	},
	"projects/onb-labs": { type: "projects", slugs: ["onb-labs", "oe-nb-labs"] },
	"projects/openatlas": { type: "projects", slugs: ["open-atlas"] },
	"projects/ottoman-nature-travelogues-1501-1850-digital-analysis-onit": {
		type: "projects",
		slugs: ["ottoman-nature-in-travelogues-1501-1850-a-digital-analysis-o-ni-t"],
	},
	"projects/peter-handke-notebooks-digital-edition": {
		type: "projects",
		slugs: ["peter-handke-notebooks-digital-edition", "peter-handke-notizbuecher-digitale-edition"],
	},
	"projects/picturing-migrants-lives": {
		type: "projects",
		slugs: ["picturing-migrants-lives", "visualisierung-migrantischer-lebenswelten"],
	},
	"projects/pilot-corpus-pannonian-rusyn": {
		type: "projects",
		slugs: [
			"pilot-corpus-for-tokenization-and-lemmatization-of-pannonian-rusyn-a-first-step-toward-open-language-resources",
		],
	},
	"projects/power-and-diplomacy-illuminated-charter-france-1160-ca-1420": {
		type: "projects",
		slugs: [
			"power-and-diplomacy-the-illuminated-charter-in-france-1160-ca-1420",
			"macht-und-diplomatie-die-illuminierte-urkunde-in-frankreich-1160-ca-1420",
		],
	},
	"projects/privater-buchbesitz-tirol-1750-und-1850": {
		type: "projects",
		slugs: ["privater-buchbesitz-in-tirol-zwischen-1750-und-1850"],
	},
	"projects/progressive-visual-decision-making-digital-humanities-providedh": {
		type: "projects",
		slugs: ["progressive-visual-decision-making-in-digital-humanities-providedh"],
	},
	"projects/propaganda-context-youtube-clips-about-bandera-lukashenka-and-navalnyi": {
		type: "projects",
		slugs: [
			"propaganda-in-context-you-tube-clips-about-bandera-lukashenka-and-naval-nyi",
			"propaganda-im-kontext-you-tube-videos-ueber-bandera-lukasenka-und-naval-nyj",
		],
	},
	"projects/prototype-historical-critical-online-edition-based-estate-materials-josef-maria-baernreither":
		{
			type: "projects",
			slugs: [
				"prototype-of-a-historical-critical-online-edition-based-on-the-estate-materials-of-josef-maria-baernreither",
			],
		},
	"projects/puzzle-4d": { type: "projects", slugs: ["a-puzzle-in-4-d"] },
	"projects/read-recognition-and-enrichment-archival-documents": {
		type: "projects",
		slugs: ["read-recognition-and-enrichment-of-archival-documents"],
	},
	"projects/realonline-image-database": {
		type: "projects",
		slugs: ["rea-lonline-image-database", "rea-lonline-bilddatenbank"],
	},
	"projects/reassembling-republic-letters": {
		type: "projects",
		slugs: ["reassembling-the-republic-of-letters"],
	},
	"projects/recommendations-for-the-academic-citation-of-digital-resources": {
		type: "projects",
		slugs: [
			"recommendations-for-the-academic-citation-of-digital-resources",
			"empfehlungen-zum-akademischen-zitieren-von-digitalen-ressourcen",
		],
	},
	"projects/renaissance-architecture": {
		type: "projects",
		slugs: ["renaissance-architecture", "renaissance-architektur"],
	},
	"projects/representation-of-risks-and-responsibility-in-the-automation-debate-mara": {
		type: "projects",
		slugs: [
			"representation-of-risks-and-responsibility-in-the-automation-debate-mara",
			"die-repraesentation-von-risiken-and-verantwortung-im-automatisierungsdiskurs-mara",
		],
	},
	"projects/ringvorlesung-musikwissenschaft-and-digital-humanities": {
		type: "projects",
		slugs: [
			"distinguished-lecture-series-music-and-digital-humanities",
			"ringvorlesung-musikwissenschaft-and-digital-humanities",
		],
	},
	"projects/roma-journey": { type: "projects", slugs: ["a-roma-journey"] },
	"projects/salta-open-source-tool-und-database": {
		type: "projects",
		slugs: [
			"salta-open-source-tool-and-database-for-the-segmentation-of-multimodal-performances",
			"salta-open-source-tool-und-database-zur-segmentierung-multimodaler-performances",
		],
	},
	"projects/sarit-search-and-retrieval-indic-texts": {
		type: "projects",
		slugs: ["sarit-search-and-retrieval-of-indic-texts"],
	},
	"projects/semantickraus-connecting-kraus-scholarship-semantic-web": {
		type: "projects",
		slugs: ["semantic-kraus-connecting-kraus-scholarship-to-the-semantic-web"],
	},
	"projects/sentiment-analysis-18th-century-multilingual-corpora": {
		type: "projects",
		slugs: ["sentiment-analysis-for-18th-century-multilingual-corpora"],
	},
	"projects/sentiment-annotated-corpus-of-austrian-historical-newspapers": {
		type: "projects",
		slugs: [
			"sentiment-annotated-corpus-of-austrian-historical-newspapers",
			"korpus-oesterreichischer-historischer-zeitungen-mit-sentiment-annotationen",
		],
	},
	"projects/sharing-crown-establishing-workflow-collection-data-linked-research-data": {
		type: "projects",
		slugs: [
			"sharing-the-crown-establishing-a-workflow-from-collection-data-to-linked-research-data",
			"sharing-the-crown-einrichtung-eines-workflows-von-sammlungsdaten-zu-verknuepften-forschungsdaten",
		],
	},
	"projects/shifting-patterns-you-and-thou-modelling-address-english-sonnet": {
		type: "projects",
		slugs: [
			"shifting-patterns-of-you-and-thou-modelling-address-in-the-english-sonnet",
			"veraenderte-muster-von-you-und-thou-modellierung-der-anrede-im-englischen-sonett",
		],
	},
	"projects/smc-browser": { type: "projects", slugs: ["smc-browser"] },
	"projects/soundscapes-vienna": {
		type: "projects",
		slugs: ["soundscapes-from-vienna", "vienna-soundscapes"],
	},
	"projects/special-research-programme-german-austria-variation-contact-perception": {
		type: "projects",
		slugs: [
			"special-research-programme-german-in-austria-variation-contact-perception",
			"spezialforschungsbereich-deutsch-in-oesterreich-variation-kontakt-perzeption",
		],
	},
	"projects/spectators-international-context": {
		type: "projects",
		slugs: [
			"the-spectators-in-the-international-context",
			"die-spectators-im-internationalen-kontext",
		],
	},
	"projects/st-patricks-epistles-transcriptions-seven-medieval-manuscript-witnesses": {
		type: "projects",
		slugs: ["st-patricks-epistles-transcriptions-of-the-seven-medieval-manuscript-witnesses"],
	},
	"projects/stefan-george-digital": { type: "projects", slugs: ["stefan-george-digital"] },
	"projects/stefan-zweig-digital": { type: "projects", slugs: ["stefan-zweig-digital"] },
	"projects/summer-school-ml-for-digital-editions": {
		type: "projects",
		slugs: ["summer-school-machine-learning-for-digital-scholarly-editions"],
	},
	"projects/tegernseer-wirtschaftsbuechlein-als-hyperdiplomatische-transkription": {
		type: "projects",
		slugs: [
			"publication-of-the-tegernsee-economic-booklet-as-a-hyperdiplomatic-transcription",
			"publikation-des-tegernseer-wirtschaftsbuechlein-als-hyperdiplomatische-transkription",
		],
	},
	"projects/tei-converter-e-book-and-print-editions": {
		type: "projects",
		slugs: [
			"tei-converter-for-e-book-and-print-editions",
			"tei-converter-fuer-e-book-und-druck-editionen",
		],
	},
	"projects/telling-sounds": { type: "projects", slugs: ["telling-sounds"] },
	"projects/text-mining-medieval-mining-texts-tmmmt": {
		type: "projects",
		slugs: ["text-mining-medieval-mining-texts-tmmmt"],
	},
	"projects/thanados-anthropological-and-archaeological-database-sepultures": {
		type: "projects",
		slugs: ["thanados-the-anthropological-and-archaeological-database-of-sepultures"],
	},
	"projects/topotheque": { type: "projects", slugs: ["topotheque", "topothek"] },
	"projects/tote-tiroler": { type: "projects", slugs: ["tote-tiroler"] },
	"projects/transkribus": { type: "projects", slugs: ["transkribus"] },
	"projects/traveldigital": { type: "projects", slugs: ["travel-digital"] },
	"projects/travelogues-perceptions-other-1500-1876-computerized-analysis": {
		type: "projects",
		slugs: ["travelogues-perceptions-of-the-other-1500-1876-a-computerized-analysis"],
	},
	"projects/twitter-archiv-ianina-ilitcheva": {
		type: "projects",
		slugs: ["twitter-archive-of-ianina-ilitcheva", "twitter-archiv-von-ianina-ilitcheva"],
	},
	"projects/unfolding-woldan-collection-prototype-dissemination-and-visualization-cultural-heritage-spatial":
		{
			type: "projects",
			slugs: [
				"unfolding-the-woldan-collection-a-prototype-for-dissemination-and-visualization-of-cultural-heritage-in-a-spatial-temporal-way",
				"unfolding-the-woldan-collection-ein-prototyp-fuer-die-verbreitung-und-visualisierung-von-kulturgut-im-raeumlich-zeitlichen-kontext",
			],
		},
	"projects/unitv-salzburg": { type: "projects", slugs: ["uni-tv-salzburg"] },
	"projects/untersuchung-von-iiif-in-digitalen-editionen": {
		type: "projects",
		slugs: [
			"investigation-of-iiif-in-digital-editions",
			"untersuchung-von-iiif-in-digitalen-editionen",
		],
	},
	"projects/urfehdebuecher-city-basel-digital-edition": {
		type: "projects",
		slugs: [
			"urfehdebuecher-of-the-city-of-basel-digital-edition",
			"urfehdebuecher-der-stadt-basel-digitale-edition",
		],
	},
	"projects/users-first-optimierung-von-user-interface-user-experience-und-crowdsourcing-an-der-mittelhochdeutschen-begriffsdatenbank":
		{
			type: "projects",
			slugs: [
				"users-first-optimierung-von-user-interface-user-experience-und-crowdsourcing-an-der-mittelhochdeutschen-begriffsdatenbank",
			],
		},
	"projects/uwk-summer-school-2025": { type: "projects", slugs: ["uwk-summer-school-2025"] },
	"projects/vase": { type: "projects", slugs: ["vase"] },
	"projects/vereinsaufloesungen-im-amtlichen-nachrichtenblatt-1938-1940": {
		type: "projects",
		slugs: [
			"automated-recording-and-semantic-analysis-of-association-dissolutions-in-the-official-gazette-1938-1940",
			"automatisierte-erfassung-und-semantische-erschliessung-der-vereinsaufloesungen-im-amtlichen-nachrichtenblatt-1938-1940",
		],
	},
	"projects/vicav": { type: "projects", slugs: ["vicav"] },
	"projects/vienna-time-machine": {
		type: "projects",
		slugs: ["vienna-time-machine", "time-machine-wien"],
	},
	"projects/visually-reading-pandemic-covid19": {
		type: "projects",
		slugs: ["visually-reading-the-pandemic-covid-19"],
	},
	"projects/voice-clariah": { type: "projects", slugs: ["voice-clariah"] },
	"projects/von-vielen-bildern-lernen": {
		type: "projects",
		slugs: ["learning-from-many-images", "von-vielen-bildern-lernen"],
	},
	"projects/wares-types-and-fabrics-upper-egypt-contribution-levantine-ceramics-project": {
		type: "projects",
		slugs: [
			"wares-types-and-fabrics-the-upper-egypt-contribution-to-the-levantine-ceramics-project",
			"waren-typen-und-fabrikate-ein-beitrag-aus-oberaegypten-zum-levantine-ceramics-project",
		],
	},
	"projects/wb-meets-mhdbdb": {
		type: "projects",
		slugs: [
			"wb-meets-mhdbdb-the-wenzelsbibel-as-a-pilot-model-for-interoperable-editions",
			"wb-meets-mhdbdb-die-wenzelsbibel-als-pilotmodell-fuer-interoperable-editionen",
		],
	},
	"projects/wiener-video-rekorder": { type: "projects", slugs: ["wiener-video-rekorder"] },
	"projects/wiennerisches-diarium": {
		type: "projects",
		slugs: [
			"the-wien-n-erisches-diarium-a-digital-data-trove-for-the-humanities",
			"das-wien-n-erische-diarium-digitaler-datenschatz-fuer-die-geisteswissenschaftlichen-disziplinen",
		],
	},
	"projects/woldan-goes-digital": { type: "projects", slugs: ["woldan-goes-digital"] },
	"projects/workshop-re-late-use-work": {
		type: "projects",
		slugs: [
			"workshop-re-late-re-use-re-work-potentials-for-variant-and-intertextuality-analyses-in-the-digital-humanities",
			"workshop-re-late-re-use-re-work-potenziale-fuer-varianten-und-intertextualitaetsanalysen-in-den-digital-humanities",
		],
	},
	"projects/zukunft-kulturpool-visuell": {
		type: "projects",
		slugs: ["zukunft-kulturpool-visuell"],
	},
	"consortium/austrian-academy-of-sciences": {
		type: "organisational_units",
		slugs: ["austrian-academy-of-sciences", "oesterreichische-akademie-der-wissenschaften"],
	},
	"consortium/austrian-national-library": {
		type: "organisational_units",
		slugs: ["austrian-national-library"],
	},
	"consortium/central-european-university": {
		type: "organisational_units",
		slugs: ["central-european-university"],
	},
	"consortium/naturhistorisches-museum-wien": {
		type: "organisational_units",
		slugs: ["natural-history-museum-vienna", "naturhistorisches-museum-wien"],
	},
	"consortium/university-for-continuing-education-krems": {
		type: "organisational_units",
		slugs: ["university-for-continuing-education-krems", "universitaet-fuer-weiterbildung-krems"],
	},
	"consortium/university-of-graz": {
		type: "organisational_units",
		slugs: ["university-of-graz", "universitaet-graz"],
	},
	"consortium/university-of-innsbruck": {
		type: "organisational_units",
		slugs: ["university-of-innsbruck"],
	},
	"consortium/university-of-klagenfurt": {
		type: "organisational_units",
		slugs: ["university-of-klagenfurt", "universitaet-klagenfurt"],
	},
	"consortium/university-of-music-and-performing-arts-vienna": {
		type: "organisational_units",
		slugs: [
			"university-of-music-and-performing-arts-vienna",
			"universitaet-fuer-musik-und-darstellende-kunst-wien",
		],
	},
	"consortium/university-of-salzburg": {
		type: "organisational_units",
		slugs: ["university-of-salzburg", "universitaet-salzburg"],
	},
	"consortium/university-of-vienna": {
		type: "organisational_units",
		slugs: ["university-of-vienna", "universitaet-wien"],
	},
	"pages/about-clariah-at": { type: "pages", slugs: ["about-clariah-at", "ueber-clariah-at"] },
	"pages/events": { type: "pages", slugs: ["upcoming-events", "aktuelle-veranstaltungen"] },
	"pages/exploresalon2023": {
		type: "pages",
		slugs: ["explore-salon-2023-unveil-hidden-stories-from-the-past"],
	},
	"pages/funding-opportunities": {
		type: "pages",
		slugs: ["funding-opportunities", "foerdermoeglichkeiten"],
	},
	"pages/funding-opportunities-for-junior-researcher": {
		type: "pages",
		slugs: ["early-career-scholarships", "early-career-stipendien"],
	},
	"pages/in-honor-of-thierry-declerck": {
		type: "pages",
		slugs: ["in-honor-of-thierry-declerck", "zu-ehren-thierry-declerck"],
	},
	"pages/news": { type: "pages", slugs: ["news", "aktuelles"] },
	"pages/privacy-declaration": {
		type: "pages",
		slugs: ["privacy-declaration", "datenschutzerklaerung"],
	},
	"pages/project-funding": { type: "pages", slugs: ["project-funding", "projektfoerderungen"] },
	"pages/projects": { type: "pages", slugs: ["projects", "projekte"] },
	"pages/summerschool2024": {
		type: "pages",
		slugs: ["vom-archiv-zum-algorithmus-digital-humanities-in-der-praxis"],
	},
	"pages/summerschool2025": {
		type: "pages",
		slugs: ["machine-learning-for-digital-scholarly-editions"],
	},
};

/** The entity an old website item became, or null for an id the old website did not have. */
export function getLegacyClariahAtEntity(
	collection: LegacyClariahAtCollection,
	id: string,
): LegacyClariahAtEntity | null {
	return legacyClariahAtEntities[`${collection}/${id}`] ?? null;
}
