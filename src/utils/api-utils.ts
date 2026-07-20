import type { JsonApiDocument } from '@jsonapi-serde/server/common';
import { getAcceptableMediaTypes } from '@jsonapi-serde/server/http';
import { nanoid } from 'nanoid';

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : `${error}`;
}

const standardErrorResponse = {
  '406': {
    status: 406,
    code: 'not_acceptable',
    title: 'Not Acceptable',
  },
  '401': {
    status: 401,
    code: 'unauthorized',
    title: 'Unauthorized',
  },
  '403': {
    status: 403,
    code: 'forbidden',
    title: 'Forbidden',
  },
  '404': {
    status: 404,
    code: 'not_found',
    title: 'Not Found',
  },
  '500': {
    status: 500,
    code: 'internal_server_error',
    title: 'Internal Server Error',
  },
};

export function restErrorResponse(
  status: number,
  params?: {
    code?: string;
    title?: string;
    detail?: string;
  },
) {
  if (status < 400 || status >= 600) {
    const errorId = nanoid();
    console.error(`error[${errorId}] Unexpected status code: ${status} for error response`);
    const payload = {
      errors: [
        {
          status: '500',
          code: `internal_server_error`,
          title: `Internal Server Error`,
          detail: `errorId: ${errorId}`,
        },
      ],
    };
    return new Response(JSON.stringify(payload), {
      status: 500,
      headers: {
        'Content-Type': 'application/vnd.api+json',
      },
    });
  }

  const statusText = `${status}`;
  const predefinedError = standardErrorResponse[statusText as keyof typeof standardErrorResponse];
  const code = params?.code || predefinedError?.code;
  const title = params?.title || predefinedError?.title;
  const detail = params?.detail;
  if (!code || !title) {
    const errorId = nanoid();
    console.error(
      `error[${errorId}] Unexpected status code: ${status} and params ${JSON.stringify(params)} for error response`,
    );
    const payload = {
      errors: [
        {
          status: '500',
          code: `internal_server_error`,
          title: `Internal Server Error`,
          detail: `errorId: ${errorId}`,
        },
      ],
    };
    return new Response(JSON.stringify(payload), {
      status: 500,
      headers: {
        'Content-Type': 'application/vnd.api+json',
      },
    });
  }

  const errorPayload: Record<string, string> = {
    status: statusText,
    code: params?.code || predefinedError.code,
    title: params?.title || predefinedError.title,
  };
  if (detail) {
    errorPayload['detail'] = detail;
  }

  return new Response(
    JSON.stringify({
      errors: [errorPayload],
    }),
    {
      status: status,
      headers: {
        'Content-Type': 'application/vnd.api+json',
      },
    },
  );
}

export function restSuccessResponse(data: string, status: number = 200) {
  return new Response(data, {
    status: status,
    headers: {
      'Content-Type': 'application/vnd.api+json',
    },
  });
}

export function acceptsJsonApi(request: Request): boolean {
  try {
    return getAcceptableMediaTypes(request.headers.get('Accept') ?? undefined).length > 0;
  } catch {
    return false;
  }
}

export function jsonApiDocumentResponse(document: JsonApiDocument, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type', document.getContentType());

  return new Response(JSON.stringify(document.getBody()), {
    status: document.getStatus(),
    headers: responseHeaders,
  });
}
