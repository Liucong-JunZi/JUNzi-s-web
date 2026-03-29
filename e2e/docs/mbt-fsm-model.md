# MBT FSM Model & TPC Test Plan

**Generated**: 2026-03-30
**Source files**: mechanical-extraction.md + fsm-agent-analysis.md
**Method**: Model-Based Testing — Transition-Pair Coverage (TPC)

---

## 1. COMPLETE FSM STATE SPACE

### 1.1 Auth Dimension (SA)

```
SA0: anonymous          (no cookies, no session, isLoading=false)
SA1: authenticated-user (valid session, role=user)
SA2: authenticated-admin(valid session, role=admin)
SA3: auth-loading       (rehydration/guard check in progress)
SA4: oauth-redirect     (browser at GitHub OAuth consent screen)
SA5: oauth-callback     (browser on /auth/callback, calling /auth/me)
```

### 1.2 Page Dimension (SP)

```
SP0:  page-home
SP1:  page-blog              (/blog, includes search/tag/pagination substates)
SP2:  page-blog-post         (/blog/:slug)
SP3:  page-portfolio         (/portfolio)
SP4:  page-portfolio-detail  (/portfolio/:id)
SP5:  page-resume            (/resume)
SP6:  page-login             (/login)
SP7:  page-auth-callback     (/auth/callback, transient)
SP8:  page-admin-dashboard   (/admin)
SP9:  page-admin-posts       (/admin/posts)
SP10: page-admin-post-editor-new  (/admin/posts/new)
SP11: page-admin-post-editor-edit (/admin/posts/:id)
SP12: page-admin-projects    (/admin/projects)
SP13: page-admin-project-editor-new  (/admin/projects/new)
SP14: page-admin-project-editor-edit (/admin/projects/:id)
SP15: page-admin-comments    (/admin/comments)
SP16: page-admin-resume      (/admin/resume)
SP17: page-not-found         (* unmatched route)
```

### 1.3 UI Sub-States

```
SM0:  menu-closed-desktop
SM1:  menu-closed-mobile
SM2:  menu-open-mobile

SB1:  blog-idle             (no search, no tag filter)
SB2:  blog-searching        (search query entered)
SB3:  blog-tag-filtered     (?tag=X in URL)
SB4:  blog-paginated        (page > 1)

SC1:  blogpost-comments-loading
SC2:  blogpost-comments-loaded
SC3:  blogpost-commenting   (textarea active, authenticated)
SC4:  blogpost-comment-submitting
SC5:  blogpost-comment-submitted
SC6:  blogpost-liked        (after like action)
```

### 1.4 Admin Sub-States

```
SPA1: admin-posts-list-loading
SPA2: admin-posts-list-data
SPA3: admin-posts-list-empty
SPA4: post-editor-new
SPA5: post-editor-edit
SPA6: post-editor-saving
SPA7: post-editor-saved
SPA8: post-editor-error
SPA9: post-delete-confirm
SPA10: post-delete-in-flight
SPA11: post-deleted
SPA12: post-delete-error
SPA13: post-editor-cover-uploading
SPA14: post-editor-cover-uploaded
SPA15: post-editor-cover-error

SPR1: admin-projects-list-loading
SPR2: admin-projects-list-data
SPR3: admin-projects-list-empty
SPR4: project-editor-new
SPR5: project-editor-edit
SPR6: project-editor-saving
SPR7: project-editor-saved
SPR8: project-editor-error
SPR9: project-delete-confirm
SPR10: project-delete-in-flight
SPR11: project-deleted
SPR12: project-delete-error

SCM1: admin-comments-loading
SCM2: admin-comments-loaded
SCM3: comment-approve-in-flight
SCM4: comment-reject-in-flight
SCM5: comment-delete-confirm
SCM6: comment-delete-in-flight

SRM1: admin-resume-idle
SRM2: admin-resume-editing
SRM3: admin-resume-saving
SRM4: admin-resume-deleting
```

---

## 2. COMPLETE TRANSITION CATALOGUE (T1..T120)

### 2.1 Auth Transitions (T1–T53)

```
T1:  SA0 --[visit /login, no session]--> SA0
T2:  SA0 --[browse public page /, /blog, /projects, /resume]--> SA0
T3:  SA0 --[visit /admin, not authenticated → redirect /login]--> SA0
T4:  SA0 --[GET /auth/me _skipAuthRedirect → 401]--> SA0
T5:  SA0 --[GET /api/admin/* → 401/403]--> SA0
T6:  SA0 --[click Continue with GitHub]--> SA4
T7:  SA4 --[GitHub callback with code+state → cookies set → redirect /auth/callback]--> SA5
T8:  SA4 --[user denies OAuth / GitHub error → no cookies]--> SA0
T9:  SA5 --[authAPI.me() → 200 role=user → setUser → navigate redirectPath]--> SA1
T10: SA5 --[authAPI.me() → 200 role=admin → setUser → navigate redirectPath]--> SA2
T11: SA5 --[authAPI.me() → fails → setTimeout redirect /login]--> SA0
T12: SA0 --[fresh page load → rehydration starts, isLoading=true]--> SA3
T13: SA3 --[no sessionStorage, /auth/me 401 → setUser(null), setLoading(false)]--> SA0
T14: SA3 --[/auth/me → 200 role=user → setUser, setLoading(false)]--> SA1
T15: SA3 --[/auth/me → 200 role=admin → setUser, setLoading(false)]--> SA2
T16: SA1 --[sessionStorage has isAuthenticated=true role=user → skip /auth/me]--> SA1
T17: SA2 --[sessionStorage has isAuthenticated=true role=admin → skip /auth/me]--> SA2
T18: SA1 --[logout: POST /auth/logout → setUser(null)]--> SA0
T19: SA2 --[logout: POST /auth/logout → setUser(null)]--> SA0
T20: SA2 --[access token expires, refresh succeeds → token rotated]--> SA2
T21: SA2 --[access token expires, refresh 401 → redirect /login]--> SA0
T22: SA1 --[access token expires, refresh 401 → redirect /login]--> SA0
T23: SA2 --[page reload, /auth/me 401 after failed refresh]--> SA0
T24: SA0 --[CSRF token missing → 403, stays anonymous]--> SA0
T25: SA1 --[CSRF valid, API call succeeds]--> SA1
T26: SA2 --[CSRF valid, admin API call succeeds]--> SA2
T27: SA1 --[ProtectedRoute: isAuthenticated=true → renders children]--> SA1
T28: SA2 --[AdminRoute: isAuthenticated=true role=admin → renders children]--> SA2
T29: SA0 --[ProtectedRoute/AdminRoute: isLoading=true → calls /auth/me]--> SA3
T30: SA3 --[ProtectedRoute: /auth/me 200 role=user → render protected page]--> SA1
T31: SA3 --[AdminRoute: /auth/me 200 role=admin → render admin page]--> SA2
T32: SA3 --[ProtectedRoute: /auth/me 401 → redirect /login]--> SA0
T33: SA3 --[AdminRoute: /auth/me 200 role!=admin → navigate /]--> SA0
T34: SA2 --[AdminRoute: /auth/me 200 role!=admin → navigate /]--> SA0
T35: SA0 --[POST /auth/logout (already anonymous) → 200, no state change]--> SA0
T36: SA1 --[GET /api/admin/* by user role → 403 Forbidden]--> SA1
T37: SA2 --[GET /api/admin/* by admin → 200 OK]--> SA2
T38: SA2 --[refresh token rotation on valid refresh]--> SA2
T39: SA0 --[POST /auth/refresh no cookie → 401]--> SA0
T40: SA2 --[POST /auth/refresh Origin check fails → 403]--> SA0
T41: SA0 --[TEST_MODE: POST /api/auth/test-login role=user]--> SA1
T42: SA0 --[TEST_MODE: POST /api/auth/test-login role=admin]--> SA2
T43: SA6 --[Login ?callback=true: GET /auth/me success → navigate redirectPath]--> SA1
T44: SA6 --[Login ?callback=true: GET /auth/me failure → stay on /login]--> SA0
T45: SA1 --[Login page mounted: isAuthenticated=true → redirect /]--> SA1
T46: SA2 --[Login page mounted: isAuthenticated=true → redirect /]--> SA2
```

