# FSM Analysis from Agent Survey (baseline for diff)

This file contains the FSM states and transitions extracted by 5 parallel agents reading the source code.
It is the **baseline** to be diffed against mechanical extraction.

---

## AUTH SUBSYSTEM (agent: a0151b5a52a3b6f0b)

### States (auth dimension)
```
SA0: anonymous (no cookies, no session, isLoading=false)
SA1: authenticated-user (valid session, role=user)
SA2: authenticated-admin (valid session, role=admin)
SA3: loading (auth store resolving — initial mount or rehydration in progress)
SA4: oauth-redirect (browser at GitHub OAuth consent screen)
SA5: oauth-callback (browser on /auth/callback, calling /auth/me to verify cookies)
```

### Transitions (auth)
```
TA1:  SA0 → SA0 (visit /login page — no session, stays anonymous)
TA2:  SA0 → SA0 (browse any public page — /, /blog, /projects, /resume)
TA3:  SA0 → SA0 (visit /admin → ProtectedRoute/AdminRoute detects !isAuthenticated → redirect to /login)
TA4:  SA0 → SA0 (call /auth/me with _skipAuthRedirect → 401, stays anonymous)
TA5:  SA0 → SA0 (call /api/admin/* → backend returns 401 or 403)
TA6:  SA0 → SA4 (click "Continue with GitHub" → authAPI.login() → window.location.href to /api/auth/github → backend redirects to GitHub OAuth)
TA7:  SA4 → SA5 (GitHub redirects back to /api/auth/github/callback with code+state → backend validates state, exchanges code, upserts user, sets access_token+refresh_token+csrf_token cookies, redirects to frontend /auth/callback)
TA8:  SA4 → SA0 (user denies OAuth consent or GitHub returns error → no cookies set → user remains anonymous)
TA9:  SA5 → SA1 (AuthCallback calls authAPI.me() → 200 with role=user → setUser → navigate to redirectPath)
TA10: SA5 → SA2 (AuthCallback calls authAPI.me() → 200 with role=admin → setUser → navigate to redirectPath)
TA11: SA5 → SA0 (AuthCallback calls authAPI.me() → fails → setError, setTimeout redirect to /login)
TA12: SA0 → SA3 (fresh page load / new tab — auth store rehydration starts, onRehydrateStorage fires, isLoading=true)
TA13: SA3 → SA0 (rehydration finds no sessionStorage auth-storage, calls /auth/me with _skipAuthRedirect → 401 → setUser(null), setLoading(false))
TA14: SA3 → SA1 (rehydration calls /auth/me → 200 with role=user → setUser, setLoading(false))
TA15: SA3 → SA2 (rehydration calls /auth/me → 200 with role=admin → setUser, setLoading(false))
TA16: SA1 → SA1 (rehydration finds sessionStorage auth-storage with isAuthenticated=true, role=user → skip /auth/me, setLoading(false))
TA17: SA2 → SA2 (rehydration finds sessionStorage auth-storage with isAuthenticated=true, role=admin → skip /auth/me, setLoading(false))
TA18: SA1 → SA0 (logout: POST /auth/logout, then set({user:null, isAuthenticated:false}))
TA19: SA2 → SA0 (logout: POST /auth/logout, then set({user:null, isAuthenticated:false}))
TA20: SA2 → SA2 (access token expires: next API call returns 401 → axios interceptor fires RefreshToken → new access_token set → original request retried)
TA21: SA2 → SA0 (access token expires + refresh token expired: RefreshToken → 401 → interceptor clears state, redirects to /login)
TA22: SA1 → SA0 (access token expires + refresh token expired: same as TA21 for user role)
TA23: SA2 → SA0 (access token cleared manually (test), page reload, /auth/me returns 401 after failed refresh)
TA24: SA1 → SA2 (impossible in prod: role cannot escalate without re-login)
TA25: SA0 → SA0 (CSRF token missing on state-mutating request → backend rejects with 403)
TA26: SA1 → SA1 (CSRF token valid, API call succeeds)
TA27: SA2 → SA2 (CSRF token valid, admin API call succeeds)
TA28: SA1 → SA1 (ProtectedRoute mount: isAuthenticated=true → renders children immediately)
TA29: SA2 → SA2 (AdminRoute mount: isAuthenticated=true, role=admin → renders children immediately)
TA30: SA0 → SA3 (ProtectedRoute/AdminRoute mount: isAuthenticated=false, isLoading=true → calls /auth/me)
TA31: SA3 → SA1 (ProtectedRoute: /auth/me → 200 role=user → setUser → renders protected page)
TA32: SA3 → SA2 (AdminRoute: /auth/me → 200 role=admin → setUser → renders admin page)
TA33: SA3 → SA0 (ProtectedRoute: /auth/me → 401 → setLoading(false) → redirect to /login)
TA34: SA3 → SA0 (AdminRoute: /auth/me → 200 with role!=admin → navigate to /)
TA35: SA2 → SA0 (AdminRoute: /auth/me → 200 with role!=admin → navigate to /)
TA36: SA0 → SA0 (POST /api/auth/logout → backend clears cookies → 200, user already anonymous)
TA37: SA1 → SA1 (GET /api/admin/* by user role → 403 Forbidden)
TA38: SA2 → SA2 (GET /api/admin/* by admin role → 200 OK)
TA39: SA2 → SA2 (refresh token rotation: old blocklisted, new issued, new cookies set)
TA40: SA2 → SA0 (refresh token revoked: POST /auth/refresh → 401 "Refresh token has been revoked")
TA41: SA1 → SA1 (POST /comments with authenticated user → 201, stays authenticated)
TA42: SA0 → SA0 (anonymous user attempts POST /comments → AuthRequired returns 401)
TA43: SA1 → SA0 (POST /auth/refresh with revoked token → 401)
TA44: SA2 → SA0 (POST /auth/refresh with invalid token → 401)
TA45: SA2 → SA2 (ProtectedRoute mount: isAuthenticated=true → renders immediately)
TA46: SA2 → SA2 (AdminRoute mount: isAuthenticated=true, role=admin → renders immediately)
TA47: SA2 → SA3 (ProtectedRoute/AdminRoute mount: isAuthenticated=false → calls /auth/me)
TA48: SA2 → SA0 (AdminRoute: /auth/me returns non-admin user → navigate to /)
TA49: SA2 → SA2 (token refresh rotation)
TA50: SA0 → SA0 (POST /auth/refresh with no refresh_token cookie → 401)
TA51: SA2 → SA0 (POST /auth/refresh Origin check fails → 403)
TA52: SA0 → SA1 (TEST_MODE: POST /api/auth/test-login role=user)
TA53: SA0 → SA2 (TEST_MODE: POST /api/auth/test-login role=admin)
```

