import { JsonApiError, type JsonApiDocument } from '@jsonapi-serde/server/common';
import { NextResponse } from 'next/server';

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : `${error}`;
}

export function restJsonErrorResponse(status: number, message: Record<string, string>) {
  return NextResponse.json(message, {
    status: status,
  });
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

  return new Response(JSON.stringify(document.getBody()), {
    status: document.getStatus(),
    headers: responseHeaders,
  });
}
