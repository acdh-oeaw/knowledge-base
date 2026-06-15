import { createUrl, createUrlSearchParams } from "@acdh-oeaw/lib";
import type {
	WP_REST_API_Attachment,
	WP_REST_API_Attachments,
	WP_REST_API_Categories,
	WP_REST_API_Category,
	WP_REST_API_Page,
	WP_REST_API_Pages,
	WP_REST_API_Post,
	WP_REST_API_Posts,
	WP_REST_API_Tag,
	WP_REST_API_Tags,
} from "wp-types";

import { getAll } from "./get-all";
import { keyById } from "./key-by-id";

interface WP_Event {
	id: number;
	global_id: string;
	global_id_lineage: Array<string>;
	author: string;
	status: string;
	date: Date;
	date_utc: Date;
	modified: Date;
	modified_utc: Date;
	url: string;
	rest_url: string;
	title: string;
	description: string;
	excerpt: string;
	slug: string;
	image:
		| false
		| {
				url: string;
				id: number;
				extension: string;
				width: number;
				height: number;
				sizes: unknown;
		  };
	all_day: boolean;
	start_date: Date;
	start_date_details: DateDetails;
	end_date: Date;
	end_date_details: DateDetails;
	utc_start_date: Date;
	utc_start_date_details: DateDetails;
	utc_end_date: Date;
	utc_end_date_details: DateDetails;
	timezone: string;
	timezone_abbr: string;
	cost: string;
	cost_details: CostDetails;
	website: string;
	show_map: boolean;
	show_map_link: boolean;
	hide_from_listings: boolean;
	sticky: boolean;
	featured: boolean;
	categories: Array<Category>;
	tags: Array<unknown>;
	venue: Venue;
	organizer: Array<unknown>;
}

export interface Category {
	name: string;
	slug: string;
	term_group: number;
	term_taxonomy_id: number;
	taxonomy: string;
	description: string;
	parent: number;
	count: number;
	filter: string;
	id: number;
	urls: Urls;
}

export interface Urls {
	self: string;
	collection: string;
}

export interface CostDetails {
	currency_symbol: string;
	currency_position: string;
	values: Array<unknown>;
}

export interface DateDetails {
	year: string;
	month: string;
	day: string;
	hour: string;
	minutes: string;
	seconds: string;
}

export interface Venue {
	id: number;
	author: string;
	status: string;
	date: Date;
	date_utc: Date;
	modified: Date;
	modified_utc: Date;
	url: string;
	venue: string;
	slug: string;
	country: string;
	show_map: boolean;
	show_map_link: boolean;
	global_id: string;
	global_id_lineage: Array<string>;
}

interface Person {
	id: number;
	date: Date;
	date_gmt: Date;
	guid: { rendered: string };
	modified: Date;
	modified_gmt: Date;
	slug: string;
	status: "publish";
	type: "dariah_person";
	link: string;
	title: { rendered: string };
	content: { rendered: string };
	featured_media: number;
	template: string;
	website: string;
	firstname: string;
	lastname: string;
	identifiant: string;
	email: string;
	position: string;
	twitter: string;
	skills: string;
	research: string;
	projects: Array<unknown>;
	institution_data: {
		id: number;
		title: string;
		slug: string;
		link: string;
		type: string;
		website: string;
		longitude: string;
		latitude: string;
		country: { id: number; title: string; slug: string; link: string; type: string };
	} | null;
}