### 2.2 Page Navigation Transitions (T47–T100)

```
T47: SP* --[click Home/logo]--> SP0
T48: SP* --[click Blog in nav]--> SP1
T49: SP* --[click Portfolio in nav]--> SP3
T50: SP* --[click Resume in nav]--> SP5
T51: SP* --[click Login btn, SA0]--> SP6
T52: SP* --[click Dashboard in avatar dropdown, SA2]--> SP8
T53: SP* --[click Log out, SA1 or SA2]--> SP0
T54: SM1 --[click hamburger button, mobile]--> SM2
T55: SM2 --[click X / toggle, mobile]--> SM1
T56: SM2 --[click Home in mobile nav]--> SP0
T57: SM2 --[click Blog in mobile nav]--> SP1
T58: SM2 --[click Portfolio in mobile nav]--> SP3
T59: SM2 --[click Resume in mobile nav]--> SP5
T60: SM2 --[click Login in mobile nav, SA0]--> SP6
T61: SM2 --[click Log out in mobile nav, authenticated]--> SP0
T62: SP0 --[click Blog CTA button]--> SP1
T63: SP0 --[click Portfolio CTA button]--> SP3
T64: SP0 --[click View Resume ghost button]--> SP5
T65: SP1 --[click post card]--> SP2
T66: SP1 --[click tag badge → ?tag=X]--> SB3
T67: SP1 --[search submit → ?search=X]--> SB2
T68: SP1 --[click Next pagination]--> SB4
T69: SB3 --[clear tag filter]--> SB1
T70: SB2 --[clear search]--> SB1
T71: SP2 --[click Back to Blog]--> SP1
T72: SP2 --[click tag link on post]--> SB3
T73: SP2 --[click Login to comment, SA0]--> SP6
T74: SP2 --[like button, POST /api/posts/:id/like]--> SC6
T75: SP3 --[click project card Details button]--> SP4
T76: SP4 --[click Back to Portfolio]--> SP3
T77: SP17 --[click Go Home]--> SP0
T78: SP17 --[click Go Back]--> SP_prev
T79: SP6 --[isAuthenticated=true on mount → redirect /]--> SP0
T80: SP8 --[click Manage Posts card]--> SP9
T81: SP8 --[click Manage Projects card]--> SP12
T82: SP8 --[click Manage Comments card]--> SP15
T83: SP8 --[click Edit Resume card]--> SP16
T84: SP8 --[click Create Post quick-action card]--> SP10
T85: SP8 --[click Add Project quick-action card]--> SP13
T86: SP8 --[click Edit Resume quick-action card]--> SP16
T87: SP9 --[click New Post button]--> SP10
T88: SP9 --[click Edit on post row]--> SP11
T89: SP9 --[click Preview on post row]--> SP2
T90: SP10 --[click Back to Posts]--> SP9
T91: SP10 --[save new post success]--> SP11
T92: SP11 --[click Back to Posts]--> SP9
T93: SP11 --[save edit success]--> SP9
T94: SP12 --[click New Project button]--> SP13
T95: SP12 --[click Edit on project row]--> SP14
T96: SP12 --[click Preview on project row]--> SP4
T97: SP13 --[click Back to Projects]--> SP12
T98: SP13 --[save new project success]--> SP14
T99: SP14 --[click Back to Projects]--> SP12
T100: SP14 --[save edit success]--> SP12
```

### 2.3 Admin CRUD Transitions (T101–T120)

```
T101: SPA1 --[page load → GET /api/admin/posts]--> SPA2
T102: SPA1 --[page load → empty result]--> SPA3
T103: SPA3 --[click Create your first post CTA]--> SPA4
T104: SPA2 --[navigate /admin/posts/new]--> SPA4
T105: SPA2 --[click Edit on post row]--> SPA5
T106: SPA4 --[click Save Post (new)]--> SPA6
T107: SPA5 --[click Save Post (edit)]--> SPA6
T108: SPA6 --[save success]--> SPA7
T109: SPA6 --[save error]--> SPA8
T110: SPA8 --[retry Save Post]--> SPA6
T111: SPA2 --[click Delete on post row]--> SPA9
T112: SPA9 --[confirm delete]--> SPA10
T113: SPA9 --[cancel delete]--> SPA2
T114: SPA10 --[delete success]--> SPA11
T115: SPA10 --[delete error]--> SPA12
T116: SPA4 --[click upload cover image]--> SPA13
T117: SPA13 --[upload success]--> SPA14
T118: SPA13 --[upload error]--> SPA15
T119: SPR2 --[click New Project button]--> SPR4
T120: SPR3 --[click Create first project CTA]--> SPR4
T121: SPR2 --[click Edit on project row]--> SPR5
T122: SPR4 --[save new project success]--> SPR7
T123: SPR5 --[save edit project success]--> SPR7
T124: SPR4 --[save error]--> SPR8
T125: SPR2 --[click Delete project]--> SPR9
T126: SPR9 --[confirm delete]--> SPR10
T127: SPR9 --[cancel delete]--> SPR2
T128: SPR10 --[delete success]--> SPR11
T129: SPR10 --[delete error]--> SPR12
T130: SCM1 --[page load → GET /api/admin/comments]--> SCM2
T131: SCM2 --[click Approve]--> SCM3
T132: SCM3 --[PUT status=approved success]--> SCM2
T133: SCM2 --[click Reject]--> SCM4
T134: SCM4 --[PUT status=rejected success]--> SCM2
T135: SCM2 --[click Delete comment]--> SCM5
T136: SCM5 --[confirm delete]--> SCM6
T137: SCM5 --[cancel delete]--> SCM2
T138: SCM6 --[DELETE success]--> SCM2
T139: SCM2 --[click View Post link]--> SP2
T140: SRM1 --[click Edit resume item]--> SRM2
T141: SRM2 --[cancel edit]--> SRM1
T142: SRM2 --[submit form (new/edit)]--> SRM3
T143: SRM3 --[save success]--> SRM1
T144: SRM1 --[click Delete resume item]--> SRM4
T145: SRM4 --[DELETE success]--> SRM1
T146: SP5  --[click Download Resume button]--> SP5
T147: SP2  --[submit comment, SA1 or SA2]--> SC4
T148: SC4  --[POST /api/comments success]--> SC5
T149: SC4  --[POST /api/comments error]--> SC2
T150: SP* --[navigate unknown route]--> SP17
```

