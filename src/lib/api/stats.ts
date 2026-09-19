import { apiGet } from './client';

export type CorpusStats = {
  article_count: number;
  judgment_count: number;
  connection_count: number;
  source_count: number;
  last_updated: string | null;
};

export type InstrumentStats = {
  bwb_id: string;
  shorthand: string;
  article_count: number;
};

export type FullCorpusStats = {
  corpus: CorpusStats;
  instruments?: InstrumentStats[];
};

type RawStatsResponse = {
  nodes: {
    instruments: number;
    instrument_articles: number;
    judgments: number;
    [key: string]: number;
  };
  edges: {
    total: number;
    by_relation?: Record<string, number>;
  };
};

export async function getCorpusStats(): Promise<FullCorpusStats | null> {
  try {
    const raw = await apiGet<RawStatsResponse>('/api/stats');
    return {
      corpus: {
        article_count: raw.nodes.instrument_articles,
        judgment_count: raw.nodes.judgments,
        connection_count: raw.edges.total,
        source_count: raw.nodes.instruments,
        last_updated: null,
      },
    };
  } catch {
    return null;
  }
}
