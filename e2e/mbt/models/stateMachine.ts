export enum ActorStates {
  ANONYMOUS = 'anonymous',
  USER = 'user',
  ADMIN = 'admin',
}

export enum PageStates {
  HOME = 'home',
  BLOG_LIST = 'blog_list',
  BLOG_POST = 'blog_post',
  PORTFOLIO = 'portfolio',
  RESUME = 'resume',
  LOGIN = 'login',
  ADMIN_DASHBOARD = 'admin_dashboard',
  PROFILE = 'profile',
}

export enum EntityStates {
  POST_DRAFT = 'draft',
  POST_PUBLISHED = 'published',
  POST_ARCHIVED = 'archived',
  COMMENT_PENDING = 'pending',
  COMMENT_APPROVED = 'approved',
  COMMENT_REJECTED = 'rejected',
}

export interface AppState {
  actor: ActorStates;
  page: PageStates;
  entity?: EntityStates;
  isAuthenticated: boolean;
  selectedPostId?: string;
}

export const initialState: AppState = {
  actor: ActorStates.ANONYMOUS,
  page: PageStates.HOME,
  isAuthenticated: false,
};
