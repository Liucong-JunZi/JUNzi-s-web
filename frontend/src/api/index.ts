import axios from 'axios';
import type { User, Post, Comment, Project, Resume, Tag } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Security: Use sessionStorage instead of localStorage for token storage
// This reduces the risk of token theft via XSS as sessionStorage is cleared when the browser/tab is closed
const getToken = () => sessionStorage.getItem('token');

// 401 Error Handling: Debounce mechanism to prevent multiple redirects
let isRedirecting = false;
let redirectTimer: ReturnType<typeof setTimeout> | null = null;

const handle401Error = () => {
  // Debounce: Skip if already redirecting
  if (isRedirecting) return;

  isRedirecting = true;

  // Clear auth data
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('auth-storage');

  // Save current location for post-login redirect
  const currentPath = window.location.pathname + window.location.search;
  // Don't save login page as redirect target
  if (!currentPath.startsWith('/login')) {
    sessionStorage.setItem('redirectAfterLogin', currentPath);
  }

  // Redirect to login with a small delay to allow any pending operations to complete
  redirectTimer = setTimeout(() => {
    window.location.href = '/login';
    isRedirecting = false;
  }, 100);
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      handle401Error();
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: () => {
    window.location.href = `${API_BASE_URL}/auth/github`;
  },

  callback: async (code: string): Promise<{ user: User; token: string }> => {
    const response = await api.get(`/auth/callback?code=${code}`);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  me: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  // Helper to redirect after login
  getRedirectPath: (): string | null => {
    const redirectPath = sessionStorage.getItem('redirectAfterLogin');
    if (redirectPath) {
      sessionStorage.removeItem('redirectAfterLogin');
    }
    return redirectPath;
  },
};

// Posts API
export const postsAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    tag?: string;
    search?: string;
  }): Promise<{ posts: Post[]; total: number; page: number; limit: number }> => {
    const response = await api.get('/posts', { params });
    return response.data;
  },

  getBySlug: async (slug: string): Promise<Post> => {
    const response = await api.get(`/posts/${slug}`);
    return response.data;
  },

  create: async (data: Partial<Post>): Promise<Post> => {
    const response = await api.post('/posts', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Post>): Promise<Post> => {
    const response = await api.put(`/posts/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/posts/${id}`);
  },

  like: async (id: number): Promise<{ likeCount: number }> => {
    const response = await api.post(`/posts/${id}/like`);
    return response.data;
  },
};

// Comments API
export const commentsAPI = {
  getByPostId: async (postId: number): Promise<Comment[]> => {
    const response = await api.get(`/posts/${postId}/comments`);
    return response.data;
  },

  create: async (postId: number, data: { content: string; parentId?: number }): Promise<Comment> => {
    const response = await api.post(`/posts/${postId}/comments`, data);
    return response.data;
  },

  update: async (id: number, content: string): Promise<Comment> => {
    const response = await api.put(`/comments/${id}`, { content });
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/comments/${id}`);
  },
};

// Projects API
export const projectsAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    featured?: boolean;
  }): Promise<{ projects: Project[]; total: number; page: number; limit: number }> => {
    const response = await api.get('/projects', { params });
    return response.data;
  },

  getBySlug: async (slug: string): Promise<Project> => {
    const response = await api.get(`/projects/${slug}`);
    return response.data;
  },

  create: async (data: Partial<Project>): Promise<Project> => {
    const response = await api.post('/projects', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Project>): Promise<Project> => {
    const response = await api.put(`/projects/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/projects/${id}`);
  },
};

// Resume API
export const resumeAPI = {
  get: async (): Promise<Resume> => {
    const response = await api.get('/resume');
    return response.data;
  },

  update: async (data: { title: string; content: string }): Promise<Resume> => {
    const response = await api.put('/resume', data);
    return response.data;
  },
};

// Tags API
export const tagsAPI = {
  getAll: async (): Promise<Tag[]> => {
    const response = await api.get('/tags');
    return response.data;
  },
};

// Upload API
export const uploadAPI = {
  uploadImage: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export default api;