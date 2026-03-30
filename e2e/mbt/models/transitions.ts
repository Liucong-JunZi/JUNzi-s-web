/**
 * State Transitions for JUNzi Web Application MBT
 * 
 * Defines all possible transitions between states, including:
 * - Who can perform each transition
 * - Preconditions that must be met
 * - Postconditions that result from the transition
 * - Priority for test case generation
 */

import { AppState, StateId, ActorStates, PageStates, EntityStates } from './stateMachine';

/** Types of transitions available in the application */
export type TransitionType = 
  | 'nav'
  | 'login'
  | 'logout'
  | 'like'
  | 'unlike'
  | 'submit_comment'
  | 'load_more_comments'
  | 'approve_comment'
  | 'reject_comment'
  | 'delete_comment'
  | 'create_post'
  | 'update_post'
  | 'delete_post'
  | 'publish_post'
  | 'create_project'
  | 'update_project'
  | 'delete_project'
  | 'add_resume_item'
  | 'update_resume_item'
  | 'delete_resume_item'
  | 'like_denied'
  | 'comment_denied'
  | '403_error'
  | '404_error'
  | 'reload';

/** Transition definition */
export interface Transition {
  id: string;
  type: TransitionType;
  name: string;
  description: string;
  allowedActors: Array<typeof ActorStates[keyof typeof ActorStates]>;
  preconditions?: (state: AppState) => boolean;
  postconditions: Partial<AppState>;
  priority: number;
}