---

## 3. TPC PAIR COMPUTATION

For each state S: TPC(S) = {(Ti, Tj) | Ti arrives at S, Tj departs from S}

### 3.1 TPC pairs for Auth states

**SA0** — IN: T1,T2,T3,T4,T5,T8,T11,T13,T18,T19,T21,T22,T23,T24,T32,T33,T34,T35,T39,T40,T44
         OUT: T1,T2,T3,T4,T5,T6,T12,T24,T29,T35,T39,T41,T42

```
TPC_1:   T8  → T6   via SA0   (OAuth denied → retry login)
TPC_2:   T11 → T6   via SA0   (callback fail → retry login)
TPC_3:   T13 → T2   via SA0   (rehydration fail → browse public)
TPC_4:   T18 → T6   via SA0   (logout user → login again)
TPC_5:   T19 → T6   via SA0   (logout admin → login again)
TPC_6:   T21 → T12  via SA0   (refresh expired user → page reload)
TPC_7:   T22 → T12  via SA0   (refresh expired admin → page reload)
TPC_8:   T32 → T2   via SA0   (guard fail → browse public)
TPC_9:   T33 → T2   via SA0   (wrong role → browse public)
TPC_10:  T40 → T2   via SA0   (refresh origin fail → browse public)
TPC_11:  T44 → T41  via SA0   (callback fail → test-mode login)
TPC_12:  T8  → T12  via SA0   (OAuth denied → reload app)
TPC_13:  T11 → T2   via SA0   (callback fail → browse public)
TPC_14:  T18 → T2   via SA0   (user logout → browse public)
TPC_15:  T19 → T2   via SA0   (admin logout → browse public)
```

**SA1** — IN: T9,T14,T16,T25,T27,T30,T36,T41,T43,T45
         OUT: T16,T18,T22,T25,T27,T36,T45

```
TPC_16:  T9  → T18  via SA1   (login user → logout)
TPC_17:  T14 → T18  via SA1   (rehydrate user → logout)
TPC_18:  T9  → T22  via SA1   (login → token expires + refresh fail → logout)
TPC_19:  T30 → T18  via SA1   (guard success → logout)
TPC_20:  T41 → T18  via SA1   (test-login user → logout)
TPC_21:  T9  → T36  via SA1   (login user → attempt admin API → 403)
TPC_22:  T43 → T18  via SA1   (callback success user → logout)
TPC_23:  T9  → T25  via SA1   (login → valid CSRF API call)
TPC_24:  T45 → T25  via SA1   (login redirect → valid API call)
```

**SA2** — IN: T10,T15,T17,T20,T26,T28,T31,T37,T38,T42,T46
         OUT: T17,T19,T20,T21,T23,T26,T28,T34,T37,T38,T40,T46

```
TPC_25:  T10 → T19  via SA2   (login admin → logout)
TPC_26:  T15 → T19  via SA2   (rehydrate admin → logout)
TPC_27:  T42 → T19  via SA2   (test-login admin → logout)
TPC_28:  T10 → T20  via SA2   (login admin → token refresh cycle)
TPC_29:  T10 → T21  via SA2   (login admin → refresh fail → logout)
TPC_30:  T10 → T37  via SA2   (login admin → admin API 200)
TPC_31:  T28 → T37  via SA2   (admin route render → admin API call)
TPC_32:  T10 → T26  via SA2   (login admin → CSRF valid call)
TPC_33:  T38 → T19  via SA2   (token rotated → logout)
TPC_34:  T17 → T19  via SA2   (session rehydrate → logout)
TPC_35:  T31 → T26  via SA2   (guard pass → admin API call)
```

**SA3** — IN: T12,T29
         OUT: T13,T14,T15,T30,T31,T32,T33

```
TPC_36:  T12 → T13  via SA3   (page load → rehydration → no session → anon)
TPC_37:  T12 → T14  via SA3   (page load → rehydration → user)
TPC_38:  T12 → T15  via SA3   (page load → rehydration → admin)
TPC_39:  T29 → T30  via SA3   (guard triggers /auth/me → user success)
TPC_40:  T29 → T31  via SA3   (guard triggers /auth/me → admin success)
TPC_41:  T29 → T32  via SA3   (guard triggers /auth/me → 401 → redirect login)
TPC_42:  T29 → T33  via SA3   (guard triggers /auth/me → wrong role → /)
```

**SA4** — IN: T6
         OUT: T7,T8

```
TPC_43:  T6 → T7   via SA4   (click GitHub → OAuth consent granted)
TPC_44:  T6 → T8   via SA4   (click GitHub → OAuth denied)
```

**SA5** — IN: T7
         OUT: T9,T10,T11

```
TPC_45:  T7 → T9   via SA5   (callback → me() → user)
TPC_46:  T7 → T10  via SA5   (callback → me() → admin)
TPC_47:  T7 → T11  via SA5   (callback → me() → fail)
```

### 3.2 TPC pairs for Page states

**SP0 (home)** — IN: T47,T53,T56,T61,T62,T63,T77,T79
               OUT: T47,T48,T49,T50,T51,T62,T63,T64

```
TPC_48:  T53 → T48  via SP0   (logout → nav to Blog)
TPC_49:  T53 → T49  via SP0   (logout → nav to Portfolio)
TPC_50:  T53 → T62  via SP0   (logout → click Blog CTA)
TPC_51:  T53 → T63  via SP0   (logout → click Portfolio CTA)
TPC_52:  T77 → T48  via SP0   (404 go home → nav to Blog)
TPC_53:  T79 → T51  via SP0   (auth redirect from login → login again)
TPC_54:  T61 → T48  via SP0   (mobile logout → nav Blog)
TPC_55:  T56 → T62  via SP0   (mobile nav home → click Blog CTA)
```

**SP1 (blog)** — IN: T48,T57,T62,T65,T66,T67,T68,T69,T70,T71,T72
               OUT: T65,T66,T67,T68,T71

```
TPC_56:  T62 → T65  via SP1   (CTA to blog → click post card)
TPC_57:  T48 → T66  via SP1   (nav blog → click tag badge)
TPC_58:  T48 → T67  via SP1   (nav blog → search)
TPC_59:  T71 → T65  via SP1   (back to blog → click another post)
TPC_60:  T69 → T65  via SP1   (clear tag → click post)
TPC_61:  T70 → T65  via SP1   (clear search → click post)
TPC_62:  T48 → T68  via SP1   (nav blog → paginate)
TPC_63:  T72 → T65  via SP1   (tag filter → click post)
```

**SP2 (blog-post)** — IN: T65,T89
                    OUT: T71,T72,T73,T74,T147