interface Country {
	id: number;
	date: Date;
	date_gmt: Date;
	guid: { rendered: string };
	modified: Date;
	modified_gmt: Date;
	slug: string;
	status: string;
	type: string;
	link: string;
	title: { rendered: string };
	content: { rendered: string };
	featured_media: number;
	template: string;
	website: string;
	websitename: string;
	longitude: string;
	latitude: string;
	dariah_country_status: Array<number>;
	status_terms: Array<{
		id: number;
		name: string;
		slug: "cooperating-partners" | "members" | "observers";
		taxonomy: string;
	}>;
	repPersons_data: Array<{
		id: number;
		title: string;
		slug: string;
		link: string;
		type: string;
		firstname: string;
		lastname: string;
		identifiant: string;
		email: string;
		position: string;
		twitter: string;
		skills: string;
		research: string;
		institution: number;
		institution_data: {
			id: number;
			title: string;
			slug: string;
			link: string;
			type: string;
			website: string;
			longitude: string;
			latitude: string;
			country: {
				id: number;
				title: string;
				slug: string;
				link: string;
				type: string;
			};
		};
	}>;
	coordinators_data: Array<{
		id: number;
		title: string;
		slug: string;
		link: string;
		type: string;
		firstname: string;
		lastname: string;
		identifiant: string;
		email: string;
		position: string;
		twitter: string;
		skills: string;
		research: string;
		institution: number;
		institution_data: {
			id: number;
			title: string;
			slug: string;
			link: string;
			type: string;
			website: string;
			longitude: string;
			latitude: string;
			country: {
				id: number;
				title: string;
				slug: string;
				link: string;
				type: string;
			};
		};
	}>;
	coordinator_data: null;
	repInstitutions_data: Array<unknown>;
	country_full_data: {
		id: number;
		title: string;
		slug: string;
		link: string;
		type: string;
		website: string;
		websitename: string;
		longitude: string;
		latitude: string;
		repPersons: Array<{
			id: number;
			title: string;
			slug: string;
			link: string;
			type: string;
			firstname: string;
			lastname: string;
			identifiant: string;
			email: string;
			position: string;
			twitter: string;
			skills: string;
			research: string;
			institution: number;
			institution_data: {
				id: number;
				title: string;
				slug: string;
				link: string;
				type: string;
				website: string;
				longitude: string;
				latitude: string;
				country: {
					id: number;
					title: string;
					slug: string;
					link: string;
					type: string;
				};
			};
		}>;
		coordinators: Array<{
			id: number;
			title: string;
			slug: string;
			link: string;
			type: string;
			firstname: string;
			lastname: string;
			identifiant: string;
			email: string;
			position: string;
			twitter: string;
			skills: string;
			research: string;
			institution: number;
			institution_data: {
				id: number;
				title: string;
				slug: string;
				link: string;
				type: string;
				website: string;
				longitude: string;
				latitude: string;
				country: {
					id: number;
					title: string;
					slug: string;
					link: string;
					type: string;
				};
			};
		}>;
		coordinator: null;
		repInstitutions: Array<unknown>;
	};
}

interface Project {
	id: number;
	date: Date;
	date_gmt: Date;
	guid: { rendered: string };
	modified: Date;
	modified_gmt: Date;
	slug: string;
	status: "publish";
	type: "dariah_project";
	link: string;
	title: { rendered: string };
	content: { rendered: string };
	excerpt: { rendered: string };
	featured_media: number;
	parent: number;
	template: string;
	website: string;
	fullname: string;
	relations: {
		coordinator: {
			id: number;
			title: string;
			slug: string;
			link: string;
			type: "dariah_institution";
		};
		contacts: Array<unknown>;
		institutions: Array<{
			id: number;
			title: string;
			slug: string;
			link: string;
			type: "dariah_institution";
		}>;
	};
}

interface WorkingGroup {
	id: number;
	date: Date;
	date_gmt: Date;
	guid: { rendered: string };
	modified: Date;
	modified_gmt: Date;
	slug: string;
	status: "publish";
	type: "dariah_wg";
	link: string;
	title: { rendered: string };
	content: { rendered: string };
	featured_media: number;
	parent: number;
	template: string;
	leaders_data: Array<{
		id: number;
		title: string;
		slug: string;
		link: string;
		type: "dariah_person";
		firstname: string;
		lastname: string;
		identifiant: string;
		email: string;
		position: string;
		twitter: string;
		skills: string;
		research: string;
		institution: number;
		institution_data: {
			id: number;
			title: string;
			slug: string;
			link: string;
			type: "dariah_institution";
			website: string;
			longitude: string;
			latitude: string;
			country: {
				id: number;
				title: string;
				slug: string;
				link: string;
				type: "dariah_country";
			};
		} | null;
	}>;
}

interface Institution {
	id: number;
	date: Date;
	date_gmt: Date;
	guid: { rendered: string };
	modified: Date;
	modified_gmt: Date;
	slug: string;
	status: "publish";
	type: "dariah_institution";
	link: string;
	title: { rendered: string };
	content: { rendered: string };
	featured_media: number;
	template: string;
	website: string;
	longitude: string;
	latitude: string;
	country_data: {
		id: number;
		title: string;
		slug: string;
		link: string;
		type: "dariah_country";
	};
	// see https://www.dariah.eu/wp-json/wp/v2/dariah_institution_country_role
	dariah_institution_country_role: Array<number>;
}

export interface WordPressData {
	categories: Record<WP_REST_API_Category["id"], WP_REST_API_Category>;
	countries: Record<Country["id"], Country>;
	events: Record<WP_Event["id"], WP_Event>;
	initiatives: Record<WP_REST_API_Post["id"], WP_REST_API_Post>;
	institutions: Record<Institution["id"], Institution>;
	pages: Record<WP_REST_API_Page["id"], WP_REST_API_Page>;
	people: Record<Person["id"], Person>;
	posts: Record<WP_REST_API_Post["id"], WP_REST_API_Post>;
	projects: Record<Project["id"], Project>;
	media: Record<WP_REST_API_Attachment["id"], WP_REST_API_Attachment>;
	tags: Record<WP_REST_API_Tag["id"], WP_REST_API_Tag>;
	workingGroups: Record<WorkingGroup["id"], WorkingGroup>;
}

