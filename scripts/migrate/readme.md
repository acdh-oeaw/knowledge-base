# the knowledge base data migration

## bodies

| unr         | kb                                    | comment                                          |
| ----------- | ------------------------------------- | ------------------------------------------------ |
| acronym     | organisational_units.acronym          |                                                  |
| type        | organisational_units.type_id          | not explicit, type of orga unit: governance_body |
| name        | organisational_units.name             |                                                  |
| description | content_blocks_type_rich_text.content |                                                  |

## contributions

| unr              | kb                                                     | comment |
| ---------------- | ------------------------------------------------------ | ------- |
| person_id        | persons_to_organisational_units.person_id              |         |
| role_id          | persons_to_organisational_units.role_type_id           |         |
| country_id       | persons_to_organisational_units.organisational_unit_id |         |
| working_group_id | persons_to_organisational_units.organisational_unit_id |         |
| start_date       | persons_to_organisational_units.duration.start         |         |
| end_date         | persons_to_organisational_units.duration.end           |         |

## countries

countries are mapped to organisational units of type country:

| unr     | kb                           | comment       |
| ------- | ---------------------------- | ------------- |
| code    | organisational_units.acronym |               |
| name    | organisational_units.name    |               |
|         | organisational_units.type_id | type: country |
| types\* |                              |               |

if they have a consortium name an organisational unit of type national consortium is created:

| unr             | kb                                              | comment                   |
| --------------- | ----------------------------------------------- | ------------------------- |
| consortium_name | organisational_units.name                       |                           |
|                 | organisational_units.type_id                    | type: national_consortium |
| logo            | assets<br>organisational_units.image_id         |                           |
| marketplace_id  | organisational_units.sshoc_marketplace_actor_id |                           |
| description     | content_blocks_type_rich_text.content           |                           |

if they have a consortium name a relation between the organisational unit of type country and the
organisational unit of type national_consortium is created:

| unr        | kb                                           | comment |
| ---------- | -------------------------------------------- | ------- |
| start_date | organisational_units_to_units.duration.start |         |
| end_date   | organisational_units_to_units.duration.end   |         |
|            | organisational_units_to_units.status.id      |         |

\* country types are mapped to relations between the organisational unit of type country and the
organisational unit of type ERIC:

- is_member_of
- is_cooperating_partner_of

| unr        | kb                                           | comment |
| ---------- | -------------------------------------------- | ------- |
| start_date | organisational_units_to_units.duration.start |         |
| end_date   | organisational_units_to_units.duration.end   |         |
|            | organisational_units_to_units.status.id      |         |

## report_campaigns

| unr                                 | kb                                                | comment |
| ----------------------------------- | ------------------------------------------------- | ------- |
| status                              | reporting_campaigns.status                        |         |
| year                                | reporting_campaigns.year                          |         |
| facultative_questions_list_template |                                                   | \*      |
| narrative_questions_list_template   |                                                   | \*      |
| service_size_thresholds             | reporting_campaign_service_sizes.visits_threshold |         |

\* migrated from working_group_reports

## event_reports

| unr                       | kb                                        | comment |
| ------------------------- | ----------------------------------------- | ------- |
| dariah_commissioned_event | country_reports.dariah_commissioned_event |         |
| very_large_meetings       | country_reports.very_large_events         |         |
| large_meetings            | country_reports.large_events              |         |
| medium_meetings           | country_reports.medium_events             |         |
| small_meetings            | country_reports.small_events              |         |
| reusable_outcomes         | country_reports.reusable_outcomes         |         |
| report_id                 |                                           |         |

## event_size_values

| unr                | kb                                           | comment |
| ------------------ | -------------------------------------------- | ------- |
| report_campaign_id | reporting_campaign_event_amounts.campaign_id |         |
| type               | reporting_campaign_event_amounts.event_type  |         |
| annual_value       | reporting_campaign_event_amounts.amount      |         |

## institutions

| unr     | kb                                | comment |
| ------- | --------------------------------- | ------- |
| name    | organisational_units.name         |         |
| ror     | organisational_units.ror          |         |
| url     | organisational_units.metadata.url |         |
| types\* |                                   |         |

\* types are mapped to relations between the organisational unit of type institution and the
organisational unit of type ERIC:

- is_cooperating_partner_of
- is_national_coordinating_institution_in
- is_national_representative_institution_in
- is_partner_institution_of

| unr        | kb                                           | comment |
| ---------- | -------------------------------------------- | ------- |
| start_date | organisational_units_to_units.duration.start |         |
| end_date   | organisational_units_to_units.duration.end   |         |
|            | organisational_units_to_units.status.id      |         |

a relation between the organisational unit of type institution and the organisational unit of type
country with status is_located_in is created:

| unr        | kb                                           | comment |
| ---------- | -------------------------------------------- | ------- |
| start_date | organisational_units_to_units.duration.start |         |
| end_date   | organisational_units_to_units.duration.end   |         |
|            | organisational_units_to_units.status.id      |         |

## outreach

| unr          | kb                          | comment |
| ------------ | --------------------------- | ------- |
| name         | social_media.name           |         |
| type         | social_media.type_id        |         |
| url          | social_media.url            |         |
| start_date   | social_media.duration.start |         |
| end_date     | social_media.duration.end   |         |
| country_id\* |                             |         |

\* a relation between the social media item and the organisational unit of type country is created:

| unr | kb                                                          | comment |
| --- | ----------------------------------------------------------- | ------- |
|     | organisational_units_to_social_media.organisational_unit_id |         |
|     | organisational_units_to_social_media.social_media_id        |         |
|     |                                                             |         |

## outreach_kpis

| unr                | kb                                                 | comment |
| ------------------ | -------------------------------------------------- | ------- |
| outreach_report_id |                                                    |         |
|                    | country_report_social_media_kpis.social_media_id   |         |
|                    | country_report_social_media_kpis.country_report_id |         |
| unit               | country_report_social_media_kpis.kpi               |         |
| value              | country_report_social_media_kpis.value             |         |

## outreach_reports

used to populate country_report_social_media_kpis.social_media_id and
country_report_social_media_kpis.country_report_id

## outreach_type_values

| unr                | kb                                                  | comment |
| ------------------ | --------------------------------------------------- | ------- |
| report_campaign_id | reporting_campaign_social_media_amounts.campaign_id |         |
| type               | reporting_campaign_social_media_amounts.category    |         |
| annual_value       | reporting_campaign_social_media_amounts.amount      |         |

## persons

| unr         | kb                                    | comment |
| ----------- | ------------------------------------- | ------- |
| name        | persons.name                          |         |
| email       | persons.email                         |         |
| orcid       | persons.orcid                         |         |
| image       | assets<br>persons.image_id            |         |
| description | content_blocks_type_rich_text.content |         |

## \_InstitutionToPerson

| unr                | kb                                                     | comment            |
| ------------------ | ------------------------------------------------------ | ------------------ |
| A (institution_id) | persons_to_organisational_units.organisational_unit_id |                    |
| B (person_id)      | persons_to_organisational_units.person_id              |                    |
|                    | persons_to_organisational_units.role_type_id           | is_affiliated_with |

## projects

| unr            | kb                      | comment                            |
| -------------- | ----------------------- | ---------------------------------- |
| name           | projects.name           |                                    |
| acronym        | projects.acronym        |                                    |
| scope          | projects.scope_id       |                                    |
| start_date     | projects.duration.start |                                    |
| project_months | projects.duration.end   | calculated: start + project_months |
| report_id      |                         |                                    |
| amount         |                         |                                    |
| total_amount   |                         | not migrated                       |
| funders        |                         |                                    |

funders are migrated to organisational units of type institution. for each funder a relation between
funding unit and project is created.

| unr            | kb                                              | comment                            |
| -------------- | ----------------------------------------------- | ---------------------------------- |
|                | projects_to_organisational_units.unit_id        |                                    |
|                | projects_to_organisational_units.project_id     |                                    |
|                | projects_to_organisational_units.role_id        | funder                             |
| start_date     | projects_to_organisational_units.duration.start |                                    |
| project_months | projects_to_organisational_units.duration.end   | calculated: start + project_months |

amount is migrated to a project contribution

| unr    | kb                                                     | comment |
| ------ | ------------------------------------------------------ | ------- |
|        | country_report_project_contributions.project_id        |         |
|        | country_report_project_contributions.country_report_id |         |
| amount | country_report_project_contributions.amount_euros      |         |

## reports

| unr                        | kb                                           | comment  |
| -------------------------- | -------------------------------------------- | -------- |
| report_campaign_id         | country_reports.campaign_id                  |          |
| country_id                 | country_reports.country_id                   |          |
| status                     | country_reports.status                       | accepted |
| contributions_count        | country_reports.total_contributors           |          |
| comments                   | report_screen_comments.comment               |          |
| operational_cost           |                                              |          |
| operational_cost_detail    |                                              |          |
| operational_cost_threshold | reporting_campaign_country_thresholds.amount |          |

## role_type_values

| unr                | kb                                                  | comment |
| ------------------ | --------------------------------------------------- | ------- |
| report_campaign_id | reporting_campaign_contribution_amounts.campaign_id |         |
| type               | reporting_campaign_contribution_amounts.role_type   |         |
| annual_value       | reporting_campaign_contribution_amounts.amount      |         |

## roles

seeded via sql migration

## service_kpis

| unr               | kb                                            | comment |
| ----------------- | --------------------------------------------- | ------- |
| service_report_id |                                               |         |
|                   | country_report_service_kpis.service_id        |         |
|                   | country_report_service_kpis.country_report_id |         |
| unit              | country_report_service_kpis.kpi               |         |
| value             | country_report_service_kpis.value             |         |

