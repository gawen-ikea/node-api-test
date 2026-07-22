import { JsonApiError, type JsonApiDocument } from '@jsonapi-serde/server/common';
import { nanoid } from 'nanoid';

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : `${error}`;
}

export function standardErrorResponse(error: unknown): Response {
  if (error instanceof Error || error instanceof JsonApiError) {
    return apiJsonErrorResponse(error as Error | JsonApiError);
  } else {
    const errorId = nanoid();
    console.error(`error[${errorId}] Unexpected error during authentication: ${errorMessage(error)}`);
    return apiJsonErrorResponse(new Error('Unexpected error during authentication'), {
      status: 500,
      detail: `errorId: ${errorId}`,
    });
  }
}

export type ApiJsonErrorResponseData = {
  status?: number;
  code?: string;
  title?: string;
  detail?: string;
} & Record<string, string | number>;

export function apiJsonErrorResponse(error: Error | JsonApiError, data?: ApiJsonErrorResponseData) {
  const { status = 500, code = 'internal_server_error', title = 'Internal Server Error', detail } = data || {};

  if (error instanceof JsonApiError) {
    const document = error.toDocument();
    return new Response(JSON.stringify(document.getBody()), {
      status: document.getStatus(),
      headers: {
        'Content-Type': document.getContentType(),
      },
    });
  } else {
    const payload = {
      errors: [
        {
          status: `${status}`,
          code,
          title,
          detail,
        },
      ],
    };
    return new Response(JSON.stringify(payload), {
      status,
      headers: {
        'Content-Type': 'application/vnd.api+json',
      },
    });
  }
}

export function apiJsonDocumentResponse(document: JsonApiDocument, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type', document.getContentType());
  const status = document.getStatus();
  const body = status === 204 || status === 205 || status === 304 ? null : JSON.stringify(document.getBody());

  return new Response(body, {
    status,
    headers: responseHeaders,
  });
}
