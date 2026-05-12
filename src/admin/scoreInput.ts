export function manualTotalScoreInputValue(manualTotalScore: number | null | undefined): string {
  return manualTotalScore === null || manualTotalScore === undefined ? '' : String(manualTotalScore);
}
