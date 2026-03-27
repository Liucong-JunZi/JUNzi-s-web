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
  excerpt?: string;
  coverImage?: string;
  author: User;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
  published: boolean;
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
  slug: string;
  description: string;
  content: string;
  coverImage?: string;
  images?: string[];
  tags: Tag[];
  githubUrl?: string;
  demoUrl?: string;
  startDate: string;
  endDate?: string;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Resume {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}