/** All available transitions */
export const Transitions: Record<TransitionType, Transition> = {
  nav: {
    id: 'T_NAV',
    type: 'nav',
    name: 'Navigate',
    description: 'Navigate to a page',
    allowedActors: [ActorStates.ANONYMOUS, ActorStates.USER, ActorStates.ADMIN],
    postconditions: { page: PageStates.HOME },
    priority: 10,
  },
  
  login: {
    id: 'T_LOGIN',
    type: 'login',
    name: 'Login',
    description: 'User logs in via GitHub OAuth',
    allowedActors: [ActorStates.ANONYMOUS],
    postconditions: { actor: ActorStates.USER },
    priority: 10,
  },
  
  logout: {
    id: 'T_LOGOUT',
    type: 'logout',
    name: 'Logout',
    description: 'User logs out',
    allowedActors: [ActorStates.USER, ActorStates.ADMIN],
    postconditions: { actor: ActorStates.ANONYMOUS },
    priority: 10,
  },
  
  like: {
    id: 'T_LIKE',
    type: 'like',
    name: 'Like Post',
    description: 'User likes a blog post',
    allowedActors: [ActorStates.USER, ActorStates.ADMIN],
    postconditions: { entity: { like: EntityStates.LIKED } },
    priority: 9,
  },
  
  unlike: {
    id: 'T_UNLIKE',
    type: 'unlike',
    name: 'Unlike Post',
    description: 'User unlikes a blog post',
    allowedActors: [ActorStates.USER, ActorStates.ADMIN],
    postconditions: { entity: { like: EntityStates.UNLIKED } },
    priority: 9,
  },
  
  like_denied: {
    id: 'T_LIKE_DENIED',
    type: 'like_denied',
    name: 'Like Denied',
    description: 'Anonymous user cannot like',
    allowedActors: [ActorStates.ANONYMOUS],
    postconditions: { entity: { like: EntityStates.UNLIKED } },
    priority: 8,
  },
  
  submit_comment: {
    id: 'T_SUBMIT_COMMENT',
    type: 'submit_comment',
    name: 'Submit Comment',
    description: 'User submits a comment',
    allowedActors: [ActorStates.USER, ActorStates.ADMIN],
    postconditions: { entity: { comment: EntityStates.COMMENT_PENDING } },
    priority: 9,
  },
  
  comment_denied: {
    id: 'T_COMMENT_DENIED',
    type: 'comment_denied',
    name: 'Comment Denied',
    description: 'Anonymous user cannot comment',
    allowedActors: [ActorStates.ANONYMOUS],
    postconditions: {},
    priority: 8,
  },
  
  load_more_comments: {
    id: 'T_LOAD_MORE',
    type: 'load_more_comments',
    name: 'Load More Comments',
    description: 'Load next page of comments',
    allowedActors: [ActorStates.ANONYMOUS, ActorStates.USER, ActorStates.ADMIN],
    postconditions: {},
    priority: 6,
  },
  
  approve_comment: {
    id: 'T_APPROVE_COMMENT',
    type: 'approve_comment',
    name: 'Approve Comment',
    description: 'Admin approves a comment',
    allowedActors: [ActorStates.ADMIN],
    postconditions: { entity: { comment: EntityStates.COMMENT_APPROVED } },
    priority: 9,
  },
  
  reject_comment: {
    id: 'T_REJECT_COMMENT',
    type: 'reject_comment',
    name: 'Reject Comment',
    description: 'Admin rejects a comment',
    allowedActors: [ActorStates.ADMIN],
    postconditions: { entity: { comment: EntityStates.COMMENT_REJECTED } },
    priority: 9,
  },
  
  delete_comment: {
    id: 'T_DELETE_COMMENT',
    type: 'delete_comment',
    name: 'Delete Comment',
    description: 'Admin deletes a comment',
    allowedActors: [ActorStates.ADMIN],
    postconditions: { entity: { comment: EntityStates.COMMENT_NONE } },
    priority: 8,
  },
  
  create_post: {
    id: 'T_CREATE_POST',
    type: 'create_post',
    name: 'Create Post',
    description: 'Admin creates a new blog post',
    allowedActors: [ActorStates.ADMIN],
    postconditions: { 
      page: PageStates.ADMIN_POST_EDITOR,
      entity: { post: EntityStates.POST_DRAFT }
    },
    priority: 9,
  },
  
  update_post: {
    id: 'T_UPDATE_POST',
    type: 'update_post',
    name: 'Update Post',
    description: 'Admin updates a blog post',
    allowedActors: [ActorStates.ADMIN],
    postconditions: { page: PageStates.ADMIN_POST_EDITOR },
    priority: 8,
  },
  
  delete_post: {
    id: 'T_DELETE_POST',
    type: 'delete_post',
    name: 'Delete Post',
    description: 'Admin deletes a blog post',
    allowedActors: [ActorStates.ADMIN],
    postconditions: { page: PageStates.ADMIN_POSTS },
    priority: 7,
  },
  
  publish_post: {
    id: 'T_PUBLISH_POST',
    type: 'publish_post',
    name: 'Publish Post',
    description: 'Admin publishes a draft post',
    allowedActors: [ActorStates.ADMIN],
    postconditions: { entity: { post: EntityStates.POST_PUBLISHED } },
    priority: 9,
  },
  
  create_project: {
    id: 'T_CREATE_PROJECT',
    type: 'create_project',
    name: 'Create Project',
    description: 'Admin creates a new portfolio project',
    allowedActors: [ActorStates.ADMIN],
    postconditions: { 
      page: PageStates.ADMIN_PROJECT_EDITOR,
      entity: { project: EntityStates.PROJECT_PLANNING }
    },
    priority: 9,
  },
  
  update_project: {
    id: 'T_UPDATE_PROJECT',
    type: 'update_project',
    name: 'Update Project',
    description: 'Admin updates a portfolio project',
    allowedActors: [ActorStates.ADMIN],
    postconditions: { page: PageStates.ADMIN_PROJECT_EDITOR },
    priority: 8,
  },
  
  delete_project: {
    id: 'T_DELETE_PROJECT',
    type: 'delete_project',
    name: 'Delete Project',
    description: 'Admin deletes a portfolio project',
    allowedActors: [ActorStates.ADMIN],
    postconditions: { page: PageStates.ADMIN_PROJECTS },
    priority: 7,
  },
  
  add_resume_item: {
    id: 'T_ADD_RESUME_ITEM',
    type: 'add_resume_item',
    name: 'Add Resume Item',
    description: 'Admin adds a new resume item',
    allowedActors: [ActorStates.ADMIN],
    postconditions: { page: PageStates.ADMIN_RESUME },
    priority: 8,
  },
  
  update_resume_item: {
    id: 'T_UPDATE_RESUME_ITEM',
    type: 'update_resume_item',
    name: 'Update Resume Item',
    description: 'Admin updates a resume item',
    allowedActors: [ActorStates.ADMIN],
    postconditions: { page: PageStates.ADMIN_RESUME },
    priority: 7,
  },
  
  delete_resume_item: {
    id: 'T_DELETE_RESUME_ITEM',
    type: 'delete_resume_item',
    name: 'Delete Resume Item',
    description: 'Admin deletes a resume item',
    allowedActors: [ActorStates.ADMIN],
    postconditions: { page: PageStates.ADMIN_RESUME },
    priority: 7,
  },
  
  '403_error': {
    id: 'T_403_ERROR',
    type: '403_error',
    name: '403 Forbidden',
    description: 'Access denied to resource',
    allowedActors: [ActorStates.ANONYMOUS, ActorStates.USER],
    postconditions: {},
    priority: 5,
  },
  
  '404_error': {
    id: 'T_404_ERROR',
    type: '404_error',
    name: '404 Not Found',
    description: 'Resource not found',
    allowedActors: [ActorStates.ANONYMOUS, ActorStates.USER, ActorStates.ADMIN],
    postconditions: {},
    priority: 5,
  },
  
  reload: {
    id: 'T_RELOAD',
    type: 'reload',
    name: 'Page Reload',
    description: 'Reload current page',
    allowedActors: [ActorStates.ANONYMOUS, ActorStates.USER, ActorStates.ADMIN],
    postconditions: {},
    priority: 5,
  },
};

/** All transitions as a list */
export const TransitionList = Object.values(Transitions);

/**
 * Get all transitions available for a specific actor type
 * @param actor - The actor state
 * @returns Array of transitions the actor can perform
 */
export function getTransitionsByActor(
  actor: typeof ActorStates[keyof typeof ActorStates]
): Transition[] {
  return TransitionList.filter(t => t.allowedActors.includes(actor));
}

/**
 * Get transition by ID
 * @param id - Transition ID
 * @returns Transition or undefined if not found
 */
export function getTransitionById(id: string): Transition | undefined {
  return TransitionList.find(t => t.id === id);
}
