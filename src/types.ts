export interface PhotoInfo {
  name: string;
  category: "A" | "B";
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
}

export interface Evaluator {
  id: string;
  name: string;
  role: string;
}

export interface Photo {
  id: string;
  author: string;
  category: string;
  name: string;
  path: string;
  description: string;
  createdAt: string;
}

export interface Rating {
  photoId: string;
  score: number;
}