```
TPC_64:  T65 → T71  via SP2   (click post → back to blog)
TPC_65:  T65 → T73  via SP2   (click post → login to comment, SA0)
TPC_66:  T65 → T74  via SP2   (click post → like)
TPC_67:  T65 → T147 via SP2   (click post → submit comment, authenticated)
TPC_68:  T89 → T71  via SP2   (admin preview → back to blog)
TPC_69:  T89 → T74  via SP2   (admin preview → like)
```

**SP3 (portfolio)** — IN: T49,T58,T63,T76
                    OUT: T75,T76

```
TPC_70:  T63 → T75  via SP3   (CTA to portfolio → click project card)
TPC_71:  T49 → T75  via SP3   (nav portfolio → click project card)
TPC_72:  T76 → T75  via SP3   (back to portfolio → click another project)
```

**SP4 (portfolio-detail)** — IN: T75,T96
                           OUT: T76

```
TPC_73:  T75 → T76  via SP4   (project detail → back)
TPC_74:  T96 → T76  via SP4   (admin preview project → back to portfolio)
```

**SP5 (resume)** — IN: T50,T59,T64,T146
                 OUT: T146

```
TPC_75:  T50 → T146 via SP5   (nav resume → download)
TPC_76:  T64 → T146 via SP5   (CTA to resume → download)
```

**SP6 (login)** — IN: T51,T60,T73
               OUT: T6,T79,T43,T44

```
TPC_77:  T51 → T6   via SP6   (nav login → click GitHub)
TPC_78:  T73 → T6   via SP6   (post login-to-comment → click GitHub)
TPC_79:  T60 → T6   via SP6   (mobile nav login → click GitHub)
TPC_80:  T51 → T79  via SP6   (nav login → already auth → redirect /)
```

**SP8 (admin-dashboard)** — IN: T52,T31
                          OUT: T80,T81,T82,T83,T84,T85,T86

```
TPC_81:  T52 → T80  via SP8   (nav dashboard → manage posts)
TPC_82:  T52 → T81  via SP8   (nav dashboard → manage projects)
TPC_83:  T52 → T82  via SP8   (nav dashboard → manage comments)
TPC_84:  T52 → T83  via SP8   (nav dashboard → edit resume)
TPC_85:  T52 → T84  via SP8   (nav dashboard → create post quick-action)
TPC_86:  T52 → T85  via SP8   (nav dashboard → add project quick-action)
TPC_87:  T31 → T80  via SP8   (guard pass admin → manage posts)
TPC_88:  T31 → T84  via SP8   (guard pass admin → create post)
```

**SP9 (admin-posts)** — IN: T80,T84,T90,T92,T93
                      OUT: T87,T88,T89

```
TPC_89:  T80 → T87  via SP9   (manage posts → new post)
TPC_90:  T80 → T88  via SP9   (manage posts → edit post)
TPC_91:  T80 → T89  via SP9   (manage posts → preview post)
TPC_92:  T90 → T87  via SP9   (back from new editor → new post again)
TPC_93:  T93 → T88  via SP9   (save edit → edit another post)
TPC_94:  T92 → T87  via SP9   (back from edit → new post)
TPC_95:  T84 → T87  via SP9   (quick-action → new post)
```

**SP10 (post-editor-new)** — IN: T87
                           OUT: T90,T91

```
TPC_96:  T87 → T90  via SP10  (new post editor → back to posts)
TPC_97:  T87 → T91  via SP10  (new post editor → save success → edit mode)
```

**SP11 (post-editor-edit)** — IN: T88,T91
                            OUT: T92,T93

```
TPC_98:  T88 → T92  via SP11  (open edit → back to posts)
TPC_99:  T88 → T93  via SP11  (open edit → save → list)
TPC_100: T91 → T92  via SP11  (new→edit transition → back)
TPC_101: T91 → T93  via SP11  (new→edit transition → save again)
```

**SP12 (admin-projects)** — IN: T81,T97,T99,T100
                          OUT: T94,T95,T96

```
TPC_102: T81  → T94  via SP12  (manage projects → new project)
TPC_103: T81  → T95  via SP12  (manage projects → edit project)
TPC_104: T81  → T96  via SP12  (manage projects → preview project)
TPC_105: T97  → T94  via SP12  (back from new editor → new project)
TPC_106: T99  → T94  via SP12  (back from edit → new project)
TPC_107: T100 → T95  via SP12  (save edit → edit another project)
```

**SP13 (project-editor-new)** — IN: T94
                              OUT: T97,T98

```
TPC_108: T94 → T97  via SP13  (new project editor → back)
TPC_109: T94 → T98  via SP13  (new project editor → save success → edit mode)
```

**SP14 (project-editor-edit)** — IN: T95,T98
                               OUT: T99,T100

```
TPC_110: T95 → T99   via SP14  (open project edit → back)
TPC_111: T95 → T100  via SP14  (open project edit → save)
TPC_112: T98 → T99   via SP14  (new→edit → back)
TPC_113: T98 → T100  via SP14  (new→edit → save)
```

**SP15 (admin-comments)** — IN: T82
                          OUT: T131,T133,T135,T139

```
TPC_114: T82 → T131  via SP15  (manage comments → approve)
TPC_115: T82 → T133  via SP15  (manage comments → reject)
TPC_116: T82 → T135  via SP15  (manage comments → delete)
TPC_117: T82 → T139  via SP15  (manage comments → view post)
```

**SP16 (admin-resume)** — IN: T83,T86
                        OUT: T140,T144

```
TPC_118: T83 → T140  via SP16  (nav resume admin → edit item)
TPC_119: T83 → T144  via SP16  (nav resume admin → delete item)
TPC_120: T86 → T140  via SP16  (quick-action resume → edit item)
```

**SP17 (not-found)** — IN: T150
                     OUT: T77,T78

```
TPC_121: T150 → T77  via SP17  (unknown route → go home)
TPC_122: T150 → T78  via SP17  (unknown route → go back)
```

**SM2 (mobile-menu-open)** — IN: T54
                           OUT: T55,T56,T57,T58,T59,T60,T61

```
TPC_123: T54 → T55  via SM2   (open menu → close with X)
TPC_124: T54 → T56  via SM2   (open menu → tap Home)
TPC_125: T54 → T57  via SM2   (open menu → tap Blog)
TPC_126: T54 → T58  via SM2   (open menu → tap Portfolio)
TPC_127: T54 → T59  via SM2   (open menu → tap Resume)
TPC_128: T54 → T60  via SM2   (open menu → tap Login, SA0)
TPC_129: T54 → T61  via SM2   (open menu → tap Logout)
```

**SPA6 (post-editor-saving)** — IN: T106,T107
                              OUT: T108,T109

```
TPC_130: T106 → T108 via SPA6  (save new → success)
TPC_131: T106 → T109 via SPA6  (save new → error)
TPC_132: T107 → T108 via SPA6  (save edit → success)
TPC_133: T107 → T109 via SPA6  (save edit → error)
```

**SPA9 (post-delete-confirm)** — IN: T111
                               OUT: T112,T113

