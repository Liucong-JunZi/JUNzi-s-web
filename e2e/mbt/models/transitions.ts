import { ActorStates } from './stateMachine';

export enum TransitionType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  VIEW_POST = 'view_post',
  CREATE_POST = 'create_post',
  UPDATE_POST = 'update_post',
  DELETE_POST = 'delete_post',
  LIKE = 'like',
  UNLIKE = 'unlike',
  SUBMIT_COMMENT = 'submit_comment',
  APPROVE_COMMENT = 'approve_comment',
  REJECT_COMMENT = 'reject_comment',
  VIEW_PROFILE = 'view_profile',
  EDIT_PROFILE = 'edit_profile',
  NAVIGATE = 'navigate',
}

export interface Transition {
  id: string;
  name: string;
  type: TransitionType;
  description: string;
  allowedActors: typeof ActorStates[keyof typeof ActorStates][];
  preconditions: string[];
  postconditions: string[];
}

export const TransitionList: Transition[] = [
  {
    id: 'login',
    name: 'User Login',
    type: TransitionType.LOGIN,
    description: 'User authenticates via GitHub OAuth',
    allowedActors: [ActorStates.ANONYMOUS],
    preconditions: ['Not authenticated'],
    postconditions: ['User is authenticated'],
  },
  {
    id: 'logout',
    name: 'User Logout',
    type: TransitionType.LOGOUT,
    description: 'User logs out of the system',
    allowedActors: [ActorStates.USER, ActorStates.ADMIN],
    preconditions: ['User is authenticated'],
    postconditions: ['User is not authenticated'],
  },
  {
    id: 'view_post',
    name: 'View Post',
    type: TransitionType.VIEW_POST,
    description: 'Navigate to and view a blog post',
    allowedActors: [ActorStates.ANONYMOUS, ActorStates.USER, ActorStates.ADMIN],
    preconditions: ['Post exists'],
    postconditions: ['Post content is visible'],
  },
  {
    id: 'create_post',
    name: 'Create Post',
    type: TransitionType.CREATE_POST,
    description: 'Create a new blog post',
    allowedActors: [ActorStates.ADMIN],
    preconditions: ['User is admin'],
    postconditions: ['New post is created'],
  },
  {
    id: 'update_post',
    name: 'Update Post',
    type: TransitionType.UPDATE_POST,
    description: 'Update an existing blog post',
    allowedActors: [ActorStates.ADMIN],
    preconditions: ['User is admin', 'Post exists'],
    postconditions: ['Post is updated'],
  },
  {
    id: 'delete_post',
    name: 'Delete Post',
    type: TransitionType.DELETE_POST,
    description: 'Delete a blog post',
    allowedActors: [ActorStates.ADMIN],
    preconditions: ['User is admin', 'Post exists'],
    postconditions: ['Post is deleted'],
  },
  {
    id: 'like',
    name: 'Like Post',
    type: TransitionType.LIKE,
    description: 'Like a blog post',
    allowedActors: [ActorStates.USER, ActorStates.ADMIN],
    preconditions: ['User is authenticated', 'Post exists'],
    postconditions: ['Post like count increases'],
  },
  {
    id: 'unlike',
    name: 'Unlike Post',
    type: TransitionType.UNLIKE,
    description: 'Remove like from a blog post',
    allowedActors: [ActorStates.USER, ActorStates.ADMIN],
    preconditions: ['User is authenticated', 'Post is liked'],
    postconditions: ['Post like count decreases'],
  },
  {
    id: 'submit_comment',
    name: 'Submit Comment',
    type: TransitionType.SUBMIT_COMMENT,
    description: 'Submit a comment on a post',
    allowedActors: [ActorStates.USER, ActorStates.ADMIN],
    preconditions: ['User is authenticated', 'Post exists'],
    postconditions: ['Comment is submitted'],
  },
  {
    id: 'approve_comment',
    name: 'Approve Comment',
    type: TransitionType.APPROVE_COMMENT,
    description: 'Approve a submitted comment',
    allowedActors: [ActorStates.ADMIN],
    preconditions: ['User is admin', 'Comment exists'],
    postconditions: ['Comment is approved'],
  },
  {
    id: 'reject_comment',
    name: 'Reject Comment',
    type: TransitionType.REJECT_COMMENT,
    description: 'Reject a submitted comment',
    allowedActors: [ActorStates.ADMIN],
    preconditions: ['User is admin', 'Comment exists'],
    postconditions: ['Comment is rejected'],
  },
  {
    id: 'view_profile',
    name: 'View Profile',
    type: TransitionType.VIEW_PROFILE,
    description: 'View user profile',
    allowedActors: [ActorStates.ANONYMOUS, ActorStates.USER, ActorStates.ADMIN],
    preconditions: [],
    postconditions: ['Profile is visible'],
  },
  {
    id: 'edit_profile',
    name: 'Edit Profile',
    type: TransitionType.EDIT_PROFILE,
    description: 'Edit user profile information',
    allowedActors: [ActorStates.USER, ActorStates.ADMIN],
    preconditions: ['User is authenticated'],
    postconditions: ['Profile is updated'],
  },
  {
    id: 'navigate',
    name: 'Navigate',
    type: TransitionType.NAVIGATE,
    description: 'Navigate between pages',
    allowedActors: [ActorStates.ANONYMOUS, ActorStates.USER, ActorStates.ADMIN],
    preconditions: [],
    postconditions: ['Page changes'],
  },
];

export function getTransitionById(id: string): Transition | undefined {
  return TransitionList.find(t => t.id === id);
}

export function getTransitionsByActor(actor: typeof ActorStates[keyof typeof ActorStates]): Transition[] {
  return TransitionList.filter(t => t.allowedActors.includes(actor));
}
