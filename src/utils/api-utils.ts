import {NextResponse} from "next/server";
import {nanoid} from "nanoid";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : `${error}`;
}

const standardErrorResponse = {
  '401': {
    status: 401,
    code: "unauthorized",
    title: "Unauthorized",
  },
  '403': {
    status: 403,
    code: "forbidden",
    title: "Forbidden",
  },
  '404': {
    status: 404,
    code: "not_found",
    title: "Not Found",
  },
  '500': {
    status: 500,
    code: "internal_server_error",
    title: "Internal Server Error",
  }
};

export function restErrorResponse(status: number, params?: {
  code?: string;
  title?: string;
  detail?: string;
}) {
  if (status < 400 || status >= 600) {
    const errorId = nanoid();
    console.error(`error[${errorId}] Unexpected status code: ${status} for error response`);
    const payload = {
      errors: [{
        status: '500',
        code: `internal_server_error`,
        title: `Internal Server Error`,
        detail: `errorId: ${errorId}`,
      }]
    };
    return new Response(JSON.stringify(payload), {
      status: 500,
      headers: {
        "Content-Type": "application/vnd.api+json",
      },
    });
  }

  if (status == 406) {
    // Not Acceptable
    return NextResponse.json({
      error: `Not Acceptable`,
    }, {
      status: 406,
    });
  }

  const statusText = `${status}`;
  const predefinedError = standardErrorResponse[statusText as keyof typeof standardErrorResponse];
  const code = params?.code || predefinedError?.code;
  const title = params?.title || predefinedError?.title;
  const detail = params?.detail;
  if (!code || !title) {
    const errorId = nanoid();
    console.error(`error[${errorId}] Unexpected status code: ${status} and params ${JSON.stringify(params)} for error response`);
    const payload = {
      errors: [{
        status: '500',
        code: `internal_server_error`,
        title: `Internal Server Error`,
        detail: `errorId: ${errorId}`,
      }]
    };
    return new Response(JSON.stringify(payload), {
      status: 500,
      headers: {
        "Content-Type": "application/vnd.api+json",
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

  return new Response(JSON.stringify({
    errors: [errorPayload]
  }), {
    status: status,
    headers: {
      "Content-Type": "application/vnd.api+json",
    },
  });
}

export function restSuccessResponse(data: string, status: number = 200) {
  return new Response(data, {
    status: status,
    headers: {
      "Content-Type": "application/vnd.api+json",
    },
  });
}