export async function getWordPressData(apiBaseUrl: string): Promise<WordPressData> {
	const [
		categories,
		countries,
		events,
		initiatives,
		institutions,
		pages,
		people,
		posts,
		media,
		projects,
		tags,
		workingGroups,
	] = await Promise.all([
		getCategories(apiBaseUrl),
		getCountries(apiBaseUrl),
		getEvents(apiBaseUrl),
		getInitiatives(apiBaseUrl),
		getInstitutions(apiBaseUrl),
		getPages(apiBaseUrl),
		getPeople(apiBaseUrl),
		getPosts(apiBaseUrl),
		getMedia(apiBaseUrl),
		getProjects(apiBaseUrl),
		getTags(apiBaseUrl),
		getWorkingGroups(apiBaseUrl),
	]);

	const data: WordPressData = {
		categories: keyById(categories),
		countries: keyById(countries),
		events: keyById(events),
		initiatives: keyById(initiatives),
		institutions: keyById(institutions),
		pages: keyById(pages),
		people: keyById(people),
		posts: keyById(posts),
		media: keyById(media),
		projects: keyById(projects),
		tags: keyById(tags),
		workingGroups: keyById(workingGroups),
	};

	return data;
}

function getCategories(baseUrl: string): Promise<WP_REST_API_Categories> {
	const url = createUrl({
		baseUrl,
		pathname: "/wp-json/wp/v2/categories",
		searchParams: createUrlSearchParams({ per_page: 100 }),
	});

	return getAll(url);
}

function getCountries(baseUrl: string): Promise<Array<Country>> {
	const url = createUrl({
		baseUrl,
		pathname: "/wp-json/wp/v2/dariah_country",
		searchParams: createUrlSearchParams({ per_page: 100, _embed: "author" }),
	});

	return getAll(url);
}

function getEvents(baseUrl: string): Promise<Array<WP_Event>> {
	const url = createUrl({
		baseUrl,
		pathname: "/wp-json/tribe/events/v1/events",
		searchParams: createUrlSearchParams({ per_page: 100, start_date: "2000-01-01" }),
	});

	// oxlint-disable-next-line typescript/no-unsafe-member-access, typescript/no-unsafe-type-assertion
	return getAll(url, "x-tec-totalpages", (response) => response.events as Array<WP_Event>);
}

function getInitiatives(baseUrl: string): Promise<WP_REST_API_Posts> {
	const url = createUrl({
		baseUrl,
		pathname: "/wp-json/wp/v2/dariah_initiative",
		searchParams: createUrlSearchParams({ per_page: 100, _embed: "author" }),
	});

	return getAll(url);
}

function getInstitutions(baseUrl: string): Promise<Array<Institution>> {
	const url = createUrl({
		baseUrl,
		pathname: "/wp-json/wp/v2/dariah_institution",
		searchParams: createUrlSearchParams({ per_page: 100, _embed: "author" }),
	});

	return getAll(url);
}

function getMedia(baseUrl: string): Promise<WP_REST_API_Attachments> {
	const url = createUrl({
		baseUrl,
		pathname: "/wp-json/wp/v2/media",
		searchParams: createUrlSearchParams({ per_page: 100 }),
	});

	return getAll(url);
}

function getPages(baseUrl: string): Promise<WP_REST_API_Pages> {
	const url = createUrl({
		baseUrl,
		pathname: "/wp-json/wp/v2/pages",
		searchParams: createUrlSearchParams({ per_page: 100, _embed: "author" }),
	});

	return getAll(url);
}

function getPeople(baseUrl: string): Promise<Array<Person>> {
	const url = createUrl({
		baseUrl,
		pathname: "/wp-json/wp/v2/dariah_person",
		searchParams: createUrlSearchParams({ per_page: 100, _embed: "author" }),
	});

	return getAll(url);
}

function getPosts(baseUrl: string): Promise<WP_REST_API_Posts> {
	const url = createUrl({
		baseUrl,
		pathname: "/wp-json/wp/v2/posts",
		searchParams: createUrlSearchParams({ per_page: 100, _embed: "author" }),
	});

	return getAll(url);
}

function getProjects(baseUrl: string): Promise<Array<Project>> {
	const url = createUrl({
		baseUrl,
		pathname: "/wp-json/wp/v2/dariah_project",
		searchParams: createUrlSearchParams({ per_page: 100, _embed: "author" }),
	});

	return getAll(url);
}

function getTags(baseUrl: string): Promise<WP_REST_API_Tags> {
	const url = createUrl({
		baseUrl,
		pathname: "/wp-json/wp/v2/tags",
		searchParams: createUrlSearchParams({ per_page: 100 }),
	});

	return getAll(url);
}

function getWorkingGroups(baseUrl: string): Promise<Array<WorkingGroup>> {
	const url = createUrl({
		baseUrl,
		pathname: "/wp-json/wp/v2/dariah_wg",
		searchParams: createUrlSearchParams({ per_page: 100, _embed: "author" }),
	});

	return getAll(url);
}
