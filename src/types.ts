/**
 * MyBib API type definitions.
 */

export interface MyBibAuthor {
  given?: string;
  family?: string;
  literal?: string;
}

export interface MyBibDate {
  year?: string;
  month?: string;
  day?: string;
}

export interface MyBibMetadata {
  author?: MyBibAuthor[];
  doi?: string;
  title?: string;
  containerTitle?: string;
  volume?: string;
  issue?: string;
  page?: string;
  issued?: MyBibDate;
  accessed?: MyBibDate;
  url?: string;
  publisher?: string;
  publisherPlace?: string;
  edition?: string;
  abstractNote?: string;
  language?: string;
  isbn?: string;
  issn?: string;
  type?: string;
}

export interface MyBibCredibility {
  score?: number;
  comment?: string;
}

export interface MyBibResult {
  sourceId: string;
  metadata: MyBibMetadata;
  credibility?: MyBibCredibility;
}

export interface MyBibResponse {
  status: string;
  results: MyBibResult[];
}
