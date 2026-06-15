const units = ["bytes", "KB", "MB", "GB", "TB"];

export function formatFileSize(bytes: number): string {
	if (bytes < 1024) {
		return `${String(bytes)} ${bytes === 1 ? "byte" : "bytes"}`;
	}

	let value = bytes;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex++;
	}

	const unit = units[unitIndex] ?? "bytes";
	const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);

	return `${formatted} ${unit}`;
}
