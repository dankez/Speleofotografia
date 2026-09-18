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
  email?: string;
  role?: string;
  ratedCount?: number;
  submittedAt?: string;
  isLocked?: boolean;
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

export interface ChairmanPhotoResult {
  id: string;
  author: string;
  category: string;
  name: string;
  webPath: string;
  description: string;
  metadata?: any;
  totalScore: number;
  averageScore: number;
  ratedCount: number;
  judges: {
    judgeId: string;
    judgeName: string;
    score: number;
    createdAt?: string;
  }[];
}
