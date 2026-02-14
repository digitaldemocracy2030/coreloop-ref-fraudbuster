import { NextResponse } from "next/server";

export type ApiErrorResponse = {
	error: string;
	message?: string;
};

export function successResponse<T>(data: T, status = 200) {
	return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 500) {
	return NextResponse.json({ error: message }, { status });
}

export function badRequestResponse(message = "Bad Request") {
	return errorResponse(message, 400);
}

export function notFoundResponse(message = "Not Found") {
	return errorResponse(message, 404);
}
