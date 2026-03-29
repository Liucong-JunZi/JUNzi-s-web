# Mechanical Extraction Results

## Frontend Routes (19 total)

R1:  /                        Home             auth=none
R2:  /blog                    Blog             auth=none
R3:  /blog/:slug              BlogPost         auth=none
R4:  /portfolio               Portfolio        auth=none
R5:  /portfolio/:id           PortfolioDetail  auth=none
R6:  /resume                  Resume           auth=none
R7:  /login                   Login            auth=none
R8:  /auth/callback           AuthCallback     auth=none
R9:  /admin                   Dashboard        auth=admin
R10: /admin/posts             AdminPosts       auth=admin
R11: /admin/posts/new         PostEditor(new)  auth=admin
R12: /admin/posts/:id         PostEditor(edit) auth=admin
R13: /admin/projects          AdminProjects    auth=admin
R14: /admin/projects/new      ProjectEditor(new) auth=admin
R15: /admin/projects/:id      ProjectEditor(edit) auth=admin
R16: /admin/comments          AdminComments    auth=admin
R17: /admin/resume            AdminResume      auth=admin
R18: *                        NotFound         auth=none

## Backend Endpoints (48 total)

PUBLIC:
E1:  GET    /api/health
E2:  GET    /api/posts
E3:  GET    /api/posts/:slug
E4:  POST   /api/posts/:id/like           (no auth, rate limited)
E5:  GET    /api/projects
E6:  GET    /api/projects/:id
E7:  GET    /api/resume
E8:  GET    /api/posts/:slug/comments
E9:  GET    /api/categories
E10: GET    /api/categories/:id
E11: GET    /api/tags
E12: GET    /api/tags/:id
E13: GET    /api/settings/public
E14: POST   /api/auth/test-login          (TEST_MODE only)
E15: GET    /api/auth/github
E16: GET    /api/auth/github/callback
E17: POST   /api/auth/logout              (CSRFProtection)
E18: POST   /api/auth/refresh             (OriginRefererCheck)
E19: GET    /api/auth/me                  (AuthRequired)
E20: POST   /api/comments                 (AuthRequired + CSRFProtection)

ADMIN (all require AuthRequired + AdminRequired + CSRFProtection):
E21: GET    /api/admin/posts/:id
E22: POST   /api/admin/posts
E23: PUT    /api/admin/posts/:id
E24: DELETE /api/admin/posts/:id
E25: GET    /api/admin/posts
E26: GET    /api/admin/projects/:id
E27: POST   /api/admin/projects
E28: PUT    /api/admin/projects/:id
E29: GET    /api/admin/projects
E30: DELETE /api/admin/projects/:id
E31: POST   /api/admin/resume
E32: PUT    /api/admin/resume/:id
E33: DELETE /api/admin/resume/:id
E34: GET    /api/admin/comments
E35: PUT    /api/admin/comments/:id
E36: PUT    /api/admin/comments/:id/status
E37: DELETE /api/admin/comments/:id
E38: POST   /api/admin/categories
E39: PUT    /api/admin/categories/:id
E40: DELETE /api/admin/categories/:id
E41: POST   /api/admin/tags
E42: PUT    /api/admin/tags/:id
E43: DELETE /api/admin/tags/:id
E44: GET    /api/admin/settings
E45: PUT    /api/admin/settings
E46: PUT    /api/admin/settings/:key
E47: POST   /api/admin/upload
E48: POST   /api/admin/upload/image

## Auth Guards

AG1: AdminRoute !isAuthenticated → call /auth/me → fail → redirect /login
AG2: AdminRoute isAuthenticated role!=admin → redirect /
AG3: Login page isAuthenticated on mount → redirect /
AG4: 401 without _skipAuthRedirect → try /auth/refresh → fail → redirect /login
AG5: AuthCallback OAuth success → navigate(redirectPath || /)
AG6: AuthCallback OAuth failure → setTimeout navigate(/login, 2000ms)
AG7: Login ?callback=true → call /auth/me → success → navigate(redirectPath)
AG8: api interceptor refresh queue (concurrent 401s use same refresh promise)

## Public Page Navigation Events (25 total)

NE1:  Home → /blog              trigger=Read Blog button
NE2:  Home → /portfolio         trigger=View Portfolio button
NE3:  Home → /blog              trigger=Read Articles ghost button
NE4:  Home → /portfolio         trigger=View Projects ghost button
NE5:  Home → /resume            trigger=View Resume ghost button
NE6:  Blog → /blog/:slug        trigger=click post card
NE7:  Blog → /blog?tag=X        trigger=click tag badge
NE8:  Blog → /blog page-1       trigger=Previous pagination btn  condition=page>1
NE9:  Blog → /blog page+1       trigger=Next pagination btn       condition=page<total
NE10: BlogPost → /blog          trigger=Back to Blog link
NE11: BlogPost → /login         trigger=Login to comment link     condition=!isAuthenticated
NE12: Portfolio → /portfolio/:id trigger=Details button
NE13: Portfolio → external      trigger=Code button               condition=github_url
NE14: Portfolio → external      trigger=Demo button               condition=demo_url
NE15: PortfolioDetail → /portfolio trigger=Back to Portfolio
NE16: PortfolioDetail → external trigger=View Code button         condition=github_url
NE17: PortfolioDetail → external trigger=Live Demo button         condition=demo_url
NE18: NotFound → /              trigger=Go Home button
NE19: NotFound → prev           trigger=Go Back button
NE20: Login → /                 trigger=mount redirect            condition=isAuthenticated
NE21: Login → redirectPath      trigger=handleCallback success    condition=?callback=true
NE22: Login → /login            trigger=handleCallback failure    condition=?callback=true
NE23: Login → GitHub OAuth      trigger=Continue with GitHub btn
NE24: AuthCallback → redirectPath trigger=me() success
NE25: AuthCallback → /login     trigger=me() failure + 2s delay

