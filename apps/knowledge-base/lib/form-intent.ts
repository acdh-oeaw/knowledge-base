export const saveAndPublishIntent = "save-and-publish";

export function shouldSaveAndPublish(formData: FormData): boolean {
	return formData.get("intent") === saveAndPublishIntent;
}