```
TPC_134: T111 → T112 via SPA9  (click delete → confirm)
TPC_135: T111 → T113 via SPA9  (click delete → cancel)
```

**SPA13 (cover-uploading)** — IN: T116
                            OUT: T117,T118

```
TPC_136: T116 → T117 via SPA13 (upload cover → success)
TPC_137: T116 → T118 via SPA13 (upload cover → error)
```

**SPR9 (project-delete-confirm)** — IN: T125
                                  OUT: T126,T127

```
TPC_138: T125 → T126 via SPR9  (click delete project → confirm)
TPC_139: T125 → T127 via SPR9  (click delete project → cancel)
```

**SCM2 (admin-comments-loaded)** — IN: T130,T132,T134,T138
                                 OUT: T131,T133,T135,T139

```
TPC_140: T130 → T131 via SCM2  (load → approve)
TPC_141: T130 → T133 via SCM2  (load → reject)
TPC_142: T130 → T135 via SCM2  (load → delete)
TPC_143: T130 → T139 via SCM2  (load → view post)
TPC_144: T132 → T133 via SCM2  (approve done → reject another)
TPC_145: T134 → T131 via SCM2  (reject done → approve another)
TPC_146: T138 → T131 via SCM2  (delete done → approve another)
```

**SCM5 (comment-delete-confirm)** — IN: T135
                                  OUT: T136,T137

```
TPC_147: T135 → T136 via SCM5  (delete comment → confirm)
TPC_148: T135 → T137 via SCM5  (delete comment → cancel)
```

**SRM2 (admin-resume-editing)** — IN: T140
                                OUT: T141,T142

```
TPC_149: T140 → T141 via SRM2  (edit resume item → cancel)
TPC_150: T140 → T142 via SRM2  (edit resume item → submit)
```

**SC4 (comment-submitting)** — IN: T147
                             OUT: T148,T149

```
TPC_151: T147 → T148 via SC4   (submit comment → success)
TPC_152: T147 → T149 via SC4   (submit comment → error)
```

**Total TPC pairs: 152**

---

## 4. MINIMUM TEST PATHS COVERING ALL TPC PAIRS

Each path covers multiple TPC pairs by chaining transitions through intermediate states.

### 4.1 Anonymous Role Paths (OP-101 series)

```
PATH_1: [role: anonymous] Fresh page load → browse public pages → access denied admin
  T12 → T13 → T2 → T3
  covers TPC: 36, 3, 8

PATH_2: [role: anonymous] Page load → rehydration no session → visit blog → read post → like
  T12 → T13 → T48 → T65 → T74
  covers TPC: 36, 3, 56, 66

PATH_3: [role: anonymous] Browse blog → tag filter → clear tag → search → clear search
  T48 → T66 → T69 → T67 → T70
  covers TPC: 57, 62, 58, 63 (partial)

PATH_4: [role: anonymous] Read blog post → back to blog → paginate
  T65 → T71 → T68
  covers TPC: 64, 59, 62

PATH_5: [role: anonymous] Browse portfolio → project detail → back
  T49 → T75 → T76
  covers TPC: 71, 73

PATH_6: [role: anonymous] Home → portfolio CTA → project → back → portfolio
  T47 → T63 → T75 → T76
  covers TPC: 49 (partial), 70, 73

PATH_7: [role: anonymous] Home → resume CTA → download resume
  T47 → T64 → T146
  covers TPC: 76

PATH_8: [role: anonymous] Nav resume → download
  T50 → T146
  covers TPC: 75

PATH_9: [role: anonymous] Nav to 404 → go home → nav blog
  T150 → T77 → T48
  covers TPC: 121, 52

PATH_10: [role: anonymous] Nav to 404 → go back
  T150 → T78
  covers TPC: 122

PATH_11: [role: anonymous] Open mobile menu → close with X
  T54 → T55
  covers TPC: 123

PATH_12: [role: anonymous] Open mobile menu → tap Blog → read post → Login to comment → GitHub OAuth
  T54 → T57 → T65 → T73 → T6
  covers TPC: 125, 56 (partial), 78, 43

PATH_13: [role: anonymous] Open mobile menu → tap Portfolio
  T54 → T58
  covers TPC: 126

PATH_14: [role: anonymous] Open mobile menu → tap Resume
  T54 → T59
  covers TPC: 127

PATH_15: [role: anonymous] Open mobile menu → tap Login → OAuth flow → OAuth denied
  T54 → T60 → T6 → T8 → T12
  covers TPC: 128, 79, 44, 1, 12

PATH_16: [role: anonymous] Direct nav login → already anon → click GitHub → OAuth consent granted → callback fail
  T51 → T6 → T7 → T11 → T2
  covers TPC: 77, 43 (partial), 47, 13

PATH_17: [role: anonymous] CSRF missing → 403 → browse public
  T24 → T2
  covers TPC: 10 (partial)

PATH_18: [role: anonymous] POST /auth/logout already anon → browse public
  T35 → T2
  covers TPC: 14 (partial)

PATH_19: [role: anonymous] /auth/refresh no cookie → 401 → browse public
  T39 → T2
  covers TPC: 10 (partial)

PATH_20: [role: anonymous] Open mobile menu → tap Home → Blog CTA → post → back
  T54 → T56 → T62 → T65 → T71
  covers TPC: 124, 55, 57 (partial), 64
```

### 4.2 Auth Flow Paths (OP-401 series)

```
PATH_21: [role: auth-flow] Full OAuth login as user → session rehydrate → logout
  T6 → T7 → T9 → T16 → T18 → T2
  covers TPC: 43, 45, 16, 17, 14

PATH_22: [role: auth-flow] Full OAuth login as admin → session rehydrate → logout
  T6 → T7 → T10 → T17 → T19 → T2
  covers TPC: 43, 46, 25, 34, 15

PATH_23: [role: auth-flow] OAuth flow → callback me() success as user → browse
  T7 → T9 → T25
  covers TPC: 45, 23

PATH_24: [role: auth-flow] OAuth flow → callback me() success as admin → admin API call
  T7 → T10 → T37
  covers TPC: 46, 30

PATH_25: [role: auth-flow] OAuth flow → callback fail → retry login
  T7 → T11 → T6
  covers TPC: 47, 2

PATH_26: [role: auth-flow] Page load → guard check → /auth/me 401 → redirect login → GitHub
  T12 → T29 → T32 → T51 → T6
  covers TPC: 37 (partial), 41, 77

PATH_27: [role: auth-flow] Page load → rehydration → user → attempt admin API → 403
  T12 → T14 → T36
  covers TPC: 37, 21

PATH_28: [role: auth-flow] Page load → rehydration → wrong role → redirect home → browse
  T12 → T29 → T33 → T2
  covers TPC: 38 (partial), 42, 8

PATH_29: [role: auth-flow] Page load → guard success admin → admin API → token refresh cycle
  T29 → T31 → T20
  covers TPC: 40, 28

PATH_30: [role: auth-flow] User login → access token expires + refresh fail → logout → reload
  T9 → T22 → T12
  covers TPC: 18, 6

PATH_31: [role: auth-flow] Admin login → refresh origin fail → anonymous
  T10 → T40 → T2
  covers TPC: 46 (partial), 10

PATH_32: [role: auth-flow] TEST_MODE login as user → valid CSRF call → logout
  T41 → T25 → T18
  covers TPC: 11 (partial), 23 (partial), 20

PATH_33: [role: auth-flow] TEST_MODE login as admin → admin API call → logout
  T42 → T37 → T19
  covers TPC: 11 (partial), 27, 15 (partial)

PATH_34: [role: auth-flow] Login page mounted while authenticated as user → redirect /
  T45 → T25
  covers TPC: 24

PATH_35: [role: auth-flow] Login page mounted while authenticated as admin → redirect /
  T46 → T26
  covers TPC: 32 (partial)

PATH_36: [role: auth-flow] Guard triggers auth check → admin success → manage posts → new post
  T29 → T31 → T80 → T87
  covers TPC: 40, 87, 89

PATH_37: [role: auth-flow] Login ?callback=true success → user session → logout
  T43 → T18
  covers TPC: 22

PATH_38: [role: auth-flow] Login ?callback=true fail → retry GitHub
  T44 → T41
  covers TPC: 11

PATH_39: [role: auth-flow] Admin token rotation → stays admin → API call
  T38 → T19
  covers TPC: 33

PATH_40: [role: auth-flow] Admin role revoked mid-session → AdminRoute redirect /
  T34 → T2
  covers TPC: 9
```

