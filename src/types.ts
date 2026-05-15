export interface PhotoInfo {
  name: string;
  category: string;
  description: string;
  file?: File;
  previewUrl?: string;
  id?: string;
}

export interface Registration {
  author: string;
  email: string;
  instagram: string;
  webpage?: string;
  address: string;
  photos: PhotoInfo[];
  gdprConsent: boolean;
  rulesConsent: boolean;
}

export interface Evaluator {
  id: string;
  name: string;
  role: string;
}

export type ContestStatus = "submissions" | "review" | "judging" | "shortlist" | "results";

export interface Photo {
  id: string;
  author: string;
  email: string;
  category: string;
  name: string;
  path: string;
  originalPath: string;
  webPath?: string;
  description: string;
  metadata?: any;
  createdAt: string;
  shortlisted?: boolean;
  averageScore?: number;
  voteCount?: number;
  originalExists?: boolean;
}

export interface Rating {
  photoId: string;
  judgeId: string;
  score: number;
}
