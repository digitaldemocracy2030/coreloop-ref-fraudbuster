import { createOpenApiDocument } from "@/lib/swagger/openapi";

/**
 * GET /api/openapi
 * Returns OpenAPI (Swagger) document for this project.
 */
export async function GET(request: Request) {
	const { origin } = new URL(request.url);
	const document = createOpenApiDocument(origin);

	return Response.json(document, {
		headers: {
			"Cache-Control": "no-store",
		},
	});
}