### 4.3 Authenticated User Paths (OP-201 series)

```
PATH_41: [role: user] Login → browse blog → read post → submit comment → success
  T9 → T48 → T65 → T147 → T148
  covers TPC: 16 (arrive), 56, 67, 151

PATH_42: [role: user] Login → browse blog → read post → submit comment → error → retry
  T9 → T48 → T65 → T147 → T149
  covers TPC: 16 (arrive), 56, 67, 152

PATH_43: [role: user] Login → blog → post → like → back to blog
  T9 → T65 → T74 → T71
  covers TPC: 65, 66, 64

PATH_44: [role: user] Login → browse portfolio → project detail → back
  T9 → T49 → T75 → T76
  covers TPC: 71, 73

PATH_45: [role: user] Login → avatar dropdown → dashboard link blocked (role!=admin)
  T9 → T36 → T18
  covers TPC: 21, 20

PATH_46: [role: user] Login → resume → download
  T9 → T50 → T146
  covers TPC: 75

PATH_47: [role: user] Login → read blog post → tag filter → clear → paginate
  T9 → T65 → T72 → T69 → T68
  covers TPC: 63 (partial), 60, 62

PATH_48: [role: user] Login → mobile menu → logout
  T9 → T54 → T61 → T48
  covers TPC: 129, 54

PATH_49: [role: user] Login → CSRF valid API call → logout
  T9 → T25 → T18
  covers TPC: 23, 20

PATH_50: [role: user] Login → attempt admin route → 403
  T9 → T36
  covers TPC: 21
```

### 4.4 Admin Role Paths (OP-301 series)

```
PATH_51: [role: admin] Login → dashboard → manage posts → new post → back
  T10 → T52 → T80 → T87 → T90
  covers TPC: 25 (arrive), 81, 89, 96

PATH_52: [role: admin] Login → dashboard → manage posts → new post → save success → edit mode → back
  T10 → T52 → T80 → T87 → T91 → T92
  covers TPC: 81, 89, 97, 100, 98

PATH_53: [role: admin] Login → dashboard → manage posts → edit post → save
  T10 → T80 → T88 → T107 → T108
  covers TPC: 81 (partial), 90, 99, 132

PATH_54: [role: admin] Login → manage posts → edit post → save error → retry → success
  T10 → T80 → T88 → T107 → T109 → T110 → T108
  covers TPC: 90, 99, 133, 132 (partial)

PATH_55: [role: admin] Login → manage posts → new post (CTA empty state) → save success
  T103 → T106 → T108
  covers TPC: 130, 131

PATH_56: [role: admin] Login → manage posts → delete post → confirm → success
  T10 → T80 → T111 → T112 → T114
  covers TPC: 81 (partial), 134

PATH_57: [role: admin] Login → manage posts → delete post → cancel
  T10 → T80 → T111 → T113
  covers TPC: 81 (partial), 135

PATH_58: [role: admin] Login → post editor new → upload cover → success → save
  T87 → T116 → T117 → T106 → T108
  covers TPC: 96, 136, 130 (partial), 131

PATH_59: [role: admin] Login → post editor → upload cover → error
  T87 → T116 → T118
  covers TPC: 96, 137

PATH_60: [role: admin] Dashboard → manage projects → new project → back
  T52 → T81 → T94 → T97
  covers TPC: 82, 102, 108

PATH_61: [role: admin] Dashboard → manage projects → new project → save → edit mode → back
  T52 → T81 → T94 → T98 → T99
  covers TPC: 82, 102, 109, 112, 110

PATH_62: [role: admin] Dashboard → manage projects → edit project → save success
  T52 → T81 → T95 → T100
  covers TPC: 82, 103, 111, 113

PATH_63: [role: admin] Dashboard → manage projects → edit project → save → back to list → new
  T81 → T95 → T100 → T94
  covers TPC: 103, 113, 107

PATH_64: [role: admin] Manage projects → delete project → confirm → success
  T81 → T125 → T126 → T128
  covers TPC: 104 (partial), 138

PATH_65: [role: admin] Manage projects → delete project → cancel → edit
  T81 → T125 → T127 → T95
  covers TPC: 104 (partial), 139, 103

PATH_66: [role: admin] Manage projects → preview project → back to portfolio
  T81 → T96 → T76
  covers TPC: 104, 74

PATH_67: [role: admin] Dashboard → manage comments → load → approve → reject → delete → confirm
  T52 → T82 → T130 → T131 → T132 → T133 → T134 → T135 → T136
  covers TPC: 83, 114, 140, 141, 144, 145, 147

PATH_68: [role: admin] Manage comments → delete → cancel → view post
  T82 → T135 → T137 → T139
  covers TPC: 116, 148, 117

PATH_69: [role: admin] Manage comments → approve done → delete another → confirm
  T132 → T135 → T136
  covers TPC: 146, 147

PATH_70: [role: admin] Manage comments → view post link → navigate to blog post
  T82 → T130 → T139 → T71
  covers TPC: 114 (partial), 143, 68

PATH_71: [role: admin] Dashboard → admin resume → edit item → submit → success
  T52 → T83 → T140 → T142 → T143
  covers TPC: 84, 118, 150

PATH_72: [role: admin] Dashboard → admin resume → edit item → cancel
  T52 → T83 → T140 → T141
  covers TPC: 84, 118, 149

PATH_73: [role: admin] Dashboard → admin resume (quick-action) → edit item → submit
  T52 → T86 → T140 → T142 → T143
  covers TPC: 86, 120, 150

PATH_74: [role: admin] Admin resume → delete item → success
  T83 → T144 → T145
  covers TPC: 119

PATH_75: [role: admin] Dashboard → create post quick-action → save new → edit mode → back
  T52 → T84 → T91 → T92
  covers TPC: 85, 97 (partial), 100

PATH_76: [role: admin] Dashboard → add project quick-action → new project editor → save
  T52 → T85 → T98
  covers TPC: 86 (partial), 109

PATH_77: [role: admin] Admin posts → preview post (blank tab) → not modeled as nav
  T80 → T89 → T74
  covers TPC: 91, 69

PATH_78: [role: admin] Manage projects → back from new editor → new project again
  T94 → T97 → T94
  covers TPC: 108, 105

PATH_79: [role: admin] Manage projects → save edit → edit another project
  T95 → T100 → T95
  covers TPC: 111, 107

PATH_80: [role: admin] Admin login → header logout → anonymous → browse
  T10 → T19 → T2
  covers TPC: 15, 14 (partial)

PATH_81: [role: admin] Admin token refresh → stays admin → admin API call
  T20 → T37
  covers TPC: 28 (partial), 30

PATH_82: [role: admin] Admin route guard passes → render dashboard → manage posts
  T28 → T80
  covers TPC: 87

PATH_83: [role: admin] Admin token expires + refresh fail → anonymous → page reload
  T21 → T12
  covers TPC: 7

PATH_84: [role: admin] Posts list back from edit → back to posts → edit another
  T92 → T88
  covers TPC: 94

PATH_85: [role: admin] Post new→edit save→list → new post again
  T93 → T87
  covers TPC: 95
```

