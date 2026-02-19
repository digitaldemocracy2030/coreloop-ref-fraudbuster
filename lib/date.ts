export type DateLike = Date | string | null | undefined;

function parseDate(value: DateLike): Date | null {
	if (!value) return null;
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}

	if (typeof value === "string") {
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}

	return null;
}

export function formatDate(
	value: DateLike,
	locale = "ja-JP",
	options?: Intl.DateTimeFormatOptions,
): string | null {
	const date = parseDate(value);
	if (!date) return null;
	return date.toLocaleDateString(locale, options);
}
