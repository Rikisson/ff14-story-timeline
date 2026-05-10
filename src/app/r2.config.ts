export interface R2Config {
  /** Worker endpoint that issues presigned R2 URLs (e.g. https://media-signer-dev.<account>.workers.dev). Empty disables uploads. */
  signerUrl: string;
  /** Public base URL for R2 reads (custom domain or r2.dev). No trailing slash. Empty disables uploads. */
  publicBase: string;
}

export const r2Config: R2Config = {
  signerUrl: '',
  publicBase: '',
};
