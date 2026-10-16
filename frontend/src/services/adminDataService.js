import { apiBaseUrl } from "./apiConfig";

export async function adminRequest(path, accessToken, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) return null;

  let payload;
  let responseText;
  try {
    responseText = await response.text();
  } catch {
    throw new Error(`Unable to read the server response (HTTP ${response.status}).`);
  }

  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      if (response.ok) {
        throw new Error("The server returned an invalid response.");
      }
    }
  }

  if (!response.ok) {
    const detail = typeof payload?.detail === "string"
      ? payload.detail
      : `The request failed (HTTP ${response.status}).`;
    throw new Error(detail);
  }

  if (!responseText) {
    throw new Error("The server returned an invalid response.");
  }

  return payload;
}
