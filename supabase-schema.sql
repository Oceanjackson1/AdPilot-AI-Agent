-- ============================================
-- AdPilot — Supabase Database Schema
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================

-- 1. 项目表
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now() not null
);

-- 2. 项目上下文文件表
create table public.project_contexts (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  file_name text not null,
  text_content text,
  file_size bigint,
  created_at timestamptz default now() not null
);

-- 3. 聊天会话表
create table public.chat_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default '新对话',
  messages jsonb not null default '[]'::jsonb,
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz default now() not null
);

-- ============================================
-- Row Level Security (RLS)
-- 用户只能访问自己的数据
-- ============================================

alter table public.projects enable row level security;
alter table public.project_contexts enable row level security;
alter table public.chat_sessions enable row level security;

-- projects: 用户只能 CRUD 自己的项目
create policy "Users can view own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can create own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "Users can delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- project_contexts: 用户只能访问自己项目的上下文
create policy "Users can view own project contexts"
  on public.project_contexts for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_contexts.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "Users can create own project contexts"
  on public.project_contexts for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = project_contexts.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "Users can delete own project contexts"
  on public.project_contexts for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_contexts.project_id
        and projects.user_id = auth.uid()
    )
  );

-- chat_sessions: 用户只能 CRUD 自己的聊天记录
create policy "Users can view own chat sessions"
  on public.chat_sessions for select
  using (auth.uid() = user_id);

create policy "Users can create own chat sessions"
  on public.chat_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own chat sessions"
  on public.chat_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own chat sessions"
  on public.chat_sessions for delete
  using (auth.uid() = user_id);

-- ============================================
-- 索引 (提升查询性能)
-- ============================================

create index idx_projects_user_id on public.projects(user_id);
create index idx_project_contexts_project_id on public.project_contexts(project_id);
create index idx_chat_sessions_user_id on public.chat_sessions(user_id);
create index idx_chat_sessions_project_id on public.chat_sessions(project_id);