## Admin Page Navigation Events (21 total)

ANE1:  Dashboard → /admin/posts/new      trigger=Create Post quick-action card
ANE2:  Dashboard → /admin/projects/new   trigger=Add Project quick-action card
ANE3:  Dashboard → /admin/resume         trigger=Edit Resume quick-action card
ANE4:  Dashboard → /admin/posts          trigger=Manage Posts nav-card
ANE5:  Dashboard → /admin/projects       trigger=Manage Projects nav-card
ANE6:  Dashboard → /admin/comments       trigger=Manage Comments nav-card
ANE7:  Dashboard → /admin/resume         trigger=Edit Resume nav-card
ANE8:  AdminPosts → /admin/posts/new     trigger=New Post button
ANE9:  AdminPosts → /admin/posts/new     trigger=Create first post (empty state)
ANE10: AdminPosts → /blog/:slug          trigger=Preview button  target=_blank
ANE11: AdminPosts → /admin/posts/:id     trigger=Edit button
ANE12: PostEditor → /admin/posts         trigger=Back to Posts link
ANE13: PostEditor → /admin/posts/:newId  trigger=save success (new)
ANE14: PostEditor → /admin/posts         trigger=save success (edit)
ANE15: AdminProjects → /admin/projects/new trigger=New Project button
ANE16: AdminProjects → /portfolio/:id    trigger=Preview button  target=_blank
ANE17: AdminProjects → /admin/projects/:id trigger=Edit button
ANE18: ProjectEditor → /admin/projects   trigger=Back to Projects
ANE19: ProjectEditor → /admin/projects/:newId trigger=save success (new)
ANE20: ProjectEditor → /admin/projects   trigger=save success (edit)
ANE21: AdminComments → /blog/:slug       trigger=View Post link

## Form/Mutation Events (18 total)

ME1:  PostEditor      handleSubmit      POST /api/admin/posts           condition=new
ME2:  PostEditor      handleSubmit      PUT  /api/admin/posts/:id        condition=edit
ME3:  PostEditor      handleImageUpload POST /api/admin/upload/image
ME4:  AdminPosts      handleDelete      DELETE /api/admin/posts/:id      condition=confirm
ME5:  BlogPost        handleLike        POST /api/posts/:id/like         (no auth)
ME6:  ProjectEditor   handleSubmit      POST /api/admin/projects         condition=new
ME7:  ProjectEditor   handleSubmit      PUT  /api/admin/projects/:id     condition=edit
ME8:  ProjectEditor   handleImageUpload POST /api/admin/upload/image
ME9:  AdminProjects   handleDelete      DELETE /api/admin/projects/:id   condition=confirm
ME10: AdminComments   handleApprove     PUT /api/admin/comments/:id/status status=approved
ME11: AdminComments   handleReject      PUT /api/admin/comments/:id/status status=rejected
ME12: AdminComments   handleDelete      DELETE /api/admin/comments/:id   condition=confirm
ME13: AdminResume     handleSubmit      POST /api/admin/resume           condition=new
ME14: AdminResume     handleSubmit      PUT  /api/admin/resume/:id       condition=edit
ME15: AdminResume     handleDelete      DELETE /api/admin/resume/:id     condition=confirm
ME16: BlogPost        handleSubmitComment POST /api/comments             auth=user/admin
ME17: authStore       logout            POST /api/auth/logout
ME18: api interceptor token refresh     POST /api/auth/refresh           automatic

## Blog/Comment UI Events

UI1:  Blog search input change → updates searchQuery state
UI2:  Blog search submit → GET /api/posts?search=X
UI3:  Blog clear tag filter → GET /api/posts (no tag)
UI4:  BlogPost like button → POST /api/posts/:id/like → update like_count
UI5:  BlogPost load more comments → GET /api/comments?page=N
UI6:  BlogPost comment textarea → updates commentText state

## Header/Resume UI Events

UI7:  Header theme toggle → cycle light→dark→system
UI8:  Header hamburger click → open mobile menu
UI9:  Header X click → close mobile menu
UI10: Header mobile nav link click → navigate + close menu
UI11: Header avatar dropdown → open (authenticated)
UI12: Header Dashboard menu item → /admin (admin only)
UI13: Header Log out menu item → logout()
UI14: Header mobile Logout button → logout()
UI15: Resume Download button → generate markdown, trigger download
UI16: AdminResume Edit item → populate form, set editingId
UI17: AdminResume Cancel edit → reset form
UI18: AdminResume Delete confirm → DELETE /api/admin/resume/:id

## GAPS vs Original FSM Analysis

GAP1: POST /api/posts/:id/like not modeled (BlogPost like state)
GAP2: Blog search/filter/pagination states not modeled
GAP3: Resume download action not modeled
GAP4: AdminResume has POST+DELETE (not just PUT)
GAP5: Dashboard has 3 extra quick-action cards (Create Post, Add Project, Edit Resume)
GAP6: AdminComments ViewPost link → /blog/:slug
GAP7: Portfolio/PortfolioDetail external links (github/demo)
GAP8: Header theme 3-way cycle (light/dark/system)
GAP9: Login ?callback=true OAuth handler separate from AuthCallback
GAP10: Blog tag filter via URL param (?tag=X)
GAP11: POST /api/admin/upload/image (cover image)
GAP12: Categories/Tags/Settings admin API exists but no frontend UI
GAP13: AuthRequired role fetched from DB on each request (not from JWT)
GAP14: csrf_token is NOT httpOnly (readable by JS, intentional for CSRF header)
GAP15: Logout always clears cookies regardless of token validity
