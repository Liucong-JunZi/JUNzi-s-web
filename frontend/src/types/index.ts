export interface User {
  id: number;
  username: string;
  email: string;
  avatar?: string;
  githubId?: string;
  createdAt: string;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  summary?: string;
  coverImage?: string;
  author: User;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'published';
  viewCount: number;
  likeCount: number;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

export interface Comment {
  id: number;
  content: string;
  author?: User;
  authorName?: string;
  authorEmail?: string;
  postId: number;
  postSlug?: string;
  parentId?: number;
  replies?: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  techStack?: string[];
  status: 'planning' | 'in_progress' | 'completed' | 'archived';
  sortOrder?: number;
  imageUrl?: string;
  demoUrl?: string;
  githubUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeItem {
  id: number;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  description?: string;
  type: 'work' | 'education' | 'project';
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