---

## NAVIGATION SUBSYSTEM (agent: a6975dbea2b6ab64d)

### States (page dimension)
```
SP0:  page-home
SP1:  page-blog
SP2:  page-blog-post (with slug)
SP3:  page-portfolio
SP4:  page-portfolio-detail (with id)
SP5:  page-resume
SP6:  page-login
SP7:  page-auth-callback (transient)
SP8:  page-admin-dashboard
SP9:  page-admin-posts
SP10: page-admin-post-editor-new
SP11: page-admin-post-editor-edit
SP12: page-admin-projects
SP13: page-admin-project-editor-new
SP14: page-admin-project-editor-edit
SP15: page-admin-comments
SP16: page-admin-resume
SP17: page-not-found
SM0:  menu-closed-desktop
SM1:  menu-closed-mobile
SM2:  menu-open-mobile
```

### Transitions (navigation)
```
TP1:  SP* -> SP0   (click Home / JUNzi logo)
TP2:  SP* -> SP1   (click Blog in nav)
TP3:  SP* -> SP3   (click Portfolio in nav)
TP4:  SP* -> SP5   (click Resume in nav)
TP5:  SP* -> SP6   (click Login btn, unauthenticated)
TP6:  SP* -> SP8   (click Dashboard in avatar dropdown, admin)
TP7:  SP* -> SP0   (click Log out in avatar dropdown, admin)
TP8:  SP* -> SP0   (click Log out in avatar dropdown, user)
TP9:  SM1 -> SM2   (click hamburger menu button, mobile)
TP10: SM2 -> SM1   (click X / hamburger toggle, mobile)
TP11: SM2 -> SP0   (click Home in mobile nav)
TP12: SM2 -> SP1   (click Blog in mobile nav)
TP13: SM2 -> SP3   (click Portfolio in mobile nav)
TP14: SM2 -> SP5   (click Resume in mobile nav)
TP15: SM2 -> SP6   (click Login btn in mobile nav, unauthenticated)
TP16: SM2 -> SP0   (click Log out in mobile nav, authenticated)
TP17: SP0 -> SP1   (click Blog CTA on home page)
TP18: SP0 -> SP3   (click Portfolio CTA on home page)
TP19: SP1 -> SP2   (click a post card)
TP20: SP2 -> SP1   (click Back to Blog)
TP21: SP2 -> SP1   (click a tag link on blog post)
TP22: SP3 -> SP4   (click a project card)
TP23: SP4 -> SP3   (click Back to Portfolio)
TP24: SP17 -> SP0  (click Go Home on 404 page)
TP25: SP17 -> prev (click Go Back on 404 page)
TP26: SP6 -> SP0   (isAuthenticated=true on mount → redirect to /)
TP27: SP8 -> SP9   (click Manage Posts card)
TP28: SP8 -> SP12  (click Manage Projects card)
TP29: SP8 -> SP15  (click Manage Comments card)
TP30: SP8 -> SP16  (click Edit Resume card)
TP31: SP8 -> SP10  (click New Post CTA card)
TP32: SP9 -> SP10  (click New Post button)
TP33: SP9 -> SP11  (click Edit on a post row)
TP34: SP9 -> SP2   (click Preview on a post row)
TP35: SP10 -> SP9  (click Back to Posts, new)
TP36: SP11 -> SP9  (click Back to Posts, edit)
TP37: SP10 -> SP11 (save new post success → navigate to edit mode)
TP38: SP11 -> SP9  (save edit success → navigate to list)
TP39: SP12 -> SP13 (click New Project button)
TP40: SP12 -> SP14 (click Edit on a project row)
TP41: SP12 -> SP4  (click Preview on a project row)
TP42: SP13 -> SP12 (click Back to Projects, new)
TP43: SP14 -> SP12 (click Back to Projects, edit)
TP44: SP13 -> SP14 (save new project success → navigate to edit)
TP45: SP14 -> SP12 (save edit success → navigate to list)
TP46: SP* -> SP17  (navigate to unknown route)
TP47: SP2 -> SP6   (click Login to comment, unauthenticated)
```

