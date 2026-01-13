const API_BASE_URL = process.env.ULTRAHOPE_API_URL ?? "https://api.ultrahope.dev";

type Target = "vcs-commit-message" | "pr-title-body" | "pr-intent";

interface TranslateRequest {
  input: string;
  target: Target;
}

interface TranslateResponse {
  output: string;
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  error?: string;
}

export function createApiClient(token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return {
    async translate(req: TranslateRequest): Promise<TranslateResponse> {
      const res = await fetch(`${API_BASE_URL}/v1/translate`, {
        method: "POST",
        headers,
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error: ${res.status} ${text}`);
      }
      return res.json();
    },

    async requestDeviceCode(): Promise<DeviceCodeResponse> {
      const res = await fetch(`${API_BASE_URL}/api/device/code`, {
        method: "POST",
        headers,
        body: JSON.stringify({ client_id: "ultrahope-cli" }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error: ${res.status} ${text}`);
      }
      return res.json();
    },

    async pollDeviceToken(deviceCode: string): Promise<TokenResponse> {
      const res = await fetch(`${API_BASE_URL}/api/device/token`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceCode,
          client_id: "ultrahope-cli",
        }),
      });
      if (!res.ok && res.status !== 400) {
        const text = await res.text();
        throw new Error(`API error: ${res.status} ${text}`);
      }
      return res.json();
    },
  };
}
