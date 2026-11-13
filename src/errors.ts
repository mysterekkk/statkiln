/** Error with a message that is safe to print in logs (never contains secrets). */
export class StatKilnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StatKilnError';
  }
}

export class ConfigError extends StatKilnError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class GitHubApiError extends StatKilnError {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}
