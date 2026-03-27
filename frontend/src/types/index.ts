export interface User {
  id: number;
  username: string;
  email: string;
  avatar_url?: string;
  github_id?: string;
  role?: string;
  created_at: string;
}

export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string;
  summary?: string;
  cover_image?: string;
  author: User;
  tags: Tag[];
  created_at: string;
  updated_at: string;
  status: 'draft' | 'published';
  view_count: number;
  like_count: number;
  author_id?: number;
  category_id?: number;
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
  author_name?: string;
  author_email?: string;
  post_id: number;
  post_slug?: string;
  post?: { id: number; slug: string; title?: string };
  parent_id?: number;
  replies?: Comment[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  tech_stack?: string;  // Backend stores as comma-separated string
  status: 'active' | 'planning' | 'in_progress' | 'completed' | 'archived';
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
  start_date: string;
  end_date?: string;
  description?: string;
  type: 'work' | 'education' | 'project';
  sort_order?: number;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
