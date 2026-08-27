export type ServerEnvironment = {
  openAiApiKey: string | undefined;
  openAiModel: string;
  useMockServices: boolean;
  jwtSecret: string;
};

export function loadServerEnvironment(environment = process.env): ServerEnvironment {
  return {
    openAiApiKey: environment.OPENAI_API_KEY,
    openAiModel: environment.OPENAI_MODEL?.trim() || "gpt-5-mini",
    useMockServices: environment.USE_MOCK_SERVICES === "true" || !environment.OPENAI_API_KEY,
    jwtSecret: environment.JWT_SECRET?.trim() || "replace-with-local-demo-secret",
  };
}
