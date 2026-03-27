# API Contract v1.0

**Last Updated**: 2026-03-27
**Status**: approved

---

## Authentication

### OAuth Flow

**Flow**: Frontend → Backend → GitHub → Backend → Frontend

1. `GET /api/auth/github` - Redirects to GitHub OAuth
2. GitHub redirects to `GET /api/auth/github/callback?code=xxx&state=xxx`
3. Backend validates state, exchanges code, creates/updates user, sets HttpOnly cookies
4. Backend redirects to `GET /auth/callback` (frontend route)
5. Frontend calls `GET /api/auth/me` to get user info

### GET /api/auth/me

**Authentication**: Cookie (access_token)

**Response**:
```json
{
  "user": {
    "id": 1,
    "github_id": "12345",
    "username": "octocat",
    "email": "octocat@example.com",
    "avatar_url": "https://...",
    "bio": "...",
    "role": "user",
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z"
  }
}
```

### POST /api/auth/logout

**Response**:
```json
{
  "message": "Logged out successfully"
}
```

---

## Posts

### GET /api/posts

**Query Parameters**:
- `page` (int, default: 1)
- `limit` (int, default: 10)
- `tag` (string, optional)
- `search` (string, optional)

**Response**:
```json
{
  "posts": [...],
  "total": 100,
  "page": 1,
  "limit": 10
}
```

### GET /api/posts/:slug

**Response**:
```json
{
  "post": {
    "id": 1,
    "title": "...",
    "slug": "...",
    "content": "...",
    "summary": "...",
    "cover_image": "...",
    "status": "published",
    "view_count": 100,
    "author": {...},
    "category": {...},
    "tags": [...],
    "created_at": "...",
    "updated_at": "..."
  }
}
```

### POST /api/admin/posts (Admin)

**Request Body**:
```json
{
  "title": "...",
  "slug": "...",
  "content": "...",
  "summary": "...",
  "cover_image": "...",
  "status": "draft",
  "category_id": 1,
  "tag_ids": [1, 2, 3]
}
```

**Response**:
```json
{
  "post": {...}
}
```

### PUT /api/admin/posts/:id (Admin)

Same as POST.

### DELETE /api/admin/posts/:id (Admin)

**Response**:
```json
{
  "message": "Post deleted successfully"
}
```

---

## Projects

### GET /api/projects

**Query Parameters**:
- `page` (int, default: 1)
- `limit` (int, default: 10)
- `featured` (bool, optional)

**Response**:
```json
{
  "projects": [
    {
      "id": 1,
      "title": "...",
      "description": "...",
      "cover_image": "...",
      "demo_url": "...",
      "github_url": "...",
      "tech_stack": "[\"React\", \"Go\"]",
      "sort_order": 0
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 10
}
```

### GET /api/projects/:id

Note: Use `id` not `slug` for now. Frontend should adapt.

**Response**:
```json
{
  "project": {
    "id": 1,
    "title": "...",
    "description": "...",
    "content": "...",
    "cover_image": "...",
    "demo_url": "...",
    "github_url": "...",
    "tech_stack": "[\"React\", \"Go\"]",
    "sort_order": 0
  }
}
```

### POST /api/admin/projects (Admin)

**Request Body**:
```json
{
  "title": "...",
  "description": "...",
  "content": "...",
  "cover_image": "...",
  "demo_url": "...",
  "github_url": "...",
  "tech_stack": "[\"React\", \"Go\"]",
  "sort_order": 0
}
```

---

## Comments

### GET /api/posts/:slug/comments

**Response**:
```json
{
  "comments": [
    {
      "id": 1,
      "content": "...",
      "user": {...},
      "parent_id": null,
      "replies": [...],
      "created_at": "..."
    }
  ]
}
```

### POST /api/comments (Authenticated)

**Request Body**:
```json
{
  "content": "...",
  "post_id": 1,
  "parent_id": null
}
```

**Response**:
```json
{
  "comment": {...}
}
```

---

## Resume

### GET /api/resume

**Response**:
```json
{
  "items": [
    {
      "id": 1,
      "title": "Software Engineer",
      "company": "Tech Corp",
      "location": "San Francisco",
      "start_date": "2020-01-01",
      "end_date": null,
      "description": "...",
      "type": "work",
      "sort_order": 0
    }
  ]
}
```

---

## Upload

### POST /api/admin/upload/image (Admin)

**Content-Type**: `multipart/form-data`

**Field Name**: `file` (changed from `image` for consistency)

**Response**:
```json
{
  "message": "Image uploaded successfully",
  "url": "https://...",
  "filename": "...",
  "size": 12345
}
```

---

## Tags

### GET /api/tags

**Response**:
```json
{
  "tags": [
    {
      "id": 1,
      "name": "React",
      "slug": "react"
    }
  ]
}
```

---

## Field Naming Convention

**Backend**: snake_case JSON tags
**Frontend**: Use snake_case to match backend (no camelCase transformation)

---

## Error Response Format

```json
{
  "error": "Error message"
}
```

---

## Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-03-27 | Initial API contract | team-lead |