/**
 * State Machine Model for JUNzi Web Application MBT
 * 
 * This module defines all possible states in the application, organized by dimension:
 * - Actor States: Based on authentication and database role
 * - Page States: Represents the current view/route
 * - Entity States: Represents the state of individual entities (likes, posts, comments, projects)
 */

/** Actor states based on authentication and role */
export const ActorStates = {
  ANONYMOUS: 'S_ANON',
  USER: 'S_USER',
  ADMIN: 'S_ADMIN',
} as const;

/** Page/view states representing current route */
export const PageStates = {
  HOME: 'P_HOME',
  BLOG_LIST: 'P_BLOG_LIST',
  BLOG_POST: 'P_BLOG_POST',
  PORTFOLIO_LIST: 'P_PORTFOLIO_LIST',
  PORTFOLIO_DETAIL: 'P_PORTFOLIO_DETAIL',
  RESUME: 'P_RESUME',
  LOGIN: 'P_LOGIN',
  AUTH_CALLBACK: 'P_AUTH_CALLBACK',
  ADMIN_DASHBOARD: 'P_ADMIN_DASHBOARD',
  ADMIN_POSTS: 'P_ADMIN_POSTS',
  ADMIN_POST_EDITOR: 'P_ADMIN_POST_EDITOR',
  ADMIN_PROJECTS: 'P_ADMIN_PROJECTS',
  ADMIN_PROJECT_EDITOR: 'P_ADMIN_PROJECT_EDITOR',
  ADMIN_COMMENTS: 'P_ADMIN_COMMENTS',
  ADMIN_RESUME: 'P_ADMIN_RESUME',
} as const;

/** Entity states for individual data items */
export const EntityStates = {
  LIKED: 'E_LIKED',
  UNLIKED: 'E_UNLIKED',
  POST_DRAFT: 'E_POST_DRAFT',
  POST_PUBLISHED: 'E_POST_PUBLISHED',
  POST_ARCHIVED: 'E_POST_ARCHIVED',
  COMMENT_NONE: 'E_COMMENT_NONE',
  COMMENT_PENDING: 'E_COMMENT_PENDING',
  COMMENT_APPROVED: 'E_COMMENT_APPROVED',
  COMMENT_REJECTED: 'E_COMMENT_REJECTED',
  PROJECT_PLANNING: 'E_PROJECT_PLANNING',
  PROJECT_ACTIVE: 'E_PROJECT_ACTIVE',
  PROJECT_COMPLETED: 'E_PROJECT_COMPLETED',
  PROJECT_ARCHIVED: 'E_PROJECT_ARCHIVED',
} as const;

/** Combined application state type */
export interface AppState {
  actor: typeof ActorStates[keyof typeof ActorStates];
  page: typeof PageStates[keyof typeof PageStates];
  entity?: {
    like?: typeof EntityStates.LIKED | typeof EntityStates.UNLIKED;
    post?: typeof EntityStates.POST_DRAFT | typeof EntityStates.POST_PUBLISHED | typeof EntityStates.POST_ARCHIVED;
    comment?: typeof EntityStates[keyof typeof EntityStates];
    project?: typeof EntityStates[keyof typeof EntityStates];
  };
  selectedPostId?: string;
}

/** Type for state identifiers */
export type StateId = string;

/** Initial state for testing */
export const initialState: AppState = {
  actor: ActorStates.ANONYMOUS,
  page: PageStates.HOME,
};