## service_reports

used to populate country_report_service_kpis.service_id and
country_report_service_kpis.country_report_id

## service_size_values

| unr                | kb                                            | comment |
| ------------------ | --------------------------------------------- | ------- |
| report_campaign_id | reporting_campaign_service_sizes.campaign_id  |         |
| type               | reporting_campaign_service_sizes.service_size |         |
| annual_value       | reporting_campaign_service_sizes.amount       |         |

## services

| unr                       | kb                                          | comment |
| ------------------------- | ------------------------------------------- | ------- |
| name                      | services.name                               |         |
| status                    | services.status_id                          |         |
| type                      | services.type_id                            |         |
| comment                   | services.comment                            |         |
| dariah_branding           | services.dariah_branding                    |         |
| monitoring                | services.monitoring                         |         |
| private_supplier          | services.private_supplier                   |         |
| marketplace_id            | services.sshoc_marketplace_id               |         |
| agreements                | services.metadata.agreements                |         |
| audience                  | services.metadata.audience                  |         |
| eosc_onboarding           | services.metadata.eosc_onboarding           |         |
| marketplace_status        | services.metadata.marketplace_status        |         |
| technical_contact         | services.metadata.technical_contact         |         |
| technical_readiness_level | services.metadata.technical_readiness_level |         |
| url                       | services.metadata.url                       |         |
| value_proposition         | services.metadata.value_proposition         |         |

## institution_service

| unr            | kb                                                      | comment |
| -------------- | ------------------------------------------------------- | ------- |
| role           | services_to_organisational_units.role_id                |         |
| institution_id | services_to_organisational_units.organisational_unit_id |         |
| service_id     | services_to_organisational_units.service_id             |         |

## \_CountryToService

| unr            | kb                                                      | comment          |
| -------------- | ------------------------------------------------------- | ---------------- |
|                | services_to_organisational_units.role_id                | service_provider |
| A (country_id) | services_to_organisational_units.organisational_unit_id |                  |
| B (service_id) | services_to_organisational_units.service_id             |                  |

## working_groups

| unr             | kb                                              | comment |
| --------------- | ----------------------------------------------- | ------- |
| name            | organisational_units.name                       |         |
| marketplace_id  | organisational_units.sshoc_marketplace_actor_id |         |
| logo            | assets<br>organisational_units.image_id         |         |
| mailing_list    | organisational_units.metadata.mailing_list      |         |
| member_tracking | organisational_units.metadata.member_tracking   |         |
| contact_email   | organisational_units.metadata.contact_email     |         |
| slug            | entities.slug                                   |         |
| description     | content_blocks_type_rich_text.content           |         |

for each working group a relation between the working group and the organisational unit of type ERIC
of type is_part_of is created:

| unr        | kb                                           | comment |
| ---------- | -------------------------------------------- | ------- |
| start_date | organisational_units_to_units.duration.start |         |
| end_date   | organisational_units_to_units.duration.end   |         |
|            | organisational_units_to_units.status.id      |         |

## working_group_events

| unr       | kb                                                  | comment |
| --------- | --------------------------------------------------- | ------- |
| report_id | working_group_report_events.working_group_report_id |         |
| title     | working_group_report_events.title                   |         |
| url       | working_group_report_events.url                     |         |
| date      | working_group_report_events.date                    |         |
| role      | working_group_report_events.role                    |         |

## working_group_outreach

| unr                 | kb                          | comment |
| ------------------- | --------------------------- | ------- |
| name                | social_media.name           |         |
| type                | social_media.type_id        |         |
| url                 | social_media.url            |         |
| start_date          | social_media.duration.start |         |
| end_date            | social_media.duration.end   |         |
| working_group_id \* |                             |         |

\* a relation between the social media item and the organisational unit of type working group is
created:

| unr | kb                                                          | comment |
| --- | ----------------------------------------------------------- | ------- |
|     | organisational_units_to_social_media.organisational_unit_id |         |
|     | organisational_units_to_social_media.social_media_id        |         |
|     |                                                             |         |

## working_group_reports

| unr                        | kb                                                             | comment  |
| -------------------------- | -------------------------------------------------------------- | -------- |
| report_campaign_id         | working_group_reports.campaign_id                              |          |
| working_group_id           | working_group_reports.working_group_id                         |          |
| status                     | working_group_reports.status                                   | accepted |
| members                    | working_group_reports.numbers_of_members                       |          |
| comments                   | report_screen_comments.comment                                 |          |
| facultative_questions_list | working_group_report_questions<br>working_group_report_answers |          |
| narrative_questions_list   | working_group_report_questions<br>working_group_report_answers |          |

## not migrated

- research_policy_developments
- users
- sessions
- software
- project_metadata