---

## 5. PLAYWRIGHT TEST ID MAPPING

### 5.1 Anonymous Tests (OP-101 … OP-120)

| Test ID | Path | Description | TPC Pairs |
|---------|------|-------------|----------|
| OP-101 | PATH_1 | Fresh page load → rehydration no session → browse public → admin redirect to login | 36,3,8 |
| OP-102 | PATH_2 | Page load → blog → read post → like post | 36,3,56,66 |
| OP-103 | PATH_3 | Blog search input → tag filter → clear tag → clear search | 57,62,58,63 |
| OP-104 | PATH_4 | Read post → back to blog → paginate | 64,59,62 |
| OP-105 | PATH_5 | Browse portfolio → project detail → back | 71,73 |
| OP-106 | PATH_6 | Home → portfolio CTA → project → back to portfolio | 49,70,73 |
| OP-107 | PATH_7 | Home → resume CTA → download resume | 76 |
| OP-108 | PATH_8 | Nav resume → download resume button | 75 |
| OP-109 | PATH_9 | Unknown route → 404 → go home → blog | 121,52 |
| OP-110 | PATH_10 | Unknown route → 404 → go back | 122 |
| OP-111 | PATH_11 | Open mobile menu → close with X | 123 |
| OP-112 | PATH_12 | Mobile menu → Blog → read post → login to comment → GitHub | 125,78,43 |
| OP-113 | PATH_13 | Mobile menu → Portfolio tab | 126 |
| OP-114 | PATH_14 | Mobile menu → Resume tab | 127 |
| OP-115 | PATH_15 | Mobile menu → Login → OAuth → denied → reload | 128,79,44,1,12 |
| OP-116 | PATH_16 | Login page → GitHub → callback fail → retry login | 77,43,47,13 |
| OP-117 | PATH_17 | CSRF missing → 403 → browse public | 10 |
| OP-118 | PATH_18 | POST logout already anon → browse public | 14 |
| OP-119 | PATH_19 | /auth/refresh no cookie → 401 → browse public | 10 |
| OP-120 | PATH_20 | Mobile menu → Home → Blog CTA → post → back | 124,55,57,64 |

### 5.2 Authenticated User Tests (OP-201 … OP-220)

| Test ID | Path | Description | TPC Pairs |
|---------|------|-------------|----------|
| OP-201 | PATH_41 | Login as user → blog → post → submit comment → success | 16,56,67,151 |
| OP-202 | PATH_42 | Login as user → blog → post → submit comment → error | 16,56,67,152 |
| OP-203 | PATH_43 | Login as user → blog → post → like → back | 65,66,64 |
| OP-204 | PATH_44 | Login as user → portfolio → project detail → back | 71,73 |
| OP-205 | PATH_45 | Login as user → attempt admin API → 403 | 21 |
| OP-206 | PATH_46 | Login as user → resume → download | 75 |
| OP-207 | PATH_47 | Login as user → post → tag filter → clear → paginate | 63,60,62 |
| OP-208 | PATH_48 | Login as user → mobile menu → logout | 129,54 |
| OP-209 | PATH_49 | Login as user → CSRF valid API call → logout | 23,20 |
| OP-210 | PATH_50 | Login as user → attempt admin route → 403 | 21 |
| OP-211 | PATH_30 | User login → token expires + refresh fail → logout → reload | 18,6 |
| OP-212 | PATH_34 | Login page mounted while authenticated as user → redirect / | 24 |
| OP-213 | PATH_37 | Login ?callback=true success → user session → logout | 22 |
| OP-214 | PATH_32 | TEST_MODE login as user → CSRF call → logout | 11,23,20 |

### 5.3 Admin Tests (OP-301 … OP-385)

| Test ID | Path | Description | TPC Pairs |
|---------|------|-------------|----------|
| OP-301 | PATH_51 | Admin → dashboard → manage posts → new post → back | 25,81,89,96 |
| OP-302 | PATH_52 | Admin → new post → save → edit mode → back | 81,89,97,100,98 |
| OP-303 | PATH_53 | Admin → manage posts → edit post → save success | 81,90,99,132 |
| OP-304 | PATH_54 | Admin → edit post → save error → retry → success | 90,99,133,132 |
| OP-305 | PATH_55 | Admin → new post from empty-state CTA → save | 130,131 |
| OP-306 | PATH_56 | Admin → manage posts → delete → confirm → success | 81,134 |
| OP-307 | PATH_57 | Admin → manage posts → delete → cancel | 81,135 |
| OP-308 | PATH_58 | Admin → post editor → upload cover → success → save | 96,136,131 |
| OP-309 | PATH_59 | Admin → post editor → upload cover → error | 96,137 |
| OP-310 | PATH_60 | Admin → dashboard → manage projects → new → back | 82,102,108 |
| OP-311 | PATH_61 | Admin → new project → save → edit mode → back | 82,102,109,112,110 |
| OP-312 | PATH_62 | Admin → manage projects → edit project → save | 82,103,111,113 |
| OP-313 | PATH_63 | Admin → edit project → save → back → new project | 103,113,107 |
| OP-314 | PATH_64 | Admin → delete project → confirm → success | 104,138 |
| OP-315 | PATH_65 | Admin → delete project → cancel → edit | 104,139,103 |
| OP-316 | PATH_66 | Admin → manage projects → preview project → back | 104,74 |
| OP-317 | PATH_67 | Admin → comments → approve → reject → delete → confirm | 83,114,140,141,144,145,147 |
| OP-318 | PATH_68 | Admin → comments → delete → cancel → view post | 116,148,117 |
| OP-319 | PATH_69 | Admin → comments approve done → delete another | 146,147 |
| OP-320 | PATH_70 | Admin → comments → view post → navigate blog | 114,143,68 |
| OP-321 | PATH_71 | Admin → resume → edit item → submit → success | 84,118,150 |
| OP-322 | PATH_72 | Admin → resume → edit item → cancel | 84,118,149 |
| OP-323 | PATH_73 | Admin → resume quick-action → edit item → submit | 86,120,150 |
| OP-324 | PATH_74 | Admin → resume → delete item → success | 119 |
| OP-325 | PATH_75 | Admin → create post quick-action → save → edit → back | 85,97,100 |
| OP-326 | PATH_76 | Admin → add project quick-action → save new project | 86,109 |
| OP-327 | PATH_77 | Admin posts → preview post → like | 91,69 |
| OP-328 | PATH_78 | New project editor → back → new project again | 108,105 |
| OP-329 | PATH_79 | Edit project → save → edit another project | 111,107 |
| OP-330 | PATH_80 | Admin login → header logout → browse | 15,14 |
| OP-331 | PATH_81 | Admin token refresh → stays admin → admin API | 28,30 |
| OP-332 | PATH_82 | AdminRoute guard passes → dashboard → manage posts | 87 |
| OP-333 | PATH_83 | Admin token + refresh fail → anonymous → reload | 7 |
| OP-334 | PATH_84 | Post list back from edit → edit another | 94 |
| OP-335 | PATH_85 | Post save edit → list → new post | 95 |

### 5.4 Auth Flow Tests (OP-401 … OP-440)

| Test ID | Path | Description | TPC Pairs |
|---------|------|-------------|----------|
| OP-401 | PATH_21 | Full OAuth login as user → rehydrate → logout | 43,45,16,17,14 |
| OP-402 | PATH_22 | Full OAuth login as admin → rehydrate → logout | 43,46,25,34,15 |
| OP-403 | PATH_23 | OAuth callback me() → user → valid API call | 45,23 |
| OP-404 | PATH_24 | OAuth callback me() → admin → admin API | 46,30 |
| OP-405 | PATH_25 | OAuth callback fail → retry login | 47,2 |
| OP-406 | PATH_26 | Page load → guard check → /auth/me 401 → login | 41,77 |
| OP-407 | PATH_27 | Page load → rehydrate user → admin API 403 | 37,21 |
| OP-408 | PATH_28 | Page load → guard → wrong role → home | 42,8 |
| OP-409 | PATH_29 | Guard success admin → API call → token refresh | 40,28 |
| OP-410 | PATH_31 | Admin login → refresh origin fail → anonymous | 46,10 |
| OP-411 | PATH_33 | TEST_MODE login admin → admin API → logout | 27,15 |
| OP-412 | PATH_35 | Login page mounted while admin → redirect / | 32 |
| OP-413 | PATH_36 | Guard check → admin success → manage posts → new post | 40,87,89 |
| OP-414 | PATH_38 | Login ?callback=true fail → retry GitHub OAuth | 11 |
| OP-415 | PATH_39 | Admin token rotation → stays admin → API call | 33 |
| OP-416 | PATH_40 | Admin role revoked mid-session → redirect home | 9 |

---

## 6. SUMMARY STATISTICS

| Category | Count |
|----------|-------|
| Auth states (SA) | 6 |
| Page states (SP) | 18 |
| UI sub-states (SM/SB/SC) | 9 |
| Admin sub-states (SPA/SPR/SCM/SRM) | 28 |
| **Total states** | **61** |
| Auth transitions (T1–T46) | 46 |
| Navigation transitions (T47–T100) | 54 |
| Admin CRUD transitions (T101–T150) | 50 |
| **Total transitions** | **150** |
| **Total TPC pairs** | **152** |
| Anonymous test cases (OP-101…120) | 20 |
| User test cases (OP-201…214) | 14 |
| Admin test cases (OP-301…335) | 35 |
| Auth flow test cases (OP-401…416) | 16 |
| **Total test cases** | **85** |

---

## 7. GAPS ADDRESSED FROM MECHANICAL EXTRACTION

| Gap | State/Transition Added |
|-----|------------------------|
| GAP1: like button | T74, SC6, TPC_66,69 |
| GAP2: blog search/filter/pagination | SB1–SB4, T66–T70, TPC_57–63 |
| GAP3: resume download | T146, TPC_75,76 |
| GAP4: AdminResume POST+DELETE | T144,T145, SRM4, TPC_119 |
| GAP5: Dashboard quick-action cards | T84,T85,T86, TPC_85,86,88 |
| GAP6: AdminComments ViewPost link | T139, TPC_117 |
| GAP7: Portfolio external links | noted as out-of-FSM (new tab) |
| GAP8: Header theme 3-way cycle | UI event, no page-state change |
| GAP9: Login ?callback=true | T43,T44, TPC_11,22 |
| GAP10: Blog tag filter URL param | SB3, T66, T72 |
| GAP11: admin/upload/image | T116–T118, SPA13–15, TPC_136,137 |
| GAP12: Categories/Tags/Settings API | backend-only, no frontend state |
| GAP13: Role fetched from DB | modeled via AdminRequired guard |
| GAP14: csrf_token JS-readable | TPC_10,17,24,35 cover CSRF flows |
| GAP15: Logout clears regardless | T35 (anon logout), TPC_14 |

---

## 8. TRANSITION INDEX (quick reference)

```
T1-T5:   SA0 self-loops (public access, guard redirects, API rejections)
T6:      SA0 → SA4  (initiate OAuth)
T7:      SA4 → SA5  (GitHub callback success)
T8:      SA4 → SA0  (OAuth denied)
T9:      SA5 → SA1  (callback → user)
T10:     SA5 → SA2  (callback → admin)
T11:     SA5 → SA0  (callback fail)
T12:     SA0 → SA3  (page load, rehydration start)
T13-T15: SA3 → SA0/SA1/SA2 (rehydration outcomes)
T16-T17: SA1/SA2 self-loops (session cache hit)
T18-T19: SA1/SA2 → SA0  (logout)
T20-T23: SA2 token expiry / refresh cycles
T24-T27: CSRF and API call self-loops
T28-T34: Route guard check transitions
T35-T40: Edge cases (anon logout, 403, refresh edge)
T41-T46: TEST_MODE logins, login page redirects
T47-T53: Global header navigation (any page)
T54-T61: Mobile menu transitions
T62-T64: Home page CTA navigation
T65-T74: Blog / BlogPost interactions
T75-T76: Portfolio navigation
T77-T78: 404 page actions
T79:     Login page auth redirect
T80-T86: Dashboard navigation cards
T87-T93: Admin posts CRUD navigation
T94-T100: Admin projects CRUD navigation
T101-T118: Admin posts sub-state (list/editor/delete/upload)
T119-T129: Admin projects sub-state (list/editor/delete)
T130-T139: Admin comments sub-state
T140-T145: Admin resume sub-state
T146:    Resume download
T147-T149: BlogPost comment submit
T150:    Any page → 404
```









