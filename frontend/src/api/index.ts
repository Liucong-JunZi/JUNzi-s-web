import axios from 'axios';
import type { User, Post, Comment, Project, ResumeItem, Tag } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable cookies for OAuth session
});

// Helper to read cookies (for CSRF token)
function getCookie(name: string): string | undefined {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}

// 401 Error Handling: Try token refresh before redirecting to login
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason: unknown) => void }> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(undefined);
    }
  });
  failedQueue = [];
};

const handle401Error = () => {
  // Clear auth data
  sessionStorage.removeItem('auth-storage');

  // Save current location for post-login redirect
  const currentPath = window.location.pathname + window.location.search;
  if (!currentPath.startsWith('/login')) {
    sessionStorage.setItem('redirectAfterLogin', currentPath);
  }

  window.location.href = '/login';
};

// Request interceptor to add auth token and CSRF token
api.interceptors.request.use(
  (config) => {
    // Add CSRF token for state-changing requests
    if (config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
      const csrfToken = getCookie('csrf_token');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: try token refresh on 401 before giving up
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Skip redirect for silent session checks (used by auth store rehydration)
      if (originalRequest._skipAuthRedirect) {
        return Promise.reject(error);
      }

      // Don't try to refresh if the refresh endpoint itself failed
      if (originalRequest.url?.includes('/auth/refresh')) {
        handle401Error();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request to retry after the in-flight refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt silent token refresh (cookies are sent automatically)
        await api.post('/auth/refresh');
        processQueue(null);
        // Retry the original request with the new access_token cookie
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        handle401Error();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: () => {
    window.location.href = `${API_BASE_URL}/auth/github`;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  refresh: async (): Promise<{ message: string; csrf_token: string }> => {
    const response = await api.post('/auth/refresh');
    return response.data;
  },

  me: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data.user || response.data;
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
    // Map frontend params to backend expected params
    const mappedParams: any = {
      page: params?.page,
      page_size: params?.limit,  // Backend expects page_size instead of limit
      tag: params?.tag,
      search: params?.search,
    };
    // Remove undefined values
    Object.keys(mappedParams).forEach(key => {
      if (mappedParams[key] === undefined) {
        delete mappedParams[key];
      }
    });
    const response = await api.get('/posts', { params: mappedParams });
    return response.data;
  },

  adminListPosts: async (params?: {
    page?: number;
    limit?: number;
    tag?: string;
    search?: string;
  }): Promise<{ posts: Post[]; total: number; page: number; limit: number }> => {
    const mappedParams: any = {
      page: params?.page,
      page_size: params?.limit,
      tag: params?.tag,
      search: params?.search,
    };
    Object.keys(mappedParams).forEach(key => {
      if (mappedParams[key] === undefined) delete mappedParams[key];
    });
    const response = await api.get('/admin/posts', { params: mappedParams });
    return response.data;
  },

  getBySlug: async (slug: string): Promise<Post> => {
    const response = await api.get(`/posts/${slug}`);
    return response.data.post || response.data;
  },

  getById: async (id: number): Promise<Post> => {
    const response = await api.get(`/admin/posts/${id}`);
    return response.data.post || response.data;
  },

  create: async (data: Partial<Post>): Promise<Post> => {
    // Map coverImage to cover_image for backend
    const mappedData: any = { ...data };
    if (mappedData.coverImage) {
      mappedData.cover_image = mappedData.coverImage;
      delete mappedData.coverImage;
    }
    // tags stays as-is, backend expects "tags"
    const response = await api.post('/admin/posts', mappedData);
    return response.data.post || response.data;
  },

  update: async (id: number, data: Partial<Post>): Promise<Post> => {
    // Map coverImage to cover_image for backend
    const mappedData: any = { ...data };
    if (mappedData.coverImage) {
      mappedData.cover_image = mappedData.coverImage;
      delete mappedData.coverImage;
    }
    // tags stays as-is, backend expects "tags"
    const response = await api.put(`/admin/posts/${id}`, mappedData);
    return response.data.post || response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/admin/posts/${id}`);
  },

  like: async (id: number): Promise<{ like_count: number; liked: boolean }> => {
    const response = await api.post(`/posts/${id}/like`);
    return response.data;
  },
};

// Comments API
export const commentsAPI = {
  getByPostSlug: async (slug: string, params?: { page?: number; page_size?: number }): Promise<{ comments: Comment[]; total: number; page: number; page_size: number }> => {
    const response = await api.get(`/posts/${slug}/comments`, { params });
    const data = response.data;
    if (data.comments !== undefined) {
      return data;
    }
    // legacy flat array fallback
    return { comments: data, total: data.length, page: 1, page_size: data.length };
  },

  // Keep old method name for backwards compatibility but mark as deprecated
  getByPostId: async (slug: string, params?: { page?: number; page_size?: number }): Promise<{ comments: Comment[]; total: number; page: number; page_size: number }> => {
    const response = await api.get(`/posts/${slug}/comments`, { params });
    const data = response.data;
    if (data.comments !== undefined) {
      return data;
    }
    // legacy flat array fallback
    return { comments: data, total: data.length, page: 1, page_size: data.length };
  },

  getAll: async (params?: { page?: number; page_size?: number }): Promise<{ comments: Comment[]; total: number; page: number; page_size: number }> => {
    const response = await api.get('/admin/comments', { params });
    return response.data;
  },

  create: async (data: { content: string; postId?: number; parentId?: number; authorName?: string; authorEmail?: string }): Promise<Comment> => {
    // Map postId to post_id for backend
    const mappedData: any = {
      content: data.content,
      post_id: data.postId,
      parent_id: data.parentId,
      author_name: data.authorName,
      author_email: data.authorEmail,
    };
    // Remove undefined values
    Object.keys(mappedData).forEach(key => {
      if (mappedData[key] === undefined) {
        delete mappedData[key];
      }
    });
    const response = await api.post('/comments', mappedData);
    return response.data.comment || response.data;
  },

  update: async (id: number, content: string): Promise<Comment> => {
    const response = await api.put(`/admin/comments/${id}`, { content });
    return response.data.comment || response.data;
  },

  updateStatus: async (id: number, status: string): Promise<Comment> => {
    const response = await api.put(`/admin/comments/${id}/status`, { status });
    return response.data.comment || response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/admin/comments/${id}`);
  },
};

// Projects API
export const projectsAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<{ projects: Project[]; total: number; page: number; limit: number }> => {
    const mappedParams: any = {
      page: params?.page,
      page_size: params?.limit,
    };
    Object.keys(mappedParams).forEach(key => {
      if (mappedParams[key] === undefined) delete mappedParams[key];
    });
    const response = await api.get('/projects', { params: mappedParams });
    return response.data;
  },

  adminListProjects: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<{ projects: Project[]; total: number; page: number; limit: number }> => {
    const mappedParams: any = {
      page: params?.page,
      page_size: params?.limit,
    };
    Object.keys(mappedParams).forEach(key => {
      if (mappedParams[key] === undefined) delete mappedParams[key];
    });
    const response = await api.get('/admin/projects', { params: mappedParams });
    return response.data;
  },

  getById: async (id: number): Promise<Project> => {
    const response = await api.get(`/projects/${id}`);
    return response.data.project || response.data;
  },

  getByIdAdmin: async (id: number): Promise<Project> => {
    const response = await api.get(`/admin/projects/${id}`);
    return response.data.project || response.data;
  },

  create: async (data: Partial<Project>): Promise<Project> => {
    // Map frontend field names to backend expected snake_case
    const mappedData: any = {
      title: data.title,
      description: data.description,
      tech_stack: data.tech_stack,
      status: data.status,
      sort_order: data.sort_order,
      cover_image: data.cover_image,
      demo_url: data.demo_url,
      github_url: data.github_url,
    };
    // Remove undefined values
    Object.keys(mappedData).forEach(key => {
      if (mappedData[key] === undefined) {
        delete mappedData[key];
      }
    });
    const response = await api.post('/admin/projects', mappedData);
    return response.data.project || response.data;
  },

  update: async (id: number, data: Partial<Project>): Promise<Project> => {
    // Map frontend field names to backend expected snake_case
    const mappedData: any = {
      title: data.title,
      description: data.description,
      tech_stack: data.tech_stack,
      status: data.status,
      sort_order: data.sort_order,
      cover_image: data.cover_image,
      demo_url: data.demo_url,
      github_url: data.github_url,
    };
    // Remove undefined values
    Object.keys(mappedData).forEach(key => {
      if (mappedData[key] === undefined) {
        delete mappedData[key];
      }
    });
    const response = await api.put(`/admin/projects/${id}`, mappedData);
    return response.data.project || response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/admin/projects/${id}`);
  },
};

// Resume API
export const resumeAPI = {
  getAll: async (): Promise<ResumeItem[]> => {
    const response = await api.get('/resume');
    return response.data.resume || response.data;
  },

  create: async (data: Partial<ResumeItem>): Promise<ResumeItem> => {
    const response = await api.post('/admin/resume', data);
    return response.data.resume || response.data;
  },

  update: async (id: number, data: Partial<ResumeItem>): Promise<ResumeItem> => {
    const response = await api.put(`/admin/resume/${id}`, data);
    return response.data.resume || response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/admin/resume/${id}`);
  },
};

// Tags API
export const tagsAPI = {
  getAll: async (): Promise<Tag[]> => {
    const response = await api.get('/tags');
    return response.data.tags || response.data;
  },
};

// Upload API
export const uploadAPI = {
  uploadImage: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/admin/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export default api;