---

## ADMIN POSTS SUBSYSTEM (agent: a797ba0b5355ae136)

### States
```
SP-ADM0: posts-list-loading
SP-ADM1: posts-list (with data)
SP-ADM2: posts-list (empty state)
SP-ADM3: post-editor-new (blank form)
SP-ADM4: post-editor-edit (pre-filled)
SP-ADM5: post-editor-loading
SP-ADM6: post-editor-saving
SP-ADM7: post-editor-saved (success)
SP-ADM8: post-editor-error (save failed)
SP-ADM9: post-delete-confirm-dialog
SP-ADM10: post-delete-in-flight
SP-ADM11: post-deleted
SP-ADM12: post-delete-error
SP-ADM13: tags-selector-open
SP-ADM14: post-editor-cover-uploading
SP-ADM15: post-editor-cover-uploaded
SP-ADM16: post-editor-cover-error
```

### Transitions (admin-posts)
```
TP-ADM1:  SP-ADM2 -> SP-ADM3  (click Create your first post CTA, empty state)
TP-ADM2:  SP-ADM1 -> SP-ADM3  (navigate to /admin/posts/new)
TP-ADM3:  SP-ADM1 -> SP-ADM4  (click Edit on a post row)
TP-ADM4:  SP-ADM3 -> SP-ADM6  (click Save Post - new)
TP-ADM5:  SP-ADM4 -> SP-ADM6  (click Save Post - edit)
TP-ADM6:  SP-ADM6 -> SP-ADM7  (save success)
TP-ADM7:  SP-ADM6 -> SP-ADM8  (save error)
TP-ADM8: