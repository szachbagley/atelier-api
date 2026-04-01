# Frontend

This document describes the frontend implementation for Atelier, including project structure, state management, components, hooks, and routing.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool and dev server |
| React Router v6 | Client-side routing |
| TanStack Query (React Query) | Server state management |
| Zustand | Client state management |
| Tailwind CSS | Styling |
| Headless UI | Accessible UI primitives |
| Fabric.js | Canvas annotations |
| Axios | HTTP client |

---

## Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts             # Axios instance with interceptors
│   │   ├── queryClient.ts        # TanStack Query configuration
│   │   ├── queryKeys.ts          # Query key factory
│   │   ├── auth.ts               # Auth endpoints
│   │   ├── projects.ts           # Project endpoints
│   │   ├── characters.ts         # Character endpoints
│   │   ├── variants.ts           # Variant endpoints
│   │   ├── settings.ts           # Setting endpoints
│   │   ├── props.ts              # Prop endpoints
│   │   ├── lighting.ts           # Lighting endpoints
│   │   ├── acts.ts               # Act endpoints
│   │   ├── scenes.ts             # Scene endpoints
│   │   ├── shots.ts              # Shot endpoints
│   │   ├── images.ts             # Image upload/generation endpoints
│   │   └── conceptSessions.ts    # Concept art session endpoints
│   │
│   ├── assets/
│   │   ├── icons/                # SVG icons
│   │   └── images/               # Static images
│   │
│   ├── components/
│   │   ├── common/               # Shared UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   └── ToastContainer.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── AppShell.tsx        # Main layout with sidebar
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   └── ProjectLayout.tsx   # Project-specific layout
│   │   │
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   │
│   │   ├── projects/
│   │   │   ├── ProjectList.tsx
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── CreateProjectModal.tsx
│   │   │   └── ShareProjectModal.tsx
│   │   │
│   │   ├── components-library/
│   │   │   ├── ComponentLibrarySidebar.tsx
│   │   │   ├── CharacterList.tsx
│   │   │   ├── CharacterCard.tsx
│   │   │   ├── CharacterForm.tsx
│   │   │   ├── VariantList.tsx
│   │   │   ├── VariantForm.tsx
│   │   │   ├── SettingList.tsx
│   │   │   ├── SettingCard.tsx
│   │   │   ├── SettingForm.tsx
│   │   │   ├── PropList.tsx
│   │   │   ├── PropForm.tsx
│   │   │   ├── LightingList.tsx
│   │   │   ├── LightingForm.tsx
│   │   │   ├── ArtStyleForm.tsx
│   │   │   ├── ReferenceImageUploader.tsx
│   │   │   ├── ReferenceImageGallery.tsx
│   │   │   └── ConceptArtChat.tsx
│   │   │
│   │   ├── storyboard/
│   │   │   ├── StoryboardView.tsx       # Main storyboard interface
│   │   │   ├── ActList.tsx
│   │   │   ├── ActHeader.tsx
│   │   │   ├── SceneList.tsx
│   │   │   ├── SceneHeader.tsx
│   │   │   ├── ShotStrip.tsx            # Horizontal thumbnail strip
│   │   │   ├── ShotCard.tsx             # Thumbnail with status indicator
│   │   │   ├── ShotEditor.tsx           # Full shot editing panel
│   │   │   ├── ShotForm.tsx             # Description, component selectors
│   │   │   ├── ComponentSelector.tsx    # Multi-select for characters, props
│   │   │   ├── CharacterSelector.tsx    # Character + variant picker
│   │   │   ├── PositionPicker.tsx       # Horizontal/depth position UI
│   │   │   ├── PromptPreview.tsx        # Compiled prompt display
│   │   │   ├── GenerationControls.tsx   # Generate, revert buttons
│   │   │   └── ShotNavigator.tsx        # Prev/next, jump to shot
│   │   │
│   │   ├── annotations/
│   │   │   ├── AnnotationCanvas.tsx     # Fabric.js wrapper
│   │   │   ├── AnnotationToolbar.tsx    # Tool selection
│   │   │   ├── ArrowTool.tsx
│   │   │   ├── TextBoxTool.tsx
│   │   │   ├── SymbolPicker.tsx
│   │   │   └── SymbolLibrary.tsx
│   │   │
│   │   ├── generation/
│   │   │   ├── GenerationStatus.tsx     # Loading, progress, error states
│   │   │   ├── ImageDisplay.tsx         # Generated image with zoom
│   │   │   ├── ImageViewer.tsx
│   │   │   └── IterationChat.tsx        # Chat for refining shots
│   │   │
│   │   ├── concept-art/
│   │   │   ├── ConceptArtChat.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   └── FinalizeSession.tsx
│   │   │
│   │   └── settings/
│   │       ├── ApiKeyManager.tsx
│   │       ├── ApiKeyForm.tsx
│   │       └── AccountSettings.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts            # Auth state and operations
│   │   ├── useAutoSave.ts        # Debounced auto-save
│   │   ├── useProject.ts         # Current project context
│   │   ├── useShot.ts            # Shot data and mutations
│   │   ├── useComponents.ts      # Component library queries
│   │   ├── useAnnotations.ts     # Annotation canvas state
│   │   ├── useImageUpload.ts     # S3 presigned upload
│   │   ├── usePromptCompiler.ts  # Prompt preview
│   │   ├── useGeneration.ts      # Image generation
│   │   ├── useConceptSession.ts  # Concept art session
│   │   └── useKeyboardShortcuts.ts
│   │
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── DashboardPage.tsx     # Project list
│   │   ├── ProjectPage.tsx       # Project overview
│   │   ├── ComponentsPage.tsx    # Component library
│   │   ├── StoryboardPage.tsx    # Main storyboard view
│   │   ├── ShotEditorPage.tsx    # Individual shot editing
│   │   ├── SettingsPage.tsx      # User settings
│   │   ├── SharedViewPage.tsx    # Public shared view
│   │   └── NotFoundPage.tsx
│   │
│   ├── routes/
│   │   ├── index.tsx             # Route definitions
│   │   └── guards.tsx            # Route guards
│   │
│   ├── stores/
│   │   ├── authStore.ts          # Auth state
│   │   ├── projectStore.ts       # Current project/selection
│   │   ├── uiStore.ts            # UI state (modals, toasts)
│   │   └── annotationStore.ts    # Annotation tool state
│   │
│   ├── types/
│   │   ├── index.ts              # Type exports
│   │   ├── models.ts             # Domain model types
│   │   ├── api.ts                # API request/response types
│   │   └── components.ts         # Component prop types
│   │
│   ├── utils/
│   │   ├── cn.ts                 # Class name utility
│   │   ├── formatters.ts         # Date, text formatters
│   │   ├── validators.ts         # Form validation
│   │   └── constants.ts          # App constants
│   │
│   ├── App.tsx                   # Root component
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Global styles + Tailwind
│
├── tests/
│   ├── unit/
│   └── e2e/
│
├── public/
│   └── favicon.ico
│
├── .env.example
├── Dockerfile
├── nginx.conf
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## State Management

Atelier uses a dual-store approach:

- **TanStack Query**: Server state (data from API)
- **Zustand**: Client state (UI state, selections, auth tokens)

### Why This Split?

| Concern | Solution | Rationale |
|---------|----------|-----------|
| Server data | TanStack Query | Built-in caching, refetching, optimistic updates |
| Auth tokens | Zustand | Persists in memory, syncs across components |
| UI state | Zustand | Fast updates, no network overhead |
| Form state | Local useState | Scoped to component lifecycle |

---

## Zustand Stores

### Auth Store

Manages authentication state and access tokens.

```typescript
// src/stores/authStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,
      
      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true, isLoading: false }),
      
      setAccessToken: (accessToken) =>
        set({ accessToken }),
      
      clearAuth: () =>
        set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false }),
      
      setLoading: (isLoading) =>
        set({ isLoading }),
    }),
    {
      name: 'atelier-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

### Project Store

Tracks current project and selection state.

```typescript
// src/stores/projectStore.ts

import { create } from 'zustand';

interface ProjectState {
  currentProjectId: string | null;
  currentActId: string | null;
  currentSceneId: string | null;
  currentShotId: string | null;
  
  setProject: (projectId: string | null) => void;
  setAct: (actId: string | null) => void;
  setScene: (sceneId: string | null) => void;
  setShot: (shotId: string | null) => void;
  setSelection: (selection: {
    projectId?: string | null;
    actId?: string | null;
    sceneId?: string | null;
    shotId?: string | null;
  }) => void;
  clearSelection: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProjectId: null,
  currentActId: null,
  currentSceneId: null,
  currentShotId: null,
  
  setProject: (projectId) =>
    set({ currentProjectId: projectId, currentActId: null, currentSceneId: null, currentShotId: null }),
  
  setAct: (actId) =>
    set({ currentActId: actId, currentSceneId: null, currentShotId: null }),
  
  setScene: (sceneId) =>
    set({ currentSceneId: sceneId, currentShotId: null }),
  
  setShot: (shotId) =>
    set({ currentShotId: shotId }),
  
  setSelection: (selection) =>
    set((state) => ({
      currentProjectId: selection.projectId ?? state.currentProjectId,
      currentActId: selection.actId ?? state.currentActId,
      currentSceneId: selection.sceneId ?? state.currentSceneId,
      currentShotId: selection.shotId ?? state.currentShotId,
    })),
  
  clearSelection: () =>
    set({ currentProjectId: null, currentActId: null, currentSceneId: null, currentShotId: null }),
}));
```

### UI Store

Manages modals, toasts, and global UI state.

```typescript
// src/stores/uiStore.ts

import { create } from 'zustand';

type ModalType =
  | 'createProject'
  | 'deleteConfirm'
  | 'shareProject'
  | 'addCharacter'
  | 'addSetting'
  | 'addProp'
  | 'addLighting'
  | 'conceptArt'
  | 'promptPreview'
  | null;

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  activeModal: ModalType;
  modalData: Record<string, unknown>;
  toasts: Toast[];
  
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openModal: (modal: ModalType, data?: Record<string, unknown>) => void;
  closeModal: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  activeModal: null,
  modalData: {},
  toasts: [],
  
  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  
  setSidebarCollapsed: (collapsed) =>
    set({ sidebarCollapsed: collapsed }),
  
  openModal: (modal, data = {}) =>
    set({ activeModal: modal, modalData: data }),
  
  closeModal: () =>
    set({ activeModal: null, modalData: {} }),
  
  addToast: (toast) => {
    const id = crypto.randomUUID();
    const duration = toast.duration ?? 5000;
    
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
    
    return id;
  },
  
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
```

### Annotation Store

Manages annotation tool state for the canvas.

```typescript
// src/stores/annotationStore.ts

import { create } from 'zustand';

type AnnotationTool = 'select' | 'arrow' | 'textBox' | 'symbol' | null;

type SymbolType =
  | 'camera_push' | 'camera_pull'
  | 'camera_pan_left' | 'camera_pan_right'
  | 'camera_tilt_up' | 'camera_tilt_down'
  | 'camera_crane_up' | 'camera_crane_down'
  | 'character_move' | 'character_enter' | 'character_exit'
  | 'focus_point' | 'eyeline';

interface AnnotationState {
  activeTool: AnnotationTool;
  selectedSymbol: SymbolType | null;
  strokeColor: string;
  strokeWidth: number;
  fontSize: number;
  selectedElementId: string | null;
  
  setTool: (tool: AnnotationTool) => void;
  setSymbol: (symbol: SymbolType) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setFontSize: (size: number) => void;
  selectElement: (id: string | null) => void;
  resetTool: () => void;
}

export const useAnnotationStore = create<AnnotationState>((set) => ({
  activeTool: 'select',
  selectedSymbol: null,
  strokeColor: '#ef4444',
  strokeWidth: 3,
  fontSize: 16,
  selectedElementId: null,
  
  setTool: (tool) =>
    set({ activeTool: tool, selectedSymbol: null }),
  
  setSymbol: (symbol) =>
    set({ activeTool: 'symbol', selectedSymbol: symbol }),
  
  setStrokeColor: (color) =>
    set({ strokeColor: color }),
  
  setStrokeWidth: (width) =>
    set({ strokeWidth: width }),
  
  setFontSize: (size) =>
    set({ fontSize: size }),
  
  selectElement: (id) =>
    set({ selectedElementId: id }),
  
  resetTool: () =>
    set({ activeTool: 'select', selectedSymbol: null, selectedElementId: null }),
}));
```

---

## API Client

### Axios Instance with Interceptors

```typescript
// src/api/client.ts

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: Add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    const errorCode = (error.response?.data as any)?.error?.code;
    
    if (
      error.response?.status === 401 &&
      errorCode === 'AUTH_TOKEN_EXPIRED' &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        const response = await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        
        const { accessToken } = response.data;
        useAuthStore.getState().setAccessToken(accessToken);
        
        processQueue(null, accessToken);
        
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
  }
);
```

### Auth API

```typescript
// src/api/auth.ts

import { apiClient } from './client';

interface AuthResponse {
  user: { id: string; email: string };
  accessToken: string;
}

export const authApi = {
  login: async (data: { email: string; password: string }): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },
  
  register: async (data: { email: string; password: string }): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },
  
  refresh: async (): Promise<{ accessToken: string }> => {
    const response = await apiClient.post('/auth/refresh');
    return response.data;
  },
  
  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },
  
  getMe: async (): Promise<{ user: AuthResponse['user'] }> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};
```

---

## TanStack Query

### Query Client Configuration

```typescript
// src/api/queryClient.ts

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,     // 5 minutes
      gcTime: 1000 * 60 * 30,       // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
```

### Entry Point

```typescript
// src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './api/queryClient';
import { App } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);
```

### Query Key Factory

```typescript
// src/api/queryKeys.ts

export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  
  projects: {
    all: ['projects'] as const,
    list: (params?: { limit?: number; offset?: number }) =>
      ['projects', 'list', params] as const,
    detail: (id: string) => ['projects', id] as const,
    stats: (id: string) => ['projects', id, 'stats'] as const,
  },
  
  artStyle: {
    byProject: (projectId: string) =>
      ['projects', projectId, 'artStyle'] as const,
  },
  
  characters: {
    byProject: (projectId: string) =>
      ['projects', projectId, 'characters'] as const,
    detail: (projectId: string, id: string) =>
      ['projects', projectId, 'characters', id] as const,
    variants: (projectId: string, characterId: string) =>
      ['projects', projectId, 'characters', characterId, 'variants'] as const,
  },
  
  settings: {
    byProject: (projectId: string) =>
      ['projects', projectId, 'settings'] as const,
    detail: (projectId: string, id: string) =>
      ['projects', projectId, 'settings', id] as const,
  },
  
  props: {
    byProject: (projectId: string) =>
      ['projects', projectId, 'props'] as const,
    detail: (projectId: string, id: string) =>
      ['projects', projectId, 'props', id] as const,
  },
  
  lighting: {
    byProject: (projectId: string) =>
      ['projects', projectId, 'lighting'] as const,
    detail: (projectId: string, id: string) =>
      ['projects', projectId, 'lighting', id] as const,
  },
  
  acts: {
    byProject: (projectId: string) =>
      ['projects', projectId, 'acts'] as const,
    detail: (projectId: string, id: string) =>
      ['projects', projectId, 'acts', id] as const,
  },
  
  scenes: {
    byAct: (projectId: string, actId: string) =>
      ['projects', projectId, 'acts', actId, 'scenes'] as const,
    detail: (projectId: string, id: string) =>
      ['projects', projectId, 'scenes', id] as const,
  },
  
  shots: {
    byScene: (projectId: string, sceneId: string) =>
      ['projects', projectId, 'scenes', sceneId, 'shots'] as const,
    detail: (projectId: string, id: string) =>
      ['projects', projectId, 'shots', id] as const,
    compiledPrompt: (projectId: string, id: string) =>
      ['projects', projectId, 'shots', id, 'compiledPrompt'] as const,
  },
  
  conceptSessions: {
    byProject: (projectId: string) =>
      ['projects', projectId, 'conceptSessions'] as const,
    detail: (projectId: string, id: string) =>
      ['projects', projectId, 'conceptSessions', id] as const,
  },
};
```

---

## Custom Hooks

### useAuth

```typescript
// src/hooks/useAuth.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { queryKeys } from '../api/queryKeys';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';

export function useAuth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setAuth, clearAuth, isAuthenticated, user } = useAuthStore();
  const { addToast } = useUIStore();
  
  const { isLoading: isCheckingAuth } = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      try {
        const { user } = await authApi.getMe();
        return user;
      } catch {
        clearAuth();
        return null;
      }
    },
    enabled: isAuthenticated,
    retry: false,
  });
  
  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
      navigate('/dashboard');
      addToast({ type: 'success', message: 'Welcome back!' });
    },
    onError: (error: any) => {
      const message = error.response?.data?.error?.message || 'Login failed';
      addToast({ type: 'error', message });
    },
  });
  
  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
      navigate('/dashboard');
      addToast({ type: 'success', message: 'Account created successfully!' });
    },
    onError: (error: any) => {
      const message = error.response?.data?.error?.message || 'Registration failed';
      addToast({ type: 'error', message });
    },
  });
  
  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      clearAuth();
      queryClient.clear();
      navigate('/login');
    },
    onError: () => {
      clearAuth();
      queryClient.clear();
      navigate('/login');
    },
  });
  
  return {
    user,
    isAuthenticated,
    isLoading: isCheckingAuth,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
  };
}
```

### useAutoSave

Debounced auto-save for shot data.

```typescript
// src/hooks/useAutoSave.ts

import { useCallback, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';

interface UseAutoSaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

export function useAutoSave<T>({
  data,
  onSave,
  debounceMs = 1000,
  enabled = true,
}: UseAutoSaveOptions<T>) {
  const lastSavedRef = useRef<string>('');
  const debouncedData = useDebounce(data, debounceMs);
  
  const mutation = useMutation({
    mutationFn: onSave,
  });
  
  useEffect(() => {
    if (!enabled) return;
    
    const serialized = JSON.stringify(debouncedData);
    
    if (serialized !== lastSavedRef.current) {
      lastSavedRef.current = serialized;
      mutation.mutate(debouncedData);
    }
  }, [debouncedData, enabled, mutation]);
  
  return {
    isSaving: mutation.isPending,
    lastSaveError: mutation.error,
    saveNow: useCallback(() => {
      lastSavedRef.current = JSON.stringify(data);
      return mutation.mutateAsync(data);
    }, [data, mutation]),
  };
}
```

### useShot

Shot data, mutations, prompt compilation, and generation.

```typescript
// src/hooks/useShot.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shotsApi } from '../api/shots';
import { queryKeys } from '../api/queryKeys';
import { useUIStore } from '../stores/uiStore';

export function useShot(projectId: string, shotId: string) {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();
  
  const { data: shot, isLoading } = useQuery({
    queryKey: queryKeys.shots.detail(projectId, shotId),
    queryFn: () => shotsApi.getShot(projectId, shotId),
  });
  
  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Shot>) =>
      shotsApi.updateShot(projectId, shotId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.shots.detail(projectId, shotId),
      });
    },
  });
  
  const { data: compiledPrompt, refetch: compilePrompt, isFetching: isCompilingPrompt } = useQuery({
    queryKey: queryKeys.shots.compiledPrompt(projectId, shotId),
    queryFn: () => shotsApi.compilePrompt(projectId, shotId),
    enabled: false,
  });
  
  const generateMutation = useMutation({
    mutationFn: (editedPrompt?: string) =>
      shotsApi.generate(projectId, shotId, editedPrompt),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.shots.detail(projectId, shotId),
      });
      addToast({ type: 'success', message: 'Image generated!' });
    },
    onError: (error: any) => {
      const message = error.response?.data?.error?.message || 'Generation failed';
      addToast({ type: 'error', message });
    },
  });
  
  const revertMutation = useMutation({
    mutationFn: () => shotsApi.revert(projectId, shotId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.shots.detail(projectId, shotId),
      });
      addToast({ type: 'info', message: 'Reverted to previous image' });
    },
  });
  
  return {
    shot,
    isLoading,
    updateShot: updateMutation.mutate,
    isSaving: updateMutation.isPending,
    compiledPrompt,
    compilePrompt,
    isCompilingPrompt,
    generate: generateMutation.mutate,
    isGenerating: generateMutation.isPending,
    revert: revertMutation.mutate,
    canRevert: !!shot?.previous_image_id,
  };
}
```

### useImageUpload

Presigned S3 upload flow.

```typescript
// src/hooks/useImageUpload.ts

import { useState, useCallback } from 'react';
import { apiClient } from '../api/client';

interface UploadProgress {
  status: 'idle' | 'preparing' | 'uploading' | 'confirming' | 'complete' | 'error';
  progress: number;
  error?: string;
}

export function useImageUpload(projectId: string) {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    status: 'idle',
    progress: 0,
  });
  
  const upload = useCallback(
    async (file: File, componentType: string, componentId: string) => {
      try {
        // 1. Get presigned URL
        setUploadProgress({ status: 'preparing', progress: 0 });
        
        const { data: presign } = await apiClient.post(
          `/projects/${projectId}/reference-images/presign`,
          {
            filename: file.name,
            contentType: file.type,
            componentType,
            componentId,
          }
        );
        
        // 2. Upload directly to S3
        setUploadProgress({ status: 'uploading', progress: 0 });
        
        await fetch(presign.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
        
        // 3. Confirm upload
        setUploadProgress({ status: 'confirming', progress: 90 });
        
        const { data: confirmed } = await apiClient.post(
          `/projects/${projectId}/reference-images/confirm`,
          {
            imageId: presign.imageId,
            s3Key: presign.s3Key,
            componentType,
            componentId,
            filename: file.name,
            contentType: file.type,
          }
        );
        
        setUploadProgress({ status: 'complete', progress: 100 });
        return confirmed;
      } catch (error: any) {
        setUploadProgress({
          status: 'error',
          progress: 0,
          error: error.message || 'Upload failed',
        });
        throw error;
      }
    },
    [projectId]
  );
  
  const reset = useCallback(() => {
    setUploadProgress({ status: 'idle', progress: 0 });
  }, []);
  
  return { upload, uploadProgress, reset };
}
```

### useAnnotations

Fabric.js canvas management for shot annotations.

```typescript
// src/hooks/useAnnotations.ts

import { useRef, useCallback, useEffect } from 'react';
import { fabric } from 'fabric';
import { useAnnotationStore } from '../stores/annotationStore';
import { AnnotationLayer } from '../types/models';

export function useAnnotations(
  imageUrl: string,
  initialAnnotations: AnnotationLayer | null,
  onChange: (annotations: AnnotationLayer) => void
) {
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { activeTool, strokeColor, strokeWidth, fontSize, selectElement } =
    useAnnotationStore();
  
  const initCanvas = useCallback(
    (canvasElement: HTMLCanvasElement) => {
      const canvas = new fabric.Canvas(canvasElement, {
        selection: activeTool === 'select',
        backgroundColor: 'transparent',
      });
      
      canvasRef.current = canvas;
      
      // Load background image
      fabric.Image.fromURL(imageUrl, (img) => {
        const container = containerRef.current;
        if (!container) return;
        
        const scale = Math.min(
          container.clientWidth / (img.width || 1),
          container.clientHeight / (img.height || 1)
        );
        
        canvas.setDimensions({
          width: (img.width || 0) * scale,
          height: (img.height || 0) * scale,
        });
        
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
          scaleX: scale,
          scaleY: scale,
        });
        
        // Load existing annotations
        if (initialAnnotations?.elements) {
          loadAnnotations(canvas, initialAnnotations.elements);
        }
      });
      
      // Track selection
      canvas.on('selection:created', (e) => {
        const selected = e.selected?.[0];
        if (selected?.data?.id) {
          selectElement(selected.data.id);
        }
      });
      
      canvas.on('selection:cleared', () => {
        selectElement(null);
      });
      
      return () => {
        canvas.dispose();
        canvasRef.current = null;
      };
    },
    [imageUrl, initialAnnotations, activeTool, selectElement]
  );
  
  const exportAnnotations = useCallback((): AnnotationLayer => {
    const canvas = canvasRef.current;
    if (!canvas) return { version: 1, elements: [] };
    
    const elements = canvas.getObjects().map((obj) => {
      // Convert fabric objects back to annotation elements
      return fabricObjectToAnnotation(obj, canvas.width!, canvas.height!);
    });
    
    return { version: 1, elements };
  }, []);
  
  const emitChange = useCallback(() => {
    const annotations = exportAnnotations();
    onChange(annotations);
  }, [exportAnnotations, onChange]);
  
  const addElement = useCallback(
    (x: number, y: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      let obj: fabric.Object | null = null;
      
      switch (activeTool) {
        case 'textBox':
          obj = new fabric.Textbox('Text', {
            left: x,
            top: y,
            width: 150,
            fontSize,
            fill: strokeColor,
            backgroundColor: 'rgba(255,255,255,0.9)',
            editable: true,
          });
          break;
        
        case 'arrow':
          // Arrow is handled via mouse drag events (see setupArrowTool)
          // This case creates a simple arrow at the click point
          obj = new fabric.Line([x, y, x + 100, y], {
            stroke: strokeColor,
            strokeWidth,
            selectable: true,
          });
          break;
        
        case 'symbol': {
          const { selectedSymbol } = useAnnotationStore.getState();
          if (!selectedSymbol) break;
          
          // <!-- Reconstructed: Symbol placement uses SVG paths loaded from SymbolLibrary -->
          const symbolPath = getSymbolSVG(selectedSymbol);
          fabric.loadSVGFromString(symbolPath, (objects, options) => {
            const group = fabric.util.groupSVGElements(objects, options);
            group.set({
              left: x,
              top: y,
              scaleX: 0.5,
              scaleY: 0.5,
              fill: strokeColor,
            });
            group.data = { id: crypto.randomUUID(), type: 'symbol', symbol: selectedSymbol };
            canvas.add(group);
            canvas.setActiveObject(group);
            canvas.renderAll();
            emitChange();
          });
          return; // Early return since SVG loading is async
        }
      }
      
      if (obj) {
        obj.data = { id: crypto.randomUUID() };
        canvas.add(obj);
        canvas.setActiveObject(obj);
        canvas.renderAll();
        emitChange();
      }
    },
    [activeTool, fontSize, strokeColor, strokeWidth, emitChange]
  );
  
  const deleteSelected = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const active = canvas.getActiveObject();
    if (active) {
      canvas.remove(active);
      canvas.renderAll();
      selectElement(null);
      emitChange();
    }
  }, [selectElement, emitChange]);
  
  const clearAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.getObjects().forEach((obj) => canvas.remove(obj));
    canvas.renderAll();
    emitChange();
  }, [emitChange]);
  
  return {
    containerRef,
    initCanvas,
    addElement,
    deleteSelected,
    clearAll,
    exportAnnotations,
    selectedElementId: useAnnotationStore.getState().selectedElementId,
  };
}
```

### Arrow Tool Mouse Event Setup

The arrow tool uses Fabric.js mouse events for click-and-drag arrow creation:

```typescript
// Called during canvas initialization when activeTool === 'arrow'

function setupArrowTool(canvas: fabric.Canvas, strokeColor: string, strokeWidth: number) {
  let isDrawing = false;
  let arrow: fabric.Line | null = null;
  let startPoint: { x: number; y: number } | null = null;
  
  canvas.on('mouse:down', (opt) => {
    isDrawing = true;
    const pointer = canvas.getPointer(opt.e);
    startPoint = { x: pointer.x, y: pointer.y };
    
    arrow = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
      stroke: strokeColor,
      strokeWidth,
      selectable: true,
    });
    
    canvas.add(arrow);
  });
  
  canvas.on('mouse:move', (opt) => {
    if (!isDrawing || !arrow) return;
    
    const pointer = canvas.getPointer(opt.e);
    arrow.set({ x2: pointer.x, y2: pointer.y });
    canvas.renderAll();
  });
  
  canvas.on('mouse:up', () => {
    if (arrow) {
      arrow.data = { id: crypto.randomUUID(), type: 'arrow' };
    }
    isDrawing = false;
    arrow = null;
    startPoint = null;
  });
}
```

### Annotation Serialization Helpers

<!-- Reconstructed: These helpers convert between Fabric.js objects and the AnnotationLayer JSON schema defined in DATABASE.md -->

```typescript
// Convert Fabric.js object to annotation element (for saving)
function fabricObjectToAnnotation(
  obj: fabric.Object,
  canvasWidth: number,
  canvasHeight: number
): AnnotationElement {
  const base = {
    id: obj.data?.id || crypto.randomUUID(),
    x: ((obj.left || 0) / canvasWidth) * 100,
    y: ((obj.top || 0) / canvasHeight) * 100,
    rotation: obj.angle || 0,
    zIndex: obj.data?.zIndex || 0,
  };
  
  if (obj instanceof fabric.Line) {
    return {
      ...base,
      type: 'arrow' as const,
      endX: ((obj.x2 || 0) / canvasWidth) * 100,
      endY: ((obj.y2 || 0) / canvasHeight) * 100,
      color: (obj.stroke as string) || '#ef4444',
      strokeWidth: obj.strokeWidth || 3,
      arrowStyle: 'single' as const,
      label: obj.data?.label,
    };
  }
  
  if (obj instanceof fabric.Textbox) {
    return {
      ...base,
      type: 'textBox' as const,
      width: ((obj.width || 0) / canvasWidth) * 100,
      height: ((obj.height || 0) / canvasHeight) * 100,
      content: obj.text || '',
      fontSize: obj.fontSize || 16,
      fontColor: (obj.fill as string) || '#000000',
      backgroundColor: (obj.backgroundColor as string) || 'rgba(255,255,255,0.9)',
      borderColor: '#cccccc',
    };
  }
  
  // Symbol type
  return {
    ...base,
    type: 'symbol' as const,
    symbol: obj.data?.symbol || 'focus_point',
    scale: obj.scaleX || 1,
    color: (obj.fill as string) || '#3b82f6',
  };
}

// Convert annotation element to Fabric.js object (for loading)
function annotationToFabricObject(
  element: AnnotationElement,
  canvasWidth: number,
  canvasHeight: number
): fabric.Object | null {
  const x = (element.x / 100) * canvasWidth;
  const y = (element.y / 100) * canvasHeight;
  
  switch (element.type) {
    case 'arrow': {
      const endX = (element.endX / 100) * canvasWidth;
      const endY = (element.endY / 100) * canvasHeight;
      const line = new fabric.Line([x, y, endX, endY], {
        stroke: element.color,
        strokeWidth: element.strokeWidth,
        selectable: true,
        angle: element.rotation,
      });
      line.data = { id: element.id, type: 'arrow', label: element.label };
      return line;
    }
    
    case 'textBox': {
      const width = (element.width / 100) * canvasWidth;
      const textbox = new fabric.Textbox(element.content, {
        left: x,
        top: y,
        width,
        fontSize: element.fontSize,
        fill: element.fontColor,
        backgroundColor: element.backgroundColor,
        editable: true,
        angle: element.rotation,
      });
      textbox.data = { id: element.id, type: 'textBox' };
      return textbox;
    }
    
    case 'symbol': {
      // Load SVG symbol and position it
      const symbolPath = getSymbolSVG(element.symbol);
      // Note: SVG loading is async — handled via callback in actual implementation
      return null; // Placeholder — actual loading uses fabric.loadSVGFromString
    }
    
    default:
      return null;
  }
}
```

---

## Routing

### Route Definitions

```typescript
// src/routes/index.tsx

import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { ProjectLayout } from '../components/layout/ProjectLayout';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ProjectPage } from '../pages/ProjectPage';
import { ComponentsPage } from '../pages/ComponentsPage';
import { StoryboardPage } from '../pages/StoryboardPage';
import { ShotEditorPage } from '../pages/ShotEditorPage';
import { SettingsPage } from '../pages/SettingsPage';
import { SharedViewPage } from '../pages/SharedViewPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/shared/:shareToken', element: <SharedViewPage /> },
  
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'settings', element: <SettingsPage /> },
      
      {
        path: 'projects/:projectId',
        element: <ProjectLayout />,
        children: [
          { index: true, element: <ProjectPage /> },
          { path: 'components', element: <ComponentsPage /> },
          { path: 'storyboard', element: <StoryboardPage /> },
          { path: 'shots/:shotId', element: <ShotEditorPage /> },
        ],
      },
    ],
  },
  
  { path: '*', element: <NotFoundPage /> },
]);
```

### Protected Route Component

```typescript
// src/components/auth/ProtectedRoute.tsx

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Spinner } from '../common/Spinner';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuthStore();
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
}
```

---

## Key Components

### Shot Editor

The primary editing interface for individual shots.

```typescript
// src/components/storyboard/ShotEditor.tsx

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useShot } from '../../hooks/useShot';
import { useAutoSave } from '../../hooks/useAutoSave';
import { ShotForm } from './ShotForm';
import { AnnotationCanvas } from '../annotations/AnnotationCanvas';
import { AnnotationToolbar } from '../annotations/AnnotationToolbar';
import { PromptPreview } from './PromptPreview';
import { GenerateButton } from '../generation/GenerateButton';
import { ImageViewer } from '../generation/ImageViewer';
import { Spinner } from '../common/Spinner';

export function ShotEditor() {
  const { projectId, shotId } = useParams<{ projectId: string; shotId: string }>();
  
  const {
    shot,
    isLoading,
    updateShot,
    isSaving,
    compiledPrompt,
    compilePrompt,
    isCompilingPrompt,
    generate,
    isGenerating,
    revert,
    canRevert,
  } = useShot(projectId!, shotId!);
  
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  
  if (isLoading || !shot) {
    return <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>;
  }
  
  const handleGenerate = () => {
    generate(editedPrompt || undefined);
  };
  
  const handleOpenPromptPreview = async () => {
    await compilePrompt();
    setShowPromptPreview(true);
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Top: Image and annotations */}
      <div className="flex-1 relative">
        {shot.imageUrl ? (
          <>
            <ImageViewer url={shot.imageUrl} />
            <AnnotationToolbar />
            <AnnotationCanvas
              imageUrl={shot.imageUrl}
              annotations={shot.annotations}
              onChange={(annotations) => updateShot({ annotations })}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-100">
            <p className="text-gray-500">No image generated yet</p>
          </div>
        )}
      </div>
      
      {/* Bottom: Controls */}
      <div className="border-t p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {isSaving ? 'Saving...' : 'Saved'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {canRevert && (
              <button
                onClick={() => revert()}
                className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
              >
                Revert
              </button>
            )}
            
            <button
              onClick={handleOpenPromptPreview}
              className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
            >
              Preview Prompt
            </button>
            
            <GenerateButton
              onClick={handleGenerate}
              isGenerating={isGenerating}
              disabled={shot.status === 'GENERATING'}
            />
          </div>
        </div>
      </div>
      
      {/* Prompt preview modal */}
      {showPromptPreview && compiledPrompt && (
        <PromptPreview
          compiledPrompt={compiledPrompt}
          editedPrompt={editedPrompt}
          onEditedPromptChange={setEditedPrompt}
          onClose={() => setShowPromptPreview(false)}
          onGenerate={() => {
            setShowPromptPreview(false);
            handleGenerate();
          }}
          isGenerating={isGenerating}
        />
      )}
    </div>
  );
}
```

### Prompt Preview

```typescript
// src/components/storyboard/PromptPreview.tsx

import { Dialog } from '@headlessui/react';
import { CompiledPrompt } from '../../types/models';
import { Button } from '../common/Button';

interface PromptPreviewProps {
  compiledPrompt: CompiledPrompt;
  editedPrompt: string | null;
  onEditedPromptChange: (prompt: string | null) => void;
  onClose: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function PromptPreview({
  compiledPrompt,
  editedPrompt,
  onEditedPromptChange,
  onClose,
  onGenerate,
  isGenerating,
}: PromptPreviewProps) {
  const hasError = !!compiledPrompt.error;
  const displayPrompt = editedPrompt ?? compiledPrompt.prompt;
  
  return (
    <Dialog open onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-xl shadow-xl p-6">
          <Dialog.Title className="text-lg font-semibold mb-4">
            Prompt Preview
          </Dialog.Title>
          
          {/* Warnings */}
          {compiledPrompt.warnings.length > 0 && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              {compiledPrompt.warnings.map((w, i) => (
                <p key={i} className="text-sm text-yellow-800">{w}</p>
              ))}
            </div>
          )}
          
          {/* Prompt sections */}
          <div className="mb-4 space-y-2">
            {compiledPrompt.sections.map((section) => (
              <div key={section.name} className="text-sm">
                <span className="font-medium text-gray-500">{section.name}:</span>
                <span className="ml-2 text-gray-800">{section.content}</span>
              </div>
            ))}
          </div>
          
          {/* Editable prompt */}
          <textarea
            value={displayPrompt}
            onChange={(e) => onEditedPromptChange(e.target.value)}
            className="w-full h-32 p-3 border rounded-lg font-mono text-sm resize-none"
          />
          
          <div className="flex justify-between items-center mt-4">
            {editedPrompt && (
              <button
                onClick={() => onEditedPromptChange(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Reset to compiled
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button onClick={onGenerate} loading={isGenerating} disabled={hasError}>
                Generate
              </Button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
```

---

## Common Components

### Button

```typescript
// src/components/common/Button.tsx

import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { Spinner } from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variants = {
      primary: 'bg-coral-600 text-white hover:bg-coral-700 focus:ring-coral-500',
      secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-500',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
      ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
    };
    
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };
    
    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Spinner size="sm" className="mr-2" />}
        {children}
      </button>
    );
  }
);
```

---

### ToastContainer

<!-- Reconstructed: Based on the UIStore toast interface and Tailwind transition patterns -->

```typescript
// src/components/common/ToastContainer.tsx

import { useEffect } from 'react';
import { Transition } from '@headlessui/react';
import { useUIStore } from '../../stores/uiStore';
import { cn } from '../../utils/cn';

const toastStyles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const toastIcons = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Transition
          key={toast.id}
          appear
          show
          enter="transition-all duration-300 ease-out"
          enterFrom="opacity-0 translate-y-2"
          enterTo="opacity-100 translate-y-0"
          leave="transition-all duration-200 ease-in"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-2"
        >
          <div
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg min-w-[300px] max-w-[400px]',
              toastStyles[toast.type]
            )}
          >
            <span className="text-lg">{toastIcons[toast.type]}</span>
            <p className="text-sm flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-current opacity-50 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </Transition>
      ))}
    </div>
  );
}
```

---

## Utilities

### Class Name Utility

```typescript
// src/utils/cn.ts

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Formatters

```typescript
// src/utils/formatters.ts

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
```

---

## Build Configuration

### Vite Config

```typescript
// vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'fabric-vendor': ['fabric'],
        },
      },
    },
  },
});
```

### Tailwind Config

```javascript
// tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        coral: {
          50: '#fff7f5',
          100: '#ffede8',
          200: '#ffd5cc',
          300: '#ffb3a3',
          400: '#ff8a6e',
          500: '#e8714f',
          600: '#d45a38',
          700: '#b44a2d',
          800: '#943d24',
          900: '#7a3320',
        },
      },
    },
  },
  plugins: [],
};
```

---

## Component Communication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              App.tsx                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         QueryClientProvider                          │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │                        RouterProvider                          │  │    │
│  │  │                              │                                 │  │    │
│  │  │  ┌────────────────────────────────────────────────────────┐   │  │    │
│  │  │  │                     AppShell                            │   │  │    │
│  │  │  │  ┌──────────┐  ┌─────────────────────────────────┐     │   │  │    │
│  │  │  │  │ Sidebar  │  │         ProjectLayout           │     │   │  │    │
│  │  │  │  │          │  │  ┌───────────────────────────┐  │     │   │  │    │
│  │  │  │  │ - Nav    │  │  │     StoryboardPage        │  │     │   │  │    │
│  │  │  │  │ - Acts   │  │  │  ┌─────────────────────┐  │  │     │   │  │    │
│  │  │  │  │ - Scenes │  │  │  │    ShotEditor       │  │  │     │   │  │    │
│  │  │  │  │          │  │  │  │                     │  │  │     │   │  │    │
│  │  │  │  └──────────┘  │  │  └─────────────────────┘  │  │     │   │  │    │
│  │  │  │                │  └───────────────────────────┘  │     │   │  │    │
│  │  │  │                └─────────────────────────────────┘     │   │  │    │
│  │  │  └────────────────────────────────────────────────────────┘   │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘

Data Flow:
1. Zustand stores → Global UI state, auth, current project context
2. React Query → Server state, caching, mutations
3. Props → Parent-child component data
4. Callbacks → Child-to-parent updates
```
