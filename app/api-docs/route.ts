const SWAGGER_UI_CSS_URL = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
const SWAGGER_UI_BUNDLE_URL =
	"https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";
const SWAGGER_UI_PRESET_URL =
	"https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js";

function renderSwaggerHtml(openApiUrl: string): string {
	const escapedOpenApiUrl = JSON.stringify(openApiUrl);

	return `<!doctype html>
<html lang="ja">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>AntiFraud API Docs</title>
	<link rel="stylesheet" href="${SWAGGER_UI_CSS_URL}" />
	<style>
		html, body {
			margin: 0;
			padding: 0;
			height: 100%;
			background: #fafafa;
		}
		#swagger-ui {
			height: 100%;
		}
	</style>
</head>
<body>
	<div id="swagger-ui"></div>
	<script src="${SWAGGER_UI_BUNDLE_URL}" crossorigin="anonymous"></script>
	<script src="${SWAGGER_UI_PRESET_URL}" crossorigin="anonymous"></script>
	<script>
		window.onload = function() {
			window.ui = SwaggerUIBundle({
				url: ${escapedOpenApiUrl},
				dom_id: "#swagger-ui",
				deepLinking: true,
				presets: [
					SwaggerUIBundle.presets.apis,
					SwaggerUIStandalonePreset
				],
				layout: "StandaloneLayout",
				docExpansion: "list",
				defaultModelsExpandDepth: 1,
				persistAuthorization: true
			});
		};
	</script>
</body>
</html>`;
}

/**
 * GET /api-docs
 * Renders Swagger UI for local API documentation.
 */
export async function GET(request: Request) {
	const { origin } = new URL(request.url);
	const openApiUrl = `${origin}/api/openapi`;

	return new Response(renderSwaggerHtml(openApiUrl), {
		status: 200,
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-store",
		},
	});
}
