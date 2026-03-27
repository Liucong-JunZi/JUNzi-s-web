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
  tech_stack?: string;  // Backend stores as comma-separated string
  status: 'planning' | 'in_progress' | 'completed' | 'archived';
  sort_order?: number;
  cover_image?: string;
  demo_url?: string;
  github_url?: string;
  created_at: string;
  updated_at: string;
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
