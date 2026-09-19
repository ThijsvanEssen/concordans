import { apiGet } from './client';
import type { JudgmentDetailResponse } from './types';

export function getJudgmentDetail(ecli: string) {
  return apiGet<JudgmentDetailResponse>(`/api/judgments/${encodeURIComponent(ecli)}`);
}
