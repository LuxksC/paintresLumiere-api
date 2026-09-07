// The Lambda runtime always sets AWS_REGION; the fallback only matters when running outside it
// (local scripts, tests).
export const AWS_REGION = process.env.AWS_REGION ?? 'sa-east-1';
